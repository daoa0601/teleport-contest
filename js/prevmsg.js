// prevmsg.js — ^P previous-message recall.
// C refs: cmd.c doprev_message() and key2txt(), win/tty/topl.c
// tty_doprev_message() and redotoplin(), and the window-port menu those
// build through putstr()/display_nhwindow()/destroy_nhwindow().
import { game } from './gstate.js';
import { messageHistoryCapacity, pageTopline, toplineRows } from './display.js';
import { showDisclosureOverlay } from './windows.js';
import { NO_COLOR } from './terminal.js';
const CTRL_P = 16;
// iflags.prevmsg_window holds the option's first letter; initoptions()
// leaves the tty default 'single'.
export function messageWindowMode() {
    const mode = (game.iflags.prevmsg_window ?? 's').charAt(0).toLowerCase();
    return mode === 'c' || mode === 'f' || mode === 'r' ? mode : 's';
}
// C cmd.c key2txt(): how a typed key is written into the recorded answer.
export function keyText(key) {
    const code = key & 0xff;
    if (code === 32)
        return '<space>';
    if (code === 27)
        return '<esc>';
    if (code === 10)
        return '<enter>';
    if (code === 127)
        return '<del>';
    // hacklib.c visctrl() for every other byte, including meta.
    let meta = '';
    let visible = code;
    if (visible > 0x7f) {
        meta = 'M-';
        visible -= 0x80;
    }
    if (visible < 32)
        return `${meta}^${String.fromCharCode(visible + 64)}`;
    if (visible === 127)
        return `${meta}^?`;
    return `${meta}${String.fromCharCode(visible)}`;
}
// One step back through the recall ring. tty_doprev_message() decrements
// cw->maxcol and resets it to maxrow once the walk leaves the filled slots.
// In a full ring the oldest message occupies maxrow's own slot, so the walk
// reaches the pending line there instead of displaying that entry.
function stepHistoryBack() {
    const history = game._messageHistory;
    const cursor = game._messageHistoryCursor;
    if (cursor === null) {
        game._messageHistoryCursor = history.length ? history.length - 1 : null;
        return;
    }
    if (cursor <= 0) {
        game._messageHistoryCursor = null;
        return;
    }
    // In a full ring the oldest message occupies maxrow's own slot, so a
    // walk about to reach it returns to the pending line instead.
    game._messageHistoryCursor = cursor - 1 === 0
        && history.length === messageHistoryCapacity()
        ? null : cursor - 1;
}
// C tty topl.c:redotoplin(): repaint a recalled line at the top. Wrapped
// lines page with --More-- accepting ^P so one press can keep walking,
// except when the previous topline state was TOPLINE_SPECIAL_PROMPT
// (topl.c:139) — redotoplin() sets NEED_MORE itself, so only the first
// recall after a prompt draws without that pager.
async function redotoplin(text) {
    const fromPrompt = !!game._promptOwnsTopline;
    game._promptOwnsTopline = false;
    const display = game.nhDisplay;
    const columns = display?.cols ?? 80;
    const lines = toplineRows(text, columns);
    if (lines.length > 1 && !fromPrompt)
        return await pageTopline(text, { dismissKey: CTRL_P });
    if (display) {
        for (const [row, line] of lines.entries()) {
            display.clearRow(row);
            for (const [column, cell] of line.entries())
                display.setCell(column, row, cell.ch, NO_COLOR, 0);
        }
        const last = lines.at(-1) ?? lines[0];
        display.setCursor(last.length, lines.length - 1);
    }
    game._pending_message = text;
    game._retained_message = '';
    return 0;
}
// tty_doprev_message()'s putstr-built NHW_MENU: "Message History", a blank
// line, the ring, and the pending topline. tty_display_nhwindow() pages it
// through process_text_window() because putstr() (unlike add_menu()) owns
// cw->data, and destroy_nhwindow() erases the corner again.
async function showMessageHistoryWindow({ reversed, acceptCtrlP }) {
    const lines = ['Message History', ''];
    if (reversed) {
        lines.push(game._toplines);
        // A full ring keeps its oldest message in maxrow's own slot, where
        // the reversed walk stops before listing it.
        const oldest = game._messageHistory.length === messageHistoryCapacity() ? 1 : 0;
        for (let index = game._messageHistory.length - 1; index >= oldest; index--)
            lines.push(game._messageHistory[index] ?? '');
    }
    else {
        lines.push(...game._messageHistory, game._toplines);
    }
    // tty_display_nhwindow() pages a NEED_MORE topline before the window
    // (wintty.c:1969-1970); only a prompt's TOPLINE_SPECIAL_PROMPT line is
    // erased without paging.
    return await showDisclosureOverlay(lines, {
        restoreUnderlay: true,
        extraDismissKey: acceptCtrlP ? CTRL_P : null,
        skipPendingPager: !!game._promptOwnsTopline,
    });
}
// C cmd.c:doprev_message() -> win/tty/topl.c:tty_doprev_message(). The
// prompt owners call this with inread set, which forces the single-message
// branch exactly like ttyDisplay->inread does; they manage their own
// repainting around the call. Takes no game time and draws no randomness.
export async function doprevMessage(inread = false) {
    const mode = messageWindowMode();
    if (mode !== 's' && !inread) {
        if (mode === 'f') {
            // Full: the window lists the ring oldest-first with the pending
            // topline last, and the walk cursor restarts.
            game._messageHistoryCursor = null;
            await showMessageHistoryWindow({ reversed: false });
        }
        else if (mode === 'c') {
            // Combination: the first two recalls page single lines (the
            // pending topline, then the newest remembered one), unless
            // maxrow wrapped to zero. Only a single-line step in this call
            // sets dismiss_more to ^P for the window's pager too.
            let acceptCtrlP = false;
            for (;;) {
                const cursor = game._messageHistoryCursor;
                let morc;
                const newestSavedLine = cursor === game._messageHistory.length - 1
                    && game._messageHistoryWriteIndex > 0;
                if (cursor === null || newestSavedLine) {
                    acceptCtrlP = true;
                    morc = await redotoplin(cursor === null
                        ? game._toplines : game._messageHistory[cursor] ?? '');
                    stepHistoryBack();
                }
                else {
                    game._messageHistoryCursor = null;
                    morc = await showMessageHistoryWindow({ reversed: false, acceptCtrlP });
                }
                if (morc !== CTRL_P)
                    break;
            }
        }
        else {
            // Reversed: the pending topline leads, then the ring newest-first.
            game._messageHistoryCursor = null;
            await showMessageHistoryWindow({ reversed: true });
        }
    }
    else if (mode === 's') {
        // Single: each ^P walks one entry further back, wrapping to the
        // pending topline again after the oldest displayed entry.
        for (;;) {
            const cursor = game._messageHistoryCursor;
            const morc = await redotoplin(cursor === null
                ? game._toplines : game._messageHistory[cursor] ?? '');
            stepHistoryBack();
            if (morc !== CTRL_P)
                break;
        }
    }
}
//# sourceMappingURL=prevmsg.js.map