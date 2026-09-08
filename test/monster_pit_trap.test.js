import test from 'node:test';
import assert from 'node:assert/strict';

import { PIT, W_AMUL, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import {
    AMULET_OF_LIFE_SAVING, CORPSE, STATUE,
} from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { equipMonsterObject } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

test('a grounded monster falls into a pit', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(PIT, {
        monster: { species: 'giant' },
    });
    const hitPointsBefore = monster.mhp;
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        rollOne: () => 3,
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mtrapped, 1);
    assert.equal(monster.mhp, hitPointsBefore - 3);
    assert.equal(trap.tseen, true);
    assert.match(messages[0], /falls into a pit/);
});

test('a flying monster passes over a pit', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(PIT, {
        monster: { species: 'red dragon' },
    });
    const hitPointsBefore = monster.mhp;

    const action = triggerImmediateMonsterTrap(monster, game);

    assert.equal(action.event, null);
    assert.equal(monster.mtrapped ?? 0, 0);
    assert.equal(monster.mhp, hitPointsBefore);
    assert.equal(trap.tseen ?? false, false);
});

test('falling forces contact with a wielded cockatrice corpse before the monster can eat a cure',
    async () => {
        const { level, monster } = await freshMonsterTrapRoom(PIT, {
            monster: { species: 'giant' },
        });
        const corpse = knownObject(CORPSE, { corpsenm: 10 });
        equipMonsterObject(monster, corpse, W_WEP);
        equipMonsterObject(monster, untimedCorpse(MONSTER_NAME.indexOf('lizard')), 0);
        const messages = [];

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async message => messages.push(message),
        });

        assert.equal(level.monsters.includes(monster), false);
        assert.ok(floorObjectsAt(level, 11, 10).some(object =>
            object.otyp === STATUE && object.corpsenm === monster.mnum));
        const fall = messages.findIndex(message =>
            message.includes('falls into a pit'));
        const touch = messages.findIndex(message =>
            message.includes('touches the cockatrice corpse'));
        assert.ok(fall >= 0 && touch > fall);
    });

test('a life-saved monster stops wielding the corpse that petrified it',
    async () => {
        const { level, monster } = await freshMonsterTrapRoom(PIT, {
            monster: { species: 'giant' },
        });
        const corpse = equipMonsterObject(
            monster,
            knownObject(CORPSE, { corpsenm: 10 }),
            W_WEP,
        );
        equipMonsterObject(
            monster,
            knownObject(AMULET_OF_LIFE_SAVING),
            W_AMUL,
        );
        pushKeys(' '.repeat(12));

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            publish: async () => {},
            rollOne: () => 1,
        });

        assert.equal(level.monsters.includes(monster), true);
        assert.ok(monster.mhp > 0);
        assert.equal(monster.inventory.includes(corpse), true);
        assert.equal(monster.mw, null);
        assert.equal(corpse.owornmask & W_WEP, 0);
    });
