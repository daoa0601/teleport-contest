import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_SADDLE } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { inventoryItemDescription } from '../js/invent.js';
import { makemonAt, mksobj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CHEST, SADDLE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { maybeGiveDomesticSaddle, monsterSaddle, putSaddleOnMonster } from '../js/steed.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

const PONY = MONSTER_NAME.indexOf('pony');

void test('a newly generated domestic mount can start with a worn saddle', async () => {
    freshObjectRoom();
    initRng(23n);

    const pony = await makemonAt(PONY, 12, 10);
    const saddle = monsterSaddle(pony);

    assert.ok(saddle);
    assert.equal(saddle.otyp, SADDLE);
    assert.equal(saddle.owornmask, W_SADDLE);
    assert.ok(pony !== null && pony !== undefined);
    assert.equal(saddle.leashmon, pony.m_id);
    assert.ok(pony.minvent.includes(saddle));
    assert.match(await inventoryItemDescription(saddle), /(?:blessed|uncursed|cursed).*saddle/);
});

void test('NO_MINVENT domestic mounts do not receive a starting saddle', async () => {
    freshObjectRoom();
    initRng(23n);

    const pony = await makemonAt(PONY, 12, 10, NO_MINVENT);

    assert.equal(monsterSaddle(pony), null);
    assert.ok(pony !== null && pony !== undefined);
    assert.deepEqual(pony.minvent, []);
});

void test('automatic saddling identifies the saddle and never equips a second one', async () => {
    freshObjectRoom();
    const pony = await createMonsterAt('pony', 12, 10, NO_MINVENT);

    const saddle = await putSaddleOnMonster(null, pony);
    const second = await putSaddleOnMonster(null, pony);

    assert.ok(saddle);
    assert.equal(saddle.known, true);
    assert.equal(saddle.bknown, true);
    assert.equal(saddle.rknown, true);
    assert.equal(saddle.dknown, true);
    assert.equal(second, null);
    assert.equal(pony.minvent.filter(object => object.otyp === SADDLE).length, 1);
});

void test('a generated obvious chest trap offers disarming without a search', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    initRng(1217n);
    const chest = await mksobj(CHEST, true, false);
    placeCreatedObject(chest, game.u.ux, game.u.uy);
    chest.dknown = true;

    await runExtendedCommand('untrap', '.q');

    const topRow = requireGameDisplay(game).grid[0];
    assert.ok(topRow);
    const topLine = topRow.map(cell => cell.ch).join('');
    assert.match(topLine, /Disarm this chest/);
    assert.equal(chest.otrapped, true);
    assert.equal(game.context.move, 0);
});

void test('a generated saddle keeps its mount and worn state after saving', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.plname = 'Saddles';
    initRng(23n);
    const pony = await makemonAt(PONY, 12, 10);
    assert.ok(monsterSaddle(pony));
    const storage = memoryStorage();

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Saddles', storage), true);

    const restored = game.level.monsters[0];
    const saddle = monsterSaddle(restored);
    assert.ok(restored && saddle);
    assert.ok(restored.minvent?.includes(saddle));
    assert.ok(saddle !== null && saddle !== undefined);
    assert.equal(saddle.leashmon, restored.m_id);
    assert.equal(saddle.owornmask, W_SADDLE);
});

void test('wild saddlable species do not gain the domestic starting equipment', async () => {
    freshObjectRoom();
    const mumak = await createMonsterAt('mumak', 12, 10, NO_MINVENT);

    for (let birth = 0; birth < 1000; birth++) await maybeGiveDomesticSaddle(mumak);

    assert.equal(monsterSaddle(mumak), null);
    assert.deepEqual(mumak.minvent, []);
});
