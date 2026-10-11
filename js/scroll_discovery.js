// C read.c:learnscrolltyp()/learnscroll(). Discovering a scroll awards score
// experience in addition to the Wisdom exercise owned by makeknown().
import { addExperience } from './exper.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { OBJECT_INITIAL_KNOWN } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
const SPBOOK_CLASS = 10;
export function learnScrollType(otyp, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (OBJECT_INITIAL_KNOWN[otyp] || state._knownObjectTypes?.has(otyp))
        return false;
    learnObjectType(otyp, state);
    addExperience(0, 10, state);
    return true;
}
export function learnScroll(source, { state = game, } = {}) {
    return source.oclass === SPBOOK_CLASS ? false : learnScrollType(source.otyp, { state });
}
//# sourceMappingURL=scroll_discovery.js.map