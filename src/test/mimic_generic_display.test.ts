import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_MONSTER, M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { stumbleOntoMimic } from '../js/mimic.js';


import { nameToMonster } from '../js/mondata.js';
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
            const level = await freshObjectRoom();
            const mimic = await createMonsterAt('large mimic', x, 10, NO_MINVENT);
            mimic.m_ap_type = M_AP_OBJECT;
            mimic.mappearance = otyp;

            await newsym(x, 10);
            await flush_screen(1);

            assert.equal(requireGameDisplay().grid[11]?.[x - 1]?.ch, ']');
            assert.equal(level.requireAt(x, 10).remembered_glyph?.ch, ']');
        });
    }
}

// uhitm.c:that_is_a_mimic() names the object glyph shown on the map, so a
// zero-class gem disguise is announced as the strange object it displays.
void test('stumbling onto a gem-disguised mimic names the strange object it showed', async () => {
    await freshObjectRoom();
    const mimic = await createMonsterAt('large mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = DIAMOND;
    mimic.msleeping = 0;
    await newsym(11, 10);
    const messages: string[] = [];

    await stumbleOntoMimic(mimic, game, async message => { messages.push(message); });

    assert.deepEqual(messages, ['That strange object is a large mimic!']);
});

// uhitm.c:that_is_a_mimic() passes EXACT_NAME and called=TRUE to x_monnam(),
// so a named monster revealed from a monster disguise is announced as
// "<species> called <name>", never as the bare personal name.
void test('stumbling onto a named monster disguise names species and pet name', async () => {
    await freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    dog.m_ap_type = M_AP_MONSTER;
    dog.mappearance = nameToMonster('kitten');
    dog.mgivenname = 'Idefix';
    dog.msleeping = 0;
    await newsym(11, 10);
    const messages: string[] = [];

    await stumbleOntoMimic(dog, game, async message => { messages.push(message); });

    assert.deepEqual(messages, ['Wait!  That kitten is really a little dog called Idefix!']);
});
