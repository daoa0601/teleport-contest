import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import {
    MM_NOCOUNTBIRTH, MM_NOGRP, MM_NOMSG, MM_NOWAIT, ROOM,
} from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { initializeRandomMonsterInventory } from '../js/allmain.js';
import {
    giveSpecialMonsterObject, makemonAt, mksobj,
} from '../js/mklev.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory,
} from '../js/monster_inventory.js';
import {
    DAGGER, FIGURINE, GOLD_PIECE, MACE, WAN_STRIKING,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { objectTimers, objectsInTimerGraph } from '../js/object_timers.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const PM_LEPRECHAUN = 63;
const PM_SHOPKEEPER = 271;
const SKELETON_KEY = 221;

function freshInventoryState(seed = 1) {
    resetGame();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        ualign: { type: 0, record: 0 },
        uhave: {},
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
    };
    game.flags = {};
    game.context = {};
    game.moves = 40;
    game.mvitals = [];
    game.inventory = [];
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
    }];
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 7; x <= 17; x++) {
        for (let y = 6; y <= 14; y++) {
            const location = game.level.at(x, y);
            location.typ = ROOM;
            location.lit = true;
        }
    }
    game.in_mklev = false;
    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
    resetBridgeUsageLedger();
}

function assertMonsterOwns(monster, object) {
    assert.equal(object.where, 'minvent');
    assert.equal(object.carrierMid, monster.m_id);
    assert.deepEqual({ x: object.ox, y: object.oy }, {
        x: monster.mx, y: monster.my,
    });
    assert.ok(monster.minvent.includes(object));
}

function assertNoBridgeUse() {
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
}

test('makemon startup inventory links every identity to the final actor',
    async () => {
        freshInventoryState(2101);
        const flags = MM_NOGRP | MM_NOWAIT | MM_NOMSG | MM_NOCOUNTBIRTH;
        const monster = await makemonAt(PM_SHOPKEEPER, 12, 10, flags);

        assert.ok(monster);
        assert.ok(monster.minvent.some(object => object.otyp === SKELETON_KEY));
        assert.ok(monster.minvent.some(object => object.otyp === WAN_STRIKING));
        assert.strictEqual(monster.inventory, monster.minvent);
        assert.equal(monster.hasInventory, true);
        for (const object of monster.minvent)
            assertMonsterOwns(monster, object);
        const graph = objectsInTimerGraph(game);
        assert.ok(monster.minvent.every(object => graph.includes(object)));
        assertNoBridgeUse();
    });

test('ambient m_initinv links direct monster money without carrying effects',
    () => {
        freshInventoryState(2102);
        const monster = {
            m_id: 702,
            mnum: PM_LEPRECHAUN,
            mx: 12, my: 10,
            m_lev: 0,
            mpeaceful: 0,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);

        initializeRandomMonsterInventory(monster);

        assert.strictEqual(monster.inventory, monster.minvent);
        assert.equal(monster.minvent.length, 1);
        assert.equal(monster.minvent[0].otyp, GOLD_PIECE);
        assertMonsterOwns(monster, monster.minvent[0]);
        assert.equal(monster.hasInventory, true);
        assertNoBridgeUse();
    });

test('direct add_to_minv linkage does not invent carrying effects', () => {
    freshInventoryState(2104);
    const monster = {
        m_id: 704,
        mnum: PM_LEPRECHAUN,
        mx: 12, my: 10,
        minvent: [],
        inventory: [],
        hasInventory: false,
    };
    game.level.monsters.push(monster);
    const figurine = {
        otyp: FIGURINE,
        cursed: true,
        corpsenm: 84,
        objectTimers: [],
    };
    enableRngLog();

    linkObjectToMonsterInventory(monster, figurine);

    assert.deepEqual(getRngLog(), []);
    assert.deepEqual(objectTimers(figurine), []);
    assertMonsterOwns(monster, figurine);
    assertNoBridgeUse();
});

test('special-level inventory transfer removes floor ownership and head-links',
    () => {
        freshInventoryState(2103);
        const monster = {
            m_id: 703,
            mnum: PM_SHOPKEEPER,
            mx: 12, my: 10,
            minvent: [],
            inventory: [],
            hasInventory: false,
        };
        game.level.monsters.push(monster);
        const prior = mksobj(DAGGER, true, false);
        addObjectToMonsterInventory(monster, prior, game);
        const context = { xstart: 8, ystart: 7, width: 4, height: 4 };

        const object = giveSpecialMonsterObject(
            context, monster, MACE, 5,
        );

        assert.ok(object);
        assert.equal(object.spe, 5);
        assert.deepEqual(monster.minvent, [object, prior]);
        assert.strictEqual(monster.inventory, monster.minvent);
        assertMonsterOwns(monster, object);
        assert.equal((game.level.objects || []).flat(2).includes(object), false);
        assertNoBridgeUse();
    });
