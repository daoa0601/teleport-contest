import test from 'node:test';
import assert from 'node:assert/strict';

import { ALTAR, G_GENOD, LUCKMIN, MM_EPRI, PIT, POOL, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { finishEnvironmentalMonsterDeath, finishMonsterLiquidDeath } from '../js/monster_death.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, CORPSE, CRYSKNIFE,
    GLOB_OF_BLACK_PUDDING, OBJECT_NAMES,
    POT_ACID, RED_DRAGON_SCALES, ROCK, STATUE, UNICORN_HORN, WORM_TOOTH,
} from '../js/object_data.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { ensureQuestStatus, registerQuestLeader } from '../js/quest.js';
import { initRng } from '../js/rng.js';
import { transformWereMonster } from '../js/were.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import {
    addTrap, floorObjects, floorObjectsAt,
} from './support/level-state.js';
import {
    createMonsterAt, equipMonsterObject, requireMonsterVital,
} from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a zombie special corpse stays on the floor when its boulder fills a pit', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const zombie = await createMonsterAt('giant zombie', 11, 10);
    zombie.mtrapped = 1;
    addTrap(level, PIT, 11, 10);
    await equipMonsterObject(zombie, await knownObject(BOULDER), 0);
    pushKeys(' '.repeat(20));

    await finishHeroMonsterKill(zombie, 11, 10, { showKillMessage: false });

    assert.equal(level.buriedObjects?.some(object => object.otyp === CORPSE) ?? false, false);
    assert.equal(floorObjectsAt(level, 11, 10).some(object => object.otyp === CORPSE), true);
});

void test('a large monster leaves a corpse without a random chance', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 11, 10);

    const death = await finishEnvironmentalMonsterDeath(giant, game, {
        random: range => range - 1,
        publish: async () => {},
    });

    assert.equal(death.corpse?.otyp, CORPSE);
    assert.equal(floorObjectsAt(level, 11, 10).includes(death.corpse), true);
});

void test('a monster death updates its species death count', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 11, 10);

    await finishEnvironmentalMonsterDeath(giant, game, {
        publish: async () => {},
    });

    assert.equal(requireMonsterVital(giant.mnum).died, 1);
});

void test('a dead mail daemon stops future mail delivery', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const daemon = await createMonsterAt('mail daemon', 11, 10);

    await finishEnvironmentalMonsterDeath(daemon, game, {
        publish: async () => {},
    });

    assert.equal(
        (requireMonsterVital(daemon.mnum).mvflags & G_GENOD) !== 0,
        true,
    );
});

void test('a dead chameleon returns to its true species', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    const chameleon = MONSTER_NAME.indexOf('chameleon');
    const monster = await createMonsterAt(chameleon, 11, 10);
    const killedForm = monster.mnum;

    const death = await finishEnvironmentalMonsterDeath(monster, game, {
        random: () => 0,
        publish: async () => {},
    });

    assert.equal(monster.mnum, chameleon);
    assert.equal(death.corpse?.corpsenm, chameleon);
    assert.equal(requireMonsterVital(chameleon).died, 1);
    assert.equal(requireMonsterVital(killedForm).died ?? 0, 0);
});

void test('a dead werewolf returns to its human species', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const humanWerewolf = MONSTER_NAME.lastIndexOf('werewolf');
    const monster = await createMonsterAt(humanWerewolf, 11, 10);
    await transformWereMonster(monster, game);
    const killedForm = monster.mnum;

    const death = await finishEnvironmentalMonsterDeath(monster, game, {
        random: () => 0,
        publish: async () => {},
    });

    assert.equal(monster.mnum, humanWerewolf);
    assert.equal(death.corpse?.corpsenm, humanWerewolf);
    assert.equal(requireMonsterVital(humanWerewolf).died, 1);
    assert.equal(requireMonsterVital(killedForm).died ?? 0, 0);
});

void test('a dead steam vortex leaves a harmless steam cloud', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const vortex = await createMonsterAt('steam vortex', 11, 10);

    await finishEnvironmentalMonsterDeath(vortex, game, {
        random: range => range - 1,
        publish: async () => {},
    });

    const cloud = level.regions?.find(region => region.kind === 'gas-cloud');
    assert.equal(cloud?.damage, 0);
    assert.equal(cloud?.cells.some(cell =>
        cell.x === 11 && cell.y === 10), true);
});

void test('a dead Kop can return elsewhere on the level', async () => {
    const level = freshObjectRoom({ gameplaySeed: 3n });
    requirePlayingGame(game);
    const kop = await createMonsterAt('Keystone Kop', 11, 10);
    initRng(3n);

    await finishEnvironmentalMonsterDeath(kop, game, {
        publish: async () => {},
    });

    const returnedKop = level.monsters.find(monster =>
        monster.mnum === kop.mnum);
    assert.notEqual(returnedKop, undefined);
    assert.notEqual(returnedKop, kop);
    assert.ok(returnedKop);
    assert.ok(returnedKop.mhp > 0);
});

void test('killing a peaceful monster can reduce luck', async () => {
    freshObjectRoom({ gameplaySeed: 4n });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mpeaceful = 1;
    game.u.uluck = 0;
    initRng(4n);

    await finishHeroMonsterKill(jackal, jackal.mx, jackal.my, {
        showKillMessage: false,
        recordConduct: false,
        noCorpse: true,
    });

    assert.equal(game.u.uluck, -1);
});

void test('killing a co-aligned unicorn costs at least five luck', async () => {
    freshObjectRoom({ hero: { ualign: { type: 1, record: 0 } } });
    requirePlayingGame(game);
    const unicorn = await createMonsterAt('white unicorn', 11, 10);
    game.u.uluck = 0;

    await finishHeroMonsterKill(unicorn, unicorn.mx, unicorn.my, {
        showKillMessage: false,
        recordConduct: false,
        noCorpse: true,
    });

    assert.ok(game.u.uluck === -5 || game.u.uluck === -6);
});

void test('murder costs luck and intrinsic telepathy', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const prisoner = await createMonsterAt('prisoner', 11, 10);
    prisoner.malign = 0;
    game.u.uluck = 0;
    grantIntrinsicProperty('telepathy', 'outside', game);

    await finishHeroMonsterKill(prisoner, prisoner.mx, prisoner.my, {
        showKillMessage: false,
        recordConduct: false,
        noCorpse: true,
    });

    assert.equal(game.u.telepathy, false);
    assert.ok(game.u.uluck === -2 || game.u.uluck === -3);
});

void test('killing the quest leader punishes the hero and angers guardians',
    async () => {
        freshObjectRoom({
            gameplaySeed: 1n,
            hero: { ualign: { type: -1, record: 8 } },
        });
        requirePlayingGame(game);
        const leader = await createMonsterAt('Lord Carnarvon', 11, 10);
        const guardian = await createMonsterAt('student', 1, 1);
        guardian.mpeaceful = 1;
        game.urole = {
            ...(game.urole || {}),
            ldrnum: leader.mnum,
            guardnum: guardian.mnum,
        };
        registerQuestLeader(leader, game);
        game.u.uluck = 0;
        game.u.ugangr = 0;
        initRng(1n);

        await finishHeroMonsterKill(leader, leader.mx, leader.my, {
            showKillMessage: false,
            recordConduct: false,
            noCorpse: true,
        });

        assert.deepEqual({
            alignment: game.u.ualign.record,
            anger: game.u.ugangr,
            luck: game.u.uluck,
            killedLeader: game.quest_status?.killed_leader,
            guardianPeaceful: guardian.mpeaceful,
        }, {
            alignment: -26,
            anger: 7,
            luck: LUCKMIN,
            killedLeader: true,
            guardianPeaceful: 0,
        });
    });

void test('killing the nemesis before the leader rewards alignment', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 0 } } });
    requirePlayingGame(game);
    const nemesis = await createMonsterAt('Minion of Huhetotl', 11, 10);
    nemesis.malign = 0;
    const quest = ensureQuestStatus(game);
    quest.killed_leader = false;
    quest.killed_nemesis = false;
    resetInputState().display = { async readKey() { return 32; } };

    await finishHeroMonsterKill(nemesis, nemesis.mx, nemesis.my, {
        showKillMessage: false,
        recordConduct: false,
        noCorpse: true,
    });

    assert.deepEqual({
        alignment: game.u.ualign.record,
        killedNemesis: game.quest_status?.killed_nemesis,
    }, {
        alignment: 2,
        killedNemesis: true,
    });
});

void test('killing a quest guardian costs alignment and at least four luck',
    async () => {
        freshObjectRoom({ hero: { ualign: { type: -1, record: 0 } } });
        requirePlayingGame(game);
        const guardian = await createMonsterAt('student', 11, 10);
        guardian.malign = 0;
        game.u.uluck = 0;
        game.u.ugangr = 0;

        await finishHeroMonsterKill(guardian, guardian.mx, guardian.my, {
            showKillMessage: false,
            recordConduct: false,
            noCorpse: true,
        });

        assert.equal(game.u.ualign.record, -1);
        assert.equal(game.u.ugangr, 1);
        assert.ok(game.u.uluck === -4 || game.u.uluck === -5);
    });

void test('killing an aligned priest removes divine protection', async () => {
    freshObjectRoom({
        hero: { ualign: { type: -1, record: 0 }, ublessed: 3 },
    });
    requirePlayingGame(game);
    const priest = await createMonsterAt('aligned cleric', 11, 10, MM_EPRI);
    priest.malign = 0;
    priest.ispriest = 1;
    priest.epri = {
        parentmid: priest.m_id, shroom: 0, shralign: -1,
        shrpos: { x: 11, y: 10 }, shrlevel: { ...game.u.uz },
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };

    await finishHeroMonsterKill(priest, priest.mx, priest.my, {
        showKillMessage: false,
        recordConduct: false,
        noCorpse: true,
    });

    assert.deepEqual({
        alignment: game.u.ualign.record,
        protection: game.u.ublessed,
    }, {
        alignment: -2,
        protection: 0,
    });
});

void test('killing a pit-trapped monster with a boulder buries its corpse',
    async () => {
        const level = freshObjectRoom({ gameplaySeed: 28n });
        requirePlayingGame(game);
        const giant = await createMonsterAt('giant', 11, 10);
        giant.mtrapped = 1;
        addTrap(level, PIT, giant.mx, giant.my);
        await equipMonsterObject(giant, await knownObject(BOULDER), 0);
        initRng(28n);

        await finishHeroMonsterKill(giant, giant.mx, giant.my, {
            recordConduct: false,
        });

        const corpse = level.buriedObjects?.find(object =>
            object.otyp === CORPSE && object.corpsenm === giant.mnum);
        assert.equal(corpse?.where, 'buried');
        assert.equal(floorObjectsAt(level, 11, 10).includes(corpse), false);
        assert.match(
            game._pending_message,
            /The giant's corpse ends up buried\.$/,
        );
    });

void test('a boulder already in a monster pit prevents death remains', async () => {
    const level = freshObjectRoom({ gameplaySeed: 29n });
    requirePlayingGame(game);
    const giant = await createMonsterAt('giant', 11, 10);
    giant.mtrapped = 1;
    addTrap(level, PIT, giant.mx, giant.my);
    placeCreatedObject(await knownObject(BOULDER), giant.mx, giant.my);
    initRng(29n);

    await finishHeroMonsterKill(giant, giant.mx, giant.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.equal(floorObjectsAt(level, 11, 10).some(object =>
        object.otyp === CORPSE), false);
});

void test('killing a monster inside solid rock leaves no objects', async () => {
    const level = freshObjectRoom({ gameplaySeed: 30n });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = STONE;
    const jackal = await createMonsterAt('jackal', 11, 10);
    initRng(30n);

    await finishHeroMonsterKill(jackal, jackal.mx, jackal.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.deepEqual(floorObjectsAt(level, 11, 10), []);
});

void test('Kops and cloned monsters do not leave random bonus objects', async () => {
    for (const { species, cloned = false } of [
        { species: 'Keystone Kop' },
        { species: 'jackal', cloned: true },
    ]) {
        const level = freshObjectRoom({ gameplaySeed: 10n });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10);
        monster.mcloned = cloned ? 1 : 0;
        initRng(10n);

        await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            showKillMessage: false,
            recordConduct: false,
        });

        assert.equal(floorObjectsAt(level, 11, 10).every(object =>
            object.otyp === CORPSE), true, species);
    }
});

void test('pool water destroys an acid potion dropped by a dying monster',
    async () => {
        const level = freshObjectRoom({
            gameplaySeed: 482n,
            hero: { uluck: -5 },
        });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = POOL;
        const jackal = await createMonsterAt('jackal', 11, 10);
        const potion = await knownObject(POT_ACID);
        await addObjectToMonsterInventory(jackal, potion, game);
        initRng(482n);

        await finishHeroMonsterKill(jackal, jackal.mx, jackal.my, {
            showKillMessage: false,
            recordConduct: false,
        });

        assert.equal(potion.where, 'gone');
    });

void test('a glob dropped by a dying monster joins a neighboring glob', async () => {
    const level = freshObjectRoom({ gameplaySeed: 483n });
    requirePlayingGame(game);
    placeCreatedObject(await knownObject(GLOB_OF_BLACK_PUDDING), 12, 10);
    const jackal = await createMonsterAt('jackal', 11, 10);
    await addObjectToMonsterInventory(
        jackal, await knownObject(GLOB_OF_BLACK_PUDDING), game,
    );

    await finishEnvironmentalMonsterDeath(jackal, game, {
        noCorpse: true,
        random: () => 0,
        publish: async () => {},
    });

    const globs = floorObjects(level).filter(object =>
        object.otyp === GLOB_OF_BLACK_PUDDING);
    assert.equal(globs.length, 1);
    assert.equal(globs[0]?.owt, 40);
});

void test('a potion dropped on a hot dungeon floor shatters', async () => {
    const level = freshObjectRoom({
        gameplaySeed: 484n,
        heroX: 15,
        heroY: 10,
    });
    requirePlayingGame(game);
    level.flags.temperature = 1;
    const jackal = await createMonsterAt('jackal', 11, 10);
    const potion = await knownObject(POT_ACID);
    await addObjectToMonsterInventory(jackal, potion, game);

    await finishEnvironmentalMonsterDeath(jackal, game, {
        noCorpse: true,
        random: () => 99,
        publish: async () => {},
    });

    assert.equal(potion.where, 'gone');
    assert.deepEqual(floorObjectsAt(level, 11, 10), []);
});

void test('a monster-turn drop reveals an object curse on a visible altar',
    async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = ALTAR;
        game.context.mon_moving = true;
        const jackal = await createMonsterAt('jackal', 11, 10);
        const potion = await knownObject(POT_ACID, {
            cursed: true,
            bknown: false,
        });
        await addObjectToMonsterInventory(jackal, potion, game);

        await finishEnvironmentalMonsterDeath(jackal, game, {
            noCorpse: true,
            publish: async () => {},
        });

        assert.equal(potion.bknown, true);
        assert.equal(game.u.uconduct.gnostic ?? 0, 0);
    });

void test('a visible lich crumbles to dust instead of leaving a corpse', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const lich = await createMonsterAt('lich', 11, 10);
    const messages: string[] = [];

    const death = await finishEnvironmentalMonsterDeath(lich, game, {
        random: () => 0,
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(death.corpse, null);
    assert.deepEqual(messages, ["The lich's body crumbles into dust."]);
});

void test('a stone golem leaves a statue of itself', async () => {
    const level = freshObjectRoom({ gameplaySeed: 21n });
    requirePlayingGame(game);
    const golem = await createMonsterAt('stone golem', 11, 10);

    await finishEnvironmentalMonsterDeath(golem, game, {
        publish: async () => {},
    });

    const [statue] = floorObjectsAt(level, 11, 10);
    assert.equal(statue?.otyp, STATUE);
    assert.equal(statue?.corpsenm, golem.mnum);
});

void test('a clay golem collapses into a pile of rocks', async () => {
    const level = freshObjectRoom({ gameplaySeed: 22n });
    requirePlayingGame(game);
    const golem = await createMonsterAt('clay golem', 11, 10);

    await finishEnvironmentalMonsterDeath(golem, game, {
        publish: async () => {},
    });

    const [rocks] = floorObjectsAt(level, 11, 10);
    assert.equal(rocks?.otyp, ROCK);
    assert.ok(rocks.quan >= 50 && rocks.quan <= 69);
});

void test('golems leave the materials they were made from', async () => {
    const cases = [
        {
            species: 'glass golem', minimum: 2, maximum: 8,
            isMaterial: (name: string) => name.startsWith('worthless piece'),
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
        requirePlayingGame(game);
        const golem = await createMonsterAt(species, 11, 10);

        await finishEnvironmentalMonsterDeath(golem, game, {
            publish: async () => {},
        });

        const remains = floorObjectsAt(level, 11, 10);
        assert.ok(remains.length >= minimum && remains.length <= maximum,
            `${species} left ${remains.length} objects`);
        let isMaterial: (name: string) => boolean;
        if (golemCase.isMaterial) isMaterial = golemCase.isMaterial;
        else {
            assert.ok(materials, 'the golem has expected remains');
            isMaterial = name => materials.includes(name);
        }
        assert.equal(remains.every(object => {
            const name = OBJECT_NAMES[object.otyp];
            return typeof name === 'string' && isMaterial(name);
        }), true, species);
    }
});

void test('an adult dragon can leave scales with its corpse', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 11, 10);
    initRng(1n);

    await finishEnvironmentalMonsterDeath(dragon, game, {
        publish: async () => {},
    });

    const remains = floorObjectsAt(level, 11, 10);
    assert.equal(remains.some(object => object.otyp === CORPSE), true);
    assert.equal(remains.some(object =>
        object.otyp === RED_DRAGON_SCALES), true);
});

void test('unicorns and long worms leave both a body and a useful part', async () => {
    for (const [species, part] of [
        ['white unicorn', UNICORN_HORN],
        ['long worm', WORM_TOOTH],
    ] as const) {
        const level = freshObjectRoom({ gameplaySeed: 24n });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10);

        await finishEnvironmentalMonsterDeath(monster, game, {
            publish: async () => {},
        });

        const remains = floorObjectsAt(level, 11, 10);
        assert.equal(remains.some(object => object.otyp === CORPSE), true);
        assert.equal(remains.some(object => object.otyp === part), true);
    }
});

void test('a black pudding congeals and joins a nearby glob', async () => {
    const level = freshObjectRoom({ gameplaySeed: 25n });
    requirePlayingGame(game);
    const oldGlob = await knownObject(GLOB_OF_BLACK_PUDDING);
    placeCreatedObject(oldGlob, 12, 10);
    const pudding = await createMonsterAt('black pudding', 11, 10);

    await finishEnvironmentalMonsterDeath(pudding, game, {
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

void test('a dungeon-killed gas spore explodes where corpses cannot drop', async () => {
    freshObjectRoom({ gameplaySeed: 26n });
    requirePlayingGame(game);
    game.level.flags.deathdrops = false;
    const gasSpore = await createMonsterAt('gas spore', 11, 10);
    const jackal = await createMonsterAt('jackal', 12, 10);
    jackal.mhp = jackal.mhpmax = 100;
    const heroHitPoints = game.u.uhp;

    await finishEnvironmentalMonsterDeath(gasSpore, game, {
        random: () => 0,
        publish: async () => {},
    });

    assert.ok(jackal.mhp < 100);
    assert.ok(game.u.uhp < heroHitPoints);
});

void test('killing a gas spore blasts the hero and nearby monsters', async () => {
    freshObjectRoom({ gameplaySeed: 27n });
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const gasSpore = await createMonsterAt('gas spore', 11, 10);
    const jackal = await createMonsterAt('jackal', 12, 10);
    jackal.mhp = jackal.mhpmax = 100;
    initRng(27n);
    pushKeys(' '.repeat(20));

    await finishHeroMonsterKill(gasSpore, gasSpore.mx, gasSpore.my, {
        showKillMessage: false,
        recordConduct: false,
    });

    assert.ok(jackal.mhp < 100);
    assert.ok(game.u.uhp < 100);
});

void test('a hero kill releases a fixed crysknife before placing it on the floor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const orc = await createMonsterAt('orc', 12, 10);
    const knife = await knownObject(CRYSKNIFE, { oerodeproof: true });
    await addObjectToMonsterInventory(orc, knife);
    initRng(5n);
    pushKeys('        ');

    await finishHeroMonsterKill(orc, orc.mx, orc.my, { noCorpse: true });

    assert.equal(game.level.monsters.includes(orc), false);
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(knife));
    assert.equal(knife.otyp, WORM_TOOTH);
});

void test('a new pudding glob follows its heavier survivor to reach the next neighbor', async () => {
    const level = freshObjectRoom({ gameplaySeed: 25n });
    requirePlayingGame(game);
    const heavy = await knownObject(GLOB_OF_BLACK_PUDDING);
    const distant = await knownObject(GLOB_OF_BLACK_PUDDING);
    heavy.owt *= 2;
    const expectedWeight = heavy.owt + 2 * distant.owt;
    placeCreatedObject(heavy, 13, 10);
    placeCreatedObject(distant, 14, 10);
    const pudding = await createMonsterAt('black pudding', 12, 10);
    pushKeys('                                                                                ');

    await finishEnvironmentalMonsterDeath(pudding, game);

    const globs = floorObjects(level).filter(object =>
        object.otyp === GLOB_OF_BLACK_PUDDING);
    assert.equal(globs.length, 1);
    assert.ok(globs.includes(heavy));
    assert.equal(distant.where, 'gone');
    assert.equal(heavy.owt, expectedWeight);
});

for (const liquid of [false, true]) {
    for (const lifesaving of [false, true]) {
        void test(`${liquid ? 'liquid' : 'environmental'} monster death ${lifesaving ? 'resumes a blast after hero life saving' : 'propagates a fatal blast before its wake effects'}`, async () => {
            freshObjectRoom({ right: 20, hero: { uhp: 1, uhpmax: 100 } });
            requirePlayingGame(game);
            if (lifesaving) {
                const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
                await wearHeroAccessory(amulet, 'uamul');
            }
            const spore = await createMonsterAt('gas spore', 11, 10);
            const sleeper = await createMonsterAt('kobold', 17, 10);
            sleeper.msleeping = 1;
            initRng(1n);
            pushKeys(' '.repeat(80));

            const death = liquid
                ? await finishMonsterLiquidDeath(spore, { leaveCorpse: true })
                : await finishEnvironmentalMonsterDeath(spore, game);

            assert.equal(!!game.program_state.gameover, !lifesaving);
            assert.equal(!!death.heroDied, !lifesaving);
            assert.equal(spore.dead, true);
            assert.equal(sleeper.msleeping, lifesaving ? 0 : 1);
        });
    }
}

for (const healthy of [false, true]) {
    void test(`a blast destroying a polymorphed body ${healthy ? 'continues after return to a healthy human body' : 'stops if the human body cannot survive'}`, async () => {
        freshObjectRoom({ right: 20, hero: { uhp: healthy ? 100 : 0, uhpmax: 100 } });
        requirePlayingGame(game);
        installPolymorphedHero('kobold', { hitPoints: 1 });
        const spore = await createMonsterAt('gas spore', 11, 10);
        const sleeper = await createMonsterAt('kobold', 17, 10);
        sleeper.msleeping = 1;
        initRng(1n);
        pushKeys(' '.repeat(80));

        const death = await finishEnvironmentalMonsterDeath(spore, game);

        assert.equal(!!game.program_state.gameover, !healthy);
        assert.equal(!!death.heroDied, !healthy);
        assert.equal(game.u.umonnum, game.u.umonster);
        assert.equal(sleeper.msleeping, healthy ? 0 : 1);
    });
}

void test('refusing death in explore mode continues the explosion wake effect', async () => {
    freshObjectRoom({ right: 20, hero: { uhp: 1, uhpmax: 100 } });
    requirePlayingGame(game);
    game.flags.explore = true;
    const spore = await createMonsterAt('gas spore', 11, 10);
    const sleeper = await createMonsterAt('kobold', 17, 10);
    sleeper.msleeping = 1;
    initRng(1n);
    pushKeys(' '.repeat(20) + 'n' + ' '.repeat(20));

    const death = await finishEnvironmentalMonsterDeath(spore, game);

    assert.equal(!!game.program_state.gameover, false);
    assert.equal(!!death.heroDied, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(sleeper.msleeping, 0);
});

for (const hallucinating of [false, true]) {
    void test(`a crumbling lich is named by current ${hallucinating ? 'hallucination' : 'invisible sight'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const lich = await createMonsterAt('lich', 11, 10);
        const messages: string[] = [];
        if (hallucinating) game.u.hallucinationTurns = 20;
        else {
            lich.minvis = true;
            game.u.seeInvisible = true;
        }
        initRng(1n);

        const death = await finishEnvironmentalMonsterDeath(lich, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(death.corpse, null);
        const crumble = messages.find(message => message.includes('body crumbles into dust'));
        assert.ok(crumble);
        if (hallucinating) assert.doesNotMatch(crumble, /lich/);
        else assert.equal(crumble, "The invisible lich's body crumbles into dust.");
    });
}
