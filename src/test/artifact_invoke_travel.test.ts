import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('the Orb of Fate tries level teleport even when the Amulet prevents it', async () => {
    freshObjectRoom({ role: 'valkyrie', hero: { uhave: { amulet: true } } });
    requirePlayingGame(game);
    const orb = await artifactObject('The Orb of Fate', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [orb];

    await invokeInventoryObject(orb);

    assert.equal(game._pending_message, 'You feel very disoriented for a moment.');
    assert.ok(orb.age > game.moves);
    assert.equal(game.context.move, 1);
});

void test('the Eye cannot portal into the dungeon the hero already occupies', async () => {
    freshObjectRoom({ role: 'wizard' });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',
        num_dunlevs: 20, dunlev_ureached: 8 })];
    const eye = await artifactObject('The Eye of the Aethiopica', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [eye];

    await invokeInventoryObject(eye);

    assert.equal(game._pending_message, 'You feel very disoriented for a moment.');
    assert.equal(game.u.uz.dnum, 0);
    assert.equal(game.u.uz.dlevel, 8);
    assert.ok(eye.age > game.moves);
    assert.equal(game.context.move, 1);
});

void test('cancelling the Eye dungeon menu consumes its invocation and a turn', async () => {
    freshObjectRoom({ role: 'wizard' });
    requirePlayingGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20, dunlev_ureached: 8 }),
        createDungeon({ dname: 'The Gnomish Mines', num_dunlevs: 8, dunlev_ureached: 4 }),
    ];
    const eye = await artifactObject('The Eye of the Aethiopica', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [eye];

    await invokeInventoryObject(eye, '\u001b');

    assert.equal(game._pending_message, 'You feel a surge of power, but nothing seems to happen.');
    assert.ok(eye.age > game.moves);
    assert.equal(game.context.move, 1);
});
