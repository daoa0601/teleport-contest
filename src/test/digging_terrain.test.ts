import { GameMap } from '../js/game.js';
import type { Trap } from '../js/map_types.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DIGCHECK_FAIL_BOULDER, DIGCHECK_FAIL_CANTDIG, DIGCHECK_FAIL_ONLADDER,
    M_SEEN_MAGR,
    DIGCHECK_FAIL_ONSTAIRS, DIGCHECK_FAIL_OBJ_POOL_OR_TRAP,
    DIGCHECK_FAIL_TOOHARD, DIGCHECK_FAIL_UNDESTROYABLETRAP,
    DIGCHECK_PASSED, DIGCHECK_PASSED_DESTROY_TRAP, DIGCHECK_PASSED_PITONLY,
    FOUNTAIN, GRAVE, HOLE, ICE, LADDER, LAVAPOOL, MOAT, PIT, POOL, ROOM, STAIRS,
    STONE, TT_PIT, VIBRATING_SQUARE, W_NONDIGGABLE,
} from '../js/const.js';
import {
    digCheck, digCheckFailMessage, digHole, digUpGrave, liquidFlow,
    spotChecks,
} from '../js/digging_terrain.js';
import { game } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { pushKeys } from '../js/input.js';
import { BOULDER, CLUB, CORPSE, GOLD_PIECE, LEASH } from '../js/object_data.js';
import { fireDamageObject } from '../js/fire_damage.js';
import {
    LEVEL_TIMER_KIND, scheduleLevelTimer,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { knownObject, addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

function heroRoom() {
    const level = freshGameplayRoom();
    pushKeys(' '.repeat(64));
    return level;
}

function levitateHero() {
    game.u.levitating = true;
    game.u.levitation = true;
}

void test('dig_check rejects boulders, nondiggable walls, stairs and portals',
    async () => {
        const level = heroRoom();
        requireFixtureGame(game);
        game.level.flags = new GameMap().flags;
        assert.equal(digCheck('you', 10, 10), DIGCHECK_PASSED);

        await floorObject(BOULDER, 10, 10);
        assert.equal(digCheck('you', 10, 10), DIGCHECK_FAIL_BOULDER);

        level.requireAt(11, 10).typ = STONE;
        level.requireAt(11, 10).wall_info = W_NONDIGGABLE;
        assert.equal(digCheck('you', 11, 10), DIGCHECK_FAIL_TOOHARD);

        level.requireAt(12, 10).typ = LADDER;
        assert.equal(digCheck('you', 12, 10), DIGCHECK_FAIL_ONLADDER);
        level.requireAt(12, 10).typ = STAIRS;
        assert.equal(digCheck('you', 12, 10), DIGCHECK_FAIL_ONSTAIRS);

        level.traps.push({
            ttyp: VIBRATING_SQUARE, tx: 13, ty: 10, tseen: false, once: false,
            launch: { x: 0, y: 0 },
        });
        assert.equal(digCheck('you', 13, 10),
            DIGCHECK_FAIL_UNDESTROYABLETRAP);
    });

void test('dig_check limits a hard floor to pits and trap destruction', () => {
    heroRoom();
    requireFixtureGame(game);
    game.level.flags = { ...new GameMap().flags, hardfloor: true };
    assert.equal(digCheck('you', 10, 10), DIGCHECK_PASSED_PITONLY);
    game.level.traps.push({
        ttyp: HOLE, tx: 10, ty: 10, tseen: false, once: false, launch: { x: 0, y: 0 },
    });
    assert.equal(digCheck('you', 10, 10), DIGCHECK_FAIL_CANTDIG);
    const trap = game.level.traps[0];
    assert.ok(trap);
    trap.ttyp = 1; /* ARROW_TRAP */
    assert.equal(digCheck('you', 10, 10), DIGCHECK_PASSED_DESTROY_TRAP);
    game.level.flags = new GameMap().flags;
    trap.ttyp = 1; /* ARROW_TRAP */
    assert.equal(digCheck('object', 10, 10),
        DIGCHECK_FAIL_OBJ_POOL_OR_TRAP);
});

void test('digcheck_fail_message says chop for axes and dig in otherwise',
    async () => {
        heroRoom();
        requireFixtureGame(game);
        game.level.requireAt(10, 10).typ = STONE;
        game.level.requireAt(10, 10).wall_info = W_NONDIGGABLE;

        await digCheckFailMessage(digCheck('you', 10, 10), 'you', 10, 10);
        assert.match(game._pending_message, /too hard to dig in/);

        game.uwep = await knownObject(44); /* AXE */
        await digCheckFailMessage(digCheck('you', 10, 10), 'you', 10, 10);
        assert.match(game._pending_message, /too hard to chop/);
    });

void test('dighole opens a hole and a pit under the hero', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    levitateHero();

    const madeHole = await digHole({});
    assert.equal(madeHole, true);
    assert.ok(level.traps.some(trap =>
        trap.tx === 10 && trap.ty === 10 && trap.ttyp === HOLE));
    assert.match(game._pending_message, /You dig a hole through the floor/);
    game.level.traps.length = 0;

    game.u.levitating = false;
    game.u.levitation = false;
    const madePit = await digHole({ pitOnly: true });
    assert.equal(madePit, true);
    assert.ok(level.traps.some(trap =>
        trap.tx === 10 && trap.ty === 10 && trap.ttyp === PIT));
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) >= 2 && (game.u.utrap ?? 0) <= 5);
});

void test('dighole drops a boulder into its own pit', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    levitateHero();
    const boulder = await floorObject(BOULDER, 10, 10);
    level.traps.push({
        ttyp: 11 /* PIT */, tx: 10, ty: 10, tseen: false, once: false,
        launch: { x: 0, y: 0 },
    });

    await digHole({});
    assert.equal(boulder.where, 'gone');
    assert.match(game._pending_message, /boulder/);
});

void test('dighole fills with adjacent liquid instead of opening a hole',
    async () => {
        const level = heroRoom();
        requireFixtureGame(game);
        levitateHero();
        for (let x = 9; x <= 11; x++) {
            for (let y = 9; y <= 11; y++) {
                if (x !== 10 || y !== 10) level.requireAt(x, y).typ = MOAT;
            }
        }

        await digHole({});
        assert.equal(level.requireAt(10, 10).typ, MOAT);
        assert.equal(level.traps.some(trap =>
            trap.tx === 10 && trap.ty === 10), false);
        assert.match(game._pending_message,
            /As you dig, the hole fills with water/);
    });

void test('dighole digs up an empty grave without a corpse', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    const grave = level.requireAt(10, 10);
    grave.typ = GRAVE;
    grave.emptygrave = 1;
    initRng(9n);

    await digHole({});
    assert.ok(level.traps.some(trap =>
        trap.tx === 10 && trap.ty === 10 && trap.ttyp === PIT));
    assert.equal(grave.typ, ROOM);
    assert.match(game._pending_message, /unoccupied/);
});

void test('dig_up_grave raises an old corpse or an undead', async () => {
    const level = heroRoom();
    const grave = level.requireAt(10, 10);
    grave.typ = GRAVE;
    const monsters = level.monsters.length;

    initRng(4n);
    await digUpGrave(null);
    assert.equal(grave.typ, ROOM);
    const corpses = (floorObjectsAt(level, 10, 10) || [])
        .filter(object => object.otyp === CORPSE);
    if (!corpses.length) {
        assert.ok(level.monsters.length > monsters);
    } else {
        assert.ok(corpses[0] && corpses[0].age < 0);
    }
});

void test('liquid_flow unearths buried objects and removes the trap', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    // the hero digs an adjacent square, so the flow itself is the last event
    level.requireAt(11, 10).typ = POOL;
    const trap: Trap = { ttyp: PIT, tx: 11, ty: 10, tseen: false, once: false,
        launch: { x: 0, y: 0 } };
    level.traps.push(trap);
    const buried = await floorObject(CORPSE, 11, 10);
    buried.where = 'buried';
    buried.buried = true;
    level.buriedObjects = [buried];

    await liquidFlow(11, 10, POOL, trap, 'As you dig, the hole fills with %s!');
    assert.equal(level.traps.includes(trap), false);
    assert.equal(buried.where, 'floor');
    assert.ok((floorObjectsAt(level, 11, 10) || []).includes(buried));
    assert.match(game._pending_message,
        /As you dig, the hole fills with water/);
});

void test('lava flooding burns a floor club without destroying it on first exposure', async () => {
    const level = heroRoom();
    const club = await floorObject(CLUB, 11, 10);
    level.requireAt(11, 10).typ = LAVAPOOL;

    await liquidFlow(11, 10, LAVAPOOL, null, null);

    assert.equal(club.where, 'floor');
    assert.equal(club.oeroded, 1);
    assert.ok(floorObjectsAt(level, 11, 10).includes(club));
});

void test('lava flooding over gold preserves subsequent fire protection', async () => {
    const level = heroRoom();
    const gold = await floorObject(GOLD_PIECE, 11, 10, { quan: 20 });
    const club = await addInventoryObject(CLUB);
    level.requireAt(11, 10).typ = LAVAPOOL;
    initRng(5n);

    await liquidFlow(11, 10, LAVAPOOL, null, null);
    await fireDamageObject(club, { x: 10, y: 10 });

    assert.equal(gold.where, 'floor');
    assert.equal(gold.quan, 20);
    assert.equal(club.oeroded ?? 0, 0,
        'Unaffected floor gold must not alter the next item\'s luck protection.');
});

void test('an adjacent hole takes a grounded monster down with it', async () => {
    const level = heroRoom();
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    requireFixtureGame(game);
    const victim = await createMonsterAt('giant ant', 11, 10);

    await digHole({ coordinate: { x: 11, y: 10 } });
    assert.ok(level.traps.some(trap =>
        trap.tx === 11 && trap.ty === 10 && trap.ttyp === HOLE));
    assert.equal(level.monsters.includes(victim), false);
    assert.ok((game._migratingMonsters || []).includes(victim));
});

void test('spot checks stop a melt timer when ice terrain is replaced', () => {
    const level = heroRoom();
    requireFixtureGame(game);
    const timer = scheduleLevelTimer(10, 10,
        LEVEL_TIMER_KIND.MELT_ICE_AWAY, 50, game);
    level.requireAt(10, 10).typ = POOL;

    spotChecks(10, 10, ICE, game);
    assert.ok(timer);
    assert.equal(level.levelTimers.includes(timer), false);
});

void test('digging down on a fountain dries it up instead of opening a hole',
    async () => {
        const level = heroRoom();
        levitateHero();
        const fountain = level.requireAt(10, 10);
        fountain.typ = FOUNTAIN;

        await digHole({});
        assert.equal(fountain.typ, ROOM);
        assert.equal(level.traps.some(trap =>
            trap.tx === 10 && trap.ty === 10), false);
    });

void test('a magical trap explodes inside the engulfer only', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    const engulfer = await createMonsterAt('purple worm', 11, 10);
    placeMonsterAt(engulfer, game.u.ux, game.u.uy);
    engulfer.mhp = engulfer.mhpmax = 1000;
    const bystander = await createMonsterAt('giant ant', 9, 10);
    bystander.mhp = bystander.mhpmax = 1000;
    game.u.uswallow = game.uswallow = 1;
    game.u.ustuck = engulfer;
    level.traps.push({
        ttyp: 20 /* MAGIC_TRAP */, tx: 10, ty: 10, tseen: false, once: false,
        launch: { x: 0, y: 0 },
    });

    await digHole({});
    assert.ok(engulfer.mhp < 1000);
    assert.equal(bystander.mhp, 1000);
    assert.ok(game.u.uhp < 1000);
});

void test('a monster holding the hero takes double blast damage', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    const holder = await createMonsterAt('giant ant', 11, 10);
    const control = await createMonsterAt('giant ant', 9, 10);
    holder.mhp = holder.mhpmax = 1000;
    control.mhp = control.mhpmax = 1000;
    game.u.ustuck = holder;
    level.traps.push({
        ttyp: 20 /* MAGIC_TRAP */, tx: 10, ty: 10, tseen: false, once: false,
        launch: { x: 0, y: 0 },
    });

    await digHole({});
    assert.equal(1000 - holder.mhp, 2 * (1000 - control.mhp));
});

void test('an unseen monster in a blast leaves an invisible marker', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    const lurker = await createMonsterAt('giant ant', 11, 10);
    lurker.mhp = lurker.mhpmax = 1000;
    lurker.minvis = true;
    level.traps.push({
        ttyp: 20 /* MAGIC_TRAP */, tx: 10, ty: 10, tseen: false, once: false,
        launch: { x: 0, y: 0 },
    });

    await digHole({});
    assert.ok(lurker.mhp < 1000);
    assert.equal(
        level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
});

void test('a shielded hero teaches observers her magic resistance', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    game.u.antimagic = true;
    const observer = await createMonsterAt('giant ant', 12, 10);
    observer.mhp = observer.mhpmax = 1000;
    level.traps.push({
        ttyp: 20 /* MAGIC_TRAP */, tx: 10, ty: 10, tseen: false, once: false,
        launch: { x: 0, y: 0 },
    });

    await digHole({});
    assert.equal(game.u.uhp, 1000);
    assert.ok((observer.seen_resistance ?? 0) & M_SEEN_MAGR);
});

void test('a floating eye flies over a pit dug beneath it', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    const floater = await createMonsterAt('floating eye', 11, 10);
    floater.mhp = floater.mhpmax = 100;

    await digHole({ coordinate: { x: 11, y: 10 }, pitOnly: true });
    assert.ok(level.traps.some(trap =>
        trap.tx === 11 && trap.ty === 10 && trap.ttyp === PIT));
    assert.equal(floater.mtrapped ?? 0, 0);
    assert.match(game._pending_message, /flies over the pit/);
});

void test('a released leash lets a pet fall through a dug hole', async () => {
    const level = heroRoom();
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    requireFixtureGame(game);
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mtame = 1;
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { invlet: 'l', leashmon: pet.m_id });

    await digHole({ coordinate: { x: 11, y: 10 } });
    assert.equal(pet.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.ok((game._migratingMonsters || []).includes(pet));
});

void test('a cursed leash holds a pet above a dug hole', async () => {
    const level = heroRoom();
    requireFixtureGame(game);
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mtame = 1;
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { invlet: 'l',
        leashmon: pet.m_id, cursed: true });

    await digHole({ coordinate: { x: 11, y: 10 } });
    assert.equal(pet.mleashed, 1);
    assert.equal(level.monsters.includes(pet), true);
    assert.equal((game._migratingMonsters || []).includes(pet), false);
});
