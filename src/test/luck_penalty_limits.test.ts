import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { LUCKMIN, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER, WAN_DEATH, WAN_STRIKING } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('killing a tame creature cannot lower natural Luck below its minimum', async () => {
    freshObjectRoom({ hero: { uluck: LUCKMIN } });
    requirePlayingGame(game);
    const pet = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    pet.mtame = 10;
    const wand = await addInventoryObject(WAN_DEATH, { spe: 1 });
    resetInputState().feed(`${wand.invlet}l${' '.repeat(60)}`);

    await rhack('z'.charCodeAt(0));

    assert.ok(pet.dead || pet.mhp <= 0);
    assert.equal(game.u.uluck, LUCKMIN);
});

void test('breaking a Sokoban boulder records cheating without exceeding the Luck penalty limit', async () => {
    const level = freshObjectRoom({ hero: { uluck: LUCKMIN } });
    requirePlayingGame(game);
    level.flags.sokoban_rules = true;
    const boulder = await floorObject(BOULDER, 11, 10);
    const wand = await addInventoryObject(WAN_STRIKING, { spe: 1 });
    resetInputState().feed(`${wand.invlet}l${' '.repeat(60)}`);

    await rhack('z'.charCodeAt(0));

    assert.notEqual(boulder.otyp, BOULDER);
    assert.equal(game.u.uconduct.sokocheat, 1);
    assert.equal(game.u.uluck, LUCKMIN);
});
