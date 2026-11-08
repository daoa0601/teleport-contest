import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_FURNITURE, M_AP_OBJECT } from '../js/const.js';
import { BOULDER } from '../js/object_data.js';
import { revealMonsterAppearance } from '../js/mon.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C monst.h:is_lightblocker_mappear() (monst.h:233): a mimic blocks light
// only when disguised as a boulder, or as furniture that is a wall
// (mappearance < S_ndoor), a closed door (S_vcdoor/S_hcdoor) or a tree
// (S_tree).  The doorway, open doors, iron bars, corridors, altars,
// fountains and the like never block light, and seemimic() (mon.c)
// captures the test before clearing the disguise to decide whether the
// square must be unblocked.
void test('a revealed mimic blocks light only for the light-blocking disguises', async () => {
    await freshObjectRoom();
    initRng(671n);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    const cases: ReadonlyArray<readonly [number, boolean, string]> = [
        [1, true, 'wall'],
        [11, true, 'wall'],
        [12, false, 'S_ndoor doorway'],
        [13, false, 'S_vodoor open door'],
        [14, false, 'S_hodoor open door'],
        [15, true, 'S_vcdoor closed door'],
        [16, true, 'S_hcdoor closed door'],
        [17, false, 'S_bars'],
        [18, true, 'S_tree'],
        [23, false, 'S_litcorr'],
        [33, false, 'S_altar'],
        [37, false, 'S_fountain'],
    ];
    for (const [mappearance, blocks, what] of cases) {
        mimic.m_ap_type = M_AP_FURNITURE;
        mimic.mappearance = mappearance;
        const reveal = await revealMonsterAppearance(mimic);
        assert.equal(reveal.lightBlocker, blocks, `furniture disguise ${what}`);
    }

    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER;
    const boulderReveal = await revealMonsterAppearance(mimic);
    assert.equal(boulderReveal.lightBlocker, true, 'boulder object disguise');

    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER + 1;
    const statueReveal = await revealMonsterAppearance(mimic);
    assert.equal(statueReveal.lightBlocker, false, 'other object disguises never block');
});
