import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustHeroAlignment } from '../js/alignment.js';
import { A_CHAOTIC, G_GENOD } from '../js/const.js';
import { game } from '../js/gstate.js';
import { mkclassAligned } from '../js/makemon.js';
import { MONSTER_NAME, requireMonsterData } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
const S_DEMON = 56;
const G_HELL = 0x0400;
const AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');
const ICE_DEVIL = MONSTER_NAME.indexOf('ice devil');
async function demonSelectionRoom() {
    await freshObjectRoom({ hero: { ulevel: 1, uz: { dnum: 0, dlevel: 1 } } });
    assert.ok(game.mvitals, 'the room initializes species population records');
    for (const [species, vital] of game.mvitals.entries()) {
        if (species !== AMOROUS_DEMON && species !== ICE_DEVIL)
            vital.mvflags = G_GENOD;
    }
}
function chooseChaoticDemon() {
    initRng(2n);
    // Permit hell-only species here so the test exercises strength selection.
    const species = mkclassAligned(S_DEMON, G_HELL, A_CHAOTIC);
    return species === null ? null : requireMonsterData(MONSTER_NAME, species);
}
void test('first class selection uses the current strength of alignment-rejected species', async () => {
    await demonSelectionRoom();
    adjustHeroAlignment(-15);
    const chosen = chooseChaoticDemon();
    // Erinys now precedes the equally difficult ice devil. Its lawful
    // alignment excludes it from selection, but not the strength comparison.
    assert.equal(chosen, 'ice devil');
});
void test('later alignment abuse keeps the class order established by an earlier selection', async () => {
    await demonSelectionRoom();
    assert.equal(chooseChaoticDemon(), 'amorous demon');
    adjustHeroAlignment(-15);
    const chosen = chooseChaoticDemon();
    assert.equal(chosen, 'amorous demon');
});
void test('an invalid class request leaves the first valid selection to use current species strengths', async () => {
    await demonSelectionRoom();
    assert.equal(mkclassAligned(0), null);
    adjustHeroAlignment(-15);
    const chosen = chooseChaoticDemon();
    assert.equal(chosen, 'ice devil');
});
void test('a new game rebuilds class selection order from its own species strengths', async () => {
    await demonSelectionRoom();
    assert.equal(chooseChaoticDemon(), 'amorous demon');
    await demonSelectionRoom();
    adjustHeroAlignment(-15);
    const chosen = chooseChaoticDemon();
    assert.equal(chosen, 'ice devil');
});
void test('restoring a game rebuilds class selection order from saved alignment abuse', async () => {
    await demonSelectionRoom();
    game.plname = 'DemonSelection';
    assert.equal(chooseChaoticDemon(), 'amorous demon');
    adjustHeroAlignment(-15);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('DemonSelection', storage), true);
    const chosen = chooseChaoticDemon();
    assert.equal(chosen, 'ice devil');
});
//# sourceMappingURL=monster_class_order.test.js.map