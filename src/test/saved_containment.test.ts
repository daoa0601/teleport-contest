import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT } from '../js/const.js';
import { game, resetGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { CLUB, ROCK, SACK } from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { restoreGame, saveGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { inventoryWeight, objectWeight } from '../js/weight.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function savedRecord(value: unknown): Record<string, unknown> {
    assert.ok(isSavedRecord(value), 'The saved container must be a record');
    return value;
}

for (const depth of [1, 2]) {
    void test(`restore rejects a ${depth === 1 ? 'direct' : 'nested'} contents cycle before replacing live objects`, async () => {
        const level = freshObjectRoom({ moves: 27 });
        game.plname = 'Container reader';
        const hero = game.u;
        const outer = await addInventoryObject(SACK, { initialize: false });
        let inner: GameObject = outer;
        for (let index = 1; index < depth; index++) {
            const child = await knownObject(SACK, { initialize: false });
            await addCreatedObjectToContainer(inner, child);
            inner = child;
        }
        const weight = inventoryWeight(game);
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:container reader';
        const encoded = storage.getItem(key);
        assert.ok(encoded, 'The constructed containers must be saved');
        const snapshot = savedRecord(decodeSavedGraph(encoded));
        const state = savedRecord(snapshot.state);
        assert.ok(Array.isArray(state.inventory));
        const inventory: unknown[] = state.inventory;
        const savedOuter = savedRecord(inventory[0]);
        let savedInner = savedOuter;
        for (let index = 1; index < depth; index++) {
            assert.ok(Array.isArray(savedInner.contents));
            const contents: unknown[] = savedInner.contents;
            savedInner = savedRecord(contents[0]);
        }
        savedInner.contents = [savedOuter];
        storage.setItem(key, encodeSavedGraph(snapshot));

        assert.equal(restoreGame(game.plname, storage), false,
            'A container must not become one of its own descendants');

        assert.equal(game.level, level);
        assert.equal(game.u, hero);
        assert.equal(game.inventory[0], outer);
        assert.equal(game.moves, 27);
        assert.equal(inventoryWeight(game), weight,
            'The rejected save must leave usable inventory weight calculation');
        assert.notEqual(storage.getItem(key), null, 'A rejected save must remain available');
    });
}

void test('restore retains nested containers and monster carrier back-references', async () => {
    freshObjectRoom();
    game.plname = 'Container owners';
    const outer = await addInventoryObject(SACK, { initialize: false });
    const inner = await knownObject(SACK, { initialize: false });
    const club = await knownObject(CLUB, { initialize: false });
    await addCreatedObjectToContainer(inner, club);
    await addCreatedObjectToContainer(outer, inner);
    const monster = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const monsterBag = await knownObject(SACK, { initialize: false });
    const rocks = await knownObject(ROCK, { initialize: false, quan: 3 });
    await addCreatedObjectToContainer(monsterBag, rocks);
    await addObjectToMonsterInventory(monster, monsterBag);
    const heroWeight = inventoryWeight(game);
    const monsterBagWeight = objectWeight(monsterBag);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Container owners', storage), true);

    const restoredOuter = game.inventory.find(object => object.o_id === outer.o_id);
    const restoredInner = restoredOuter?.contents?.[0];
    const restoredClub = restoredInner?.contents?.[0];
    assert.ok(restoredOuter && restoredInner && restoredClub,
        'All three levels of the carried object tree must survive restore');
    assert.equal(restoredInner.container, restoredOuter);
    assert.equal(restoredClub.container, restoredInner);
    assert.equal(inventoryWeight(game), heroWeight);
    const restoredMonster = game.level?.monsters.find(actor => actor.m_id === monster.m_id);
    const restoredBag = restoredMonster?.minvent?.find(object => object.o_id === monsterBag.o_id);
    const restoredRocks = restoredBag?.contents?.[0];
    assert.ok(restoredMonster && restoredBag && restoredRocks,
        'The monster must retain its bag and the contained rocks');
    assert.equal(restoredBag.ocarry, restoredMonster);
    assert.equal(restoredRocks.container, restoredBag);
    assert.equal(objectWeight(restoredBag), monsterBagWeight);
});
