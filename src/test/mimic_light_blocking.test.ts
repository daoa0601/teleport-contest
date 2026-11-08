import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_FURNITURE, M_AP_OBJECT } from '../js/const.js';
import { BOULDER } from '../js/object_data.js';
import { revealMonsterAppearance } from '../js/mon.js';
import { initRng } from '../js/rng.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { block_point, clearPath, visionCellBlocksLight } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C monst.h:is_lightblocker_mappear() (monst.h:233) feeds vision.c's
// does_block(): a mimic blocks light only when disguised as a boulder, or as
// furniture that is a wall (mappearance < S_ndoor), a closed door
// (S_vcdoor/S_hcdoor) or a tree (S_tree).  The doorway, open doors, iron
// bars, corridors, altars, fountains and the like never block light.
void test('a mimic disguise blocks light only for the light-blocking furniture', async () => {
    await freshObjectRoom();
    initRng(671n);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    const level = requireGameLevel();
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
        assert.equal(visionCellBlocksLight(level, 12, 10), blocks, `furniture disguise ${what}`);
    }

    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER;
    assert.equal(visionCellBlocksLight(level, 12, 10), true, 'boulder object disguise');

    mimic.mappearance = BOULDER + 1;
    assert.equal(visionCellBlocksLight(level, 12, 10), false, 'other object disguises never block');
});

// C mon.c:seemimic() (recorder mon.c:4419): a discovered mimic must stop
// blocking light — is_blocker_appear is captured before the disguise is
// cleared and unblock_point() reopens the square, so sight lines through it
// resume without waiting for a full vision recalculation.
void test('revealing a blocking mimic reopens the sight line through its square', async () => {
    await freshObjectRoom();
    initRng(671n);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = 1; // wall disguise
    const level = requireGameLevel();
    // set_mimic_sym() joins the blocker table when the disguise obstructs.
    assert.equal(visionCellBlocksLight(level, 12, 10), true, 'the wall disguise blocks');
    block_point(12, 10);
    assert.equal(clearPath(10, 10, 14, 10), false,
        'the disguised mimic blocks the hero’s sight line across the room');

    await revealMonsterAppearance(mimic);
    assert.equal(visionCellBlocksLight(level, 12, 10), false, 'the revealed mimic does not block');
    assert.equal(clearPath(10, 10, 14, 10), true,
        'seemimic() unblocks the square, so the sight line resumes');
});

// C mon.c:seemimic() calls unblock_point() only when is_blocker_appear was
// set, and vision.c:unblock_point() raises gv.vision_full_recalc only for a
// square in the hero's visibility map — so revealing a doorway, open door,
// bars, corridor, altar or fountain disguise must not request a full vision
// recalculation, while revealing a wall disguise must.
void test('revealing a non-blocking disguise does not request a vision recalculation', async () => {
    await freshObjectRoom();
    initRng(671n);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    const level = requireGameLevel();
    game.vision_full_recalc = 0;
    for (const [mappearance, what] of [[12, 'S_ndoor doorway'], [13, 'S_vodoor open door'],
        [14, 'S_hodoor open door'], [17, 'S_bars'], [23, 'S_litcorr'],
        [33, 'S_altar'], [37, 'S_fountain']] as const) {
        mimic.m_ap_type = M_AP_FURNITURE;
        mimic.mappearance = mappearance;
        await revealMonsterAppearance(mimic);
        assert.equal(game.vision_full_recalc, 0, `revealing a ${what} disguise`);
    }

    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = 1; // wall disguise
    assert.equal(visionCellBlocksLight(level, 12, 10), true, 'wall disguise blocks');
    await revealMonsterAppearance(mimic);
    assert.equal(game.vision_full_recalc, 1,
        'revealing a blocking disguise the hero sees requests the recalculation');
});
