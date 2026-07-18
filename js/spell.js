// spell.js — Spell menus and the first live spell-casting path.
// C refs: spell.c dovspell(), docast(), spelleffects_check().

import { game } from './gstate.js';
import { flush_screen, pline } from './display.js';
import { nhgetch } from './input.js';
import { NO_COLOR, ATR_INVERSE } from './terminal.js';
import { rnd, rn2, d } from './rng.js';

function putLine(col, row, text, attr = 0) {
    const display = game.nhDisplay;
    for (let i = 0; i < text.length && col + i < display.cols; i++)
        display.setCell(col + i, row, text[i], NO_COLOR, attr);
}

function clearMenu(left, bottom) {
    const display = game.nhDisplay;
    for (let row = 0; row <= bottom; row++)
        for (let col = row === 0 ? 0 : left; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
}

function spellLine(letter, spell, casting) {
    const name = spell.name.padEnd(23);
    const level = String(spell.level).padEnd(4);
    const category = spell.category.padEnd(14);
    const fail = `${spell.fail ?? 0}%`.padStart(3);
    const retention = casting ? '      100%'
        : `  ${spell.retention ?? 100}%-100%`;
    return `${letter} - ${name}${level}${category}${fail}${retention}`;
}

async function spellMenu(casting) {
    const spells = game.spells || [];
    const left = 20;
    const sortable = !casting && game.urole?.key !== 'monk';
    const endRow = spells.length + (sortable ? 4 : 3);
    clearMenu(left, endRow);
    putLine(left, 0, casting ? 'Choose which spell to cast' : 'Currently known spells', ATR_INVERSE);
    putLine(left, 2, '    Name                 Level Category     Fail Retention');
    putLine(left, 2, '    Name', ATR_INVERSE);
    putLine(left + 25, 2, 'Level Category', ATR_INVERSE);
    putLine(left + 44, 2, 'Fail Retention', ATR_INVERSE);
    spells.forEach((spell, index) =>
        putLine(left, index + 3, spellLine(String.fromCharCode(97 + index), spell, casting)));
    if (sortable) putLine(left, spells.length + 3, '+ - [sort spells]');
    putLine(left, endRow, '(end)');
    game.nhDisplay.setCursor(left + 6, endRow);
    game._preserveLeadingStyledBlanks = true;
    try {
        return await nhgetch();
    } finally {
        game._preserveLeadingStyledBlanks = false;
    }
}

export async function docast() {
    if (!(game.spells || []).length) {
        await pline("You don't know any spells right now.");
        game.context.move = 0;
        return;
    }
    const selection = await spellMenu(true);
    const index = String.fromCharCode(selection).toLowerCase().charCodeAt(0) - 97;
    const spell = game.spells[index];
    if (!spell) {
        game.context.move = 0;
        return;
    }

    // spelleffects_check(), exercise(A_WIS), and the temporary spell object.
    rnd(100);
    rn2(19);
    rnd(2);
    game.u.uen = Math.max(0, (game.u.uen || 0) - 5);
    await pline('In what direction? ');
    await flush_screen(1);
    game.nhDisplay.setCursor(19, 0);
    const direction = await nhgetch();
    if (direction === 27) {
        game.context.move = 0;
        return;
    }

    if (spell.name === 'healing') {
        d(6, 4);
        if (game.urole?.key === 'priest') {
            for (const known of game.spells) known.retention = 76;
        } else {
            spell.retention = 76;
        }
        await pline('You feel better.');
        game.context.move = 1;
        return;
    }
    game.context.move = 0;
}

export async function dovspell() {
    if (!(game.spells || []).length) {
        await pline("You don't know any spells right now.");
        game.context.move = 0;
        return;
    }
    await spellMenu(false);
    game._pending_message = '';
    game.context.move = 0;
}
