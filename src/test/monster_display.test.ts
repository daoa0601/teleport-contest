import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BEAR_TRAP, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DBWALL, DRAWBRIDGE_DOWN,
    DRAWBRIDGE_UP, ICE, MAGIC_TRAP, MM_NOGRP, NO_MINVENT, PIT, SPIKED_PIT, WEB,
} from '../js/const.js';
import {
    displayMessageWindow, flush_screen, map_invisible, newsym, plineWithContinuation,
    show_glyph_cell,
} from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { makeBlinded } from '../js/sight_change.js';
import { CLR_BLUE, CLR_BROWN, CLR_CYAN, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { cansee } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('Warning replaces invisible memory, so a departing monster leaves the floor', async () => {
    const level = freshObjectRoom({ hero: { warning: true } });
    const xorn = await createMonsterAt('xorn', 11, 10, MM_NOGRP | NO_MINVENT);
    xorn.minvis = 1;
    xorn.mpeaceful = false;
    xorn.m_lev = 8;
    map_invisible(11, 10);

    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '2');
    placeMonsterAt(xorn, 13, 10);
    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '.');
    assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
});

void test('telepathy replaces invisible memory on an unseen monster square', async () => {
    const level = freshObjectRoom({ hero: { telepathy: true } });
    const goblin = await createMonsterAt('goblin', 11, 10, MM_NOGRP | NO_MINVENT);
    await makeBlinded(10, { talk: false });
    assert.equal(cansee(11, 10), false);
    map_invisible(11, 10);

    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, 'o');
    placeMonsterAt(goblin, 13, 10);
    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '.');
    assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
});

void test('zero hit points do not remove a monster glyph before map detachment', async () => {
    freshObjectRoom();
    const gargoyle = await createMonsterAt('gargoyle', 11, 10, MM_NOGRP | NO_MINVENT);
    gargoyle.mhp = 0;

    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, 'g');
});

void test('an invisible marker takes precedence over a visible cloud', async () => {
    freshObjectRoom();
    map_invisible(11, 10);
    createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }]);

    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, 'I');
});

for (const { name, type, revealed } of [
    { name: 'a bear trap', type: BEAR_TRAP, revealed: true },
    { name: 'a pit', type: PIT, revealed: true },
    { name: 'a spiked pit', type: SPIKED_PIT, revealed: true },
    { name: 'a web', type: WEB, revealed: true },
    { name: 'a magic trap', type: MAGIC_TRAP, revealed: false },
]) {
    void test(`seeing a trapped monster ${revealed ? 'reveals' : 'does not reveal'} ${name}`, async () => {
        const level = freshObjectRoom();
        const goblin = await createMonsterAt('goblin', 11, 10, MM_NOGRP | NO_MINVENT);
        const trap = addTrap(level, type, 11, 10);
        goblin.mtrapped = 1;

        newsym(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).ch, 'o');
        assert.equal(trap.tseen, revealed);
    });
}

void test('acknowledging a death message preserves the map until its pending glyphs are flushed', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const goblin = await createMonsterAt('goblin', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(11, 10);
    await flush_screen(1);
    await plineWithContinuation('The goblin dies.');
    placeMonsterAt(goblin, 13, 10);
    newsym(11, 10);
    input.beforeRead = () => {
        assert.equal(requireScreenCell(10, 11).ch, 'o');
    };
    pushKeys(' ');

    await displayMessageWindow();
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '.');
});

void test('a hit acknowledgment preserves a projectile until the map flush resumes', async () => {
    freshObjectRoom();
    const input = resetInputState();
    show_glyph_cell(10, 10, ')', NO_COLOR);
    await flush_screen(1);
    await plineWithContinuation('You are hit by a knife.');
    newsym(10, 10);
    input.beforeRead = () => {
        assert.equal(requireScreenCell(9, 11).ch, ')');
    };
    pushKeys(' ');

    await displayMessageWindow();
    await flush_screen(1);

    assert.equal(requireScreenCell(9, 11).ch, '@');
});

void test('a map flush without hero positioning leaves the cursor after the last changed glyph', async () => {
    freshObjectRoom();
    await flush_screen(1);
    show_glyph_cell(11, 10, '*', NO_COLOR);
    show_glyph_cell(12, 10, '*', NO_COLOR);

    await flush_screen(0);

    const display = requireGameDisplay(game);
    assert.deepEqual([display.cursorCol, display.cursorRow], [12, 11]);
});

void test('a map flush without changed glyphs preserves the existing cursor', async () => {
    freshObjectRoom();
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);

    await flush_screen(0);

    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});

for (const { name, typ, mask, ch, color } of [
    { name: 'ice', typ: ICE, mask: 0, ch: '·', color: CLR_CYAN },
    { name: 'raised bridge over water', typ: DRAWBRIDGE_UP, mask: DB_MOAT, ch: '◆', color: CLR_BLUE },
    { name: 'raised bridge over lava', typ: DRAWBRIDGE_UP, mask: DB_LAVA, ch: '◆', color: CLR_RED },
    { name: 'raised bridge over ice', typ: DRAWBRIDGE_UP, mask: DB_ICE, ch: '·', color: CLR_CYAN },
    { name: 'raised bridge over floor', typ: DRAWBRIDGE_UP, mask: DB_FLOOR, ch: '·', color: NO_COLOR },
    { name: 'lowered bridge', typ: DRAWBRIDGE_DOWN, mask: DB_MOAT, ch: '·', color: CLR_BROWN },
    { name: 'closed bridge wall', typ: DBWALL, mask: 0, ch: '#', color: CLR_BROWN },
]) {
    void test(`${name} displays its native terrain symbol after a monster leaves`, async () => {
        const level = freshObjectRoom();
        game.symset = 'DECgraphics';
        const location = level.requireAt(11, 10);
        location.typ = typ;
        location.drawbridgemask = mask;
        const bat = await createMonsterAt('bat', 11, 10, MM_NOGRP | NO_MINVENT);
        newsym(11, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(10, 11).ch, 'B');

        placeMonsterAt(bat, 12, 10);
        newsym(11, 10);
        await flush_screen(1);

        const cell = requireScreenCell(10, 11);
        assert.equal(cell.ch, ch);
        assert.equal(cell.color, color);
    });
}
