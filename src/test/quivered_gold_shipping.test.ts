import assert from 'node:assert/strict';
import test from 'node:test';
import { STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { carriedGold, fireQuiveredGold, readyGold } from './support/gold-arena.js';
import { floorObjectsAt } from './support/level-state.js';

void test('a fired coin landing on a downward ladder migrates and leaves the purse ready', async () => {
    const { source } = freshConnectedLevels({ ladder: true });
    source.requireAt(9, 10).typ = STONE;
    game.u.ux = 13;
    const purse = await carriedGold(5);
    await readyGold();

    await fireQuiveredGold('h', ' '.repeat(5));

    const [coin] = game.migratingObjects ?? [];
    assert.ok(coin, 'The fired coin should fall down the ladder.');
    assert.equal(coin.quan, 1);
    assert.equal(coin.where, 'migrating');
    assert.equal(coin.migration?.destination.dlevel, 2);
    assert.equal(floorObjectsAt(source, 10, 10).length, 0);
    assert.equal(purse.quan, 4);
    assert.equal(game.uquiver, purse);
});
