import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { TOWEL } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a concealed attacker reveals itself and the object covering it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const snake = await createMonsterAt('pit viper', 11, 10, NO_MINVENT);
    await floorObject(TOWEL, 11, 10, { bknown: false });
    snake.minvis = true;
    assert.equal(await hideMonsterUnder(snake), true);
    snake.minvis = false;
    snake.mpeaceful = 0;
    snake.mux = game.u.ux;
    snake.muy = game.u.uy;

    const input = resetInputState();
    const attack = performMonsterHeroAttack(snake, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 0,
    });
    await input.waitUntilBlocked();
    const reveal = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    input.feed(' ');
    installPagerInput(input, { expected: /pit viper/, limit: 5 });
    await attack;

    assert.match(reveal, /^A pit viper was hidden under a towel!/);
    assert.equal(snake.mundetected, 0);
});
