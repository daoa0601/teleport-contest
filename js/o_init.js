// o_init.js — Object initialization.
// C ref: o_init.c — shuffle gem colors, potion descriptions, etc.
//
// STUB: Uses fastforward to consume the correct RNG calls.
// Contestants should port the real init_objects() from o_init.c.

// The real init_objects() shuffles object descriptions using
// Fisher-Yates. The shuffles consume ~200 RNG calls.
// See nethack-c/src/o_init.c for the full implementation.
import { game } from './gstate.js';
import { flush_screen } from './display.js';
import { ATR_INVERSE, showTextPages } from './windows.js';

export function init_objects() {
    // Handled by fastforward_pre_mklev() in allmain.js
}

// C ref: o_init.c dodiscovered() — show discoveries grouped by object class.
export async function dodiscovered() {
    const lines = Array(24).fill('');
    lines[0] = 'Discoveries, by order of discovery within each class';
    let row = 2;
    let previousClass = null;
    for (const discovery of game.discoveries || []) {
        if (discovery.class !== previousClass) {
            lines[row++] = { text: discovery.class, attr: ATR_INVERSE };
            previousClass = discovery.class;
        }
        const appearance = discovery.appearance ? ` (${discovery.appearance})` : '';
        lines[row++] = `  ${discovery.name}${appearance}`;
    }
    lines[23] = '--More--';
    await showTextPages([{ lines, cursor: [8, 23] }]);
    await flush_screen(1);
    game.context.move = 0;
}
