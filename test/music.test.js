import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { playInstrument } from '../js/music.js';
import {
    BUGLE, FIRE_HORN, FROST_HORN, LEATHER_DRUM, MAGIC_FLUTE, WOODEN_HARP,
} from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { applyInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

function instrument(otyp, spe = 0) {
    return Object.assign(mksobj(otyp, true, false), {
        spe,
        charges: { current: spe, recharged: 0 },
    });
}

test('a charged magic flute puts nearby monsters to sleep', async () => {
    freshGameplayRoom();
    game.u.ulevel = 5;
    const target = await createMonsterAt('giant ant', 11, 10);
    const flute = instrument(MAGIC_FLUTE, 2);
    pushKeys('y          ');

    await playInstrument(flute);

    assert.equal(flute.spe, 1);
    assert.equal(target.mcanmove, 0);
    assert.ok(target.mfrozen > 0);
});

test('a skilled harp player calms nearby nymphs', async () => {
    freshGameplayRoom();
    game.u.ulevel = 30;
    const nymph = await createMonsterAt('water nymph', 11, 10);
    nymph.mpeaceful = 0;
    pushKeys('y          ');

    await playInstrument(instrument(WOODEN_HARP));

    assert.equal(nymph.mpeaceful, 1);
});

test('a bugle calls every soldier on the level to battle', async () => {
    freshGameplayRoom();
    const soldier = await createMonsterAt('soldier', 18, 12);
    Object.assign(soldier, {
        mpeaceful: 1, msleeping: 1, mcanmove: 0, mfrozen: 12,
    });
    pushKeys('y          ');

    await playInstrument(instrument(BUGLE));

    assert.equal(soldier.mpeaceful, 0);
    assert.equal(soldier.msleeping, 0);
    assert.equal(soldier.mcanmove, 1);
    assert.equal(soldier.mfrozen, 0);
});

test('applying a leather drum plays it', async () => {
    freshGameplayRoom();
    const drum = addInventoryItem(instrument(LEATHER_DRUM));
    await applyInventoryObject(drum, '          ');

    assert.ok(game.u.deafTurns >= 30);
    assert.equal(game.context.move, 1);
});

test('a fire horn shoots a ray and spends one charge', async () => {
    freshGameplayRoom();
    const target = await createMonsterAt('giant ant', 11, 10);
    target.mhp = target.mhpmax = 100;
    target.mac = 100;
    const horn = instrument(FIRE_HORN, 2);
    pushKeys('y          l          ');

    await playInstrument(horn);

    assert.equal(horn.spe, 1);
    assert.ok(target.mhp < 100);
    assert.equal(horn.typeKnown, true);
});

test('cold resistance protects against a frost horn aimed at yourself',
    async () => {
        freshGameplayRoom();
        game.u.coldResistance = true;
        game.u.uhp = game.u.uhpmax = 100;
        const horn = instrument(FROST_HORN, 1);
        pushKeys('y          .          ');

        await playInstrument(horn);

        assert.equal(game.u.uhp, 100);
        assert.equal(horn.spe, 0);
        assert.equal(horn.typeKnown, true);
    });

test('an empty fire horn behaves like an ordinary horn', async () => {
    freshGameplayRoom();
    const target = await createMonsterAt('giant ant', 11, 10);
    target.msleeping = 1;
    const horn = instrument(FIRE_HORN);
    pushKeys('y          ');

    await playInstrument(horn);

    assert.equal(target.msleeping, 0);
    assert.equal(horn.typeKnown, undefined);
});
