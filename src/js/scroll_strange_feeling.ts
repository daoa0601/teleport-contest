// C potion.c:strange_feeling(). Detection already owns its result message;
// both paths finish through the same object naming and single-use boundary.
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { consumeInventoryItem } from './invent.js';
import { tryCallObjectType } from './object_call.js';
import { heroIsHallucinating } from './senses.js';
import type { GameObject } from './object_types.js';
import type { ScrollEffectOptions, ScrollEffectResult } from './scroll_effects.js';

export async function strangeFeeling(source: GameObject | null, text: string | null, {
    state = game,
}: Pick<ScrollEffectOptions, 'state'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const message = state.flags.beginner || !text
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : text;
    await plineWithContinuation(message);
    return finishStrangeFeeling(source, { state });
}

export async function finishStrangeFeeling(source: GameObject | null, {
    state = game,
}: Pick<ScrollEffectOptions, 'state'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (source?.dknown) await tryCallObjectType(source, state);
    if (source) await consumeInventoryItem(source, state);
    return { known: false, consumed: !!source, heroDied: !!state.program_state.gameover };
}
