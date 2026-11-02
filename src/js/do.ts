// do.js — shared hero command transactions.
// C refs: do.c cmd_safety_prevention(), donull(), dowipe(), and wipeoff();
//         hack.c monster_nearby().

import { setHeroBlindnessTimeout } from './senses.js';
import { game, requireLiveGame } from './gstate.js';

import type { GameState } from './game_state.js';

import type { WipeFaceOccupation } from './occupation_types.js';

import { pline, plineWithContinuation } from './pline.js';





import { makeBlinded } from './sight_change.js';
import { gulpBlindnessCheck } from './engulf_blindness.js';
import { heroFaceName } from './body_parts.js';
import type { GameObject } from './object_types.js';
import { CRYSKNIFE, OBJECT_NAMES, WORM_TOOTH } from './object_data.js';
import { makePlural } from './objnam.js';
import { billForObject, chargeAlteredUnpaidObject, objectTypeKnown } from './shk.js';
import { rn2 } from './rng.js';
import { callObjectType } from './do_name.js';
import type { ObjectCallResult } from './do_name.js';
import { threateningMonsterNearby } from './hack.js';


function dangerousHeroProperties() {
    const u = game.u;
    return !!(u.stoned || (u.stonedTurns ?? 0) > 0
        || u.slimed || (u.slimedTurns ?? 0) > 0
        || u.strangled || (u.strangledTurns ?? 0) > 0
        || u.sick || (u.sickTurns ?? 0) > 0);
}

// C Norep() compares pline.c's previous individual message.
async function norep(message: string): Promise<void> {
    if (game._lastPlineMessage !== message) await pline(message);
}

// C do.c:cmd_safety_prevention().  The per-command counter is durable across
// rejected inputs: with cmdassist disabled the first warning includes the
// `m`-prefix hint and later warnings shorten.  A successful or forced command
// resets its own counter.
export async function commandSafetyPrevention({
    force = false,
    multi = false,
    verb,
    description,
    action,
    counterKey,
}: { force?: boolean; multi?: boolean; verb: string; description: string; action: string; counterKey: '_didNothingFlag' | '_alreadyFoundFlag' }): Promise<boolean> {
    if (game.flags?.safe_wait !== false && !force && !multi) {
        const count = game[counterKey] ?? 0;
        const cmdassist = game.flags?.cmdassist !== false;
        const suffix = cmdassist || count === 0
            ? `  Use 'm' prefix to force ${description}.`
            : '';
        if (!cmdassist) game[counterKey] = count + 1;

        if (threateningMonsterNearby()) {
            await norep(`${action}${suffix}`);
            game.context.move = 0;
            return true;
        }
        if (dangerousHeroProperties()) {
            await norep(`${verb} doesn't feel like a good idea right now.`);
            game.context.move = 0;
            return true;
        }
    }

    game[counterKey] = 0;
    return false;
}

// C do.c:donull().  Return true when the wait consumes time and false when
// safe-wait policy rejects it.
export async function donull(force = false, multi = false) {
    const prevented = await commandSafetyPrevention({
        force,
        multi,
        verb: 'Waiting',
        description: 'a no-op (to rest)',
        action: 'Are you waiting to get hit?',
        counterKey: '_didNothingFlag',
    });
    return !prevented;
}

// C do.c:dowipe().  Starting the command and cleaning one turn are separate
// because monsters and timed effects act between occupation turns.
export async function dowipe(state: GameState = game): Promise<void> {
    if ((state.u?.ucreamed ?? 0) > 0) {
        state._occupation = {
            key: 'wipe-face',
            remaining: 1,
            text: `wiping off your ${heroFaceName(state)}`,
        };
        state.context.move = 1;
        return;
    }
    await pline(`Your ${heroFaceName(state)} is already clean.`);
    state.context.move = 1;
}

export async function continueWipingFace(occupation: WipeFaceOccupation, state: GameState = game): Promise<boolean> {
    occupation.remaining--;
    const creamRemoved = Math.min(4, state.u?.ucreamed ?? 0);
    const blindnessRemoved = Math.min(4, state.u?.blindTurns ?? 0);
    state.u.ucreamed = Math.max(
        0, (state.u?.ucreamed ?? 0) - creamRemoved,
    );
    state.u.blindTurns = Math.max(
        0, (state.u?.blindTurns ?? 0) - blindnessRemoved,
    );

    if ((state.u?.blindTurns ?? 0) === 0) {
        await pline("You've got the glop off.");
        state.u.ucreamed = 0;
        const gulp = await gulpBlindnessCheck({ state, publish: plineWithContinuation });
        if (!gulp.triggered && !gulp.died) {
            setHeroBlindnessTimeout(1, state);
            await makeBlinded(0, { state, publish: plineWithContinuation });
        }
        state._occupation = null;
    } else if ((state.u?.ucreamed ?? 0) === 0) {
        await pline(`Your ${heroFaceName(state)} feels clean now.`);
        state._occupation = null;
    } else if (occupation.remaining <= 0) {
        occupation.remaining = 1;
    }
    state.context.move = 1;
    return true;
}

// C do.c obj_no_longer_held(): leaving direct hero/monster possession.
// Extraction, placement, and container linkage remain with their own owners.

function* objectTree(object: GameObject): Generator<GameObject, void> {
    for (const content of object.contents || []) yield* objectTree(content);
    yield object;
}
// Each decision is lazy: any shop speech finishes before the next node's RNG.
function* crysknifeReversions(object: GameObject): Generator<GameObject, void> {
    for (const member of objectTree(object)) {
        if (member.otyp === CRYSKNIFE
            && (!member.oerodeproof || rn2(10) === 0)) yield member;
    }
}
function revertCrysknife(object: GameObject): void {
    object.otyp = WORM_TOOTH;
    object.oerodeproof = false;
    const name = OBJECT_NAMES[WORM_TOOTH];
    if (typeof name !== 'string')
        throw new Error('Worm tooth has no canonical object name');
    if (object.name !== undefined) object.name = name;
    if (object.plural !== undefined) object.plural = makePlural(name);
}
export function assertCreatedObject(
    object: GameObject, state: GameState = game,
): void {
    if (object.where !== 'free')
        throw new Error(`created object must be free, got ${object.where}`);
    for (const member of objectTree(object)) {
        if (member.unpaid || billForObject(member, state))
            throw new Error('created object must be unbilled');
    }
}
// Valid only for immediate constructor graphs. An unbilled free root cannot
// be charged; contained descendants have no costly_alteration mutation case.
export function createdObjectNoLongerHeld(
    object: GameObject, state: GameState = game,
): void {
    assertCreatedObject(object, state);
    for (const member of crysknifeReversions(object)) revertCrysknife(member);
}
export function objectNoLongerHeldSynchronously(
    object: GameObject | null | undefined, state: GameState = game,
): void {
    if (!object) return;
    if (!state.context?.mon_moving && !state.program_state?.gameover) {
        for (const member of objectTree(object)) {
            if (member.otyp === CRYSKNIFE)
                throw new Error('hero-controlled crysknife release must be awaited');
        }
    }
    for (const member of crysknifeReversions(object)) revertCrysknife(member);
}
// C do.c:obj_no_longer_held().
export async function objectNoLongerHeld(
    object: GameObject | null | undefined, state: GameState = game,
): Promise<void> {
    requireLiveGame(state);
    if (!object) return;
    for (const member of crysknifeReversions(object)) {
        if (!state.context?.mon_moving && !state.program_state?.gameover)
            await chargeAlteredUnpaidObject(member, 'degrade', state);
        revertCrysknife(member);
    }
}

// C do.c:trycall(). If obj is neither formally identified nor informally
// called, prompt for a call name before the object's identity is lost.
export async function tryCallObjectType(
    object: GameObject | null | undefined,
    state: GameState = game,
): Promise<ObjectCallResult> {
    if (
        !object ||
        object.dknown === false ||
        objectTypeKnown(object, state) ||
        state._objectCallNames?.[object.otyp]
    ) {
        return { prompted: false, named: false, callName: null };
    }
    return callObjectType(object, state);
}
