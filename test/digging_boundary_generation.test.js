import { requireFixtureGame } from './support/game-state.js';
import { createSpecialLevel } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, IS_STWALL, ROWNO, W_NONDIGGABLE, W_NONPASSWALL } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { goodPosition } from '../js/teleport_rules.js';
import { freshSpecialLevel } from './support/special-level.js';
function prepareLevel(prototype, depth) {
    freshSpecialLevel({ prototype, seed: 271, depth });
    requireFixtureGame(game);
    game.flags.bones = false;
    assert.ok(game.specialLevels);
    game.specialLevels.clear();
    game.medusa_level = createSpecialLevel({ dnum: 0, dlevel: 20 });
}
void test('ordinary generated levels prevent digging and phasing beyond their boundaries', async () => {
    prepareLevel('ordinary', 3);
    requireFixtureGame(game);
    await mklev();
    const location = requireGameLevel(game).requireAt(COLNO - 1, 0);
    assert.ok(IS_STWALL(location.typ));
    assert.ok(location.wall_info & W_NONDIGGABLE);
    assert.ok(location.wall_info & W_NONPASSWALL);
    assert.equal(goodPosition(COLNO - 1, 0, {
        kind: 'species', mnum: MONSTER_NAME.indexOf('xorn'),
    }), false, 'a wall-passing monster cannot enter the outer boundary');
});
void test('the generated Plane of Earth retains diggable, phaseable outer stone', async () => {
    prepareLevel('earth', 5);
    requireFixtureGame(game);
    game.earth_level = createSpecialLevel({ dnum: 0, dlevel: 5 });
    game.astral_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    assert.ok(game.specialLevels);
    game.specialLevels.set('earth', createSpecialLevel({ ...game.earth_level, flags: { town: false } }));
    game.specialLevels.set('air', createSpecialLevel({ dnum: 0, dlevel: 4, flags: { town: false } }));
    game._specialLevelPrototype = 'earth';
    await mklev();
    let stoneCount = 0;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = requireGameLevel(game).requireAt(x, y);
            if (!IS_STWALL(location.typ))
                continue;
            stoneCount++;
            assert.equal(location.wall_info & (W_NONDIGGABLE | W_NONPASSWALL), 0, `Earth stone at ${x},${y} must remain diggable and phaseable`);
        }
    }
    assert.ok(stoneCount > 0);
    assert.equal(goodPosition(COLNO - 1, 0, {
        kind: 'species', mnum: MONSTER_NAME.indexOf('xorn'),
    }), true);
});
//# sourceMappingURL=digging_boundary_generation.test.js.map