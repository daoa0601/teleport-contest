import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP, MM_EMIN, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { requireGameDisplay } from '../js/gstate.js';
import { LEASH } from '../js/object_data.js';
import { untrap } from '../js/untrap.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function messageLine() {
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'the display must contain a message row');
    return row.map(cell => cell.ch).join('').trimEnd();
}
void test('a failed bear-trap rescue makes the injured pet cry out', async () => {
    const level = freshObjectRoom();
    addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    pet.mtrapped = 1;
    pet.mhp = pet.mhpmax = 40;
    const spentTurn = await untrap({
        chooseDirection: () => ({ dx: 1, dy: 0, dz: 0, key: 'l' }),
        random: () => 1,
        luckRandom: () => 1,
    });
    assert.equal(spentTurn, true);
    assert.match(await messageLine(), /Whoops\.\.\.  The little dog (?:yelps|growls)!$/);
    assert.ok(pet.mhp >= 36 && pet.mhp < 40, `pet HP after rescue: ${pet.mhp}`);
    assert.equal(pet.mtrapped, 1);
});
void test('a failed bear-trap rescue releases and redraws a pet that goes wild', async () => {
    const level = freshObjectRoom({ flags: { hilite_pet: true } });
    addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    pet.mtrapped = 1;
    pet.mtame = 1;
    pet.mhp = pet.mhpmax = 40;
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    // A sleeping pet stays silent, leaving only the release message.
    pet.msleeping = 1;
    newsym(pet.mx, pet.my);
    await flush_screen();
    const cell = requireGameDisplay().grid[pet.my + 1]?.[pet.mx - 1];
    assert.ok(cell, 'the pet must have a displayed map cell');
    assert.equal(cell.attr & 1, 1, 'a tame pet starts highlighted');
    await untrap({
        chooseDirection: () => ({ dx: 1, dy: 0, dz: 0, key: 'l' }),
        random: () => 1,
        luckRandom: () => 1,
    });
    assert.equal(pet.mtame, 0);
    assert.equal(pet.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.match(await messageLine(), /The little dog pulls free of its leash!$/);
    assert.equal(cell.attr & 1, 0, 'a wild pet loses its map highlight');
});
void test('a failed bear-trap rescue does not add abuse history to a minion', async () => {
    const level = freshObjectRoom();
    addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    const pet = await createMonsterAt('Angel', 11, 10, MM_EMIN | NO_MINVENT);
    initializePet(pet);
    const history = pet.edog;
    assert.ok(history, 'the tame monster has pet history');
    pet.isminion = true;
    pet.mtame = 10;
    pet.mtrapped = 1;
    pet.mhp = pet.mhpmax = 40;
    await untrap({
        chooseDirection: () => ({ dx: 1, dy: 0, dz: 0, key: 'l' }),
        random: () => 1,
        luckRandom: () => 1,
    });
    assert.equal(history.abuse, 0);
    assert.equal(pet.mtame, 9);
});
//# sourceMappingURL=untrap_pet_abuse.test.js.map