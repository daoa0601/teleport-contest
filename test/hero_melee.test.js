import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_DEX, A_STR, P_LONG_SWORD, P_SHORT_SWORD, P_TWO_WEAPON_COMBAT,
    P_UNSKILLED, ROOM,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { inventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addMonster } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

function installMeleeArena(role, species = 'lichen', overrides = {}) {
    const level = freshPlayableRoom({
        left: 10, right: 11, top: 10, bottom: 10, role,
    });
    const monster = addMonster({
        species, m_id: 77,
        x: 11, y: 10,
        hitPoints: 100,
        level: 0,
        mac: 10,
        minvis: 0,
        mundetected: 0,
        ...overrides,
    });
    return { level, monster };
}

function equipWeapon(name, overrides = {}) {
    const weapon = inventoryObject(
        OBJECT_NAMES.indexOf(name), 'a', {
            spe: 0, enchantment: 0, worn: true, owornmask: 1,
            ...overrides,
        },
    );
    game.inventory = [weapon];
    game.uwep = weapon;
    return weapon;
}

async function lichenMeleeOutcome(role) {
    const { level, monster: lichen } = installMeleeArena(role);
    equipWeapon('katana');

    initRng(901n);
    await rhack('l'.charCodeAt(0));
    return {
        retained: level.monsters.includes(lichen),
        hp: lichen.mhp,
        experience: game.u.uexp ?? 0,
        message: game._pending_message,
    };
}

async function twoWeaponLichenOutcome(role) {
    const { level, monster: lichen } = installMeleeArena(role);
    const katana = equipWeapon('katana');
    const wakizashi = inventoryObject(
        OBJECT_NAMES.indexOf('short sword'), 'b', {
            // NetHack represents the Samurai's wakizashi as a short sword
            // with a role-specific display name.
            name: 'wakizashi',
            spe: 0, enchantment: 0, worn: true, owornmask: 2,
        },
    );
    game.u.acurr.a[A_STR] = 18;
    game.u.acurr.a[A_DEX] = 14;
    installHeroWeaponSkills({
        [P_SHORT_SWORD]: P_UNSKILLED,
        [P_LONG_SWORD]: P_UNSKILLED,
        [P_TWO_WEAPON_COMBAT]: P_UNSKILLED,
    });
    game.inventory = [katana, wakizashi];
    game.uswapwep = wakizashi;
    game.u.twoweap = true;

    // This seed makes the primary d20 miss and the off-hand d20 hit.  The
    // assertions below describe the source outcome, not the RNG transcript.
    initRng(2n);
    await rhack('l'.charCodeAt(0));
    return {
        retained: level.monsters.includes(lichen),
        hp: lichen.mhp,
        message: game._pending_message,
    };
}

test('equipped lichen melee is role-independent shared combat', async () => {
    const ordinary = await lichenMeleeOutcome('tourist');
    const samurai = await lichenMeleeOutcome('samurai');

    assert.deepEqual(samurai, ordinary);
    assert.equal(samurai.retained, true);
    assert.equal(samurai.hp, 100);
    assert.equal(samurai.experience, 0);
    assert.equal(samurai.message, 'You miss the lichen.');
});

test('two-weapon combat attempts an off-hand strike for every role',
    async () => {
        const ordinary = await twoWeaponLichenOutcome('tourist');
        const samurai = await twoWeaponLichenOutcome('samurai');

        assert.deepEqual(samurai, ordinary);
        assert.equal(samurai.retained, true);
        assert.ok(samurai.hp < 100);
        assert.match(samurai.message, /You miss the lichen\./);
        assert.match(samurai.message, /You hit the lichen\./);
    });

test('a powerful unarmed strike can shove a small monster', async () => {
    const { monster: lichen } = installMeleeArena('samurai');
    Object.assign(game.level.at(12, 10), {
        typ: ROOM, lit: true, waslit: true, seenv: 255,
    });
    game.u.acurr.a[A_STR] = 18;

    initRng(105n);
    await rhack('l'.charCodeAt(0));

    assert.equal(lichen.mx, 12);
    assert.equal(lichen.my, 10);
    assert.equal(lichen.mstun, 1);
    assert.equal(lichen.movement, 0);
    assert.ok(lichen.mhp < 100);
    assert.match(game._pending_message, /powerful strike/);
});

test('a heavy melee hit can knock a tiny monster backward', async () => {
    const { monster: newt } = installMeleeArena('caveman', 'newt');
    for (const x of [12, 13]) {
        Object.assign(game.level.at(x, 10), {
            typ: ROOM, lit: true, waslit: true, seenv: 255,
        });
    }
    equipWeapon('mace');
    game.u.ulevel = 20;
    game.u.acurr.a[A_STR] = 18;
    game.u.acurr.a[A_DEX] = 18;

    initRng(2n);
    pushKey(' ');
    await rhack('l'.charCodeAt(0));

    assert.ok(newt.mx > 11);
    assert.equal(newt.my, 10);
    assert.ok(newt.mhp < 100);
});

test('striking an acid blob can splash and hurt the hero', async () => {
    installMeleeArena('caveman', 'acid blob');
    game.u.ulevel = 20;
    game.u.uhp = game.u.uhpmax = 40;
    game.u.acurr.a[A_DEX] = 18;

    initRng(1n);
    pushKey(' ');
    await rhack('l'.charCodeAt(0));

    assert.ok(game.u.uhp < 40);
});

test('an ordinary dagger passes through a shade without breaking conduct',
    async () => {
        const { monster: shade } = installMeleeArena(
            'tourist', 'shade', { mac: 100 },
        );
        equipWeapon('dagger');

        initRng(902n);
        await rhack('l'.charCodeAt(0));

        assert.equal(shade.mhp, 100);
        assert.equal(game.u.uconduct.weaphit ?? 0, 0);
        assert.match(
            game._pending_message,
            /Your dagger passes harmlessly through the shade\./,
        );
    });

test('wielded garlic hurts and frightens an undead monster', async () => {
    const { monster: shade } = installMeleeArena(
        'tourist', 'shade', { mac: 100 },
    );
    equipWeapon('clove of garlic');

    initRng(903n);
    await rhack('l'.charCodeAt(0));

    assert.equal(shade.mhp, 99);
    assert.equal(shade.mflee, 1);
    assert.ok(shade.mfleetim >= 2 && shade.mfleetim <= 8);
});

test('a wielded cream pie blinds without damaging and consumes one pie',
    async () => {
        const { monster: jackal } = installMeleeArena('tourist', 'jackal');
        const pies = equipWeapon('cream pie', { quan: 2, quantity: 2 });

        initRng(904n);
        await rhack('l'.charCodeAt(0));

        assert.equal(jackal.mhp, 100);
        assert.equal(jackal.mcansee, 0);
        assert.equal(pies.quan, 1);
        assert.strictEqual(game.uwep, pies);
    });
