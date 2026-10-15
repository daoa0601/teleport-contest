import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { ICE, ICED_POOL, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    LEVEL_TIMER_KIND, OBJECT_TIMER_KIND, scheduleLevelTimer, scheduleObjectTimer,
} from '../js/object_timers.js';
import { untimedCorpse } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a fatal timer ends the turn before another due callback can run', async () => {
    const input = freshTurnRoom({ flags: { bones: false, disclose: '-i -a -v -g -c -o' } });
    requirePlayingGame(game);
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('newt'), { where: 'inventory' });
    game.inventory.push(corpse);
    const deadline = game.moves + 1;
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, deadline);
    for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
            game.level.requireAt(game.u.ux + dx, game.u.uy + dy).typ = POOL;
    const square = game.level.requireAt(game.u.ux, game.u.uy);
    square.typ = ICE;
    square.icedpool = ICED_POOL;
    scheduleLevelTimer(game.u.ux, game.u.uy, LEVEL_TIMER_KIND.MELT_ICE_AWAY, deadline);
    installPagerInput(input, { expected: /./, limit: 40 });
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.program_state.gameover, true);
    assert.equal(corpse.where, 'inventory');
    assert.equal(corpse.timed, 1);
});
