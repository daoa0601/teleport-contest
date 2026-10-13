import test from 'node:test';
import assert from 'node:assert/strict';

import { CORR, FOUNTAIN, NO_MINVENT, ROOM, SINK, STONE } from '../js/const.js';
import { CLR_WHITE, NO_COLOR } from '../js/terminal.js';
import { rhack } from '../js/cmd.js';
import { mapLevel, premap_detect } from '../js/detect.js';
import { docrt, flush_screen, glyphAt, map_invisible, map_location, newsym, unmap_invisible } from '../js/display.js';
import { CmapSymbol, cmapToGlyph } from '../js/glyph_numbers.js';
import { recordMappedOverviewState } from '../js/dungeon.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const darkRoom of [true, false]) {
    void test(`remembered lit corridors ${darkRoom ? 'darken' : 'stay bright'} with dark_room ${darkRoom}`, async () => {
        const level = freshObjectRoom();
        game.flags.dark_room = darkRoom;
        game.flags.color = true;
        const corridor = level.requireAt(11, 10);
        corridor.typ = CORR;
        corridor.lit = true;
        newsym(11, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(10, 11).color, CLR_WHITE);

        game.u.ux = 30;
        level.requireAt(30, 10).typ = ROOM;
        vision_recalc(0);
        newsym(11, 10);
        await flush_screen(1);

        assert.equal(cansee(11, 10), false);
        assert.equal(requireScreenCell(10, 11).color, darkRoom ? NO_COLOR : CLR_WHITE);
    });
}

void test('redrawing an unseen detected monster preserves its remembered lit floor', async () => {
    const level = freshObjectRoom({ flags: { dark_room: true, color: true },
        hero: { monsterDetection: true } });
    await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    newsym(11, 10);
    const floor = level.requireAt(11, 10);
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    assert.equal(cansee(11, 10), false);
    assert.equal(floor.remembered_glyph?.glyph, cmapToGlyph(CmapSymbol.room));

    await docrt();

    assert.equal(glyphAt(11, 10)?.kind, 'monster');
    assert.equal(floor.remembered_glyph?.glyph, cmapToGlyph(CmapSymbol.room),
        'the detection overlay must leave the remembered floor lit');
});

function currentFeatures() {
    requirePlayingGame(game);
    recordMappedOverviewState();
    const record = game._overviewRecords?.get(`${game.u.uz.dnum}:${game.u.uz.dlevel}`);
    assert.ok(record);
    return record.features;
}

for (const permanentlyLit of [true, false]) {
    void test(`clearing an unseen monster restores ${permanentlyLit ? 'a previously lit room floor' : 'darkness in an unlit room'}`, () => {
        const level = freshObjectRoom({ recalculateVision: false });
        requirePlayingGame(game);
        const location = level.requireAt(11, 10);
        location.lit = permanentlyLit;
        location.waslit = !permanentlyLit;
        vision_recalc(0);
        assert.equal(cansee(11, 10), true);
        map_invisible(11, 10);

        level.requireAt(30, 10).typ = ROOM;
        game.u.ux = 30;
        vision_recalc(0);
        assert.equal(cansee(11, 10), false);
        unmap_invisible(11, 10);

        assert.equal(location.disp_ch, permanentlyLit ? '.' : ' ');
        assert.notEqual(location.remembered_glyph?.kind, 'invisible');
    });
}

void test('the overview keeps mapped features until their changed terrain is learned', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const location = level.requireAt(30, 10);
    location.typ = FOUNTAIN;
    assert.equal(cansee(30, 10), false);

    mapLevel();

    assert.equal(location.lastseentyp, FOUNTAIN);
    assert.equal(currentFeatures().nfount, 1);
    location.typ = SINK;
    assert.equal(currentFeatures().nfount, 1);
    assert.equal(currentFeatures().nsink, 0);

    mapLevel();

    assert.equal(currentFeatures().nfount, 0);
    assert.equal(currentFeatures().nsink, 1);
});

void test('premapping draws distant features without recording them as visited terrain', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const location = level.requireAt(30, 10);
    location.typ = FOUNTAIN;
    assert.equal(cansee(30, 10), false);

    premap_detect();

    assert.equal(location.disp_ch, '{');
    assert.equal(location.lastseentyp, STONE);
    assert.equal(currentFeatures().nfount, 0);

    mapLevel();
    assert.equal(currentFeatures().nfount, 1);
});

for (const movement of ['grounded', 'flying', 'levitation'] satisfies ('grounded' | 'flying' | 'levitation')[]) {
    void test(`a blind ${movement} hero ${movement === 'levitation' ? 'does not learn' : 'learns'} changed terrain underfoot from the overview`, () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const location = level.requireAt(game.u.ux, game.u.uy);
        assert.equal(location.lastseentyp, ROOM);
        setHeroBlindnessTurns(5);
        vision_recalc(0);
        if (movement !== 'grounded') {
            grantIntrinsicProperty(movement, 'outside');
            assert.equal(propertyIsActive(movement), true);
        }
        location.typ = FOUNTAIN;

        const features = currentFeatures();

        assert.equal(features.nfount, movement === 'levitation' ? 0 : 1);
        assert.equal(location.lastseentyp, movement === 'levitation' ? ROOM : FOUNTAIN);
    });
}

void test('terrain memory survives stairs, saved cached levels, and revisiting a level', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    source.requireAt(30, 10).typ = FOUNTAIN;
    map_location(30, 10, false);
    source.requireAt(30, 10).typ = ROOM;

    const input = resetInputState();
    const descending = rhack('>'.charCodeAt(0));
    await input.waitUntilBlocked();
    try {
        const row = requireGameDisplay().grid[0];
        assert.ok(row);
        const topline = row.map(cell => cell.ch).join('');
        assert.match(topline, /You descend the stairs\.--More--/);
        assert.equal(source.requireAt(30, 10).lastseentyp, FOUNTAIN);
    } finally {
        // Acknowledge the stair message before native cls clears the map.
        input.feed(' ');
        await descending;
    }
    assert.equal(game.u.uz.dlevel, 2);
    game.level.requireAt(30, 10).typ = SINK;
    map_location(30, 10, false);
    game.level.requireAt(30, 10).typ = ROOM;
    game.plname = 'Cartographer';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Cartographer', storage), true);

    assert.equal(game.level.requireAt(30, 10).lastseentyp, SINK);
    const cached = game._levelCache?.get('0:1');
    assert.ok(cached);
    assert.equal(cached.level.requireAt(30, 10).lastseentyp, FOUNTAIN);
    pushKeys(' '); // Dismiss the upward-arrival message in cls().
    await rhack('<'.charCodeAt(0));

    assert.equal(game.u.uz.dlevel, 1);
    assert.equal(game.level.requireAt(30, 10).typ, ROOM);
    assert.equal(game.level.requireAt(30, 10).lastseentyp, FOUNTAIN);
});
