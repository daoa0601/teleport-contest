import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { CORPSE, STATUE } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const otyp of [CORPSE, STATUE]) {
    void test(`the hero's ${otyp === CORPSE ? 'corpse' : 'statue'} disguise retains its generic object symbol while hallucinating`, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        game.u.m_ap_type = M_AP_OBJECT;
        game.u.mappearance = otyp;

        for (let redraw = 0; redraw < 4; redraw++) {
            newsym(game.u.ux, game.u.uy);
            await flush_screen(1);
            assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch,
                otyp === CORPSE ? '%' : '`');
        }
    });
}
