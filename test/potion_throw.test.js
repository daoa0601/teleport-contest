import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { ROOM, STONE, W_ARM, W_ARMC } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { mksobj } from '../js/mklev.js';
import {
    CORPSE, IRON_CHAIN,
    POT_ACID, POT_CONFUSION, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_GAIN_LEVEL,
    POT_INVISIBILITY, POT_OIL, POT_PARALYSIS, POT_SICKNESS, POT_SPEED,
    POT_WATER, RIN_POLYMORPH_CONTROL,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';


const PM_PURPLE_WORM = 115;

function freshMapPotionState(distance = 2) {
    resetGame();
    const monster = {
        m_id: 2700 + distance,
        mnum: PM_PURPLE_WORM,
        mx: 10 + distance,
        my: 10,
        mhp: 12,
        mhpmax: 12,
        mcanmove: 1,
        msleeping: 0,
        mpeaceful: 0,
        mtame: 0,
        minvent: [],
        inventory: [],
    };
    game.u = {
        ux: 10,
        uy: 10,
        uz: { dnum: 0, dlevel: 4 },
        ulevel: 4,
        uhp: 30,
        uhpmax: 30,
        acurr: { a: [12, 18, 12, 12, 12, 12] },
        amax: { a: [12, 18, 12, 12, 12, 12] },
        ualign: { type: 0, record: 0 },
        uconduct: {},
        uhave: {},
        uswallow: 0,
        ustuck: null,
    };
    game.flags = {};
    game.context = { move: 0 };
    game.moves = 60;
    game.inventory = [];
    game.level = new GameMap();
    game.level.monsters = [monster];
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            game.level.at(x, y).typ = ROOM;
            game.level.at(x, y).lit = true;
        }
    }
    game.in_mklev = false;
    game.animationFrame = async () => {};
    vision_reset_new_level();
    vision_recalc(0);
    initRng(1n);
    init_objects();
    resetInputState();
    return monster;
}

function addKnownPotion(otyp) {
    const potion = mksobj(otyp, true, false);
    potion.cursed = potion.blessed = false;
    potion.bknown = potion.dknown = potion.known = true;
    potion.typeKnown = true;
    potion.objectTimers = [];
    potion.timed = 0;
    return addInventoryItem(potion);
}

async function throwEast(potion, continuationKeys = []) {
    pushKey(potion.invlet);
    pushKey('l');
    for (const key of continuationKeys) pushKey(key);
    await rhack('t'.charCodeAt(0));
}


function floorObjects() {
    const objects = [];
    for (const column of game.level.objects || []) {
        for (const pile of column || []) objects.push(...(pile || []));
    }
    return objects;
}

function addSleepingNeighbor(m_id, { strategy = null } = {}) {
    const neighbor = {
        m_id,
        mnum: PM_PURPLE_WORM,
        mx: 13,
        my: 10,
        mhp: 12,
        mhpmax: 12,
        msleeping: 1,
        mpeaceful: 0,
        mtame: 0,
        minvent: [],
        inventory: [],
    };
    if (strategy !== null) neighbor.mstrategy = strategy;
    game.level.monsters.push(neighbor);
    return neighbor;
}

test('live map potion crosses bhit and consumes a successful inert contact',
    async () => {
        const monster = freshMapPotionState(2);
        monster.msleeping = 1;
        const potion = addKnownPotion(POT_FRUIT_JUICE);

        initRng(2702n);
        await throwEast(potion, [' ', ' ', ' ', ' ']);
        assert.equal(game.context.move, 1);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(floorObjects().includes(potion), false);
        assert.match(game._pending_message,
            /potion of fruit juice evaporates\.$/);
    });

test('live map potion miss wakes conditionally then shatters at bhitpos',
    async () => {
        const monster = freshMapPotionState(2);
        monster.msleeping = 1;
        const potion = addKnownPotion(POT_GAIN_LEVEL);

        initRng(2701n);
        await throwEast(potion, [' ', ' ', ' ']);
        assert.equal(game.context.move, 1);
        assert.equal(monster.mhp, 12);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(floorObjects().includes(potion), false);
        assert.match(game._pending_message,
            /potion of gain level shatters!$/);
    });

test('map potion stack allocates and consumes one split identity', async () => {
    const monster = freshMapPotionState(2);
    const potion = addKnownPotion(POT_FRUIT_JUICE);
    potion.quan = potion.quantity = 2;
    potion.owt *= 2;

    initRng(2731n);
    await throwEast(potion, [' ', ' ', ' ', ' ']);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 1);
    assert.equal(potion.quantity, 1);
    assert.equal(potion.where, 'inventory');
    assert.equal(monster.mhp, 11);
    assert.equal(floorObjects().length, 0);
});

test('one-percent map potion break resistance preserves the thrown identity',
    async () => {
        freshMapPotionState(2);
        game.level.monsters = [];
        const potion = addKnownPotion(POT_GAIN_LEVEL);

        initRng(2795n);
        await throwEast(potion);
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(potion.where, 'floor');
        assert.equal(potion.ox, 16);
        assert.equal(potion.oy, 10);
        assert.ok(floorObjects().includes(potion));
    });

test('map extra healing contact heals monster then hero through nearby vapor',
    async () => {
        const monster = freshMapPotionState(2);
        monster.mhp = 4;
        monster.mcansee = 0;
        monster.mblinded = 12;
        game.u.uhp = 20;
        game.u.uhpmax = 30;
        game.u.blindTurns = 0;
        game.u.deafTurns = 6;
        const potion = addKnownPotion(POT_EXTRA_HEALING);

        initRng(2804n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, monster.mhpmax);
        assert.equal(monster.mcansee, 1);
        assert.equal(monster.mblinded, 0);
        assert.equal(game.u.uhp, 22);
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.u._exercise[2], 1);
    });

test('map sickness contact harms monster before nearby hero vapor', async () => {
    const monster = freshMapPotionState(2);
    monster.msleeping = 1;
    game.u.uhp = 30;
    game.u.uhpmax = 30;
    const potion = addKnownPotion(POT_SICKNESS);

    initRng(2942n);
    await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ']);
    assert.equal(monster.mhp, 5);
    assert.equal(monster.msleeping, 0);
    assert.equal(game.u.uhp, 25);
    assert.equal(game.u._exercise[2], -1);
    assert.equal(potion.where, 'gone');
});

test('map confusion contact affects both monster and nearby hero', async () => {
    const monster = freshMapPotionState(2);
    monster.m_lev = 15;
    monster.mconf = 0;
    monster.msleeping = 1;
    game.u.confusionTurns = 0;
    const potion = addKnownPotion(POT_CONFUSION);

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
        const potion = addKnownPotion(POT_EXTRA_HEALING);
        potion.cursed = false;
        potion.blessed = false;

        initRng(2850n);
        await throwEast(potion, [' ', ' ']);
        assert.equal(game.u.uhp, 22);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects().length, 0);
        assert.match(game._pending_message, /You smell a peculiar odor\.\.\.$/);
    });

test('adjacent paralysis contact freezes monster and installs hero helplessness',
    async () => {
        const monster = freshMapPotionState(1);
        monster.meating = 3;
        monster.mstrategy = 0x20000000;
        const potion = addKnownPotion(POT_PARALYSIS);

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
        const monster = freshMapPotionState(2);
        monster.permspeed = 0;
        monster.mspeed = 0;
        monster.msleeping = 1;
        game.u.fast = false;
        game.u.veryFast = false;
        game.u.veryFastTurns = 0;
        const potion = addKnownPotion(POT_SPEED);

        initRng(3321n);
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ']);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.permspeed, 2);
        assert.equal(monster.mspeed, 2);
        assert.equal(monster.msleeping, 0);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 5);
        assert.equal(game.u._exercise[1], 0);
        assert.equal(potion.where, 'gone');
    });

test('map invisibility contact hides the target and records its remembered square',
    async () => {
        const monster = freshMapPotionState(2);
        monster.minvis = 0;
        monster.perminvis = 0;
        monster.invis_blkd = 0;
        game.level.flags.hero_memory = true;
        const potion = addKnownPotion(POT_INVISIBILITY);

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
        const potion = addKnownPotion(POT_INVISIBILITY);
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
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 6,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2712);
        const potion = addKnownPotion(POT_ACID);

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
            { otyp: 144, mask: W_ARMC },
            { otyp: 110, mask: W_ARM },
        ]) {
            const monster = freshMapPotionState(2);
            Object.assign(monster, {
                mnum: 289,
                mhp: 20,
                mhpmax: 20,
                msleeping: 1,
                misc_worn_check: equipment.mask,
            });
            const armor = {
                otyp: equipment.otyp,
                owornmask: equipment.mask,
                worn: true,
            };
            monster.minvent = [armor];
            monster.inventory = monster.minvent;
            const potion = addKnownPotion(POT_ACID);

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
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 48,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2713);
        const potion = addKnownPotion(POT_ACID);

        initRng(2700n);
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp >= 19 && monster.mhp <= 20);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 1);
        assert.equal(potion.where, 'gone');
    });

test('live acid damage wakes the audible source radius before survival',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2714, {
            strategy: 0x60000000,
        });
        const potion = addKnownPotion(POT_ACID);

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
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 99,
        mhp: 20,
        mhpmax: 20,
        msleeping: 1,
    });
    const neighbor = addSleepingNeighbor(2715);
    const potion = addKnownPotion(POT_ACID);

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));
    assert.ok(monster.mhp < 19);
    assert.equal(monster.msleeping, 0);
    assert.equal(neighbor.msleeping, 1);
    assert.match(game._pending_message, /writhes in pain!/);
    assert.equal(potion.where, 'gone');
});

test('live cursed acid hurts more than blessed acid under the same seed',
    async () => {
        const losses = [];
        for (const specimen of [
            { blessed: true, cursed: false, maxLoss: 5 },
            { blessed: false, cursed: true, maxLoss: 17 },
        ]) {
            const monster = freshMapPotionState(2);
            Object.assign(monster, {
                mnum: 289,
                mhp: 40,
                mhpmax: 40,
            });
            const potion = addKnownPotion(POT_ACID);
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
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 289,
        mhp: 2,
        mhpmax: 20,
    });
    const potion = addKnownPotion(POT_ACID);

    initRng(2702n);
    await throwEast(potion, Array(40).fill(' '));

    assert.equal(monster.dead, true);
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(potion.where, 'gone');
});

test('live blessed water damages a demon and wakes its source-radius neighbors',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2710, {
            strategy: 0x60000000,
        });
        const potion = addKnownPotion(POT_WATER);
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
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 8,
            mhpmax: 20,
            msleeping: 1,
        });
        const potion = addKnownPotion(POT_WATER);
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
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 187,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2711);
        const potion = addKnownPotion(POT_WATER);
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
            const monster = freshMapPotionState(2);
            Object.assign(monster, {
                mnum: 263,
                mhp: 10,
                mhpmax: 20,
                msleeping: 1,
            });
            game.u.protectionFromShapeChangers = protectedHero;
            const potion = addKnownPotion(POT_WATER);
            potion.cursed = true;

            initRng(2702n);
            await throwEast(potion, Array(20).fill(' '));

            assert.equal(monster.mnum, protectedHero ? 263 : 21);
            assert.ok(monster.mhp > 9);
            assert.equal(monster.msleeping, 0);
            assert.equal(potion.where, 'gone');
        }
    });

test('live ordinary water rusts a surviving iron golem', async () => {
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 259,
        mhp: 20,
        mhpmax: 20,
        msleeping: 1,
    });
    const potion = addKnownPotion(POT_WATER);

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(monster.mhp < 19);
    assert.equal(monster.dead, undefined);
    assert.equal(game.level.monsters.includes(monster), true);
    assert.equal(monster.msleeping, 0);
    assert.match(game._pending_message, /iron golem rusts\./);
    assert.equal(potion.where, 'gone');
});

test('live water contact clones a hostile gremlin with split hit points',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 40,
            mhp: 12,
            mhpmax: 12,
            msleeping: 1,
        });
        const potion = addKnownPotion(POT_WATER);

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

test('two-square water vapor can multiply a live gremlin hero', async () => {
    freshMapPotionState(2);
    game.plname = 'Splitter';
    Object.assign(game.u, {
        umonster: 331,
        umonnum: 40,
        mtimedone: 300,
        mh: 17,
        mhmax: 17,
    });
    const potion = addKnownPotion(POT_WATER);

    initRng(2746n);
    await throwEast(potion, Array(30).fill(' '));

    const clones = game.level.monsters.filter(monster => monster.mcloned);
    assert.equal(clones.length, 1);
    assert.equal(clones[0].name, 'Splitter');
    assert.equal(clones[0].pet, true);
    assert.equal(clones[0].mhp, 8);
    assert.equal(clones[0].mhpmax, 8);
    assert.equal(game.u.mh, 9);
    assert.equal(game.u.mhmax, 9);
    assert.equal(game.u.uconduct.pets, 1);
    assert.equal(potion.where, 'gone');
    assert.match(game._pending_message, /You multiply!$/);
});

test('live blessed water rehumanizes an unequipped beast were', async () => {
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 21,
        mhp: 20,
        mhpmax: 20,
        movement: 18,
        mmove: 18,
    });
    const potion = addKnownPotion(POT_WATER);
    potion.blessed = true;

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));
    assert.equal(monster.mnum, 263);
    assert.equal(monster.movement, 18);
    assert.equal(monster.mhp, 14);
    assert.equal(potion.where, 'gone');
});

test('controlled lycanthrope decline completes a two-square map throw',
    async () => {
        freshMapPotionState(2);
        Object.assign(game.u, {
            umonster: 331, umonnum: 331, ulycn: 21,
        });
        const ring = {
            otyp: RIN_POLYMORPH_CONTROL, worn: true, owornmask: 1,
        };
        game.u.uright = game.uright = ring;
        const potion = addKnownPotion(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        await throwEast(potion, [' ', 'n']);
        assert.deepEqual(game.inventory, []);
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.were_changes ?? 0, 0);
        assert.equal(potion.where, 'gone');
    });

test('three-square water contact bypasses unreachable hero-vapor prompts',
    async () => {
        const monster = freshMapPotionState(3);
        Object.assign(game.u, {
            umonster: 331, umonnum: 331, ulycn: 21,
        });
        const ring = {
            otyp: RIN_POLYMORPH_CONTROL, worn: true, owornmask: 1,
        };
        game.u.uright = game.uright = ring;
        const potion = addKnownPotion(POT_WATER);
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
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 259,
            mhp: 2,
            mhpmax: 20,
            name: 'Ferrum',
        });
        game.u.ulevel = 30;
        const potion = addKnownPotion(POT_WATER);

        initRng(2702n);
        await throwEast(potion, Array(40).fill(' '));

        const drops = floorObjects();
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
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 2,
            mhpmax: 20,
        });
        const potion = addKnownPotion(POT_WATER);
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
        const potion = addKnownPotion(POT_INVISIBILITY);
        potion.greased = true;
        potion.quan = potion.quantity = 2;
        potion.owt *= 2;
        const inputBoundaries = [];
        game._preNhgetchHook = () => {
            inputBoundaries.push(game._pending_message || '');
        };

        initRng(1n);
        try {
            await throwEast(potion, Array(20).fill(' '));
        } finally {
            delete game._preNhgetchHook;
        }
        assert.deepEqual(game.inventory, [potion]);
        assert.equal(potion.quan, 1);
        assert.equal(potion.quantity, 1);
        assert.equal(potion.where, 'inventory');
        assert.equal(floorObjects().length, 0);
        assert.equal(monster.mhp, 12);
        assert.deepEqual(
            [game.u.dx, game.u.dy, game.u.dz], [-1, 0, 0],
        );
        assert.ok(inputBoundaries.some(message => message.includes(
            'The potion of invisibility slips as you throw it!',
        )));
        assert.match(
            game._pending_message || '', /potion of invisibility shatters!$/,
        );
    });

test('greased map potion can reroute vertically through live hitfloor',
    async () => {
        const monster = freshMapPotionState(2);
        const potion = addKnownPotion(POT_INVISIBILITY);
        potion.greased = true;
        const inputBoundaries = [];
        game._preNhgetchHook = () => {
            inputBoundaries.push(game._pending_message || '');
        };

        initRng(124n);
        try {
            await throwEast(potion, Array(20).fill(' '));
        } finally {
            delete game._preNhgetchHook;
        }
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects().length, 0);
        assert.equal(monster.mhp, 12);
        assert.deepEqual(
            [game.u.dx, game.u.dy, game.u.dz], [0, 0, 1],
        );
        assert.ok(inputBoundaries.some(message => message.includes(
            'The potion of invisibility slips as you throw it!',
        )));
        assert.ok(inputBoundaries.some(message => message.includes(
            'A potion of invisibility hits the floor.',
        )));
        assert.ok(inputBoundaries.some(message => message.includes(
            'A potion of invisibility shatters!',
        )));
        assert.equal(
            game._pending_message,
            "For an instant you couldn't see yourself!",
        );
    });

test('live unlit oil breaks without evaporation and wakes its target', async () => {
    const monster = freshMapPotionState(2);
    monster.msleeping = 1;
    const potion = addKnownPotion(POT_OIL);

    initRng(2702n);
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(monster.mhp <= 12 && monster.mhp >= 11);
    assert.equal(monster.msleeping, 0);
    assert.match(game._pending_message, /crashes on .* and breaks into shards/);
    assert.doesNotMatch(game._pending_message, /evaporates/);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects().includes(potion), false);
});

test('unknown inert map potion records a live type call after visible impact',
    async () => {
        const monster = freshMapPotionState(2);
        const potion = addKnownPotion(POT_GAIN_LEVEL);
        potion.typeKnown = potion.known = false;
        game._knownObjectTypes?.delete(potion.otyp);
        const siblingRaw = mksobj(POT_GAIN_LEVEL, true, false);
        siblingRaw.cursed = false;
        siblingRaw.blessed = true;
        siblingRaw.bknown = siblingRaw.dknown = true;
        siblingRaw.known = siblingRaw.typeKnown = false;
        const sibling = addInventoryItem(siblingRaw);
        const appearance = game.objectDescriptions[potion.otyp];
        const inputBoundaries = [];
        game._preNhgetchHook = () => {
            inputBoundaries.push(game._pending_message || '');
        };

        initRng(2797n);
        try {
            await throwEast(potion, [
                ...Array(20).fill(' '), ...'mystery', '\n',
            ]);
        } finally {
            delete game._preNhgetchHook;
        }
        assert.equal(monster.mhp, 11);
        assert.deepEqual(game.inventory, [sibling]);
        assert.equal(potion.where, 'gone');
        assert.equal(game._objectCallNames[POT_GAIN_LEVEL], 'mystery');
        assert.ok(
            inventoryItemDescription(sibling).includes(
                `${appearance} potion called mystery`,
            ),
        );
        assert.ok(inputBoundaries.some(message =>
            message.startsWith(`Call an ${appearance} potion:`)
                || message.startsWith(`Call a ${appearance} potion:`),
        ));
        assert.equal(floorObjects().length, 0);
    });
