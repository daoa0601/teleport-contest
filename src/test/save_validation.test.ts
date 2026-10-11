import test from 'node:test';
import assert from 'node:assert/strict';

import { COLNO, NON_PM, NO_MINVENT, ROWNO } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLUB, OBJECT_NAMES } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createMonsterAt } from './support/monsters.js';

void test('restore rejects a nonnumeric hero statistic before changing the live game', async () => {
    freshObjectRoom({ moves: 27 });
    game.plname = 'MalformedHero';
    const hero = game.u;
    const level = game.level;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:malformedhero';
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    const saved = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
    assert.ok(isSavedRecord(saved.state.u));
    saved.state.u.uhp = 'healthy';
    storage.setItem(key, encodeSavedGraph(saved));

    assert.equal(restoreGame(game.plname, storage), false);

    assert.equal(game.u, hero);
    assert.equal(game.level, level);
    assert.equal(game.moves, 27);
    assert.notEqual(storage.getItem(key), null);
});

void test('restore rejects process state embedded in saved game data', async () => {
    freshObjectRoom();
    game.plname = 'RuntimeFields';
    const programState = game.program_state;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:runtimefields';
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    const saved = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
    saved.state.program_state = { gameover: true };
    storage.setItem(key, encodeSavedGraph(saved));

    assert.equal(restoreGame(game.plname, storage), false);

    assert.equal(game.program_state, programState);
    assert.notEqual(storage.getItem(key), null);
});

void test('restore rejects an object whose required field exists only in prototype metadata', async () => {
    freshObjectRoom();
    game.plname = 'MalformedObject';
    const club = await addInventoryObject(CLUB);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:malformedobject';
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    const saved = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
    assert.ok(Array.isArray(saved.state.inventory));
    const inventory: unknown[] = saved.state.inventory;
    const object = inventory[0];
    assert.ok(isSavedRecord(object));
    delete object.quan;
    Object.defineProperty(object, '__proto__', {
        value: { quan: 1 }, enumerable: true,
    });
    storage.setItem(key, encodeSavedGraph(saved));

    assert.equal(restoreGame(game.plname, storage), false);

    assert.equal(game.inventory[0], club);
    assert.notEqual(storage.getItem(key), null);
});

void test('restore rejects a cached level without its recovery time before changing live state', async () => {
    const { source } = freshConnectedLevels();
    game.plname = 'MissingLevelTime';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:missingleveltime';
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    const saved = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
    const cache = saved.state._levelCache;
    assert.ok(cache instanceof Map);
    const levels: Map<unknown, unknown> = cache;
    const destination = levels.get('0:2');
    assert.ok(isSavedRecord(destination));
    delete destination.savedAt;
    storage.setItem(key, encodeSavedGraph(saved));

    assert.equal(restoreGame(game.plname, storage), false);

    assert.equal(game.level, source);
    assert.notEqual(storage.getItem(key), null);
});

for (const { columns, rows } of [
    { columns: 0, rows: ROWNO },
    { columns: COLNO - 1, rows: ROWNO },
    { columns: COLNO + 1, rows: ROWNO },
    { columns: COLNO, rows: ROWNO - 1 },
    { columns: COLNO, rows: ROWNO + 1 },
]) {
    void test(`restore rejects a ${columns} by ${rows} map before replacing the live level`, async () => {
        const level = freshObjectRoom();
        const hero = game.u;
        game.plname = 'MalformedMap';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:malformedmap';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const saved = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
        assert.ok(isSavedRecord(saved.state.level));
        assert.ok(Array.isArray(saved.state.level.locations));
        const locations: unknown[] = saved.state.level.locations;
        const firstColumn = locations[0];
        assert.ok(Array.isArray(firstColumn));
        const cells: unknown[] = firstColumn;
        const firstCell = cells[0];
        locations.length = columns;
        if (columns > COLNO) locations[COLNO] = firstColumn;
        cells.length = rows;
        if (rows > ROWNO) cells[ROWNO] = firstCell;
        storage.setItem(key, encodeSavedGraph(saved));

        assert.equal(restoreGame(game.plname, storage), false);

        assert.equal(game.level, level);
        assert.equal(game.u, hero);
        assert.notEqual(storage.getItem(key), null);
    });
}

for (const mnum of [-1, MONSTER_NAME.length]) {
    void test(`restore rejects monster species ${mnum} before replacing live entities`, async () => {
        const level = freshObjectRoom();
        const hero = game.u;
        const monster = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        game.plname = 'MalformedSpecies';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:malformedspecies';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const saved = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
        assert.ok(isSavedRecord(saved.state.level));
        assert.ok(Array.isArray(saved.state.level.monsters));
        const monsters: unknown[] = saved.state.level.monsters;
        const savedMonster = monsters[0];
        assert.ok(isSavedRecord(savedMonster));
        savedMonster.mnum = mnum;
        storage.setItem(key, encodeSavedGraph(saved));

        assert.equal(restoreGame(game.plname, storage), false);

        assert.equal(game.level, level);
        assert.equal(game.u, hero);
        assert.equal(level.monsters[0], monster);
        assert.notEqual(storage.getItem(key), null);
    });
}

for (const otyp of [-1, OBJECT_NAMES.length]) {
    void test(`restore rejects object type ${otyp} before replacing the live inventory`, async () => {
        const level = freshObjectRoom();
        const hero = game.u;
        const club = await addInventoryObject(CLUB);
        const inventory = game.inventory;
        game.plname = 'MalformedObjectType';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:malformedobjecttype';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const saved = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
        assert.ok(Array.isArray(saved.state.inventory));
        const savedInventory: unknown[] = saved.state.inventory;
        const savedObject = savedInventory[0];
        assert.ok(isSavedRecord(savedObject));
        savedObject.otyp = otyp;
        storage.setItem(key, encodeSavedGraph(saved));

        assert.equal(restoreGame(game.plname, storage), false);

        assert.equal(game.level, level);
        assert.equal(game.u, hero);
        assert.equal(game.inventory, inventory);
        assert.equal(game.inventory[0], club);
        assert.notEqual(storage.getItem(key), null);
    });
}

void test('restore accepts endpoint metadata indices and absent-species sentinels', async () => {
    freshObjectRoom();
    const firstMonster = await createMonsterAt(0, 11, 10, NO_MINVENT);
    const lastMonster = await createMonsterAt(MONSTER_NAME.length - 1, 12, 10, NO_MINVENT);
    firstMonster.cham = NON_PM;
    const strangeObject = await addInventoryObject(0, { initialize: false, corpsenm: NON_PM });
    const lastObject = await addInventoryObject(OBJECT_NAMES.length - 1);
    game.plname = 'MetadataEndpoints';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);

    assert.equal(restoreGame(game.plname, storage), true);

    assert.ok(game.level);
    assert.equal(game.level.monsters.find(monster => monster.m_id === firstMonster.m_id)?.mnum, 0);
    assert.equal(game.level.monsters.find(monster => monster.m_id === firstMonster.m_id)?.cham, NON_PM);
    assert.equal(game.level.monsters.find(monster => monster.m_id === lastMonster.m_id)?.mnum, MONSTER_NAME.length - 1);
    assert.equal(game.inventory.find(object => object.o_id === strangeObject.o_id)?.otyp, 0);
    assert.equal(game.inventory.find(object => object.o_id === strangeObject.o_id)?.corpsenm, NON_PM);
    assert.equal(game.inventory.find(object => object.o_id === lastObject.o_id)?.otyp, OBJECT_NAMES.length - 1);
});
