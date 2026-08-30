import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { generateVladsTowerLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_STRANGULATION,
    TALLOW_CANDLE, WAX_CANDLE,
} from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildTower(floor) {
    const prototype = `tower${floor}`;
    const active = freshSpecialLevel({
        prototype, seed: 2100 + floor, depth: 30,
    });
    await generateVladsTowerLevel(active);
    return active;
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

function containedObjects() {
    return floorObjects().flatMap(object => object.contents || []);
}

function ladderCount() {
    let count = 0;
    for (let stair = game.stairs; stair; stair = stair.next)
        if (stair.isladder) count++;
    return count;
}

test("Vlad's Tower keeps each floor's game rules", async () => {
    await buildTower(1);
    assert.equal(game.level.monsters.filter(
        monster => MONSTER_NAME[monster.mnum] === 'Vlad the Impaler',
    ).length, 1);
    const brides = game.level.monsters.filter(
        monster => ['Madame', 'Marquise', 'Countess'].includes(monster.name),
    );
    assert.equal(brides.length, 3);
    assert.ok(brides.every(monster => monster.waiting));
    const candles = containedObjects().filter(
        object => object.otyp === WAX_CANDLE || object.otyp === TALLOW_CANDLE,
    );
    assert.equal(candles.length, 2);
    assert.ok(candles.every(object => object.quan >= 4 && object.quan <= 8));

    await buildTower(2);
    const amulets = new Set(containedObjects().map(object => object.otyp));
    assert.ok(amulets.has(AMULET_OF_LIFE_SAVING));
    assert.ok(amulets.has(AMULET_OF_STRANGULATION));
    assert.equal(ladderCount(), 2);

    const bottom = await buildTower(3);
    assert.equal(game.level.traps.length, 4);
    assert.equal(bottom.explicitBranchRegion.lx,
        bottom.explicitBranchRegion.hx);
    assert.equal(bottom.explicitBranchRegion.ly,
        bottom.explicitBranchRegion.hy);
    assert.equal(ladderCount(), 1);
});
