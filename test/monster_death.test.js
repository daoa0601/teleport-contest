import test from 'node:test';
import assert from 'node:assert/strict';

import { PIT, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { pushKeys } from '../js/input.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    BOULDER, CORPSE, FIGURINE, GLOB_OF_BLACK_PUDDING, OBJECT_NAMES,
    RED_DRAGON_SCALES, ROCK, STATUE, UNICORN_HORN, WORM_TOOTH,
} from '../js/object_data.js';
import { place_object } from '../js/floor_object.js';
import { knownObject } from './support/game-objects.js';
import {
    addTrap, floorObjects, floorObjectsAt,
} from './support/level-state.js';
import { addMonster, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('a large monster leaves a corpse without a random chance', async () => {
    const level = freshObjectRoom();
    const giant = addMonster({
        species: 'giant', x: 11, y: 10, hitPoints: 1,
    });

    const death = await finishEnvironmentalMonsterDeath(giant, game, {
        visible: false,
        random: range => range - 1,
        publish: async () => {},
    });

    assert.equal(death.corpse?.otyp, CORPSE);
    assert.equal(floorObjectsAt(level, 11, 10).includes(death.corpse), true);
});

test('a monster death updates its species death count', async () => {
    freshObjectRoom();
    const giant = addMonster({
        species: 'giant', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(giant, game, {
        visible: false,
        publish: async () => {},
    });

    assert.equal(game.mvitals[giant.mnum]?.died, 1);
});

test('dead shapechangers return to their true species', async () => {
    const chameleon = MONSTER_NAME.indexOf('chameleon');
    const humanWerewolf = MONSTER_NAME.lastIndexOf('werewolf');
    const cases = [
        { species: 'giant', cham: chameleon, trueSpecies: chameleon },
        { species: 'werewolf', trueSpecies: humanWerewolf },
    ];

    for (const { trueSpecies, ...monsterOptions } of cases) {
        freshObjectRoom();
        const monster = addMonster({
            ...monsterOptions, x: 11, y: 10, hitPoints: 1,
        });
        const killedForm = monster.mnum;

        const death = await finishEnvironmentalMonsterDeath(monster, game, {
            visible: false,
            random: () => 0,
            publish: async () => {},
        });

        assert.equal(monster.mnum, trueSpecies);
        assert.equal(death.corpse?.corpsenm, trueSpecies);
        assert.equal(game.mvitals[trueSpecies]?.died, 1);
        assert.equal(game.mvitals[killedForm]?.died ?? 0, 0);
    }
});

test('killing a pit-trapped monster with a boulder buries its corpse',
    async () => {
        const level = freshObjectRoom({ gameplaySeed: 28n });
        const giant = addMonster({
            species: 'giant', x: 11, y: 10,
            hitPoints: 1, mtrapped: 1,
        });
        addTrap(level, PIT, giant.mx, giant.my);
        equipMonsterObject(giant, knownObject(BOULDER), 0);

        await finishHeroMonsterKill(giant, giant.mx, giant.my, {
            showKillMessage: false,
            recordConduct: false,
        });

        const corpse = level.buriedObjects?.find(object =>
            object.otyp === CORPSE && object.corpsenm === giant.mnum);
        assert.equal(corpse?.where, 'buried');
        assert.equal(floorObjectsAt(level, 11, 10).includes(corpse), false);
    });

test('a boulder already in a monster pit prevents death remains', async () => {
    const level = freshObjectRoom({ gameplaySeed: 29n });
    const giant = addMonster({
        species: 'giant', x: 11, y: 10,
        hitPoints: 1, mtrapped: 1,
    });
    addTrap(level, PIT, giant.mx, giant.my);
    place_object(knownObject(BOULDER), giant.mx, giant.my);

    await finishHeroMonsterKill(giant, giant.mx, giant.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.equal(floorObjectsAt(level, 11, 10).some(object =>
        object.otyp === CORPSE), false);
});

test('killing a monster inside solid rock leaves no objects', async () => {
    const level = freshObjectRoom({ gameplaySeed: 30n });
    level.at(11, 10).typ = STONE;
    const giant = addMonster({
        species: 'giant', x: 11, y: 10, hitPoints: 1,
    });

    await finishHeroMonsterKill(giant, giant.mx, giant.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.deepEqual(floorObjectsAt(level, 11, 10), []);
});

test('Kops and cloned monsters do not leave random bonus objects', async () => {
    for (const monsterOptions of [
        { species: 'Keystone Kop' },
        { species: 'giant', mcloned: 1 },
    ]) {
        const level = freshObjectRoom({ gameplaySeed: 10n });
        const monster = addMonster({
            ...monsterOptions, x: 11, y: 10, hitPoints: 1,
        });

        await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            showKillMessage: false,
            recordConduct: false,
        });

        assert.equal(floorObjectsAt(level, 11, 10).every(object =>
            object.otyp === CORPSE), true, monsterOptions.species);
    }
});

test('a small monster can leave a figurine as its bonus object', async () => {
    const level = freshObjectRoom({ gameplaySeed: 4967n });
    const jackal = addMonster({
        species: 'jackal', x: 11, y: 10, hitPoints: 1,
    });

    await finishHeroMonsterKill(jackal, jackal.mx, jackal.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.equal(floorObjectsAt(level, 11, 10).some(object =>
        object.otyp === FIGURINE), true);
});

test('a human-sized monster can leave a heavy bonus object', async () => {
    const level = freshObjectRoom({ gameplaySeed: 49n });
    const dwarf = addMonster({
        species: 'dwarf', x: 11, y: 10, hitPoints: 1,
    });

    await finishHeroMonsterKill(dwarf, dwarf.mx, dwarf.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.equal(floorObjectsAt(level, 11, 10).some(object =>
        object.otyp === ROCK), true);
});

test('a visible lich crumbles to dust instead of leaving a corpse', async () => {
    freshObjectRoom();
    const lich = addMonster({
        species: 'lich', x: 11, y: 10, hitPoints: 1,
    });
    const messages = [];

    const death = await finishEnvironmentalMonsterDeath(lich, game, {
        visible: true,
        random: () => 0,
        publish: async message => messages.push(message),
    });

    assert.equal(death.corpse, null);
    assert.deepEqual(messages, ["The lich's body crumbles into dust."]);
});

test('a stone golem leaves a statue of itself', async () => {
    const level = freshObjectRoom({ gameplaySeed: 21n });
    const golem = addMonster({
        species: 'stone golem', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(golem, game, {
        visible: false,
        publish: async () => {},
    });

    const [statue] = floorObjectsAt(level, 11, 10);
    assert.equal(statue?.otyp, STATUE);
    assert.equal(statue?.corpsenm, golem.mnum);
});

test('a clay golem collapses into a pile of rocks', async () => {
    const level = freshObjectRoom({ gameplaySeed: 22n });
    const golem = addMonster({
        species: 'clay golem', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(golem, game, {
        visible: false,
        publish: async () => {},
    });

    const [rocks] = floorObjectsAt(level, 11, 10);
    assert.equal(rocks?.otyp, ROCK);
    assert.ok(rocks.quan >= 50 && rocks.quan <= 69);
});

test('golems leave the materials they were made from', async () => {
    const cases = [
        {
            species: 'glass golem', minimum: 2, maximum: 8,
            isMaterial: name => name.startsWith('worthless piece'),
        },
        {
            species: 'wood golem', minimum: 2, maximum: 8,
            materials: [
                'quarterstaff', 'small shield', 'club', 'elven spear',
                'boomerang',
            ],
        },
        {
            species: 'rope golem', minimum: 0, maximum: 2,
            materials: ['leash', 'bullwhip', 'grappling hook'],
        },
        {
            species: 'leather golem', minimum: 2, maximum: 8,
            materials: ['leather armor', 'leather cloak', 'saddle'],
        },
        {
            species: 'paper golem', minimum: 1, maximum: 4,
            materials: ['blank paper'],
        },
        {
            species: 'gold golem', minimum: 1, maximum: 1,
            materials: ['gold piece'],
        },
    ];

    for (const golemCase of cases) {
        const {
            species, minimum, maximum, materials,
        } = golemCase;
        const level = freshObjectRoom({ gameplaySeed: 23n });
        const golem = addMonster({
            species, x: 11, y: 10, hitPoints: 1,
        });

        await finishEnvironmentalMonsterDeath(golem, game, {
            visible: false,
            publish: async () => {},
        });

        const remains = floorObjectsAt(level, 11, 10);
        assert.ok(remains.length >= minimum && remains.length <= maximum,
            `${species} left ${remains.length} objects`);
        const isMaterial = golemCase.isMaterial
            || (name => materials.includes(name));
        assert.equal(remains.every(object => isMaterial(
            OBJECT_NAMES[object.otyp],
        )), true, species);
    }
});

test('an adult dragon can leave scales with its corpse', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n });
    const dragon = addMonster({
        species: 'red dragon', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(dragon, game, {
        visible: false,
        publish: async () => {},
    });

    const remains = floorObjectsAt(level, 11, 10);
    assert.equal(remains.some(object => object.otyp === CORPSE), true);
    assert.equal(remains.some(object =>
        object.otyp === RED_DRAGON_SCALES), true);
});

test('unicorns and long worms leave both a body and a useful part', async () => {
    for (const [species, part] of [
        ['white unicorn', UNICORN_HORN],
        ['long worm', WORM_TOOTH],
    ]) {
        const level = freshObjectRoom({ gameplaySeed: 24n });
        const monster = addMonster({
            species, x: 11, y: 10, hitPoints: 1,
        });

        await finishEnvironmentalMonsterDeath(monster, game, {
            visible: false,
            publish: async () => {},
        });

        const remains = floorObjectsAt(level, 11, 10);
        assert.equal(remains.some(object => object.otyp === CORPSE), true);
        assert.equal(remains.some(object => object.otyp === part), true);
    }
});

test('a black pudding congeals and joins a nearby glob', async () => {
    const level = freshObjectRoom({ gameplaySeed: 25n });
    const oldGlob = knownObject(GLOB_OF_BLACK_PUDDING);
    place_object(oldGlob, 12, 10);
    const pudding = addMonster({
        species: 'black pudding', x: 11, y: 10, hitPoints: 1,
    });

    await finishEnvironmentalMonsterDeath(pudding, game, {
        visible: false,
        random: () => 0,
        publish: async () => {},
    });

    const globs = floorObjects(level).filter(object =>
        object.otyp === GLOB_OF_BLACK_PUDDING);
    const [glob] = globs;
    assert.equal(globs.length, 1);
    assert.equal(glob?.otyp, GLOB_OF_BLACK_PUDDING);
    assert.equal(glob?.globby, true);
    assert.equal(glob?.owt, 40);
});

test('a dungeon-killed gas spore explodes where corpses cannot drop', async () => {
    freshObjectRoom({ gameplaySeed: 26n });
    game.level.flags.deathdrops = false;
    const gasSpore = addMonster({
        species: 'gas spore', x: 11, y: 10, hitPoints: 1,
    });
    const jackal = addMonster({
        species: 'jackal', x: 12, y: 10, hitPoints: 100,
    });
    const heroHitPoints = game.u.uhp;

    await finishEnvironmentalMonsterDeath(gasSpore, game, {
        visible: false,
        random: () => 0,
        publish: async () => {},
    });

    assert.ok(jackal.mhp < 100);
    assert.ok(game.u.uhp < heroHitPoints);
});

test('killing a gas spore blasts the hero and nearby monsters', async () => {
    freshObjectRoom({ gameplaySeed: 27n });
    game.u.uhp = game.u.uhpmax = 100;
    const gasSpore = addMonster({
        species: 'gas spore', x: 11, y: 10, hitPoints: 1,
    });
    const jackal = addMonster({
        species: 'jackal', x: 12, y: 10, hitPoints: 100,
    });
    pushKeys(' '.repeat(20));

    await finishHeroMonsterKill(gasSpore, gasSpore.mx, gasSpore.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.ok(jackal.mhp < 100);
    assert.ok(game.u.uhp < 100);
});
