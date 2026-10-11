// C do.c obj_no_longer_held(): leaving direct hero/monster possession.
// Extraction, placement, and container linkage remain with their own owners.

import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { CRYSKNIFE, OBJECT_NAMES, WORM_TOOTH } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { billForObject, chargeAlteredUnpaidObject } from './shk.js';
import { rn2 } from './rng.js';

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
