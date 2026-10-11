import { createSpecialLevel } from './support/topology.js';
import type { PlacementSubject } from '../js/teleport_rules.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import {
    DB_FLOOR, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, ENGRAVE, GP_ALLOW_U, GP_AVOID_MONPOS,
    GP_CHECKSCARY, HEADSTONE, LAVAPOOL, MM_IGNORELAVA, MM_IGNOREWATER,
    MON_FLOOR, MON_OFFMAP, POOL, ROOM, STONE, WATER, W_NONPASSWALL,
} from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { placeMonsterWormTailRandomly } from '../js/monster_worm.js';
import { BOULDER, DIAMOND, SCR_SCARE_MONSTER, WATER_WALKING_BOOTS } from '../js/object_data.js';
import { relocateObjectRandomly } from '../js/object_teleport.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty, setPropertyTerrainBlocked } from '../js/properties.js';
import { heroTeleportDestinationOk } from '../js/teleport.js';
import { findNearbyMonsterPosition, goodPosition } from '../js/teleport_rules.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const hero: PlacementSubject = { kind: 'hero' };
const species = (name: string): PlacementSubject => ({ kind: 'species', mnum: MONSTER_NAME.indexOf(name) });

void test('a monster can reuse its own square but must still fit its terrain and boulders', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const orc = await createMonsterAt('orc', 12, 10);
    const subject: PlacementSubject = { kind: 'monster', monster: orc };
    assert.equal(goodPosition(12, 10, subject), true);
    assert.equal(goodPosition(12, 10, species('orc')), false);
    assert.equal(goodPosition(12, 10, subject, { gpflags: GP_AVOID_MONPOS }), false);
    game.level.requireAt(12, 10).typ = POOL;
    assert.equal(goodPosition(12, 10, subject), false);
    assert.equal(goodPosition(12, 10, subject, { gpflags: MM_IGNOREWATER }), true);
    game.level.requireAt(12, 10).typ = ROOM;
    await floorObject(BOULDER, 12, 10);
    assert.equal(goodPosition(12, 10, subject), false);
});

void test('worms cannot reuse their own head or body squares', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('long worm', 12, 10);
    placeMonsterWormTailRandomly(worm, 2);
    assert.ok(worm.wormno);
    assert.ok(worm.wormSegments);
    assert.equal(worm.wormSegments.length, 2);
    const subject: PlacementSubject = { kind: 'monster', monster: worm };
    assert.equal(goodPosition(worm.mx, worm.my, subject), false);
    const segment = worm.wormSegments?.[0];
    assert.ok(segment);
    assert.equal(goodPosition(segment.x, segment.y, subject), false);
    assert.equal(goodPosition(segment.x, segment.y, null), true);
});

void test('object placement may share a monster square but generation cannot', async () => {
    freshObjectRoom();
    const orc = await createMonsterAt('orc', 12, 10);
    assert.equal(goodPosition(12, 10, null), true);
    assert.equal(goodPosition(12, 10, null, { gpflags: GP_AVOID_MONPOS }), false);
    orc.mstate = MON_OFFMAP;
    assert.equal(goodPosition(12, 10, species('orc')), true);
    orc.mstate = MON_FLOOR;
    orc.mhp = 0;
    assert.equal(goodPosition(12, 10, species('orc')), false);
});

void test('hero-square exceptions retain actor identity and swallowed occupancy', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const engulfer = await createMonsterAt('purple worm', 12, 10);
    assert.equal(goodPosition(10, 10, hero), true);
    assert.equal(goodPosition(10, 10, null), false);
    assert.equal(goodPosition(10, 10, null, { gpflags: GP_ALLOW_U }), true);
    assert.equal(goodPosition(10, 10, { kind: 'monster', monster: engulfer }), false);
    game.u.ux = 12;
    game.u.ustuck = engulfer;
    game.u.uswallow = 1;
    assert.equal(goodPosition(12, 10, { kind: 'monster', monster: engulfer }), true);
    assert.equal(goodPosition(12, 10, hero), false, 'the engulfer still occupies the hero destination');
});

void test('the ridden monster is allowed at the hero position', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requireFixtureGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    assert.equal(goodPosition(game.u.ux, game.u.uy, { kind: 'monster', monster: pony }), true);
    assert.equal(goodPosition(game.u.ux, game.u.uy, species('pony')), false);
});

void test('ceiling clinging belongs to a live actor, not a species-only search', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const piercer = await createMonsterAt('rock piercer', 12, 10);
    piercer.mundetected = 1;
    game.level.requireAt(14, 10).typ = POOL;
    const subject: PlacementSubject = { kind: 'monster', monster: piercer };
    assert.equal(goodPosition(14, 10, subject), true);
    assert.equal(goodPosition(14, 10, species('rock piercer')), false);
    game.astral_level = createSpecialLevel({ ...game.u.uz });
    assert.equal(goodPosition(14, 10, subject), false);
    delete game.astral_level;
    game.level.requireAt(14, 10).typ = WATER;
    assert.equal(goodPosition(14, 10, subject), false);
});

void test('the Plane of Water has no surface for flying, while swimming still works', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(14, 10).typ = POOL;
    assert.equal(goodPosition(14, 10, species('bat')), true);
    game.water_level = createSpecialLevel({ ...game.u.uz });
    assert.equal(goodPosition(14, 10, species('bat')), false);
    assert.equal(goodPosition(14, 10, species('giant eel')), true);
});

void test('hero placement uses active flight and magical breathing, not breathlessness', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(14, 10).typ = POOL;
    installPolymorphedHero('iron golem');
    assert.equal(goodPosition(14, 10, hero), false);
    grantIntrinsicProperty('magicalBreathing', 'outside');
    assert.equal(goodPosition(14, 10, hero), true);

    freshObjectRoom();
    game.level.requireAt(14, 10).typ = POOL;
    installPolymorphedHero('bat');
    assert.equal(heroTeleportDestinationOk(14, 10), true);
    setPropertyTerrainBlocked('flying', true);
    assert.equal(heroTeleportDestinationOk(14, 10), false);
});

void test('lava admission keeps floating eyes away and requires protected water-walking boots', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(14, 10).typ = LAVAPOOL;
    assert.equal(goodPosition(14, 10, species('floating eye')), false);
    assert.equal(goodPosition(14, 10, species('fire elemental')), true);
    assert.equal(goodPosition(14, 10, species('orc'), { gpflags: MM_IGNOREWATER }), false);
    assert.equal(goodPosition(14, 10, species('orc'), { gpflags: MM_IGNORELAVA }), true);
    grantIntrinsicProperty('fireResistance', 'outside');
    const boots = await addInventoryObject(WATER_WALKING_BOOTS);
    wearHeroArmor(boots);
    assert.equal(goodPosition(14, 10, hero), false);
    boots.oerodeproof = true;
    assert.equal(goodPosition(14, 10, hero), true);
    installPolymorphedHero('floating eye');
    assert.equal(goodPosition(14, 10, hero), false);
});

void test('raised drawbridges retain their liquid placement restrictions', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const bridge = game.level.requireAt(14, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_MOAT;
    assert.equal(goodPosition(14, 10, species('orc')), false);
    assert.equal(goodPosition(14, 10, species('giant eel')), true);
    bridge.drawbridgemask = DB_LAVA;
    assert.equal(goodPosition(14, 10, species('orc')), false);
    assert.equal(goodPosition(14, 10, species('fire elemental')), true);
});

void test('wall passers ignore a floor boulder but not a nonpasswall stone cell', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await floorObject(BOULDER, 14, 10);
    const cell = game.level.requireAt(14, 10);
    cell.wall_info = W_NONPASSWALL;
    assert.equal(goodPosition(14, 10, species('orc')), false);
    assert.equal(goodPosition(14, 10, species('stone giant')), true);
    assert.equal(goodPosition(14, 10, species('ghost')), true);
    cell.typ = STONE;
    assert.equal(goodPosition(14, 10, species('ghost')), false);
});

void test('generation exclusions do not constrain ordinary placement', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.exclusionZones = [{ type: 'monster-generation', lx: 14, hx: 14, ly: 10, hy: 10 }];
    assert.equal(goodPosition(14, 10, species('orc')), true);
    assert.equal(goodPosition(14, 10, species('orc'), { gpflags: GP_AVOID_MONPOS }), false);
    assert.equal(goodPosition(14, 10, species('ghost'), { gpflags: GP_AVOID_MONPOS }), true);
});

void test('full actor scariness differs from a zeroed species dummy', async () => {
    freshObjectRoom();
    const orc = await createMonsterAt('orc', 12, 10);
    orc.mpeaceful = 1;
    makeEngravingAt(14, 10, 'eLbErEtH', null, 0, ENGRAVE);
    const options = { gpflags: GP_CHECKSCARY };
    assert.equal(goodPosition(14, 10, species('orc'), options), false);
    assert.equal(goodPosition(14, 10, { kind: 'monster', monster: orc }, options), true);
    await floorObject(SCR_SCARE_MONSTER, 14, 10);
    assert.equal(goodPosition(14, 10, { kind: 'monster', monster: orc }, options), false);
});

for (const [type, time, avoids] of [[ENGRAVE, 0, true], [HEADSTONE, 0, false], [ENGRAVE, 100, false]] as const) {
    void test(`species placement respects engraving completion and type (${type}, ${time})`, () => {
        freshObjectRoom();
        makeEngravingAt(14, 10, 'eLbErEtH', null, time, type);
        assert.equal(goodPosition(14, 10, species('orc'), { gpflags: GP_CHECKSCARY }), !avoids);
    });
}

void test('enexto with no species uses the original hero body, not the current polymorph', () => {
    freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10 });
    requireFixtureGame(game);
    game.level.requireAt(11, 10).typ = POOL;
    installPolymorphedHero('giant eel');
    assert.equal(findNearbyMonsterPosition(null, 10, 10), null);
    assert.deepEqual(findNearbyMonsterPosition(game.u.umonnum, 10, 10), { x: 11, y: 10 });
});

void test('random object relocation rejects a raised bridge but can land under a monster', async () => {
    freshObjectRoom({ left: 10, right: 12, top: 10, bottom: 10 });
    requireFixtureGame(game);
    await createMonsterAt('orc', 12, 10);
    const bridge = game.level.requireAt(11, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_FLOOR;
    const gem = await floorObject(DIAMOND, 10, 10);
    initRng(1n);

    await relocateObjectRandomly(gem);

    assert.deepEqual([gem.ox, gem.oy], [12, 10]);
});

for (const terrain of [LAVAPOOL, DRAWBRIDGE_UP] as const) {
    void test(`water walking does not permit lava placement on the Plane of Water (${terrain})`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const cell = game.level.requireAt(14, 10);
        cell.typ = terrain;
        cell.drawbridgemask = DB_LAVA;
        grantIntrinsicProperty('fireResistance', 'outside');
        const boots = await addInventoryObject(WATER_WALKING_BOOTS, { oerodeproof: true });
        wearHeroArmor(boots);
        assert.equal(goodPosition(14, 10, hero), true);
        game.water_level = createSpecialLevel({ ...game.u.uz });

        assert.equal(goodPosition(14, 10, hero), false);

        grantIntrinsicProperty('levitation', 'outside');
        assert.equal(goodPosition(14, 10, hero), true, 'levitation remains a separate lava protection');
    });
}
