import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_ICE, DRAWBRIDGE_UP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { freshObjectRoom } from './support/object-room.js';
void test('leaving water for ice below a raised bridge names the ice', async () => {
    const level = freshObjectRoom({ flags: { verbose: true } });
    const square = level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_ICE;
    game.u.uinwater = 1;
    game.underwater = true;
    const messages = [];
    await heroLiquidEffects({ publish: message => { messages.push(message); } });
    assert.ok(messages.includes('You are back on solid ice.'));
    assert.ok(!game.u.uinwater);
});
//# sourceMappingURL=leaving_water_ice_underlay.test.js.map