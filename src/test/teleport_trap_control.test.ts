import assert from 'node:assert/strict';
import test from 'node:test';
import { TELEP_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { finishTeleportArrival } from '../js/location_effects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a wizard chooses the destination of an ordinary teleport trap', async () => {
    const level = freshObjectRoom({ flags: { debug: true, tips: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    const operation = triggerHeroTrap(addTrap(level, TELEP_TRAP, 10, 10), {
        finishTeleport: finishTeleportArrival,
    });

    assert.equal(await Promise.race([
        operation.then(() => 'finished'), input.waitUntilBlocked().then(() => 'input'),
    ]), 'input', 'tele() must offer control before picking a random square');
    assert.match(game._pending_message, /Where do you want to be teleported\?/);
    assert.equal(game.u.ux, 10);
    input.feed('ll.');
    await operation;
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 10);
});
