import assert from 'node:assert/strict';
import test from 'node:test';

import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DIAMOND, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a unicorn accepts an identified aligned gem thrown from several squares away', async () => {
    const level = freshObjectRoom({ right: 30, hero: { uluck: 0 } });
    level.flags.noteleport = true;
    const unicorn = await createMonsterAt('gray unicorn', 14, 10);
    unicorn.mpeaceful = 0;
    const gem = await addInventoryObject(DIAMOND);

    await throwInventoryObject(gem, 'l', ' '.repeat(20));

    assert.equal(game.u.uluck, 5);
    assert.equal(gem.where, 'minvent');
    assert.equal(gem.ocarry, unicorn);
    assert.equal(unicorn.mpeaceful, 1);
});

void test('a tame unicorn catches and drops a distant gem without taking damage', async () => {
    freshObjectRoom({ right: 30, hero: { uluck: 0 } });
    const unicorn = await createMonsterAt('gray unicorn', 14, 10);
    initializePet(unicorn, { state: game });
    unicorn.mhp = unicorn.mhpmax = 100;
    const gem = await addInventoryObject(DIAMOND);

    await throwInventoryObject(gem, 'l', ' '.repeat(20));

    assert.equal(unicorn.mhp, 100);
    assert.equal(game.u.uluck, 0);
    assert.equal(gem.where, 'floor');
    assert.equal(gem.ox, 14);
    assert.equal(gem.oy, 10);
});

void test('a unicorn rejects identified glass thrown from a distance but becomes peaceful', async () => {
    const level = freshObjectRoom({ right: 30 });
    level.flags.noteleport = true;
    const unicorn = await createMonsterAt('gray unicorn', 14, 10);
    unicorn.mpeaceful = 0;
    const glass = await addInventoryObject(WORTHLESS_PIECE_OF_WHITE_GLASS);

    await throwInventoryObject(glass, 'l', ' '.repeat(20));

    assert.equal(unicorn.mpeaceful, 1);
    assert.equal(glass.where, 'floor');
    assert.equal(glass.ox, 14);
    assert.equal(glass.oy, 10);
});

void test('a blind hero receives Luck for a unicorn gift without seeing its reaction', async () => {
    const level = freshObjectRoom({ right: 30, hero: { uluck: 0, blindTurns: 20, blind: true } });
    level.flags.noteleport = true;
    await createMonsterAt('gray unicorn', 11, 10);
    const gem = await addInventoryObject(DIAMOND);
    const messages: string[] = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };

    await throwInventoryObject(gem, 'l', ' '.repeat(20));

    assert.equal(game.u.uluck, 5);
    assert.doesNotMatch(messages.join('\n') + game._pending_message, /accepts your gift/);
});
