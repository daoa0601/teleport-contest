import { monsterAtPosition } from '../js/monster_location.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    allocateMonsterMovement, mfndpos, takeMonsterTurn,
    resolveDeferredMonsterBreath, runMonsterAction,
} from '../js/monmove.js';
import { mcalcmove, naturalMonsterSpeed } from '../js/monster_speed.js';
import { finishMonsterLiquidDeath } from '../js/monster_death.js';
import {
    FOUNTAIN, IRONBARS, LAVAPOOL, POOL, ROOM, WATER, W_WEP,
} from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resolveMonsterLiquid } from '../js/mon.js';
import {
    OBJECT_NAMES, ROCK, SCR_TELEPORTATION,
} from '../js/object_data.js';
import { makedog } from '../js/u_init.js';
import {
    knownObject, uninitializedObject,
} from './support/game-objects.js';
import {
    createMonsterAt, equipMonsterObject,
} from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function rolls(values: readonly number[]) {
    let index = 0;
    return () => {
        const value = values[index++];
        if (value === undefined) throw new Error(`No random value provided for draw ${index}`);
        return value;
    };
}

void test('natural monster speed and randomized movement use species data', async () => {
    freshObjectRoom();
    const pony = await createMonsterAt('pony', 11, 10);
    const kitten = await createMonsterAt('kitten', 12, 10);
    assert.equal(naturalMonsterSpeed(pony), 16); // pony
    assert.equal(naturalMonsterSpeed(kitten), 18); // kitten
    assert.equal(mcalcmove(pony, true, rolls([2])), 24);
    assert.equal(mcalcmove(pony, true, rolls([4])), 12);
    assert.equal(mcalcmove(kitten, true, rolls([5])), 24);
    assert.equal(mcalcmove(kitten, true, rolls([6])), 12);
});

void test('monster allocation applies newest-first movement to current actors',
    async () => {
        freshObjectRoom({ right: 70, recalculateVision: false });
        requirePlayingGame(game);
        const kobold = await createMonsterAt('kobold', 66, 16);
        const pony = await createMonsterAt('pony', 67, 9);
        const monsters = [kobold, pony];

        allocateMonsterMovement(monsters, rolls([2, 3]));

        assert.equal(pony.movement, 24);
        assert.equal(kobold.movement, 12);
    });

void test('galloping gives the mounted steed extra movement', async () => {
    freshObjectRoom({
        context: { mv: true },
        recalculateVision: false,
    });
    requirePlayingGame(game);
    const pony = await createMonsterAt('pony', 11, 10);
    initializePet(pony, { state: game });
    game.u.usteed = pony;
    game.level.monsters = game.level.monsters.filter(
        monster => monster !== pony,
    );
    game.u.ugallop = 30;

    allocateMonsterMovement([pony], rolls([0, 0]), game);

    assert.equal(pony.movement, 36);
});

void test('Knight starts with a living pony companion', async () => {
    freshObjectRoom({ role: 'knight' });
    const pet = await makedog();
    assert.ok(pet, 'The starting pet is created on an available square');
    assert.equal(pet.mnum, MONSTER_NAME.indexOf('pony'));
    assert.ok(pet.mhp > 0);
    assert.ok(pet.mtame && pet.mtame > 0);
});

void test('a tame red dragon bites and claws an adjacent enemy', async () => {
    freshObjectRoom({
        right: 20,
        heroX: 18,
        heroY: 10,
        recalculateVision: false,
    });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 10, 10);
    initializePet(dragon, { state: game });
    dragon.mhp = dragon.mhpmax = 100;
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mhp = goblin.mhpmax = 100;
    goblin.m_lev = 1;


    const action = await takeMonsterTurn(
        dragon,
        game,
        () => 1,
        (count, sides) => count * sides,
        () => 1,
    );

    const attack = action.movement?.attack;
    assert.ok(attack?.kind === 'monster-attack', 'The pet makes a melee attack');
    assert.deepEqual(
        attack.results.map(attack => attack.type),
        ['bite', 'claw', 'claw'],
    );
    assert.equal(goblin.mhp, 68);
});

void test('a silver weapon sears a lycanthropic hero in melee', async () => {
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
    requirePlayingGame(game);
    const silverDagger = await uninitializedObject(
        OBJECT_NAMES.indexOf('silver dagger'),
    );
    const soldier = await createMonsterAt('soldier', 11, 10);
    soldier.mhp = 30;
    soldier.mhpmax = 30;
    soldier.m_lev = 10;
    soldier.mux = 10;
    soldier.muy = 10;
    await equipMonsterObject(soldier, silverDagger, W_WEP);

    const action = await takeMonsterTurn(
        soldier,
        game,
        () => 1,
        (count, sides) => count * sides,
        range => range,
    );

    // C dmgval() asks the hero's human form about silver, so lycanthropy
    // adds no d20: d8 weapon attack plus d4 dagger at their maximum.
    assert.equal(game.u.uhp, 88);
});

void test('a monster fire blast makes a shifted vampire rise', async () => {
    const level = freshObjectRoom({
        heroX: 14, heroY: 10, recalculateVision: false,
    });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 10, 10);
    dragon.mhp = 100;
    dragon.mhpmax = 100;
    dragon.m_lev = 15;
    dragon.mux = 14;
    dragon.muy = 10;
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = await createMonsterAt('wolf', 12, 10);
    wolf.mhp = 1;
    wolf.mhpmax = 20;
    wolf.cham = vampireLeader;
    const action = await runMonsterAction(
        dragon, game, () => 1, (count, sides) => count * sides, () => 1,
    );

    assert.ok(action.movement, 'The caster has a movement action');
    const breath = action.movement.heroAttackSequence?.current;
    assert.ok(breath?.kind === 'hero-breath', 'The dragon uses its breath slot');
    await resolveDeferredMonsterBreath(
        action, breath.breath, game, async () => {},
        () => 1, (count, sides) => count * sides, () => 1,
    );

    assert.equal(wolf.mnum, vampireLeader);
    assert.equal(wolf.mhp > 0, true);
    assert.equal(level.monsters.includes(wolf), true);
});

void test('a land monster in lava burns and drops what it carried', async () => {
    const level = freshObjectRoom({ recalculateVision: false });
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = LAVAPOOL;
    const rock = await knownObject(ROCK);
    const ant = await createMonsterAt('giant ant', 12, 10);
    ant.mhp = ant.mhpmax = 4;
    await addObjectToMonsterInventory(ant, rock);

    const result = await resolveMonsterLiquid(ant, game, {
        finishDeath: finishMonsterLiquidDeath,
    });

    assert.ok(result, 'Liquid exposure produces a result');
    assert.equal(result.dead, true);
    assert.notEqual(monsterAtPosition(level, ant.mx, ant.my), ant);
    assert.equal(floorObjectsAt(level, 12, 10).includes(rock), true);
});

void test('a monster which survives lava burns vulnerable carried items',
    async () => {
        const level = freshObjectRoom({ recalculateVision: false });
        requirePlayingGame(game);
        level.requireAt(12, 10).typ = LAVAPOOL;
        const scroll = await knownObject(SCR_TELEPORTATION);
        const fireAnt = await createMonsterAt('fire ant', 12, 10);
        fireAnt.mhp = fireAnt.mhpmax = 20;
        await addObjectToMonsterInventory(fireAnt, scroll);

        await resolveMonsterLiquid(fireAnt, game, {
            finishDeath: finishMonsterLiquidDeath,
            random: range => range - 1,
        });

        assert.equal(fireAnt.mhp, 19);
        assert.deepEqual(fireAnt.minvent, []);
    });

void test('a gremlin multiplies in a fountain and dries it up', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = FOUNTAIN;
    level.flags.nfountains = 1;
    const gremlin = await createMonsterAt('gremlin', 12, 10);
    gremlin.mhp = gremlin.mhpmax = 12;
    const messages: string[] = [];

    const result = await resolveMonsterLiquid(gremlin, game, {
        announce: async message => messages.push(message),
        finishDeath: finishMonsterLiquidDeath,
        monsterMoving: false,
        random: rolls([1, 0]),
    });

    assert.ok(result && 'clone' in result && result.clone, 'The gremlin produced a living clone');
    assert.equal(level.monsters.length, 2);
    assert.equal(gremlin.mhp, 6);
    assert.equal(result.clone.mhp, 6);
    assert.equal(level.requireAt(12, 10).typ, ROOM);
    assert.equal(level.flags.nfountains, 0);
    // mon.c minliquid() -> split_mon() announces a spotted gremlin first.
    assert.deepEqual(messages, ['The gremlin multiplies!', 'The fountain dries up!']);
});

void test('flight does not keep a monster above the Plane of Water', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.water_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    level.requireAt(12, 10).typ = POOL;
    const dragon = await createMonsterAt('red dragon', 12, 10);
    const messages: string[] = [];

    const result = await resolveMonsterLiquid(dragon, game, {
        announce: async message => messages.push(message),
        finishDeath: finishMonsterLiquidDeath,
        random: () => 0,
    });

    assert.ok(result, 'Liquid exposure produces a result');
    assert.equal(result.dead, true);
    assert.notEqual(monsterAtPosition(level, dragon.mx, dragon.my), dragon);
    assert.deepEqual(messages, ['The red dragon drowns.']);
});

void test('a drowning vampire wolf rises as a flying vampire leader', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = await createMonsterAt('wolf', 12, 10);
    wolf.cham = vampireLeader;
    const messages: string[] = [];

    const result = await resolveMonsterLiquid(wolf, game, {
        announce: async message => messages.push(message),
        finishDeath: finishMonsterLiquidDeath,
    });

    assert.ok(result && 'survived' in result, 'The vampire resolved its survival');
    assert.equal(result.survived, true);
    assert.ok(wolf.mhp > 0);
    assert.equal(wolf.mnum, vampireLeader);
    assert.deepEqual({ x: wolf.mx, y: wolf.my }, { x: 12, y: 10 });
    assert.equal(level.monsters.includes(wolf), true);
    assert.ok(messages.some(message =>
        message.includes('rises as a vampire')));
});

void test('a flying hero keeps their steed above water', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.water_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    level.requireAt(12, 10).typ = POOL;
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

void test('a water wall drowns a monster clinging to the ceiling', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = WATER;
    const piercer = await createMonsterAt('rock piercer', 12, 10);
    piercer.mundetected = 1;

    const result = await resolveMonsterLiquid(piercer, game, {
        finishDeath: finishMonsterLiquidDeath,
        random: () => 0,
    });

    assert.ok(result, 'Liquid exposure produces a result');
    assert.equal(result.dead, true);
    assert.notEqual(monsterAtPosition(level, piercer.mx, piercer.my), piercer);
});

void test('an engulfer carries only a form which fits through iron bars', async () => {
    const level = freshObjectRoom({ recalculateVision: false });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = IRONBARS;
    const fogCloud = await createMonsterAt('fog cloud', 10, 10);
    fogCloud.mux = 10;
    fogCloud.muy = 10;
    fogCloud.mhp = 8;
    fogCloud.mhpmax = 8;
    fogCloud.mcansee = 1;
    game.u.ustuck = fogCloud;
    game.u.uswallow = 1;
    game.u.mtimedone = 0;

    assert.equal((await mfndpos(fogCloud, game)).some(position =>
        position.x === 11 && position.y === 10), false);

    game.u.mtimedone = 10;
    game.u.umonnum = 106;
    assert.equal((await mfndpos(fogCloud, game)).some(position =>
        position.x === 11 && position.y === 10), true);
});
