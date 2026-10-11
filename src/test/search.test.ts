import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { STATUE_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { createCorpstatAt } from '../js/mklev.js';
import { STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { freshPlayableRoom } from './support/playable-room.js';

const PM_JACKAL = 12;

void test('searching beside a statue trap releases its monster', async () => {
    const level = freshPlayableRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const x = game.u.ux - 1;
    const y = game.u.uy - 1;
    initRng(9403n);
    const statue = await createCorpstatAt(STATUE, null, PM_JACKAL, x, y, 0);
    addTrap(level, STATUE_TRAP, x, y, { tseen: false });
    initRng(14n);

    await rhack('s'.charCodeAt(0));

    const released = level.monsters.find(monster =>
        monster.mnum === PM_JACKAL && monster.mx === x && monster.my === y,
    );
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
    assert.equal(game.context.move, 1);
});
