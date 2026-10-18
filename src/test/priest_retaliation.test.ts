import { monsterAtPosition } from '../js/monster_location.js';
import type { Monster } from '../js/monster_types.js';
import { armorBaseBonus } from '../js/armor.js';
import { findMonsterArmorClass } from '../js/monworn.js';
import type { Room } from '../js/map_types.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { installPolymorphedHero } from './support/hero-state.js';

import {
    A_DEX, ALTAR, AM_SHRINE, Align2amask, M_SEEN_ELEC, M_SEEN_REFL, NO_MINVENT,
    ROOMOFFSET, STRAT_WAITFORU, TEMPLE, W_ARM,
} from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { floorObjectsAt } from './support/level-state.js';
import { throwInventoryObject, kickDirection } from './support/commands.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { wakeMonster } from '../js/monster_anger.js';
import {
    ACID_VENOM, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, BLINDING_VENOM,
    CLUB, CREAM_PIE, EGG, FLINT, LEATHER_ARMOR, POT_CONFUSION, RIN_PROTECTION,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function equipForArmorClass(monster: Monster, targetArmorClass: number) {
    const enchantment = findMonsterArmorClass(monster) - targetArmorClass
        - armorBaseBonus(LEATHER_ARMOR);
    const armor = await knownObject(LEATHER_ARMOR, { initialize: false, spe: enchantment });
    await equipMonsterObject(monster, armor, W_ARM);
    assert.equal(findMonsterArmorClass(monster), targetArmorClass);
}

function templeRoom(lx: number, hx: number, ly: number, hy: number, roomnoidx = 0): Room {
    return { lx, hx, ly, hy, rtype: TEMPLE, rlit: 1, doorct: 0, fdoor: 0,
        irregular: false, needjoining: false, nsubrooms: 0, sbrooms: [],
        roomnoidx, needfill: 0 };
}

async function temple({ hero = {} }: Pick<ObjectRoomOptions, 'hero'> = {}) {
    const level = freshObjectRoom({
        left: 7, right: 30, top: 6, bottom: 14,
        hero: { uhp: 100, uhpmax: 100, uac: 30, ...hero },
    });
    requirePlayingGame(game);
    const room = templeRoom(7, 30, 6, 14);
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    }
    const altar = level.requireAt(8, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 11, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.msleeping = 0;
    priest.mhp = priest.mhpmax = 100;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 8, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    updateHeroRoomMembership(game);
    vision_recalc(0);
    pushKeys(' '.repeat(100));
    return { priest, altar, level };
}

void test('attacking a peaceful priest in an intact temple calls down blinding lightning', async () => {
    const { priest } = await temple();
    requirePlayingGame(game);
    initRng(1n);

    const result = await wakeMonster(priest, { attacked: true });

    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp < 100);
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(priest.mpeaceful, 0);
});

for (const excluded of ['non-attack wake', 'hostile priest', 'no shrine', 'converted shrine', 'hero outside', 'priest outside']) {
    void test(`priest retaliation does not occur for ${excluded}`, async () => {
        const { priest, altar, level } = await temple();
        requirePlayingGame(game);
        if (excluded === 'hostile priest') priest.mpeaceful = 0;
        if (excluded === 'no shrine') altar.flags &= ~AM_SHRINE;
        if (excluded === 'converted shrine') altar.flags = AM_SHRINE | Align2amask(1);
        if (excluded === 'hero outside') level.requireAt(game.u.ux, game.u.uy).roomno = 0;
        if (excluded === 'priest outside') level.requireAt(priest.mx, priest.my).roomno = 0;
        updateHeroRoomMembership(game);
        initRng(1n);

        const result = await wakeMonster(priest, { attacked: excluded !== 'non-attack wake' });

        assert.equal(result.heroDied, false);
        assert.equal(game.u.uhp, 100);
        assert.equal(game.u.blindTurns, 0);
    });
}

void test('Half_spell_damage protects against shrine lightning', async () => {
    const losses = [];
    for (const protectedHero of [false, true]) {
        const { priest } = await temple({ hero: { halfSpellDamage: protectedHero } });
        requirePlayingGame(game);
        initRng(1n);
        await wakeMonster(priest, { attacked: true });
        losses.push(100 - game.u.uhp);
    }
    const [unprotectedLoss, protectedLoss] = losses;
    assert.ok(unprotectedLoss !== undefined && protectedLoss !== undefined);
    assert.ok(unprotectedLoss > 0);
    assert.equal(protectedLoss, Math.ceil(unprotectedLoss / 2));
});

void test('shock resistance prevents damage but not shrine-lightning blindness', async () => {
    const { priest } = await temple({ hero: { shockResistance: true } });
    requirePlayingGame(game);
    initRng(1n);

    await wakeMonster(priest, { attacked: true });

    assert.equal(game.u.uhp, 100);
    assert.ok((game.u.blindTurns ?? 0) > 0);
});

for (const lifesaving of [false, true]) {
    void test(`fatal shrine lightning ${lifesaving ? 'continues beyond the hero after life saving' : 'stops before the next creature and flash blindness'}`, async () => {
        const { priest } = await temple({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        // Keep the priest out of the outgoing ray to expose its next contact.
        priest.my = 11;
        const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        target.mhp = 1;
        await equipForArmorClass(target, 30);
        target.mpeaceful = 1;
        let amulet;
        if (lifesaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const kills = game.u.uconduct.killer || 0;
        const experience = game.u.uexp || 0;
        initRng(1n);

        const result = await wakeMonster(priest, { attacked: true });

        assert.equal(result.heroDied, !lifesaving);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
            assert.notEqual(monsterAtPosition(requireGameLevel(), target.mx, target.my), target);
            assert.equal(game.u.uconduct.killer || 0, kills);
            assert.equal(game.u.uexp || 0, experience);
        } else {
            assert.equal(target.mhp, 1);
            assert.equal(game.u.blindTurns, 0);
        }
    });
}

void test('shrine lightning wakes a bystander without anger or wait-strategy clearing', async () => {
    const { priest } = await temple();
    requirePlayingGame(game);
    priest.my = 11;
    const target = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    target.mhp = target.mhpmax = 100;
    await equipForArmorClass(target, 30);
    target.mpeaceful = 1;
    target.msleeping = 1;
    target.mstrategy = STRAT_WAITFORU;
    initRng(1n);

    await wakeMonster(priest, { attacked: true });

    assert.ok(target.mhp < 100);
    assert.equal(target.msleeping, 0);
    assert.equal(target.mpeaceful, 1);
    assert.equal(target.mstrategy & STRAT_WAITFORU, STRAT_WAITFORU);
});

void test('monsters remember shrine-lightning resistance and forget a resistance that fails', async () => {
    for (const resistant of [false, true]) {
        const { priest } = await temple({ hero: { shockResistance: resistant } });
        requirePlayingGame(game);
        priest.my = 11;
        priest.seen_resistance = M_SEEN_ELEC | M_SEEN_REFL;
        initRng(1n);

        await wakeMonster(priest, { attacked: true });

        assert.equal(priest.seen_resistance & M_SEEN_ELEC, resistant ? M_SEEN_ELEC : 0);
        assert.equal(priest.seen_resistance & M_SEEN_REFL, 0);
    }
});

void test('a reflection amulet turns back shrine lightning but does not prevent its flash', async () => {
    const { priest } = await temple();
    requirePlayingGame(game);
    priest.my = 11;
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_REFLECTION), 'uamul');
    initRng(1n);

    await wakeMonster(priest, { attacked: true });

    assert.equal(game.u.uhp, 100);
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.ok(priest.seen_resistance != null);
    assert.ok(priest.seen_resistance & M_SEEN_REFL);
});

void test('shrine lightning heals a wounded flesh-golem form', async () => {
    const { priest } = await temple();
    requirePlayingGame(game);
    installPolymorphedHero('flesh golem', { hitPoints: 10, maxHitPoints: 40 });
    game.u.uac = 30;
    initRng(1n);

    await wakeMonster(priest, { attacked: true });

    assert.ok(game.u.shockResistance, 'the actual form producer grants resistance');
    assert.ok(game.u.mh > 10);
    assert.equal(game.u.uhp, 100);
});

for (const lifesaving of [false, true]) {
    void test(`hurling a peaceful priest ${lifesaving ? 'resumes displacement after life saving' : 'stops before movement and stun on fatal retaliation'}`, async () => {
        const { priest } = await temple({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        const movement = priest.movement;
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        initRng(1n);

        const result = await hurtleMonster(priest, 1, 0, 1);

        assert.equal(!!result.heroDied, !lifesaving);
        assert.equal(priest.mx, lifesaving ? 12 : 11);
        assert.equal(priest.movement, lifesaving ? 0 : movement);
        assert.equal(!!priest.mstun, lifesaving);
    });
}

void test('a missed public melee attack can provoke fatal priest retaliation', async () => {
    const { priest } = await temple({ hero: { uhp: 1, uhitinc: -100 } });
    requirePlayingGame(game);
    resetInputState();
    pushKeys(`l${' '.repeat(100)}`);
    initRng(1n);

    await rhack('F'.charCodeAt(0));

    assert.equal(game.program_state.gameover, true);
    assert.equal(priest.mpeaceful, 0);
    assert.equal(priest.mhp, 100, 'neither the missed attack nor the stopped ray hit the priest');
    assert.equal(game.u.blindTurns, 0);
});

void test('a priest visiting another temple still invokes the original shrine', async () => {
    const { priest, level } = await temple();
    requirePlayingGame(game);
    level.rooms.push(templeRoom(11, 12, 10, 11, 1));
    level.nroom = 2;
    level.requireAt(priest.mx, priest.my).roomno = ROOMOFFSET + 1;
    initRng(1n);

    await wakeMonster(priest, { attacked: true });

    assert.ok(game.u.uhp < 100);
});

void test('retaliation uses the hero temple edges when the original altar is too far away', async () => {
    const { priest, level } = await temple();
    requirePlayingGame(game);
    const other = templeRoom(17, 23, 6, 14, 1);
    level.rooms.push(other);
    level.nroom = 2;
    for (let x = other.lx; x <= other.hx; x++) {
        for (let y = other.ly; y <= other.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET + 1;
    }
    game.u.ux = 20;
    updateHeroRoomMembership(game);
    vision_recalc(0);
    initRng(1n);

    await wakeMonster(priest, { attacked: true });

    assert.ok(game.u.uhp < 100);
});

for (const lifesaving of [false, true]) {
    void test(`a wielded potion ${lifesaving ? 'finishes its impact after life saving from priest retaliation' : 'stops before vapor exposure after fatal priest retaliation'}`, async () => {
        await temple({ hero: { uhp: 1, uhitinc: 100 } });
        requirePlayingGame(game);
        const potion = await addInventoryObject(POT_CONFUSION);
        await setPrimaryWeapon(potion);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING, {
                typeKnown: false,
            }), 'uamul');
        resetInputState();
        pushKeys(`l${' '.repeat(100)}`);
        initRng(7n);

        await rhack('F'.charCodeAt(0));

        assert.equal(!!game.program_state.gameover, !lifesaving);
        if (lifesaving) {
            assert.equal(potion.where, 'gone');
            assert.ok((game.u.confusionTurns ?? 0) > 0, 'the surviving contact really exposes the hero to potion vapor');
        } else {
            assert.equal(game.u.confusionTurns || 0, 0);
        }
    });
}

for (const lifesaving of [false, true]) {
    void test(`ordinary movement ${lifesaving ? 'spends the turn after life saving' : 'preserves final death turn state'} when a hallucinating hero attacks a priest`, async () => {
        await temple({ hero: { uhp: 1, uhitinc: -100, hallucinationTurns: 50 } });
        requirePlayingGame(game);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        resetInputState();
        pushKeys(' '.repeat(100));
        initRng(1n);

        await rhack('l'.charCodeAt(0));

        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(game.context.move, lifesaving ? 1 : 0);
    });
}

void test('m movement bumps into a visible priest during hallucination without provoking shrine lightning', async () => {
    const { priest } = await temple({ hero: { uhp: 1, hallucinationTurns: 50 } });
    requirePlayingGame(game);
    resetInputState();
    pushKeys(`l${' '.repeat(100)}`);
    initRng(1n);

    await rhack('m'.charCodeAt(0));

    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.uhp, 1);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(priest.mpeaceful, 1);
    assert.equal(game.u.ux, 10);
    assert.equal(priest.mx, 11);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /You move right into /);
});

for (const lifesaving of [false, true]) {
    void test(`a public priest attack ${lifesaving ? 'resumes the lightning flash after ring-explosion life saving' : 'stops at a fatal ring explosion despite shock resistance'}`, async () => {
        const { priest } = await temple({ hero: { uhp: 1, shockResistance: true, uhitinc: -100 } });
        requirePlayingGame(game);
        const ring = await addInventoryObject(RIN_PROTECTION, { spe: 8 });
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        resetInputState();
        pushKeys(`l${' '.repeat(100)}`);
        initRng(11n);

        await rhack('F'.charCodeAt(0));

        assert.equal(ring.where, 'gone');
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(game.context.move, lifesaving ? 1 : 0);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok((game.u.blindTurns ?? 0) > 0, 'life saving resumes the actual flash effect');
        } else {
            assert.equal(game._deathKiller, 'exploding ring');
            assert.equal(game.u.blindTurns, 0);
            assert.equal(priest.mhp, 100, 'the stopped ray has not reached the priest');
        }
    });
}

for (const kicked of [false, true]) {
    for (const lifesaving of [false, true]) {
        void test(`${kicked ? 'kicked' : 'thrown'} projectile ${lifesaving ? 'finishes its flight after life saving' : 'is recovered before fatal shrine retaliation ends the flight'}`, async () => {
            const { priest, level } = await temple({ hero: { uhp: 1 } });
            requirePlayingGame(game);
            priest.mx = 13;
            await equipForArmorClass(priest, 30);
            const club = kicked
                ? placeCreatedObject(await knownObject(CLUB), 11, 10)
                : await addInventoryObject(CLUB, { invlet: 'z' });
            if (lifesaving) {
                const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
                await wearHeroAccessory(amulet, 'uamul');
            }
            resetInputState();
            initRng(1n);

            if (kicked) await kickDirection('l', [...' '.repeat(80)]);
            else await throwInventoryObject(club, 'l', [...' '.repeat(80)]);

            assert.equal(!!game.program_state.gameover, !lifesaving);
            assert.equal(club.where, 'floor');
            assert.ok(floorObjectsAt(level, lifesaving ? 13 : 11, 10).includes(club));
            assert.equal(game.inventory.includes(club), false);
            if (lifesaving) assert.ok(game.u.uhp > 0);
        });
    }
}

for (const [name, type] of [
    ['egg', EGG], ['cream pie', CREAM_PIE], ['acid venom', ACID_VENOM],
    ['blinding venom', BLINDING_VENOM], ['potion', POT_CONFUSION], ['flint', FLINT],
] as const) {
    void test(`fatal shrine retaliation preserves the recovered ${name}`, async () => {
        const { priest, level } = await temple({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        priest.mx = 13;
        await equipForArmorClass(priest, type === FLINT ? 30 : -30);
        game.u.acurr.a[A_DEX] = 3;
        const projectile = await addInventoryObject(type, { invlet: 'z' });
        resetInputState();
        initRng(1n);

        await throwInventoryObject(projectile, 'l', [...' '.repeat(80)]);

        assert.equal(!!game.program_state.gameover, true);
        assert.equal(projectile.where, 'floor');
        assert.ok(floorObjectsAt(level, 11, 10).includes(projectile));
        assert.equal(game.inventory.includes(projectile), false);
    });
}
