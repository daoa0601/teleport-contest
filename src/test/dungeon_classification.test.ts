import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { canDigDown } from '../js/mklev.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

void test('the invocation floor depends on the dungeon hellish flag', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dungeon = createDungeon({ dname: 'Hell', num_dunlevs: 4,
        flags: { hellish: true } });
    game.dungeons = [dungeon];
    game.u.uz = { dnum: 0, dlevel: 3 };
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });

    assert.equal(canDigDown(), false, 'the invocation floor resists digging');

    dungeon.flags.hellish = false;
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    assert.equal(canDigDown(), true, 'a non-hellish branch has no invocation floor');
});
