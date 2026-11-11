import { dropBall } from '../js/ball.js';
import { punishHero } from '../js/read.js';
import { moveObject } from '../js/hack.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleHero } from '../js/dothrow.js';
import { pushKeys } from '../js/input.js';
import { createGasCloudSelection, runLevelRegions } from '../js/region.js';
import { saveGame } from '../js/save.js';
import { restoreGame } from '../js/restore.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

for (const startsInside of [false, true]) {
    void test(`blocked knockback ${startsInside ? 'out of' : 'into'} gas updates the hero's exposure`, async () => {
        await freshObjectRoom();
        requirePlayingGame(game);
        await createMonsterAt('fire elemental', 11, 10, NO_MINVENT);
        const cloud = await createGasCloudSelection(game,
            [{ x: startsInside ? 10 : 11, y: 10 }], 5, 8, async () => {});
        assert.ok(cloud);
        cloud.heroFault = false;
        pushKeys(' '.repeat(8));

        await hurtleHero(1, 0, 1, { verbose: false });
        const hp = game.u.uhp;
        await runLevelRegions(game, { publish: async () => {}, rollOne: () => 1 });

        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.equal(game.u.uhp, startsInside ? hp : hp - 6);
    });
}

void test('saving preserves gas exposure after blocked knockback', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    await createMonsterAt('fire elemental', 11, 10, NO_MINVENT);
    await createGasCloudSelection(game, [{ x: 10, y: 10 }], 5, 8, async () => {});
    pushKeys(' '.repeat(8));
    await hurtleHero(1, 0, 1);
    const hp = game.u.uhp;
    const storage = memoryStorage();
    game.plname = 'CloudSurvivor';

    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('CloudSurvivor', storage), true);
    await runLevelRegions(game, { publish: async () => {}, rollOne: () => 1 });

    assert.equal(game.u.uhp, hp);
    assert.equal(game.u.blindTurns ?? 0, 0);
});

void test('a thrown punishment ball pulls the hero into poison gas exposure', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    pushKeys(' '.repeat(12));
    await punishHero();
    const ball = game.uball;
    assert.ok(ball);
    await moveObject(ball, 14, 10);
    game.u.dx = 1;
    game.u.dy = 0;
    const cloud = await createGasCloudSelection(game, [{ x: 13, y: 10 }], 5, 8, async () => {});
    assert.ok(cloud);
    cloud.heroFault = false;

    await dropBall(14, 10);
    const hp = game.u.uhp;
    await runLevelRegions(game, { publish: async () => {}, rollOne: () => 1 });

    assert.equal(game.u.ux, 13);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.uhp, hp - 6);
});
