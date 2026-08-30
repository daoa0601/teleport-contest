import test from 'node:test';
import assert from 'node:assert/strict';

import { ALTAR, FOUNTAIN, SINK } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateMinetown } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    CORPSE, TALLOW_CANDLE, WAX_CANDLE,
} from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildMinetown(variant) {
    const active = freshSpecialLevel({
        prototype: 'minetn', variant, seed: variant * 131, depth: 6,
    });
    game.urole = { key: 'wizard' };
    await generateMinetown(active);
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

function liveMonsterCount(name) {
    const type = MONSTER_NAME.indexOf(name);
    return game.level.monsters.filter(monster =>
        monster.mnum === type && (monster.mhp ?? 1) > 0 && !monster.dead)
        .length;
}

test('all seven Minetown layouts build a populated town', async () => {
    for (let variant = 1; variant <= 7; variant++) {
        await buildMinetown(variant);
        assert.equal(game.level.flags.is_special, true, `variant ${variant}`);
        assert.equal(game.level.flags.has_town, true, `variant ${variant}`);
        assert.equal(stairCount(), 2, `variant ${variant} stairs`);
        assert.ok(terrainCount(FOUNTAIN) >= 2, `variant ${variant} fountains`);
        assert.equal(terrainCount(ALTAR), 1, `variant ${variant} altar`);
        assert.ok(game.level.monsters.length >= 15,
            `variant ${variant} population`);
    }
});

test('Orcish Town contains the dead residents and replacement candles',
    async () => {
        await buildMinetown(1);
        const objects = floorObjects();
        const candleQuantity = objects
            .filter(object => [WAX_CANDLE, TALLOW_CANDLE].includes(object.otyp))
            .reduce((total, candle) => total + (candle.quan ?? 1), 0);
        assert.equal(objects.filter(object => object.otyp === CORPSE).length, 11);
        assert.ok(candleQuantity >= 7);
        assert.ok(liveMonsterCount('orc-captain')
            + liveMonsterCount('Uruk-hai')
            + liveMonsterCount('Mordor orc') > 0);
        assert.ok(liveMonsterCount('orc shaman') >= 1);
    });

test('Bazaar Town can include its furnished sink room', async () => {
    await buildMinetown(7);
    assert.equal(terrainCount(SINK), 1);
    assert.ok(game.level.nsubroom > 10);
});
