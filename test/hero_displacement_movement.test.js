import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { D_ISOPEN, DOOR, FOUNTAIN, M_AP_OBJECT, MM_NOGRP, NO_MINVENT, PIT, STONE } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { addTrap } from './support/level-state.js';
for (const blocked of [false, true]) {
    void test(`displacing a peaceful giant ${blocked ? 'stops when its boulder cannot move' : 'pushes its boulder before swapping'}`, async () => {
        const level = freshObjectRoom({ flags: { pickup: false } });
        const giant = await createMonsterAt('titan', 11, 10, MM_NOGRP | NO_MINVENT);
        giant.mpeaceful = 1;
        await addInventoryObject(ROCK, { quan: 30 });
        const boulder = await floorObject(BOULDER, 11, 10);
        if (blocked)
            level.requireAt(12, 10).typ = STONE;
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => {
            messages.push(game._pending_message);
        };
        installPagerInput(input, { expected: /boulder/, limit: 4 });
        initRng(1n);
        await rhack('l'.charCodeAt(0));
        assert.deepEqual([game.u.ux, giant.mx, boulder.ox], blocked ? [10, 11, 11] : [11, 10, 12]);
        assert.equal(game.context.move, Number(!blocked));
        if (blocked)
            assert.match(game._lastPlineMessage ?? '', /You try to move the boulder, but in vain\./);
        else {
            assert.ok(messages.some(message => /With great effort you move the boulder\./.test(message)));
            assert.match(game._lastPlineMessage ?? '', /You swap places with the peaceful titan\./);
        }
    });
}
void test('the hero must fit a diagonal gap before checking whether the pet can swap through it', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('titan');
    const horse = await createMonsterAt('horse', 11, 9, MM_NOGRP | NO_MINVENT);
    initializePet(horse);
    level.requireAt(10, 9).typ = STONE;
    level.requireAt(11, 10).typ = STONE;
    initRng(1n);
    await rhack('u'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy, horse.mx, horse.my], [10, 10, 11, 9]);
    assert.equal(game.context.move, 0);
    assert.equal(game._lastPlineMessage, 'Your body is too large to fit through.');
});
void test('tight shoulders stop displacement before the doorway-exit warning', async () => {
    const level = freshObjectRoom({ flags: { mention_walls: true } });
    installPolymorphedHero('titan');
    const pet = await createMonsterAt('kitten', 11, 9, NO_MINVENT);
    initializePet(pet);
    level.requireAt(10, 10).typ = DOOR;
    level.requireAt(10, 10).doormask = D_ISOPEN;
    level.requireAt(10, 9).typ = STONE;
    level.requireAt(11, 10).typ = STONE;
    initRng(1n);
    await rhack('u'.charCodeAt(0));
    assert.equal(game._lastPlineMessage, 'Your body is too large to fit through.');
    assert.equal(game.context.move, 0);
    assert.deepEqual([game.u.ux, game.u.uy, pet.mx, pet.my], [10, 10, 11, 9]);
});
void test('an intact destination doorway stops displacement before tight shoulders', async () => {
    const level = freshObjectRoom({ flags: { mention_walls: true } });
    installPolymorphedHero('titan');
    const pet = await createMonsterAt('kitten', 11, 9, NO_MINVENT);
    initializePet(pet);
    level.requireAt(11, 9).typ = DOOR;
    level.requireAt(11, 9).doormask = D_ISOPEN;
    level.requireAt(10, 9).typ = STONE;
    level.requireAt(11, 10).typ = STONE;
    initRng(1n);
    await rhack('u'.charCodeAt(0));
    assert.equal(game._lastPlineMessage, "You can't move diagonally into an intact doorway.");
    assert.equal(game.context.move, 0);
    assert.deepEqual([game.u.ux, game.u.uy, pet.mx, pet.my], [10, 10, 11, 9]);
});
void test('a displaced gremlin splits in the departure fountain before the hero enters a pit', async () => {
    const level = freshObjectRoom({ flags: { pickup: false } });
    level.requireAt(10, 10).typ = FOUNTAIN;
    const gremlin = await createMonsterAt('gremlin', 11, 10, NO_MINVENT);
    initializePet(gremlin);
    gremlin.mhp = gremlin.mhpmax = 20;
    const pit = addTrap(level, PIT, 11, 10);
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /swap places|multiplies|fountain|pit/, limit: 8 });
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(gremlin.mx, 10);
    assert.equal(gremlin.mhp, 10);
    assert.equal(level.monsters.filter(monster => monster.mnum === gremlin.mnum).length, 2);
    assert.equal(pit.tseen, true);
    assert.ok((game.u.utrap ?? 0) > 0, 'the hero enters the pit after the monster arrival');
    assert.ok(messages.some(message => /multiplies/.test(message)), 'splitting is announced before the hero trap');
    assert.match(game._lastPlineMessage ?? '', /fall into a pit/);
});
void test('a spider hides under cover after swapping with a pet', async () => {
    freshObjectRoom({ flags: { pickup: false } });
    installPolymorphedHero('cave spider');
    const pet = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(pet);
    await floorObject(ROCK, 11, 10);
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, pet.mx], [11, 10]);
    assert.equal(game.u.uundetected, 1);
});
void test('a mimic reveals its disguise even when a trapped pet refuses the swap', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    installPolymorphedHero('small mimic');
    game.u.m_ap_type = M_AP_OBJECT;
    game.u.mappearance = BOULDER;
    const pet = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(pet);
    pet.mtrapped = 1;
    addTrap(level, PIT, 11, 10);
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, pet.mx], [10, 11]);
    assert.equal(game.u.m_ap_type, 0);
    assert.equal(game.u.umoved, false);
    assert.equal(game.context.move, 1);
    assert.match(game._lastPlineMessage ?? '', /can't move out of a pit/);
});
//# sourceMappingURL=hero_displacement_movement.test.js.map