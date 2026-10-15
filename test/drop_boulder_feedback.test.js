import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { PIT, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a dropped boulder announces landing in the pit with the hero', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const boulder = await addInventoryObject(BOULDER, { invlet: 'a' });
    const pit = addTrap(game.level, PIT, game.u.ux, game.u.uy, { tseen: true });
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    const health = game.u.uhp;
    pushKeys('a ');
    await rhack('d'.charCodeAt(0));
    assert.equal(game._pending_message, 'The boulder drops into the pit with you.');
    assert.ok(game.u.uhp < health, 'the boulder squashes the hero');
    assert.equal(game.level.traps.includes(pit), false);
    assert.equal(boulder.where, 'gone');
    assert.equal(game.u.utrap, 0);
});
//# sourceMappingURL=drop_boulder_feedback.test.js.map