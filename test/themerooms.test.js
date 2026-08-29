import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, BURN, DART_TRAP, FILL_NORMAL, FOUNTAIN,
    G_GENOD, ICE, LANDMINE, MAXNROFROOMS, MOAT, OROOM, ROCKTRAP,
    ROLLING_BOULDER_TRAP, ROOM, ROOMOFFSET, RUST_TRAP, SHOPBASE,
    SLP_GAS_TRAP, STRAT_WAITFORU,
    SDOOR, STATUE_TRAP, THEMEROOM, TREE, WEB, MM_NOCOUNTBIRTH, MM_NOMSG,
    MM_NOWAIT, NO_MINVENT,
} from '../js/const.js';
import {
    buriedZombieTimerMessage, meltIceTimerMessage,
} from '../js/allmain.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { runObjectBurnTimers } from '../js/light.js';
import {
    applyThemeroomFillByName, generateThemeroomByName,
    makemonAt, mksobj, place_object, runClaimedMeltIceTimer,
    runClaimedObjectRotTimer, runNextBuriedZombieTimer,
    runThemeroomPostprocess, THEMEROOM_META,
} from '../js/mklev.js';
import { runLevelRegions } from '../js/monmove.js';
import {
    BOULDER, CHEST, CORPSE, LAND_MINE, OIL_LAMP, STATUE,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, LEVEL_TIMER_KIND, levelTimers,
    OBJECT_TIMER_KIND, objectTimers, peekNextDueObjectTimer,
    scheduleLevelTimer, scheduleObjectTimer, stopLevelTimer,
} from '../js/object_timers.js';
import { init_rect } from '../js/rect.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import {
    cansee, vision_recalc, vision_reset_new_level,
} from '../js/vision.js';
import { objectWeight } from '../js/weight.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const EXPECTED_THEMEROOMS = [
    'default',
    'Fake Delphi',
    'Room in a room',
    'Huge room with another room inside',
    'Nesting rooms',
    'Default room with themed fill',
    'Unlit room with themed fill',
    'Room with both normal contents and themed fill',
    'Pillars',
    'Mausoleum',
    'Random dungeon feature in the middle of an odd-sized room',
    'L-shaped',
    'L-shaped, rot 1',
    'L-shaped, rot 2',
    'L-shaped, rot 3',
    'Blocked center',
    'Circular, small',
    'Circular, medium',
    'Circular, big',
    'T-shaped',
    'T-shaped, rot 1',
    'T-shaped, rot 2',
    'T-shaped, rot 3',
    'S-shaped',
    'S-shaped, rot 1',
    'Z-shaped',
    'Z-shaped, rot 1',
    'Cross',
    'Four-leaf clover',
    'Water-surrounded vault',
    'Twin businesses',
];

function themedState(seed, depth = 8) {
    resetGame();
    game.u = {
        uz: { dnum: 0, dlevel: depth },
        ulevel: depth,
        uhp: 40, uhpmax: 40,
        acurr: { a: Array(6).fill(10) },
        amax: { a: Array(6).fill(10) },
        uhave: {},
    };
    game.flags = {};
    game.moves = 2;
    game.in_mklev = true;
    game.in_mk_themerooms = true;
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
    }];
    game.level = new GameMap();
    game.level.subrooms = [];
    game.level.nsubroom = 0;
    game.smeq = Array(MAXNROFROOMS + 1).fill(0);
    game._themeroomPostprocess = [];

    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
    init_rect();
    resetBridgeUsageLedger();
}

test('top-level Lua themeroom metadata retains every exact source name', () => {
    const lua = fs.readFileSync(new URL(
        '../nethack-c/upstream/dat/themerms.lua', import.meta.url,
    ), 'utf8');
    const sourceTable = lua.slice(
        lua.indexOf('themerooms = {'),
        lua.indexOf('-- store these at global scope'),
    );
    const sourceNames = [...sourceTable.matchAll(
        /\bname\s*=\s*["']([^"']+)["']/g,
    )].map(match => match[1]);

    assert.deepEqual(sourceNames, EXPECTED_THEMEROOMS);
    assert.deepEqual(
        THEMEROOM_META.map(room => room.name),
        sourceNames,
    );
    assert.deepEqual(
        THEMEROOM_META.map(room => room.frequency),
        [1000, 1, 1, 1, 1, 6, 2, 2, ...Array(23).fill(1)],
    );
    assert.equal(THEMEROOM_META.at(-1).mindiff, 4);
});

test('every declared Lua themeroom has a live named constructor', async () => {
    for (const [index, meta] of THEMEROOM_META.entries()) {
        themedState(1000 + index);
        assert.equal(
            await generateThemeroomByName(meta.name, 8),
            true,
            meta.name,
        );
        assert.ok(game.level.nroom > 0, meta.name);
        assert.deepEqual(getBridgeUsageLedger(), {
            bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
        }, meta.name);
    }
});

test('Room in a room separates ordinary parent fill from child contents', async () => {
    themedState(2001);
    assert.equal(await generateThemeroomByName('Room in a room', 8), true);

    const outer = game.level.rooms[0];
    const inner = game.level.subrooms[0];
    assert.equal(outer.rtype, OROOM);
    assert.equal(outer.needfill, FILL_NORMAL);
    assert.equal(inner.rtype, OROOM);
    assert.equal(inner.needfill, 0);
    assert.equal(outer.sbrooms[0], inner);
    assert.ok(inner.doorct > 0);
});

test('Huge nested room preserves evaluated dimensions and child fill', async () => {
    themedState(2002);
    assert.equal(await generateThemeroomByName(
        'Huge room with another room inside', 8,
    ), true);

    const outer = game.level.rooms[0];
    assert.ok(outer.hx - outer.lx + 1 >= 11);
    assert.ok(outer.hy - outer.ly + 1 >= 8);
    assert.equal(outer.needfill, FILL_NORMAL);
    assert.equal(game.level.nsubroom, 1);
    assert.equal(game.level.subrooms[0].needfill, FILL_NORMAL);
});

test('Mausoleum retains an unjoined central 1x1 tomb', async () => {
    themedState(2004);
    assert.equal(await generateThemeroomByName('Mausoleum', 8), true);

    const outer = game.level.rooms[0];
    const tomb = game.level.subrooms[0];
    assert.equal(outer.rtype, THEMEROOM);
    assert.equal(outer.needfill, 0);
    assert.equal(tomb.rtype, THEMEROOM);
    assert.equal(tomb.hx - tomb.lx + 1, 1);
    assert.equal(tomb.hy - tomb.ly + 1, 1);
    assert.equal(tomb.needjoining, false);
    assert.equal(tomb.needfill, 0);
    const tombHasMonster = game.level.monsters.some(monster =>
        monster.mx === tomb.lx && monster.my === tomb.ly);
    const tombHasCorpse = game.level.objects?.[tomb.lx]?.[tomb.ly]
        ?.some(object => object.otyp === CORPSE) || false;
    assert.equal(tombHasMonster || tombHasCorpse, true);
});

test('odd-sized feature room commits a non-floor center terrain', async () => {
    themedState(2005);
    assert.equal(await generateThemeroomByName(
        'Random dungeon feature in the middle of an odd-sized room', 8,
    ), true);

    const room = game.level.rooms[0];
    const width = room.hx - room.lx + 1;
    const height = room.hy - room.ly + 1;
    assert.equal(width % 2, 1);
    assert.equal(height % 2, 1);
    assert.equal(room.needfill, FILL_NORMAL);
    assert.notEqual(game.level.at(
        room.lx + Math.trunc((width - 1) / 2),
        room.ly + Math.trunc((height - 1) / 2),
    ).typ, ROOM);
});

test('Twin businesses creates unjoined armor and weapon shop children', async () => {
    themedState(2006);
    assert.equal(await generateThemeroomByName('Twin businesses', 8), true);

    const outer = game.level.rooms[0];
    const shops = game.level.subrooms;
    assert.equal(outer.rtype, THEMEROOM);
    assert.equal(outer.needfill, 0);
    assert.equal(shops.length, 2);
    assert.deepEqual(
        shops.map(room => room.rtype).sort((a, b) => a - b),
        [SHOPBASE + 1, SHOPBASE + 4],
    );
    for (const shop of shops) {
        assert.equal(shop.needfill, FILL_NORMAL);
        assert.equal(shop.needjoining, false);
        assert.ok(shop.doorct > 0);
    }
});

test('Ghost of an Adventurer is live without a Valkyrie replay carrier', async () => {
    themedState(4000);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    room.rtype = THEMEROOM;
    room.needfill = 0;
    assert.equal(game._valkPitPath, undefined);

    assert.equal(await applyThemeroomFillByName(
        room, 'Ghost of an Adventurer', 8,
    ), true);

    const ghost = game.level.monsters.find(monster => monster.mnum === 287);
    assert.ok(ghost);
    assert.equal(ghost.msleeping, 1);
    assert.ok(ghost.mstrategy & STRAT_WAITFORU);
    assert.equal(ghost.waiting, true);

    const equipment = game.level.objects?.[ghost.mx]?.[ghost.my] || [];
    assert.ok(equipment.length > 0);
    assert.ok(equipment.every(object => !object.blessed));
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('unknown themed fills are not reported as implemented', async () => {
    themedState(4001);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(
        room, 'not a source fill', 8,
    ), false);
});

test('Ice room owns terrain and row-major positional melt timers', async () => {
    themedState(4002, 8);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    const roomno = ROOMOFFSET;
    const cells = [];
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = game.level.at(x, y);
            if (loc?.roomno === roomno && !loc.edge) cells.push({ x, y });
        }
    }
    const rowMajor = [...cells].sort((left, right) =>
        left.y - right.y || left.x - right.x);

    // This fresh generator state makes percent(25) succeed; the callback then
    // owns one independent rn2(1000) deadline per row-major Lua cell.
    initRng(9n);
    assert.equal(await applyThemeroomFillByName(room, 'Ice room', 8), true);
    assert.ok(cells.length > 0);
    assert.ok(cells.every(({ x, y }) => game.level.at(x, y).typ === ICE));
    const timers = levelTimers(game);
    assert.equal(timers.length, cells.length);
    assert.deepEqual(
        timers.map(({ x, y }) => ({ x, y })), rowMajor,
    );
    assert.ok(timers.every(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY
        && timer.deadline >= game.moves + 200
        && timer.deadline <= game.moves + 1199));
    assert.ok(timers.every((timer, index) =>
        index === 0 || timer.id > timers[index - 1].id));
    const saved = new Map();
    const storage = {
        setItem: (key, value) => saved.set(key, value),
        getItem: key => saved.get(key) ?? null,
        removeItem: key => saved.delete(key),
    };
    game.plname = 'IceTimerWitness';
    assert.equal(saveGame(storage), true);
    game.level.levelTimers = [];
    assert.equal(restoreGame(game.plname, storage), true);
    assert.deepEqual(levelTimers(game), timers);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('melt-ice resumes corpse timers, converts traps, and unearths objects',
    async () => {
        themedState(4003, 8);
        assert.equal(await generateThemeroomByName('default', 8), true);
        const room = game.level.rooms[0];
        initRng(9n);
        assert.equal(await applyThemeroomFillByName(
            room, 'Ice room', 8,
        ), true);
        const originalTimers = levelTimers(game);
        const point = { x: originalTimers[0].x, y: originalTimers[0].y };
        for (const timer of originalTimers) {
            stopLevelTimer(
                timer.x, timer.y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game,
            );
        }

        game.moves = 50;
        const corpse = {
            otyp: CORPSE, corpsenm: 59, o_id: 9901,
            age: 40, contents: [], timed: 0,
        };
        scheduleObjectTimer(
            corpse, OBJECT_TIMER_KIND.ROT_CORPSE, 150, game,
        );
        place_object(corpse, point.x, point.y);
        assert.equal(corpse.on_ice, true);
        assert.equal(objectTimers(corpse)[0].deadline, 250);
        assert.equal(corpse.age, 30);

        const lamp = mksobj(OIL_LAMP, true, false);
        lamp.where = 'buried';
        lamp.buried = true;
        lamp.ox = point.x;
        lamp.oy = point.y;
        game.level.buriedObjects = [lamp];
        scheduleObjectTimer(
            lamp, OBJECT_TIMER_KIND.ROT_ORGANIC, 550, game,
        );
        game.level.traps.push({
            ttyp: LANDMINE, tx: point.x, ty: point.y, tseen: false,
        });
        game.level.engravings = [{
            x: point.x, y: point.y, text: 'under ice', engr_type: BURN,
        }];
        scheduleLevelTimer(
            point.x, point.y, LEVEL_TIMER_KIND.MELT_ICE_AWAY,
            game.moves, game,
        );

        const claimed = claimNextDueObjectTimer(game, game.moves);
        assert.equal(claimed.timer.kind, LEVEL_TIMER_KIND.MELT_ICE_AWAY);
        const event = runClaimedMeltIceTimer(claimed, game);
        assert.equal(event.meltInto, MOAT);
        assert.equal(game.level.at(point.x, point.y).typ, MOAT);
        assert.equal(game.level.traps.some(trap =>
            trap.tx === point.x && trap.ty === point.y), false);
        assert.equal(event.trap.converted.otyp, LAND_MINE);
        assert.equal(event.trap.converted.where, 'floor');
        assert.equal(lamp.where, 'floor');
        assert.equal(objectTimers(lamp).some(timer =>
            timer.kind === OBJECT_TIMER_KIND.ROT_ORGANIC), false);
        assert.equal(corpse.on_ice, false);
        assert.equal(corpse.age, 40);
        assert.equal(objectTimers(corpse)[0].deadline, 150);
        assert.equal(game.level.engravings.length, 0);
        assert.equal(meltIceTimerMessage(event, { visible: true }),
            'Some ice melts away.');
        assert.equal(meltIceTimerMessage(event, {
            visible: false, heroAt: false,
        }), null);
        assert.deepEqual(getBridgeUsageLedger(), {
            bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
        });
    });

test('melt-ice fails before mutation on an unowned boulder continuation',
    () => {
        themedState(4004, 8);
        const x = 10, y = 10;
        game.level.at(x, y).typ = ICE;
        game.level.at(x, y).flags = 0;
        place_object(mksobj(BOULDER, true, false), x, y);
        scheduleLevelTimer(
            x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves, game,
        );
        const claimed = claimNextDueObjectTimer(game, game.moves);
        assert.throws(
            () => runClaimedMeltIceTimer(claimed, game),
            /boulder\/pool lifecycle is not implemented/,
        );
        assert.equal(game.level.at(x, y).typ, ICE);
        assert.deepEqual(getBridgeUsageLedger(), {
            bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
        });
    });

test('Boulder room owns filtered boulders and rolling traps live', async () => {
    themedState(4010, 8);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(room, 'Boulder room', 8), true);

    const boulders = game.level.objects.flatMap(column =>
        (column || []).flatMap(pile => pile || []),
    ).filter(object => object.otyp === BOULDER);
    assert.ok(boulders.length + game.level.traps.length > 0);
    assert.ok(game.level.traps.every(trap =>
        trap.ttyp === ROLLING_BOULDER_TRAP));
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Cloud room persists its selection and ages once per fog occupant', async () => {
    themedState(4020, 8);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(room, 'Cloud room', 8), true);

    assert.equal(game.level.regions.length, 1);
    const region = game.level.regions[0];
    assert.equal(region.kind, 'gas-cloud');
    assert.equal(region.visible, true);
    assert.equal(region.damage, 0);
    assert.equal(region.ttl, -1);
    assert.ok(region.cells.length > 0);
    assert.ok(region.cells.every(cell => {
        const loc = game.level.at(cell.x, cell.y);
        return cell.x >= room.lx && cell.x <= room.hx
            && cell.y >= room.ly && cell.y <= room.hy
            && loc?.roomno === room.roomnoidx + ROOMOFFSET && !loc.edge;
    }));

    const fogs = game.level.monsters.filter(monster => monster.mnum === 106);
    assert.equal(fogs.length, Math.trunc(region.cells.length / 4));
    assert.ok(fogs.every(monster => monster.msleeping === 1
        && region.cells.some(cell =>
            cell.x === monster.mx && cell.y === monster.my)));

    let expectedTtl = -1;
    for (const _fog of fogs)
        if (expectedTtl < 20) expectedTtl += 5;
    runLevelRegions(game);
    assert.equal(region.ttl, expectedTtl);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Spider nest gates resident spiders by source difficulty', async () => {
    themedState(4011, 8);
    assert.equal(await generateThemeroomByName('default', 8), true);
    assert.equal(await applyThemeroomFillByName(
        game.level.rooms[0], 'Spider nest', 8,
    ), true);
    assert.ok(game.level.traps.length > 0);
    assert.ok(game.level.traps.every(trap => trap.ttyp === WEB));
    assert.equal(game.level.monsters.some(monster => monster.mnum === 96), false);

    themedState(4011, 9);
    assert.equal(await generateThemeroomByName('default', 9), true);
    assert.equal(await applyThemeroomFillByName(
        game.level.rooms[0], 'Spider nest', 9,
    ), true);
    assert.ok(game.level.traps.every(trap => trap.ttyp === WEB));
    assert.equal(game.level.monsters.some(monster => monster.mnum === 96), true);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Garden defers grown wall and arboreal secret-door ownership', async () => {
    themedState(4021, 8);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    room.rlit = 1;
    assert.equal(await applyThemeroomFillByName(room, 'Garden', 8), true);

    const area = (room.hx - room.lx + 1) * (room.hy - room.ly + 1);
    const nymphs = game.level.monsters.filter(monster => monster.mnum === 67);
    assert.equal(nymphs.length, Math.trunc(area / 6));
    assert.ok(nymphs.every(monster => monster.msleeping === 1));
    const fountains = game.level.locations.flatMap(column => column)
        .filter(loc => loc.typ === FOUNTAIN);
    assert.ok(fountains.length <= nymphs.length);

    const secret = game.level.at(room.lx - 1, room.ly);
    secret.typ = SDOOR;
    secret.arboreal_sdoor = 0;
    await runThemeroomPostprocess();
    assert.equal(secret.typ, SDOOR);
    assert.equal(secret.arboreal_sdoor, 1);
    let trees = 0;
    for (let x = room.lx - 1; x <= room.hx + 1; x++)
        for (let y = room.ly - 1; y <= room.hy + 1; y++)
            if (game.level.at(x, y)?.typ === TREE) trees++;
    assert.ok(trees > 0);
    assert.equal(game._themeroomPostprocess.length, 0);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Trap room shuffles once and applies one trap type to its selection', async () => {
    themedState(4012, 12);
    assert.equal(await generateThemeroomByName('default', 12), true);
    assert.equal(await applyThemeroomFillByName(
        game.level.rooms[0], 'Trap room', 12,
    ), true);
    assert.ok(game.level.traps.length > 0);
    const expectedTypes = new Set([
        ARROW_TRAP, DART_TRAP, ROCKTRAP, BEAR_TRAP,
        LANDMINE, SLP_GAS_TRAP, RUST_TRAP, ANTI_MAGIC,
    ]);
    assert.ok(expectedTypes.has(game.level.traps[0].ttyp));
    assert.ok(game.level.traps.every(trap =>
        trap.ttyp === game.level.traps[0].ttyp));
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Massacre creates only source role and guardian corpses', async () => {
    themedState(4030, 12);
    assert.equal(await generateThemeroomByName('default', 12), true);
    assert.equal(await applyThemeroomFillByName(
        game.level.rooms[0], 'Massacre', 12,
    ), true);

    const corpses = game.level.objects.flatMap(column =>
        (column || []).flatMap(pile => pile || []),
    ).filter(object => object.otyp === CORPSE);
    assert.ok(corpses.length >= 5 && corpses.length <= 25);
    const allowed = new Set([
        382, 381, 378, 377, 376, 375, 374, 373, 372, 371, 370, 369,
        343, 342, 341, 340, 339, 338, 337, 336, 335, 334, 333, 332, 331,
    ]);
    assert.ok(corpses.every(corpse => allowed.has(corpse.corpsenm)));
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Statuary composes loose statues and live statue traps', async () => {
    themedState(4031, 12);
    assert.equal(await generateThemeroomByName('default', 12), true);
    assert.equal(await applyThemeroomFillByName(
        game.level.rooms[0], 'Statuary', 12,
    ), true);

    assert.ok(game.level.traps.length >= 1 && game.level.traps.length <= 3);
    assert.ok(game.level.traps.every(trap => trap.ttyp === STATUE_TRAP));
    for (const trap of game.level.traps) {
        assert.ok(game.level.objects?.[trap.tx]?.[trap.ty]
            ?.some(object => object.otyp === STATUE));
    }
    const statues = game.level.objects.flatMap(column =>
        (column || []).flatMap(pile => pile || []),
    ).filter(object => object.otyp === STATUE);
    assert.ok(statues.length >= game.level.traps.length + 5);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Buried treasure owns nested contents before its deferred clue', async () => {
    themedState(4032, 12);
    assert.equal(await generateThemeroomByName('default', 12), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(
        room, 'Buried treasure', 12,
    ), true);

    assert.equal(game.level.buriedObjects.length, 1);
    const chest = game.level.buriedObjects[0];
    assert.equal(chest.otyp, CHEST);
    assert.equal(chest.where, 'buried');
    assert.equal(chest.buried, true);
    assert.ok(chest.ox >= room.lx && chest.ox <= room.hx);
    assert.ok(chest.oy >= room.ly && chest.oy <= room.hy);
    assert.ok(chest.contents.length >= 3 && chest.contents.length <= 12);
    assert.ok(chest.contents.every(object =>
        object.where === 'contained' && object.ox === 0 && object.oy === 0));
    assert.equal(chest.owt, objectWeight(chest));
    assert.equal(game.level.objects.flatMap(column =>
        (column || []).flatMap(pile => pile || []),
    ).some(object => object === chest), false);
    if (chest.rotOrganicAt != null) {
        assert.ok(chest.rotOrganicAt >= game.moves + 251);
        assert.ok(chest.rotOrganicAt <= game.moves + 500);
    }
    assert.deepEqual(game._themeroomPostprocess, [{
        kind: 'buried-treasure-engraving',
        x: chest.ox,
        y: chest.oy,
    }]);

    await runThemeroomPostprocess();
    assert.equal(game.level.engravings.length, 1);
    const engraving = game.level.engravings[0];
    assert.equal(engraving.engr_type, BURN);
    const tx = chest.ox - engraving.x - 1;
    const ty = chest.oy - engraving.y;
    let direction = '';
    if (tx === 0 && ty === 0) direction = ' here';
    else {
        if (tx)
            direction += ` ${Math.abs(tx)} ${tx > 0 ? 'east' : 'west'}`;
        if (ty)
            direction += ` ${Math.abs(ty)} ${ty > 0 ? 'south' : 'north'}`;
    }
    assert.equal(engraving.text, `Dig${direction}`);
    assert.equal(game._themeroomPostprocess.length, 0);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Buried zombies own depth species and replace corpse rot timers', async () => {
    const strata = [
        { difficulty: 3, allowed: [59, 165, 72, 44], expanded: [] },
        {
            difficulty: 4,
            allowed: [59, 165, 72, 44, 264, 260],
            expanded: [264, 260],
        },
        {
            difficulty: 7,
            allowed: [59, 165, 72, 44, 264, 260, 174, 169],
            expanded: [174, 169],
        },
    ];
    for (const { difficulty, allowed, expanded } of strata) {
        const observed = new Set();
        for (let sample = 0; sample < 4; sample++) {
            themedState(5000 + difficulty * 10 + sample, difficulty);
            assert.equal(await generateThemeroomByName(
                'default', difficulty,
            ), true);
            const room = game.level.rooms[0];
            assert.equal(await applyThemeroomFillByName(
                room, 'Buried zombies', difficulty,
            ), true);

            const corpses = game.level.buriedObjects;
            assert.equal(corpses.length, Math.floor(
                ((room.hx - room.lx + 1) * (room.hy - room.ly + 1)) / 2,
            ));
            assert.ok(corpses.every(corpse =>
                corpse.otyp === CORPSE
                && allowed.includes(corpse.corpsenm)
                && corpse.where === 'buried'
                && corpse.buried === true
                && corpse.ox >= room.lx && corpse.ox <= room.hx
                && corpse.oy >= room.ly && corpse.oy <= room.hy
                && corpse.rotAt == null
                && corpse.zombifyAt >= game.moves + 990
                && corpse.zombifyAt <= game.moves + 1010
                && corpse.timed === 1));
            for (const corpse of corpses) observed.add(corpse.corpsenm);
        }
        if (expanded.length)
            assert.ok(expanded.some(species => observed.has(species)));
    }
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('NO_MINVENT skips weapon and inventory RNG without skipping birth', async () => {
    const flags = NO_MINVENT | MM_NOWAIT | MM_NOMSG | MM_NOCOUNTBIRTH;
    for (const species of [239, 248]) { // kobold zombie, armed skeleton
        const seed = 6000 + species;
        themedState(seed, 7);
        game.in_mklev = false;
        game.level.at(10, 10).typ = ROOM;
        enableRngLog();
        const empty = await makemonAt(species, 10, 10, flags);
        const emptyLog = getRngLog().slice();
        assert.ok(empty);
        assert.equal(empty.hasInventory, false);
        assert.deepEqual(empty.minvent, []);
        assert.deepEqual(empty.inventory, []);
        assert.equal(empty.mstrategy, 0);

        themedState(seed, 7);
        game.in_mklev = false;
        game.level.at(10, 10).typ = ROOM;
        enableRngLog();
        const ordinary = await makemonAt(
            species, 10, 10,
            MM_NOWAIT | MM_NOMSG | MM_NOCOUNTBIRTH,
        );
        const ordinaryLog = getRngLog().slice();
        assert.ok(ordinary);
        assert.deepEqual(
            ordinaryLog.slice(0, emptyLog.length), emptyLog,
        );
        assert.ok(ordinaryLog.length > emptyLog.length);
    }
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('a due buried-zombie timer revives through an empty actor and pit', async () => {
    themedState(7007, 7);
    assert.equal(await generateThemeroomByName('default', 7), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(
        room, 'Buried zombies', 7,
    ), true);
    const corpse = game.level.buriedObjects[0];
    const livingSpecies = corpse.corpsenm;
    const expectedZombie = new Map([
        [59, 239], [165, 240], [72, 241], [44, 242],
        [264, 243], [260, 244], [174, 245], [169, 247],
    ]).get(livingSpecies);
    for (const other of game.level.buriedObjects) {
        scheduleObjectTimer(
            other, OBJECT_TIMER_KIND.ZOMBIFY_MON,
            game.moves + 100, game,
        );
    }
    scheduleObjectTimer(
        corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game,
    );
    game.in_mklev = false;
    game.level.at(corpse.ox, corpse.oy).typ = ROOM;

    const event = await runNextBuriedZombieTimer(game, game.moves);
    assert.equal(event.kind, 'revived');
    assert.equal(event.monster.mnum, expectedZombie);
    assert.equal(event.monster.female, corpse.female);
    assert.equal(event.monster.mrevived, 1);
    assert.equal(event.monster.hasInventory, false);
    assert.deepEqual(event.monster.minvent, []);
    assert.equal(event.trap.ttyp, 11); // PIT
    assert.equal(event.trap.tx, event.monster.mx);
    assert.equal(event.trap.ty, event.monster.my);
    assert.equal(game.level.buriedObjects.includes(corpse), false);
    assert.equal(corpse.where, 'gone');
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('a blocked buried zombie becomes a buried corpse with a rot timer',
    async () => {
        themedState(7011, 7);
        assert.equal(await generateThemeroomByName('default', 7), true);
        const room = game.level.rooms[0];
        assert.equal(await applyThemeroomFillByName(
            room, 'Buried zombies', 7,
        ), true);
        const corpse = game.level.buriedObjects[0];
        const livingSpecies = corpse.corpsenm;
        for (const other of game.level.buriedObjects) {
            scheduleObjectTimer(
                other, OBJECT_TIMER_KIND.ZOMBIFY_MON,
                game.moves + 100, game,
            );
        }
        scheduleObjectTimer(
            corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game,
        );
        game.in_mklev = false;
        game.level.at(corpse.ox, corpse.oy).typ = ROOM;
        game.level.traps.push({
            ttyp: ARROW_TRAP, tx: corpse.ox, ty: corpse.oy,
            tseen: false,
        });

        const event = await runNextBuriedZombieTimer(game, game.moves);
        assert.equal(event.kind, 'failed');
        assert.notEqual(corpse.corpsenm, livingSpecies);
        assert.equal(corpse.where, 'buried');
        assert.equal(game.level.buriedObjects.includes(corpse), true);
        assert.deepEqual(
            objectTimers(corpse).map(timer => timer.kind),
            [OBJECT_TIMER_KIND.ROT_CORPSE],
        );
        assert.ok(objectTimers(corpse)[0].deadline > game.moves);
    });

test('a genocided zombie form rots without birth or pit', async () => {
    themedState(7012, 7);
    assert.equal(await generateThemeroomByName('default', 7), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(
        room, 'Buried zombies', 7,
    ), true);
    const corpse = game.level.buriedObjects[0];
    const zombieForm = new Map([
        [59, 239], [165, 240], [72, 241], [44, 242],
        [264, 243], [260, 244], [174, 245], [169, 247],
    ]).get(corpse.corpsenm);
    for (const other of game.level.buriedObjects) {
        scheduleObjectTimer(
            other, OBJECT_TIMER_KIND.ZOMBIFY_MON,
            game.moves + 100, game,
        );
    }
    scheduleObjectTimer(
        corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game,
    );
    game.mvitals = [];
    game.mvitals[zombieForm] = { mvflags: G_GENOD };
    game.in_mklev = false;

    const event = await runNextBuriedZombieTimer(game, game.moves);
    assert.equal(event.kind, 'rotted');
    assert.equal(game.level.buriedObjects.includes(corpse), false);
    assert.equal(corpse.where, 'gone');
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.level.traps.length, 0);
});

test('an occupied revival square moves the zombie without moving its blocker',
    async () => {
        themedState(7013, 7);
        assert.equal(await generateThemeroomByName('default', 7), true);
        const room = game.level.rooms[0];
        assert.equal(await applyThemeroomFillByName(
            room, 'Buried zombies', 7,
        ), true);
        const corpse = game.level.buriedObjects[0];
        for (const other of game.level.buriedObjects) {
            scheduleObjectTimer(
                other, OBJECT_TIMER_KIND.ZOMBIFY_MON,
                game.moves + 100, game,
            );
        }
        scheduleObjectTimer(
            corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game,
        );
        game.in_mklev = false;
        game.level.at(corpse.ox, corpse.oy).typ = ROOM;
        const blocker = await makemonAt(
            0, corpse.ox, corpse.oy,
            NO_MINVENT | MM_NOWAIT | MM_NOMSG | MM_NOCOUNTBIRTH,
        );
        const original = { x: blocker.mx, y: blocker.my };

        const event = await runNextBuriedZombieTimer(game, game.moves);
        assert.equal(event.kind, 'revived');
        assert.deepEqual({ x: blocker.mx, y: blocker.my }, original);
        assert.notDeepEqual(
            { x: event.monster.mx, y: event.monster.my }, original,
        );
        assert.equal(event.trap.tx, event.monster.mx);
        assert.equal(event.trap.ty, event.monster.my);
    });

test('a boulder fills the revival pit and buries the remaining floor pile',
    async () => {
        themedState(7014, 7);
        assert.equal(await generateThemeroomByName('default', 7), true);
        const room = game.level.rooms[0];
        assert.equal(await applyThemeroomFillByName(
            room, 'Buried zombies', 7,
        ), true);
        const corpse = game.level.buriedObjects[0];
        for (const other of game.level.buriedObjects) {
            scheduleObjectTimer(
                other, OBJECT_TIMER_KIND.ZOMBIFY_MON,
                game.moves + 100, game,
            );
        }
        scheduleObjectTimer(
            corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves, game,
        );
        game.in_mklev = false;
        game.level.at(corpse.ox, corpse.oy).typ = ROOM;
        const boulder = place_object(
            mksobj(BOULDER, true, false), corpse.ox, corpse.oy,
        );
        const lamp = place_object(
            mksobj(OIL_LAMP, true, false), corpse.ox, corpse.oy,
        );

        const event = await runNextBuriedZombieTimer(game, game.moves);
        assert.equal(event.kind, 'revived');
        assert.equal(event.pitFilled, true);
        assert.equal(event.filledByBoulder, boulder);
        assert.equal(boulder.where, 'gone');
        assert.equal(lamp.where, 'buried');
        assert.equal(game.level.buriedObjects.includes(lamp), true);
        assert.equal(game.level.traps.some(trap =>
            trap.tx === event.monster.mx && trap.ty === event.monster.my
            && (trap.ttyp === 11 || trap.ttyp === 12)), false);
    });

test('buried zombie presentation distinguishes sight, invisibility, and sound',
    () => {
        const event = {
            kind: 'revived',
            monster: { mnum: 239, mx: 10, my: 10 },
            trap: { ttyp: 11, tx: 10, ty: 10 },
        };
        assert.deepEqual(buriedZombieTimerMessage(event, {
            visible: true, spotted: true, monsterName: 'kobold zombie',
        }), {
            message: 'A kobold zombie claws itself out of the ground!',
            visible: true, trap: event.trap,
        });
        assert.equal(buriedZombieTimerMessage(event, {
            visible: true, spotted: false,
        }).message, 'Something claws itself out of the ground!');
        assert.equal(buriedZombieTimerMessage(event, {
            visible: false, deaf: false, heroX: 12, heroY: 12,
        }).message, 'You hear scratching noises.');
        assert.equal(buriedZombieTimerMessage(event, {
            visible: false, deaf: true, heroX: 10, heroY: 10,
        }), null);
        assert.equal(buriedZombieTimerMessage(event, {
            visible: false, deaf: false, heroX: 15, heroY: 10,
        }), null);
    });

test('object and level timers share deadline and newest-id ordering', () => {
    themedState(7010, 7);
    const older = place_object({
        otyp: CHEST, o_id: 9001, contents: [], timed: 0,
    }, 10, 10);
    const newer = place_object({
        otyp: OIL_LAMP, o_id: 9002, contents: [], timed: 0,
    }, 11, 10);
    const earlier = place_object({
        otyp: CHEST, o_id: 9003, contents: [], timed: 0,
    }, 12, 10);
    scheduleObjectTimer(
        older, OBJECT_TIMER_KIND.ROT_ORGANIC, 40, game,
    );
    scheduleObjectTimer(
        newer, OBJECT_TIMER_KIND.BURN_OBJECT, 40, game,
    );
    scheduleObjectTimer(
        earlier, OBJECT_TIMER_KIND.ROT_ORGANIC, 39, game,
    );
    scheduleLevelTimer(
        13, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, 40, game,
    );

    assert.equal(peekNextDueObjectTimer(game, 40).object, earlier);
    assert.equal(claimNextDueObjectTimer(game, 40).object, earlier);
    assert.deepEqual(peekNextDueObjectTimer(game, 40).position, {
        x: 13, y: 10,
    });
    assert.deepEqual(claimNextDueObjectTimer(game, 40).position, {
        x: 13, y: 10,
    });
    assert.equal(peekNextDueObjectTimer(game, 40).object, newer);
    assert.equal(claimNextDueObjectTimer(game, 40).object, newer);
    assert.equal(peekNextDueObjectTimer(game, 40).object, older);
    assert.deepEqual(objectTimers(newer), []);
});

test('ordered rot callbacks remove floor corpses and unbox buried contents', async () => {
    themedState(7011, 7);
    const corpse = place_object(mksobj(CORPSE, true, false), 10, 10);
    scheduleObjectTimer(
        corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves, game,
    );
    const corpseTimer = claimNextDueObjectTimer(game, game.moves);
    const corpseEvent = runClaimedObjectRotTimer(corpseTimer, game);
    assert.equal(corpseEvent.kind, OBJECT_TIMER_KIND.ROT_CORPSE);
    assert.equal(corpseEvent.where, 'floor');
    assert.equal(corpse.where, 'gone');
    assert.equal(game.level.objects[10][10].includes(corpse), false);

    assert.equal(await generateThemeroomByName('default', 7), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(
        room, 'Buried treasure', 7,
    ), true);
    const chest = game.level.buriedObjects.find(object =>
        object.otyp === CHEST);
    const contents = [...chest.contents];
    const x = chest.ox, y = chest.oy;
    scheduleObjectTimer(
        chest, OBJECT_TIMER_KIND.ROT_ORGANIC, game.moves, game,
    );
    const chestTimer = claimNextDueObjectTimer(game, game.moves);
    const chestEvent = runClaimedObjectRotTimer(chestTimer, game);
    assert.equal(chestEvent.kind, OBJECT_TIMER_KIND.ROT_ORGANIC);
    assert.equal(chest.where, 'gone');
    assert.equal(game.level.buriedObjects.includes(chest), false);
    assert.ok(contents.every(object =>
        object.where === 'gone'
        || (object.where === 'buried' && object.ox === x && object.oy === y)));
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('Light source creates a mobile oil-lamp light with live fuel breakpoints', async () => {
    themedState(4033, 12);
    assert.equal(await generateThemeroomByName('default', 12), true);
    const room = game.level.rooms[0];
    room.rlit = 0;
    for (let x = 1; x < game.level.locations.length; x++)
        for (const loc of game.level.locations[x] || []) loc.lit = false;
    assert.equal(await applyThemeroomFillByName(
        room, 'Light source', 12,
    ), true);

    const lamps = game.level.objects.flatMap(column =>
        (column || []).flatMap(pile => pile || []),
    ).filter(object => object.otyp === OIL_LAMP);
    assert.equal(lamps.length, 1);
    const lamp = lamps[0];
    assert.equal(lamp.lamplit, true);
    assert.equal(lamp.timed, 1);
    assert.equal(lamp.age, 150);
    assert.ok(lamp.burnAt >= game.moves + 850);
    assert.ok(lamp.burnAt <= game.moves + 1349);

    const circleOffsets = [3, 3, 2, 1];
    let hero = null;
    for (let x = room.lx; x <= room.hx && !hero; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const dx = Math.abs(x - lamp.ox);
            const dy = Math.abs(y - lamp.oy);
            if (Math.max(dx, dy) > 1 && dy <= 3
                && dx <= circleOffsets[dy]
                && game.level.at(x, y)?.typ === ROOM) {
                hero = { x, y };
                break;
            }
        }
    }
    assert.ok(hero);
    game.u.ux = hero.x;
    game.u.uy = hero.y;
    game.in_mklev = false;
    game.blind = false;
    lamp.lamplit = false;
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(cansee(lamp.ox, lamp.oy), false);
    lamp.lamplit = true;
    game.vision_full_recalc = 1;
    vision_recalc(0);
    assert.equal(cansee(lamp.ox, lamp.oy), true);

    for (const expectedAge of [100, 50, 25, 0]) {
        const deadline = lamp.burnAt;
        assert.equal(runObjectBurnTimers(game, deadline).length, 1);
        assert.equal(lamp.age, expectedAge);
        assert.equal(lamp.lamplit, true);
    }
    const finalDeadline = lamp.burnAt;
    assert.equal(runObjectBurnTimers(game, finalDeadline).length, 1);
    assert.equal(lamp.age, 0);
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.burnAt, undefined);
    assert.equal(lamp.timed, 0);
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});

test('unknown themeroom names fail instead of becoming generic rooms', async () => {
    themedState(3000);
    assert.equal(await generateThemeroomByName('not a source room', 8), false);
    assert.equal(game.level.nroom, 0);
});
