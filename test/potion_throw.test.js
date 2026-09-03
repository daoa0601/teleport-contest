import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, A_DEX, STONE, WEB, W_ARM, W_ARMC, W_SADDLE, W_WEP,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { beginObjectBurn } from '../js/light.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    ALCHEMY_SMOCK, CHAIN_MAIL, CORPSE, DAGGER, IRON_CHAIN,
    POT_ACID, POT_CONFUSION, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_GAIN_LEVEL,
    POT_INVISIBILITY, POT_OIL, POT_PARALYSIS, POT_POLYMORPH, POT_SICKNESS,
    POT_SPEED, SADDLE,
    POT_WATER, YELLOW_DRAGON_SCALE_MAIL,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import {
    installHumanWerewolfHero, installPolymorphedHero,
    wearPolymorphControlRing,
} from './support/hero-state.js';
import {
    addTrap, floorObjects,
} from './support/level-state.js';
import { addMonster, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_PURPLE_WORM = 115;

function freshMapPotionState(distance = 2, monsterOptions = {}) {
    const attributes = Array(6).fill(12);
    attributes[A_DEX] = 18;

    freshObjectRoom({
        hero: {
            uz: { dnum: 0, dlevel: 4 },
            ulevel: 4,
            uhp: 30,
            uhpmax: 30,
            acurr: { a: attributes.slice() },
            amax: { a: attributes.slice() },
            ualign: { type: 0, record: 0 },
            uconduct: {},
            uhave: {},
            uswallow: 0,
            ustuck: null,
        },
        context: { move: 0 },
        moves: 60,
        objectInitializationSeed: 1n,
    });
    const monster = addMonster({
        m_id: 2700 + distance,
        mnum: PM_PURPLE_WORM,
        x: 10 + distance,
        y: 10,
        hitPoints: 12,
        ...monsterOptions,
    });
    return monster;
}

function throwEast(potion, answers = []) {
    return throwInventoryObject(potion, 'l', answers);
}

function addSleepingNeighbor(m_id, { strategy = null } = {}) {
    return addMonster({
        m_id,
        mnum: PM_PURPLE_WORM,
        x: 13,
        y: 10,
        hitPoints: 12,
        msleeping: 1,
        ...(strategy === null ? {} : { mstrategy: strategy }),
    });
}

test('live map potion crosses bhit and consumes a successful inert contact',
    async () => {
        const monster = freshMapPotionState(2);
        monster.msleeping = 1;
        const potion = addInventoryObject(POT_FRUIT_JUICE);

        initRng(2702n);
        await throwEast(potion, [' ', ' ', ' ', ' ']);
        assert.equal(game.context.move, 1);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(floorObjects(game.level).includes(potion), false);
    });

test('a wielded potion leaves the hero hand when thrown', async () => {
    freshMapPotionState(2);
    const potion = addInventoryObject(POT_FRUIT_JUICE);
    pushKey(potion.invlet);
    await rhack('w'.charCodeAt(0));

    initRng(2702n);
    await throwEast(potion, Array(10).fill(' '));

    assert.equal(game.uwep, null);
    assert.equal(potion.where, 'gone');
});

test('a blind hero can throw a potion at an unseen monster', async () => {
    const monster = freshMapPotionState(2);
    game.u.blindTurns = 10;
    syncBlindness(game);
    vision_recalc(0);
    const potion = addInventoryObject(POT_INVISIBILITY);

    initRng(3321n);
    await throwEast(potion, Array(10).fill(' '));

    assert.equal(monster.minvis, 1);
    assert.equal(potion.where, 'gone');
});

test('throwing a potion while levitating moves the hero backward', async () => {
    const monster = freshMapPotionState(2);
    game.u.levitating = true;
    const potion = addInventoryObject(POT_INVISIBILITY);

    initRng(3321n);
    await throwEast(potion, Array(10).fill(' '));

    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.equal(monster.minvis, 1);
    assert.equal(potion.where, 'gone');
});

test('a potion can hit an adjacent monster underwater', async () => {
    const monster = freshMapPotionState(1);
    game.u.uinwater = true;
    const potion = addInventoryObject(POT_INVISIBILITY);

    initRng(3321n);
    await throwEast(potion, Array(10).fill(' '));

    assert.equal(monster.minvis, 1);
    assert.equal(potion.where, 'gone');
});

test('a downward potion can hit the hero steed', async () => {
    const steed = freshMapPotionState(2);
    steed.mx = game.u.ux;
    steed.my = game.u.uy;
    game.u.usteed = steed;
    const potion = addInventoryObject(POT_INVISIBILITY);

    initRng(1n);
    await throwInventoryObject(potion, '>', Array(10).fill(' '));

    assert.equal(steed.minvis, 1);
    assert.equal(potion.where, 'gone');
});

test('throwing a potion at a peaceful monster makes it hostile', async () => {
    const monster = freshMapPotionState(2, { mpeaceful: 1 });
    const potion = addInventoryObject(POT_FRUIT_JUICE);

    initRng(2702n);
    await throwEast(potion, Array(10).fill(' '));

    assert.equal(monster.mpeaceful, 0);
    assert.equal(potion.where, 'gone');
});

test('throwing a potion at a pet does not untame it', async () => {
    const monster = freshMapPotionState(2, { mpeaceful: 1, mtame: 10 });
    const potion = addInventoryObject(POT_FRUIT_JUICE);

    initRng(2702n);
    await throwEast(potion, Array(10).fill(' '));

    assert.equal(monster.mtame, 10);
    assert.equal(monster.mpeaceful, 1);
    assert.equal(potion.where, 'gone');
});

test('a thrown polymorph potion changes its live target', async () => {
    const monster = freshMapPotionState(2, { mnum: 12 });
    const originalForm = monster.mnum;
    const potion = addInventoryObject(POT_POLYMORPH);

    initRng(1n);
    await throwEast(potion, Array(12).fill(' '));

    assert.notEqual(monster.mnum, originalForm);
    assert.equal(monster.dead ?? false, false);
    assert.equal(potion.where, 'gone');
});

test('live map potion miss wakes conditionally then shatters at bhitpos',
    async () => {
        const monster = freshMapPotionState(2);
        monster.msleeping = 1;
        const potion = addInventoryObject(POT_GAIN_LEVEL);

        initRng(2701n);
        await throwEast(potion, [' ', ' ', ' ']);
        assert.equal(game.context.move, 1);
        assert.equal(monster.mhp, 12);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(floorObjects(game.level).includes(potion), false);
        assert.match(game._pending_message,
            /potion of gain level shatters!$/);
    });

test('map potion stack allocates and consumes one split identity', async () => {
    const monster = freshMapPotionState(2);
    const potion = addInventoryObject(POT_FRUIT_JUICE);
    potion.quan = potion.quantity = 2;
    potion.owt *= 2;

    initRng(2731n);
    await throwEast(potion, [' ', ' ', ' ', ' ']);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 1);
    assert.equal(potion.quantity, 1);
    assert.equal(potion.where, 'inventory');
    assert.equal(monster.mhp, 11);
    assert.equal(floorObjects(game.level).length, 0);
});

test('one-percent map potion break resistance preserves the thrown identity',
    async () => {
        freshMapPotionState(2);
        game.level.monsters = [];
        const potion = addInventoryObject(POT_GAIN_LEVEL);

        initRng(2795n);
        await throwEast(potion);
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(potion.where, 'floor');
        assert.equal(potion.ox, 16);
        assert.equal(potion.oy, 10);
        assert.ok(floorObjects(game.level).includes(potion));
    });

test('a web can stop and break a thrown potion', async () => {
    freshMapPotionState(2);
    game.level.monsters = [];
    const web = addTrap(game.level, WEB, 12, 10, { tseen: false });
    const potion = addInventoryObject(POT_GAIN_LEVEL);

    initRng(1n);
    await throwEast(potion, Array(10).fill(' '));

    assert.equal(web.tseen, true);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects(game.level).includes(potion), false);
});

test('a thrown potion that survives impact can fall down a ladder',
    async () => {
        freshMapPotionState(2);
        game.level.monsters = [];
        game.dungeons = [{ num_dunlevs: 5, flags: {} }];
        game.stairs = {
            sx: 16,
            sy: 10,
            up: false,
            isladder: true,
            tolev: { dnum: 0, dlevel: 5 },
            next: null,
        };
        const potion = addInventoryObject(POT_GAIN_LEVEL);

        initRng(2795n);
        await throwEast(potion);

        assert.equal(floorObjects(game.level).includes(potion), false);
        assert.equal(potion.where, 'migrating');
        assert.deepEqual(potion.migration.destination, {
            dnum: 0,
            dlevel: 5,
        });
    });

test('map extra healing contact heals monster then hero through nearby vapor',
    async () => {
        const monster = freshMapPotionState(1);
        monster.mhp = 4;
        monster.mcansee = 0;
        monster.mblinded = 12;
        game.u.uhp = 20;
        game.u.uhpmax = 30;
        game.u.blindTurns = 0;
        game.u.deafTurns = 6;
        const potion = addInventoryObject(POT_EXTRA_HEALING);

        initRng(2804n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, monster.mhpmax);
        assert.equal(monster.mcansee, 1);
        assert.equal(monster.mblinded, 0);
        assert.equal(game.u.uhp, 22);
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.u._exercise[A_CON], 1);
    });

test('map sickness contact harms monster before nearby hero vapor', async () => {
    const monster = freshMapPotionState(1);
    monster.msleeping = 1;
    game.u.uhp = 30;
    game.u.uhpmax = 30;
    const potion = addInventoryObject(POT_SICKNESS);

    initRng(2942n);
    await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ']);
    assert.equal(monster.mhp, 5);
    assert.equal(monster.msleeping, 0);
    assert.equal(game.u.uhp, 25);
    assert.equal(game.u._exercise[A_CON], -1);
    assert.equal(potion.where, 'gone');
});

test('map confusion contact affects both monster and nearby hero', async () => {
    const monster = freshMapPotionState(1);
    monster.m_lev = 15;
    monster.mconf = 0;
    monster.msleeping = 1;
    game.u.confusionTurns = 0;
    const potion = addInventoryObject(POT_CONFUSION);

    initRng(2998n);
    await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);
    assert.equal(monster.mhp, 11);
    assert.equal(monster.mconf, 1);
    assert.equal(monster.msleeping, 0);
    assert.equal(game.u.confusionTurns, 1);
    assert.equal(potion.where, 'gone');
    assert.match(game._pending_message, /You feel somewhat dizzy\.$/);
});

test('adjacent hard-floor break applies healing vapor without monster contact',
    async () => {
        freshMapPotionState(2);
        game.level.monsters = [];
        game.level.at(11, 10).typ = STONE;
        game.u.uhp = 20;
        game.u.uhpmax = 30;
        const potion = addInventoryObject(POT_EXTRA_HEALING);
        potion.cursed = false;
        potion.blessed = false;

        initRng(2850n);
        await throwEast(potion, [' ', ' ']);
        assert.equal(game.u.uhp, 22);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects(game.level).length, 0);
        assert.match(game._pending_message, /You smell a peculiar odor\.\.\.$/);
    });

test('adjacent paralysis contact freezes monster and installs hero helplessness',
    async () => {
        const monster = freshMapPotionState(1);
        monster.meating = 3;
        monster.mstrategy = 0x20000000;
        const potion = addInventoryObject(POT_PARALYSIS);

        initRng(3011n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 2);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0);
        assert.equal(game._helplessTurns, 3);
        assert.equal(game._helplessReason, 'frozen by a potion');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(potion.where, 'gone');
    });

test('map speed contact accelerates monster before nearby hero movement timeout',
    async () => {
        const monster = freshMapPotionState(1);
        monster.permspeed = 0;
        monster.mspeed = 0;
        monster.msleeping = 1;
        game.u.fast = false;
        game.u.veryFast = false;
        game.u.veryFastTurns = 0;
        const potion = addInventoryObject(POT_SPEED);

        initRng(3321n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.permspeed, 2);
        assert.equal(monster.mspeed, 2);
        assert.equal(monster.msleeping, 0);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 5);
        assert.equal(game.u._exercise[A_DEX], 0);
        assert.equal(potion.where, 'gone');
    });

test('map invisibility contact hides the target and records its remembered square',
    async () => {
        const monster = freshMapPotionState(2);
        monster.minvis = 0;
        monster.perminvis = 0;
        monster.invis_blkd = 0;
        game.level.flags.hero_memory = true;
        const potion = addInventoryObject(POT_INVISIBILITY);

        initRng(3321n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.perminvis, 1);
        assert.equal(monster.minvis, 1);
        assert.equal(
            game.level.at(monster.mx, monster.my).remembered_glyph?.kind,
            'invisible',
        );
        assert.equal(potion.where, 'gone');
    });

test('cursed map potion reaches its target and reveals it',
    async () => {
        const monster = freshMapPotionState(2);
        monster.minvis = 1;
        monster.perminvis = 1;
        monster.invis_blkd = 0;
        monster.msleeping = 1;
        game.level.flags.hero_memory = true;
        game.level.at(monster.mx, monster.my).remembered_glyph = {
            ch: 'I', color: 0, decgfx: false, kind: 'invisible',
        };
        const potion = addInventoryObject(POT_INVISIBILITY);
        potion.cursed = true;
        potion.blessed = false;

        initRng(7n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, 12);
        assert.equal(monster.perminvis, 0);
        assert.equal(monster.minvis, 0);
        assert.equal(monster.msleeping, 0);
        assert.notEqual(
            game.level.at(monster.mx, monster.my).remembered_glyph?.kind,
            'invisible',
        );
        assert.equal(potion.where, 'gone');
    });

test('live acid-resistant target takes only impact chip and leaves radius asleep',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 6,
            hitPoints: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2712);
        const potion = addInventoryObject(POT_ACID);

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp >= 19 && monster.mhp <= 20);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 1);
        assert.equal(potion.where, 'gone');
    });

test('live worn acid-protection armor limits damage to the impact chip',
    async () => {
        for (const equipment of [
            { otyp: ALCHEMY_SMOCK, mask: W_ARMC },
            { otyp: YELLOW_DRAGON_SCALE_MAIL, mask: W_ARM },
        ]) {
            const monster = freshMapPotionState(2, {
                mnum: 289,
                hitPoints: 20,
                msleeping: 1,
            });
            const armor = equipMonsterObject(
                monster, knownObject(equipment.otyp), equipment.mask,
            );
            const potion = addInventoryObject(POT_ACID);

            initRng(2702n);
            await throwEast(potion, Array(20).fill(' '));

            assert.ok(monster.mhp >= 19 && monster.mhp <= 20);
            assert.equal(monster.msleeping, 0);
            assert.strictEqual(monster.minvent[0], armor);
            assert.equal(potion.where, 'gone');
        }
    });

test('live magic-resistant acid target avoids acid and radius damage',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 48,
            hitPoints: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2713);
        const potion = addInventoryObject(POT_ACID);

        initRng(2700n);
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp >= 19 && monster.mhp <= 20);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 0);
        assert.equal(potion.where, 'gone');
    });

test('live acid damage wakes the audible source radius before survival',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 289,
            hitPoints: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2714, {
            strategy: 0x60000000,
        });
        const potion = addInventoryObject(POT_ACID);

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp >= 11 && monster.mhp <= 19);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 0);
        assert.equal(neighbor.mstrategy, 0x40000000);
        assert.match(game._pending_message, /shrieks in pain!/);
        assert.equal(potion.where, 'gone');
    });

test('live acid damages a silent target without radius wake', async () => {
    const monster = freshMapPotionState(2, {
        mnum: 99,
        hitPoints: 20,
        msleeping: 1,
    });
    const neighbor = addSleepingNeighbor(2715);
    const potion = addInventoryObject(POT_ACID);

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));
    assert.ok(monster.mhp < 19);
    assert.equal(monster.msleeping, 0);
    assert.equal(neighbor.msleeping, 1);
    assert.equal(potion.where, 'gone');
});

test('live cursed acid hurts more than blessed acid under the same seed',
    async () => {
        const losses = [];
        for (const specimen of [
            { blessed: true, cursed: false, maxLoss: 5 },
            { blessed: false, cursed: true, maxLoss: 17 },
        ]) {
            const monster = freshMapPotionState(2, {
                mnum: 289,
                hitPoints: 40,
            });
            const potion = addInventoryObject(POT_ACID);
            potion.blessed = specimen.blessed;
            potion.cursed = specimen.cursed;

            initRng(2702n);
            await throwEast(potion, Array(20).fill(' '));

            const loss = 40 - monster.mhp;
            assert.ok(loss >= 1 && loss <= specimen.maxLoss);
            losses.push(loss);
            assert.equal(potion.where, 'gone');
        }
        assert.ok(losses[1] > losses[0]);
    });

test('live fatal acid crosses the ordinary map death continuation', async () => {
    const monster = freshMapPotionState(2, {
        mnum: 289,
        hitPoints: 2,
        maxHitPoints: 20,
    });
    const potion = addInventoryObject(POT_ACID);

    initRng(2702n);
    await throwEast(potion, Array(40).fill(' '));

    assert.equal(monster.dead, true);
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(potion.where, 'gone');
});

test('live blessed water damages a demon and wakes its source-radius neighbors',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 289,
            hitPoints: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2710, {
            strategy: 0x60000000,
        });
        const potion = addInventoryObject(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));
        assert.equal(monster.mhp, 12);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 0);
        assert.equal(neighbor.mstrategy, 0x40000000);
        assert.equal(potion.where, 'gone');
    });

test('live cursed water heals a demon without taking the hostile wake branch',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 289,
            hitPoints: 8,
            maxHitPoints: 20,
            msleeping: 1,
        });
        const potion = addInventoryObject(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));
        assert.equal(monster.mhp, 14);
        assert.equal(monster.msleeping, 0);
        assert.equal(monster.mpeaceful, 0);
        assert.equal(potion.where, 'gone');
    });

test('live blessed water damages silent undead without waking its neighbors',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 187,
            hitPoints: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2711);
        const potion = addInventoryObject(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp < 19);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 1);
        assert.equal(potion.where, 'gone');
    });

test('live cursed water changes a human were only without shape protection',
    async () => {
        for (const protectedHero of [false, true]) {
            const monster = freshMapPotionState(2, {
                mnum: 263,
                hitPoints: 10,
                maxHitPoints: 20,
                msleeping: 1,
            });
            game.u.protectionFromShapeChangers = protectedHero;
            const potion = addInventoryObject(POT_WATER);
            potion.cursed = true;

            initRng(2702n);
            await throwEast(potion, Array(20).fill(' '));

            assert.equal(monster.mnum, protectedHero ? 263 : 21);
            assert.ok(monster.mhp > 9);
            assert.equal(monster.msleeping, 0);
            assert.equal(potion.where, 'gone');
        }
    });

test('cursed water makes a human werewolf shed incompatible equipment',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 263,
            hitPoints: 10,
            maxHitPoints: 20,
        });
        const armor = equipMonsterObject(
            monster, knownObject(CHAIN_MAIL), W_ARM,
        );
        const dagger = equipMonsterObject(
            monster, knownObject(DAGGER), W_WEP,
        );
        const potion = addInventoryObject(POT_WATER, { cursed: true });

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));

        assert.equal(monster.mnum, 21);
        assert.equal(armor.where, 'gone');
        assert.equal(dagger.where, 'floor');
        assert.equal(potion.where, 'gone');
    });

test('live ordinary water rusts a surviving iron golem', async () => {
    const monster = freshMapPotionState(2, {
        mnum: 259,
        hitPoints: 20,
        msleeping: 1,
    });
    const potion = addInventoryObject(POT_WATER);

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(monster.mhp < 19);
    assert.equal(monster.dead, undefined);
    assert.equal(game.level.monsters.includes(monster), true);
    assert.equal(monster.msleeping, 0);
    assert.equal(potion.where, 'gone');
});

test('live water contact clones a hostile gremlin with split hit points',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 40,
            hitPoints: 12,
            msleeping: 1,
        });
        const potion = addInventoryObject(POT_WATER);

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));

        const clones = game.level.monsters.filter(candidate =>
            candidate !== monster && candidate.mnum === 40);
        assert.equal(clones.length, 1);
        const [clone] = clones;
        assert.equal(monster.mhp + clone.mhp, 11);
        assert.equal(monster.mhpmax + clone.mhpmax, 12);
        assert.equal(clone.mcloned, 1);
        assert.deepEqual(clone.minvent, []);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
    });

test('two-square potion impact cannot reach the hero with vapor', async () => {
    freshMapPotionState(2);
    game.plname = 'Splitter';
    installPolymorphedHero('gremlin', {
        turns: 300,
        hitPoints: 17,
    });
    const potion = addInventoryObject(POT_WATER);

    initRng(2746n);
    await throwEast(potion, Array(30).fill(' '));

    const clones = game.level.monsters.filter(monster => monster.mcloned);
    assert.equal(clones.length, 0);
    assert.equal(game.u.mh, 17);
    assert.equal(game.u.mhmax, 17);
    assert.equal(game.u.uconduct.pets ?? 0, 0);
    assert.equal(potion.where, 'gone');
});

test('live blessed water rehumanizes an unequipped beast were', async () => {
    const monster = freshMapPotionState(2, {
        mnum: 21,
        hitPoints: 20,
        movement: 18,
        mmove: 18,
    });
    const potion = addInventoryObject(POT_WATER);
    potion.blessed = true;

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));
    assert.equal(monster.mnum, 263);
    assert.equal(monster.movement, 18);
    assert.equal(monster.mhp, 14);
    assert.equal(potion.where, 'gone');
});

test('controlled lycanthrope decline completes an adjacent map throw',
    async () => {
        freshMapPotionState(1);
        installHumanWerewolfHero();
        const ring = wearPolymorphControlRing();
        const potion = addInventoryObject(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        await throwEast(potion, [' ', 'n']);
        assert.deepEqual(game.inventory, [ring]);
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.were_changes ?? 0, 0);
        assert.equal(potion.where, 'gone');
    });

test('three-square water contact bypasses unreachable hero-vapor prompts',
    async () => {
        const monster = freshMapPotionState(3);
        installHumanWerewolfHero();
        wearPolymorphControlRing();
        const potion = addInventoryObject(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp >= 11 && monster.mhp <= 12);
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.u.mtimedone ?? 0, 0);
        assert.equal(potion.where, 'gone');
    });

test('live fatal iron-golem water creates source special chain drops',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 259,
            hitPoints: 2,
            maxHitPoints: 20,
            name: 'Ferrum',
        });
        game.u.ulevel = 30;
        const potion = addInventoryObject(POT_WATER);

        initRng(2702n);
        await throwEast(potion, Array(40).fill(' '));

        const drops = floorObjects(game.level);
        const chains = drops.filter(object => object.otyp === IRON_CHAIN);
        assert.equal(monster.dead, true);
        assert.equal(game.level.monsters.includes(monster), false);
        assert.equal(drops.some(object => object.otyp === CORPSE), false);
        assert.ok(chains.length >= 2 && chains.length <= 12);
        assert.equal(new Set(chains.map(object => object.o_id)).size,
            chains.length);
        for (const chain of chains) {
            assert.equal(chain.where, 'floor');
            assert.deepEqual([chain.ox, chain.oy], [monster.mx, monster.my]);
            assert.notEqual(chain.name, 'Ferrum');
        }
        assert.equal(game.u.uconduct.killer, 1);
        assert.equal(potion.where, 'gone');
    });

test('live fatal blessed water uses the ordinary map death continuation',
    async () => {
        const monster = freshMapPotionState(2, {
            mnum: 289,
            hitPoints: 2,
            maxHitPoints: 20,
        });
        const potion = addInventoryObject(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        await throwEast(potion, Array(40).fill(' '));
        assert.equal(monster.dead, true);
        assert.equal(game.level.monsters.includes(monster), false);
        assert.equal(game.u.uconduct.killer, 1);
        assert.equal(potion.where, 'gone');
    });

test('greased map potion reroutes live flight after stack detachment',
    async () => {
        const monster = freshMapPotionState(2);
        const potion = addInventoryObject(POT_INVISIBILITY);
        potion.greased = true;
        potion.quan = potion.quantity = 2;
        potion.owt *= 2;

        initRng(1n);
        await throwEast(potion, Array(20).fill(' '));
        assert.deepEqual(game.inventory, [potion]);
        assert.equal(potion.quan, 1);
        assert.equal(potion.quantity, 1);
        assert.equal(potion.where, 'inventory');
        assert.equal(floorObjects(game.level).length, 0);
        assert.equal(monster.mhp, 12);
        assert.deepEqual(
            [game.u.dx, game.u.dy, game.u.dz], [-1, 0, 0],
        );
        assert.match(
            game._pending_message || '', /potion of invisibility shatters!$/,
        );
    });

test('greased map potion can reroute vertically through live hitfloor',
    async () => {
        const monster = freshMapPotionState(2);
        const potion = addInventoryObject(POT_INVISIBILITY);
        potion.greased = true;

        initRng(124n);
        await throwEast(potion, Array(20).fill(' '));
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects(game.level).length, 0);
        assert.equal(monster.mhp, 12);
        assert.deepEqual(
            [game.u.dx, game.u.dy, game.u.dz], [0, 0, 1],
        );
        assert.equal(
            game._pending_message,
            "For an instant you couldn't see yourself!",
        );
    });

test('live unlit oil breaks without evaporation and wakes its target', async () => {
    const monster = freshMapPotionState(2);
    monster.msleeping = 1;
    const potion = addInventoryObject(POT_OIL);

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(monster.mhp <= 12 && monster.mhp >= 11);
    assert.equal(monster.msleeping, 0);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects(game.level).includes(potion), false);
});

test('burning oil explodes when it hits a monster', async () => {
    const monster = freshMapPotionState(2, {
        hitPoints: 1,
        maxHitPoints: 1,
    });
    const potion = addInventoryObject(POT_OIL, { age: 200 });
    beginObjectBurn(potion);

    initRng(2702n);
    await throwEast(potion, Array(30).fill(' '));

    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(potion.where, 'gone');
    assert.equal(potion.lamplit, false);
});

test('blessed water can cleanse a saddle instead of hurting its wearer',
    async () => {
        const pony = freshMapPotionState(2, {
            mnum: MONSTER_NAME.indexOf('pony'),
            hitPoints: 100,
            maxHitPoints: 100,
        });
        const saddle = equipMonsterObject(
            pony,
            knownObject(SADDLE, { cursed: true, bknown: true }),
            W_SADDLE,
        );
        const potion = addInventoryObject(POT_WATER, { blessed: true });

        initRng(2n);
        await throwEast(potion, Array(30).fill(' '));

        assert.equal(saddle.cursed, false);
        assert.equal(saddle.bknown, true);
        assert.equal(pony.mhp, 100);
        assert.equal(
            game._pending_message,
            "The pony's saddle glows amber.",
        );
    });

test('unknown inert map potion records a live type call after visible impact',
    async () => {
        const monster = freshMapPotionState(2);
        const potion = addInventoryObject(POT_GAIN_LEVEL);
        potion.typeKnown = potion.known = false;
        game._knownObjectTypes?.delete(potion.otyp);
        const sibling = addInventoryObject(POT_GAIN_LEVEL, {
            blessed: true,
            known: false,
            typeKnown: false,
        });
        const appearance = game.objectDescriptions[potion.otyp];

        initRng(2797n);
        await throwEast(potion, [
            ...Array(20).fill(' '), ...'mystery', '\n',
        ]);
        assert.equal(monster.mhp, 11);
        assert.deepEqual(game.inventory, [sibling]);
        assert.equal(potion.where, 'gone');
        assert.equal(game._objectCallNames[POT_GAIN_LEVEL], 'mystery');
        assert.ok(
            inventoryItemDescription(sibling).includes(
                `${appearance} potion called mystery`,
            ),
        );
        assert.equal(floorObjects(game.level).length, 0);
    });
