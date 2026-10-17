import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev, rndClass } from '../js/mklev.js';
import { DILITHIUM_CRYSTAL, LUCKSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshSpecialLevel } from './support/special-level.js';
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
//# sourceMappingURL=gem_rarity.test.js.map