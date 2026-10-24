// hero_drop.js — the hero's drop command and its shared dropx core.
// C refs: do.c drop() (714-780), dropx() (786-796),
// better_not_try_to_drop_that() (946-962).

import { IS_ALTAR, IS_SINK, LOST_DROPPED } from './const.js';
import { CORPSE, MEAT_RING } from './object_data.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import { plineWithContinuation } from './display.js';
import { canLetGo, freeInventoryObject } from './hero_inventory.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './weapon_slots.js';
import { paranoidQuery } from './query.js';
import { touchPetrifies, heroResistsStoning } from './stoning.js';
import { heroHandName, monsterStomachName } from './body_parts.js';
import { MONSTER_NAME, monsterDigests } from './monster_data.js';
import { holdingMonsterName } from './hero_expulsion.js';
import { inventoryItemDescription } from './invent.js';
import {
    objectName, observeObjectForNaming,
} from './objnam.js';
import { carriedObjectOwner, objectIsUnpaid } from './shk.js';
import { heroCanReachFloor } from './floor_reach.js';
import {
    beginLevitatingArtifactDrop, finishLevitatingArtifactDrop,
} from './levitation_drop.js';
import { dropRingIntoSink } from './ring_sink.js';
import { shipObject } from './object_migration.js';
import { landObjectOnAltar } from './altar_object.js';
import { dropObjectAtHero, hitFloorWithObject } from './object_drop.js';

const RING_CLASS = 4;

function possessive(name: string): string {
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

// C do.c:946-962 better_not_try_to_drop_that(): u_safe_from_fatal_corpse()
// with st_all (pickup.c:273-281) checks gloves and stoning resistance
// before prompting; the caller has already established otyp == CORPSE.
async function betterNotTryToDropThat(object: GameObject, state: GameState): Promise<boolean> {
    const gloves = state.uarmg || state.u?.uarmg;
    const safe = !!gloves
        || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state);
    if (safe) return false;
    const species = object.corpsenm === undefined ? 'monster'
        : MONSTER_NAME[object.corpsenm] || 'monster';
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
            const swallowerName = holdingMonsterName(hero.ustuck);
            const into = monsterDigests(hero.ustuck)
                ? `${possessive(swallowerName)} ${
                    monsterStomachName(hero.ustuck.mnum)}`
                : swallowerName;
            // C do.c:748: unpaid objects take the yobjnam form — shk_your()
            // ownership ("your"/"Kabale's") plus aobjnam's counted xname —
            // while paid objects take plain doname.
            const owner = carriedObjectOwner(object, state);
            // C shk_your() yields lowercase "your"/"the" but keeps proper
            // shopkeeper names capitalized; only the generic articles are
            // lowercased for mid-sentence use
            const ownerText = owner === 'Your' ? 'your'
                : owner === 'The' ? 'the' : owner;
            observeObjectForNaming(object, { state });
            const description = objectIsUnpaid(object)
                ? `${ownerText} ${
                    (object.quan > 1 ? `${object.quan} ` : '')
                    + objectName(object, state)}`
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
