// Applying a bullwhip.
// C ref: apply.c use_whip().
import { monsterAtPosition } from './monster_location.js';
import { currentAttribute } from './attrib.js';
import { observeObjectForNaming } from './objnam.js';
import { heroFootName, heroHandName, monsterHandName, } from './body_parts.js';
import { A_DEX, IS_FURNITURE, IS_WATERWALL, Is_airlevel, Is_waterlevel, LAVAWALL, TT_PIT, isok, } from './const.js';
import { canSpotMonster, map_invisible, newsym, pline, plineWithContinuation, } from './display.js';
import { placeObject, remove_object, stack_object, } from './floor_object.js';
import { objectNoLongerHeld } from './object_release.js';
import { pickupFloorObject } from './pickup.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { inventoryItemDescription } from './invent.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { MONSTER_SIZE, monsterTypeName } from './monster_data.js';
import { findMonsterNearPosition } from './mklev.js';
import { heroSpecies } from './hero_species.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { announceInvocationSquare } from './invocation.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { unwieldMonsterWeapon } from './monster_weapon.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { BOULDER, CORPSE, OBJECT_BIMANUAL, } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { rnl, rn2, rnd } from './rng.js';
import { strikeSteed } from './steed.js';
import { snatchPetrifyingCorpse as snatchCorpseBareHanded } from './stoning.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolOrLavaAt } from './terrain_properties.js';
import { moveHeroByTeleport } from './teleport.js';
import { resetHeroTrap } from './terrain_movement.js';
import { vision_recalc, vision_reset } from './vision.js';
import { heroStrengthDamageBonus } from './weapon_damage.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { propertyIsActive } from './properties.js';
import { heroHasSlipperyHands } from './slippery_hands.js';
import { fireDamageObject } from './fire_damage.js';
const PM_GRID_BUG = 116;
const CARDINAL_DIRECTIONS = [
    { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 0 }, { dx: 0, dy: 1 },
];
const DIAGONAL_DIRECTIONS = [
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
    { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
];
function quantityOf(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
function objectWithArticle(object) {
    const description = inventoryItemDescription(object)
        .replace(/ \([^)]*\)$/u, '');
    return description;
}
function monsterName(monster) {
    return monster?.name || monsterTypeName(monster?.mnum, !!monster?.female);
}
function monsterObject(monster) {
    return monster?.name ? monster.name : `the ${monsterName(monster)}`;
}
function possessive(text) {
    return /s$/iu.test(text) ? `${text}'` : `${text}'s`;
}
function isTwoHanded(object) {
    return !!(object?.bimanual || OBJECT_BIMANUAL[object?.otyp]);
}
function heroIsFumbling(state) {
    return propertyIsActive('fumbling', state);
}
function heroIsAirborne(state) {
    return !!(state.u?.levitating || state.u?.levitation || state.levitating
        || state.u?.flying || state.flying);
}
function whipProficiency(state) {
    let proficiency = state.urole?.key === 'archeologist' ? 1 : 0;
    const dexterity = currentAttribute(A_DEX, state);
    if (dexterity < 6)
        proficiency--;
    else if (dexterity >= 14)
        proficiency += dexterity - 14;
    if (heroIsFumbling(state))
        proficiency--;
    return Math.max(0, Math.min(3, proficiency));
}
function applyImpairedDirection(direction, state) {
    const hero = state.u;
    const stunned = !!(hero?.stunned || (hero?.stunnedTurns ?? 0) > 0);
    const confused = !!(hero?.confused || (hero?.confusionTurns ?? 0) > 0);
    if (!stunned && !(confused && rn2(5) === 0))
        return direction;
    const directions = hero?.umonnum === PM_GRID_BUG
        ? CARDINAL_DIRECTIONS
        : [...CARDINAL_DIRECTIONS, ...DIAGONAL_DIRECTIONS];
    const redirected = directions[rn2(directions.length)];
    if (!redirected)
        throw new RangeError('The whip selected a missing direction.');
    return { ...direction, ...redirected };
}
function monsterAt(x, y, state) {
    return state.level ? monsterAtPosition(state.level, x, y) : null;
}
function isHorseCorpse(object) {
    if (object?.otyp !== CORPSE)
        return false;
    if (object.corpsenm === undefined)
        throw new Error('A corpse requires a monster species.');
    const species = monsterTypeName(object.corpsenm).toLowerCase();
    return species === 'pony' || species === 'horse' || species === 'warhorse';
}
async function snagFloorObject(proficiency, state) {
    const pile = state.level?.objects?.[state.u.ux]?.[state.u.uy] || [];
    const object = pile[0];
    if (isHorseCorpse(object)) {
        await pline('Why beat a dead horse?');
        return true;
    }
    if (!object || !proficiency)
        return false;
    observeObjectForNaming(object, { state });
    await pline(`You wrap your bullwhip around ${objectWithArticle(object)} on the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
    if (rnl(6) !== 0) {
        await pline('The bullwhip slips free.');
        return true;
    }
    if (!await pickupFloorObject(object, 1, true))
        await pline('The bullwhip slips free.');
    return true;
}
async function damageHeroWithWhip(whip, state) {
    let damage = rnd(2)
        + heroStrengthDamageBonus(state)
        + (whip.spe ?? whip.enchantment ?? 0);
    damage = Math.max(1, damage);
    if (state.u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    const foot = heroFootName(state);
    await pline(`You hit your ${foot} with your bullwhip.`);
    const female = !!state.flags.female;
    const reflexive = female ? 'herself' : 'himself';
    const possessivePronoun = female ? 'her' : 'his';
    return loseHeroHp(damage, `killed ${reflexive} with ${possessivePronoun} bullwhip`, { state, publish: pline });
}
async function snatchPetrifyingCorpse(weapon, state) {
    const petrification = await snatchCorpseBareHanded(weapon, {
        beforeDeath: async () => {
            await placeObject(weapon, state.u.ux, state.u.uy);
        },
    });
    if (!petrification)
        return false;
    if (!petrification.died)
        remove_object(weapon);
    return petrification.died;
}
/** Returns true when the hero died during the disarm (snatch death ends the game). */
async function disarmMonster(monster, weapon, proficiency, state) {
    // C apply.c:3156: a fumbling hero keeps hold only on !rn2(10).
    let gotWeapon = proficiency > 0
        && (!heroIsFumbling(state) || rn2(10) === 0);
    const hand = monsterHandName(monster.mnum);
    const hands = isTwoHanded(weapon) ? makePlural(hand) : hand;
    observeObjectForNaming(weapon, { state });
    await pline(`You wrap your bullwhip around ${objectWithArticle(weapon)}.`);
    if (gotWeapon && weapon.cursed) {
        const wasKnown = !!weapon.bknown;
        weapon.bknown = true;
        const subject = quantityOf(weapon) === 1 ? 'It is' : 'They are';
        await pline(`${subject} welded to ${monsterObject(monster)}'s ${hands}${wasKnown ? '.' : '!'}`);
        gotWeapon = false;
    }
    if (!gotWeapon) {
        await pline('The bullwhip slips free.');
        return false;
    }
    // C apply.c:3175-3177: obj_extract_self() + possibly_unwield() +
    // setmnotwielded() — a raw unlink plus wield-slot clearing, NOT the
    // worn-item unwear owner (no trap/saddle/extrinsic work, and no
    // crysknife release: the monster's held blade is extracted exactly as
    // it is).  possibly_unwield()'s not-in-inventory branch collapses into
    // the same wield-slot clear because the extraction just ran.
    unlinkMonsterObject(monster, weapon);
    await unwieldMonsterWeapon(monster, state, { weapon, publish: pline });
    switch (rn2(proficiency + 1)) {
        case 2:
            observeObjectForNaming(weapon, { state });
            await plineWithContinuation(`You yank ${objectWithArticle(weapon)} to the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
            await placeObject(weapon, state.u.ux, state.u.uy);
            await stack_object(weapon, state);
            break;
        case 3:
            observeObjectForNaming(weapon, { state });
            await plineWithContinuation(`You snatch ${objectWithArticle(weapon)}!`);
            if (await snatchPetrifyingCorpse(weapon, state))
                return true;
            // C apply.c:3230: hold_another_object() owns fumbling, slot, and
            // capacity refusal, dropping the weapon at the hero's feet.  A fatal
            // artifact blast ends the game there (artifact.c:958), before
            // use_whip()'s trailing wakeup().
            if ((await holdAnotherObject(weapon, {
                state, dropMessage: `You drop ${inventoryItemDescription(weapon)}!`,
            })).heroDied)
                return true;
            break;
        default:
            observeObjectForNaming(weapon, { state });
            await plineWithContinuation(`You yank ${objectWithArticle(weapon)} from ${possessive(monsterObject(monster))} ${hands}!`);
            // C apply.c:3237-3238: obj_no_longer_held() runs before
            // place_object(); the release repeats inside the placement owner
            // by design — a fixed crysknife can survive the first release and
            // revert on the second.  Do not deduplicate this source-owned
            // repetition.
            await objectNoLongerHeld(weapon, state);
            await placeObject(weapon, monster.mx, monster.my);
            await stack_object(weapon, state);
            break;
    }
    return false;
}
function pitAnchor(targetX, targetY, monster, state) {
    const pile = state.level?.objects?.[targetX]?.[targetY] || [];
    const location = state.level?.at(targetX, targetY);
    let anchor = pile.some(object => object.otyp === BOULDER)
        ? 'a boulder'
        : location && IS_FURNITURE(location.typ)
            ? 'something' : null;
    if (monster && (MONSTER_SIZE[monster.mnum] ?? 2) >= 3
        && canSpotMonster(monster))
        anchor = monsterObject(monster);
    return anchor;
}
function pitEscapeDestination(targetX, targetY, monster, state) {
    return monster
        ? findMonsterNearPosition(heroSpecies(state), targetX, targetY, { state })
        : { x: targetX, y: targetY };
}
async function moveHeroOutOfPit(destination, state) {
    await resetHeroTrap(true, state);
    const movement = await moveHeroByTeleport(destination.x, destination.y, state, { allowDrag: true });
    newsym(movement.oldx, movement.oldy);
    vision_reset();
    vision_recalc(0);
    const landing = await finishDestinationSpotEffects({
        oldx: movement.oldx, oldy: movement.oldy,
        newx: movement.x, newy: movement.y,
    });
    if (landing.died)
        return;
    await announceInvocationSquare();
    state.vision_full_recalc = 1;
}
async function escapePit(targetX, targetY, monster, proficiency, attackMonster, state) {
    const anchor = pitAnchor(targetX, targetY, monster, state);
    if (!anchor) {
        if (monster) {
            await attackMonsterWithWhip(monster, targetX, targetY, proficiency, attackMonster, state);
            return;
        }
        await pline('Snap!');
        return;
    }
    await pline(`You wrap your bullwhip around ${anchor}.`);
    if (proficiency > 0 && rn2(proficiency + 2) !== 0) {
        const destination = pitEscapeDestination(targetX, targetY, monster, state);
        if (destination) {
            await pline('You yank yourself out of the pit!');
            await moveHeroOutOfPit(destination, state);
        }
    }
    else {
        await pline('The bullwhip slips free.');
    }
    if (monster)
        await wakeAttackedMonster(monster);
}
async function revealWhipTarget(monster, x, y, state) {
    monster.mundetected = 0;
    const spotted = canSpotMonster(monster);
    const alreadyMarked = state.level?.at?.(x, y)?.remembered_glyph?.kind
        === 'invisible';
    if (!spotted && alreadyMarked)
        return;
    const blind = !!(game.blind || (game.u?.blindTurns ?? 0) > 0);
    await pline(`${spotted ? `A ${monsterName(monster)}` : 'A monster'} is there that you ${blind ? "hadn't noticed" : "couldn't see"}.`);
    if (spotted)
        newsym(x, y);
    else
        map_invisible(x, y);
}
async function attackMonsterWithWhip(monster, x, y, proficiency, attackMonster, state) {
    const spottedBefore = canSpotMonster(monster);
    if (!spottedBefore) {
        await revealWhipTarget(monster, x, y, state);
    }
    const weapon = spottedBefore ? monsterWieldedWeapon(monster) : null;
    if (weapon) {
        if (await disarmMonster(monster, weapon, proficiency, state))
            return;
        await wakeAttackedMonster(monster);
        return;
    }
    let snap = true;
    if (monster.m_ap_type && !state.u?.protectionFromShapeChangers) {
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        newsym(monster.mx, monster.my);
        snap = false;
    }
    else {
        await pline(`You flick your bullwhip towards ${monsterObject(monster)}.`);
    }
    if (proficiency > 0 && await attackMonster(monster, x, y))
        return;
    if (snap)
        await pline('Snap!');
    await wakeAttackedMonster(monster);
}
export async function useBullwhip(whip, direction, { state = game, attackMonster = async () => false, } = {}) {
    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;
    let targetX;
    let targetY;
    let monster;
    if (hero.uswallow && hero.ustuck) {
        monster = hero.ustuck;
        targetX = monster.mx;
        targetY = monster.my;
    }
    else {
        direction = applyImpairedDirection(direction, state);
        hero.dx = direction.dx;
        hero.dy = direction.dy;
        targetX = hero.ux + hero.dx;
        targetY = hero.uy + hero.dy;
        if (!isok(targetX, targetY)) {
            await pline('You miss.');
            return { spentTime: false };
        }
        monster = monsterAt(targetX, targetY, state);
    }
    const proficiency = whipProficiency(state);
    const targetLocation = state.level?.at(targetX, targetY);
    if (hero.uswallow) {
        await pline('There is not enough room to flick your bullwhip.');
    }
    else if (state.underwater || hero.uinwater) {
        await pline('There is too much resistance to flick your bullwhip.');
    }
    else if (hero.dz < 0) {
        await pline(`You flick a bug off of the ${ceilingName(state.u.ux, state.u.uy, state)}.`);
    }
    else if (!hero.dz && targetLocation && (IS_WATERWALL(targetLocation.typ)
        || targetLocation.typ === LAVAWALL)) {
        await pline('You cause a small splash.');
        if (targetLocation.typ === LAVAWALL)
            await fireDamageObject(whip, {
                state, x: targetX, y: targetY, publish: plineWithContinuation,
            });
    }
    else if ((!hero.dx && !hero.dy) || hero.dz > 0) {
        if (hero.usteed && rn2(proficiency + 2) === 0) {
            await pline(`You whip ${monsterObject(hero.usteed)}!`);
            await strikeSteed({ state, announce: pline });
            return { spentTime: true };
        }
        if (isPoolOrLavaAt(hero.ux, hero.uy, state)
            || (targetLocation && (IS_WATERWALL(targetLocation.typ)
                || targetLocation.typ === LAVAWALL))) {
            await pline('You cause a small splash.');
            if (isLavaAt(hero.ux, hero.uy, state)) {
                await fireDamageObject(whip, {
                    state, x: hero.ux, y: hero.uy, publish: plineWithContinuation,
                });
            }
            return { spentTime: true };
        }
        if ((heroIsAirborne(state) || hero.usteed)
            && await snagFloorObject(proficiency, state)) {
            return { spentTime: true };
        }
        await damageHeroWithWhip(whip, state);
        return { spentTime: true };
    }
    else if ((heroIsFumbling(state) || heroHasSlipperyHands(state)) && rn2(5) === 0) {
        await pline(`The bullwhip slips out of your ${heroHandName(state)}.`);
        await dropInventoryObjectAtHero(whip, { state });
    }
    else if (hero.utrap && hero.utraptype === TT_PIT) {
        await escapePit(targetX, targetY, monster, proficiency, attackMonster, state);
    }
    else if (monster) {
        await attackMonsterWithWhip(monster, targetX, targetY, proficiency, attackMonster, state);
    }
    else if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        await pline('You snap your whip through thin air.');
    }
    else {
        await pline('Snap!');
    }
    return { spentTime: true };
}
//# sourceMappingURL=bullwhip.js.map