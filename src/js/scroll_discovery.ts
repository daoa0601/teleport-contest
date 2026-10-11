// C read.c:learnscrolltyp()/learnscroll(). Discovering a scroll awards score
// experience in addition to the Wisdom exercise owned by makeknown().
import { addExperience } from './exper.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { OBJECT_INITIAL_KNOWN } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

const SPBOOK_CLASS = 10;

export function learnScrollType(otyp: number, { state = game }: { state?: GameState | undefined } = {}): boolean {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (OBJECT_INITIAL_KNOWN[otyp] || state._knownObjectTypes?.has(otyp)) return false;
    learnObjectType(otyp, state);
    addExperience(0, 10, state);
    return true;
}

export function learnScroll(source: Pick<GameObject, 'otyp' | 'oclass'>, {
    state = game,
}: { state?: GameState | undefined } = {}): boolean {
    return source.oclass === SPBOOK_CLASS ? false : learnScrollType(source.otyp, { state });
}
