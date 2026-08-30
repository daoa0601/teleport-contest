import test from 'node:test';
import assert from 'node:assert/strict';

import { MAGIC_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateMedusaLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    BOULDER, CRYSTAL_BALL, EGG, STATUE,
} from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

const monsterType = name => MONSTER_NAME.indexOf(name);

async function buildMedusa(variant, seed = variant * 71) {
    const active = freshSpecialLevel({
        prototype: 'medusa', variant, seed, depth: 21,
        monsterAlignment: 'chaos',
    });
    await generateMedusaLevel(active);
    return active;
}

function stairs() {
    const result = [];
    for (let stair = game.stairs; stair; stair = stair.next)
        result.push(stair);
    return result;
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

function liveMonsters(name) {
    const type = monsterType(name);
    return game.level.monsters.filter(monster =>
        monster.mnum === type && (monster.mhp ?? 1) > 0 && !monster.dead);
}

test('all four Medusa scripts build their island and stair pair', async () => {
    for (let variant = 1; variant <= 4; variant++) {
        await buildMedusa(variant);
        const levelStairs = stairs();
        const down = levelStairs.find(stair => !stair.up);
        const medusa = liveMonsters('Medusa')[0];

        assert.equal(game.level.flags.is_special, true, `variant ${variant}`);
        assert.equal(game.level.flags.is_maze_lev, true, `variant ${variant}`);
        assert.equal(game.level.flags.noteleport, true, `variant ${variant}`);
        assert.ok(game.level.nroom > 0, `variant ${variant} arrival room`);
        assert.equal(levelStairs.length, 2, `variant ${variant} stairs`);
        assert.ok(medusa, `variant ${variant} Medusa`);
        assert.deepEqual([medusa.mx, medusa.my], [down.sx, down.sy],
            `variant ${variant} downstairs`);
    }
});

test('the second island contains its guards, statues, and fixed hazard',
    async () => {
        await buildMedusa(2);
        assert.equal(liveMonsters('titan').length, 1);
        assert.equal(liveMonsters('gremlin').length, 1);
        assert.equal(liveMonsters('electric eel').length, 6);
        assert.equal(liveMonsters('stone golem').length, 4);
        assert.equal(liveMonsters('cobra').length, 2);

        const objects = floorObjects();
        assert.ok(objects.filter(object => object.otyp === STATUE).length >= 9);
        assert.ok(objects.filter(object => object.otyp === BOULDER).length >= 2);
        assert.ok(game.level.traps.some(trap => trap.ttyp === MAGIC_TRAP));
    });

test('the fourth island contains the dragon nest and palace treasure',
    async () => {
        await buildMedusa(4);
        const dragon = liveMonsters('yellow dragon')[0];
        const kraken = liveMonsters('kraken')[0];
        assert.ok(dragon);
        assert.ok(kraken);

        const objects = floorObjects();
        const eggs = objects.filter(object => object.otyp === EGG);
        assert.ok(objects.some(object => object.otyp === CRYSTAL_BALL));
        assert.ok(eggs.length >= 1 && eggs.length <= 3);
        assert.ok(eggs.every(egg => egg.corpsenm === monsterType('yellow dragon')));
        assert.ok(eggs.every(egg => egg.ox === dragon.mx && egg.oy === dragon.my));
    });
