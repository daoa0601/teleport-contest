// spell.js — Spell list command.
// C ref: spell.c — dovspell().

import { game } from './gstate.js';
import { pline } from './display.js';

export async function dovspell() {
    if (!(game.spells || []).length) {
        await pline("You don't know any spells right now.");
    }
    game.context.move = 0;
}
