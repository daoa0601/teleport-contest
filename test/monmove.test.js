import test from 'node:test';
import assert from 'node:assert/strict';

import {
    allocateMonsterMovement, mcalcmove, mfndpos, naturalMonsterSpeed,
    quietMonsterActionRng,
    resolveDeferredMonsterBreath, runQuietMonsterActions,
} from '../js/monmove.js';
import { finishMonsterLiquidDeath } from '../js/monster_death.js';
import {
    FOUNTAIN, IRONBARS, LAVAPOOL, POOL, ROOM, WATER, W_WEP,
} from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resolveMonsterLiquid } from '../js/mon.js';
import {
    OBJECT_NAMES, ROCK, SCR_TELEPORTATION,
} from '../js/object_data.js';
import { roles } from '../js/roles.js';
import {
    knownObject, uninitializedObject,
} from './support/game-objects.js';
import {
    createMonsterAt, equipMonsterObject,
} from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function rolls(values) {
    let index = 0;
    return () => values[index++];
}

test('natural monster speed and randomized movement use species data', () => {
    assert.equal(naturalMonsterSpeed({ mnum: 100 }), 16); // pony
    assert.equal(naturalMonsterSpeed({ mnum: 32 }), 18); // kitten
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([2])), 24);
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([4])), 12);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([5])), 24);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([6])), 12);
});

test('monster allocation applies newest-first movement to current actors',
    async () => {
        freshObjectRoom({ right: 70, recalculateVision: false });
        const kobold = await createMonsterAt('kobold', 66, 16);
        const pony = await createMonsterAt('pony', 67, 9);
        const monsters = [kobold, pony];

        allocateMonsterMovement(monsters, rolls([2, 3]));

        assert.equal(pony.movement, 24);
        assert.equal(kobold.movement, 12);
    });

test('galloping gives the mounted steed extra movement', async () => {
    freshObjectRoom({
        context: { mv: true },
        recalculateVision: false,
    });
    const pony = await createMonsterAt('pony', 11, 10);
    tameMonster(pony, game);
    game.u.usteed = pony;
    game.level.monsters = game.level.monsters.filter(
        monster => monster !== pony,
    );
    game.u.ugallop = 30;

    allocateMonsterMovement([pony], rolls([0, 0]), game);

    assert.equal(pony.movement, 36);
});

test('Knight starts with the source pony species', () => {
    assert.equal(roles.find(role => role.key === 'knight').petnum, 100);
});

test('a tame red dragon bites and claws an adjacent enemy', async () => {
    freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 10,
        recalculateVision: false,
    });
    const dragon = await createMonsterAt('red dragon', 10, 10);
    tameMonster(dragon, game);
    dragon.mhp = dragon.mhpmax = 100;
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mhp = goblin.mhpmax = 100;
    goblin.m_lev = 1;
    goblin.mac = 100;

    const action = quietMonsterActionRng(
        dragon,
        game,
        () => 1,
        (count, sides) => count * sides,
        () => 1,
    );

    assert.deepEqual(
        action.movement.attack.results.map(attack => attack.type),
        ['bite', 'claw', 'claw'],
    );
    assert.equal(goblin.mhp, 68);
});

test('a silver weapon sears a lycanthropic hero in melee', async () => {
    freshObjectRoom({
        heroX: 10,
        heroY: 10,
        hero: {
            uac: 10,
            uhp: 100,
            uhpmax: 100,
            ulycn: MONSTER_NAME.indexOf('werewolf'),
        },
        recalculateVision: false,
    });
    const silverDagger = uninitializedObject(
        OBJECT_NAMES.indexOf('silver dagger'),
    );
    const soldier = await createMonsterAt('soldier', 11, 10);
    Object.assign(soldier, {
        mhp: 30, mhpmax: 30, m_lev: 10,
        mux: 10, muy: 10,
    });
    equipMonsterObject(soldier, silverDagger, W_WEP);

    const action = quietMonsterActionRng(
        soldier,
        game,
        () => 1,
        (count, sides) => count * sides,
        range => range,
    );

    assert.equal(action.movement.attack.effect, 'physical-weapon');
    assert.equal(game.u.uhp, 68);
});

test('a monster fire blast makes a shifted vampire rise', async () => {
    const level = freshObjectRoom({
        heroX: 14, heroY: 10, recalculateVision: false,
    });
    const dragon = await createMonsterAt('red dragon', 10, 10);
    Object.assign(dragon, {
        mhp: 100, mhpmax: 100, m_lev: 15, mux: 14, muy: 10,
    });
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = await createMonsterAt('wolf', 12, 10);
    Object.assign(wolf, {
        mhp: 1, mhpmax: 20, cham: vampireLeader,
    });
    const [action] = runQuietMonsterActions(
        [dragon], game, () => 1, (count, sides) => count * sides, () => 1,
    );

    await resolveDeferredMonsterBreath(
        action, game, async () => {},
        () => 1, (count, sides) => count * sides, () => 1,
    );

    assert.equal(wolf.mnum, vampireLeader);
    assert.equal(wolf.mhp > 0, true);
    assert.equal(level.monsters.includes(wolf), true);
});

test('a land monster in lava burns and drops what it carried', async () => {
    const level = freshObjectRoom({ recalculateVision: false });
    level.at(12, 10).typ = LAVAPOOL;
    const rock = knownObject(ROCK);
    const ant = await createMonsterAt('giant ant', 12, 10);
    ant.mhp = ant.mhpmax = 4;
    addObjectToMonsterInventory(ant, rock);

    const result = await resolveMonsterLiquid(ant, game, {
        finishDeath: finishMonsterLiquidDeath,
    });

    assert.equal(result.dead, true);
    assert.equal(level.monsters.includes(ant), false);
    assert.equal(level.objects[12][10].includes(rock), true);
});

test('a monster which survives lava burns vulnerable carried items',
    async () => {
        const level = freshObjectRoom({ recalculateVision: false });
        level.at(12, 10).typ = LAVAPOOL;
        const scroll = knownObject(SCR_TELEPORTATION);
        const fireAnt = await createMonsterAt('fire ant', 12, 10);
        fireAnt.mhp = fireAnt.mhpmax = 20;
        addObjectToMonsterInventory(fireAnt, scroll);

        await resolveMonsterLiquid(fireAnt, game, {
            finishDeath: finishMonsterLiquidDeath,
            random: range => range - 1,
        });

        assert.equal(fireAnt.mhp, 19);
        assert.deepEqual(fireAnt.minvent, []);
    });

test('a gremlin can multiply in a fountain and dry it up', async () => {
    const level = freshObjectRoom();
    level.at(12, 10).typ = FOUNTAIN;
    level.flags.nfountains = 1;
    const gremlin = await createMonsterAt('gremlin', 12, 10);
    gremlin.mhp = gremlin.mhpmax = 12;
    const messages = [];

    const result = await resolveMonsterLiquid(gremlin, game, {
        announce: async message => messages.push(message),
        finishDeath: finishMonsterLiquidDeath,
        monsterMoving: false,
        random: rolls([1, 0]),
    });

    assert.ok(result.clone);
    assert.equal(level.monsters.length, 2);
    assert.equal(gremlin.mhp, 6);
    assert.equal(result.clone.mhp, 6);
    assert.equal(level.at(12, 10).typ, ROOM);
    assert.equal(level.flags.nfountains, 0);
    assert.deepEqual(messages, ['The fountain dries up!']);
});

test('flight does not keep a monster above the Plane of Water', async () => {
    const level = freshObjectRoom();
    level.flags.is_waterlevel = true;
    level.at(12, 10).typ = POOL;
    const dragon = await createMonsterAt('red dragon', 12, 10);
    const messages = [];

    const result = await resolveMonsterLiquid(dragon, game, {
        announce: async message => messages.push(message),
        finishDeath: finishMonsterLiquidDeath,
        random: () => 0,
    });

    assert.equal(result.dead, true);
    assert.equal(level.monsters.includes(dragon), false);
    assert.deepEqual(messages, ['The red dragon drowns.']);
});

test('a drowning vampire wolf rises as a flying vampire leader', async () => {
    const level = freshObjectRoom();
    level.at(12, 10).typ = POOL;
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = await createMonsterAt('wolf', 12, 10);
    wolf.cham = vampireLeader;
    const messages = [];

    const result = await resolveMonsterLiquid(wolf, game, {
        announce: async message => messages.push(message),
        finishDeath: finishMonsterLiquidDeath,
    });

    assert.equal(result.survived, true);
    assert.equal(result.relocation, null);
    assert.equal(wolf.mnum, vampireLeader);
    assert.deepEqual({ x: wolf.mx, y: wolf.my }, { x: 12, y: 10 });
    assert.equal(level.monsters.includes(wolf), true);
    assert.ok(messages.some(message =>
        message.includes('rises as a vampire')));
});

test('a flying hero keeps their steed above water', async () => {
    const level = freshObjectRoom();
    level.flags.is_waterlevel = true;
    level.at(12, 10).typ = POOL;
    const pony = await createMonsterAt('pony', 12, 10);
    const hitPoints = pony.mhp;
    game.u.usteed = pony;
    game.u.flying = true;

    await resolveMonsterLiquid(pony, game, {
        finishDeath: finishMonsterLiquidDeath,
        random: () => 0,
    });

    assert.equal(level.monsters.includes(pony), true);
    assert.equal(pony.mhp, hitPoints);
});

test('a water wall drowns a monster clinging to the ceiling', async () => {
    const level = freshObjectRoom();
    level.at(12, 10).typ = WATER;
    const piercer = await createMonsterAt('rock piercer', 12, 10);
    piercer.mundetected = 1;

    const result = await resolveMonsterLiquid(piercer, game, {
        finishDeath: finishMonsterLiquidDeath,
        random: () => 0,
    });

    assert.equal(result.dead, true);
    assert.equal(level.monsters.includes(piercer), false);
});

test('an engulfer carries only a form which fits through iron bars', async () => {
    const level = freshObjectRoom({ recalculateVision: false });
    level.at(11, 10).typ = IRONBARS;
    const fogCloud = await createMonsterAt('fog cloud', 10, 10);
    Object.assign(fogCloud, {
        mux: 10, muy: 10, mhp: 8, mhpmax: 8, mcansee: 1,
    });
    Object.assign(game.u, {
        ustuck: fogCloud,
        uswallow: 1,
        mtimedone: 0,
    });

    assert.equal(mfndpos(fogCloud, game).some(position =>
        position.x === 11 && position.y === 10), false);

    game.u.mtimedone = 10;
    game.u.umonnum = 106;
    assert.equal(mfndpos(fogCloud, game).some(position =>
        position.x === 11 && position.y === 10), true);
});
