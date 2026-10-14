import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { initializePet } from '../js/dog.js';
import { LEASH } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('apply attaches a leash to a sleeping pet and removes it on a second use', async () => {
    freshPlayableRoom();
    const pet = await createMonsterAt('kitten', game.u.ux + 1, game.u.uy);
    initializePet(pet);
    pet.msleeping = 1;
    const leash = await addInventoryObject(LEASH);

    await applyInventoryObject(leash, 'l');

    assert.equal(leash.leashmon, pet.m_id);
    assert.equal(pet.mleashed, 1);
    assert.equal(pet.msleeping, 0);
    assert.equal(game.context.move, 1);
    await applyInventoryObject(leash, 'l');
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
    assert.match(game._pending_message, /remove the leash/);
});

void test('a cursed leash stays attached and reveals its curse when removal is attempted', async () => {
    freshPlayableRoom();
    const pet = await createMonsterAt('kitten', game.u.ux + 1, game.u.uy);
    initializePet(pet);
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { cursed: true, bknown: false, leashmon: pet.m_id });

    await applyInventoryObject(leash, 'l');

    assert.equal(leash.leashmon, pet.m_id);
    assert.equal(leash.bknown, true);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'The leash would not come off!');
});

void test('trying to leash empty space takes time and clears an invisible marker', async () => {
    const level = freshPlayableRoom();
    level.requireAt(game.u.ux + 1, game.u.uy).remembered_glyph = { kind: 'invisible', ch: 'I', color: 0 };
    const leash = await addInventoryObject(LEASH);

    await applyInventoryObject(leash, 'l');

    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'There is no creature there.');
    assert.notEqual(level.requireAt(game.u.ux + 1, game.u.uy).remembered_glyph?.kind, 'invisible');
});

void test('a third leash cannot be attached and never asks for a direction', async () => {
    freshPlayableRoom();
    await addInventoryObject(LEASH, { leashmon: 41 });
    await addInventoryObject(LEASH, { leashmon: 42 });
    const leash = await addInventoryObject(LEASH);

    await applyInventoryObject(leash);

    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'You cannot leash any more pets.');
});

void test('a tame unsolid creature cannot hold a leash', async () => {
    freshPlayableRoom();
    const pet = await createMonsterAt('air elemental', game.u.ux + 1, game.u.uy);
    initializePet(pet);
    const leash = await addInventoryObject(LEASH);

    await applyInventoryObject(leash, 'l');

    assert.equal(pet.mleashed ?? 0, 0);
    assert.equal(leash.leashmon ?? 0, 0);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'The leash would just fall off.');
});

for (const cursed of [false, true]) {
    void test(`walking too far from a pet ${cursed ? 'chokes it with a cursed leash' : 'releases an ordinary leash'}`, async () => {
        freshPlayableRoom({ left: 2, right: 25 });
        const pet = await createMonsterAt('kitten', game.u.ux + 1, game.u.uy);
        initializePet(pet);
        const leash = await addInventoryObject(LEASH, { cursed });
        await applyInventoryObject(leash, 'l');
        pet.mx = game.u.ux - 5;
        pet.my = game.u.uy;

        pushKeys('          ');
        await rhack('l'.charCodeAt(0));

        assert.equal(leash.leashmon, 0);
        assert.equal(pet.mleashed, 0);
        assert.equal((pet.mhp ?? 0) <= 0, cursed);
        if (cursed) assert.equal(game.u.uconduct?.killer, 1);
        else assert.match(game._pending_message, /leash snaps loose/);
    });
}
