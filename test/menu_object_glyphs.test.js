// C wintty.c:process_menu_window() show_obj_syms (the menu_objsyms option's
// object-glyph column), C invent.c:let_to_name() with showsym, and the
// menu_headings attribute on every add_menu_heading() caller's rows.
import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { ddoinv, displayPickinvWizardIdentify } from '../js/invent.js';
import { DAGGER, POT_HEALING, ROBE } from '../js/object_data.js';
import { ATR_BOLD, ATR_NONE, ATR_UNDERLINE, CLR_CYAN, CLR_MAGENTA, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { C_ATR_BOLD, C_ATR_ULINE } from '../js/color_attr.js';
import { applyNethackrc, parseNethackrc } from '../js/cfgfiles.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
function rowContaining(text) {
    return requireGameDisplay().grid
        .find(row => row.map(cell => cell.ch).join('').includes(text));
}
// The separator cell sits two columns after the entry's selector letter.
function separatorCell(row, letter) {
    const text = row.map(cell => cell.ch).join('');
    const at = text.indexOf(`${letter} `);
    return at >= 0 ? row[at + 2] : undefined;
}
async function withMenu(start, inspect) {
    const input = resetInputState();
    const operation = start();
    try {
        await input.waitUntilBlocked();
        inspect();
    }
    finally {
        input.feed('\x1b');
        await operation;
    }
}
void test('an unheaded inventory menu shows each object class glyph in the separator column', async () => {
    freshPlayableRoom();
    game.flags.sortpack = false;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await addInventoryObject(ROBE, { invlet: 'b' });
    await withMenu(() => ddoinv(), () => {
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, ')', 'weapon rows show the weapon symbol');
        assert.equal(dagger?.color, CLR_CYAN, 'the glyph keeps the object color');
        assert.equal(dagger?.attr, ATR_NONE, 'the glyph carries no attribute');
        const robe = separatorCell(rowContaining('robe') ?? [], 'b');
        assert.equal(robe?.ch, '[');
        assert.equal(robe?.color, CLR_RED);
    });
});
void test('menu glyphs lose their color when the color option is off', async () => {
    freshPlayableRoom();
    game.flags.sortpack = false;
    game.flags.color = false;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await withMenu(() => ddoinv(), () => {
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, ')');
        assert.equal(dagger?.color, NO_COLOR, 'reset_glyphmap() clears sym.color without use_color');
    });
});
void test('class headings suppress the conditional glyph column of a sorted inventory', async () => {
    freshPlayableRoom();
    game.flags.sortpack = true;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await withMenu(() => ddoinv(), () => {
        assert.ok(rowContaining('Weapons'), 'the sorted inventory shows a class heading');
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, '-', 'the separator stays a dash');
        assert.equal(dagger?.color, NO_COLOR);
    });
});
void test('menu_objsyms:entries shows glyphs even beside class headings', async () => {
    freshPlayableRoom();
    game.flags.sortpack = true;
    game.iflags.menuobjsyms = 2;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await withMenu(() => ddoinv(), () => {
        assert.ok(rowContaining('Weapons'));
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, ')');
        assert.equal(dagger?.color, CLR_CYAN);
    });
});
void test('menu_objsyms:none never shows the glyph column', async () => {
    freshPlayableRoom();
    game.flags.sortpack = false;
    game.iflags.menuobjsyms = 0;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await withMenu(() => ddoinv(), () => {
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, '-');
        assert.equal(dagger?.color, NO_COLOR);
    });
});
void test('menu_objsyms:headers appends the class symbol to queried inventory headings', async () => {
    freshPlayableRoom();
    game.flags.sortpack = true;
    game.iflags.menuobjsyms = 1;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await withMenu(() => ddoinv(), () => {
        const heading = rowContaining('Weapons')?.map(cell => cell.ch).join('') ?? '';
        assert.match(heading, /Weapons {2,}\('\)'\)/, 'let_to_name() pads and appends the class symbol');
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, '-', 'headers mode shows no entry glyphs');
    });
});
void test('wizard identify headings never append the class symbol', async () => {
    freshPlayableRoom({ flags: { debug: true } });
    game.flags.sortpack = true;
    game.iflags.menuobjsyms = 1;
    await addInventoryObject(POT_HEALING, { invlet: 'a', known: false, bknown: false });
    await withMenu(() => displayPickinvWizardIdentify(), () => {
        const heading = rowContaining('Potions')?.map(cell => cell.ch).join('') ?? '';
        assert.ok(heading.includes('Potions'), 'the class heading is present');
        assert.ok(!heading.includes('('), 'wiz_identify() passes want_reply FALSE, so withsym stays off');
    });
});
void test('the wizard identify menu follows menu_objsyms beside its non-selectable title', async () => {
    freshPlayableRoom({ flags: { debug: true } });
    game.flags.sortpack = false;
    await addInventoryObject(POT_HEALING, { invlet: 'a', known: false, bknown: false });
    // The Debug Identify title row is non-selectable, so the default
    // "conditional" mode shows no glyph column here.
    await withMenu(() => displayPickinvWizardIdentify(), () => {
        const potion = separatorCell(rowContaining('potion') ?? [], 'a');
        assert.equal(potion?.ch, '-', 'the title row suppresses conditional glyphs');
    });
    game.iflags.menuobjsyms = 2;
    await withMenu(() => displayPickinvWizardIdentify(), () => {
        const potion = separatorCell(rowContaining('potion') ?? [], 'a');
        assert.equal(potion?.ch, '!', 'entries mode still shows the potion glyph');
        assert.equal(potion?.color, CLR_MAGENTA, 'the identified potion keeps its object color');
    });
});
void test('#enhance headings use the menu_headings attribute and color', async () => {
    freshPlayableRoom();
    game.iflags.menu_headings = { attr: C_ATR_BOLD, color: CLR_RED };
    await withMenu(() => runExtendedCommand('enhance'), () => {
        const heading = rowContaining('Fighting Skills')?.find(cell => cell.ch === 'F');
        assert.equal(heading?.attr, ATR_BOLD, 'the skill heading uses the configured attribute');
        assert.equal(heading?.color, CLR_RED, 'the skill heading uses the configured color');
    });
});
void test('the simple options menu uses the menu_headings attribute for section headings', async () => {
    freshPlayableRoom();
    game.iflags.menu_headings = { attr: C_ATR_ULINE, color: NO_COLOR };
    await withMenu(() => rhack('O'.charCodeAt(0)), () => {
        const heading = rowContaining('General')?.find(cell => cell.ch === 'G');
        assert.equal(heading?.attr, ATR_UNDERLINE, 'the General heading uses the configured attribute');
    });
});
void test('the full options menu uses the menu_headings attribute for section headings', async () => {
    freshPlayableRoom();
    game.iflags.menu_headings = { attr: C_ATR_BOLD, color: NO_COLOR };
    const command = rhack('m'.charCodeAt(0));
    const input = resetInputState();
    try {
        await input.waitUntilBlocked();
        input.feed('O');
        await input.waitUntilBlocked();
        const heading = rowContaining('Booleans (selecting will toggle value):')
            ?.find(cell => cell.ch === 'B');
        assert.equal(heading?.attr, ATR_BOLD, 'the Booleans heading uses the configured attribute');
    }
    finally {
        input.feed('\x1b');
        await command;
    }
});
void test('menu_objsyms values parse from the configuration file', () => {
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:entries').iflags.menuobjsyms, 2);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:both').iflags.menuobjsyms, 3);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:cond').iflags.menuobjsyms, 4);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:one-or-the-other').iflags.menuobjsyms, 5);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:entr').iflags.menuobjsyms, 2, 'four-character prefixes match');
    // optfn_menu_objsyms() compares strlen(name) characters for shorter
    // values, so the value's NUL mismatches and the name never matches.
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:e').iflags.menuobjsyms, 0);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:ent').iflags.menuobjsyms, 0);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:0').iflags.menuobjsyms, 0);
    assert.equal(parseNethackrc('OPTIONS=!menu_objsyms').iflags.menuobjsyms, 0);
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms').iflags.menuobjsyms, 1);
    assert.equal(parseNethackrc('OPTIONS=use_menu_glyphs').iflags.menuobjsyms, 2);
    // An unmatched name silently selects none, matching optfn_menu_objsyms().
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:bogus').iflags.menuobjsyms, 0);
    assert.ok(parseNethackrc('OPTIONS=menu_objsyms:9').configErrors[0]?.errors.length, 'out-of-range digits draw a config error');
});
void test('menu_objsyms applies to the live interface flags', () => {
    freshPlayableRoom();
    applyNethackrc('OPTIONS=menu_objsyms:entries');
    assert.equal(game.iflags.menuobjsyms, 2);
});
void test('a selected row keeps its selection marker over the glyph column', async () => {
    freshPlayableRoom();
    game.flags.sortpack = false;
    game.iflags.menuobjsyms = 2;
    await addInventoryObject(DAGGER, { invlet: 'a' });
    const input = resetInputState();
    // The drop menu is a PICK_ANY query, so a selection repaints the row's
    // separator through set_item_state() instead of closing the window.
    const operation = rhack('D'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        input.feed('a');
        await input.waitUntilBlocked();
        const dagger = separatorCell(rowContaining('dagger') ?? [], 'a');
        assert.equal(dagger?.ch, '+', 'set_item_state() repaints the selected marker');
    }
    finally {
        input.feed('\x1b');
        await operation;
    }
});
//# sourceMappingURL=menu_object_glyphs.test.js.map