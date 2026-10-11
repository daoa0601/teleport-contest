import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, CORPSTAT_HISTORIC, FOUNTAIN } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateOracleLevel } from '../js/mklev.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { floorObjects, levelStairs } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
void test('the Oracle lives among the historic centaur statues', async () => {
    const active = freshSpecialLevel({
        prototype: 'oracle', seed: 3101, depth: 7,
    });
    requirePlayingGame(game);
    await generateOracleLevel(active);
    assert.equal(game.level.monsters.filter(monster => MONSTER_NAME[monster.mnum] === 'Oracle').length, 1);
    const statues = floorObjects(game.level).filter(object => object?.otyp === STATUE
        && (object.spe & CORPSTAT_HISTORIC)
        && object.corpsenm !== undefined && MONSTER_SYMBOL[object.corpsenm] === 29);
    assert.equal(statues.length, 8);
    let fountains = 0;
    let corridors = 0;
    for (const column of game.level.locations) {
        for (const location of column) {
            if (location.typ === FOUNTAIN)
                fountains++;
            else if (location.typ === CORR)
                corridors++;
        }
    }
    assert.equal(fountains, 4);
    assert.ok(corridors > 0);
    assert.equal(levelStairs(game).length, 2);
});
//# sourceMappingURL=oracle_level.test.js.map