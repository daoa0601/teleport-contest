import test from 'node:test';
import assert from 'node:assert/strict';

import { mksobj } from '../js/mklev.js';
import {
    BAG_OF_HOLDING, BAG_OF_TRICKS, CHEST, CORPSE, ICE_BOX, LARGE_BOX,
    OILSKIN_SACK, SACK, WAN_CANCELLATION,
} from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { objectTimers } from '../js/object_timers.js';
import { freshObjectRoom } from './support/object-room.js';

// C mkobj.c:mkbox_cnts(): a box's contents are drawn after its lock state,
// with per-type ceilings (locked chests 7 / unlocked 5, large boxes 5 / 3,
// ice boxes 20, sacks and bags of holding 1 item), and initial-inventory
// sacks stay empty outside level generation.
void test('generated boxes keep their native content ceilings', async () => {
    freshObjectRoom({ gameplaySeed: 1213n });

    const chestCounts: number[] = [];
    const largeBoxCounts: number[] = [];
    const rollBox = async (typ: number, locked: boolean | undefined) => {
        let box;
        let tries = 0;
        do {
            box = await mksobj(typ, true, false);
        } while (locked !== undefined && !!box.olocked !== locked
            && ++tries < 500);
        assert.ok(locked === undefined || !!box.olocked === locked,
            `could not roll a ${locked ? '' : 'un'}locked box of type ${typ}`);
        return box;
    };

    for (let i = 0; i < 400; i++) {
        const chest = await rollBox(CHEST, i % 2 === 0);
        chestCounts.push((chest.contents ?? []).length);
        const largeBox = await rollBox(LARGE_BOX, i % 2 === 0);
        largeBoxCounts.push((largeBox.contents ?? []).length);
        const iceBox = await rollBox(ICE_BOX, undefined);
        assert.ok((iceBox.contents ?? []).length <= 20);
    }

    assert.ok(chestCounts.every(count => count <= 7));
    // Locked chests reach their extra slots with this seed's rolls.
    assert.ok(chestCounts.some(count => count === 6 || count === 7),
        'a locked chest can hold six or seven items');
    assert.ok(largeBoxCounts.every(count => count <= 5));
});

void test('ice boxes hold timer-free fresh corpses', async () => {
    freshObjectRoom({ gameplaySeed: 511n });

    let corpses = 0;
    for (let i = 0; i < 60; i++) {
        const box = await mksobj(ICE_BOX, true, false);
        for (const item of box.contents ?? []) {
            corpses++;
            assert.equal(item.otyp, CORPSE);
            assert.equal(item.age, 0,
                'a corpse stored in an ice box is as fresh as at death');
            assert.equal(objectTimers(item).length, 0,
                'freezing stops a stored corpse from rotting or reviving');
        }
    }
    assert.ok(corpses > 0, 'this seed fills at least one ice box');
});

void test('a starting sack stays empty while a bag of holding may not', async () => {
    // C: the moves <= 1 && !in_mklev guard only empties sacks; the hero's
    // initial-inventory sack therefore never carries shop stock.
    freshObjectRoom({ gameplaySeed: 77n, moves: 1 });

    for (let i = 0; i < 100; i++) {
        assert.equal((await mksobj(SACK, true, false)).contents?.length ?? 0, 0);
        assert.equal((await mksobj(OILSKIN_SACK, true, false)).contents?.length ?? 0, 0);
    }
    let filled = 0;
    for (let i = 0; i < 100; i++) {
        const bag = await mksobj(BAG_OF_HOLDING, true, false);
        const items = bag.contents ?? [];
        assert.ok(items.length <= 1);
        if (items.length) filled++;
    }
    assert.ok(filled > 0, 'this seed fills at least one bag of holding');
});

void test('a generated bag of holding substitutes its dangerous contents', async () => {
    // C mkbox_cnts(): bags of holding replace nested bags of holding and
    // bags of tricks with plain sacks, and cancellation wands with another
    // wand, so such items never ride inside one.
    freshObjectRoom({ gameplaySeed: 2024n });

    for (let i = 0; i < 300; i++) {
        const bag = await mksobj(BAG_OF_HOLDING, true, false);
        for (const item of bag.contents ?? []) {
            assert.ok(item.otyp !== BAG_OF_HOLDING && item.otyp !== BAG_OF_TRICKS,
                'no nested container bag inside a bag of holding');
            assert.ok(item.otyp !== WAN_CANCELLATION,
                'no cancellation wand inside a bag of holding');
        }
    }
});
