import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DBWALL, DRAWBRIDGE_DOWN, ALTAR, AM_LAWFUL, AM_NEUTRAL, AM_SHRINE, CORPSTAT_FEMALE, CORPSTAT_MALE, DOOR, D_CLOSED, DRAWBRIDGE_UP, ICE, MAGIC_TRAP, MM_NOGRP, NO_MINVENT, PIT, SPIKED_PIT, WEB, } from '../js/const.js';
import { displayMessageWindow, flush_screen, map_invisible, newsym, plineWithContinuation, show_glyph_cell, } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { nameToMonster } from '../js/mondata.js';
import { setMonsterSpecies } from '../js/monster_species.js';
import { changeHeroSex } from '../js/hero_species.js';
import { CORPSE, POT_HEALING, POT_SPEED, STATUE } from '../js/object_data.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { makeBlinded } from '../js/sight_change.js';
import { ATR_INVERSE, CLR_BLUE, CLR_BROWN, CLR_CYAN, CLR_GRAY, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { cansee } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObject } from './support/game-objects.js';
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
    await createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }]);
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
void test('restoring a glyph before flushing still redraws it and advances the cursor', async () => {
    freshObjectRoom();
    newsym(9, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    show_glyph_cell(9, 10, '*', NO_COLOR);
    newsym(9, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(8, 11).ch, '.');
    assert.deepEqual([display.cursorCol, display.cursorRow], [9, 11]);
});
void test('showing the same buffered glyph does not move the cursor', async () => {
    freshObjectRoom();
    newsym(9, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    newsym(9, 10);
    await flush_screen(0);
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});
void test('a species change redraws a monster even when its character and color stay the same', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('jackal', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    assert.equal(requireScreenCell(10, 11).color, CLR_BROWN);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    setMonsterSpecies(monster, nameToMonster('coyote'));
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    assert.equal(requireScreenCell(10, 11).color, CLR_BROWN);
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('redrawing an unchanged monster preserves the cursor', async () => {
    freshObjectRoom();
    await createMonsterAt('jackal', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    newsym(11, 10);
    await flush_screen(0);
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});
for (const { name, type, ch } of [
    { name: 'corpse', type: CORPSE, ch: '%' },
    { name: 'statue', type: STATUE, ch: 'd' },
]) {
    void test(`a ${name} species change redraws even when its appearance stays the same`, async () => {
        freshObjectRoom();
        const object = await floorObject(type, 11, 10, {
            corpsenm: nameToMonster('jackal'), initialize: false,
        });
        newsym(11, 10);
        await flush_screen(1);
        const initialColor = requireScreenCell(10, 11).color;
        assert.equal(requireScreenCell(10, 11).ch, ch);
        const display = requireGameDisplay(game);
        display.setCursor(20, 0);
        object.corpsenm = nameToMonster('coyote');
        newsym(11, 10);
        await flush_screen(0);
        assert.equal(requireScreenCell(10, 11).ch, ch);
        assert.equal(requireScreenCell(10, 11).color, initialColor);
        assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
    });
}
void test('a statue gender change redraws its unchanged map symbol', async () => {
    freshObjectRoom();
    const statue = await floorObject(STATUE, 11, 10, {
        corpsenm: nameToMonster('jackal'), spe: CORPSTAT_MALE, initialize: false,
    });
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    statue.spe = CORPSTAT_FEMALE;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('a monster gender change redraws its unchanged map symbol', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('jackal', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    monster.female = !monster.female;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('changing hero gender redraws the unchanged hero symbol', async () => {
    freshObjectRoom({ flags: { female: false } });
    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    changeHeroSex();
    newsym(game.u.ux, game.u.uy);
    await flush_screen(0);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '@');
    assert.deepEqual([display.cursorCol, display.cursorRow], [game.u.ux, game.u.uy + 1]);
});
void test('a polymorphed hero redraws when the current body changes gender', async () => {
    freshObjectRoom({
        hero: { umonnum: nameToMonster('jackal'), mtimedone: 20, mfemale: false },
    });
    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    game.u.mfemale = true;
    newsym(game.u.ux, game.u.uy);
    await flush_screen(0);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, 'd');
    assert.deepEqual([display.cursorCol, display.cursorRow], [game.u.ux, game.u.uy + 1]);
});
void test('changing the saved human gender preserves a polymorphed body glyph', async () => {
    freshObjectRoom({
        flags: { female: false },
        hero: { umonnum: nameToMonster('jackal'), mtimedone: 20, mfemale: false },
    });
    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    game.flags.female = true;
    newsym(game.u.ux, game.u.uy);
    await flush_screen(0);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, 'd');
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});
void test('showrace redraws the human hero even when the race and role symbols match', async () => {
    freshObjectRoom({ flags: { showrace: false } });
    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    game.flags.showrace = true;
    newsym(game.u.ux, game.u.uy);
    await flush_screen(0);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '@');
    assert.deepEqual([display.cursorCol, display.cursorRow], [game.u.ux, game.u.uy + 1]);
});
void test('a ridden glyph follows the steed gender rather than the hero gender', async () => {
    freshObjectRoom({ flags: { female: false } });
    const steed = await createMonsterAt('pony', 11, 10, MM_NOGRP | NO_MINVENT);
    game.u.usteed = steed;
    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    changeHeroSex();
    newsym(game.u.ux, game.u.uy);
    await flush_screen(0);
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
    steed.female = !steed.female;
    newsym(game.u.ux, game.u.uy);
    await flush_screen(0);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, 'u');
    assert.deepEqual([display.cursorCol, display.cursorRow], [game.u.ux, game.u.uy + 1]);
});
void test('taming redraws a monster even with pet highlighting disabled', async () => {
    freshObjectRoom({ flags: { hilite_pet: false } });
    const monster = await createMonsterAt('jackal', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    monster.mtame = 10;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    assert.equal(requireScreenCell(10, 11).attr, 0);
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('seeing a previously detected monster redraws even with inverse disabled', async () => {
    freshObjectRoom({ hero: { detectMonsters: true }, flags: { use_inverse: false } });
    const monster = await createMonsterAt('jackal', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = 1;
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    game.u.seeInvisible = true;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, 'd');
    assert.equal(requireScreenCell(10, 11).attr, 0);
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('rotating a closed door redraws its unchanged map symbol', async () => {
    const level = freshObjectRoom();
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    door.horizontal = false;
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    door.horizontal = true;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, '+');
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('recognizing a gray potion redraws its unchanged map symbol', async () => {
    freshObjectRoom();
    assert.ok(game.objectColors);
    game.objectColors[POT_HEALING] = CLR_GRAY;
    const potion = await floorObject(POT_HEALING, 14, 10, {
        dknown: false, initialize: false,
    });
    newsym(14, 10);
    await flush_screen(1);
    assert.equal(potion.dknown, false);
    assert.equal(requireScreenCell(13, 11).color, CLR_GRAY);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    game.u.ux = 12;
    newsym(14, 10);
    await flush_screen(0);
    assert.equal(potion.dknown, true);
    assert.equal(requireScreenCell(13, 11).ch, '!');
    assert.equal(requireScreenCell(13, 11).color, CLR_GRAY);
    assert.deepEqual([display.cursorCol, display.cursorRow], [14, 11]);
});
void test('different unobserved potions share one generic map glyph', async () => {
    freshObjectRoom();
    const potion = await floorObject(POT_HEALING, 14, 10, {
        dknown: false, initialize: false,
    });
    newsym(14, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    potion.otyp = POT_SPEED;
    newsym(14, 10);
    await flush_screen(0);
    assert.equal(potion.dknown, false);
    assert.equal(requireScreenCell(13, 11).ch, '!');
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});
void test('converting an altar redraws its unchanged map symbol', async () => {
    const level = freshObjectRoom();
    const altar = level.requireAt(11, 10);
    altar.typ = ALTAR;
    altar.flags = AM_NEUTRAL;
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    altar.flags = AM_LAWFUL;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, '_');
    assert.equal(requireScreenCell(10, 11).color, NO_COLOR);
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
void test('shrine status does not change an altar glyph', async () => {
    const level = freshObjectRoom();
    const altar = level.requireAt(11, 10);
    altar.typ = ALTAR;
    altar.flags = AM_LAWFUL;
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    altar.flags |= AM_SHRINE;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, '_');
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});
void test('replacing a raised bridge with its exposed ice preserves the cursor', async () => {
    const level = freshObjectRoom();
    const bridge = level.requireAt(11, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_ICE;
    newsym(11, 10);
    await flush_screen(1);
    const display = requireGameDisplay(game);
    display.setCursor(20, 0);
    bridge.typ = ICE;
    newsym(11, 10);
    await flush_screen(0);
    assert.equal(requireScreenCell(10, 11).ch, '.');
    assert.equal(requireScreenCell(10, 11).color, CLR_CYAN);
    assert.deepEqual([display.cursorCol, display.cursorRow], [20, 0]);
});
for (const symset of ['ASCII', 'DECgraphics']) {
    for (const typ of [ICE, DRAWBRIDGE_UP]) {
        void test(`${symset} ice ${typ === ICE ? 'terrain' : 'under a raised bridge'} uses inverse video without color`, async () => {
            const level = freshObjectRoom({ flags: { color: false } });
            game.symset = symset;
            const location = level.requireAt(11, 10);
            location.typ = typ;
            location.drawbridgemask = DB_ICE;
            newsym(11, 10);
            await flush_screen(1);
            const cell = requireScreenCell(10, 11);
            assert.equal(cell.ch, symset === 'DECgraphics' ? '·' : '.');
            assert.equal(cell.color, NO_COLOR);
            assert.equal(cell.attr, ATR_INVERSE);
        });
    }
}
void test('monochrome ice respects disabling inverse video', async () => {
    const level = freshObjectRoom({ flags: { color: false, use_inverse: false } });
    level.requireAt(11, 10).typ = ICE;
    newsym(11, 10);
    await flush_screen(1);
    const cell = requireScreenCell(10, 11);
    assert.equal(cell.ch, '.');
    assert.equal(cell.color, NO_COLOR);
    assert.equal(cell.attr, 0);
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
//# sourceMappingURL=monster_display.test.js.map