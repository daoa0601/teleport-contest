// C windows.c:add_menu()/get_menu_coloring() and coloratt.c
// add_menu_coloring(): MENUCOLOR rules recolor menu entries when the menu
// is built. The rule list is newest first, so the last matching rule in the
// rc file wins; a match replaces both the caller's color and attribute,
// while menu headings (MENU_ITEMFLAGS_SKIPMENUCOLORS) keep their own style.
import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { chooseWizardLevelDestination } from '../js/cmd.js';
import { doenhance, ensureHeroSkills } from '../js/skills.js';
import { displayQuestText } from '../js/quest_pager.js';
import { luaText } from '../js/lua/messages.js';
import { ddoinv } from '../js/invent.js';
import { DAGGER, FOOD_RATION } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { resetInputState } from '../js/input.js';
import { ATR_BOLD, CLR_GREEN, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
import { freshConnectedLevels } from './support/connected-levels.js';
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
// Display a blocking window, assert against the painted screen, dismiss.
async function withBlockingWindow(open, inspect) {
    const input = resetInputState();
    const pending = open();
    await input.waitUntilBlocked();
    inspect(requireGameDisplay(game).grid);
    input.feed('\x1b');
    await pending;
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
void test('putstr-filled windows stay plain while add_menu_str windows are recolored', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red');
    const questText = { output: 'menu', raw: '',
        lines: ['"So you have returned, pilgrim."', '"Go forth again."'], synopsis: null };
    // questpgr.c deliver_by_window() fills the window with putstr(), which
    // never passes through add_menu()'s menucoloring.
    await withBlockingWindow(() => displayQuestText(questText), cells => {
        const found = rowCells(cells, 'So you have returned');
        for (const cell of found.row.slice(found.start, found.start + 'So you have returned'.length)) {
            assert.equal(cell.color, NO_COLOR, 'the quest passage stays uncolored');
            assert.equal(cell.attr, 0);
        }
    });
    // nhlua.c nh.text() builds the same window with add_menu_str(), whose
    // rows do take the menucoloring.
    await withBlockingWindow(() => luaText('The lua text window speaks.'), cells => {
        const found = rowCells(cells, 'lua text window');
        for (const cell of found.row.slice(found.start, found.start + 'lua text window'.length))
            assert.equal(cell.color, CLR_RED, 'the lua text window is recolored');
    });
});
void test('the skill enhancement group headings keep their own style', async () => {
    freshObjectRoom();
    ensureHeroSkills(game);
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red');
    await withBlockingWindow(() => doenhance(), cells => {
        for (const heading of ['Fighting Skills', 'Weapon Skills', 'Spellcasting Skills'])
            for (const cell of rowCells(cells, heading).row)
                if (cell.ch !== ' ')
                    assert.equal(cell.color, NO_COLOR, `${heading} keeps its own style`);
        // The catch-all rule still recolors the ordinary skill rows in the
        // same window, proving the headings are exempt rather than missed.
        const rows = cells.filter(row => row.some(cell => cell.color === CLR_RED));
        assert.ok(rows.length > 0, 'some skill rows are recolored');
    });
});
void test('the level teleport menu dungeon headings keep their own style', async () => {
    freshConnectedLevels();
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red');
    game.specialLevels = new Map([['earth', createSpecialLevel({ dnum: 0, dlevel: 2 })]]);
    // C print_dungeon(TRUE) emits each dungeon name via add_menu_heading(),
    // which skips menu coloring, while the level rows around it are
    // add_menu() rows.
    await withBlockingWindow(() => chooseWizardLevelDestination(), cells => {
        const found = rowCells(cells, 'The Dungeons of Doom');
        for (const cell of found.row.slice(found.start, found.start + 'The Dungeons of Doom'.length))
            assert.equal(cell.color, NO_COLOR, 'the dungeon heading keeps its own style');
        const rows = cells.filter(row => row.some(cell => cell.color === CLR_RED));
        assert.ok(rows.length > 0, 'some level rows are recolored');
    });
});
//# sourceMappingURL=menu_colors.test.js.map