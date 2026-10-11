import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ARROW_TRAP, CORR, FOUNTAIN, ROOM, SCORR, SDOOR,
} from '../js/const.js';
import { mapLevel } from '../js/detect.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { magic_map_background, map_invisible, map_object, map_trap, newsym } from '../js/display.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { POT_HEALING } from '../js/object_data.js';
import { cansee } from '../js/vision.js';
import { CLR_BLACK, NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { addTrap } from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('mapping finds secret corridors but preserves other secrets', () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.flags.hero_memory = true;
    level.requireAt(30, 9).typ = SCORR;
    level.requireAt(31, 9).typ = SDOOR;
    const hiddenTrap = addTrap(level, ARROW_TRAP, 32, 9, { tseen: false });
    addTrap(level, ARROW_TRAP, 33, 9, { tseen: true });

    mapLevel();

    assert.equal(level.requireAt(30, 9).typ, CORR);
    assert.equal(level.requireAt(31, 9).typ, SDOOR);
    assert.equal(hiddenTrap.tseen, false);
    assert.equal(level.requireAt(33, 9).remembered_glyph?.kind, 'trap');
});

void test('magic mapping preserves a remembered object on a distant fountain', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = FOUNTAIN;
    const potion = await mksobj(POT_HEALING, false, false);
    placeCreatedObject(potion, 30, 10);
    map_object(potion, true);
    assert.equal(cansee(30, 10), false);

    mapLevel();

    assert.equal(level.requireAt(30, 10).lastseentyp, FOUNTAIN);
    assert.equal(level.requireAt(30, 10).remembered_glyph?.kind, 'object');
    assert.equal(level.requireAt(30, 10).disp_ch, '!');
});

void test('magic mapping preserves an unseen invisible-monster marker', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = ROOM;
    map_invisible(30, 10);
    assert.equal(cansee(30, 10), false);

    mapLevel();

    assert.equal(level.requireAt(30, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(level.requireAt(30, 10).disp_ch, 'I');
    assert.equal(level.requireAt(30, 10).lastseentyp, ROOM);
});

for (const darkRoom of [false, true]) {
    void test(`magic mapping ${darkRoom ? 'shades' : 'leaves blank'} a never-lit room`, () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const location = level.requireAt(30, 10);
        location.typ = ROOM;
        location.lit = true;
        location.waslit = false;
        game.flags.dark_room = darkRoom;
        game.flags.color = true;
        assert.equal(cansee(30, 10), false);

        mapLevel();

        assert.equal(location.disp_ch, darkRoom ? '.' : ' ');
        assert.equal(location.disp_color, darkRoom ? CLR_BLACK : NO_COLOR);
        assert.equal(location.waslit, false);
        assert.equal(location.lastseentyp, ROOM);
    });
}

void test('magic mapping does not brighten unseen corridors with lit_corridor enabled', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const location = level.requireAt(30, 10);
    location.typ = CORR;
    location.lit = true;
    location.waslit = false;
    game.flags.lit_corridor = true;
    assert.equal(cansee(30, 10), false);

    mapLevel();

    assert.equal(location.disp_ch, '#');
    assert.equal(location.disp_color, NO_COLOR);
    assert.equal(location.lastseentyp, CORR);
});

void test('far-look describes mapped darkness rather than an unseen replacement feature', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const location = level.requireAt(30, 10);
    location.typ = ROOM;
    location.waslit = false;
    game.flags.dark_room = false;
    game.flags.tips = false;
    mapLevel();
    assert.equal(location.disp_ch, ' ');
    location.typ = FOUNTAIN;
    assert.equal(cansee(30, 10), false);
    pushKeys('l'.repeat(20) + '.');

    await rhack(';'.charCodeAt(0));

    assert.match(game._lastPlineMessage, /dark part of a room/);
    assert.doesNotMatch(game._lastPlineMessage, /fountain/);
    assert.equal(game.context.move, 0);
});

void test('memory-only magic background mapping replaces a trap glyph without hiding the trap itself', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = CORR;
    const trap = addTrap(level, ARROW_TRAP, 30, 10, { tseen: true });
    map_trap(trap, true);
    assert.equal(level.requireAt(30, 10).disp_ch, '^');
    assert.equal(cansee(30, 10), false);

    magic_map_background(30, 10, false);
    assert.equal(level.requireAt(30, 10).disp_ch, '^');
    newsym(30, 10);

    assert.equal(level.requireAt(30, 10).disp_ch, '#');
    assert.equal(trap.tseen, true);
    mapLevel();
    assert.equal(level.requireAt(30, 10).disp_ch, '^');
});
