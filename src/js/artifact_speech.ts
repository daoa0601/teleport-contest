// C artifact.c:arti_speak(). Speaking artifacts select rumors by their BUC.

import { artifactById } from './artifacts.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { getRumor } from './mklev.js';
import { objectName, objectNameIsPlural } from './objnam.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';

export async function speakArtifact(
    object: GameObject,
    { state = game }: { state?: GameState } = {},
): Promise<boolean> {
    requireLiveGame(state);
    if (!artifactById(object?.oartifact, state)?.flags.includes('SPFX_SPEAK')) return false;
    const truth = object.blessed ? 1 : object.cursed ? -1 : 0;
    const line = getRumor(true, truth) || 'NetHack rumors file closed for renovation.';
    // Both speaking artifacts have definite names, even when unidentified.
    const name = objectName(object, state).replace(/^the /i, '');
    await pline(`The ${name} ${objectNameIsPlural(object, state) ? 'whisper' : 'whispers'}:`);
    // Native arti_speak does not check deafness before verbalize.
    await pline(`"${line}"`);
    return true;
}
