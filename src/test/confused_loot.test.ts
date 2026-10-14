import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST } from '../js/object_data.js';
import { THRONE } from '../js/const.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { floorObjectsAt } from './support/level-state.js';

void test('confused looting can leave a contribution of carried gold on the floor', async () => {
    const level = freshPlayableRoom();
    setHeroGoldAmount(game, 100);
    game.u.confusionTurns = 10;
    initRng(1n);

    await runExtendedCommand('loot', ' '.repeat(10));

    assert.equal(heroGoldAmount(game), 80);
    assert.equal(floorObjectsAt(level, 10, 10).find(object => object.oclass === 12)?.quan, 20);
    assert.equal(game.context.move, 1);
});

void test('a confused throne contribution goes to the royal coffers and locks the chest', async () => {
    const level = freshPlayableRoom();
    level.requireAt(10, 10).typ = THRONE;
    const coffers = await floorObject(CHEST, 13, 10, {
        initialize: false, olocked: false, obroken: true, cknown: true, spe: 2,
    });
    setHeroGoldAmount(game, 100);
    game.u.confusionTurns = 10;
    initRng(1n);

    await runExtendedCommand('loot', ' '.repeat(10));

    assert.equal(heroGoldAmount(game), 80);
    assert.equal(coffers.contents?.find(object => object.oclass === 12)?.quan, 20);
    assert.equal(coffers.olocked, true);
    assert.equal(coffers.obroken, false);
    assert.equal(coffers.cknown, false);
    assert.equal(game.context.move, 1);
});
