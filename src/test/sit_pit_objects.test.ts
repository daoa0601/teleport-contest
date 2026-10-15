import test from 'node:test';
import assert from 'node:assert/strict';
import { PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('sitting at a known pit edge enters the pit rather than sitting on its objects', async () => {
    const level = freshObjectRoom();
    addTrap(level, PIT, 10, 10, { tseen: true });
    const rock = await floorObject(ROCK, 10, 10);

    await runExtendedCommand('sit', ' '.repeat(10));

    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
    assert.equal(rock.where, 'floor');
    assert.doesNotMatch(game._pending_message, /You sit on the rock/);
});
