// Top-line key prompts used by commands which can pause for input.
// C refs: win/tty/topl.c more() and win/tty/wintty.c tty_nhgetch().

import { clearMessageWindow, flushPendingTopline, renderKeyPrompt } from './tty_topline.js';
import { flush_screen } from './display.js';
import { pline, setTopline } from './pline.js';
import { selectMapPosition, showGetposInstructions } from './getpos.js';
import { CLICK_1, CLICK_2, CMDQ_KEY, CMDQ_USER_INPUT, COLNO, CQ_CANNED, DIRECTION_KEYS, LOOK_ONCE, LOOK_QUICK, N_DIRS, ROWNO, xdir, ydir, zdir } from './const.js';
import { game } from './gstate.js';
import { cmdq_clear, cmdq_pop, readchar } from './cmd.js';
import type { CommandDirection } from './input.js';
import { promptedDirectionKey, visibleCommandKey } from './cmd.js';
import { MONSTER_NAME } from './monster_data.js';
import { rn2 } from './rng.js';
import { showTextPages } from './windows.js';
import type { TextPage } from './windows.js';
import type { Hero } from './hero_types.js';
import { keyText } from './cmd.js';
import { controlKeyHintLines } from './cmd.js';
import { impossible } from './diagnostics.js';
import { shouldShowGetposTip, showGetposTip } from './hack.js';


export async function paintKeyPrompt(message: string, cursorOffset = 0): Promise<number> {
    await setTopline(message);
    await flush_screen(1);
    return renderKeyPrompt(message, cursorOffset);
}

export async function promptKey(
    message: string, cursorOffset = 0,
    { canned = true }: { canned?: boolean } = {},
): Promise<number> {
    // C cmd.c:yn_function() answers from the command queue without ever
    // reaching tty_yn_function(); gt.toplines is untouched then. A queued
    // direction or extended command is the "not CMDQ_USER_INPUT" branch
    // (cmd.c:5496-5509): cmdq_clear(CQ_CANNED) and the ESC initializer,
    // while the user-input placeholder keeps the live question.
    if (canned) {
        const cmdq = cmdq_pop();
        if (cmdq && cmdq.typ === CMDQ_KEY) return cmdq.key;
        if (cmdq && cmdq.typ !== CMDQ_USER_INPUT) {
            cmdq_clear(CQ_CANNED);
            return 27;
        }
    }
    // tty_yn_function() with a null response list goes straight from its
    // custompline(SUPPRESS_HISTORY) prompt to readchar() and clean_up:
    // ^P has no special meaning and comes back as the answer.
    game._suppressMessagesUntilInput = false;
    const coveredRows = await paintKeyPrompt(message, cursorOffset);
    // tty_yn_function() uses readchar(), including its EOF and fuzzer rules.
    const key = await readchar();
    // Fuzzer input bypasses nhgetch(); tty_yn_function's cleanup still marks
    // its question as read.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    // clean_up rewrites gt.toplines with the prompt and its recorded answer.
    game._toplines = `${message}${keyText(key)}`;
    // C tty_yn_function() retains a one-line query, but clears wrapped ones.
    if (coveredRows > 1) clearMessageWindow(coveredRows);
    return key;
}
