import assert from 'node:assert/strict';
import test from 'node:test';

import { CHEST } from '../js/object_data.js';
import { untrap } from '../js/untrap.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const personalName = 'Treasure'.repeat(7) + 'Vaults';

void test('checking an empty locked chest shortens its inscription and preserves the trap question', async () => {
    freshObjectRoom();
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, tknown: false, blessed: true, greased: true,
        cknown: true, lknown: true, olocked: true, oextra: { oname: personalName },
    });
    let question = '';

    await untrap({ chooseDirection: () => ({ key: '.', dx: 0, dy: 0, dz: 0 }),
        ask: async prompt => { question = prompt; return 'q'; } });

    assert.equal(question, 'There is an empty blessed locked greased chest named Treasure... here.  Check it for traps?');
    assert.equal(chest.oextra?.oname, personalName);
    assert.equal(chest.greased, true);
    assert.equal(chest.bknown, true);
    assert.equal(chest.cknown, true);
    assert.equal(chest.lknown, true);
});

void test('checking a chest keeps its full inscription when the question fits', async () => {
    freshObjectRoom();
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, tknown: false, bknown: false, oextra: { oname: personalName },
    });
    let question = '';

    await untrap({ chooseDirection: () => ({ key: '.', dx: 0, dy: 0, dz: 0 }),
        ask: async prompt => { question = prompt; return 'q'; } });

    assert.equal(question, `There is a chest named ${personalName} here.  Check it for traps?`);
    assert.equal(chest.oextra?.oname, personalName);
});

void test('disarming a known chest trap keeps the full inscription without inventory details', async () => {
    freshObjectRoom();
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, otrapped: true, tknown: true, blessed: true, greased: true,
        cknown: true, lknown: true, olocked: true, oextra: { oname: personalName },
    });
    let question = '';

    await untrap({ chooseDirection: () => ({ key: '.', dx: 0, dy: 0, dz: 0 }),
        ask: async prompt => { question = prompt; return 'q'; } });

    assert.equal(question, `Disarm this chest named ${personalName}`);
    assert.equal(chest.oextra?.oname, personalName);
});
