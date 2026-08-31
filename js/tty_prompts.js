// Top-line key prompts used by commands which can pause for input.
// C refs: win/tty/topl.c more() and win/tty/wintty.c tty_nhgetch().

import { flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';

export async function promptKey(message, cursorOffset = 0) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length + cursorOffset, 0);
    return nhgetch();
}

export async function moreUntilDismissed(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}
