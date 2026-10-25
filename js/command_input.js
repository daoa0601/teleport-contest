// Command counts are read before ordinary key bindings are consulted.
// C refs: cmd.c:get_count(GC_NOFLAGS), parse().
import { setMulti } from './command_state.js';
import { NATIVE_COMMAND_CONSTANTS } from './command_data.js';
import { game } from './gstate.js';
import { readchar } from './input.js';
import { flush_screen, setTopline } from './display.js';
export async function readCommandInput() {
    game._commandCount = 0;
    setMulti(0);
    await flush_screen(1);
    let result;
    if (game.commandBindings.numberPad) {
        const key = await readchar('command');
        result = (key & 255) === game.commandBindings.specialKey('count')
            ? await readCommandCount() : { key, count: 0 };
    }
    else {
        result = await readCommandCount();
    }
    game._commandCount = result.count;
    setMulti(Math.max(0, result.count - 1));
    game._commandKey = result.key;
    clearCommandMessage();
    return result;
}
async function readCommandCount() {
    let count = 0;
    let backspaced = false;
    for (;;) {
        const key = await readchar('command');
        let showZero = false;
        if (key >= 48 && key <= 57) {
            count = Math.min(NATIVE_COMMAND_CONSTANTS.LARGEST_INT, count * 10 + key - 48);
            showZero = key === 48;
        }
        else if (key === 8 || key === 127) {
            if (!count)
                return { key, count: 0 };
            count = Math.trunc(count / 10);
            backspaced = true;
        }
        else {
            return { key, count: key === 27 ? 0 : count };
        }
        if (count > 9 || backspaced) {
            const text = backspaced && !count && !showZero
                ? 'Count: ' : `Count: ${count}`;
            if (count || showZero)
                backspaced = false;
            clearCommandMessage();
            await setTopline(text);
            await flush_screen(0);
            game.nhDisplay?.setCursor(text.length, 0);
        }
    }
}
function clearCommandMessage() {
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearRow(0);
}
//# sourceMappingURL=command_input.js.map