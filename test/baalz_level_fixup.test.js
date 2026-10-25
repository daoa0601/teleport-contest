import assert from 'node:assert/strict';
import test, {} from 'node:test';
import { BLCORNER, BRCORNER, COLNO, HWALL, IRONBARS, IS_WALL, POOL, ROWNO, STONE, TLCORNER, TRCORNER, VWALL, } from '../js/const.js';
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
async function generateBaalzLair(t, seed) {
    freshGame({ flags: { bones: false } });
    initRng(seed);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    game._specialLevelPrototype = 'baalz';
    await mklev();
    const level = requireGameLevel();
    const analysis = {
        pools: 0, buriedLegs: 0, upperJoints: [], lowerJoints: [], eyeBars: [],
    };
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const typ = level.requireAt(x, y).typ;
            if (typ === POOL)
                analysis.pools++;
            if (typ === IRONBARS)
                analysis.eyeBars.push([x, y]);
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
                    analysis.buriedLegs++;
            }
            if (y > 0 && y < ROWNO - 1) {
                const above = level.requireAt(x, y - 1).typ;
                const below = level.requireAt(x, y + 1).typ;
                if ((typ === BLCORNER || typ === BRCORNER)
                    && below === HWALL && above === VWALL)
                    analysis.upperJoints.push([x, y]);
                if ((typ === TLCORNER || typ === TRCORNER)
                    && above === HWALL && below === VWALL)
                    analysis.lowerJoints.push([x, y]);
            }
        }
    return analysis;
}
void test("baalz_fixup keeps the beetle's legs, walls its pools, and repairs the rear joints", async (t) => {
    const lair = await generateBaalzLair(t, 731n);
    // mkmaze.c:baalz_fixup() turns the beetle's two interior pools into
    // plain walls before wallification, so the finished lair has no pools.
    assert.equal(lair.pools, 0, 'no pool terrain may survive the fixup');
    // The legs are walls buried in solid rock. Ordinary wall_cleanup()
    // erases such walls, so every survivor lives inside the nondiggable
    // region that protects the beetle; the count is stable across the
    // level's two mirror images.
    assert.equal(lair.buriedLegs, 36, 'the beetle legs buried in rock must survive wall cleanup');
    // The two rear-most leg joints started as pools; after wallification
    // they are repaired to separated corners: the upper joint is a bottom
    // corner whose joint below became a horizontal wall, and the lower
    // joint mirrors it above.
    assert.equal(lair.upperJoints.length, 1, 'exactly one repaired upper rear-leg joint');
    assert.equal(lair.lowerJoints.length, 1, 'exactly one repaired lower rear-leg joint');
});
void test('both mirror images of the beetle lair get the same fixup', async (t) => {
    // baalz.lua's random flip mirrors the mapped fragment; the horizontal
    // component decides which of the two mirror images the lair takes, and
    // which one a seed gets depends on generation state, so discover both
    // instead of trusting a fixed seed. baalz.lua's fragment spans x 2..78,
    // so mirrored columns satisfy x -> 80 - x: the eyes trade columns
    // 31 <-> 49 while the repaired rear joints trade 68 <-> 12.
    const leftEyeLairs = [];
    const rightEyeLairs = [];
    for (const seed of [731n, 5n, 999n, 424242n, 12345n]) {
        const lair = await generateBaalzLair(t, seed);
        assert.equal(lair.pools, 0, `seed ${seed}: no pool may survive the fixup`);
        assert.equal(lair.buriedLegs, 36, `seed ${seed}: the buried beetle legs must survive wall cleanup`);
        assert.equal(lair.upperJoints.length, 1, `seed ${seed}: exactly one repaired upper rear-leg joint`);
        assert.equal(lair.lowerJoints.length, 1, `seed ${seed}: exactly one repaired lower rear-leg joint`);
        // Both eyes share one column, and the two repaired joints share the
        // opposite end's column on the fixed rear-leg rows 8 and 14 (the
        // vertical flip component only swaps those rows).
        const eyeColumns = new Set(lair.eyeBars.map(([x]) => x));
        assert.equal(eyeColumns.size, 1, `seed ${seed}: the eyes share a column`);
        const eyeColumn = lair.eyeBars[0]?.[0];
        const jointColumns = new Set([...lair.upperJoints, ...lair.lowerJoints]
            .map(([x]) => x));
        assert.equal(jointColumns.size, 1, `seed ${seed}: the repaired joints share a column`);
        const jointColumn = lair.upperJoints[0]?.[0];
        assert.ok(eyeColumn === 31 || eyeColumn === 49, `seed ${seed}: unexpected eye column ${eyeColumn}`);
        assert.equal(jointColumn, eyeColumn === 31 ? 68 : 12, `seed ${seed}: the rear joints sit opposite the eyes`);
        const jointRows = [...lair.upperJoints, ...lair.lowerJoints]
            .map(([, y]) => y).sort((a, b) => a - b);
        assert.deepEqual(jointRows, [8, 14], `seed ${seed}: rear-leg joint rows`);
        (eyeColumn === 31 ? leftEyeLairs : rightEyeLairs).push(lair);
    }
    // If every seed rolled the same mirror image, this test would only
    // repeat the first one's coverage, so require both to have appeared.
    assert.ok(leftEyeLairs.length > 0 && rightEyeLairs.length > 0, `both mirror images must be generated across the seeds (got ${leftEyeLairs.length} left-eyed, ${rightEyeLairs.length} right-eyed)`);
});
//# sourceMappingURL=baalz_level_fixup.test.js.map