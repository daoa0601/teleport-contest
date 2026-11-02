// hero_drop.js — the hero's drop command and its shared dropx core.
// C refs: do.c drop() (714-780), dropx() (786-796),
// better_not_try_to_drop_that() (946-962).

import { IS_ALTAR, IS_SINK, LOST_DROPPED } from './const.js';
import { CORPSE, MEAT_RING, EGG, TIN, GLOB_OF_GREEN_SLIME, ENORMOUS_MEATBALL, MEATBALL, MEAT_STICK } from './object_data.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './pline.js';
import { plineWithContinuation } from './pline.js';
import { canLetGo, freeInventoryObject } from './hero_inventory.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './wield.js';
import { paranoidQuery } from './query.js';
import { touchPetrifies, heroResistsStoning } from './stoning.js';
import { heroHandName, monsterStomachName } from './body_parts.js';
import { monsterDigests } from './monster_data.js';
import { holdingMonsterName } from './hero_expulsion.js';
import { inventoryItemDescription } from './invent.js';
import {
    objectMonsterName, ownedObjectAction, observeObjectForNaming,
    definiteObjectAction,
} from './objnam.js';
import { possessiveName } from './hacklib.js';
import { heroCanReachFloor } from './floor_reach.js';
import {
    beginLevitatingArtifactDrop, finishLevitatingArtifactDrop,
} from './levitation_drop.js';
import { dropRingIntoSink } from './ring_sink.js';
import { hitFloorWithObject } from './dothrow.js';
import { shipObject, containerImpactDamage } from './dokick.js';
import { landObjectOnAltar } from './altar_object.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { impactDisturbsZombies } from './hack.js';
import { addObjectToMonsterInventory } from './steal.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { changeMonsterForm, healMonster } from './mon.js';
import { growMonster } from './makemon.js';
import { petrifyMonsterImmediately } from './trap.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { newsym, map_object } from './display.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind } from './senses.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { AD_POLY } from './monster_attack_types.js';
import { objectIsUnpaid, stolenValue, sellHeroDroppedObject, deleteObject } from './shk.js';
import { dropBall } from './ball.js';

const RING_CLASS = 4;

// with st_all (pickup.c:273-281) checks gloves and stoning resistance
// before prompting; the caller has already established otyp == CORPSE.
async function betterNotTryToDropThat(object: GameObject, state: GameState): Promise<boolean> {
    const gloves = state.uarmg || state.u?.uarmg;
    const safe = !!gloves
        || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state);
    if (safe) return false;
    const species = objectMonsterName(object);
    // C paranoid_ynq(TRUE, buf, FALSE) != 'y'; the source prompt is
    // "Drop the %s corpse without %s protection on?" with body_part(HAND)
    const confirmed = await paranoidQuery(true,
        `Drop the ${species} corpse without ${heroHandName(state)} protection on?`);
    return !confirmed;
}

// C do.c:786-796 dropx(): take a dropped carried item out of inventory and
// put it at the hero's destination.  Shared by the drop command, the ring
// sink's give-back, and other owners that need the real dropx sequence:
// freeinv, then (when not swallowed) ship_object() and the altar BUC
// revelation, then dropy/dropz through the shared floor owner.
export async function dropInventoryObjectAtHero(
    object: GameObject,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState; publish?: MessagePublisher;
    } = {},
) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;

    await freeInventoryObject(object, state);
    // freeinv can be fatal (an invoked artifact's levitation ending over
    // lava); a dead hero ships, prays, and drops nothing further
    if (state.program_state?.gameover) return;

    if (!hero.uswallow) {
        if (await shipObject(object, hero.ux, hero.uy, { state, publish }))
            return;
        const location = state.level.at(hero.ux, hero.uy);
        if (location && IS_ALTAR(location.typ)) {
            await landObjectOnAltar(object, { state, publish });
            // the altar's effects (BUC revelation side effects) gate the
            // floor placement on survival
            if (state.program_state?.gameover) return;
        }
    }
    await dropObjectAtHero(object, { state, publish });
}

// C do.c:714-780 drop(): the hero drops one carried object.  Returns
// whether a time-taking action occurred (C ECMD_TIME vs ECMD_FAIL).
export async function dropHeroObject(
    object: GameObject | null | undefined,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState; publish?: MessagePublisher;
    } = {},
) {
    requireLiveGame(state);
    const hero = state.u;
    if (!object) return false;
    requirePlayingGame(state);

    if (!await canLetGo(object, 'drop', state)) return false;
    if (object.otyp === CORPSE
        && await betterNotTryToDropThat(object, state)) return false;

    // drop() uses semantic setters before its prose, not direct setnotworn.
    if (object === (state.uwep || hero.uwep))
        await setPrimaryWeapon(null, state);
    if (object === (state.uquiver || hero.uquiver))
        await setQuiverObject(null, state);
    if (object === (state.uswapwep || hero.uswapwep))
        await setSecondaryWeapon(null, state);

    if (hero.uswallow) {
        if (!hero.ustuck) throw new Error('Swallowed hero has no swallowing monster');
        // barrier between you and the floor
        if (state.flags?.verbose !== false) {
            const swallowerName = holdingMonsterName(hero.ustuck, state);
            const into = monsterDigests(hero.ustuck)
                ? `${possessiveName(swallowerName)} ${
                    monsterStomachName(hero.ustuck.mnum)}`
                : swallowerName;
            // C drop() uses yobjnam() for unpaid objects and doname() otherwise.
            observeObjectForNaming(object, { state });
            const description = objectIsUnpaid(object)
                ? ownedObjectAction(object, null, state, { capitalized: false })
                : await inventoryItemDescription(object);
            await publish(`You drop ${description} into ${into}.`);
        }
    } else {
        const location = state.level.at(hero.ux, hero.uy);
        if ((object.oclass === RING_CLASS || object.otyp === MEAT_RING)
            && location && IS_SINK(location.typ)) {
            await dropRingIntoSink(object, { state, publish });
            return true;
        }
        if (!heroCanReachFloor(state, { checkPit: true })) {
            // we might be levitating due to #invoke Heart of Ahriman; the
            // finesse keeps the hero aloft through freeinv()/hitfloor()
            // and lands her afterwards.
            const levhack = beginLevitatingArtifactDrop(object, state);
            if (state.flags?.verbose !== false) {
                observeObjectForNaming(object, { state });
                await publish(`You drop ${await inventoryItemDescription(object)}.`);
            }
            await freeInventoryObject(object, state);
            // the finesse exists precisely because freeinv can end badly;
            // a dead hero does not reach hitfloor
            if (state.program_state?.gameover) return true;
            await hitFloorWithObject(object, { state, publish });
            // a fatal hitfloor ends the command; a dead hero does not land
            if (!state.program_state?.gameover && levhack)
                await finishLevitatingArtifactDrop(state);
            return true;
        }
        const dropLocation = state.level.at(hero.ux, hero.uy);
        if (!(dropLocation && IS_ALTAR(dropLocation.typ))
            && state.flags?.verbose !== false) {
            observeObjectForNaming(object, { state });
            await publish(`You drop ${await inventoryItemDescription(object)}.`);
        }
    }

    object.how_lost = LOST_DROPPED;
    await dropInventoryObjectAtHero(object, { state, publish });
    // the drop took time even if a fatal floor effect ended the game
    return true;
}

// ---------------------------------------------------------------------------
// C do.c:845-888 engulfer_digests_food(): an animal swallower instantly
// digests corpses, globs, and meat items; the effect owners match the
// corpse's polymorph/petrify/growth/heal potential.
// ---------------------------------------------------------------------------

const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');
// monflag.h M2_SHAPESHIFTER; pm_to_cham() (mon.c:533-546) is this test.
const M2_SHAPESHIFTER = 0x00004000;

// C obj.h:318.  Sometimes eggs and tins carry special corpsenm values that
// must not index mons[].
function isFoodObject(object: GameObject) {
    return object.otyp === CORPSE || object.otyp === EGG || object.otyp === TIN;
}

// C obj.h:321-324 polyfood(): ofood with a real corpsenm whose species is a
// shapeshifter or deals AD_POLY.
function isPolymorphFood(object: GameObject) {
    return isFoodObject(object) && object.corpsenm !== undefined && object.corpsenm >= 0
        && (((MONSTER_FLAGS2[object.corpsenm] ?? 0) & M2_SHAPESHIFTER) !== 0
            || (MONSTER_ATTACKS[object.corpsenm] || []).some(
                ([, damageType]) => damageType === AD_POLY));
}

async function engulferDigestsFood(object: GameObject, { state, publish }: { state: GameState; publish: MessagePublisher }) {
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
    } else if (object.otyp === GLOB_OF_GREEN_SLIME) {
        couldSlime = true;
    }

    await publish(`${definiteObjectAction(object, 'are', state)} instantly digested!`);

    if (couldPoly || couldSlime) {
        const change = await changeMonsterForm(swallower,
            couldSlime ? PM_GREEN_SLIME : null,
            state, { publish, showMessage: couldSlime });
        if (change?.heroDied) return { digested: true, heroDied: true };
    } else if (couldPetrify) {
        const stone = await petrifyMonsterImmediately(swallower, {
            creditHero: true, publish,
            finishDeath: (monster, options) => finishHeroMonsterKill(monster, monster.mx, monster.my, {
                ...options, showKillMessage: false, recordConduct: false,
            }),
        });
        if (stone.heroDied) return { digested: true, heroDied: true };
    } else if (couldGrow) {
        growMonster(swallower, { state });
    } else if (couldHeal) {
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

// ---------------------------------------------------------------------------
// C do.c:807-843 dropz(): put an already-free dropped object at its
// destination, with or without impact side effects.  The object's square is
// the hero's current position.
// ---------------------------------------------------------------------------

export interface DropObjectOptions {
    impact?: boolean;
    state?: GameState;
    publish?: MessagePublisher;
}

export async function dropObjectAtHero(
    object: GameObject,
    { impact = false, state = game, publish = plineWithContinuation }: DropObjectOptions = {},
) {
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
            if (digestion.heroDied) return null;
            if (!digestion.digested) {
                if (!hero.ustuck) throw new Error('A swallowed hero has no engulfer.');
                await addObjectToMonsterInventory(hero.ustuck, object, state);
            }
        }
    } else {
        const floor = await applyFloorEffects(object, hero.ux, hero.uy, {
            state, publish, verb: 'drop',
        });
        // Floor effects (lava destruction, water damage) can be fatal;
        // a dead hero gets no placement, selling, or encumbrance work.
        if (state.program_state?.gameover) return null;
        // C returns immediately when flooreffects succeeds; the tail
        // encumber_msg() is not reached on this path.
        if (floor.finished) return floor.object;
        await placeObject(object, hero.ux, hero.uy, state);
        if (impact)
            await containerImpactDamage(object, hero.ux, hero.uy, {
                state, publish, fromInventory: true,
            });
        impactDisturbsZombies(object, impact, state);
        const ball = state.uball || hero.uball;
        if (object === ball) {
            await dropBall(hero.ux, hero.uy, { state, publish });
        } else if (state.level?.flags?.has_shop) {
            await sellHeroDroppedObject(object, hero.ux, hero.uy, state,
                { publish });
        }
        const stacked = await stack_object(object, state);
        if (heroIsBlind(state) && propertyIsActive('levitation', state))
            await map_object(stacked ?? object, false);
        await newsym(hero.ux, hero.uy); // remap location under self
    }
    await reportHeroEncumbrance(state, publish);
    return object;
}
