import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { DIAMOND, SPE_FORCE_BOLT } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { disguise, otyp } of [
    { disguise: 'gem', otyp: DIAMOND },
    { disguise: 'spellbook', otyp: SPE_FORCE_BOLT },
]) {
    for (const { distance, x } of [
        { distance: 'nearby', x: 11 },
        { distance: 'distant', x: 15 },
    ]) {
        void test(`a ${distance} mimic's ${disguise} disguise shows the strange-object symbol`, async () => {
            const level = freshObjectRoom();
            const mimic = await createMonsterAt('large mimic', x, 10, NO_MINVENT);
            mimic.m_ap_type = M_AP_OBJECT;
            mimic.mappearance = otyp;
            newsym(x, 10);
            await flush_screen(1);
            assert.equal(requireGameDisplay().grid[11]?.[x - 1]?.ch, ']');
            assert.equal(level.requireAt(x, 10).remembered_glyph?.ch, ']');
        });
    }
}
//# sourceMappingURL=mimic_generic_display.test.js.map