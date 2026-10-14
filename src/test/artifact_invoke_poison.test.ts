import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';

void test('Grimtooth flings hero-owned venom without removing the dagger', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 10 },
        acurr: { a: [12, 12, 12, 25, 12, 12] }, amax: { a: [12, 12, 12, 25, 12, 12] } },
        gameplaySeed: 17n });
    requirePlayingGame(game);
    const dagger = await artifactObject('Grimtooth', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [dagger];
    const target = await createMonsterAt('gnome', game.u.ux + 1, game.u.uy,
        MM_ANGRY | MM_NOGRP | MM_NOMSG | NO_MINVENT);
    target.mhp = target.mhpmax = 50;

    await invokeInventoryObject(dagger, 'l' + ' '.repeat(20));

    assert.ok(target.mcansee === 0 || target.mhp < 50);
    assert.equal(game.inventory.includes(dagger), true);
    assert.ok(dagger.age > game.moves);
    assert.equal(game.context.move, 1);
});

void test('cancelling Grimtooth poison releases its cooldown and takes no time', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 10 } } });
    requirePlayingGame(game);
    const dagger = await artifactObject('Grimtooth', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [dagger];

    await invokeInventoryObject(dagger, '\u001b');

    assert.equal(dagger.age, game.moves);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'Never mind.');
});
