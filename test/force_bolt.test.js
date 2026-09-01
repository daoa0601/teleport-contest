import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DUST, D_BROKEN, D_LOCKED,
    HOLE, MOAT, TRAPDOOR,
} from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    BOULDER, ROCK, SPE_FORCE_BOLT, WAN_STRIKING,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import { chargedWand, floorObject } from './support/game-objects.js';
import { addMonster } from './support/monsters.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const PM_JACKAL = 12;

function addJackal() {
    return addMonster({
        m_id: 921,
        mnum: PM_JACKAL,
        x: 12,
        y: 10,
        hitPoints: 100,
        mac: 100,
    });
}

function freshWizard() {
    return freshWeaponArena({
        role: 'wizard', heroLevel: 8, energy: 40,
    });
}

function forceBoltSpell() {
    return {
        name: 'force bolt',
        otyp: SPE_FORCE_BOLT,
        level: 1,
        category: 'attack',
        fail: 0,
    };
}

test('force bolt damages a monster in its path', async () => {
    freshWizard();
    const monster = addJackal();
    pushKeys('l');

    await castKnownSpell(forceBoltSpell());

    assert.ok(monster.mhp < 100);
    assert.equal(game.u.uen, 35);
    assert.equal(game.context.move, 1);
});

test('magic resistance bounces a self-zapped wand of striking', async () => {
    freshWeaponArena();
    game.u.antimagic = true;
    const startingHitPoints = game.u.uhp;
    const wand = chargedWand(WAN_STRIKING, { charges: 2 });
    game.inventory = [wand];
    pushKeys('a.');

    await dozap();

    assert.equal(game.u.uhp, startingHitPoints);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.charges.current, 1);
});

test('force bolt breaks a locked door and continues through its square',
    async () => {
        freshWizard();
        const door = game.level.at(12, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        pushKeys('l');

        await castKnownSpell(forceBoltSpell());

        assert.equal(door.doormask, D_BROKEN);
        assert.equal(game.context.move, 1);
    });

test('force bolt collapses a lowered drawbridge', async () => {
    const level = freshWizard();
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
    freshWizard();
    const boulder = floorObject(BOULDER, 12, 10, {
        dknown: true,
    });
    pushKeys('l');

    await castKnownSpell(forceBoltSpell());

    assert.equal(boulder.otyp, ROCK);
    assert.ok(boulder.quan >= 7 && boulder.quan <= 66);
    assert.equal(game.level.objects[12][10].includes(boulder), true);
});

test('force bolt aimed down strikes the floor pile and engraving', async () => {
    freshWizard();
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

test('force bolt aimed up can dislodge a rock from the ceiling', async () => {
    freshWizard();
    game.u.uhp = game.u.uhpmax = 100;
    initRng(1n);
    pushKeys('<');

    await castKnownSpell(forceBoltSpell());

    assert.ok(game.u.uhp < 100);
    assert.ok(game.level.objects[game.u.ux][game.u.uy]
        .some(object => object.otyp === ROCK));
});

test('force bolt shatters a trapdoor and schedules the fall', async () => {
    freshWizard();
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{ num_dunlevs: 3 }];
    const trap = {
        ttyp: TRAPDOOR,
        tx: game.u.ux,
        ty: game.u.uy,
        tseen: true,
        dst: { dnum: 0, dlevel: 2 },
    };
    game.level.traps.push(trap);
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
