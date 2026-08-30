import test from 'node:test';
import assert from 'node:assert/strict';

import { CORR, CORPSTAT_HISTORIC, FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateOracleLevel } from '../js/mklev.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

test('the Oracle lives among the historic centaur statues', async () => {
    const active = freshSpecialLevel({
        prototype: 'oracle', seed: 3101, depth: 7,
    });
    await generateOracleLevel(active);

    assert.equal(game.level.monsters.filter(
        monster => MONSTER_NAME[monster.mnum] === 'Oracle',
    ).length, 1);

    const statues = (game.level.objects || []).flat(2).filter(
        object => object?.otyp === STATUE
            && (object.spe & CORPSTAT_HISTORIC)
            && MONSTER_SYMBOL[object.corpsenm] === 29,
    );
    assert.equal(statues.length, 8);

    let fountains = 0;
    let corridors = 0;
    for (const column of game.level.locations) {
        for (const location of column) {
            if (location.typ === FOUNTAIN) fountains++;
            else if (location.typ === CORR) corridors++;
        }
    }
    assert.equal(fountains, 4);
    assert.ok(corridors > 0);

    let stairs = 0;
    for (let stair = game.stairs; stair; stair = stair.next) stairs++;
    assert.equal(stairs, 2);
});
