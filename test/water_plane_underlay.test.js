import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DRAWBRIDGE_UP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isSteadfast } from '../js/knockback.js';
import { descendFromLevitation } from '../js/levitation_commands.js';
import { LOADSTONE } from '../js/object_data.js';
import { refreshProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
function dryBridgeOnWaterPlane() {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.water_level = createSpecialLevel({ ...game.u.uz });
    const square = level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_FLOOR;
}
void test('descending above a dry raised-bridge bed on the Water Plane names the air bubble', async () => {
    dryBridgeOnWaterPlane();
    game.u.levitationTurns = 20;
    refreshProperty('levitation');
    const messages = [];
    await descendFromLevitation(game, { publish: message => { messages.push(message); } });
    assert.ok(messages.includes('You are floating in a bubble of air.'));
});
void test('a loadstone cannot anchor the hero in an air bubble below a raised bridge', async () => {
    dryBridgeOnWaterPlane();
    await addInventoryObject(LOADSTONE);
    assert.equal(isSteadfast(game.u, game), false);
});
//# sourceMappingURL=water_plane_underlay.test.js.map