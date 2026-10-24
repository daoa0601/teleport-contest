import { floorObjectsAt } from './support/level-state.js';
import { requireScreenRow } from './support/screen.js';
import type { Monster } from '../js/monster_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COLNO, HOLE, LADDER, MIGR_APPROX_XY, MIGR_EXACT_XY, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, ROOM, ROWNO, VWALL, NO_MINVENT,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { collectLevelFollowers } from '../js/monster_followers.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_YENDOR } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import {
    deliverMigratingMonsters,
    migrateMonsterOffLevel,
    sendMonsterToLimbo,
} from '../js/monster_migration.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { resurrectWizard } from '../js/wizard.js';
import { restoreGame, saveGame } from '../js/save.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createStaffedShop } from './support/shop.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';

function enterDestinationLevel() {
    const cache = game._levelCache?.get('0:2');
    assert.ok(cache);
    game.level = cache.level;
    game.stairs = cache.stairs;
    game.u.uz = { dnum: 0, dlevel: 2 };
}

function near(monster: Monster, x: number, y: number) {
    return Math.abs(monster.mx - x) <= 3 && Math.abs(monster.my - y) <= 3;
}

void test('a fallen monster arrives after save, restore, and level entry', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    game.plname = 'Migrant';
    initRng(17n);
    const monster = await createMonsterAt('jackal', 12, 10);
    const monsterId = monster.m_id;
    monster.mhp = 5;
    monster.mhpmax = 20;
    const hole = addTrap(game.level, HOLE, 12, 10, {
        dst: { dnum: 0, dlevel: 2 },
    });

    const event = await migrateMonsterOffLevel(monster, game, hole, {
        mode: MIGR_RANDOM,
    });
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(event.destination.dlevel, 2);

    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Migrant', storage), true);
    assert.ok(
        (game._migratingMonsters || [])
            .some(candidate => candidate.m_id === monsterId),
    );

    game.moves = (game.moves ?? 1) + 400;
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });

    const arrived = game.level.monsters
        .find(candidate => candidate.m_id === monsterId);
    assert.ok(arrived, 'the migrated monster should be on the level');
    assert.ok(arrived.mx > 0 && arrived.my >= 0);
    // C mon_catchup_elapsed_time(): floor(399/20) = 19 healing, capped.
    assert.equal(arrived.mhp, 20);
});

void test('a pet separated for a long time grows wilder before arriving', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(19n);
    const pet = await createMonsterAt('kitten', 12, 10);
    initializePet(pet);
    pet.mtame = 5;
    pet.mpeaceful = 1;
    const hole = addTrap(game.level, HOLE, 12, 10, {
        dst: { dnum: 0, dlevel: 2 },
    });
    await migrateMonsterOffLevel(pet, game, hole, { mode: MIGR_RANDOM });

    // 450 elapsed moves: one point of tameness per 150 moves.
    game.moves = (game.moves ?? 1) + 451;
    enterDestinationLevel();
    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    assert.equal(pet.mtame, 2);
    assert.ok(game.level.monsters.includes(pet));
});

void test('an exact-position migrant reappears at its recorded square', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(23n);
    const monster = await createMonsterAt('jackal', 12, 10);
    await migrateMonsterOffLevel(monster, game, { dst: { dnum: 0, dlevel: 1 } }, {
        mode: MIGR_EXACT_XY,
        coordinate: { x: 12, y: 10 },
    });

    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    assert.equal(monster.mx, 12);
    assert.equal(monster.my, 10);
    assert.ok(game.level.monsters.includes(monster));
});

void test('a stair-directed migrant arrives by the connecting stair', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(29n);
    const monster = await createMonsterAt('jackal', 12, 10);
    await migrateMonsterOffLevel(monster, game, {
        dst: { dnum: 0, dlevel: 2 },
    }, { mode: MIGR_STAIRS_DOWN });

    enterDestinationLevel();
    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    // The destination's stair back to level 1 sits at 12,10.
    assert.ok(near(monster, 12, 10));
});

void test('a special-stair migrant uses the first connecting stair even when it is a ladder', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 14, 10, NO_MINVENT);
    await migrateMonsterOffLevel(monster, game, {
        dst: { dnum: 0, dlevel: 2 },
    }, { mode: MIGR_SSTAIRS });
    enterDestinationLevel();
    game.level.requireAt(16, 10).typ = LADDER;
    game.stairs = {
        sx: 16, sy: 10, up: true, isladder: true, u_traversed: false,
        tolev: { dnum: 0, dlevel: 1 }, next: game.stairs,
    };

    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    assert.equal(monster.mx, 16, 'the first matching ladder takes priority over the older stairs');
    assert.equal(monster.my, 10);
});

void test('a limbo monster returns near its former square', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(31n);
    const monster = await createMonsterAt('jackal', 12, 10);
    await sendMonsterToLimbo(monster);

    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(monster.migrationDestination?.dlevel, 1);

    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    assert.ok(near(monster, 12, 10));
    assert.ok(game.level.monsters.includes(monster));
});

void test('a migrant with no room on the level stays in migration', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(37n);
    const monster = await createMonsterAt('jackal', 12, 10);
    await migrateMonsterOffLevel(monster, game, {
        dst: { dnum: 0, dlevel: 1 },
    }, { mode: MIGR_RANDOM });

    for (let x = 0; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            game.level.requireAt(x, y).typ = VWALL;

    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 0);
    assert.ok(game._migratingMonsters?.includes(monster));
    assert.equal(game.level.monsters.includes(monster), false);

    game.level.requireAt(12, 10).typ = ROOM;
    assert.equal(await deliverMigratingMonsters(game), 1);
    assert.equal(game.level.monsters.filter(candidate => candidate === monster).length, 1);
    assert.equal(monster.mx, 12);
    assert.equal(monster.my, 10);
});

void test('a migrating long worm keeps its tail length', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(41n);
    const worm = await createMonsterAt('long worm', 12, 10);
    initializeMonsterWormBody(worm, {
        allowTail: true, segmentCount: 4,
    });
    assert.equal(worm.wormSegments?.length, 4);

    await migrateMonsterOffLevel(worm, game, {
        dst: { dnum: 0, dlevel: 2 },
    }, { mode: MIGR_RANDOM });
    assert.equal(worm.migratingWormSegments, 4);

    enterDestinationLevel();
    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    assert.equal(worm.wormSegments?.length, 4);
    assert.ok(game.level.monsters.includes(worm));
});

void test('a migrating Wizard is recalled instead of recreated', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(47n);
    const wizard = await createMonsterAt(285, 12, 10);
    const wizardId = wizard.m_id;
    wizard.msleeping = 0;
    await migrateMonsterOffLevel(wizard, game, {
        dst: { dnum: 0, dlevel: 2 },
    }, { mode: MIGR_RANDOM });
    game.moves = (game.moves ?? 1) + 60;

    const recalled = await resurrectWizard();

    assert.equal(recalled?.m_id, wizardId);
    assert.ok(game.level.monsters.includes(wizard));
    assert.ok(wizard.mx > 0);
    assert.equal(wizard.mpeaceful, 0);
    assert.ok(
        (game._migratingMonsters || []).every(candidate =>
            candidate !== wizard),
    );
    assert.match(game._pending_message, /elude me, fool\./);
});

void test('a departing shopkeeper releases her residency and restores it on return', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    initRng(53n);
    const { shopkeeper: keeper, room } = await createStaffedShop({ keeperX: 12, keeperY: 10 });

    await sendMonsterToLimbo(keeper);
    assert.equal(room.resident, null);

    const delivered = await deliverMigratingMonsters(game);

    assert.equal(delivered, 1);
    assert.equal(room.resident, keeper);
});

void test('entering limbo leaves the Amulet behind without discarding an ordinary artifact', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 12, 10);
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    const sword = await knownObject(artifact.baseType);
    assert.equal(nameArtifact(sword, artifact), true);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(monster, sword, game);
    await addObjectToMonsterInventory(monster, amulet, game);

    await sendMonsterToLimbo(monster);

    assert.ok(monster.minvent.includes(sword));
    assert.equal(sword.where, 'minvent');
    assert.equal(amulet.where, 'floor');
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(amulet));
    assert.equal(game.level.monsters.includes(monster), false);
    assert.ok(game._migratingMonsters?.includes(monster));

    await deliverMigratingMonsters(game);

    assert.ok(game.level.monsters.includes(monster));
    assert.ok(monster.minvent.includes(sword));
    assert.ok(floorObjectsAt(game.level, 12, 10).includes(amulet));
});

void test('the last queued exact-position migrant claims a contested arrival square first', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const first = await createMonsterAt('jackal', 12, 10);
    const last = await createMonsterAt('fox', 14, 10);
    for (const monster of [first, last]) {
        await migrateMonsterOffLevel(monster, game, {
            dst: { dnum: 0, dlevel: 1 },
        }, {
            mode: MIGR_EXACT_XY,
            coordinate: { x: 12, y: 10 },
        });
    }

    assert.equal(await deliverMigratingMonsters(game), 2);

    assert.equal(last.mx, 12);
    assert.equal(last.my, 10);
    assert.ok(first.mx !== last.mx || first.my !== last.my);
});

void test('a descending migrant uses the downward arrival region and avoids its excluded part', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    destination.downTeleportRegion = {
        lx: 15, ly: 11, hx: 16, hy: 12,
        exclude: { lx: 15, ly: 11, hx: 15, hy: 12 },
    };
    const orc = await createMonsterAt('orc', 14, 10);
    await migrateMonsterOffLevel(orc, game, { dst: { dnum: 0, dlevel: 2 } });
    initRng(1n);

    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });

    assert.equal(orc.mx, 16);
    assert.ok(orc.my === 11 || orc.my === 12);
});

void test('an ascending migrant retains upward arrival restrictions through save and restore', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    source.upTeleportRegion = {
        lx: 15, ly: 11, hx: 16, hy: 12,
        exclude: { lx: 15, ly: 11, hx: 15, hy: 12 },
    };
    source.downTeleportRegion = { lx: 8, ly: 8, hx: 9, hy: 8 };
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    const orc = await createMonsterAt('orc', 14, 10);
    const id = orc.m_id;
    await migrateMonsterOffLevel(orc, game, { dst: { dnum: 0, dlevel: 1 } });
    const storage = memoryStorage();
    game.plname = 'Ascending';
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Ascending', storage), true);
    initRng(1n);

    const input = resetInputState();
    const ascending = gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });
    await input.waitUntilBlocked();
    try {
        const topline = requireScreenRow(0).map(cell => cell.ch).join('');
        assert.match(topline, /You climb up the stairs\.--More--/);
    } finally {
        // C goto_level() completes its screen reset after this acknowledgment.
        input.feed(' ');
        await ascending;
    }

    const arrived = game.level.monsters.find(monster => monster.m_id === id);
    assert.ok(arrived);
    assert.equal(arrived.mx, 16);
    assert.ok(arrived.my === 11 || arrived.my === 12);
});

void test('returning residents keep their squares before followers and regular migrants find room', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    const returning = await createMonsterAt('jackal', 13, 10, NO_MINVENT);
    await migrateMonsterOffLevel(returning, game, { dst: { dnum: 0, dlevel: 2 } }, {
        mode: MIGR_EXACT_XY, coordinate: { x: 13, y: 10 },
    });
    const migrant = await createMonsterAt('jackal', 14, 10, NO_MINVENT);
    await migrateMonsterOffLevel(migrant, game, { dst: { dnum: 0, dlevel: 2 } }, {
        mode: MIGR_APPROX_XY, coordinate: { x: 14, y: 10 },
    });
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet);
    const followers = await collectLevelFollowers(game);
    enterDestinationLevel();
    game.u.ux = 12;
    game.u.uy = 10;
    // An occupied stair and three open squares make arrival precedence
    // observable without relying on a particular random placement.
    await createMonsterAt('lichen', 12, 10, NO_MINVENT);
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            destination.requireAt(x, y).typ = VWALL;
    }
    for (const x of [12, 13, 14, 17]) destination.requireAt(x, 10).typ = ROOM;

    await deliverMigratingMonsters(game, followers);

    assert.equal(returning.mx, 13);
    assert.equal(returning.my, 10);
    assert.equal(pet.mx, 14, 'The follower needs the remaining square near the hero.');
    assert.equal(pet.my, 10);
    assert.equal(migrant.mx, 17, 'The ordinary migrant must find room after the follower arrives.');
    assert.equal(migrant.my, 10);
});
