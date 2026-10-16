import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
async function contactTurn(species, enemy, resistance = 0) {
    freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    const pet = await createMonsterAt(species, 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    pet.m_lev = 30;
    pet.mhp = pet.mhpmax = species === 'large dog' ? 10 : 100;
    pet.mintrinsics = resistance;
    pet.movement = 12;
    const target = await createMonsterAt(enemy, 13, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    target.mpeaceful = 0;
    target.mhp = target.mhpmax = 100;
    target.movement = 0;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /dog|golem|elemental|rust monster|jelly|cold|iron|sad feeling/, limit: 12 });
    await finishAtCommandInput(input, moveloop_core, /.*/);
    return { pet, target };
}
void test('a pet with acquired cold resistance attacks a jelly whose passive would otherwise be lethal', async () => {
    const { pet, target } = await contactTurn('large dog', 'blue jelly', 0x02);
    assert.ok(target.mhp < 100, 'The resistant dog should bite the adjacent jelly');
    assert.equal(pet.mhp, 10, 'The jelly cannot freeze a cold-resistant pet');
});
for (const species of ['paper golem', 'straw golem']) {
    void test(`a pet ${species} avoids a fire elemental even with enough HP to survive ordinary fire damage`, async () => {
        const { pet, target } = await contactTurn(species, 'fire elemental');
        assert.equal(target.mhp, 100, 'The combustible golem must avoid initiating contact');
        assert.equal(pet.mhp, 100);
        assert.equal(!!pet.dead, false);
    });
}
void test('an iron golem pet avoids the rust monster passive which would destroy its body', async () => {
    const { pet, target } = await contactTurn('iron golem', 'rust monster');
    assert.equal(target.mhp, 100, 'The iron golem must avoid initiating contact');
    assert.equal(pet.mhp, 100);
    assert.equal(!!pet.dead, false);
});
//# sourceMappingURL=pet_passive_safety.test.js.map