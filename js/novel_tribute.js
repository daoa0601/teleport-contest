// C do_name.c:noveltitle() and files.c:choose_passage()/read_tribute().
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { rn2 } from './rng.js';
import { NOVEL_PASSAGES } from './tribute_data.js';
import { showTextMenuOverlay } from './windows.js';
export function selectTributePassage(count, bookId, state) {
    const tracking = state.context.novel ||= { id: 0, count: 0, pasg: [] };
    if (tracking.id !== bookId || !tracking.count) {
        tracking.id = bookId;
        tracking.pasg = [];
        let remaining = count;
        let slots = 20;
        for (let index = 1; index <= count; index++, remaining--) {
            if (count <= 20 || rn2(remaining) < slots) {
                tracking.pasg.push(index);
                slots--;
            }
        }
        tracking.count = tracking.pasg.length;
    }
    const index = rn2(tracking.count);
    const passage = tracking.pasg[index];
    const lastPassage = tracking.pasg[--tracking.count];
    if (passage === undefined || lastPassage === undefined)
        throw new Error('Novel passage selection is outside the unread passage list');
    tracking.pasg[index] = lastPassage;
    return passage;
}
export async function readNovelTribute(book, title, state = game) {
    const passages = NOVEL_PASSAGES[title];
    if (!passages?.length) {
        await plineWithContinuation(`It seems to be an incomprehensible foreign translation of "${title}"!`);
        return false;
    }
    const passage = selectTributePassage(passages.length, book.o_id, state);
    const lines = passages[passage - 1];
    if (!lines)
        throw new Error(`Novel ${title} has no passage ${passage}`);
    await showTextMenuOverlay(lines);
    let attribution = '';
    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        if (line?.trim()) {
            attribution = line;
            break;
        }
    }
    attribution = attribution.includes('[') ? attribution.trim().replace(/\s+/gu, ' ')
        : `[${title}, by Terry Pratchett]`;
    attribution = attribution.replace(/\][^\]]*$/u, `; passage #${passage}]`);
    if (state.nhDisplay?.messages) {
        state.nhDisplay.messages.push(attribution);
        if (state.nhDisplay.messages.length > 20)
            state.nhDisplay.messages.shift();
    }
    return true;
}
//# sourceMappingURL=novel_tribute.js.map