import test from 'node:test';
import assert from 'node:assert/strict';
import { mkcorpstat } from '../js/mkobj.js';
import { initializePet } from '../js/dog.js';
import { CORPSE } from '../js/object_data.js';
import { splitObjectStack } from '../js/mkobj.js';

import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';

void test('split corpse stacks retain independent monster traits for revival', async () => {
    await freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    troll.name = 'First';
    const corpse = await mkcorpstat(CORPSE, troll, null, 12, 10, 0);
    corpse.quan = 2;

    const split = splitObjectStack(corpse, 1);
    const splitTraits = split?.oextra?.omonst;
    assert.ok(splitTraits);
    splitTraits.name = 'Second';

    assert.equal(corpse.oextra?.omonst?.name, 'First');
});

void test('split corpses keep separate pet goals and bones alignment history', async () => {
    await freshObjectRoom();
    const troll = await createMonsterAt('troll', 12, 10);
    initializePet(troll);
    assert.ok(troll.edog);
    troll.edog.ogoal = { x: 7, y: 9 };
    troll.mextra = {
        ...troll.mextra,
        ebones: {
            parentmid: troll.m_id, role: 0, race: 0,
            oldalign: { type: 0, record: 4 },
            deathlevel: 7, luck: 0, mnum: troll.mnum,
            female: false, demigod: false, crowned: false,
        },
    };
    const corpse = await mkcorpstat(CORPSE, troll, null, 12, 10, 0);
    corpse.quan = 2;

    const split = splitObjectStack(corpse, 1);
    const splitTraits = split?.oextra?.omonst;
    assert.ok(splitTraits?.edog);
    assert.ok(splitTraits.mextra?.ebones);
    splitTraits.edog.ogoal.x = 15;
    splitTraits.mextra.ebones.oldalign.record = -2;

    assert.equal(corpse.oextra?.omonst?.edog?.ogoal.x, 7);
    assert.equal(corpse.oextra?.omonst?.mextra?.ebones?.oldalign.record, 4);
});
