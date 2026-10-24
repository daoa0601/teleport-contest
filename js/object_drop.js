// object_drop.js — the hero drops or grounds an object.
// C refs: do.c:dropz()/dropy() and engulfer_digests_food(),
// dothrow.c:hitfloor().
import { ALTAR, HOLE, IS_SOFT, IS_ALTAR, LEFT_SIDE, PIT, RIGHT_SIDE, SPIKED_PIT, TRAPDOOR, } from './const.js';
import { game, requireLiveGame, requireGameLevel, requireInitializedGame } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { newsym, plineWithContinuation, map_object } from './display.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './weapon_slots.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind } from './senses.js';
import { surfaceName } from './terrain_name.js';
import { definiteObjectAction, observeObjectForNaming, } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { containerImpactDamage } from './container_impact.js';
import { impactDisturbsZombies } from './object_impact.js';
import { dropBall } from './ball.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { deleteObject } from './object_delete.js';
import { stolenValue } from './shop_loss.js';
import { sellHeroDroppedObject } from './shop_sell.js';
import { objectIsUnpaid } from './shk.js';
import { shipObject } from './object_migration.js';
import { breakFloorObject } from './object_breakage.js';
import { landObjectOnAltar } from './altar_object.js';
import { CORPSE, EGG, GLOB_OF_GREEN_SLIME, ENORMOUS_MEATBALL, MEATBALL, MEAT_RING, MEAT_STICK, TIN, WAN_STRIKING, } from './object_data.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_NAME, monsterDigests, } from './monster_data.js';
import { AD_POLY } from './monster_attack_types.js';
import { touchPetrifies } from './stoning.js';
import { petrifyMonsterImmediately } from './monster_stoning.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { growMonster } from './monster_growth.js';
import { healMonster } from './mon.js';
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');
// monflag.h M2_SHAPESHIFTER; pm_to_cham() (mon.c:533-546) is this test.
const M2_SHAPESHIFTER = 0x00004000;
// C obj.h:318.  Sometimes eggs and tins carry special corpsenm values that
// must not index mons[].
function isFoodObject(object) {
    return object.otyp === CORPSE || object.otyp === EGG || object.otyp === TIN;
}
// C obj.h:321-324 polyfood(): ofood with a real corpsenm whose species is a
// shapeshifter or deals AD_POLY.
function isPolymorphFood(object) {
    return isFoodObject(object) && object.corpsenm !== undefined && object.corpsenm >= 0
        && (((MONSTER_FLAGS2[object.corpsenm] ?? 0) & M2_SHAPESHIFTER) !== 0
            || (MONSTER_ATTACKS[object.corpsenm] || []).some(([, damageType]) => damageType === AD_POLY));
}
// C do.c:845-888 engulfer_digests_food(): an animal swallower instantly
// digests corpses, globs, and meat items; the effect owners match the
// corpse's polymorph/petrify/growth/heal potential.
async function engulferDigestsFood(object, { state, publish }) {
    const swallower = state.u.ustuck;
    if (!swallower || !monsterDigests(swallower)
        || !(object.otyp === CORPSE || object.globby
            || object.otyp === MEATBALL || object.otyp === ENORMOUS_MEATBALL
            || object.otyp === MEAT_RING || object.otyp === MEAT_STICK))
        return { digested: false, heroDied: false };
    let couldPetrify = false;
    let couldPoly = false;
    let couldSlime = false;
    let couldGrow = false;
    let couldHeal = false;
    if (object.otyp === CORPSE) {
        couldPetrify = object.corpsenm !== undefined && touchPetrifies(object.corpsenm);
        couldPoly = isPolymorphFood(object);
        couldGrow = object.corpsenm === PM_WRAITH;
        couldHeal = object.corpsenm === PM_NURSE;
    }
    else if (object.otyp === GLOB_OF_GREEN_SLIME) {
        couldSlime = true;
    }
    await publish(`${definiteObjectAction(object, 'are', state)} instantly digested!`);
    if (couldPoly || couldSlime) {
        const change = await changeMonsterForm(swallower, couldSlime ? PM_GREEN_SLIME : null, state, { publish, showMessage: couldSlime });
        if (change?.heroDied)
            return { digested: true, heroDied: true };
    }
    else if (couldPetrify) {
        const stone = await petrifyMonsterImmediately(swallower, {
            creditHero: true, publish,
            finishDeath: (monster, options) => finishHeroMonsterKill(monster, monster.mx, monster.my, {
                ...options, showKillMessage: false, recordConduct: false,
            }),
        });
        if (stone.heroDied)
            return { digested: true, heroDied: true };
    }
    else if (couldGrow) {
        growMonster(swallower, { state });
    }
    else if (couldHeal) {
        healMonster(swallower, swallower.mhpmax, 0);
        // C muse.c mcureblindness() with verbose FALSE: no message
        if (!swallower.mcansee) {
            swallower.mcansee = 1;
            swallower.mblinded = 0;
        }
    }
    await deleteObject(object, state); // always used up
    return { digested: true, heroDied: false };
}
// C do.c:807-843 dropz(): put an already-free dropped object at its
// destination, with or without impact side effects.  The object's square is
// the hero's current position.
export async function dropObjectAtHero(object, { impact = false, state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    if (object === (state.uwep || hero.uwep))
        await setPrimaryWeapon(null, state);
    if (object === (state.uquiver || hero.uquiver))
        await setQuiverObject(null, state);
    if (object === (state.uswapwep || hero.uswapwep))
        await setSecondaryWeapon(null, state);
    if (hero.uswallow) {
        // hero has dropped an item while inside an engulfer
        const ball = state.uball || hero.uball;
        if (object !== ball) { // mon doesn't pick up ball
            // moving shop item into engulfer's inventory treated as theft;
            // C passes (unpaid obj, x, y, peaceful=TRUE, silent=FALSE) —
            // unpaid is the shared recursive ownership test (contents too)
            if (objectIsUnpaid(object))
                await stolenValue(object, hero.ux, hero.uy, true, {
                    state, publish, silent: false,
                });
            // add to engulfer's inventory if not immediately eaten
            const digestion = await engulferDigestsFood(object, { state, publish });
            if (digestion.heroDied)
                return null;
            if (!digestion.digested) {
                if (!hero.ustuck)
                    throw new Error('A swallowed hero has no engulfer.');
                await addObjectToMonsterInventory(hero.ustuck, object, state);
            }
        }
    }
    else {
        const floor = await applyFloorEffects(object, hero.ux, hero.uy, {
            state, publish, verb: 'drop',
        });
        // Floor effects (lava destruction, water damage) can be fatal;
        // a dead hero gets no placement, selling, or encumbrance work.
        if (state.program_state?.gameover)
            return null;
        // C returns immediately when flooreffects succeeds; the tail
        // encumber_msg() is not reached on this path.
        if (floor.finished)
            return floor.object;
        await placeObject(object, hero.ux, hero.uy, state);
        if (impact)
            await containerImpactDamage(object, hero.ux, hero.uy, {
                state, publish, fromInventory: true,
            });
        impactDisturbsZombies(object, impact, state);
        const ball = state.uball || hero.uball;
        if (object === ball) {
            await dropBall(hero.ux, hero.uy, { state, publish });
        }
        else if (state.level?.flags?.has_shop) {
            await sellHeroDroppedObject(object, hero.ux, hero.uy, state, { publish });
        }
        const stacked = await stack_object(object, state);
        if (heroIsBlind(state) && propertyIsActive('levitation', state))
            map_object(stacked ?? object, false);
        newsym(hero.ux, hero.uy); // remap location under self
    }
    await reportHeroEncumbrance(state, publish);
    return object;
}
// C dothrow.c:606-647 hitfloor(): object hits floor at hero's feet.  The
// object is free and its coordinates may be stale; every floor-bound owner
// below receives the hero's explicit position instead.
export async function hitFloorWithObject(object, { verbose = true, state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    const level = requireGameLevel(state);
    const location = level.at(hero.ux, hero.uy);
    if (!location)
        throw new Error('The hero is outside the dungeon map.');
    if (IS_SOFT(location.typ) || hero.uinwater || hero.uswallow)
        return dropObjectAtHero(object, { state, publish });
    if (IS_ALTAR(location.typ)) {
        await landObjectOnAltar(object, { state, publish });
    }
    else if (verbose) {
        // C Doname2(obj) is the capitalized full doname; otense conjugates
        // the verb by quantity.
        const verb = (object.otyp === WAN_STRIKING ? 'strike' : 'hit')
            + (object.quan > 1 ? '' : 's');
        let surf = surfaceName(hero.ux, hero.uy, state);
        const trap = level.traps.find(candidate => candidate.tx === hero.ux && candidate.ty === hero.uy);
        // describe something that might keep the object where it is or
        // precede the next message stating that it falls
        if (trap?.tseen) {
            if (trap.ttyp === TRAPDOOR)
                surf = 'trap door';
            else if (trap.ttyp === HOLE)
                surf = 'edge of the hole';
            else if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT)
                surf = 'edge of the pit';
        }
        observeObjectForNaming(object, { state });
        const description = await inventoryItemDescription(object);
        await publish(`${description.charAt(0).toUpperCase()}${description.slice(1)} `
            + `${verb} the ${surf}.`);
    }
    const broke = await breakFloorObject(object, {
        state, publish, x: hero.ux, y: hero.uy, fromInventory: true,
    });
    // A fatal break (potion vapor, burning oil) can end the game without
    // destroying the object; gate on the game-over state itself.
    if (broke.destroyed || state.program_state?.gameover)
        return null;
    if (await shipObject(object, hero.ux, hero.uy, { state: requireInitializedGame(state), publish }))
        return null;
    return dropObjectAtHero(object, { impact: true, state, publish });
}
//# sourceMappingURL=object_drop.js.map