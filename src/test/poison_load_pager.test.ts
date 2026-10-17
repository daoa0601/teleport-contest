import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('monster poison waits for the load pager before remembering the new encumbrance', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    game.program_state.in_moveloop = true;
    await addInventoryObject(ROCK, { quan: 60 });
    assert.equal(nearCapacity(game), 0);
    game._encumbranceLevel = 0;
    const snake = await createMonsterAt('snake', 11, 10, NO_MINVENT);
    snake.mpeaceful = false;
    const capacitiesAtLoadPager: number[] = [];
    const hero = game.u;
    const input = resetInputState();
    input.beforeRead = () => {
        if (hero.acurr.a[A_STR] < 12 && nearCapacity(game) === 1)
            capacitiesAtLoadPager.push(game._encumbranceLevel ?? 0);
    };
    input.feed(' '.repeat(100));

    await runMonsterAction(snake, game, () => 0, count => count, () => 1);

    assert.equal(capacitiesAtLoadPager[0], 0, 'the load message has not returned yet');
    assert.equal(game._encumbranceLevel, 1);
    assert.equal(nearCapacity(game), 1);
});
