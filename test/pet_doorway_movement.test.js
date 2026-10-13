import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DOOR, DART_TRAP, D_CLOSED, D_ISOPEN, D_LOCKED, MM_NOGRP, NO_MINVENT, PARANOID_TRAP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { initRng } from '../js/rng.js';
import { DAGGER, LONG_SWORD, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const doorway of ['entry', 'exit']) {
    void test(`a pet cannot be displaced diagonally at an intact doorway ${doorway}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', 11, 9, MM_NOGRP | NO_MINVENT);
        initializePet(dog, { state: game });
        const cell = doorway === 'entry' ? level.requireAt(11, 9) : level.requireAt(10, 10);
        cell.typ = DOOR;
        cell.doormask = D_ISOPEN;
        initRng(1n);
        await rhack('u'.charCodeAt(0));
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.equal(dog.mx, 11);
        assert.equal(dog.my, 9);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, '');
    });
}
for (const doorMask of [D_CLOSED, D_LOCKED]) {
    for (const carryingDagger of [false, true]) {
        void test(`an amorphous hero swaps diagonally into a ${doorMask === D_LOCKED ? 'locked' : 'closed'} door with ${carryingDagger ? 'a dagger' : 'empty inventory'}`, async () => {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            installPolymorphedHero('gray ooze');
            if (carryingDagger)
                await addInventoryObject(DAGGER);
            const dog = await createMonsterAt('little dog', 11, 9, MM_NOGRP | NO_MINVENT);
            initializePet(dog, { state: game });
            const door = level.requireAt(11, 9);
            door.typ = DOOR;
            door.doormask = doorMask;
            initRng(1n);
            await rhack('u'.charCodeAt(0));
            assert.deepEqual([game.u.ux, game.u.uy], [11, 9]);
            assert.deepEqual([dog.mx, dog.my], [10, 10]);
            assert.equal(game.context.move, 1);
            assert.equal(door.doormask, doorMask, 'oozing does not open the door');
            assert.match(game._pending_message, /You ooze under the door\./);
            assert.match(game._lastPlineMessage ?? '', /swap places with your little dog/);
        });
    }
}
for (const originDoorMask of [D_CLOSED, D_ISOPEN]) {
    void test(`oozing into a closed door still forbids a diagonal exit from an intact ${originDoorMask === D_CLOSED ? 'closed' : 'open'} doorway`, async () => {
        const level = freshObjectRoom({ flags: { mention_walls: true } });
        requirePlayingGame(game);
        installPolymorphedHero('gray ooze');
        const dog = await createMonsterAt('little dog', 11, 9, MM_NOGRP | NO_MINVENT);
        initializePet(dog, { state: game });
        const origin = level.requireAt(10, 10);
        origin.typ = DOOR;
        origin.doormask = originDoorMask;
        const destination = level.requireAt(11, 9);
        destination.typ = DOOR;
        destination.doormask = D_CLOSED;
        const messages = [];
        resetInputState().display = {
            async readKey() {
                assert.equal(game._pending_message, 'You ooze under the door.');
                messages.push(game._pending_message);
                return 32;
            },
        };
        initRng(1n);
        await rhack('u'.charCodeAt(0));
        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.deepEqual([dog.mx, dog.my], [11, 9]);
        assert.equal(game.context.move, 0);
        assert.ok(messages.includes('You ooze under the door.'));
        assert.match(game._lastPlineMessage ?? '', /move diagonally out of an intact doorway/);
    });
}
for (const inventory of ['empty sack', 'filled sack', 'long sword']) {
    void test(`an amorphous hero's ${inventory} determines whether it fits under a door`, async () => {
        const level = freshObjectRoom({ flags: { autoopen: false } });
        requirePlayingGame(game);
        installPolymorphedHero('gray ooze');
        if (inventory === 'long sword')
            await addInventoryObject(LONG_SWORD);
        else {
            const sack = await addInventoryObject(SACK, { initialize: false });
            if (inventory === 'filled sack')
                await addCreatedObjectToContainer(sack, await knownObject(DAGGER));
        }
        const door = level.requireAt(11, 9);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        await rhack('u'.charCodeAt(0));
        const fits = inventory === 'empty sack';
        assert.deepEqual([game.u.ux, game.u.uy], fits ? [11, 9] : [10, 10]);
        assert.equal(game.context.move, Number(fits));
        assert.equal(door.doormask, D_CLOSED);
        if (fits)
            assert.equal(game._pending_message, 'You ooze under the door.');
    });
}
for (const doorMask of [D_CLOSED, D_LOCKED]) {
    for (const direction of ['l', 'u']) {
        void test(`an amorphous hero oozes ${direction === 'u' ? 'diagonally' : 'orthogonally'} under a ${doorMask === D_LOCKED ? 'locked' : 'closed'} door without a pet`, async () => {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            installPolymorphedHero('gray ooze');
            const y = direction === 'u' ? 9 : 10;
            const door = level.requireAt(11, y);
            door.typ = DOOR;
            door.doormask = doorMask;
            await rhack(direction.charCodeAt(0));
            assert.deepEqual([game.u.ux, game.u.uy], [11, y]);
            assert.equal(game.context.move, 1);
            assert.equal(door.doormask, doorMask);
            assert.equal(game._pending_message, 'You ooze under the door.');
        });
    }
}
void test('an amorphous hero can decline a trap inside a closed door before swapping with a pet', async () => {
    const level = freshObjectRoom({ flags: { paranoia_bits: PARANOID_TRAP } });
    requirePlayingGame(game);
    installPolymorphedHero('gray ooze');
    const dog = await createMonsterAt('little dog', 11, 9, MM_NOGRP | NO_MINVENT);
    initializePet(dog, { state: game });
    const door = level.requireAt(11, 9);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    addTrap(level, DART_TRAP, 11, 9, { tseen: true });
    initRng(1n);
    pushKeys('n');
    await rhack('u'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual([dog.mx, dog.my], [11, 9]);
    assert.equal(game.context.move, 0);
    assert.match(game._lastPlineMessage ?? '', /Really .* onto that dart trap\?/);
});
//# sourceMappingURL=pet_doorway_movement.test.js.map