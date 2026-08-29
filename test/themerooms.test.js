import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, BURN, DART_TRAP, FILL_NORMAL, FOUNTAIN,
    LANDMINE, MAXNROFROOMS, OROOM, ROCKTRAP, ROLLING_BOULDER_TRAP,
    ROOM, ROOMOFFSET, RUST_TRAP, SHOPBASE, SLP_GAS_TRAP, STRAT_WAITFORU,
    SDOOR, STATUE_TRAP, THEMEROOM, TREE, WEB,
} from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { runObjectBurnTimers } from '../js/light.js';
import {
    applyThemeroomFillByName, generateThemeroomByName,
    runThemeroomPostprocess, THEMEROOM_META,
} from '../js/mklev.js';
import { runLevelRegions } from '../js/monmove.js';
import { BOULDER, CHEST, CORPSE, OIL_LAMP, STATUE } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { init_rect } from '../js/rect.js';
import { initRng } from '../js/rng.js';
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

test('declared but unported themed fills are not reported as implemented', async () => {
    themedState(4001);
    assert.equal(await generateThemeroomByName('default', 8), true);
    const room = game.level.rooms[0];
    assert.equal(await applyThemeroomFillByName(room, 'Ice room', 8), false);
    assert.equal(await applyThemeroomFillByName(
        room, 'not a source fill', 8,
    ), false);
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
