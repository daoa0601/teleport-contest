import test from 'node:test';
import assert from 'node:assert/strict';

import { HOLE, ROLLING_BOULDER_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateSokobanLevel2 } from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildLevel2(variant) {
    const active = freshSpecialLevel({
        prototype: 'soko2', variant, seed: variant * 97, depth: 8,
    });
    await generateSokobanLevel2(active);
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

function stairCount() {
    let count = 0;
    for (let stair = game.stairs; stair; stair = stair.next) count++;
    return count;
}

test('both Sokoban level 2 layouts build their live puzzle', async () => {
    for (const [variant, boulderCount, holeCount] of [
        [1, 13, 10],
        [2, 16, 11],
    ]) {
        await buildLevel2(variant);
        const boulders = floorObjects().filter(
            object => object.otyp === BOULDER,
        );
        const holes = game.level.traps.filter(trap => trap.ttyp === HOLE);
        const rolling = game.level.traps.filter(
            trap => trap.ttyp === ROLLING_BOULDER_TRAP,
        );

        assert.equal(game.level.flags.sokoban_rules, true);
        assert.equal(game.level.flags.noteleport, true);
        assert.equal(game.level.flags.premapped, true);
        assert.equal(stairCount(), 2);
        assert.ok(boulders.length >= boulderCount);
        assert.equal(holes.length, holeCount);
        assert.equal(rolling.length, 1);
    }
});

test('layout 2 blocks random monsters from its filled-hole row', async () => {
    await buildLevel2(2);
    const exclusion = game.level.exclusionZones.find(
        zone => zone.type === 'monster-generation',
    );
    assert.ok(exclusion);
    assert.equal(exclusion.ly, exclusion.hy);
    assert.ok(exclusion.hx > exclusion.lx);
});
