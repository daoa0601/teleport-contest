// Message admission and publishing: C pline.c:pline(), vpline(), and raw_printf().
import { game } from './gstate.js';
import { flush_screen } from './display.js';
import { vision_recalc } from './vision.js';
import { coordinateDescription } from './pager_lists.js';
import { messageTypeFor } from './message_types.js';
import { truncatePlineMessage, truncateRawMessage } from './pline_text.js';
import { displayMessageWindow, rememberToplines, replaceTopline, updateTopline, } from './tty_topline.js';
import { nhgetch } from './input.js';
import { BUFSZ, MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP, PLNMSG_UNKNOWN, xdir, ydir, isok, } from './const.js';
import { NO_COLOR } from './terminal.js';
// C pline.c:set_msg_dir(). The next vpline consumes the location, even when hidden.
export function set_msg_dir(direction) {
    const previous = game.iflags.messageLocation ?? { x: 0, y: 0 };
    const dx = xdir[direction], dy = ydir[direction];
    game.iflags.messageLocation = {
        x: game.u.ux + (dx ?? previous.x), y: game.u.uy + (dy ?? previous.y),
    };
}
// C pline.c:set_msg_xy().
export function set_msg_xy(x, y) {
    game.iflags.messageLocation = { x, y };
}
// C pline.c:pline_dir().
export async function pline_dir(direction, message) {
    set_msg_dir(direction);
    await pline(message);
}
// C pline.c:pline_xy().
export async function pline_xy(x, y, message) {
    set_msg_xy(x, y);
    await pline(message);
}
// C pline.c:pline_mon().
export async function pline_mon(monster, message) {
    if ('mx' in monster)
        set_msg_xy(monster.mx, monster.my);
    else
        set_msg_xy(0, 0);
    await pline(message);
}
// C pline.c:pline() delegates message admission and publication to vpline().
export async function pline(msg) {
    await plineWithContinuation(msg);
}
// C pline.c:vpline(). Await the window port before recording the last message.
export async function plineWithContinuation(msg, { noRepeat = false, urgent = false, overrideMessageType = false, position, } = {}) {
    const location = position ?? game.iflags.messageLocation;
    delete game.iflags.messageLocation;
    msg = msg.split('\0', 1)[0] ?? '';
    if (!msg || game.program_state.wizkit_wishing)
        return;
    if (game.flags.accessiblemsg && location && isok(location.x, location.y)) {
        const mode = game.iflags.getpos_coords;
        const coordinates = coordinateDescription(location.x, location.y, !mode || mode === 'n' ? 'f' : mode);
        msg = `${coordinates}: ${msg}`;
    }
    const length = new TextEncoder().encode(msg).length;
    if (length > 5 * BUFSZ - 1) {
        const { panic } = await import('./diagnostics.js');
        await panic(`pline attempting to print ${length} characters!`);
    }
    msg = truncatePlineMessage(msg);
    if (game.program_state?.windows_exited) {
        rawPrint(msg);
        game._lastPlineKind = PLNMSG_UNKNOWN;
        return;
    }
    const messageType = overrideMessageType ? MSGTYP_NORMAL
        : messageTypeFor(msg, noRepeat, game.iflags.messageTypes);
    if (!urgent && (messageType === MSGTYP_NOSHOW
        || (messageType === MSGTYP_NOREP && msg === game._lastPlineMessage)))
        return;
    if (urgent && game._suppressMessagesUntilInput) {
        game._suppressMessagesUntilInput = false;
        game._pending_message = '';
        game._retained_message = '';
    }
    // vpline() flushes the map before tty decides whether older prose needs
    // acknowledgment. Direct message-window display does not do this.
    if (game.vision_full_recalc)
        await vision_recalc(0);
    if (game.u.ux)
        await flush_screen(1);
    const dismissal = await updateTopline(msg, { urgent });
    // C pline.c tracks the last individual message, not the joined tty line.
    game._lastPlineMessage = msg;
    game._lastPlineKind = PLNMSG_UNKNOWN;
    return messageType === MSGTYP_STOP ? await displayMessageWindow() : dismissal;
}
// Replace the message line without tty's update_topl() negotiation. Only the
// tty topline owner, its direct pagers, and prompt owners (whose native
// TOPLINE_SPECIAL_PROMPT text never pages) write the line this way.
export async function setTopline(msg) {
    if (game.program_state?.windows_exited) {
        if (msg) {
            rawPrint(msg);
            game._lastPlineKind = PLNMSG_UNKNOWN;
        }
        return;
    }
    // C pline.c:vpline() resolves any pending blocker/light change before it
    // flushes the map or negotiates tty's previous-topline pager.
    if (game.vision_full_recalc)
        await vision_recalc(0);
    if (game.u.ux)
        await flush_screen(1);
    // Every caller models a tty_putstr(WIN_MESSAGE, ATR_NOHISTORY) prompt:
    // remember_topl() archives the negotiated line, and the prompt itself
    // is shown without being remembered.
    rememberToplines();
    replaceTopline(msg);
    game._lastPlineMessage = msg;
    game._lastPlineKind = PLNMSG_UNKNOWN;
}
function writeRawText(text) {
    const display = game.nhDisplay;
    if (!display)
        return;
    for (const ch of text) {
        if (ch === '\r') {
            display.setCursor(0, display.cursorRow);
        }
        else if (ch === '\n') {
            const row = display.cursorRow + 1;
            if (row >= display.rows)
                display.scrollUp();
            display.setCursor(0, Math.min(row, display.rows - 1));
        }
        else if (ch === '\t') {
            // tty_raw_print() leaves tabs for the terminal's eight-column stops.
            const nextTab = display.cursorCol + 8 - display.cursorCol % 8;
            display.setCursor(Math.min(nextTab, display.cols - 1), display.cursorRow);
        }
        else {
            if (display.cursorCol >= display.cols)
                writeRawText('\n');
            display.setCell(display.cursorCol, display.cursorRow, ch, NO_COLOR, 0);
            display.setCursor(display.cursorCol + 1, display.cursorRow);
        }
    }
    display.flush();
}
// C pline.c:raw_printf()/vraw_printf().
export function rawPrintf(message) {
    rawPrint(truncateRawMessage(message));
    // Both raw_printf() and vraw_printf() increment the early-message count.
    if (!game.program_state.beyond_savefile_load)
        game.earlyRawMessages += 2;
}
// C win/tty/wintty.c:tty_raw_print().
export function rawPrint(message) {
    writeRawText(`${message}\n`);
}
// C end.c:panic(), with win/tty/wintty.c:getret() before the window exit.
// The browser has no host tty to restore after exit_nhwindows(). Keep the
// terminal diagnostic separate from map/status output, with Native's getret.
export async function beginPanicOutput() {
    if (!game.nhDisplay)
        return;
    rawPrint('\r\nOops...');
    writeRawText('\nHit space to continue: ');
    game._suppressMessagesUntilInput = false;
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay.clearScreen();
    game.program_state.windows_exited = true;
}
//# sourceMappingURL=pline.js.map