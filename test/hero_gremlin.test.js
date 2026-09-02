import test from 'node:test';
import assert from 'node:assert/strict';

import { POOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';

const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');

function installGremlinHero(terrain) {
    const level = freshRoomWithPolymorphedHero('gremlin', {
        left: 7,
        right: 16,
        top: 6,
        bottom: 14,
        heroX: 10,
        heroY: 10,
        gameplaySeed: 3510,
        polymorph: {
            turns: 300,
            hitPoints: 17,
            maxHitPoints: 17,
        },
    });
    level.at(10, 10).typ = terrain;
    game.plname = 'Splitter';
    return level;
}

test('a gremlin can multiply while standing on a pool', async () => {
    const level = installGremlinHero(POOL);
    await runMonsterAbilityCommand(' '.repeat(4));

    const clone = level.monsters.find(monster =>
        monster.mnum === PM_GREMLIN && monster.mtame > 0);
    assert.ok(clone);
    assert.equal(game.u.mh, 9);
    assert.equal(clone.mhp, 8);
    assert.equal(game.context.move, 0);
});

test('a gremlin cannot multiply away from water', async () => {
    const level = installGremlinHero(ROOM);
    await runMonsterAbilityCommand();

    assert.equal(level.monsters.length, 0);
    assert.equal(game.u.mh, 17);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /no fountain here/);
});
