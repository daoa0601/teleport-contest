import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { heroIsBlind } from '../js/senses.js';

void test('the Staff reports slight relief when it cures a timeout but permanent blindness remains', async () => {
    freshObjectRoom({ role: 'healer', hero: { permaBlind: true, blindTurns: 7 } });
    requirePlayingGame(game);
    const staff = await artifactObject('The Staff of Aesculapius', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [staff];

    await invokeInventoryObject(staff, ' '.repeat(20));

    assert.equal(game.u.blindTurns, 0);
    assert.equal(heroIsBlind(game), true);
    assert.equal(game._pending_message, 'You feel slightly better.');
    assert.equal(game.context.move, 1);
});
