import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBonesPayload } from '../js/bones_validation.js';
import { GameMap, makeLocation } from '../js/game.js';
import { createObjectBase } from '../js/object_constructor.js';
import { CHEST, FOOD_RATION, ROCK } from '../js/object_data.js';
import { encodeSavedGraph } from '../js/saved_graph.js';

void test('bones restore a usable map and preserve a contained object back-reference', () => {
    const level = new GameMap();
    const chest = createObjectBase(CHEST, 1, 1);
    const ration = createObjectBase(FOOD_RATION, 2, 1);
    chest.where = 'floor';
    chest.ox = chest.oy = 10;
    chest.contents = [ration];
    ration.where = 'contained';
    ration.container = chest;
    level.objects[10] = [];
    level.objects[10][10] = [chest];
    const encoded = encodeSavedGraph({
        version: 10, level, stairs: null, heroTrack: [], fruits: [],
    });

    const restored = decodeBonesPayload(encoded, 10);

    const restoredChest = restored.level.objects[10]?.[10]?.[0];
    assert.ok(restoredChest);
    assert.equal(restoredChest.contents?.[0]?.container, restoredChest);
    assert.ok(restored.level.at(10, 10));
    assert.equal(restored.level.at(-1, 0), null);
});

void test('bones reject an invalid terrain field before exposing a map', () => {
    const encoded = encodeSavedGraph({
        version: 10,
        level: { ...new GameMap(), locations: [[{ ...makeLocation(), typ: 'lava' }]] },
        stairs: null, heroTrack: [], fruits: [],
    });

    assert.throws(() => decodeBonesPayload(encoded, 10), /invalid locations/);
});

void test('a cyclic object reference cannot masquerade as its monster carrier', () => {
    const malformed: Record<string, unknown> = { ...createObjectBase(ROCK, 1, 1) };
    malformed.ocarry = malformed;
    const encoded = encodeSavedGraph({
        version: 10,
        level: { ...new GameMap(), objects: [[[malformed]]] },
        stairs: null, heroTrack: [], fruits: [],
    });

    assert.throws(() => decodeBonesPayload(encoded, 10), /invalid objects/);
});
