import test from 'node:test';
import assert from 'node:assert/strict';

import { FOUNTAIN, LEVEL_TELEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateMinesEnd } from '../js/mklev.js';
import { FLINT, LUCKSTONE } from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildMinesEnd(variant) {
    const active = freshSpecialLevel({
        prototype: 'minend', variant, seed: variant * 101, depth: 12,
    });
    await generateMinesEnd(active);
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

function terrainCount(typ) {
    let count = 0;
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            if (game.level.at(x, y)?.typ === typ) count++;
    return count;
}

function stairCount() {
    let count = 0;
    for (let stair = game.stairs; stair; stair = stair.next) count++;
    return count;
}

test("all three Mines' End layouts contain their live prize", async () => {
    for (let variant = 1; variant <= 3; variant++) {
        await buildMinesEnd(variant);
        const prizes = floorObjects().filter(object =>
            object.otyp === LUCKSTONE && object.achievement);

        assert.equal(game.level.flags.is_special, true);
        assert.equal(game.level.flags.is_maze_lev, true);
        assert.equal(stairCount(), 1);
        assert.equal(prizes.length, 1);
        assert.ok(game.level.monsters.length > 10);
    }
});

test('the catacombs contain fountains and trapped treasure sites', async () => {
    await buildMinesEnd(3);
    assert.equal(game.level.flags.nommap, true);
    assert.equal(terrainCount(FOUNTAIN), 2);

    const teleports = game.level.traps.filter(
        trap => trap.ttyp === LEVEL_TELEP,
    );
    assert.equal(teleports.length, 2);
    const trappedCoordinates = new Set(
        teleports.map(trap => `${trap.tx},${trap.ty}`),
    );
    const trappedTreasure = floorObjects().filter(object =>
        [LUCKSTONE, FLINT].includes(object.otyp)
        && trappedCoordinates.has(`${object.ox},${object.oy}`));
    assert.equal(trappedTreasure.length, 2);
});
