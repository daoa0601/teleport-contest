import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FIRE_TRAP, MAGIC_TRAP, W_AMUL, W_ARM,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    resumeDeferredMonsterFireTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_LIFE_SAVING, CORPSE, POT_OIL, RED_DRAGON_SCALE_MAIL,
    SCR_IDENTIFY, TOWEL,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { addTrap, floorObjects } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function freshMonsterFireTrap({
    trapType = FIRE_TRAP,
    visible = true,
    species = 'little dog',
    hitPoints = 20,
    maxHitPoints = hitPoints,
    ...monsterState
} = {}) {
    const level = freshObjectRoom();
    const monster = addMonster({
        species,
        x: 11,
        y: 10,
        hitPoints,
        maxHitPoints,
        mpeaceful: 1,
        ...monsterState,
    });
    const trap = addTrap(level, trapType, 11, 10);
    if (!visible) {
        game.blind = true;
        game.u.blindTurns = 1;
    }
    return { monster, trap };
}

function quietFireRandom(range) {
    return range === 5 ? 1 : 0;
}

test('a fire trap burns a vulnerable monster', async () => {
    const { monster, trap } = freshMonsterFireTrap();
    const messages = [];
    initRng(29n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterFireTrap(action, game, {
        random: quietFireRandom,
        publish: async message => messages.push(message),
    });

    assert.ok(monster.mhp < 20);
    assert.ok(monster.mhpmax <= 20);
    assert.equal(trap.tseen, true);
    assert.match(messages[0], /tower of flame/);
});

test('worn fire resistance stops the flame but not an exploding potion',
    async () => {
        const { monster } = freshMonsterFireTrap();
        const potion = knownObject(POT_OIL, { where: 'monster' });
        const towel = knownObject(TOWEL, { spe: 2, where: 'monster' });
        const armor = knownObject(RED_DRAGON_SCALE_MAIL, {
            owornmask: W_ARM, where: 'monster',
        });
        addObjectToMonsterInventory(monster, potion, game);
        addObjectToMonsterInventory(monster, towel, game);
        addObjectToMonsterInventory(monster, armor, game);
        const messages = [];
        let fiveSidedRolls = 0;
        const random = range => {
            if (range !== 5) return 0;
            return fiveSidedRolls++ === 0 ? 1 : 0;
        };
        initRng(31n);

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterFireTrap(action, game, {
            random,
            rollOne: () => 2,
            publish: async message => messages.push(message),
        });

        assert.equal(monster.mhp, 18);
        assert.equal(potion.where, 'gone');
        assert.equal(towel.spe, 0);
        assert.ok(messages.some(message => message.endsWith('is uninjured.')));
        assert.ok(messages.some(message => message.includes('explodes!')));
    });

test('a fire trap completely burns a paper golem', async () => {
    const { monster } = freshMonsterFireTrap({
        species: 'paper golem',
    });
    initRng(37n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterFireTrap(action, game, {
        random: quietFireRandom,
        publish: async () => {},
    });

    assert.equal(monster.dead, true);
    assert.deepEqual(game.level.monsters, []);
    assert.equal(
        floorObjects(game.level).some(object => object.otyp === CORPSE),
        false,
    );
});

test('a life-saving amulet lets a monster survive a fire trap', async () => {
    const { monster } = freshMonsterFireTrap({
        visible: false,
        hitPoints: 1,
        maxHitPoints: 1,
    });
    const amulet = knownObject(AMULET_OF_LIFE_SAVING, {
        owornmask: W_AMUL, where: 'monster',
    });
    addObjectToMonsterInventory(monster, amulet, game);
    initRng(41n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterFireTrap(action, game, {
        random: quietFireRandom,
        publish: async () => {},
    });

    assert.equal(monster.dead, false);
    assert.ok(monster.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.deepEqual(game.level.monsters, [monster]);
});

test('a fire trap burns scrolls lying under the monster', async () => {
    const { monster } = freshMonsterFireTrap();
    const scroll = floorObject(SCR_IDENTIFY, 11, 10);
    initRng(43n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterFireTrap(action, game, {
        random: range => range === 5 ? 1 : range === 100 ? 99 : 0,
        publish: async () => {},
    });

    assert.equal(scroll.where, 'gone');
    assert.deepEqual(game.level.objects[11][10], []);
});

test('a magic trap can produce the complete fire-trap effect', async () => {
    const { monster, trap } = freshMonsterFireTrap({
        trapType: MAGIC_TRAP,
    });
    initRng(17n);

    const action = triggerImmediateMonsterTrap(monster, game);

    await resumeDeferredMonsterFireTrap(action, game, {
        random: quietFireRandom,
        publish: async () => {},
    });
    assert.ok(monster.mhp < 20);
    assert.equal(trap.tseen, true);
});
