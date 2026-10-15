import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { rndmonstAdj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
import { saveGame, restoreGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { memoryStorage } from './support/memory-storage.js';

void test('the Healer quest generates the giant rats threatening its home', () => {
    freshObjectRoom({ role: 'healer', gameplaySeed: 324n });
    game.dungeons = [createDungeon({ dname: 'The Quest' })];
    game.u.uz = { dnum: 0, dlevel: 1 };

    const monsters = Array.from({ length: 40 }, () => rndmonstAdj());

    assert.ok(monsters.includes(MONSTER_NAME.indexOf('giant rat')));
});

void test('restore rejects a quest enemy species outside the monster table', async () => {
    const level = freshObjectRoom({ role: 'healer' });
    game.plname = 'QuestEnemy';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const encoded = storage.getItem('teleport-save:questenemy');
    assert.ok(encoded);
    const saved = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state) && isSavedRecord(saved.state.urole));
    saved.state.urole.enemy1num = MONSTER_NAME.length;
    storage.setItem('teleport-save:questenemy', encodeSavedGraph(saved));

    assert.equal(restoreGame(game.plname, storage), false);
    assert.equal(game.level, level);
});
