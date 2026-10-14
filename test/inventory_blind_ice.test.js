import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DB_ICE, DRAWBRIDGE_UP, ICE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const terrain of [ICE, DRAWBRIDGE_UP]) {
    void test(`blind inspection recognizes hallucinated ice on terrain ${terrain}`, async (t) => {
        const level = freshObjectRoom({
            flags: { mention_decor: true }, hero: { blindTurns: 10, hallucinationTurns: 10 },
        });
        const location = level.requireAt(game.u.ux, game.u.uy);
        location.typ = terrain;
        if (terrain === DRAWBRIDGE_UP)
            location.drawbridgemask = DB_ICE;
        const input = resetInputState();
        planInput(input, t, []);
        await rhack(':'.charCodeAt(0));
        assert.equal(game._pending_message, 'You try to feel what is on it.  You feel no objects here.');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=inventory_blind_ice.test.js.map