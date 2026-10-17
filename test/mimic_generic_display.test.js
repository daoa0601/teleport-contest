import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { stumbleOntoMimic } from '../js/mimic.js';
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
// uhitm.c:that_is_a_mimic() names the object glyph shown on the map, so a
// zero-class gem disguise is announced as the strange object it displays.
void test('stumbling onto a gem-disguised mimic names the strange object it showed', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('large mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = DIAMOND;
    mimic.msleeping = 0;
    newsym(11, 10);
    const messages = [];
    await stumbleOntoMimic(mimic, game, async (message) => { messages.push(message); });
    assert.deepEqual(messages, ['That strange object is a large mimic!']);
});
//# sourceMappingURL=mimic_generic_display.test.js.map