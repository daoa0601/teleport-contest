import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from './const.js';
import { currentAttribute } from './attrib.js';
import { requirePlayingGame } from './gstate.js';
import { formatFeltMessage } from './hero_speech.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
// C dig.c:draft_message(). Callers decide when the hero feels the draft.
export function formatDraftMessage(unexpected, state, random = rn2) {
    requirePlayingGame(state);
    if (!heroIsHallucinating(state))
        return formatFeltMessage(unexpected ? 'an unexpected draft.' : 'a draft.', state);
    if (unexpected) {
        const unfit = [A_STR, A_DEX, A_CON, A_CHA, A_INT, A_WIS]
            .some(attribute => currentAttribute(attribute, state) < 6);
        return formatFeltMessage(`like you are ${unfit ? '4-F' : '1-A'}.`, state);
    }
    const alignment = Math.sign(state.u.ualign.type);
    let reaction = random(2) + 1 - alignment;
    if (state.u.ualign.record < 4)
        reaction += random(3) + alignment - 1;
    const description = ['enlisting', 'marching', 'protesting', 'fleeing'][reaction];
    if (!description)
        throw new RangeError(`Invalid hallucinated draft reaction ${reaction}`);
    return formatFeltMessage(`like ${description}.`, state);
}
//# sourceMappingURL=draft_message.js.map