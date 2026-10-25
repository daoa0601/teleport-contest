// prevmsg.js — ^P previous-message recall.
// C refs: cmd.c doprev_message() and key2txt(), win/tty/topl.c
// tty_doprev_message() and redotoplin(), and the window-port menu those
// build through putstr()/display_nhwindow()/destroy_nhwindow().

import { game } from './gstate.js';
import { pageTopline, toplineRows } from './display.js';
import { showDisclosureOverlay } from './windows.js';
import { NO_COLOR } from './terminal.js';

const CTRL_P = 16;

export type MessageWindowMode = 's' | 'c' | 'f' | 'r';

// iflags.prevmsg_window holds the option's first letter; initoptions()
// leaves the tty default 'single'.
export function messageWindowMode(): MessageWindowMode {
    const mode = (game.iflags.prevmsg_window ?? 's').charAt(0).toLowerCase();
    return mode === 'c' || mode === 'f' || mode === 'r' ? mode : 's';
}

// C cmd.c key2txt(): how a typed key is written into the recorded answer.
export function keyText(key: number): string {
    const code = key & 0xff;
    if (code === 32) return '<space>';
    if (code === 27) return '<esc>';
    if (code === 10) return '<enter>';
    if (code === 127) return '<del>';
    // hacklib.c visctrl() for every other byte, including meta.
    let meta = '';
    let visible = code;
    if (visible > 0x7f) {
        meta = 'M-';
        visible -= 0x80;
    }
    if (visible < 32) return `${meta}^${String.fromCharCode(visible + 64)}`;
    return `${meta}${String.fromCharCode(visible)}`;
}

// One step back through the recall ring. tty_doprev_message() decrements
// cw->maxcol and resets it to maxrow once the walk leaves the filled slots.
function stepHistoryBack(): void {
    const history = game._messageHistory;
    if (game._messageHistoryCursor === null) {
        game._messageHistoryCursor = history.length ? history.length - 1 : null;
    } else if (game._messageHistoryCursor > 0) {
        game._messageHistoryCursor--;
    } else {
        game._messageHistoryCursor = null;
    }
}

// C tty topl.c:redotoplin(): repaint a recalled line at the top. Wrapped
// lines page with --More-- accepting ^P so one press can keep walking;
// a single line just becomes the pending topline again.
async function redotoplin(text: string): Promise<number> {
    const display = game.nhDisplay;
    const columns = display?.cols ?? 80;
    if (toplineRows(text, columns).length > 1)
        return await pageTopline(text, { dismissKey: CTRL_P });
    if (display) {
        display.clearRow(0);
        const row = toplineRows(text, columns)[0];
        for (const [column, cell] of row.entries())
            display.setCell(column, 0, cell.ch, NO_COLOR, 0);
        display.setCursor(row.length, 0);
    }
    game._pending_message = text;
    game._retained_message = '';
    return 0;
}


// tty_doprev_message()'s putstr-built NHW_MENU: "Message History", a blank
// line, the ring, and the pending topline. tty_display_nhwindow() pages it
// through process_text_window() because putstr() (unlike add_menu()) owns
// cw->data, and destroy_nhwindow() erases the corner again.
async function showMessageHistoryWindow(
    { reversed, acceptCtrlP }: { reversed: boolean; acceptCtrlP?: boolean },
): Promise<number> {
    const lines: string[] = ['Message History', ''];
    if (reversed) {
        lines.push(game._toplines);
        for (let index = game._messageHistory.length - 1; index >= 0; index--)
            lines.push(game._messageHistory[index] ?? '');
    } else {
        lines.push(...game._messageHistory, game._toplines);
    }
    return await showDisclosureOverlay(lines, {
        restoreUnderlay: true,
        extraDismissKey: acceptCtrlP ? CTRL_P : null,
    });
}

// C cmd.c:doprev_message() -> win/tty/topl.c:tty_doprev_message(). The
// prompt owners call this with inread set, which forces the single-message
// branch exactly like ttyDisplay->inread does; they manage their own
// repainting around the call. Takes no game time and draws no randomness.
export async function doprevMessage(inread = false): Promise<void> {
    const mode = messageWindowMode();
    if (mode !== 's' && !inread) {
        if (mode === 'f') {
            // Full: the window lists the ring oldest-first with the pending
            // topline last, and the walk cursor restarts.
            game._messageHistoryCursor = null;
            await showMessageHistoryWindow({ reversed: false });
        } else if (mode === 'c') {
            // Combination: the first two recalls page single lines (the
            // pending topline, then the newest remembered one), the third
            // opens the full window. ttyDisplay->dismiss_more stays ^P for
            // the whole invocation, so the window pager accepts it too.
            for (;;) {
                const cursor = game._messageHistoryCursor;
                let morc: number;
                if (cursor === null || cursor === game._messageHistory.length - 1) {
                    morc = await redotoplin(cursor === null
                        ? game._toplines : game._messageHistory[cursor] ?? '');
                    stepHistoryBack();
                } else {
                    game._messageHistoryCursor = null;
                    morc = await showMessageHistoryWindow({ reversed: false, acceptCtrlP: true });
                }
                if (morc !== CTRL_P) break;
            }
        } else {
            // Reversed: the pending topline leads, then the ring newest-first.
            game._messageHistoryCursor = null;
            await showMessageHistoryWindow({ reversed: true });
        }
    } else if (mode === 's') {
        // Single: each ^P walks one entry further back, wrapping to the
        // pending topline again after the oldest remembered entry.
        for (;;) {
            const cursor = game._messageHistoryCursor;
            const morc = await redotoplin(cursor === null
                ? game._toplines : game._messageHistory[cursor] ?? '');
            stepHistoryBack();
            if (morc !== CTRL_P) break;
        }
    }
}