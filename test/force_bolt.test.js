import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DUST, D_BROKEN, D_LOCKED,
    HOLE, MOAT, STATUE_TRAP, TRAPDOOR,
} from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { forceBoltInDirection } from '../js/force_bolt.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mkcorpstat } from '../js/mklev.js';
import {
    BOULDER, CLUB, EGG, MIRROR, POT_WATER, ROCK, SPE_FORCE_BOLT, STATUE,
    WAN_STRIKING,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import {
    chargedWand, floorObject, knownObject,
} from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom } from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

const PM_JACKAL = 12;

async function createJackal(x = 12) {
    const jackal = await createMonsterAt('jackal', x, 10);
    jackal.mhp = jackal.mhpmax = 100;
    jackal.mac = 100;
    return jackal;
}

function forceBoltSpell() {
    return {
        name: 'force bolt',
        otyp: SPE_FORCE_BOLT,
        level: 1,
        category: 'attack',
    };
}

test('force bolt damages a monster in its path', async () => {
    freshCasterRoom();
    const monster = await createJackal();
    pushKeys('l');

    await castKnownSpell(forceBoltSpell());

    assert.ok(monster.mhp < 100);
    assert.equal(game.u.uen, 35);
    assert.equal(game.context.move, 1);
});

test('magic resistance bounces a self-zapped wand of striking', async () => {
    freshGameplayRoom();
    game.u.antimagic = true;
    const startingHitPoints = game.u.uhp;
    const wand = chargedWand(WAN_STRIKING, { charges: 2 });
    game.inventory = [wand];
    pushKeys('a.');

    await dozap();

    assert.equal(game.u.uhp, startingHitPoints);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.spe, 1);
});

test('force bolt breaks a locked door and continues through its square',
    async () => {
        freshCasterRoom();
        const door = game.level.at(12, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        pushKeys('l');

        await castKnownSpell(forceBoltSpell());

        assert.equal(door.doormask, D_BROKEN);
        assert.equal(game.context.move, 1);
    });

test('force bolt collapses a lowered drawbridge', async () => {
    const level = freshCasterRoom();
    const bridge = level.at(12, 10);
    bridge.typ = DRAWBRIDGE_DOWN;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    const wall = level.at(12, 9);
    wall.typ = DOOR;
    wall.doormask = 0;
    pushKeys(`l${' '.repeat(20)}`);

    await castKnownSpell(forceBoltSpell());

    assert.equal(bridge.typ, MOAT);
    assert.equal(wall.typ, DOOR);
    assert.equal(game.context.move, 1);
});

test('force bolt fractures a boulder into rocks', async () => {
    freshCasterRoom();
    const boulder = floorObject(BOULDER, 12, 10, {
        dknown: true,
    });
    pushKeys('l');

    await castKnownSpell(forceBoltSpell());

    assert.equal(boulder.otyp, ROCK);
    assert.ok(boulder.quan >= 7 && boulder.quan <= 66);
    assert.equal(game.level.objects[12][10].includes(boulder), true);
});

test('force bolt breaks fragile floor objects and continues past them',
    async () => {
        freshCasterRoom();
        const potion = floorObject(POT_WATER, 12, 10);
        const club = floorObject(CLUB, 12, 10);
        const monster = await createJackal(13);
        pushKeys(`l${' '.repeat(20)}`);

        await castKnownSpell(forceBoltSpell());

        assert.equal(potion.where, 'gone');
        assert.equal(club.where, 'floor');
        assert.ok(monster.mhp < 100);
    });

test('force bolt detonates a pyrolisk egg through the fire explosion rules',
    async () => {
        freshCasterRoom();
        game.u.uhp = game.u.uhpmax = 100;
        const egg = floorObject(EGG, 11, 10, { corpsenm: 11 });
        pushKeys(`l${' '.repeat(60)}`);

        await castKnownSpell(forceBoltSpell());

        assert.equal(egg.where, 'gone');
        assert.ok(game.u.uhp < 100);
    });

test('force bolt releases the monster from a statue trap', async () => {
    freshCasterRoom();
    initRng(9401n);
    const statue = mkcorpstat(STATUE, null, PM_JACKAL, 12, 10, 0);
    const club = knownObject(CLUB, { where: 'contained', spe: 0 });
    club.container = statue;
    statue.contents = [club];
    addTrap(game.level, STATUE_TRAP, 12, 10, { tseen: false });
    pushKeys('l');

    await castKnownSpell(forceBoltSpell());

    const released = game.level.monsters.find(monster =>
        monster.mnum === PM_JACKAL && monster.mx === 12 && monster.my === 10,
    );
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(released.mtame, 0);
    assert.ok(released.minvent.includes(club));
    assert.equal(statue.where, 'gone');
    assert.equal(game.level.traps.some(trap =>
        trap.tx === 12 && trap.ty === 10), false);
});

test('force bolt aimed down strikes the floor pile and engraving', async () => {
    freshCasterRoom();
    const boulder = floorObject(BOULDER, game.u.ux, game.u.uy, {
        dknown: true,
    });
    makeEngravingAt(game.u.ux, game.u.uy, 'Elbereth', null, 0, DUST);
    pushKeys('>');

    await castKnownSpell(forceBoltSpell());

    assert.equal(boulder.otyp, ROCK);
    assert.notEqual(
        engravingAt(game.u.ux, game.u.uy)?.text,
        'Elbereth',
    );
});

test('a downward force bolt skips the object concealing the hero', async () => {
    freshCasterRoom();
    game.u.umonnum = 94;
    game.u.mtimedone = 20;
    game.u.uundetected = 1;
    const mirror = floorObject(MIRROR, game.u.ux, game.u.uy);
    const cover = floorObject(CLUB, game.u.ux, game.u.uy);

    await forceBoltInDirection('>', { random: () => 1 });

    assert.equal(cover.where, 'floor');
    assert.equal(mirror.where, 'gone');
});

test('an upward force bolt hits only the object concealing the hero',
    async () => {
        freshCasterRoom();
        game.u.umonnum = 94;
        game.u.mtimedone = 20;
        game.u.uundetected = 1;
        const lowerObject = floorObject(CLUB, game.u.ux, game.u.uy);
        const cover = floorObject(MIRROR, game.u.ux, game.u.uy);

        await forceBoltInDirection('<', {
            random: range => range === 3 ? 0 : 1,
        });

        assert.equal(cover.where, 'gone');
        assert.equal(lowerObject.where, 'floor');
    });

test('force bolt aimed up can dislodge a rock from the ceiling', async () => {
    freshCasterRoom();
    game.u.uhp = game.u.uhpmax = 100;
    initRng(1n);
    pushKeys('<');

    await castKnownSpell(forceBoltSpell());

    assert.ok(game.u.uhp < 100);
    assert.ok(game.level.objects[game.u.ux][game.u.uy]
        .some(object => object.otyp === ROCK));
});

test('force bolt shatters a trapdoor and schedules the fall', async () => {
    freshCasterRoom();
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{ num_dunlevs: 3 }];
    const trap = addTrap(
        game.level, TRAPDOOR, game.u.ux, game.u.uy, {
            tseen: true,
            dst: { dnum: 0, dlevel: 2 },
        },
    );
    let levelChange = null;
    pushKeys('>');

    await castKnownSpell(forceBoltSpell(), {
        gotoLevel: async (destination, options) => {
            levelChange = { destination, options };
        },
    });

    assert.equal(trap.ttyp, HOLE);
    assert.deepEqual(levelChange, {
        destination: { dnum: 0, dlevel: 2 },
        options: { arrival: 'falling' },
    });
});
