import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { ICE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
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
//# sourceMappingURL=slippery_ice.test.js.map