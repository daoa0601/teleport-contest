import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('an immobilized greedy monster is hit by kicked gold without a miss message', async () => {
    freshPlayableRoom();
    const coin = await floorObject(GOLD_PIECE, 11, 10, { initialize: false });
    const leprechaun = await createMonsterAt('leprechaun', 12, 10);
    leprechaun.mcanmove = 0;
    leprechaun.minvis = 0;
    await kickDirection('l', ' '.repeat(10));
    assert.equal(coin.where, 'floor');
    assert.match(game._pending_message, /The gold piece harmlessly hits the leprechaun\./);
    assert.doesNotMatch(game._pending_message, /miss/);
});
void test('a deaf hero sees a soldier catch kicked gold without hearing its reply', async () => {
    freshPlayableRoom({ hero: { deafTurns: 100 } });
    const coin = await floorObject(GOLD_PIECE, 11, 10, { initialize: false });
    const soldier = await createMonsterAt('soldier', 12, 10);
    soldier.mpeaceful = 0;
    soldier.mcanmove = 1;
    soldier.msleeping = 0;
    await kickDirection('l', ' '.repeat(10));
    assert.equal(coin.where, 'minvent');
    assert.match(game._pending_message, /catches the gold/);
    assert.doesNotMatch(game._pending_message, /That's not enough|Thanks|beat it/);
});
//# sourceMappingURL=kick_gold_native.test.js.map