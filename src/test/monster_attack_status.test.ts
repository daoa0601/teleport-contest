import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { BOULDER } from '../js/object_data.js';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function statusLine() {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}

void test('a blocked hostile monster out of reach still refreshes pending status', async () => {
    freshObjectRoom({ left: 10, right: 12, top: 10, bottom: 10, heroX: 10, heroY: 10,
        flags: { showexp: true } });
    requirePlayingGame(game);
    await floorObject(BOULDER, 11, 10);
    const goblin = await createMonsterAt('goblin', 12, 10, MM_ANGRY | NO_MINVENT);
    goblin.msleeping = 0;
    await bot();
    game.u.uexp = (game.u.uexp ?? 0) + 303;
    game.context.botl = true;
    initRng(1n);

    await runMonsterAction(goblin, game);

    assert.equal(goblin.mx, 12);
    assert.match(statusLine(), new RegExp(`/${game.u.uexp} `));
});
