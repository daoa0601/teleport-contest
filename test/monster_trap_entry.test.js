import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ANTI_MAGIC, BEAR_TRAP, PIT, ROLLING_BOULDER_TRAP, RUST_TRAP, SPIKED_PIT, TELEP_TRAP,
    W_ARMF, W_ARMH, WEB,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    finishDeferredMonsterRollingBoulderPlacement,
    resumeDeferredMonsterRollingBoulderDeath, resumeDeferredMonsterTrap,
    triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { BOULDER, IRON_SHOES, ORCISH_HELM } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

function monsterAtTrap(trapType, { monster = {}, trap = {} } = {}) {
    return freshMonsterTrapRoom(trapType, {
        monster: {
            species: 'little dog',
            hitPoints: 8,
            ...monster,
        },
        trap,
    });
}

test('a huge monster climbs out of a pit and exposes the trap', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(PIT, {
        monster: { species: 'giant', mtrapped: 1 },
    });
    const messages = [];

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(monster.mtrapped, 0);
    assert.equal(trap.tseen, true);
    assert.ok(messages.some(message => /climbs easily out of the pit/.test(message)));
});

test('a rust monster eats the bear trap holding it', async () => {
    const { monster, trap, level } = await freshMonsterTrapRoom(BEAR_TRAP, {
        monster: { species: 'rust monster', mtrapped: 1 },
    });
    initRng(1n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, { publish: async () => {} });

    assert.equal(monster.mtrapped, 0);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(monster.meating, 5);
});

test('a rust monster eats pit spikes but remains in the pit', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(SPIKED_PIT, {
        monster: { species: 'rust monster', mtrapped: 1 },
    });
    initRng(1n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, { publish: async () => {} });

    assert.equal(trap.ttyp, PIT);
    assert.equal(monster.mtrapped, 1);
    assert.equal(monster.meating, 5);
});

test('a visible monster becomes caught in a web', async () => {
    const { monster, trap } = await monsterAtTrap(WEB);

    triggerImmediateMonsterTrap(monster, game);

    assert.equal(monster.mtrapped, 1);
    assert.equal(trap.tseen, true);
});

test('a monster which recognizes a web can avoid becoming trapped', async () => {
    const { monster } = await monsterAtTrap(WEB, {
        monster: { mtrapseen: 1 << (WEB - 1) },
        trap: { tseen: true },
    });
    initRng(3n);

    triggerImmediateMonsterTrap(monster, game);

    assert.equal(monster.mtrapped ?? 0, 0);
    assert.equal(monster.mtrapseen, 1 << (WEB - 1));
});

test('a monster can avoid a familiar ordinary teleport trap', async () => {
    const { monster } = await monsterAtTrap(TELEP_TRAP, {
        monster: { mtrapseen: 1 << (TELEP_TRAP - 1) },
        trap: { tseen: true },
    });
    initRng(3n);

    triggerImmediateMonsterTrap(monster, game);

    assert.deepEqual({ x: monster.mx, y: monster.my }, { x: 11, y: 10 });
});

test('a fixed teleport trap sends a monster to its free destination', async () => {
    const destination = { x: 15, y: 10 };
    const { monster } = await monsterAtTrap(TELEP_TRAP, {
        monster: {
            mtrapseen: 1 << (TELEP_TRAP - 1),
            mtrack: [{ x: 9, y: 10 }],
        },
        trap: { tseen: true, teledest: destination },
    });

    triggerImmediateMonsterTrap(monster, game);

    assert.deepEqual({ x: monster.mx, y: monster.my }, destination);
    assert.deepEqual(monster.mtrack, []);
});

test('a visible bear trap catches and hurts a pony', async () => {
    const { monster, trap } = await monsterAtTrap(BEAR_TRAP, {
        monster: { mnum: 100, hitPoints: 20 },
    });
    initRng(5n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game);

    assert.equal(monster.mtrapped, 1);
    assert.ok(monster.mhp < 20);
    assert.equal(trap.tseen, true);
});

test('a bear trap removes a monster it kills', async () => {
    const { monster } = await monsterAtTrap(BEAR_TRAP, {
        monster: { mnum: 100, hitPoints: 1 },
    });

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        rollDice: () => 8,
        publish: async () => {},
    });

    assert.equal(game.level.monsters.includes(monster), false);
});

test('iron shoes protect a caught monster from a bear trap', async () => {
    const shoes = knownObject(IRON_SHOES, {
        owornmask: W_ARMF, where: 'monster',
    });
    const { monster } = await monsterAtTrap(BEAR_TRAP, {
        monster: { mnum: 100, hitPoints: 20, inventory: [shoes] },
    });

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async () => {},
    });

    assert.equal(monster.mhp, 20);
});

test('rust-trap water rusts an iron helmet worn by a monster', async () => {
    const helmet = knownObject(ORCISH_HELM, {
        owornmask: W_ARMH, oeroded: 0, where: 'monster',
    });
    const { monster } = await monsterAtTrap(RUST_TRAP, {
        monster: { inventory: [helmet] },
    });
    initRng(1n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async () => {},
    });

    assert.equal(helmet.oeroded, 1);
});

test('a rust trap removes an iron golem which falls to pieces', async () => {
    const { monster } = await monsterAtTrap(RUST_TRAP, {
        monster: { species: 'iron golem', hitPoints: 80 },
    });

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async () => {},
    });

    assert.equal(game.level.monsters.includes(monster), false);
});

test('a boulder-hit vampire rises while the boulder keeps rolling',
    async () => {
        const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
        const { monster } = await monsterAtTrap(ROLLING_BOULDER_TRAP, {
            monster: {
                species: 'wolf', hitPoints: 1, maxHitPoints: 20,
                mac: 20, cham: vampireLeader,
            },
            trap: {
                launch: { x: 9, y: 10 },
                launch2: { x: 15, y: 10 },
            },
        });
        const boulder = floorObject(BOULDER, 9, 10);

        const action = triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterRollingBoulderDeath(action, game);
        await finishDeferredMonsterRollingBoulderPlacement(action, game);

        assert.equal(monster.mnum, vampireLeader);
        assert.equal(game.level.monsters.includes(monster), true);
        assert.equal(game.level.objects[15][10].includes(boulder), true);
    });

test('enchanted iron shoes absorb an anti-magic trap', async () => {
    const shoes = knownObject(IRON_SHOES, {
        spe: 1, enchantment: 1, owornmask: W_ARMF,
    });
    const { monster } = await monsterAtTrap(ANTI_MAGIC, {
        monster: { inventory: [shoes] },
    });

    triggerImmediateMonsterTrap(monster, game);

    assert.equal(shoes.spe, 0);
    assert.equal(monster.mhp, 8);
});

test('an anti-magic trap drains a monster which casts spells', async () => {
    const { monster, trap } = await monsterAtTrap(ANTI_MAGIC, {
        monster: { species: 'gnomish wizard' },
    });
    initRng(17n);

    triggerImmediateMonsterTrap(monster, game);

    assert.ok(monster.mspec_used > 0);
    assert.equal(trap.tseen, true);
});

test('an anti-magic trap hurts a magic-resistant monster', async () => {
    const { monster } = await monsterAtTrap(ANTI_MAGIC, {
        monster: { species: 'baby gray dragon', hitPoints: 20 },
    });
    initRng(19n);

    triggerImmediateMonsterTrap(monster, game);

    assert.ok(monster.mhp >= 16 && monster.mhp < 20);
});

test('fatal anti-magic compression removes the monster', async () => {
    const { monster } = await monsterAtTrap(ANTI_MAGIC, {
        monster: { species: 'baby gray dragon', hitPoints: 1 },
    });
    const messages = [];
    initRng(23n);

    const action = triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: () => 1,
        publish: async message => messages.push(message),
    });

    assert.equal(monster.dead, true);
    assert.deepEqual(game.level.monsters, []);
    assert.deepEqual(messages, [
        'The baby gray dragon is killed by the compression from an anti-magic field!',
    ]);
});
