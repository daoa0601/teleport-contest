import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN, LEVEL_TELEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateMinesEnd } from '../js/mklev.js';
import { FLINT, LUCKSTONE } from '../js/object_data.js';
import { countTerrain, floorObjects, levelStairs, } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
async function buildMinesEnd(variant) {
    const active = freshSpecialLevel({
        prototype: 'minend', variant, seed: variant * 101, depth: 12,
    });
    requirePlayingGame(game);
    await generateMinesEnd(active);
}
void test("all three Mines' End layouts contain their live prize", async () => {
    for (let variant = 1; variant <= 3; variant++) {
        await buildMinesEnd(variant);
        requirePlayingGame(game);
        const prizes = floorObjects(game.level).filter(object => object.otyp === LUCKSTONE && object.achievement);
        assert.equal(game.level.flags.is_special, true);
        assert.equal(game.level.flags.is_maze_lev, true);
        assert.equal(levelStairs(game).length, 1);
        assert.equal(prizes.length, 1);
        assert.ok(game.level.monsters.length > 10);
    }
});
void test('the catacombs contain fountains and trapped treasure sites', async () => {
    await buildMinesEnd(3);
    requirePlayingGame(game);
    assert.equal(game.level.flags.nommap, true);
    assert.equal(countTerrain(game.level, FOUNTAIN), 2);
    const teleports = game.level.traps.filter(trap => trap.ttyp === LEVEL_TELEP);
    assert.equal(teleports.length, 2);
    const trappedCoordinates = new Set(teleports.map(trap => `${trap.tx},${trap.ty}`));
    const trappedTreasure = floorObjects(game.level).filter(object => [LUCKSTONE, FLINT].includes(object.otyp)
        && trappedCoordinates.has(`${object.ox},${object.oy}`));
    assert.equal(trappedTreasure.length, 2);
});
//# sourceMappingURL=mines_end.test.js.map