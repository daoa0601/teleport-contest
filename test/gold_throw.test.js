import test from 'node:test';
import assert from 'node:assert/strict';

import { IRONBARS, STONE, WEB } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, heroGoldObject } from '../js/hero_gold.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    assertNoBridgeUse, carriedGold, floorAt, floorObjects, liveMonster,
    looseGold, throwGold,
} from './support/gold-arena.js';
import { freshWeaponArena } from './support/weapon-arena.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const PM_SHOPKEEPER = 271;
const PM_GUARD = 272;
const PM_ALIGNED_CLERIC = 274;
const PM_SOLDIER = 277;
const PM_WATCHMAN = 282;

test('direct throw moves the whole purse through its strength-weight range',
    async () => {
        const level = freshWeaponArena();
        const purse = carriedGold(100, 29001);

        await throwGold('l');

        assert.equal(heroGoldObject(game), null);
        assert.equal(heroGoldAmount(game), 0);
        assert.equal(game._goldCount, 0);
        assert.equal(purse.quantity, 100);
        assert.equal(purse.where, 'floor');
        assert.deepEqual([purse.ox, purse.oy], [15, 10]);
        assert.equal(floorAt(level, 15, 10).includes(purse), true);
        assert.equal(floorObjects(level).filter(object =>
            object.otyp === GOLD_PIECE).length, 1);
        assert.equal(game.context.move, 1);
        assertNoBridgeUse();
    });

test('an adjacent blocked cell leaves the whole thrown purse at the hero',
    async () => {
        const level = freshWeaponArena();
        level.at(11, 10).typ = STONE;
        const purse = carriedGold(4000, 29002);

        await throwGold('l');

        assert.equal(heroGoldObject(game), null);
        assert.equal(purse.quantity, 4000);
        assert.deepEqual([purse.ox, purse.oy], [10, 10]);
        assert.equal(floorAt(level, 10, 10).includes(purse), true);
        assert.equal(game.context.move, 1);
    });

test('coin weight shortens direct range using source integer division',
    async () => {
        const level = freshWeaponArena();
        const purse = carriedGold(4000, 29026);

        await throwGold('l');

        assert.equal(purse.owt, 40);
        assert.deepEqual([purse.ox, purse.oy], [14, 10]);
        assert.equal(floorAt(level, 14, 10).includes(purse), true);
    });

test('a later wall leaves direct gold on the last open path cell',
    async () => {
        const level = freshWeaponArena();
        level.at(14, 10).typ = STONE;
        const purse = carriedGold(100, 29027);

        await throwGold('l');

        assert.deepEqual([purse.ox, purse.oy], [13, 10]);
        assert.equal(floorAt(level, 13, 10).includes(purse), true);
    });

test('coin-class direct gold passes through iron bars', async () => {
    const level = freshWeaponArena();
    level.at(12, 10).typ = IRONBARS;
    const purse = carriedGold(100, 29028);

    await throwGold('l');

    assert.deepEqual([purse.ox, purse.oy], [15, 10]);
    assert.equal(floorAt(level, 15, 10).includes(purse), true);
});

test('a web can stop the whole purse at its live trap identity', async () => {
    const level = freshWeaponArena();
    const web = { tx: 12, ty: 10, ttyp: WEB, tseen: false };
    level.traps.push(web);
    const purse = carriedGold(100, 29029);
    initRng(1n);

    await throwGold('l');

    assert.equal(web.tseen, true);
    assert.deepEqual([purse.ox, purse.oy], [12, 10]);
    assert.equal(floorAt(level, 12, 10).includes(purse), true);
});

test('downward gold throw moves the whole purse to the hero square',
    async () => {
        const level = freshWeaponArena();
        const purse = carriedGold(17, 29003);

        await throwGold('>');

        assert.equal(heroGoldObject(game), null);
        assert.equal(purse.quantity, 17);
        assert.deepEqual([purse.ox, purse.oy], [10, 10]);
        assert.equal(floorAt(level, 10, 10).includes(purse), true);
        assert.equal(game.context.move, 1);
    });

test('self-directed gold cancellation preserves the purse and spends no time',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(17, 29032);

        await throwGold('.');

        assert.equal(heroGoldObject(game), purse);
        assert.equal(heroGoldAmount(game), 17);
        assert.equal(purse.where, 'inventory');
        assert.equal(game.context.move, 0);
    });

test('a non-greedy monster wakes but does not catch thrown gold', async () => {
    const level = freshWeaponArena();
    const purse = carriedGold(25, 29004);
    const jackal = liveMonster({
        m_id: 29005, mnum: 12, mpeaceful: 1, msleeping: 1,
    });
    level.monsters.push(jackal);

    await throwGold('l');

    assert.equal(jackal.msleeping, 0);
    assert.equal(jackal.mpeaceful, 0);
    assert.equal(jackal.minvent.length, 0);
    assert.equal(floorAt(level, 13, 10).includes(purse), true);
    assert.equal(purse.where, 'floor');
    assert.equal(purse.quantity, 25);
});

test('an immobilized greedy monster is hit harmlessly and cannot catch gold',
    async () => {
        const level = freshWeaponArena();
        const purse = carriedGold(31, 29006);
        const leprechaun = liveMonster({
            m_id: 29007, mcanmove: 0, mfrozen: 3,
        });
        level.monsters.push(leprechaun);

        await throwGold('l');

        assert.equal(leprechaun.mcanmove, 0);
        assert.equal(leprechaun.mfrozen, 3);
        assert.equal(leprechaun.minvent.length, 0);
        assert.equal(floorAt(level, 13, 10).includes(purse), true);
        assert.equal(purse.where, 'floor');
    });

test('a sleeping greedy monster catches the purse and abandons its meal',
    async () => {
        const level = freshWeaponArena();
        const purse = carriedGold(41, 29008);
        const leprechaun = liveMonster({
            m_id: 29009, msleeping: 1, meating: 4,
            m_ap_type: 1, mappearance: 30,
        });
        level.monsters.push(leprechaun);
        initRng(1n);

        await throwGold('l');

        assert.equal(leprechaun.msleeping, 0);
        assert.equal(leprechaun.meating, 0);
        assert.equal(leprechaun.m_ap_type, 0);
        assert.equal(leprechaun.mappearance, 0);
        assert.equal(leprechaun.minvent.includes(purse), true);
        assert.equal(purse.where, 'minvent');
        assert.equal(purse.carrierMid, leprechaun.m_id);
        assert.equal(floorObjects(level).includes(purse), false);
    });

test('the ordinary catch anger probe can turn a peaceful greedy monster hostile',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(11, 29034);
        const leprechaun = liveMonster({
            m_id: 29035, mpeaceful: 1,
        });
        game.level.monsters.push(leprechaun);
        initRng(5n);

        await throwGold('l');

        assert.equal(leprechaun.minvent.includes(purse), true);
        assert.equal(leprechaun.mpeaceful, 0);
    });

test('a greedy catch merges into the prior monster purse and frees the incoming identity',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(11, 29030);
        const leprechaun = liveMonster({ m_id: 29031 });
        const prior = looseGold(9);
        linkObjectToMonsterInventory(leprechaun, prior, { state: game });
        game.level.monsters.push(leprechaun);
        initRng(1n);

        await throwGold('l');

        assert.equal(leprechaun.minvent.length, 1);
        assert.equal(leprechaun.minvent[0], prior);
        assert.equal(prior.quantity, 20);
        assert.equal(purse.where, 'gone');
        assert.equal('carrierMid' in purse, false);
    });

test('covering a shopkeeper robbery restores peace and preserves payment identity',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(50, 29010);
        const shopkeeper = liveMonster({
            m_id: 29011, mnum: PM_SHOPKEEPER, isshk: 1, mpeaceful: 0,
            eshk: { robbed: 30, credit: 0, following: 1, surcharge: true },
        });
        game.level.monsters.push(shopkeeper);
        game.u.ualign.record = 0;
        const alignmentBefore = game.u.ualign.record;
        initRng(1n);

        await throwGold('l');

        assert.equal(shopkeeper.minvent.includes(purse), true);
        assert.equal(shopkeeper.eshk.robbed, 0);
        assert.equal(shopkeeper.eshk.following, 0);
        assert.equal(shopkeeper.mpeaceful, 1);
        assert.equal(game.u.ualign.record, alignmentBefore + 1);
    });

test('a peaceful shopkeeper turns caught gold into exact customer credit',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(7, 29012);
        const shopkeeper = liveMonster({
            m_id: 29013, mnum: PM_SHOPKEEPER, isshk: 1, mpeaceful: 1,
            eshk: { robbed: 0, credit: 11, following: 0 },
        });
        game.level.monsters.push(shopkeeper);
        initRng(1n);

        await throwGold('l');

        assert.equal(shopkeeper.minvent.includes(purse), true);
        assert.equal(shopkeeper.eshk.credit, 18);
        assert.equal(shopkeeper.mpeaceful, 1);
    });

test('a temple priest catches the same whole-purse identity', async () => {
    freshWeaponArena();
    const purse = carriedGold(13, 29014);
    const priest = liveMonster({
        m_id: 29015, mnum: PM_ALIGNED_CLERIC,
        ispriest: 1, mpeaceful: 1,
    });
    game.level.monsters.push(priest);
    initRng(1n);

    await throwGold('l');

    assert.equal(priest.minvent.includes(purse), true);
    assert.equal(purse.where, 'minvent');
    assert.equal(priest.mpeaceful, 1);
});

test('the catch anger probe applies the coaligned priest alignment penalty',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(13, 29036);
        const priest = liveMonster({
            m_id: 29037, mnum: PM_ALIGNED_CLERIC,
            ispriest: 1, mpeaceful: 1,
            epri: { shralign: 1 },
        });
        game.level.monsters.push(priest);
        game.u.ualign.record = 10;
        initRng(5n);

        await throwGold('l');

        assert.equal(priest.minvent.includes(purse), true);
        assert.equal(priest.mpeaceful, 0);
        assert.equal(game.u.ualign.record, 5);
    });

test('the catch anger probe rewards angering a cross-aligned priest',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(13, 29038);
        const priest = liveMonster({
            m_id: 29039, mnum: PM_ALIGNED_CLERIC,
            ispriest: 1, mpeaceful: 1,
            epri: { shralign: -1 },
        });
        game.level.monsters.push(priest);
        game.u.ualign.record = 0;
        initRng(5n);

        await throwGold('l');

        assert.equal(priest.minvent.includes(purse), true);
        assert.equal(priest.mpeaceful, 0);
        assert.equal(game.u.ualign.record, 2);
    });

test('a vault guard catches the purse without the ordinary anger probe',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(19, 29016);
        const guard = liveMonster({
            m_id: 29017, mnum: PM_GUARD, isgd: 1, mpeaceful: 1,
        });
        game.level.monsters.push(guard);
        initRng(5n); // the ordinary one-in-four probe would make it angry

        await throwGold('l');

        assert.equal(guard.minvent.includes(purse), true);
        assert.equal(guard.mpeaceful, 1);
    });

test('a sufficient soldier bribe changes an angry soldier to peaceful',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(150, 29018);
        const soldier = liveMonster({
            m_id: 29019, mnum: PM_SOLDIER, mpeaceful: 0,
        });
        game.level.monsters.push(soldier);
        initRng(1n);

        await throwGold('l');

        assert.equal(soldier.minvent.includes(purse), true);
        assert.equal(soldier.mpeaceful, 1);
    });

test('an insufficient soldier bribe is still caught but leaves hostility',
    async () => {
        freshWeaponArena();
        const purse = carriedGold(50, 29020);
        const soldier = liveMonster({
            m_id: 29021, mnum: PM_SOLDIER, mpeaceful: 0,
        });
        game.level.monsters.push(soldier);
        initRng(1n);

        await throwGold('l');

        assert.equal(soldier.minvent.includes(purse), true);
        assert.equal(soldier.mpeaceful, 0);
    });

test('a watchman catches gold but remains unbribable', async () => {
    freshWeaponArena();
    const purse = carriedGold(500, 29022);
    const watchman = liveMonster({
        m_id: 29023, mnum: PM_WATCHMAN, mpeaceful: 0,
    });
    game.level.monsters.push(watchman);
    initRng(1n);

    await throwGold('l');

    assert.equal(watchman.minvent.includes(purse), true);
    assert.equal(watchman.mpeaceful, 0);
});

test('swallowed gold moves whole into the engulfer inventory', async () => {
    freshWeaponArena();
    const purse = carriedGold(29, 29024);
    const engulfer = liveMonster({
        m_id: 29025, mnum: 202, mx: 10, my: 10,
    });
    game.level.monsters.push(engulfer);
    game.u.uswallow = true;
    game.u.ustuck = engulfer;

    await throwGold('l');

    assert.equal(heroGoldObject(game), null);
    assert.equal(engulfer.minvent.includes(purse), true);
    assert.equal(purse.where, 'minvent');
    assert.equal(purse.quantity, 29);
});
