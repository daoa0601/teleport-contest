import assert from 'node:assert/strict';
import test from 'node:test';
import { D_CLOSED, DOOR, STAIRS } from '../js/const.js';
import { flush_screen, newsym, terrain_glyph } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLR_BROWN, CLR_GRAY, CLR_RED } from '../js/terminal.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// symbols.c:assign_graphics(ROGUESET) swaps the character set, but the
// default rogue symset keeps H_UNK handling, so display.c's has_rogue_color
// path stays off and every ordinary glyph color survives the level change.

void test('a rogue level keeps native glyph colors behind rogue characters', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    game.symset = 'DECgraphics';

    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const stairs = level.requireAt(13, 10);
    stairs.typ = STAIRS;
    level.upstair = { x: 13, y: 10 };
    game.stairs = { sx: 13, sy: 10, up: true, isladder: false,
        tolev: { dnum: 1, dlevel: 1 }, u_traversed: false, next: null };
    await createMonsterAt(MONSTER_NAME.indexOf('red mold'), 14, 10);

    const doorGlyph = terrain_glyph(door, 12, 10);
    assert.equal(doorGlyph.ch, '+');
    assert.equal(doorGlyph.color, CLR_BROWN);

    const stairGlyph = terrain_glyph(stairs, 13, 10);
    assert.equal(stairGlyph.ch, '%');
    assert.equal(stairGlyph.color, CLR_GRAY);

    newsym(14, 10);
    await flush_screen(1);
    const cell = requireGameDisplay().grid[11]?.[13];
    assert.equal(cell?.ch, 'F');
    assert.equal(cell?.color, CLR_RED);
});
