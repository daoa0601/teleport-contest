import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, ROOM, TT_INFLOOR, TT_LAVA } from '../js/const.js';
import { game } from '../js/gstate.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { freshObjectRoom } from './support/object-room.js';

// C zap.c:zap_over_floor(), ZT_COLD hitting the lava the hero is stuck in:
// the lava cools into floor (zap.c:5297) and then, still in that spot, the
// hero is anchored by set_utrap(rn1(50, 20), TT_INFLOOR) — a fresh 20..69
// turn timeout replacing the lava sink — with "You are firmly stuck in the
// cooling rock." right after the cooling message (zap.c:5305-5306).
void test('a cold ray solidifies the lava the hero is stuck in', async () => {
    const level = await freshObjectRoom();
    const hero = game.u;
    const x = hero.ux, y = hero.uy;
    level.requireAt(x, y).typ = LAVAPOOL;
    hero.utrap = 3;
    hero.utraptype = TT_LAVA;
    const messages: string[] = [];

    await applyRayFloorFeatures('cold', x, y, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(level.requireAt(x, y).typ, ROOM);
    const cooling = messages.findIndex(message => /cools and solidifies\.$/.test(message));
    const stuck = messages.indexOf('You are firmly stuck in the cooling rock.');
    assert.ok(cooling >= 0, messages.join('\n'));
    assert.ok(stuck >= 0, messages.join('\n'));
    assert.ok(cooling < stuck, 'the lava cools before the hero is anchored');
    assert.equal(hero.utraptype, TT_INFLOOR);
    const timeout = hero.utrap ?? 0;
    assert.ok(timeout >= 20 && timeout <= 69, `rn1(50, 20) timeout: ${timeout}`);
});
