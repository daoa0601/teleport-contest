import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, PIT, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const running of [false, true]) {
    void test(`falling into a pit ${running ? 'while running' : 'with a single step'} hides later births beyond its edge`, async () => {
        const level = freshObjectRoom({ gameplaySeed: 3 });
        requirePlayingGame(game);
        game._moveloopStarted = true;
        game.u.umovement = 12;
        const pitX = running ? 12 : 11;
        addTrap(level, PIT, pitX, 10);
        pushKeys(running ? 'L' : 'l');

        await moveloop_core();
        if (running) await moveloop_core();
        assert.equal(game.u.ux, pitX);
        assert.equal(game.u.utraptype, TT_PIT);
        assert.ok((game.u.utrap ?? 0) > 0);
        const bug = await makemonAt(MONSTER_NAME.indexOf('grid bug'), pitX + 2, 10, NO_MINVENT);

        assert.ok(bug, 'the bug is created outside the pit');
        assert.equal(game._pending_message, 'You fall into a pit!');
    });
}
