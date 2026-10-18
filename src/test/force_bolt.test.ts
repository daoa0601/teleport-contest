import { objectTypeKnown } from '../js/shk.js';
import { createDungeon } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DUST, D_BROKEN, D_LOCKED,
    HOLE, MOAT, STATUE_TRAP, TRAPDOOR,
} from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createCorpstatAt } from '../js/mklev.js';
import {
    BOULDER, CLUB, EGG, MIRROR, POT_WATER, ROCK, SPE_FORCE_BOLT, STATUE,
    WAN_STRIKING,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { castSpell } from '../js/spell.js';
import { learnSpell } from './support/spells.js';
import { dozap } from '../js/zap.js';
import {
    chargedWand, floorObject, knownObject,
} from './support/game-objects.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom, installPolymorphedHero } from './support/hero-state.js';
import { createRoomLevel, freshGameplayRoom } from './support/playable-room.js';

const PM_JACKAL = 12;

async function createJackal(x = 12) {
    const jackal = await createMonsterAt('jackal', x, 10);
    jackal.mhp = jackal.mhpmax = 100;
    return jackal;
}


void test('force bolt damages a monster in its path', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    const monster = await createJackal();
    pushKeys('l');

    await castSpell(SPE_FORCE_BOLT);

    assert.ok(monster.mhp < 100);
    assert.equal(game.u.uen, 35);
    assert.equal(game.context.move, 1);
});

void test('magic resistance bounces a self-zapped wand of striking', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.antimagic = true;
    const startingHitPoints = game.u.uhp;
    const wand = await chargedWand(WAN_STRIKING, { charges: 2 });
    game.inventory = [wand];
    pushKeys('a.');

    await dozap();

    assert.equal(game.u.uhp, startingHitPoints);
    assert.equal(objectTypeKnown(wand), true);
    assert.equal(wand.spe, 1);
});

void test('force bolt breaks a locked door and continues through its square',
    async () => {
        freshCasterRoom();
        requireFixtureGame(game);
        await learnSpell(SPE_FORCE_BOLT);
        const door = game.level.requireAt(12, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        pushKeys('l');

        await castSpell(SPE_FORCE_BOLT);

        assert.equal(door.doormask, D_BROKEN);
        assert.equal(game.context.move, 1);
    });

void test('force bolt collapses a lowered drawbridge', async () => {
    const level = freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    const bridge = level.requireAt(12, 10);
    bridge.typ = DRAWBRIDGE_DOWN;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    const wall = level.requireAt(12, 9);
    wall.typ = DOOR;
    wall.doormask = 0;
    pushKeys(`l${' '.repeat(20)}`);

    await castSpell(SPE_FORCE_BOLT);

    assert.equal(bridge.typ, MOAT);
    assert.equal(wall.typ, DOOR);
    assert.equal(game.context.move, 1);
});

void test('force bolt fractures a boulder into rocks', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    const boulder = await floorObject(BOULDER, 12, 10, {
        dknown: true,
    });
    pushKeys('l');

    await castSpell(SPE_FORCE_BOLT);

    assert.equal(boulder.otyp, ROCK);
    assert.ok(boulder.quan >= 7 && boulder.quan <= 66);
    assert.equal(floorObjectsAt(requireGameLevel(game), 12, 10).includes(boulder), true);
});

void test('force bolt breaks fragile floor objects and continues past them',
    async () => {
        freshCasterRoom();
        await learnSpell(SPE_FORCE_BOLT);
        const potion = await floorObject(POT_WATER, 12, 10);
        const club = await floorObject(CLUB, 12, 10);
        const monster = await createJackal(13);
        pushKeys(`l${' '.repeat(20)}`);

        await castSpell(SPE_FORCE_BOLT);

        assert.equal(potion.where, 'gone');
        assert.equal(club.where, 'floor');
        assert.ok(monster.mhp < 100);
    });

void test('force bolt detonates a pyrolisk egg through the fire explosion rules',
    async () => {
        freshCasterRoom();
        requireFixtureGame(game);
        await learnSpell(SPE_FORCE_BOLT);
        game.u.uhp = game.u.uhpmax = 100;
        const egg = await floorObject(EGG, 11, 10, { corpsenm: 11 });
        pushKeys(`l${' '.repeat(60)}`);

        await castSpell(SPE_FORCE_BOLT);

        assert.equal(egg.where, 'gone');
        assert.ok(game.u.uhp < 100);
    });

void test('force bolt releases the monster from a statue trap', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    initRng(9401n);
    const statue = await createCorpstatAt(STATUE, null, PM_JACKAL, 12, 10, 0);
    const club = await knownObject(CLUB, { where: 'contained', spe: 0 });
    club.container = statue;
    statue.contents = [club];
    addTrap(game.level, STATUE_TRAP, 12, 10, { tseen: false });
    pushKeys('l');

    await castSpell(SPE_FORCE_BOLT);

    const released = game.level.monsters.find(monster =>
        monster.mnum === PM_JACKAL && monster.mx === 12 && monster.my === 10,
    );
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(released.mtame, 0);
    assert.ok(released.minvent !== null && released.minvent !== undefined);
    assert.ok(released.minvent.includes(club));
    assert.equal(statue.where, 'gone');
    assert.equal(game.level.traps.some(trap =>
        trap.tx === 12 && trap.ty === 10), false);
});

void test('force bolt aimed down strikes the floor pile and engraving', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    const boulder = await floorObject(BOULDER, game.u.ux, game.u.uy, {
        dknown: true,
    });
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth', null, 0, DUST);
    pushKeys('>');

    await castSpell(SPE_FORCE_BOLT);

    assert.equal(boulder.otyp, ROCK);
    assert.notEqual(
        engravingAt(game.u.ux, game.u.uy)?.text,
        'Elbereth',
    );
});

void test('a downward force bolt skips the object concealing the hero', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    // A vocal cobra can chant while hiding under objects; a silent spider
    // is correctly rejected by the native casting admission.
    installPolymorphedHero('cobra');
    game.u.uundetected = 1;
    const mirror = await floorObject(MIRROR, game.u.ux, game.u.uy);
    const cover = await floorObject(CLUB, game.u.ux, game.u.uy);

    pushKeys('>' + ' '.repeat(20));
    await castSpell(SPE_FORCE_BOLT);

    assert.equal(cover.where, 'floor');
    assert.equal(mirror.where, 'gone');
});

void test('an upward force bolt hits the concealment cover when no ceiling rock falls',
    async () => {
        freshCasterRoom();
        requireFixtureGame(game);
        await learnSpell(SPE_FORCE_BOLT);
        installPolymorphedHero('cobra');
        game.u.uundetected = 1;
        const lowerObject = await floorObject(CLUB, game.u.ux, game.u.uy);
        const cover = await floorObject(MIRROR, game.u.ux, game.u.uy);
        initRng(2n);

        pushKeys('<' + ' '.repeat(20));
        await castSpell(SPE_FORCE_BOLT);

        assert.equal(cover.where, 'gone');
        assert.equal(lowerObject.where, 'floor');
    });

void test('force bolt aimed up can dislodge a rock from the ceiling', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    game.u.uhp = game.u.uhpmax = 100;
    initRng(1n);
    pushKeys('<');

    await castSpell(SPE_FORCE_BOLT);

    assert.ok(game.u.uhp < 100);
    assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)
        .some(object => object.otyp === ROCK));
});

void test('force bolt shatters a trapdoor and drops the hero to the next level', async () => {
    freshCasterRoom();
    requireFixtureGame(game);
    await learnSpell(SPE_FORCE_BOLT);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ num_dunlevs: 3 } })];
    const trap = addTrap(
        game.level, TRAPDOOR, game.u.ux, game.u.uy, {
            tseen: true,
            dst: { dnum: 0, dlevel: 2 },
        },
    );
    const destination = createRoomLevel();
    game._levelCache = new Map([['0:2', {
        level: destination, stairs: null, heroTrack: [], savedAt: game.moves,
    }]]);
    pushKeys('>' + ' '.repeat(20));

    await castSpell(SPE_FORCE_BOLT);
    await finishScheduledLevelChange();

    assert.equal(trap.ttyp, HOLE);
    assert.equal(game.u.uz.dnum, 0);
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game.level, destination);
    assert.equal(game._levelCache.get('0:1')?.level.traps.includes(trap), true);
});
