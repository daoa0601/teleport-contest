// C windows.c:add_menu()/get_menu_coloring() and coloratt.c
// add_menu_coloring(): MENUCOLOR rules recolor menu entries when the menu
// is built. The rule list is newest first, so the last matching rule in the
// rc file wins; a match replaces both the caller's color and attribute,
// while menu headings (MENU_ITEMFLAGS_SKIPMENUCOLORS) keep their own style.
import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { ddoinv } from '../js/invent.js';
import { DAGGER, FOOD_RATION } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { resetInputState } from '../js/input.js';
import { ATR_BOLD, CLR_GREEN, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
async function packWithBlessedDagger() {
    freshObjectRoom();
    await addInventoryObject(DAGGER, { blessed: true });
    await addInventoryObject(FOOD_RATION);
}
// Show the inventory menu, run assertions against the painted screen, then
// dismiss it through the native Escape path.
async function withInventoryMenu(inspect) {
    const input = resetInputState();
    const command = ddoinv();
    await input.waitUntilBlocked();
    inspect(requireGameDisplay(game).grid);
    input.feed('\x1b');
    await command;
}
function rowCells(cells, fragment) {
    const found = cells
        .map(row => ({ row, text: row.map(cell => cell.ch).join('') }))
        .find(({ text }) => text.includes(fragment));
    assert.ok(found, `No screen row contains "${fragment}"`);
    const start = found.text.indexOf(fragment);
    assert.ok(start >= 0);
    return { row: found.row, start };
}
void test('a menucolor rule recolors matching inventory entries only', async () => {
    await packWithBlessedDagger();
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="blessed"=green&bold');
    await withInventoryMenu(cells => {
        const dagger = rowCells(cells, 'a blessed +0 dagger');
        for (const cell of dagger.row.slice(dagger.start, dagger.start + 'a blessed +0 dagger'.length)) {
            assert.equal(cell.color, CLR_GREEN, 'the matching entry is green');
            assert.equal(cell.attr, ATR_BOLD, 'the rule attribute applies to the description');
        }
        // The selector prefix "a - " before the description stays plain.
        const marker = dagger.row[dagger.start - 2];
        assert.ok(marker, 'the menu row has a selector prefix');
        assert.equal(marker.ch, '-');
        assert.equal(marker.color, NO_COLOR);
        assert.equal(marker.attr, 0);
        const ration = rowCells(cells, 'an uncursed food ration');
        for (const cell of ration.row.slice(ration.start, ration.start + 'an uncursed food ration'.length)) {
            assert.equal(cell.color, NO_COLOR, 'a non-matching entry stays uncolored');
            assert.equal(cell.attr, 0);
        }
        for (const cell of rowCells(cells, 'Weapons').row)
            if (cell.ch !== ' ')
                assert.equal(cell.color, NO_COLOR, 'the class heading stays uncolored');
    });
});
void test('the newest matching rule wins and headings skip menu coloring', async () => {
    await packWithBlessedDagger();
    // The catch-all rule is older than the dagger rule, so matching dagger
    // entries take green while every other entry takes red.
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red\nMENUCOLOR="dagger"=green');
    await withInventoryMenu(cells => {
        const dagger = rowCells(cells, 'a blessed +0 dagger');
        for (const cell of dagger.row.slice(dagger.start, dagger.start + 'a blessed +0 dagger'.length))
            assert.equal(cell.color, CLR_GREEN, 'the newest matching rule wins');
        const ration = rowCells(cells, 'an uncursed food ration');
        for (const cell of ration.row.slice(ration.start, ration.start + 'an uncursed food ration'.length))
            assert.equal(cell.color, CLR_RED, 'the older catch-all rule still applies');
        // The catch-all matches the heading text as well, but add_menu_heading()
        // passes MENU_ITEMFLAGS_SKIPMENUCOLORS, so the heading keeps its style.
        for (const heading of ['Weapons', 'Comestibles'])
            for (const cell of rowCells(cells, heading).row)
                if (cell.ch !== ' ')
                    assert.equal(cell.color, NO_COLOR, `${heading} keeps its own style`);
    });
});
void test('turning menucolors off leaves menu entries uncolored', async () => {
    await packWithBlessedDagger();
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red\nOPTIONS=!menucolors');
    assert.equal(game.iflags.menuColorings?.length, 1, 'the rule stays configured');
    assert.equal(game.flags.menucolors, false);
    await withInventoryMenu(cells => {
        for (const entry of ['a blessed +0 dagger', 'an uncursed food ration']) {
            const found = rowCells(cells, entry);
            for (const cell of found.row.slice(found.start, found.start + entry.length)) {
                assert.equal(cell.color, NO_COLOR, `${entry} stays uncolored`);
                assert.equal(cell.attr, 0);
            }
        }
        for (const cell of rowCells(cells, 'Weapons').row)
            if (cell.ch !== ' ')
                assert.equal(cell.color, NO_COLOR, 'the heading stays uncolored');
    });
});
//# sourceMappingURL=menu_colors.test.js.map