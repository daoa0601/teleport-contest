// Top-line key prompts used by commands which can pause for input.
// C refs: win/tty/topl.c more() and win/tty/wintty.c tty_nhgetch().
import { clearMessageWindow, flushPendingTopline, renderKeyPrompt } from './tty_topline.js';
import { flush_screen } from './display.js';
import { pline, setTopline } from './pline.js';
import { selectMapPosition, showGetposInstructions } from './getpos.js';
import { CLICK_1, CLICK_2, COLNO, DIRECTION_KEYS, LOOK_ONCE, LOOK_QUICK, N_DIRS, ROWNO, xdir, ydir, zdir } from './const.js';
import { game } from './gstate.js';
import { takeCommandKey, takeCommandResponse } from './input.js';
import { readchar } from './cmd.js';
import { promptedDirectionKey, visibleCommandKey } from './cmd.js';
import { MONSTER_NAME } from './monster_data.js';
import { rn2 } from './rng.js';
import { showTextPages } from './windows.js';
import { rememberCommandKey, rememberYnAnswerKey, takeRepeatCommand } from './cmd.js';
import { keyText } from './cmd.js';
import { controlKeyHintLines } from './cmd.js';
import { clearCannedCommands } from './cmd.js';
import { impossible } from './diagnostics.js';
import { shouldShowGetposTip, showGetposTip } from './hack.js';
export async function paintKeyPrompt(message, cursorOffset = 0) {
    await setTopline(message);
    await flush_screen(1);
    return renderKeyPrompt(message, cursorOffset);
}
export async function promptKey(message, cursorOffset = 0, { canned = true } = {}) {
    // C cmd.c:yn_function() answers from the command queue without ever
    // reaching tty_yn_function(); gt.toplines is untouched then.
    const queuedKey = canned ? takeCommandKey() : undefined;
    if (queuedKey !== undefined)
        return queuedKey;
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
    if (coveredRows > 1)
        clearMessageWindow(coveredRows);
    return key;
}
//# sourceMappingURL=tty_prompts.js.map