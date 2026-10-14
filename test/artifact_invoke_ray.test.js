import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { heroIsBlind } from '../js/senses.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('invoking Sunsword flashes a monster in the chosen direction', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    const sword = await artifactObject('Sunsword', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [sword];
    const target = await createMonsterAt('gnome', game.u.ux + 2, game.u.uy, MM_ANGRY | MM_NOGRP | MM_NOMSG | NO_MINVENT);
    await invokeInventoryObject(sword, 'l' + ' '.repeat(20));
    assert.equal(target.mcansee, 0);
    assert.ok((target.mblinded ?? 0) > 0);
    assert.ok(sword.age > game.moves);
    assert.equal(game.context.move, 1);
});
void test('Sunsword can flash the hero even while the artifact is cooling down', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 10 }, uen: 30, uenmax: 30 } });
    requirePlayingGame(game);
    const sword = await artifactObject('Sunsword', { invlet: 'a', where: 'inventory', age: 100 });
    game.inventory = [sword];
    await invokeInventoryObject(sword, ' .' + ' '.repeat(20));
    assert.equal(heroIsBlind(game), true);
    assert.equal(game.u.uen, 5);
    assert.equal(sword.age, 100);
    assert.equal(game.context.move, 1);
});
void test('cancelling a blinding ray costs no turn and makes Sunsword ready now', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    const sword = await artifactObject('Sunsword', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [sword];
    await invokeInventoryObject(sword, '\u001b');
    assert.equal(game.context.move, 0);
    assert.equal(sword.age, game.moves);
    assert.equal(game._pending_message, 'Never mind.');
});
//# sourceMappingURL=artifact_invoke_ray.test.js.map