import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import type { Monster } from '../js/monster_types.js';
import { requireScreenRow } from './support/screen.js';
import { createRoom } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ARROW_TRAP, CORR, DOOR, MON_FLOOR, PIT, STONE, VAULT, VWALL, W_NONDIGGABLE } from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { maketrap } from '../js/mklev.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { sendMonsterToLimbo } from '../js/monster_migration.js';
import { unpunishHero } from '../js/punishment.js';
import { restoreGame, saveGame } from '../js/save.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import { setWallStateAt } from '../js/wall_topology.js';
import { memoryStorage } from './support/memory-storage.js';
import { moveObject } from '../js/floor_object.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { killGenocidedMonster } from '../js/mon.js';
import { finishEnvironmentalMonsterDeath, finishMonsterLiquidDeath } from '../js/monster_death.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CORPSE, DAGGER, GOLD_PIECE, POT_HEALING } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { installPunishedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function guardCorridor({ blocked = true } = {}) {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const vault = createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT });
    level.rooms.push(vault);
    const guard = await createMonsterAt('guard', 13, 10);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    guard._egd = {
        gdlevel: { ...game.u.uz }, vault,
        gddone: 0, ogx: 13, ogy: 10, gdx: 16, gdy: 10,
        warncnt: 0, dropgoldcnt: 0, fcbeg: 0, fcend: 3,
        fakecorr: [
            { x: 11, y: 10, typ: VWALL, flags: 0 },
            { x: 12, y: 10, typ: STONE, flags: 0 },
            { x: 13, y: 10, typ: STONE, flags: 0 },
        ],
    };
    assert.ok(guard._egd !== undefined && guard._egd !== null, 'Expected guard._egd to be initialized');
    for (const point of guard._egd.fakecorr)
        level.requireAt(point.x, point.y).typ = CORR;
    if (blocked) {
        const { ball, chain } = await installPunishedHero();
        await moveObject(chain, 11, 10);
        await moveObject(ball, 12, 10);
    }
    const gold = await knownObject(GOLD_PIECE, { quan: 17 });
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(guard, gold);
    await addObjectToMonsterInventory(guard, dagger);
    installPagerInput(resetInputState(), { expected: /guard|corridor|rock|gold|chain|iron ball|vanish/i, limit: 8 });
    return { level, guard, gold, dagger };
}

const deathEntries: readonly [string, (guard: Monster) => Promise<unknown>][] = [
    ['environmental death', guard => finishEnvironmentalMonsterDeath(guard, game, {
        noCorpse: true,
    })],
    ['hero kill', guard => finishHeroMonsterKill(guard, guard.mx, guard.my, {
        noCorpse: true, showKillMessage: false,
    })],
    ['genocide', guard => killGenocidedMonster(guard, game)],
    ['departure', guard => removeMonsterFromGame(guard)],
];

for (const [cause, finish] of deathEntries) {
    void test(`${cause} parks a guard while the punishment ball blocks its corridor`, async () => {
        const { level, guard, gold, dagger } = await guardCorridor();
        requirePlayingGame(game);
        guard.mhp = 0;

        await finish(guard);

        assert.equal(level.monsters.includes(guard), true);
        assert.deepEqual([guard.mx, guard.my, guard.mhp], [0, 0, 0]);
        assert.equal(guard.mstate, MON_FLOOR);
        assert.equal(!!guard.dead, false);
        assert.equal(level.requireAt(11, 10).typ, VWALL);
        assert.equal(level.requireAt(12, 10).typ, CORR);
        assert.equal(level.requireAt(13, 10).typ, CORR);
        assert.equal(floorObjectsAt(level, 13, 10).includes(dagger), true);
        assert.equal(guard.minvent.length, 0);
        assert.equal(gold.where, 'gone');
        assert.ok(game.mvitals !== undefined && game.mvitals !== null, 'Expected game.mvitals to be initialized');
        assert.equal(game.mvitals[guard.mnum]?.died ?? 0, 0);
        if (cause === 'hero kill') {
            assert.equal(game.u.uconduct.killer, 1);
            assert.ok(game.u.uexp > 0);
        } else {
            assert.equal(game.u.uconduct.killer ?? 0, 0);
        }
    });
}

void test('an unblocked dead guard restores its corridor before final removal', async () => {
    const { level, guard, gold, dagger } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);

    const result = await removeMonsterFromGame(guard);

    assert.equal(result.removed, true);
    assert.equal(level.monsters.includes(guard), false);
    assert.equal(level.requireAt(11, 10).typ, VWALL);
    assert.equal(level.requireAt(12, 10).typ, STONE);
    assert.equal(level.requireAt(13, 10).typ, STONE);
    assert.equal(floorObjectsAt(level, 13, 10).includes(dagger), true);
    assert.equal(gold.where, 'gone');
});

void test('environmental death still rolls for remains but cannot place them at a parked guard', async () => {
    const { guard } = await guardCorridor();
    requirePlayingGame(game);

    const death = await finishEnvironmentalMonsterDeath(guard, game, {
        random: () => 0,
    });

    assert.equal(death.corpse, null);
    assert.equal(game.level.monsters.includes(guard), true);
});

void test('the same corpse chance leaves remains when a guard is clear of its corridor', async () => {
    const { level, guard } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);
    placeMonsterAt(guard, 14, 10);

    const death = await finishEnvironmentalMonsterDeath(guard, game, {
        random: () => 0,
    });

    assert.equal(death.corpse?.otyp, CORPSE);
    assert.equal(floorObjectsAt(level, 14, 10).includes(death.corpse), true);
    assert.equal(level.monsters.includes(guard), false);
});

void test('restoration removes traps and engravings but keeps embedded objects and their memory', async () => {
    const { level, guard } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);
    const pit = await maketrap(12, 10, PIT);
    const arrow = await maketrap(11, 10, ARROW_TRAP);
    const engraving = makeEngravingAt(12, 10, 'temporary tunnel');
    const potion = await floorObject(POT_HEALING, 12, 10);
    const neighbor = level.requireAt(12, 9);
    neighbor.typ = STONE;
    neighbor.lit = neighbor.waslit = true;
    neighbor.seenv = 255;
    const room = level.requireAt(11, 9);
    const roomLighting = [room.lit, room.waslit];

    await removeMonsterFromGame(guard);

    assert.ok(pit && arrow && engraving);
    assert.equal(level.traps.includes(pit), false);
    assert.equal(level.traps.includes(arrow), false);
    assert.ok(level.engravings !== undefined && level.engravings !== null, 'Expected level.engravings to be initialized');
    assert.equal(level.engravings.includes(engraving), false);
    assert.equal(potion.where, 'floor');
    assert.equal(level.requireAt(12, 10).lastseentyp, STONE);
    assert.equal(level.requireAt(12, 10).remembered_glyph?.kind, 'object');
    assert.equal(neighbor.lit, false);
    assert.equal(neighbor.waslit, false);
    assert.notEqual(neighbor.seenv, 255);
    assert.deepEqual([room.lit, room.waslit], roomLighting);
    assert.equal(level.requireAt(12, 10).lit, false);
    assert.equal(level.requireAt(12, 10).waslit, false);
    assert.equal(game.vision_full_recalc, 1);
});

void test('a dead guard does not let the living hero block terrain restoration', async () => {
    const { level, guard } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);
    game.u.ux = 12;
    game.u.uy = 10;

    await removeMonsterFromGame(guard);

    assert.equal(level.requireAt(12, 10).typ, STONE);
    await flush_screen();
    const row = requireScreenRow(0);
    assert.ok(row);
    const topline = row.map(cell => cell.ch).join('');
    assert.match(topline, /encased in rock/);
});

void test('another guard blocks restoration even at zero hit points', async () => {
    const { level, guard } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);
    const blocker = await createMonsterAt('guard', 12, 10);
    blocker.isgd = 1;
    assert.ok(guard._egd);
    blocker._egd = { ...guard._egd, fakecorr: [], fcbeg: 0, fcend: 0 };
    blocker.mhp = 0;

    await removeMonsterFromGame(guard);

    assert.equal(level.monsters.includes(guard), true);
    assert.equal(level.requireAt(12, 10).typ, CORR);
    assert.deepEqual([blocker.mx, blocker.my], [12, 10]);
});

void test('saving a parked guard preserves the obstruction and the pending restoration', async () => {
    const { guard } = await guardCorridor();
    requirePlayingGame(game);
    await removeMonsterFromGame(guard);
    game.plname = 'ParkedGuard';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);

    assert.equal(restoreGame('ParkedGuard', storage), true);
    const restored = game.level.monsters.find(monster => monster.m_id === guard.m_id);
    assert.notEqual(restored, guard);
    assert.ok(restored !== undefined && restored !== null, 'Expected restored to be initialized');
    assert.deepEqual([restored.mx, restored.my], [0, 0]);
    await unpunishHero();
    await removeMonsterFromGame(restored);

    assert.equal(game.level.monsters.includes(restored), false);
    assert.equal(game.level.requireAt(12, 10).typ, STONE);
});

void test('guard arrival preserves the vault wall restriction for restoration', async () => {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    const vault = createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT });
    level.rooms.push(vault);
    level.requireAt(16, 10).typ = CORR;
    const wall = level.requireAt(11, 10);
    wall.typ = VWALL;
    wall.wall_info = W_NONDIGGABLE;
    setWallStateAt(11, 10);
    game.u.uinvault = 29;
    const input = resetInputState();
    assert.equal(maintainVaultResidence(), true);
    const arrived = await answerPrompts(continueVaultGuardArrival(), input, [
        { prompt: /Suddenly one of the Vault's guards enters![\s\S]*--More--/, keys: ' ' },
        { prompt: /Hello stranger, who are you\?/, keys: 'TestHero\n' },
        { prompt: /I don't know you\.[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(arrived, true);
    const guard = level.monsters.find(monster => monster.isgd);
    assert.ok(guard);
    assert.equal(wall.typ, DOOR);
    assert.equal(guard.name, undefined);
    installPagerInput(input, { expected: /follow me|guard|corridor|rock/i, limit: 4 });

    await removeMonsterFromGame(guard);

    assert.equal(wall.typ, VWALL);
    assert.notEqual(wall.wall_info & W_NONDIGGABLE, 0);
});

for (const done of [false, true]) {
    void test(`a ${done ? 'finished' : 'unfinished'} parked guard prevents another arrival`, async () => {
        const { level, guard } = await guardCorridor();
        requirePlayingGame(game);
        await removeMonsterFromGame(guard);
        assert.ok(guard._egd !== undefined && guard._egd !== null, 'Expected guard._egd to be initialized');
        guard._egd.gddone = done ? 1 : 0;
        game.u.uinvault = 29;

        assert.equal(maintainVaultResidence(), false);

        assert.equal(level.monsters.filter(monster => monster.isgd).length, 1);
        assert.equal(guard.mhp, done ? 0 : guard.mhpmax);
        assert.deepEqual([guard.mx, guard.my], [0, 0]);
    });
}

void test('a migrating guard returns directly to its unfinished home corridor', async () => {
    const { level, guard } = await guardCorridor();
    requirePlayingGame(game);
    await removeMonsterFromGame(guard);
    await sendMonsterToLimbo(guard);
    assert.equal(level.monsters.includes(guard), false);
    assert.ok(game._migratingMonsters !== undefined && game._migratingMonsters !== null, 'Expected game._migratingMonsters to be initialized');
    assert.equal(game._migratingMonsters.includes(guard), true);
    game.u.uinvault = 29;

    assert.equal(maintainVaultResidence(), false);

    assert.equal(level.monsters.includes(guard), true);
    assert.equal(game._migratingMonsters.includes(guard), false);
    assert.equal(guard.mstate, MON_FLOOR);
    assert.deepEqual([guard.mx, guard.my, guard.mhp], [0, 0, 0]);
});

void test('a guard away from its corridor level drops its gold without restoring unrelated terrain', async () => {
    const { level, guard, gold } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);
    assert.ok(guard._egd !== undefined && guard._egd !== null, 'Expected guard._egd to be initialized');
    guard._egd.gdlevel.dlevel++;

    await finishEnvironmentalMonsterDeath(guard, game, { noCorpse: true });

    assert.equal(level.monsters.includes(guard), false);
    assert.equal(level.requireAt(11, 10).typ, CORR);
    assert.equal(level.requireAt(12, 10).typ, CORR);
    assert.equal(floorObjectsAt(level, 13, 10).includes(gold), true);
});

void test('liquid death starts guard cleanup at zero HP and still applies the corpse square gate', async () => {
    const { level, guard } = await guardCorridor({ blocked: false });
    requirePlayingGame(game);
    game.u.ux = 12;
    game.u.uy = 10;
    assert.ok(guard.mhp > 0);

    const result = await finishMonsterLiquidDeath(guard, { leaveCorpse: true });

    assert.equal(level.requireAt(12, 10).typ, STONE);
    assert.equal(level.monsters.includes(guard), false);
    assert.equal(result.corpse, null);
});
