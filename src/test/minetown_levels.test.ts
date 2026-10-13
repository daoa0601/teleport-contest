import test from 'node:test';
import assert from 'node:assert/strict';

import { ALTAR, FOUNTAIN, SINK, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateMinetown } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    CORPSE, TALLOW_CANDLE, WAX_CANDLE,
} from '../js/object_data.js';
import { roles } from '../js/roles.js';
import { roomForRoomno } from '../js/room.js';
import {
    countTerrain, floorObjects, levelStairs,
} from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildMinetown(variant: number) {
    const active = freshSpecialLevel({
        prototype: 'minetn', variant, seed: variant * 131, depth: 6,
    });
    requirePlayingGame(game);
    const role = roles.find(entry => entry.key === 'wizard');
    assert.ok(role);
    game.urole = role;
    await generateMinetown(active);
}

for (const variant of [2, 3, 4, 7]) {
    void test(`Minetown layout ${variant} assigns a priest to its temple subroom`, async () => {
        await buildMinetown(variant);
        requirePlayingGame(game);
        const priests = game.level.monsters.filter(monster => monster.ispriest);

        assert.equal(priests.length, 1, 'the shrine must have one resident priest');
        const priest = priests[0];
        assert.ok(priest?.epri);
        const shrine = priest.epri.shrpos;
        assert.equal(game.level.requireAt(shrine.x, shrine.y).typ, ALTAR);
        assert.equal(roomForRoomno(game.level, priest.epri.shroom)?.rtype, TEMPLE);
        assert.equal(priest.mpeaceful, 1);
    });
}

void test('College Town retains ordinary room placement rules', async () => {
    await buildMinetown(4);
    requirePlayingGame(game);

    assert.equal(game.level.flags.is_maze_lev, false);
});

void test('Grotto Town uses the maze placement rules declared by its Lua level', async () => {
    await buildMinetown(5);
    requirePlayingGame(game);

    assert.equal(game.level.flags.is_maze_lev, true);
});

function liveMonsterCount(name: string) {
    requirePlayingGame(game);
    const type = MONSTER_NAME.indexOf(name);
    return game.level.monsters.filter(monster =>
        monster.mnum === type && (monster.mhp ?? 1) > 0 && !monster.dead)
        .length;
}

void test('all seven Minetown layouts build a populated town', async () => {
    for (let variant = 1; variant <= 7; variant++) {
        await buildMinetown(variant);
        requirePlayingGame(game);
        assert.equal(game.level.flags.is_special, true, `variant ${variant}`);
        assert.equal(game.level.flags.has_town, true, `variant ${variant}`);
        assert.equal(levelStairs(game).length, 2, `variant ${variant} stairs`);
        assert.ok(countTerrain(game.level, FOUNTAIN) >= 2,
            `variant ${variant} fountains`);
        assert.equal(countTerrain(game.level, ALTAR), 1,
            `variant ${variant} altar`);
        assert.ok(game.level.monsters.length >= 15,
            `variant ${variant} population`);
    }
});

void test('Orcish Town contains the dead residents and replacement candles',
    async () => {
        await buildMinetown(1);
        requirePlayingGame(game);
        const objects = floorObjects(game.level);
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

void test('Bazaar Town can include its furnished sink room', async () => {
    await buildMinetown(7);
    requirePlayingGame(game);
    assert.equal(countTerrain(game.level, SINK), 1);
    assert.ok((game.level.nsubroom ?? 0) > 10);
});
