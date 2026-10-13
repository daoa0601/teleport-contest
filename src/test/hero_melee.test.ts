import { requireFixtureGame } from './support/game-state.js';
import type { RoleKey } from '../js/roles.js';
import type { Monster } from '../js/monster_types.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_DEX, A_STR, P_LONG_SWORD, P_SHORT_SWORD, P_TWO_WEAPON_COMBAT,
    P_UNSKILLED, ROOM,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_NAMES, ROCK, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

async function installMeleeArena(
    role: RoleKey, species = 'lichen',
    { heroHitBonus = 0, mhp = 100, mhpmax = 100, msleeping }:
        Partial<Pick<Monster, 'mhp' | 'mhpmax' | 'msleeping'>> & { heroHitBonus?: number } = {},
) {
    const level = freshPlayableRoom({
        left: 10, right: 11, top: 10, bottom: 10, role,
    });
    game.u.uhitinc = heroHitBonus;
    const monster = await createMonsterAt(species, 11, 10);
    monster.mhp = mhp;
    monster.mhpmax = mhpmax;
    monster.m_lev = 0;
    monster.minvis = 0;
    monster.mundetected = 0;
    if (msleeping !== undefined) monster.msleeping = msleeping;
    return { level, monster };
}

async function equipWeapon(name: string, overrides: Partial<GameObject> = {}) {
    const weapon = await addInventoryObject(
        OBJECT_NAMES.indexOf(name), {
            invlet: 'a',
            spe: 0, enchantment: 0, worn: true, owornmask: 1,
            ...overrides,
        },
    );
    game.uwep = weapon;
    return weapon;
}

async function lichenMeleeOutcome(role: RoleKey) {
    const { level, monster: lichen } = await installMeleeArena(role);
    requireFixtureGame(game);
    await equipWeapon('katana');

    initRng(901n);
    await rhack('l'.charCodeAt(0));
    return {
        retained: level.monsters.includes(lichen),
        hp: lichen.mhp,
        experience: game.u.uexp ?? 0,
        message: game._pending_message,
    };
}

async function twoWeaponLichenOutcome(role: RoleKey) {
    const { level, monster: lichen } = await installMeleeArena(role, 'lichen', { heroHitBonus: 1 });
    requireFixtureGame(game);
    await equipWeapon('katana');
    const wakizashi = await addInventoryObject(
        OBJECT_NAMES.indexOf('short sword'), {
            invlet: 'b',
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

void test('equipped lichen melee is role-independent shared combat', async () => {
    const ordinary = await lichenMeleeOutcome('tourist');
    const samurai = await lichenMeleeOutcome('samurai');

    assert.deepEqual(samurai, ordinary);
    assert.equal(samurai.retained, true);
    assert.equal(samurai.hp, 100);
    assert.equal(samurai.experience, 0);
    assert.equal(samurai.message, 'You miss the lichen.');
});

void test('two-weapon combat attempts an off-hand strike for every role',
    async () => {
        const ordinary = await twoWeaponLichenOutcome('tourist');
        const samurai = await twoWeaponLichenOutcome('samurai');

        assert.deepEqual(samurai, ordinary);
        assert.equal(samurai.retained, true);
        assert.ok(samurai.hp < 100);
        assert.match(samurai.message, /You miss the lichen\./);
        assert.match(samurai.message, /You hit the lichen\./);
    });

void test('a powerful unarmed strike can shove a small monster', async () => {
    const { monster: lichen } = await installMeleeArena('samurai');
    requireFixtureGame(game);
    const destination = game.level.requireAt(12, 10);
    destination.typ = ROOM;
    destination.lit = true;
    destination.waslit = true;
    destination.seenv = 255;
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

void test('a heavy melee hit can knock a tiny monster backward', async () => {
    const { monster: newt } = await installMeleeArena('caveman', 'newt');
    requireFixtureGame(game);
    for (const x of [12, 13] as const) {
        const destination = game.level.requireAt(x, 10);
        destination.typ = ROOM;
        destination.lit = true;
        destination.waslit = true;
        destination.seenv = 255;
    }
    await equipWeapon('mace');
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

void test('striking an acid blob can splash and hurt the hero', async () => {
    await installMeleeArena('caveman', 'acid blob');
    requireFixtureGame(game);
    game.u.ulevel = 20;
    game.u.uhp = game.u.uhpmax = 40;
    game.u.acurr.a[A_DEX] = 18;

    initRng(1n);
    pushKey(' ');
    await rhack('l'.charCodeAt(0));

    assert.ok(game.u.uhp < 40);
});

void test('an ordinary dagger passes through a shade without breaking conduct',
    async () => {
        const { monster: shade } = await installMeleeArena(
            'tourist', 'shade', { heroHitBonus: 100 },
        );
        requireFixtureGame(game);
        await equipWeapon('dagger');

        initRng(902n);
        await rhack('l'.charCodeAt(0));

        assert.equal(shade.mhp, 100);
        assert.equal(game.u.uconduct.weaphit ?? 0, 0);
        assert.match(
            game._pending_message,
            /Your dagger passes harmlessly through the shade\./,
        );
    });

void test('wielded garlic hurts and frightens an undead monster', async () => {
    const { monster: shade } = await installMeleeArena(
        'tourist', 'shade', { heroHitBonus: 100 },
    );
    await equipWeapon('clove of garlic');

    initRng(903n);
    await rhack('l'.charCodeAt(0));

    assert.equal(shade.mhp, 99);
    assert.equal(shade.mflee, 1);
    assert.ok((shade.mfleetim ?? 0) >= 2 && (shade.mfleetim ?? 0) <= 8);
});

void test('a wielded cream pie blinds without damaging and consumes one pie',
    async () => {
        const { monster: jackal } = await installMeleeArena('tourist', 'jackal', { heroHitBonus: 100 });
        requireFixtureGame(game);
        const pies = await equipWeapon('cream pie', { quan: 2, quantity: 2 });

        initRng(904n);
        await rhack('l'.charCodeAt(0));

        assert.equal(jackal.mhp, 100);
        assert.equal(jackal.mcansee, 0);
        assert.equal(pies.quan, 1);
        assert.strictEqual(game.uwep, pies);
    });

void test('wielded acid venom burns a monster and consumes one splash', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    const venom = await equipWeapon(
        'splash of acid venom', { quan: 2, quantity: 2 },
    );

    initRng(905n);
    await rhack('l'.charCodeAt(0));

    assert.ok(jackal.mhp < 100);
    assert.equal(venom.quan, 1);
});

void test('bashing with a mirror can break it and reduce luck', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const mirror = await equipWeapon('mirror');
    game.u.acurr.a[A_STR] = 18;
    game.u.udaminc = 5;

    initRng(906n);
    await rhack('l'.charCodeAt(0));

    assert.equal(jackal.mhp, 99);
    assert.equal(game.u.uluck, -2);
    assert.equal(mirror.where, 'gone');
    assert.equal(game.uwep, null);
});

void test('bashing with a camera can release a demon without hurting the monster',
    async () => {
        const { level, monster: jackal } = await installMeleeArena(
            'tourist', 'jackal', { heroHitBonus: 100, msleeping: 1 },
        );
        requireFixtureGame(game);
        level.requireAt(9, 10).typ = ROOM;
        const camera = await equipWeapon('expensive camera');
        game.u.acurr.a[A_STR] = 18;
        game.u.udaminc = 5;

        initRng(2n);
        pushKeys(' '.repeat(4));
        await rhack('l'.charCodeAt(0));

        assert.equal(camera.where, 'gone');
        assert.equal(jackal.mhp, 100);
        assert.equal(jackal.msleeping, 1);
        assert.ok(level.monsters.some(monster =>
            monster !== jackal && monster.mpeaceful === 1));
    });

void test('a camera passes through a shade without being destroyed', async () => {
    const { monster: shade } = await installMeleeArena(
        'tourist', 'shade', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const camera = await equipWeapon('expensive camera');

    initRng(915n);
    await rhack('l'.charCodeAt(0));

    assert.equal(shade.mhp, 100);
    assert.equal(camera.where, 'inventory');
    assert.strictEqual(game.uwep, camera);
});

void test('bashing with one healing potion leaves the rest wielded', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', {
            heroHitBonus: 100,
            mhp: 10,
            mhpmax: 100,
        },
    );
    requireFixtureGame(game);
    const potions = await equipWeapon('healing', { quan: 2, quantity: 2 });
    game.u.acurr.a[A_STR] = 10;

    initRng(920n);
    pushKeys(' '.repeat(8));
    await rhack('l'.charCodeAt(0));

    assert.equal(jackal.mhp, 99);
    assert.equal(potions.quan, 1);
    assert.equal(potions.where, 'inventory');
    assert.deepEqual(game.inventory, [potions]);
    assert.strictEqual(game.uwep, potions);
});

void test('soft food and paper do not hurt a monster', async () => {
    for (const objectName of ['carrot', 'blank paper'] as const) {
        const { monster: jackal } = await installMeleeArena(
            'tourist', 'jackal', { heroHitBonus: 100 },
        );
        requireFixtureGame(game);
        await equipWeapon(objectName);
        game.u.acurr.a[A_STR] = 18;
        game.u.udaminc = 5;

        initRng(907n);
        await rhack('l'.charCodeAt(0));

        assert.equal(jackal.mhp, 100, objectName);
    }
});

void test('a heavy non-weapon uses its weight for melee damage', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    await equipWeapon('chest');
    game.u.acurr.a[A_STR] = 18;
    game.u.udaminc = -2;

    initRng(3n);
    await rhack('l'.charCodeAt(0));

    assert.equal(jackal.mhp, 94);
});

void test('a wet towel can dry after lashing a monster', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const towel = await equipWeapon('towel', { spe: 3 });
    game.u.acurr.a[A_STR] = 10;

    initRng(1n);
    pushKeys(' '.repeat(4));
    await rhack('l'.charCodeAt(0));

    assert.ok(jackal.mhp < 100);
    assert.equal(towel.spe, 2);
});

void test('a silver shield sears a shade', async () => {
    const { monster: shade } = await installMeleeArena(
        'tourist', 'shade', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    await equipWeapon('shield of reflection');
    game.u.acurr.a[A_STR] = 10;

    initRng(918n);
    pushKeys(' '.repeat(4));
    await rhack('l'.charCodeAt(0));

    assert.ok(shade.mhp < 99);
    assert.match(game._pending_message, /silver shield.*sears the shade/i);
});

void test('a blessed object hurts an undead monster more than its weight alone',
    async () => {
        const { monster: zombie } = await installMeleeArena(
            'tourist', 'human zombie', { heroHitBonus: 100 },
        );
        requireFixtureGame(game);
        await equipWeapon('meat stick', { blessed: true });
        game.u.acurr.a[A_STR] = 10;

        initRng(919n);
        await rhack('l'.charCodeAt(0));

        assert.ok(zombie.mhp <= 98);
    });

void test('corpse melee damage comes from the corpse species size', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    await equipWeapon('corpse', {
        corpsenm: MONSTER_NAME.indexOf('dog'),
    });
    game.u.acurr.a[A_STR] = 10;

    initRng(908n);
    await rhack('l'.charCodeAt(0));

    assert.equal(jackal.mhp, 97);
});

void test('hitting with a cockatrice corpse turns a monster to stone', async () => {
    const { level, monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const corpse = await equipWeapon('corpse', {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    });

    initRng(909n);
    pushKeys(' '.repeat(8));
    await rhack('l'.charCodeAt(0));

    assert.equal(level.monsters.includes(jackal), false);
    assert.ok(floorObjectsAt(level, 11, 10).some(object =>
        object.otyp === STATUE && object.corpsenm === jackal.mnum));
    assert.strictEqual(game.uwep, corpse);
});

void test('a petrifying corpse still hurts a stone-resistant monster', async () => {
    const { monster: stoneGolem } = await installMeleeArena(
        'tourist', 'stone golem', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    await equipWeapon('corpse', {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    });
    game.u.acurr.a[A_STR] = 10;

    initRng(910n);
    await rhack('l'.charCodeAt(0));

    assert.equal(stoneGolem.mhp, 99);
});

void test('bashing with eggs splats the whole wielded stack', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const eggs = await equipWeapon('egg', {
        corpsenm: -1,
        age: game.moves,
        quan: 3,
        quantity: 3,
    });
    game.u.acurr.a[A_STR] = 18;
    game.u.udaminc = 5;

    initRng(911n);
    pushKeys(' '.repeat(4));
    await rhack('l'.charCodeAt(0));

    assert.equal(jackal.mhp, 99);
    assert.equal(eggs.where, 'gone');
    assert.equal(game.uwep, null);
});

void test('a fresh wielded egg becomes a rock against a cockatrice', async () => {
    const { monster: cockatrice } = await installMeleeArena(
        'tourist', 'cockatrice', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const egg = await equipWeapon('egg', {
        corpsenm: -1,
        age: game.moves,
    });
    game.u.acurr.a[A_STR] = 10;

    initRng(912n);
    pushKeys(' '.repeat(4));
    await rhack('l'.charCodeAt(0));

    assert.equal(cockatrice.mhp, 99);
    assert.equal(egg.otyp, ROCK);
    assert.strictEqual(game.uwep, egg);
});

void test('bashing with a pyrolisk egg explodes beside the hero', async () => {
    const { monster: jackal } = await installMeleeArena(
        'tourist', 'jackal', { heroHitBonus: 100 },
    );
    requireFixtureGame(game);
    const egg = await equipWeapon('egg', {
        corpsenm: MONSTER_NAME.indexOf('pyrolisk'),
        age: game.moves,
    });
    game.u.uhp = game.u.uhpmax = 100;

    initRng(913n);
    pushKeys(' '.repeat(20));
    await rhack('l'.charCodeAt(0));

    assert.ok(jackal.mhp < 100);
    assert.ok(game.u.uhp < 100);
    assert.equal(egg.where, 'gone');
});
