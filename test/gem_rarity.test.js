import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { mklev, oinit, rndClass } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { DILITHIUM_CRYSTAL, LUCKSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshSpecialLevel } from './support/special-level.js';
void test('object initialization resets gem rarity before the first level is built', () => {
    freshSpecialLevel({ prototype: 'ordinary', depth: 30, seed: 7 });
    oinit();
    init_objects();
    initRng(17n);
    const selections = Array.from({ length: 200 }, () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1));
    assert.ok(selections.every(type => type >= DILITHIUM_CRYSTAL + 9), 'startup must exclude the first nine precious gems even after a previous deep level');
});
void test('gem selection excludes rare gems near the surface and admits them at depth', async () => {
    for (const depth of [1, 30]) {
        freshSpecialLevel({ prototype: 'ordinary', depth, seed: 7 });
        requirePlayingGame(game);
        game.specialLevels?.clear();
        game.flags.bones = false;
        await mklev();
        initRng(17n);
        const selections = Array.from({ length: 200 }, () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1));
        const containsRareGem = selections.some(type => type < DILITHIUM_CRYSTAL + 9);
        assert.equal(containsRareGem, depth === 30, `the first nine precious gems must be unavailable on level 1 and available on level 30 (depth ${depth})`);
    }
});
void test('returning from a newly made shallow level restores deep-level gem selection', async () => {
    freshSpecialLevel({ prototype: 'ordinary', depth: 30, seed: 7 });
    requirePlayingGame(game);
    game.specialLevels?.clear();
    game.flags.bones = false;
    await mklev();
    const deepLevel = game.level;
    await gotoLevel({ dlevel: 1 });
    initRng(17n);
    const shallowSelections = Array.from({ length: 200 }, () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1));
    assert.ok(shallowSelections.every(type => type >= DILITHIUM_CRYSTAL + 9), 'rare gems cannot be generated on the new shallow level');
    await gotoLevel({ dlevel: 30 });
    initRng(17n);
    const deepSelections = Array.from({ length: 200 }, () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1));
    assert.equal(game.level, deepLevel);
    assert.ok(deepSelections.some(type => type < DILITHIUM_CRYSTAL + 9), 'rare gems must be available again on the restored deep level');
});
// C restnames() reloads objects[].oc_prob exactly as savenames() wrote it, so a
// game restored on a deep level keeps that level's gem probabilities even if
// this process generated a shallow level in between.
void test('a game restored on a deep level keeps deep-level gem selection', async () => {
    freshSpecialLevel({ prototype: 'ordinary', depth: 30, seed: 7 });
    requirePlayingGame(game);
    game.specialLevels?.clear();
    game.flags.bones = false;
    await mklev();
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    freshSpecialLevel({ prototype: 'ordinary', depth: 1, seed: 7 });
    game.specialLevels?.clear();
    game.flags.bones = false;
    await mklev();
    assert.equal(restoreGame(game.plname, storage), true);
    initRng(17n);
    const selections = Array.from({ length: 200 }, () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1));
    assert.ok(selections.some(type => type < DILITHIUM_CRYSTAL + 9), 'rare gems must remain available after restoring the deep-level game');
});
//# sourceMappingURL=gem_rarity.test.js.map