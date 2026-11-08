// iactions.js — the iactions.c owner: the inventory window's per-item
// action text.  iactions.c:itemactions_pushkeys() (the chosen action's
// command queueing) stays in cmd.ts: its body is cmdq_add_*() calls, and the
// port dispatches the inventory windows from cmd.ts's command loop, so the
// helper cannot live here without an import cycle over the cmdq calls.
// C ref: iactions.c — item_reading_classification(), itemactions_pushkeys().
import { SCROLL_CLASS, SPBOOK_CLASS } from './objclass.js';
import {
    ALCHEMY_SMOCK, FORTUNE_COOKIE, HAWAIIAN_SHIRT, OBJECT_NAMES,
    SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL,
} from './object_data.js';
import { simpleObjectName } from './objnam.js';
import { objectTypeKnown } from './o_init.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';

// C objclass.h:SCR_MAIL — resolved from the port's name table.
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');

// C iactions.c:item_reading_classification(). Reading advice depends on
// what the hero knows about the type, rather than the object's charges.
export function itemReadingText(item: GameObject, state: GameState): string | null {
    const known = objectTypeKnown(item, state);
    if (item.otyp === FORTUNE_COOKIE) return 'Read the message inside this cookie';
    if (item.otyp === OBJECT_NAMES.indexOf('T-shirt')) return 'Read the slogan on the shirt';
    if (item.otyp === ALCHEMY_SMOCK) return 'Read the slogan on the apron';
    if (item.otyp === HAWAIIAN_SHIRT) return 'Look at the pattern on the shirt';
    if (item.oclass === SCROLL_CLASS) {
        const magic = item.dknown && item.otyp !== SCR_MAIL
            && (item.otyp !== SCR_BLANK_PAPER || !known)
            ? ' to activate its magic' : '';
        return `Read this scroll${magic}`;
    }
    if (item.oclass !== SPBOOK_CLASS) return null;
    const novel = item.otyp === SPE_NOVEL;
    const blank = item.otyp === SPE_BLANK_PAPER && known;
    const tome = item.otyp === SPE_BOOK_OF_THE_DEAD && known;
    const verb = novel || blank ? 'Read' : tome ? 'Examine' : 'Study';
    const noun = novel ? simpleObjectName(item, state) : tome ? 'tome' : 'spellbook';
    return `${verb} this ${noun}`;
}
