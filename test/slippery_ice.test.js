import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { ICE } from '../js/const.js';
import { slipOrTrip } from '../js/fumbling.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('walking from ice can cause a temporary slip and two helpless turns', async () => {
    let slips = 0;
    for (let seed = 1; seed <= 12; seed++) {
        const input = freshTurnRoom({ role: 'caveman' });
        const square = game.level?.at(game.u.ux, game.u.uy);
        assert.ok(square);
        square.typ = ICE;
        initRng(BigInt(seed));
        input.feed('l');
        await moveloop_core();
        if ((game.u.fumblingTurns ?? 0) !== 1)
            continue;
        await moveloop_core();
        slips++;
        assert.match(game._last_message ?? '', /You (?:slip|slide) off the ice\./);
        assert.equal(game.u.fumblingTurns, 0);
        assert.equal(game.u.fumbling, false);
        assert.ok((game._helplessTurns ?? 0) > 0, 'slipping leaves the hero unable to act');
    }
    assert.ok(slips > 0, 'ordinary footsteps sometimes slip on ice');
});
for (const property of ['levitation', 'flying']) {
    void test(`${property} prevents slipping on ice`, async () => {
        const input = freshTurnRoom({ role: 'caveman' });
        const square = game.level?.at(game.u.ux, game.u.uy);
        assert.ok(square);
        square.typ = ICE;
        grantIntrinsicProperty(property, 'outside');
        input.feed('l');
        await moveloop_core();
        assert.equal(game.u.fumblingTurns ?? 0, 0);
    });
}
void test('cold resistance prevents an unmounted hero from slipping on ice', async () => {
    for (let seed = 1; seed <= 12; seed++) {
        const input = freshTurnRoom({ role: 'caveman' });
        const square = game.level?.at(game.u.ux, game.u.uy);
        assert.ok(square);
        square.typ = ICE;
        grantIntrinsicProperty('coldResistance', 'outside');
        initRng(BigInt(seed));
        input.feed('l');
        await moveloop_core();
        assert.equal(game.u.fumblingTurns ?? 0, 0, `cold resistance protects the hero for seed ${seed}`);
    }
});
for (const onIce of [true, false]) {
    void test(`a saddled pony slipping ${onIce ? 'on' : 'off'} ice is named without its saddle`, async () => {
        const level = freshObjectRoom();
        if (onIce)
            level.requireAt(game.u.ux, game.u.uy).typ = ICE;
        const steed = await createSaddledSteed('pony', { saddle: { cursed: true } });
        game.u.usteed = steed;
        game.u.fumblingFromIce = true;
        game.u.ux0 = game.u.ux;
        game.u.uy0 = game.u.uy;
        const messages = [];
        await slipOrTrip(async (message) => { messages.push(message); });
        assert.equal(messages.length, 1);
        assert.match(messages[0] ?? '', onIce
            ? /^The pony (?:slips|slides) on the ice\.$/
            : /^The pony (?:slips|slides) off the ice\.$/);
        assert.equal(game.u.usteed, steed, 'the cursed saddle keeps the hero mounted');
    });
}
//# sourceMappingURL=slippery_ice.test.js.map