import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT, STONE } from '../js/const.js';
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
//# sourceMappingURL=hero_displacement_movement.test.js.map