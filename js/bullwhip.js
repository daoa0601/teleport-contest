// Applying a bullwhip.
// C ref: apply.c use_whip().

import { currentAttribute } from './attrib.js';
import {
    heroFootName, heroHandName, monsterHandName,
} from './body_parts.js';
import {
    ACCESSIBLE, A_DEX, A_STR, COLNO, IS_FURNITURE, IS_LAVA,
    IS_POOL, IS_WATERWALL, Is_airlevel, Is_waterlevel,
    LAVAWALL, ROWNO, TT_PIT, W_NONPASSWALL, isok,
} from './const.js';
import {
    canSpotMonster, map_invisible, newsym, pline,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { detachFloorObjectUnit } from './floor_object.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import {
    place_object, remove_object, stack_object,
} from './mklev.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_SIZE,
    monsterTypeName,
} from './monster_data.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import {
    BOULDER, CORPSE, OBJECT_BIMANUAL,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import {
    heroIsPolymorphed, rehumanizeHero,
} from './polyself.js';
import { rnl, rn2, rnd } from './rng.js';
import { strikeSteed } from './steed.js';
import { touchPetrifyingCorpse } from './stoning.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { moveHeroByTeleport } from './teleport.js';
import { collectNearbyCoords } from './u_init.js';
import { vision_recalc, vision_reset } from './vision.js';
import { strengthDamageBonus } from './weapon_damage.js';
import { releaseWeaponSlots } from './weapon_slots.js';

const PM_GRID_BUG = 116;
const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_WALLWALK = 0x00000008;
const M1_AMPHIBIOUS = 0x00000200;
const M2_ROCKTHROW = 0x08000000;
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
    return monster?.name || monsterTypeName(
        monster?.mnum, !!monster?.female,
    );
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
    return !!(state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0);
}

function heroIsGlib(state) {
    return (state.u?.glibTurns ?? 0) > 0 || !!state.u?.glib;
}

function heroIsAirborne(state) {
    return !!(state.u?.levitating || state.u?.levitation || state.levitating
        || state.u?.flying || state.u?.flight || state.flying);
}

function whipProficiency(state) {
    let proficiency = state.urole?.key === 'archeologist' ? 1 : 0;
    const dexterity = currentAttribute(A_DEX, state);
    if (dexterity < 6) proficiency--;
    else if (dexterity >= 14) proficiency += dexterity - 14;
    if (heroIsFumbling(state)) proficiency--;
    return Math.max(0, Math.min(3, proficiency));
}

function applyImpairedDirection(direction, state) {
    const hero = state.u;
    const stunned = !!(hero?.stunned || (hero?.stunnedTurns ?? 0) > 0);
    const confused = !!(hero?.confused || (hero?.confusionTurns ?? 0) > 0);
    if (!stunned && !(confused && rn2(5) === 0)) return direction;

    const directions = hero?.umonnum === PM_GRID_BUG
        ? CARDINAL_DIRECTIONS
        : [...CARDINAL_DIRECTIONS, ...DIAGONAL_DIRECTIONS];
    return { ...direction, ...directions[rn2(directions.length)] };
}

function monsterAt(x, y, state) {
    return (state.level?.monsters || []).find(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function removeHeroObject(object, state, { destroy = false } = {}) {
    const index = state.inventory?.indexOf(object) ?? -1;
    if (index >= 0) state.inventory.splice(index, 1);
    releaseWeaponSlots(object, state);
    if (destroy) {
        object.where = 'gone';
        object.ox = object.oy = 0;
        return;
    }
    place_object(object, state.u.ux, state.u.uy);
    stack_object(object, state);
    newsym(state.u.ux, state.u.uy);
}

async function burnWhip(whip, state) {
    const luck = state.u?.uluck ?? state.u?.luck ?? state.Luck ?? 0;
    if (luck + 5 > rn2(20)) return false;
    if (whip.oerodeproof && whip.rknown) return false;
    if (whip.oerodeproof || (whip.blessed && rnl(4) === 0)) {
        if (whip.oerodeproof) {
            whip.rknown = true;
            if (state.flags?.verbose !== false)
                await pline('Somehow, your bullwhip is not affected by the heat.');
        }
        return false;
    }

    const erosion = whip.oeroded ?? 0;
    if (erosion < 3) {
        whip.oeroded = erosion + 1;
        const adverb = erosion + 1 === 3
            ? ' completely' : erosion ? ' further' : '';
        await pline(`Your bullwhip smoulders${adverb}!`);
        return false;
    }

    await pline('Your bullwhip smoulders away!');
    removeHeroObject(whip, state, { destroy: true });
    return true;
}

function isHorseCorpse(object) {
    if (object?.otyp !== CORPSE) return false;
    const species = monsterTypeName(object.corpsenm).toLowerCase();
    return species === 'pony' || species === 'horse' || species === 'warhorse';
}

async function snagFloorObject(proficiency, holdObject, state) {
    const pile = state.level?.objects?.[state.u.ux]?.[state.u.uy] || [];
    const object = pile[0];
    if (isHorseCorpse(object)) {
        await pline('Why beat a dead horse?');
        return true;
    }
    if (!object || !proficiency) return false;

    await pline(
        `You wrap your bullwhip around ${objectWithArticle(object)} on the ${
            surfaceName(state.u.ux, state.u.uy, state)}.`,
    );
    if (rnl(6) !== 0) {
        await pline('The bullwhip slips free.');
        return true;
    }
    const unit = detachFloorObjectUnit(object, state);
    if (!await holdObject(unit)) {
        place_object(unit, state.u.ux, state.u.uy);
        stack_object(unit, state);
        await pline('The bullwhip slips free.');
    }
    return true;
}

async function damageHeroWithWhip(whip, state) {
    let damage = rnd(2)
        + strengthDamageBonus(currentAttribute(A_STR, state))
        + (whip.spe ?? whip.enchantment ?? 0);
    damage = Math.max(1, damage);
    if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);

    const foot = heroFootName(state);
    await pline(`You hit your ${foot} with your bullwhip.`);
    if (heroIsPolymorphed(state)) {
        state.u.mh = (state.u.mh ?? 1) - damage;
        if (state.u.mh > 0) return false;
        if (!(state.u.unchanging || state.unchanging)) {
            const restored = rehumanizeHero(state);
            if (restored.changed)
                await pline(`You return to ${restored.race} form!`);
            return false;
        }
    } else {
        state.u.uhp = (state.u.uhp ?? 1) - damage;
        if (state.u.uhp > 0) return false;
    }

    const female = !!(state.flags?.female || state.u?.female);
    const reflexive = female ? 'herself' : 'himself';
    const possessivePronoun = female ? 'her' : 'his';
    return finishHeroDeath({
        killer: `killed ${reflexive} with ${possessivePronoun} bullwhip`,
    });
}

function monsterWeapon(monster) {
    return monster?.mw || monster?.weapon || monster?.wieldedWeapon || null;
}

function clearMonsterWeapon(monster, object) {
    removeObjectFromMonsterInventory(monster, object);
    if (monster.mw === object) monster.mw = null;
    if (monster.weapon === object) monster.weapon = null;
    if (monster.wieldedWeapon === object) monster.wieldedWeapon = null;
    object.wielded = false;
    object.owornmask = 0;
    object.where = 'free';
}

async function snatchPetrifyingCorpse(weapon, state) {
    const petrification = await touchPetrifyingCorpse(weapon, {
        action: 'Snatching',
        beforeDeath: () => place_object(
            weapon, state.u.ux, state.u.uy,
        ),
    });
    if (!petrification) return false;
    if (!petrification.died) remove_object(weapon);
    return petrification.died;
}

async function disarmMonster(monster, weapon, proficiency, holdObject, state) {
    let gotWeapon = proficiency > 0
        && (!heroIsFumbling(state) || rn2(10) !== 0);
    const hand = monsterHandName(monster.mnum);
    const hands = isTwoHanded(weapon) ? makePlural(hand) : hand;
    await pline(`You wrap your bullwhip around ${objectWithArticle(weapon)}.`);

    if (gotWeapon && weapon.cursed) {
        const wasKnown = !!weapon.bknown;
        weapon.bknown = true;
        const subject = quantityOf(weapon) === 1 ? 'It is' : 'They are';
        await pline(`${subject} welded to ${monsterObject(monster)}'s ${hands}${
            wasKnown ? '.' : '!'}`);
        gotWeapon = false;
    }
    if (!gotWeapon) {
        await pline('The bullwhip slips free.');
        return;
    }

    clearMonsterWeapon(monster, weapon);
    switch (rn2(proficiency + 1)) {
    case 2:
        await pline(`You yank ${objectWithArticle(weapon)} to the ${
            surfaceName(state.u.ux, state.u.uy, state)}!`);
        place_object(weapon, state.u.ux, state.u.uy);
        stack_object(weapon, state);
        break;
    case 3:
        await pline(`You snatch ${objectWithArticle(weapon)}!`);
        if (await snatchPetrifyingCorpse(weapon, state)) break;
        if (!await holdObject(weapon)) {
            place_object(weapon, state.u.ux, state.u.uy);
            stack_object(weapon, state);
        }
        break;
    default:
        await pline(
            `You yank ${objectWithArticle(weapon)} from ${
                possessive(monsterObject(monster))} ${hands}!`,
        );
        place_object(weapon, monster.mx, monster.my);
        stack_object(weapon, state);
        break;
    }
}

function pitAnchor(targetX, targetY, monster, state) {
    const pile = state.level?.objects?.[targetX]?.[targetY] || [];
    let anchor = pile.some(object => object.otyp === BOULDER)
        ? 'a boulder'
        : IS_FURNITURE(state.level?.at?.(targetX, targetY)?.typ)
            ? 'something' : null;
    if (monster && (MONSTER_SIZE[monster.mnum] ?? 2) >= 3
        && canSpotMonster(monster)) anchor = monsterObject(monster);
    return anchor;
}

function heroCanStandAt(x, y, state) {
    if (!isok(x, y)) return false;
    const location = state.level?.at?.(x, y);
    if (!location || monsterAt(x, y, state)) return false;

    const form = state.u?.umonnum;
    const flags1 = Number.isInteger(form) ? MONSTER_FLAGS1[form] ?? 0 : 0;
    const flags2 = Number.isInteger(form) ? MONSTER_FLAGS2[form] ?? 0 : 0;
    if (!ACCESSIBLE(location.typ)
        && (!(flags1 & M1_WALLWALK)
            || ((location.wall_info ?? 0) & W_NONPASSWALL))) return false;
    if (IS_POOL(location.typ)
        && !(flags1 & (M1_FLY | M1_SWIM | M1_AMPHIBIOUS))) return false;
    if (IS_LAVA(location.typ) && !(flags1 & M1_FLY)) return false;
    if ((state.level?.objects?.[x]?.[y] || []).some(object =>
        object.otyp === BOULDER) && !(flags2 & M2_ROCKTHROW)) return false;
    return true;
}

function pitEscapeDestination(targetX, targetY, monster, state) {
    if (!monster) return { x: targetX, y: targetY };
    const radius = Math.max(COLNO, ROWNO);
    return collectNearbyCoords(targetX, targetY, radius)
        .find(point => heroCanStandAt(point.x, point.y, state)) || null;
}

function moveHeroOutOfPit(destination, state) {
    const movement = moveHeroByTeleport(destination.x, destination.y, state);
    newsym(movement.oldx, movement.oldy);
    vision_reset();
    vision_recalc(1);
    newsym(movement.x, movement.y);
}

async function escapePit(
    targetX, targetY, monster, proficiency,
    attackMonster, holdObject, state,
) {
    const anchor = pitAnchor(targetX, targetY, monster, state);
    if (!anchor) {
        if (monster) {
            await attackMonsterWithWhip(
                monster, proficiency, attackMonster, holdObject, state,
            );
            return;
        }
        await pline('Snap!');
        return;
    }

    await pline(`You wrap your bullwhip around ${anchor}.`);
    if (proficiency > 0 && rn2(proficiency + 2) !== 0) {
        const destination = pitEscapeDestination(
            targetX, targetY, monster, state,
        );
        if (destination) {
            await pline('You yank yourself out of the pit!');
            moveHeroOutOfPit(destination, state);
        }
    } else {
        await pline('The bullwhip slips free.');
    }
    if (monster) await wakeAttackedMonster(monster);
}

async function revealWhipTarget(monster, x, y, state) {
    monster.mundetected = 0;
    const spotted = canSpotMonster(monster);
    const alreadyMarked = state.level?.at?.(x, y)?.remembered_glyph?.kind
        === 'invisible';
    if (!spotted && alreadyMarked) return;
    const blind = !!(game.blind || (game.u?.blindTurns ?? 0) > 0);
    await pline(`${spotted ? `A ${monsterName(monster)}` : 'A monster'} is there that you ${
        blind ? "hadn't noticed" : "couldn't see"}.`);
    if (spotted) newsym(x, y);
    else map_invisible(x, y);
}

async function attackMonsterWithWhip(
    monster, proficiency, attackMonster, holdObject, state,
) {
    const spottedBefore = canSpotMonster(monster);
    if (!spottedBefore) {
        await revealWhipTarget(
            monster, monster.mx, monster.my, state,
        );
    }
    const weapon = spottedBefore ? monsterWeapon(monster) : null;
    if (weapon) {
        await disarmMonster(
            monster, weapon, proficiency, holdObject, state,
        );
        await wakeAttackedMonster(monster);
        return;
    }

    let snap = true;
    if (monster.m_ap_type && !state.u?.protectionFromShapeChangers
        && !state.u?.senseMonsters) {
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        newsym(monster.mx, monster.my);
        snap = false;
    } else {
        await pline(`You flick your bullwhip towards ${monsterObject(monster)}.`);
    }
    if (proficiency > 0 && await attackMonster(monster)) return;
    if (snap) await pline('Snap!');
    await wakeAttackedMonster(monster);
}

export async function useBullwhip(
    whip,
    direction,
    {
        state = game,
        attackMonster = async () => false,
        holdObject = async () => false,
    } = {},
) {
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
    } else {
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
    if (hero.uswallow) {
        await pline('There is not enough room to flick your bullwhip.');
    } else if (state.underwater || hero.uinwater) {
        await pline('There is too much resistance to flick your bullwhip.');
    } else if (hero.dz < 0) {
        await pline(`You flick a bug off of the ${
            ceilingName(state.u.ux, state.u.uy, state)
        }.`);
    } else if (!hero.dz && (IS_WATERWALL(
        state.level?.at?.(targetX, targetY)?.typ,
    ) || state.level?.at?.(targetX, targetY)?.typ === LAVAWALL)) {
        await pline('You cause a small splash.');
        if (state.level.at(targetX, targetY).typ === LAVAWALL)
            await burnWhip(whip, state);
    } else if ((!hero.dx && !hero.dy) || hero.dz > 0) {
        if (hero.usteed && rn2(proficiency + 2) === 0) {
            await pline(`You whip ${monsterObject(hero.usteed)}!`);
            await strikeSteed({ state, announce: pline });
            return { spentTime: true };
        }
        const heroTerrain = state.level?.at?.(hero.ux, hero.uy)?.typ;
        if (IS_POOL(heroTerrain) || IS_LAVA(heroTerrain)) {
            await pline('You cause a small splash.');
            if (IS_LAVA(heroTerrain)) await burnWhip(whip, state);
            return { spentTime: true };
        }
        if ((heroIsAirborne(state) || hero.usteed)
            && await snagFloorObject(proficiency, holdObject, state)) {
            return { spentTime: true };
        }
        await damageHeroWithWhip(whip, state);
        return { spentTime: true };
    } else if ((heroIsFumbling(state) || heroIsGlib(state)) && rn2(5) === 0) {
        await pline(`The bullwhip slips out of your ${heroHandName(state)}.`);
        removeHeroObject(whip, state);
    } else if (hero.utrap && hero.utraptype === TT_PIT) {
        await escapePit(
            targetX, targetY, monster, proficiency,
            attackMonster, holdObject, state,
        );
    } else if (monster) {
        await attackMonsterWithWhip(
            monster, proficiency, attackMonster, holdObject, state,
        );
    } else if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        await pline('You snap your whip through thin air.');
    } else {
        await pline('Snap!');
    }
    return { spentTime: true };
}
