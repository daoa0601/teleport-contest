import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a water demon summons another demon in vapor during its attack', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.mpeaceful = false;
    demon.msleeping = 0;
    demon.mux = game.u.ux;
    demon.muy = game.u.uy;
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };
    initRng(1n);

    await runMonsterAction(demon, game, limit => limit === 16 ? 0 : limit - 1);

    messages.push(game._pending_message);
    assert.equal(level.monsters.filter(monster => monster.mnum === demon.mnum).length, 2);
    assert.match(messages.join('\n'), /A water demon appears in a cloud of vapor!/);
});
