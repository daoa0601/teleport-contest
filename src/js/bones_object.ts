import { BOOMERANG, BOW, ELVEN_BOW, ORCISH_BOW, YUMI } from './object_data.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { definiteName, objectCombatName } from './objnam.js';

const HANDED_WEAPONS = new Set([
    BOW, ELVEN_BOW, ORCISH_BOW, YUMI, BOOMERANG,
]);


// C bones.c:fix_ghostly_obj()
// The ghostly pickup notice; returns the handedness adjustment message.
export function finishGhostlyPickup(object: GameObject | null | undefined, state: GameState): string | null {
    if (!object?.ghostly) return null;
    object.ghostly = false;
    if (!HANDED_WEAPONS.has(object.otyp)) return null;

    const noun = definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state);
    const hand = state?.u?.rightHanded === false ? 'left' : 'right';
    return `You make adjustments to ${noun} to suit your ${hand} hand.`;
}
