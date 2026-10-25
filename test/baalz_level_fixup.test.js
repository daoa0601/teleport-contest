import assert from 'node:assert/strict';
import test from 'node:test';
import { BLCORNER, BRCORNER, COLNO, HWALL, IS_WALL, POOL, ROWNO, STONE, TLCORNER, TRCORNER, VWALL, } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
function solidRockOrWall(x, y) {
    const cell = game.level?.at(x, y);
    if (!cell)
        return true;
    return cell.typ === STONE || IS_WALL(cell.typ);
}
void test("baalz_fixup keeps the beetle's legs, walls its pools, and repairs the rear joints", async (t) => {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    game._specialLevelPrototype = 'baalz';
    await mklev();
    const level = requireGameLevel();
    // mkmaze.c:baalz_fixup() turns the beetle's two interior pools into
    // plain walls before wallification, so the finished lair has no pools.
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            assert.notEqual(level.requireAt(x, y).typ, POOL, `a pool survived at ${x},${y}`);
    // The legs are walls buried in solid rock. Ordinary wall_cleanup()
    // erases such walls, so every survivor lives inside the nondiggable
    // region that protects the beetle; the count is stable across the
    // level's two mirror images.
    const buriedLegs = [];
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            if (!IS_WALL(level.requireAt(x, y).typ))
                continue;
            let surrounded = true;
            for (let dx = -1; dx <= 1 && surrounded; dx++)
                for (let dy = -1; dy <= 1; dy++) {
                    if (!dx && !dy)
                        continue;
                    if (!solidRockOrWall(x + dx, y + dy)) {
                        surrounded = false;
                        break;
                    }
                }
            if (surrounded)
                buriedLegs.push([x, y]);
        }
    assert.equal(buriedLegs.length, 36, 'the beetle legs buried in rock must survive wall cleanup');
    // The two rear-most leg joints started as pools; after wallification
    // they are repaired to separated corners: the upper joint is a bottom
    // corner whose joint below became a horizontal wall, and the lower
    // joint mirrors it above.
    let upperJoints = 0, lowerJoints = 0;
    for (let x = 1; x < COLNO; x++)
        for (let y = 1; y < ROWNO - 1; y++) {
            const typ = level.requireAt(x, y).typ;
            const above = level.requireAt(x, y - 1).typ;
            const below = level.requireAt(x, y + 1).typ;
            if ((typ === BLCORNER || typ === BRCORNER)
                && below === HWALL && above === VWALL)
                upperJoints++;
            if ((typ === TLCORNER || typ === TRCORNER)
                && above === HWALL && below === VWALL)
                lowerJoints++;
        }
    assert.equal(upperJoints, 1, 'exactly one repaired upper rear-leg joint');
    assert.equal(lowerJoints, 1, 'exactly one repaired lower rear-leg joint');
});
void test('the mirrored beetle lair produces the same fixup results', async (t) => {
    freshGame({ flags: { bones: false } });
    initRng(5n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    game._specialLevelPrototype = 'baalz';
    await mklev();
    const level = requireGameLevel();
    // Seed 5 flips the lair horizontally; the repair must mirror with it.
    let upperJoints = 0, lowerJoints = 0;
    let buriedLegs = 0;
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const typ = level.requireAt(x, y).typ;
            assert.notEqual(typ, POOL);
            if (IS_WALL(typ)) {
                let surrounded = true;
                for (const [dx, dy] of [[-1, -1], [-1, 0], [-1, 1], [0, -1],
                    [0, 1], [1, -1], [1, 0], [1, 1]]) {
                    if (!solidRockOrWall(x + dx, y + dy)) {
                        surrounded = false;
                        break;
                    }
                }
                if (surrounded)
                    buriedLegs++;
            }
            if (y > 0 && y < ROWNO - 1) {
                const above = level.requireAt(x, y - 1).typ;
                const below = level.requireAt(x, y + 1).typ;
                if ((typ === BLCORNER || typ === BRCORNER)
                    && below === HWALL && above === VWALL)
                    upperJoints++;
                if ((typ === TLCORNER || typ === TRCORNER)
                    && above === HWALL && below === VWALL)
                    lowerJoints++;
            }
        }
    assert.equal(buriedLegs, 36);
    assert.equal(upperJoints, 1);
    assert.equal(lowerJoints, 1);
});
//# sourceMappingURL=baalz_level_fixup.test.js.map