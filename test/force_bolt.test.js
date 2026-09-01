import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DOOR, DUST, D_BROKEN, D_LOCKED, HOLE, TRAPDOOR,
} from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    BOULDER, ROCK, SPE_FORCE_BOLT, WAN_STRIKING,
} from '../js/object_data.js';
import { place_object } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import { chargedWand } from './support/game-objects.js';
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

test('force bolt fractures a boulder into rocks', async () => {
    freshWizard();
    const boulder = place_object({
        otyp: BOULDER,
        oclass: 14,
        quan: 1,
        quantity: 1,
        dknown: true,
    }, 12, 10);
    pushKeys('l');

    await castKnownSpell(forceBoltSpell());

    assert.equal(boulder.otyp, ROCK);
    assert.ok(boulder.quan >= 7 && boulder.quan <= 66);
    assert.equal(game.level.objects[12][10].includes(boulder), true);
});

test('force bolt aimed down strikes the floor pile and engraving', async () => {
    freshWizard();
    const boulder = place_object({
        otyp: BOULDER,
        oclass: 14,
        quan: 1,
        quantity: 1,
        dknown: true,
    }, game.u.ux, game.u.uy);
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
