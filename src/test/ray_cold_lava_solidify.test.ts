import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, ROOM, TT_INFLOOR, TT_LAVA } from '../js/const.js';
import { game } from '../js/gstate.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { freshObjectRoom } from './support/object-room.js';

// C zap.c:zap_over_floor(), ZT_COLD hitting the lava the hero is stuck in:
// the lava cools into floor and set_utrap(rn1(50, 20), TT_INFLOOR) anchors
// the hero in the cooling rock.  rn1(50, 20) draws rn2(50) (0..49) once and
// adds 20, so the new trap timeout is 20..69 turns of stuck-in-floor.
void test('a cold ray solidifies the lava the hero is stuck in', async () => {
    const level = await freshObjectRoom();
    const hero = game.u;
    const x = hero.ux, y = hero.uy;
    level.requireAt(x, y).typ = LAVAPOOL;
    hero.utrap = 3;
    hero.utraptype = TT_LAVA;
    const messages: string[] = [];
    initRng(5n);
    enableRngLog();

    await applyRayFloorFeatures('cold', x, y, game, {
        publish: async message => { messages.push(message); },
    });

    assert.ok(messages.includes('You are firmly stuck in the cooling rock.'),
        messages.join('\n'));
    assert.equal(level.requireAt(x, y).typ, ROOM);
    assert.equal(hero.utraptype, TT_INFLOOR);
    const roll = getRngLog().find(entry => entry.startsWith('rn2(50)='));
    assert.ok(roll, `rn1(50,20) draws rn2(50): ${getRngLog().join(', ')}`);
    assert.equal(hero.utrap, Number(roll.slice(roll.indexOf('=') + 1)) + 20);
    assert.ok(!getRngLog().some(entry => entry.startsWith('rnd(50)=')));
});
