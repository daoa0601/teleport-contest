import { createSpecialLevel } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAGIC_PORTAL, SQKY_BOARD } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateFakeWizardLevel, generateWizard3Level, } from '../js/mklev.js';
import { floorObjects, levelStairs } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
function portalCount() {
    requirePlayingGame(game);
    return game.level.traps.filter(trap => trap.ttyp === MAGIC_PORTAL).length;
}
async function build(prototype, seed) {
    const active = freshSpecialLevel({
        prototype, variant: 1, seed, depth: 40,
    });
    requirePlayingGame(game);
    assert.ok(game.dungeons[0] != null);
    game.dungeons[0].flags.hellish = true;
    game.specialLevels = new Map([
        ['wizard3', createSpecialLevel({ dnum: 0, dlevel: 40 })],
        ['fakewiz1', createSpecialLevel({ dnum: 0, dlevel: 35 })],
    ]);
    if (prototype === 'wizard3')
        await generateWizard3Level(active);
    else
        await generateFakeWizardLevel(active);
}
void test('the bottom Wizard tower connects its fortress to false Wizard 1', async () => {
    await build('wizard3', 2003);
    requirePlayingGame(game);
    assert.equal(game.level.flags.noteleport, true);
    assert.equal(game.level.flags.hardfloor, true);
    assert.equal(portalCount(), 1);
    assert.equal(levelStairs(game).length, 3);
    assert.ok(game.level.traps.filter(trap => trap.ttyp === SQKY_BOARD).length >= 4);
    assert.equal(game.level.flags.has_beehive, true);
    assert.ok(game.level.monsters.length > 12);
});
void test('false Wizard 1 returns by portal while false Wizard 2 holds an amulet', async () => {
    await build('fakewiz1', 2011);
    requirePlayingGame(game);
    assert.equal(portalCount(), 1);
    assert.equal(levelStairs(game).length, 2);
    assert.ok(game.level.traps.filter(trap => trap.ttyp === SQKY_BOARD).length >= 4);
    await build('fakewiz2', 2017);
    requirePlayingGame(game);
    assert.equal(portalCount(), 0);
    assert.equal(levelStairs(game).length, 2);
    assert.ok(floorObjects(game.level).some(object => object.oclass === 5));
    assert.ok(game.level.monsters.length >= 3);
});
//# sourceMappingURL=wizard_bottom_levels.test.js.map