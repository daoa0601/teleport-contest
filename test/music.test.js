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
import { liveMonster } from './support/monsters.js';
import { freshWeaponArena } from './support/weapon-arena.js';

function instrument(otyp, spe = 0) {
    return Object.assign(mksobj(otyp, true, false), {
        spe,
        charges: { current: spe, recharged: 0 },
    });
}

test('a charged magic flute puts nearby monsters to sleep', async () => {
    const level = freshWeaponArena();
    game.u.ulevel = 5;
    const target = liveMonster({ mnum: 0, x: 11, y: 10 });
    level.monsters = [target];
    const flute = instrument(MAGIC_FLUTE, 2);
    pushKeys('y          ');

    await playInstrument(flute);

    assert.equal(flute.spe, 1);
    assert.equal(target.mcanmove, 0);
    assert.ok(target.mfrozen > 0);
});

test('a skilled harp player calms nearby nymphs', async () => {
    const level = freshWeaponArena();
    game.u.ulevel = 30;
    const nymph = liveMonster({
        mnum: 68, x: 11, y: 10, mpeaceful: 0,
    });
    level.monsters = [nymph];
    pushKeys('y          ');

    await playInstrument(instrument(WOODEN_HARP));

    assert.equal(nymph.mpeaceful, 1);
});

test('a bugle calls every soldier on the level to battle', async () => {
    const level = freshWeaponArena();
    const soldier = liveMonster({
        mnum: 277, x: 18, y: 12,
        mpeaceful: 1,
        msleeping: 1,
        mcanmove: 0,
        mfrozen: 12,
    });
    level.monsters = [soldier];
    pushKeys('y          ');

    await playInstrument(instrument(BUGLE));

    assert.equal(soldier.mpeaceful, 0);
    assert.equal(soldier.msleeping, 0);
    assert.equal(soldier.mcanmove, 1);
    assert.equal(soldier.mfrozen, 0);
});

test('applying a leather drum plays it', async () => {
    freshWeaponArena();
    const drum = addInventoryItem(instrument(LEATHER_DRUM));
    await applyInventoryObject(drum, '          ');

    assert.ok(game.u.deafTurns >= 30);
    assert.equal(game.context.move, 1);
});

test('a fire horn shoots a ray and spends one charge', async () => {
    const level = freshWeaponArena();
    const target = liveMonster({
        mnum: 0, x: 11, y: 10, hitPoints: 100, mac: 100,
    });
    level.monsters = [target];
    const horn = instrument(FIRE_HORN, 2);
    pushKeys('y          l          ');

    await playInstrument(horn);

    assert.equal(horn.spe, 1);
    assert.ok(target.mhp < 100);
    assert.equal(horn.typeKnown, true);
});

test('cold resistance protects against a frost horn aimed at yourself',
    async () => {
        freshWeaponArena();
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
    const level = freshWeaponArena();
    const target = liveMonster({
        mnum: 0, x: 11, y: 10, msleeping: 1,
    });
    level.monsters = [target];
    const horn = instrument(FIRE_HORN);
    pushKeys('y          ');

    await playInstrument(horn);

    assert.equal(target.msleeping, 0);
    assert.equal(horn.typeKnown, undefined);
});
