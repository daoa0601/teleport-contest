import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    ALTAR, AM_LAWFUL, AM_SHRINE, BEAR_TRAP, BRCORNER, CORR, DART_TRAP, DOOR,
    D_BROKEN, D_CLOSED,
    D_ISOPEN, D_NODOOR, FIRE_TRAP, HWALL, IRONBARS, LADDER, LAVAWALL,
    MAGIC_PORTAL,
    MORGUE, POOL, ROOM, SDOOR, SHOPBASE, SINK, SLP_GAS_TRAP, SQKY_BOARD, STONE,
    STRAT_WAITFORU, TEMPLE, TRCORNER,
    WATER, WEB, W_NONDIGGABLE, W_NONPASSWALL, ZOO,
} from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_STRANGULATION, BOULDER,
    ARROW, BOW, ELVEN_ARROW, ORCISH_ARROW, CANDELABRUM_OF_INVOCATION, CHEST,
    CORPSE, CREAM_PIE,
    DAGGER, DART,
    FOOD_RATION,
    CLOAK_OF_DISPLACEMENT, GAUNTLETS_OF_POWER, GOLD_PIECE, HELMET, LONG_SWORD,
    DIAMOND, DILITHIUM_CRYSTAL, FLINT, MACE, MAGIC_LAMP, OIL_LAMP,
    POT_GAIN_LEVEL, RING_MAIL, ROCK, RUBY, SLING,
    SPEAR,
    TOUCHSTONE,
    WORTHLESS_PIECE_OF_RED_GLASS,
    QUARTERSTAFF, RIN_CONFLICT,
    SPE_BOOK_OF_THE_DEAD, SPE_POLYMORPH, TWO_HANDED_SWORD,
    WAN_CANCELLATION, WAN_COLD, WAN_FIRE, WAN_STRIKING,
} from '../js/object_data.js';
import { game } from '../js/gstate.js';
import {
    blocksDiagonalDoor, lookaroundRun, strengthDamageBonus,
} from '../js/cmd.js';
import { inventoryItemDescription } from '../js/invent.js';
import { runSegment } from '../js/jsmain.js';
import { MFAST } from '../js/monmove.js';
import { assertRngThrough } from './parity_assertions.js';

function runLevel(cells, monsters = []) {
    return {
        monsters,
        at(x, y) {
            return { typ: cells.get(`${x},${y}`) ?? STONE, doormask: 0 };
        },
    };
}

function assertRngSliceExact(actual, expected, label) {
    const limit = Math.max(actual.length, expected.length);
    let firstMismatch = 0;
    while (firstMismatch < limit
        && actual[firstMismatch] === expected[firstMismatch]) {
        firstMismatch++;
    }
    if (firstMismatch === limit) return;
    const start = Math.max(0, firstMismatch - 3);
    assert.fail(
        `${label}: first call ${firstMismatch}; `
        + `actual ${actual.length}, expected ${expected.length}; `
        + `actual neighborhood ${JSON.stringify(
            actual.slice(start, firstMismatch + 4),
        )}; expected neighborhood ${JSON.stringify(
            expected.slice(start, firstMismatch + 4),
        )}`,
    );
}

function assertScreenExact(actualEncoded, expectedEncoded, label) {
    const actual = decodeScreen(actualEncoded);
    const expected = decodeScreen(expectedEncoded);
    for (let y = 0; y < Math.max(actual.length, expected.length); y++) {
        for (let x = 0; x < Math.max(
            actual[y]?.length || 0, expected[y]?.length || 0,
        ); x++) {
            if (JSON.stringify(actual[y]?.[x])
                === JSON.stringify(expected[y]?.[x])) continue;
            assert.fail(
                `${label}: first cell (${x},${y}); actual ${
                    JSON.stringify(actual[y]?.[x])}; expected ${
                    JSON.stringify(expected[y]?.[x])}`,
            );
        }
    }
}

function decodedTopline(encoded) {
    return decodeScreen(encoded)[0].map(cell => cell.ch).join('').trimEnd();
}

function decodedRow(encoded, row) {
    return decodeScreen(encoded)[row]
        .map(cell => cell.ch).join('').trimEnd();
}

const SEED0361_BLACK_UNICORN_GENESIS_RNG = [
    'rn2(8)=1', 'rn2(7)=2', 'rn2(6)=2', 'rn2(5)=0',
    'rn2(4)=2', 'rn2(3)=2', 'rn2(2)=1',
    'rn2(16)=12', 'rn2(15)=10', 'rn2(14)=0', 'rn2(13)=3',
    'rn2(12)=3', 'rn2(11)=7', 'rn2(10)=6', 'rn2(9)=8',
    'rn2(8)=3', 'rn2(7)=2', 'rn2(6)=5', 'rn2(5)=1',
    'rn2(4)=1', 'rn2(3)=2', 'rn2(2)=0',
    'rn2(24)=20', 'rn2(23)=9', 'rn2(22)=6', 'rn2(21)=18',
    'rn2(20)=0', 'rn2(19)=10', 'rn2(18)=17', 'rn2(17)=3',
    'rn2(16)=0', 'rn2(15)=4', 'rn2(14)=5', 'rn2(13)=3',
    'rn2(12)=11', 'rn2(11)=4', 'rn2(10)=1', 'rn2(9)=8',
    'rn2(8)=6', 'rn2(7)=6', 'rn2(6)=2', 'rn2(5)=2',
    'rn2(4)=0', 'rn2(3)=1', 'rn2(2)=1',
    'rnd(2)=1', 'd(6,8)=28', 'rn2(2)=0', 'rn2(50)=44',
    'rn2(100)=45', 'rn2(100)=44',
];
const SEED0361_UNKNOWN_RUBY_WISH_RNG = [
    'rnd(2)=1', 'rn2(6)=5', 'rn2(100)=31',
];
const SEED0361_REAL_GEM_LANDING_SCHEDULER_RNG = [
    'rn2(100)=31',
    'rn2(5)=4', 'rn2(15)=5', 'rn2(3)=0',
    'rn2(3)=2', 'rn2(5)=4',
    'rn2(12)=1', 'rn2(12)=10', 'rn2(12)=2', 'rn2(12)=10',
    'rn2(70)=30', 'rn2(3)=1', 'rn2(200)=54',
    'rn2(20)=6', 'rn2(19)=9', 'rn2(73)=30',
];

test('seed0004 character confirmation clears the prior message row', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    // Startup character selection consumes input synchronously; preserve the
    // complete tail so runSegment can reach its normal return boundary.
    const result = await runSegment(session);
    assert.deepEqual(
        decodeScreen(result.getScreens()[7]),
        decodeScreen(session.steps[7].screen),
    );
});

test('seed0001 sleeping watchman genesis preserves hidden sleep state',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nsleeping watchman\n',
            storage: new Map(),
        });

        assert.equal(result.getRngSlices()[33].length, 91);
        assert.equal(decodedTopline(result.getScreens()[33]),
            'A watchman appears next to you.');
        assert.deepEqual(result.getCursors()[33], [52, 9, 1]);
        const watchman = game.level.monsters.find(monster =>
            monster.mnum === 282);
        assert.ok(watchman);
        assert.equal(watchman.msleeping, 1);
        assert.equal(watchman.mpeaceful, 1);
        assert.equal(watchman.mcanmove, 1);
        assert.equal(game.context.move, 0);
    });

test('seed0001 peaceful orc-captain genesis overrides disposition',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\npeaceful orc-captain\n',
            storage: new Map(),
        });

        assert.equal(result.getRngSlices()[36].length, 70);
        assert.equal(decodedTopline(result.getScreens()[36]),
            'An orc-captain appears next to you.');
        assert.deepEqual(result.getCursors()[36], [52, 9, 1]);
        const captain = game.level.monsters.find(monster =>
            monster.mnum === 77);
        assert.ok(captain);
        assert.deepEqual({
            dx: captain.mx - game.u.ux,
            dy: captain.my - game.u.uy,
            hp: captain.mhp,
            hpmax: captain.mhpmax,
            peaceful: captain.mpeaceful,
            tame: captain.mtame ?? 0,
            pet: !!captain.pet,
            sleeping: captain.msleeping ?? 0,
            canmove: captain.mcanmove,
        }, {
            dx: 1,
            dy: 0,
            hp: 11,
            hpmax: 11,
            peaceful: 1,
            tame: 0,
            pet: false,
            sleeping: 0,
            canmove: 1,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0001 human-werejackal alias selects peaceful humanoid form',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\npeaceful human werejackal\n',
            storage: new Map(),
        });

        assert.equal(result.getRngSlices()[41].length, 61);
        assert.equal(decodedTopline(result.getScreens()[41]),
            'A werejackal appears next to you.');
        assert.deepEqual(result.getCursors()[41], [52, 9, 1]);
        const werejackal = game.level.monsters.find(monster =>
            monster.mnum === 262);
        assert.ok(werejackal);
        assert.deepEqual({
            dx: werejackal.mx - game.u.ux,
            dy: werejackal.my - game.u.uy,
            hp: werejackal.mhp,
            hpmax: werejackal.mhpmax,
            peaceful: werejackal.mpeaceful,
            tame: werejackal.mtame ?? 0,
            pet: !!werejackal.pet,
            sleeping: werejackal.msleeping ?? 0,
            canmove: werejackal.mcanmove,
        }, {
            dx: 1,
            dy: 0,
            hp: 2,
            hpmax: 2,
            peaceful: 1,
            tame: 0,
            pet: false,
            sleeping: 0,
            canmove: 1,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0001 forced shopkeeper genesis suspends before construction',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\npeaceful shopkeeper\ny',
            storage: new Map(),
        });

        assert.equal(result.getRngSlices()[35].length, 0);
        assert.equal(decodedTopline(result.getScreens()[35]),
            'Creating human zombie instead; force shopkeeper? [yn] (n)');
        assert.deepEqual(result.getCursors()[35], [58, 0, 1]);
        assert.equal(result.getRngSlices()[36].length, 64);
        assert.equal(decodedTopline(result.getScreens()[36]),
            'A shopkeeper appears next to you.');
        assert.deepEqual(result.getCursors()[36], [52, 9, 1]);

        const shopkeeper = game.level.monsters.find(monster =>
            monster.mnum === 271);
        assert.ok(shopkeeper);
        assert.deepEqual({
            dx: shopkeeper.mx - game.u.ux,
            dy: shopkeeper.my - game.u.uy,
            hp: shopkeeper.mhp,
            hpmax: shopkeeper.mhpmax,
            peaceful: shopkeeper.mpeaceful,
            tame: shopkeeper.mtame ?? 0,
            pet: !!shopkeeper.pet,
            sleeping: shopkeeper.msleeping ?? 0,
            canmove: shopkeeper.mcanmove,
            isshk: shopkeeper.isshk ?? 0,
            resident: !!shopkeeper.eshk,
        }, {
            dx: 1,
            dy: 0,
            hp: 41,
            hpmax: 41,
            peaceful: 1,
            tame: 0,
            pet: false,
            sleeping: 0,
            canmove: 1,
            isshk: 0,
            resident: false,
        });
        assert.equal(shopkeeper.minvent?.length, 4);
        assert.equal(game.context.move, 0);
    });

test('seed0093 genesis initializes displaced apparent hero before inventory',
    async () => {
        const result = await runSegment({
            seed: 93,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nnewt\n',
            storage: new Map(),
        });

        const calls = result.getRngSlices()[20];
        assert.equal(calls.length, 54);
        assert.deepEqual(calls.slice(-12), [
            'rn2(4)=3', 'rn2(3)=1', 'rn2(2)=1',
            'rnd(2)=2', 'rnd(4)=1', 'rn2(2)=0',
            'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=0',
            'rn2(50)=17', 'rn2(100)=57', 'rn2(100)=18',
        ]);
        assert.equal(decodedTopline(result.getScreens()[20]),
            'A newt appears next to you.');

        const newt = game.level.monsters.find(monster => monster.mnum === 322
            && Math.max(
                Math.abs(monster.mx - game.u.ux),
                Math.abs(monster.my - game.u.uy),
            ) === 1);
        assert.ok(newt);
        assert.deepEqual(
            [newt.mx - game.u.ux, newt.my - game.u.uy],
            [1, 1],
        );
        assert.deepEqual(
            [newt.mux - game.u.ux, newt.muy - game.u.uy],
            [-1, -1],
        );
        assert.equal(newt.mhp, 2);
        assert.equal(game.context.move, 0);
    });

test('seed0093 adjacent rock death removes newt before mulch and landing',
    async () => {
        const result = await runSegment({
            seed: 93,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nnewt\n#wizwish\nrock\ntgn',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[37], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rnd(20)=1',
            'rnd(2)=2', 'rn2(6)=5', 'rn2(3)=2', 'rn2(19)=8',
            'rn2(3)=0', 'rn2(100)=40', 'rn2(12)=7', 'rn2(12)=3',
            'rn2(12)=10', 'rn2(70)=9', 'rn2(400)=320',
            'rn2(20)=13', 'rn2(73)=6',
        ], 'seed0093 adjacent-rock death RNG');
        assert.equal(decodedTopline(result.getScreens()[37]),
            'You kill the newt!');
        assert.deepEqual(result.getCursors()[37], [8, 17, 1]);

        const contactX = game.u.ux + 1;
        const contactY = game.u.uy + 1;
        assert.equal(game.level.monsters.some(monster =>
            monster.mnum === 322 && monster.mx === contactX
                && monster.my === contactY), false);
        const floor = game.level.objects?.[contactX]?.[contactY] || [];
        const rocks = floor.filter(object => object.otyp === ROCK);
        assert.equal(rocks.length, 1);
        assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
        assert.equal(rocks[0].where, 'floor');
        assert.equal(floor.some(object => object.otyp === CORPSE), false);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._vanquishedCounts?.get(322)?.count, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0049 hostile rock hit survives while nonzero mulch consumes rock',
    async () => {
        const result = await runSegment({
            seed: 49,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nnewt\n#wizwish\nrock\ntgb',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[37], [
            'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=1', 'rnd(20)=2',
            'rnd(2)=1', 'rn2(19)=0', 'rn2(3)=2', 'rn2(12)=1',
            'rn2(12)=5', 'rn2(12)=0', 'rn2(70)=65', 'rn2(400)=76',
            'rn2(200)=53', 'rn2(20)=11', 'rn2(79)=29',
        ], 'seed0049 hostile-rock survivor RNG');
        assert.equal(decodedTopline(result.getScreens()[37]),
            'The rock hits the newt.');
        assert.deepEqual(result.getCursors()[37], [60, 17, 1]);

        const contactX = game.u.ux - 1;
        const contactY = game.u.uy + 1;
        const newt = game.level.monsters.find(monster =>
            monster.mnum === 322 && monster.mx === contactX
                && monster.my === contactY);
        assert.ok(newt);
        assert.deepEqual({
            hp: newt.mhp,
            hpmax: newt.mhpmax,
            peaceful: newt.mpeaceful,
            tame: newt.mtame ?? 0,
            sleeping: newt.msleeping,
        }, {
            hp: 1,
            hpmax: 2,
            peaceful: 0,
            tame: 0,
            sleeping: 0,
        });
        assert.equal((game.level.objects?.[contactX]?.[contactY] || [])
            .some(object => object.otyp === ROCK), false);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game.context.move, 1);
    });

test('seed0001 rock miss wakes and angers peaceful black unicorn', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizgenesis\nblack unicorn\n#wizwish\nrock\ntgy',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[46], [
        'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=0', 'rnd(20)=10',
        'rn2(3)=0', 'rn2(100)=65', 'rn2(12)=7', 'rn2(12)=7',
        'rn2(12)=7', 'rn2(12)=6', 'rn2(12)=6', 'rn2(70)=16',
        'rn2(400)=120', 'rn2(200)=147', 'rn2(20)=9', 'rn2(70)=36',
    ], 'seed0001 peaceful-unicorn rock-miss RNG');
    assert.equal(decodedTopline(result.getScreens()[46]),
        'The rock misses the black unicorn.  The black unicorn neighs!');
    assert.deepEqual(result.getCursors()[46], [52, 9, 1]);

    const unicorn = game.level.monsters.find(monster => monster.mnum === 103);
    assert.ok(unicorn);
    assert.deepEqual({
        hp: unicorn.mhp,
        hpmax: unicorn.mhpmax,
        peaceful: unicorn.mpeaceful,
        tame: unicorn.mtame ?? 0,
        sleeping: unicorn.msleeping,
    }, {
        hp: 13,
        hpmax: 13,
        peaceful: 0,
        tame: 0,
        sleeping: 0,
    });
    const contactX = game.u.ux - 1;
    const contactY = game.u.uy - 1;
    const rocks = (game.level.objects?.[contactX]?.[contactY] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].where, 'floor');
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 peaceful black unicorn survives rock hit and becomes hostile',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizwish\ngold\n'.repeat(16)
                + '#wizwish\nrock\ntgy',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[270], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rnd(20)=1',
            'rnd(2)=2', 'rn2(19)=17', 'rn2(3)=0', 'rn2(100)=70',
            'rn2(12)=7', 'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=9',
            'rn2(12)=8', 'rn2(70)=8', 'rn2(400)=263',
            'rn2(200)=142', 'rn2(20)=19', 'rn2(70)=10',
        ], 'seed0001 peaceful-unicorn rock-hit RNG');
        assert.equal(decodedTopline(result.getScreens()[270]),
            'The rock hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[270], [52, 9, 1]);

        const contactX = game.u.ux - 1;
        const contactY = game.u.uy - 1;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === contactX
                && monster.my === contactY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            sleeping: unicorn.msleeping,
        }, {
            hp: 11,
            hpmax: 13,
            peaceful: 0,
            tame: 0,
            sleeping: 0,
        });
        const rocks = (game.level.objects?.[contactX]?.[contactY] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(rocks.length, 1);
        assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
        assert.equal(rocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 16);
        assert.equal(game.context.move, 1);
    });

test('seed0001 Hallucinated rock hit uses random subjects and growl',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizwish\ngold\n'.repeat(16)
                + '#wizintrinsic\nh\n #wizwish\nrock\ntgy',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[287], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rnd(20)=1',
            'rnd(2)=2', 'rn2(35)=18', 'rn2(19)=14', 'rn2(3)=2',
            'rn2(12)=7', 'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=9',
            'rn2(12)=8', 'rn2(70)=8', 'rn2(400)=263',
            'rn2(200)=142', 'rn2(20)=19', 'rn2(70)=10',
        ], 'seed0001 Hallucinated peaceful-unicorn ROCK-hit RNG');
        assert.equal(decodedTopline(result.getScreens()[287]),
            'The stone hits the dwarf queen.  The titan rustles!');
        assert.deepEqual(result.getCursors()[287], [52, 9, 1]);

        const contactX = game.u.ux - 1;
        const contactY = game.u.uy - 1;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === contactX
                && monster.my === contactY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            sleeping: unicorn.msleeping,
        }, {
            hp: 11,
            hpmax: 13,
            peaceful: 0,
            tame: 0,
            sleeping: 0,
        });
        assert.equal((game.level.objects?.[contactX]?.[contactY] || [])
            .some(object => object.otyp === ROCK), false);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 16);
        assert.equal(game.u.hallucinationTurns > 0, true);
        assert.equal(game.context.move, 1);
    });

test('seed0001 cream-pie attack makes a peaceful unicorn bystander flee',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\nblack unicorn\n'
                + '#wizwish\ngold\n'.repeat(2)
                + '#wizwish\ncream pie\ntgy ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[105], [
            'rnd(20)=16', 'rnd(25)=5',
        ], 'seed0001 cream-pie contact pager RNG');
        assert.equal(decodedTopline(result.getScreens()[105]),
            "The cream pie splashes over the black unicorn's face!--More--");
        assert.deepEqual(result.getCursors()[105], [61, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[106], [
            'rn2(3)=0', 'rn2(4)=2', 'rn2(6)=4', 'rn2(25)=22',
            'rn2(25)=3', 'rn2(12)=5', 'rn2(12)=8', 'rn2(12)=5',
            'rn2(12)=2', 'rn2(12)=4', 'rn2(12)=2', 'rn2(70)=26',
            'rn2(400)=101', 'rn2(200)=131', 'rn2(20)=2', 'rn2(70)=17',
        ], 'seed0001 peaceful-unicorn bystander RNG');
        assert.equal(decodedTopline(result.getScreens()[106]),
            'The black unicorn neighs!  The black unicorn turns to flee.');
        assert.deepEqual(result.getCursors()[106], [52, 9, 1]);

        const unicorns = game.level.monsters
            .filter(monster => monster.mnum === 103)
            .sort((left, right) => left.m_id - right.m_id);
        assert.equal(unicorns.length, 2);
        const [target, observer] = unicorns;
        assert.deepEqual({
            peaceful: target.mpeaceful,
            canSee: target.mcansee,
            blinded: target.mblinded,
        }, {
            peaceful: 0,
            canSee: 0,
            blinded: 23,
        });
        assert.equal(observer.mpeaceful, 1);
        assert.equal(observer.mflee, 1);
        assert.ok((observer.mfleetim ?? 0) > 0);
        assert.equal(game.inventory.some(object => object.otyp === CREAM_PIE),
            false);
        assert.equal(game._goldCount, 2);
        assert.equal(game.context.move, 1);
    });

test('seed0001 peaceful unicorn bystander growls before starting to flee',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\nblack unicorn\n'
                + '#wizwish\noil lamp\n'
                + '#wizwish\ngold\n'.repeat(9)
                + '#wizwish\ncream pie\nthy  ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[221], [
            'rnd(20)=4', 'rnd(25)=2',
        ], 'seed0001 cream-pie observer-growl contact RNG');
        assert.equal(decodedTopline(result.getScreens()[221]),
            "The cream pie splashes over the black unicorn's face!--More--");
        assert.deepEqual(result.getCursors()[221], [61, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[222], [
            'rn2(3)=0', 'rn2(4)=0', 'rn2(6)=2', 'rn2(25)=19',
        ], 'seed0001 peaceful-unicorn observer-growl RNG');
        assert.equal(decodedTopline(result.getScreens()[222]),
            'The black unicorn neighs!  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[222], [60, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[223], [
            'rn2(25)=8',
            'rn2(12)=5', 'rn2(12)=11', 'rn2(12)=2',
            'rn2(12)=4', 'rn2(12)=4', 'rn2(12)=4',
            'rn2(70)=16', 'rn2(400)=129', 'rn2(200)=138',
            'rn2(20)=6', 'rn2(70)=29',
        ], 'seed0001 observer-growl flee continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[223]),
            'And then starts to flee.');
        assert.deepEqual(result.getCursors()[223], [52, 9, 1]);

        const unicorns = game.level.monsters
            .filter(monster => monster.mnum === 103)
            .sort((left, right) => left.m_id - right.m_id);
        assert.equal(unicorns.length, 2);
        const [target, observer] = unicorns;
        assert.deepEqual({
            peaceful: target.mpeaceful,
            canSee: target.mcansee,
            blinded: target.mblinded,
        }, {
            peaceful: 0,
            canSee: 0,
            blinded: 28,
        });
        assert.deepEqual({
            peaceful: observer.mpeaceful,
            fleeing: observer.mflee,
            fleeTime: observer.mfleetim,
        }, {
            peaceful: 1,
            fleeing: 1,
            fleeTime: 33,
        });
        assert.equal(game.inventory.some(object => object.otyp === CREAM_PIE),
            false);
        assert.equal(game.inventory.some(object => object.otyp === OIL_LAMP),
            true);
        assert.equal(game._goldCount, 9);
        assert.equal(game.context.move, 1);
    });

test('seed0001 dog responds when a related little dog is attacked',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:neutral,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n'
                + '#wizwish\ngold\n'.repeat(5)
                + '#wizgenesis\nlittle dog\n'
                + '#wizgenesis\ndog\n'
                + '#wizwish\ngold\n'.repeat(6)
                + '#wizwish\nrock\ntgh',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[213], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rnd(20)=17',
            'rn2(3)=0',
            'rn2(3)=0', 'rn2(4)=1', 'rn2(6)=0',
            'rn2(100)=70',
            'rn2(12)=7', 'rn2(12)=9', 'rn2(12)=6',
            'rn2(12)=9', 'rn2(12)=8',
            'rn2(70)=8', 'rn2(400)=263', 'rn2(200)=142',
            'rn2(20)=19', 'rn2(76)=44',
        ], 'seed0001 little-dog/dog growth-family response RNG');
        assert.equal(decodedTopline(result.getScreens()[213]),
            'The rock misses the little dog.  The little dog growls!');
        assert.deepEqual(result.getCursors()[213], [52, 9, 1]);

        const family = game.level.monsters
            .filter(monster => monster.mnum === 16 || monster.mnum === 18)
            .sort((left, right) => left.m_id - right.m_id);
        assert.equal(family.length, 2);
        const [target, observer] = family;
        assert.deepEqual({
            mnum: target.mnum,
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            tame: target.mtame ?? 0,
            fleeing: target.mflee ?? 0,
        }, {
            mnum: 16,
            hp: 2,
            hpmax: 2,
            peaceful: 0,
            tame: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            mnum: observer.mnum,
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            tame: observer.mtame ?? 0,
            fleeing: observer.mflee ?? 0,
        }, {
            mnum: 18,
            hp: 18,
            hpmax: 18,
            peaceful: 1,
            tame: 0,
            fleeing: 0,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 11);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.context.move, 1);
    });

test('seed0001 rock attack makes a Grey-elf observer angry',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\nGrey-elf\n'
                + '#wizwish\ngold\n'.repeat(4)
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[123], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rnd(20)=1',
            'rnd(2)=2', 'rn2(5)=4', 'rn2(10)=0',
        ], 'seed0001 generic-humanoid observer attack RNG');
        assert.equal(decodedTopline(result.getScreens()[123]),
            'The rock hits the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[123], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[124], [
            'rn2(19)=14', 'rn2(3)=0', 'rn2(100)=12',
            'rn2(12)=9', 'rn2(12)=11', 'rn2(12)=8',
            'rn2(12)=3', 'rn2(12)=0', 'rn2(70)=50',
            'rn2(400)=195', 'rn2(200)=104', 'rn2(20)=1',
            'rn2(76)=46',
        ], 'seed0001 generic-humanoid observer continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[124]),
            'The Grey-elf gets angry!');
        assert.deepEqual(result.getCursors()[124], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const observer = game.level.monsters.find(monster =>
            monster.mnum === 267 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(observer);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            tame: target.mtame ?? 0,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 6,
            hpmax: 8,
            peaceful: 0,
            tame: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            tame: observer.mtame ?? 0,
            fleeing: observer.mflee ?? 0,
            fleeTime: observer.mfleetim ?? 0,
        }, {
            hp: 23,
            hpmax: 23,
            peaceful: 0,
            tame: 0,
            fleeing: 0,
            fleeTime: 0,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 4);
        assert.equal(game.u.ualign.record, 8);
        assert.equal(game.context.move, 1);
    });

test('seed0001 rock miss makes a Grey-elf gasp and flee', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizgenesis\nblack unicorn\n'
            + '#wizgenesis\nGrey-elf\n'
            + '#wizwish\nrock\ntgl ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[67], [
        'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=1', 'rnd(20)=10',
        'rn2(3)=0', 'rn2(5)=0', 'rn2(5)=2', 'rn2(10)=8',
        'rn2(50)=13',
    ], 'seed0001 generic-humanoid gasp/flee attack RNG');
    assert.equal(decodedTopline(result.getScreens()[67]),
        'The rock misses the black unicorn.  The black unicorn neighs!--More--');
    assert.deepEqual(result.getCursors()[67], [69, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[68], [
        'rn2(100)=42',
        'rn2(12)=11', 'rn2(12)=8', 'rn2(12)=9',
        'rn2(12)=4', 'rn2(12)=0', 'rn2(70)=41',
        'rn2(400)=87', 'rn2(200)=12', 'rn2(20)=9',
        'rn2(76)=35',
    ], 'seed0001 generic-humanoid gasp/flee continuation RNG');
    assert.equal(decodedTopline(result.getScreens()[68]),
        'The Grey-elf exclaims "Oh my!" and then turns to flee.');
    assert.deepEqual(result.getCursors()[68], [52, 9, 1]);

    const target = game.level.monsters.find(monster =>
        monster.mnum === 103 && monster.mx === game.u.ux + 1
            && monster.my === game.u.uy);
    const observer = game.level.monsters.find(monster =>
        monster.mnum === 267 && monster.mx === game.u.ux - 1
            && monster.my === game.u.uy);
    assert.ok(target);
    assert.ok(observer);
    assert.deepEqual({
        hp: target.mhp,
        hpmax: target.mhpmax,
        peaceful: target.mpeaceful,
        fleeing: target.mflee ?? 0,
    }, {
        hp: 8,
        hpmax: 8,
        peaceful: 0,
        fleeing: 0,
    });
    assert.deepEqual({
        hp: observer.mhp,
        hpmax: observer.mhpmax,
        peaceful: observer.mpeaceful,
        fleeing: observer.mflee ?? 0,
        fleeTime: observer.mfleetim ?? 0,
    }, {
        hp: 23,
        hpmax: 23,
        peaceful: 0,
        fleeing: 1,
        fleeTime: 37,
    });
    const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(landedRocks.length, 1);
    assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
    assert.equal(landedRocks[0].where, 'floor');
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game._goldCount, 0);
    assert.equal(game.u.ualign.record, 8);
    assert.equal(game.context.move, 1);
});

test('seed0001 no-gasp orc-captain still flees after peaceful rock attack',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\npeaceful orc-captain\n'
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[79], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rnd(20)=1',
            'rnd(2)=2', 'rn2(5)=3', 'rn2(10)=6', 'rn2(50)=20',
        ], 'seed0001 no-gasp orc-captain attack RNG');
        assert.equal(decodedTopline(result.getScreens()[79]),
            'The rock hits the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[79], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[80], [
            'rn2(19)=8', 'rn2(3)=0', 'rn2(100)=50',
            'rn2(12)=9', 'rn2(12)=8', 'rn2(12)=6',
            'rn2(12)=11', 'rn2(12)=6', 'rn2(70)=69',
            'rn2(400)=380', 'rn2(200)=157', 'rn2(20)=4',
            'rn2(76)=56',
        ], 'seed0001 no-gasp orc-captain continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[80]),
            'The orc-captain turns to flee.');
        assert.deepEqual(result.getCursors()[80], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const observer = game.level.monsters.find(monster =>
            monster.mnum === 77 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(observer);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 6,
            hpmax: 8,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            fleeing: observer.mflee ?? 0,
            fleeTime: observer.mfleetim ?? 0,
        }, {
            hp: 17,
            hpmax: 17,
            peaceful: 0,
            fleeing: 1,
            fleeTime: 44,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 0);
        assert.equal(game.u.ualign.record, 8);
        assert.equal(game.u.ualign.abuse, 2);
        assert.equal(game.context.move, 1);
    });

test('seed0001 zero-gate orc-captain skips class-mismatch rock gasp',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\npeaceful orc-captain\n'
                + '#wizwish\ngold\n'
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[93], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=0', 'rnd(20)=14',
            'rn2(3)=0', 'rn2(5)=0', 'rn2(10)=7', 'rn2(50)=9',
        ], 'seed0001 zero-gate class-mismatch attack RNG');
        assert.equal(decodedTopline(result.getScreens()[93]),
            'The rock misses the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[93], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[94], [
            'rn2(100)=50',
            'rn2(12)=9', 'rn2(12)=8', 'rn2(12)=6',
            'rn2(12)=11', 'rn2(12)=6', 'rn2(70)=69',
            'rn2(400)=380', 'rn2(200)=157', 'rn2(20)=4',
            'rn2(76)=56',
        ], 'seed0001 zero-gate class-mismatch continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[94]),
            'The orc-captain turns to flee.');
        assert.deepEqual(result.getCursors()[94], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const observer = game.level.monsters.find(monster =>
            monster.mnum === 77 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(observer);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 8,
            hpmax: 8,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            fleeing: observer.mflee ?? 0,
            fleeTime: observer.mfleetim ?? 0,
        }, {
            hp: 17,
            hpmax: 17,
            peaceful: 0,
            fleeing: 1,
            fleeTime: 33,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 1);
        assert.equal(game.u.ualign.record, 8);
        assert.equal(game.u.ualign.abuse, 2);
        assert.equal(game.context.move, 1);
    });

test('seed0001 human-werejackal gives same-class conditional rock gasp',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\npeaceful human werejackal\n'
                + '#wizwish\ngold\n#wizwish\ngold\n'
                + '#wizwish\ngold\n#wizwish\ngold\n'
                + '#wizwish\ngold\n#wizwish\ngold\n'
                + '#wizwish\ngold\n#wizwish\ngold\n'
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[196], [
            'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=0', 'rnd(20)=5',
            'rn2(3)=0', 'rn2(5)=0', 'rn2(5)=2',
            'rn2(10)=3', 'rn2(50)=6',
        ], 'seed0001 same-class conditional gasp attack RNG');
        assert.equal(decodedTopline(result.getScreens()[196]),
            'The rock misses the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[196], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[197], [
            'rn2(100)=70', 'rn2(50)=47',
            'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=9',
            'rn2(12)=8', 'rn2(12)=6', 'rn2(70)=33',
            'rn2(400)=142', 'rn2(200)=19', 'rn2(20)=0',
            'rn2(76)=73',
        ], 'seed0001 same-class conditional gasp continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[197]),
            'The werejackal exclaims "Oh my!" and then turns to flee.');
        assert.deepEqual(result.getCursors()[197], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const observer = game.level.monsters.find(monster =>
            monster.mnum === 262 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(observer);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 8,
            hpmax: 8,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            form: observer.mnum,
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            fleeing: observer.mflee ?? 0,
            fleeTime: observer.mfleetim ?? 0,
        }, {
            form: 262,
            hp: 6,
            hpmax: 6,
            peaceful: 0,
            fleeing: 1,
            fleeTime: 30,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 8);
        assert.equal(game.u.ualign.record, 8);
        assert.equal(game.u.ualign.abuse, 2);
        assert.equal(game.context.move, 1);
    });

test('seed0001 forced nonresident shopkeeper follows ordinary rock gasp',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\npeaceful shopkeeper\ny'
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[79], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=0', 'rnd(20)=14',
            'rn2(3)=0', 'rn2(5)=0', 'rn2(5)=2', 'rn2(10)=9',
        ], 'seed0001 nonresident shopkeeper gasp attack RNG');
        assert.equal(decodedTopline(result.getScreens()[79]),
            'The rock misses the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[79], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[80], [
            'rn2(100)=50',
            'rn2(12)=9', 'rn2(12)=8', 'rn2(12)=6',
            'rn2(12)=11', 'rn2(12)=6', 'rn2(70)=69',
            'rn2(400)=380', 'rn2(200)=157', 'rn2(20)=4',
            'rn2(76)=56',
        ], 'seed0001 nonresident shopkeeper gasp continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[80]),
            'The shopkeeper exclaims "Oh my!"');
        assert.deepEqual(result.getCursors()[80], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const observer = game.level.monsters.find(monster =>
            monster.mnum === 271 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(observer);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
        }, {
            hp: 8,
            hpmax: 8,
            peaceful: 0,
        });
        assert.deepEqual({
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            fleeing: observer.mflee ?? 0,
            isshk: observer.isshk ?? 0,
            resident: !!observer.eshk,
            name: observer.name ?? null,
        }, {
            hp: 58,
            hpmax: 58,
            peaceful: 0,
            fleeing: 0,
            isshk: 0,
            resident: false,
            name: null,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 0);
        assert.equal(game.u.ualign.record, 8);
        assert.equal(game.u.ualign.abuse, 2);
        assert.equal(game.context.move, 1);
    });

test('seed0015 resident shopkeeper gasps then shrugs at peaceful rock attack',
    async () => {
        const result = await runSegment({
            seed: 15,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:neutral,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n\u00163\n  x #wizgenesis\npeaceful black unicorn\n'
                + '#wizwish\ngold\n'.repeat(81)
                + '#wizwish\nrock\ntgb ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[1196], [
            'rnd(2)=2', 'rnd(3)=3', 'rn2(3)=2', 'rnd(20)=9',
            'rn2(3)=0', 'rn2(5)=0', 'rn2(5)=2',
        ], 'seed0015 resident shopkeeper shrug attack RNG');
        assert.equal(decodedTopline(result.getScreens()[1196]),
            'The rock misses the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[1196], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[1197], [
            'rn2(100)=64', 'rn2(5)=1', 'rn2(100)=33',
            'rn2(8)=6', 'rn2(100)=51', 'rn2(100)=92',
            'rn2(8)=2', 'rn2(100)=64', 'rn2(100)=90',
            'rn2(100)=17', 'rn2(100)=96', 'rn2(100)=20',
            'rn2(100)=0', 'rn2(100)=71', 'rn2(100)=60',
            'rn2(100)=28', 'rn2(100)=30', 'rn2(100)=87',
            'rn2(100)=74', 'rn2(100)=70', 'rn2(100)=90',
            'rn2(100)=22', 'rn2(100)=11', 'rn2(100)=85',
            'rn2(100)=0', 'rn2(100)=54', 'rn2(100)=30',
            'rn2(100)=52', 'rn2(100)=45', 'rn2(100)=91',
            'rn2(100)=7', 'rn2(100)=64', 'rn2(100)=16',
            'rn2(100)=27', 'rn2(100)=72', 'rn2(100)=8',
            'rn2(100)=28', 'rn2(100)=48', 'rn2(1)=0',
            'rn2(100)=14', 'rn2(2)=1', 'rn2(3)=1',
            'rn2(5)=1', 'rn2(4)=1', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(5)=2', 'rn2(4)=0', 'rn2(1)=0',
            'rn2(5)=2', 'rn2(4)=0', 'rn2(5)=2', 'rn2(5)=2',
            'rn2(5)=1', 'rn2(5)=1', 'rn2(12)=5', 'rn2(12)=4',
            'rn2(12)=8', 'rn2(12)=10', 'rn2(12)=6',
            'rn2(70)=61', 'rn2(400)=362', 'rn2(200)=149',
            'rn2(200)=88', 'rn2(20)=2', 'rn2(67)=3',
        ], 'seed0015 resident shopkeeper shrug continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[1197]),
            'Kopasker exclaims "Oh my!" then shrugs.  Kopasker seems uninterested.');
        assert.deepEqual(result.getCursors()[1197], [14, 8, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === 14 && monster.my === 8);
        const resident = game.level.monsters.find(monster => monster.isshk);
        assert.ok(target);
        assert.ok(resident);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 13,
            hpmax: 13,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: resident.mhp,
            hpmax: resident.mhpmax,
            peaceful: resident.mpeaceful,
            fleeing: resident.mflee ?? 0,
            fleeTime: resident.mfleetim ?? 0,
            isshk: resident.isshk ?? 0,
            name: resident.eshk?.shknam,
            following: resident.eshk?.following ?? 0,
            billct: resident.eshk?.billct ?? 0,
        }, {
            hp: 53,
            hpmax: 53,
            peaceful: 1,
            fleeing: 0,
            fleeTime: 0,
            isshk: 1,
            name: 'Kopasker',
            following: 0,
            billct: 0,
        });
        const landedRocks = (game.level.objects?.[14]?.[8] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(landedRocks[0].no_charge, true);
        assert.equal(landedRocks[0].unpaid ?? false, false);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 81);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0361 cross-aligned temple priest consumes the peaceful observer gate',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\ngold\n'.repeat(4)
            + '#wizwish\nrock\ntlk';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 358);
        assertRngSliceExact(result.getRngSlices()[357], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=1',
            'rnd(20)=15', 'rnd(2)=1',
            'rn2(5)=0',
            'rn2(19)=11', 'rn2(3)=1',
            'rn2(5)=2', 'rn2(15)=3',
            'rn2(3)=0', 'rn2(3)=1', 'rn2(5)=1',
            'rn2(12)=11', 'rn2(12)=6', 'rn2(12)=7', 'rn2(12)=0',
            'rn2(70)=50', 'rn2(3)=0', 'rn2(200)=193',
            'rn2(20)=9', 'rn2(19)=0', 'rn2(73)=1',
        ], 'seed0361 cross-aligned temple-priest attack RNG');
        assert.equal(decodedTopline(result.getScreens()[357]),
            'The rock hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[357], [32, 7, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === 33 && monster.my === 5);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        assert.ok(target);
        assert.ok(priest);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 27,
            hpmax: 28,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            fleeing: priest.mflee ?? 0,
            fleeTime: priest.mfleetim ?? 0,
            ispriest: priest.ispriest ?? 0,
            shralign: priest.epri?.shralign,
        }, {
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            fleeing: 0,
            fleeTime: 0,
            ispriest: 1,
            shralign: 1,
        });
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal((game.level.objects?.[33]?.[5] || [])
            .some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 4);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0361 touchstone projectile shares mineral GEM_CLASS contact',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\ngold\n'.repeat(3)
            + '#wizwish\nrock\ntgk';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 344);
        assertRngSliceExact(result.getRngSlices()[343], [
            'rnd(20)=7', 'rnd(2)=1', 'rn2(5)=0',
            'rn2(19)=8', 'rn2(100)=78',
            'rn2(5)=4', 'rn2(15)=1', 'rn2(3)=1',
            'rn2(3)=1', 'rn2(5)=2',
            'rn2(12)=11', 'rn2(12)=9', 'rn2(12)=9', 'rn2(12)=1',
            'rn2(70)=6', 'rn2(3)=2', 'rn2(200)=118',
            'rn2(20)=15', 'rn2(19)=10', 'rn2(73)=35',
        ], 'seed0361 touchstone projectile attack RNG');
        assert.equal(decodedTopline(result.getScreens()[343]),
            'The touchstone hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[343], [32, 7, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === 33 && monster.my === 5);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const landedTouchstones = game.level.objects?.[33]?.[5]
            ?.filter(object => object.otyp === TOUCHSTONE) || [];
        assert.ok(target);
        assert.ok(priest);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 27,
            hpmax: 28,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            fleeing: priest.mflee ?? 0,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            fleeing: 0,
            level: 15,
            shralign: 1,
        });
        assert.equal(landedTouchstones.length, 1);
        assert.equal(landedTouchstones[0].where, 'floor');
        assert.equal(game.inventory.some(object =>
            object.otyp === TOUCHSTONE), false);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), true);
        assert.equal(game._goldCount, 3);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0361 real-gem wish enters unicorn acceptance and relocation',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nruby\ntlk   ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 305);
        assertRngSliceExact(result.getRngSlices()[298], [
            'rnd(2)=1', 'rn2(6)=5', 'rn2(100)=31',
        ], 'seed0361 ruby wish construction RNG');
        assert.equal(decodedTopline(result.getScreens()[298]),
            'l - a red gem.');
        assert.deepEqual(result.getCursors()[298], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[301], [
            'rn2(3)=2',
        ], 'seed0361 ruby cross-aligned acceptance RNG');
        assert.equal(decodedTopline(result.getScreens()[301]),
            'The black unicorn catches the red gem.--More--');
        assert.deepEqual(result.getCursors()[301], [46, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[302], [
            'rnd(79)=40', 'rn2(21)=17',
            'rnd(79)=74', 'rn2(21)=11',
            'rnd(79)=66', 'rn2(21)=10',
            'rnd(79)=39', 'rn2(21)=20',
            'rnd(79)=47', 'rn2(21)=2',
            'rnd(79)=5', 'rn2(21)=15',
        ], 'seed0361 ruby relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[302]),
            'The black unicorn hesitatingly accepts your gift.--More--');
        assert.deepEqual(result.getCursors()[302], [57, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[303], [
            'rn2(5)=1', 'rn2(15)=10', 'rn2(3)=1',
            'rn2(3)=1', 'rn2(5)=2',
            'rn2(12)=9', 'rn2(12)=9', 'rn2(12)=1', 'rn2(12)=6',
            'rn2(70)=51', 'rn2(3)=0', 'rn2(200)=35',
            'rn2(20)=12', 'rn2(19)=18', 'rn2(73)=33',
        ], 'seed0361 ruby vanish and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[303]),
            'The black unicorn vanishes!');
        assert.deepEqual(result.getCursors()[303], [32, 7, 1]);
        assertRngSliceExact(result.getRngSlices()[304], [],
            'seed0361 ruby sentinel RNG');
        assert.equal(decodedTopline(result.getScreens()[304]),
            "Unknown command ' '.");

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const carriedRuby = unicorn?.minvent?.find(object =>
            object.otyp === RUBY);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(carriedRuby);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            avenge: unicorn.mavenge ?? 0,
            sleeping: unicorn.msleeping ?? 0,
            canmove: unicorn.mcanmove,
        }, {
            x: 5,
            y: 15,
            hp: 28,
            hpmax: 28,
            peaceful: 1,
            tame: 0,
            avenge: 0,
            sleeping: 0,
            canmove: 1,
        });
        assert.deepEqual({
            otyp: carriedRuby.otyp,
            where: carriedRuby.where,
            ox: carriedRuby.ox,
            oy: carriedRuby.oy,
            dknown: carriedRuby.dknown,
            name: carriedRuby.name,
        }, {
            otyp: RUBY,
            where: 'minvent',
            ox: 0,
            oy: 0,
            dknown: true,
            name: 'red gem',
        });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal((game.level.objects?.[33]?.[5] || [])
            .some(object => object.otyp === RUBY), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            level: 15,
            shralign: 1,
        });
        assert.equal(game.u.uluck, 1);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 co-aligned real-gem wish omits the hesitant Luck draw',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful gray unicorn\n'
            + '#wizwish\nruby\ntlk   ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 304);
        assert.equal(decodedTopline(result.getScreens()[283]),
            'A gray unicorn appears next to you.');
        assert.equal(decodeScreen(result.getScreens()[283])[6][32].color, 8);

        assertRngSliceExact(result.getRngSlices()[297], [
            'rnd(2)=1', 'rn2(6)=5', 'rn2(100)=57',
        ], 'seed0361 co-aligned ruby wish RNG');
        assert.equal(decodedTopline(result.getScreens()[297]),
            'l - a red gem.');
        assert.deepEqual(result.getCursors()[297], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[300], [],
            'seed0361 co-aligned ruby acceptance RNG');
        assert.equal(decodedTopline(result.getScreens()[300]),
            'The gray unicorn catches the red gem.--More--');
        assert.deepEqual(result.getCursors()[300], [45, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[301], [
            'rnd(79)=68', 'rn2(21)=11',
        ], 'seed0361 co-aligned ruby relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[301]),
            'The gray unicorn gratefully accepts your gift.--More--');
        assert.deepEqual(result.getCursors()[301], [54, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[302], [
            'rn2(5)=0', 'rn2(15)=1', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(5)=0',
            'rn2(12)=10', 'rn2(12)=6', 'rn2(12)=10', 'rn2(12)=1',
            'rn2(70)=67', 'rn2(3)=1', 'rn2(200)=27',
            'rn2(20)=13', 'rn2(19)=14', 'rn2(73)=43',
        ], 'seed0361 co-aligned ruby vanish and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[302]),
            'The gray unicorn vanishes!');
        assert.deepEqual(result.getCursors()[302], [32, 7, 1]);
        assertRngSliceExact(result.getRngSlices()[303], [],
            'seed0361 co-aligned ruby sentinel RNG');

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 102);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const carriedRuby = unicorn?.minvent?.find(object =>
            object.otyp === RUBY);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(carriedRuby);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            avenge: unicorn.mavenge ?? 0,
            sleeping: unicorn.msleeping ?? 0,
            canmove: unicorn.mcanmove,
        }, {
            x: 68,
            y: 11,
            hp: 28,
            hpmax: 28,
            peaceful: 1,
            tame: 0,
            avenge: 0,
            sleeping: 0,
            canmove: 1,
        });
        assert.equal(carriedRuby.where, 'minvent');
        assert.equal(carriedRuby.name, 'red gem');
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal((game.level.objects?.[33]?.[5] || [])
            .some(object => object.otyp === RUBY), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 36,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            level: 15,
            shralign: 1,
        });
        assert.equal(game.u.uluck, 1);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 tame unicorn catches and drops real-gem projectile',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\ntame black unicorn\n'
            + '#wizwish\nruby\ntlk   ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 301);
        assertRngSliceExact(result.getRngSlices()[280],
            SEED0361_BLACK_UNICORN_GENESIS_RNG,
            'seed0361 tame black unicorn genesis RNG');
        assert.equal(decodedTopline(result.getScreens()[280]),
            'A black unicorn appears next to you.');
        assert.equal(decodeScreen(result.getScreens()[280])[6][32].color, 8);
        assert.deepEqual(result.getCursors()[280], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[294],
            SEED0361_UNKNOWN_RUBY_WISH_RNG,
            'seed0361 tame-unicorn ruby wish RNG');
        assert.equal(decodedTopline(result.getScreens()[294]),
            'l - a red gem.');

        assertRngSliceExact(result.getRngSlices()[297],
            SEED0361_REAL_GEM_LANDING_SCHEDULER_RNG,
            'seed0361 tame-unicorn catch/drop and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[297]),
            'The black unicorn catches and drops the red gem.');
        assert.deepEqual(result.getCursors()[297], [32, 7, 1]);
        for (const input of [298, 299, 300]) {
            assertRngSliceExact(result.getRngSlices()[input], [],
                `seed0361 tame-unicorn sentinel ${input} RNG`);
            assert.equal(decodedTopline(result.getScreens()[input]),
                "Unknown command ' '.");
        }

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const floorRuby = game.level.objects?.[33]?.[5]?.find(object =>
            object.otyp === RUBY);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(floorRuby);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            level: unicorn.m_lev,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame,
            pet: unicorn.pet,
            avenge: unicorn.mavenge,
            sleeping: unicorn.msleeping,
            canmove: unicorn.mcanmove,
            fleeing: unicorn.mflee,
            inventory: unicorn.minvent || [],
        }, {
            x: 33,
            y: 5,
            hp: 28,
            hpmax: 28,
            level: 6,
            peaceful: 1,
            tame: 5,
            pet: true,
            avenge: 0,
            sleeping: 0,
            canmove: 1,
            fleeing: 0,
            inventory: [],
        });
        assert.deepEqual({
            droptime: unicorn.edog?.droptime,
            dropdist: unicorn.edog?.dropdist,
            apport: unicorn.edog?.apport,
            whistletime: unicorn.edog?.whistletime,
            hungrytime: unicorn.edog?.hungrytime,
            ogoal: unicorn.edog?.ogoal,
            abuse: unicorn.edog?.abuse,
        }, {
            droptime: 0,
            dropdist: 10000,
            apport: 10,
            whistletime: 0,
            hungrytime: 1029,
            ogoal: { x: -1, y: -1 },
            abuse: 0,
        });
        assert.equal(unicorn.edog?.parentmid, unicorn.m_id);
        assert.deepEqual({
            otyp: floorRuby.otyp,
            where: floorRuby.where,
            x: floorRuby.ox,
            y: floorRuby.oy,
            dknown: floorRuby.dknown,
            name: floorRuby.name,
        }, {
            otyp: RUBY,
            where: 'floor',
            x: 33,
            y: 5,
            dknown: true,
            name: 'red gem',
        });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            level: 15,
            shralign: 1,
        });
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.u.uconduct.pets, 2);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 helpless sleeping unicorn misses real-gem projectile',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\nsleeping black unicorn\n'
            + '#wizwish\nruby\ntlk   ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 305);
        assertRngSliceExact(result.getRngSlices()[284],
            SEED0361_BLACK_UNICORN_GENESIS_RNG,
            'seed0361 sleeping black unicorn genesis RNG');
        assert.equal(decodedTopline(result.getScreens()[284]),
            'A black unicorn appears next to you.');
        assert.deepEqual(result.getCursors()[284], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[298],
            SEED0361_UNKNOWN_RUBY_WISH_RNG,
            'seed0361 helpless-unicorn ruby wish RNG');
        assert.equal(decodedTopline(result.getScreens()[298]),
            'l - a red gem.');

        assertRngSliceExact(result.getRngSlices()[301],
            SEED0361_REAL_GEM_LANDING_SCHEDULER_RNG,
            'seed0361 helpless-unicorn miss and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[301]),
            'The red gem misses the black unicorn.');
        assert.deepEqual(result.getCursors()[301], [32, 7, 1]);
        for (const input of [302, 303, 304]) {
            assertRngSliceExact(result.getRngSlices()[input], [],
                `seed0361 helpless-unicorn sentinel ${input} RNG`);
            assert.equal(decodedTopline(result.getScreens()[input]),
                "Unknown command ' '.");
        }

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const floorRuby = game.level.objects?.[33]?.[5]?.find(object =>
            object.otyp === RUBY);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(floorRuby);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            level: unicorn.m_lev,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            pet: !!unicorn.pet,
            sleeping: unicorn.msleeping,
            canmove: unicorn.mcanmove,
            fleeing: unicorn.mflee ?? 0,
            inventory: unicorn.minvent || [],
            edog: unicorn.edog ?? null,
        }, {
            x: 33,
            y: 5,
            hp: 28,
            hpmax: 28,
            level: 6,
            peaceful: 0,
            tame: 0,
            pet: false,
            sleeping: 1,
            canmove: 1,
            fleeing: 0,
            inventory: [],
            edog: null,
        });
        assert.deepEqual({
            otyp: floorRuby.otyp,
            where: floorRuby.where,
            x: floorRuby.ox,
            y: floorRuby.oy,
            dknown: floorRuby.dknown,
            name: floorRuby.name,
        }, {
            otyp: RUBY,
            where: 'floor',
            x: 33,
            y: 5,
            dknown: true,
            name: 'red gem',
        });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            level: 15,
            shralign: 1,
        });
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.u.uconduct.pets, 1);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 unknown red-glass wish enters gracious unicorn acceptance',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nworthless piece of red glass\ntlk   ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 329);
        assertRngSliceExact(result.getRngSlices()[284],
            SEED0361_BLACK_UNICORN_GENESIS_RNG,
            'seed0361 red-glass black unicorn genesis RNG');
        assert.equal(decodedTopline(result.getScreens()[284]),
            'A black unicorn appears next to you.');

        assertRngSliceExact(result.getRngSlices()[322], [
            'rn2(78)=6', 'rnd(2)=2', 'rn2(6)=1', 'rn2(100)=31',
        ], 'seed0361 unknown red-glass wish RNG');
        assert.equal(decodedTopline(result.getScreens()[322]),
            'l - a red gem.');
        assert.deepEqual(result.getCursors()[322], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[325], [],
            'seed0361 unknown red-glass catch RNG');
        assert.equal(decodedTopline(result.getScreens()[325]),
            'The black unicorn catches the red gem.--More--');
        assert.deepEqual(result.getCursors()[325], [46, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[326], [
            'rnd(79)=40', 'rn2(21)=17',
            'rnd(79)=74', 'rn2(21)=11',
            'rnd(79)=66', 'rn2(21)=10',
            'rnd(79)=39', 'rn2(21)=20',
            'rnd(79)=47', 'rn2(21)=2',
            'rnd(79)=5', 'rn2(21)=15',
        ], 'seed0361 unknown red-glass relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[326]),
            'The black unicorn graciously accepts your gift.--More--');
        assert.deepEqual(result.getCursors()[326], [55, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[327], [
            'rn2(5)=1', 'rn2(15)=10', 'rn2(3)=1',
            'rn2(3)=1', 'rn2(5)=2',
            'rn2(12)=9', 'rn2(12)=9', 'rn2(12)=1', 'rn2(12)=6',
            'rn2(70)=51', 'rn2(3)=0', 'rn2(200)=35',
            'rn2(20)=12', 'rn2(19)=18', 'rn2(73)=33',
        ], 'seed0361 unknown red-glass vanish and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[327]),
            'The black unicorn vanishes!');
        assert.deepEqual(result.getCursors()[327], [32, 7, 1]);
        assertRngSliceExact(result.getRngSlices()[328], [],
            'seed0361 unknown red-glass sentinel RNG');

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const carriedGlass = unicorn?.minvent?.find(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(carriedGlass);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            avenge: unicorn.mavenge ?? 0,
            sleeping: unicorn.msleeping ?? 0,
            canmove: unicorn.mcanmove,
        }, {
            x: 5,
            y: 15,
            hp: 28,
            hpmax: 28,
            peaceful: 1,
            tame: 0,
            avenge: 0,
            sleeping: 0,
            canmove: 1,
        });
        assert.deepEqual({
            otyp: carriedGlass.otyp,
            where: carriedGlass.where,
            ox: carriedGlass.ox,
            oy: carriedGlass.oy,
            dknown: carriedGlass.dknown,
            typeKnown: carriedGlass.typeKnown ?? false,
            name: carriedGlass.name,
        }, {
            otyp: WORTHLESS_PIECE_OF_RED_GLASS,
            where: 'minvent',
            ox: 0,
            oy: 0,
            dknown: true,
            typeKnown: false,
            name: 'red gem',
        });
        assert.equal(game.inventory.some(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS), false);
        assert.equal((game.level.objects?.[33]?.[5] || []).some(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            level: 15,
            shralign: 1,
        });
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 named red-glass wish is rejected after unicorn relocation',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nworthless piece of red glass\n'
            + '#name\niljunk\ntlk     ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 344);
        assertRngSliceExact(result.getRngSlices()[284],
            SEED0361_BLACK_UNICORN_GENESIS_RNG,
            'seed0361 named-glass black unicorn genesis RNG');
        assert.equal(decodedTopline(result.getScreens()[284]),
            'A black unicorn appears next to you.');

        assertRngSliceExact(result.getRngSlices()[322], [
            'rn2(78)=6', 'rnd(2)=2', 'rn2(6)=1', 'rn2(100)=31',
        ], 'seed0361 named red-glass wish RNG');
        assert.equal(decodedTopline(result.getScreens()[322]),
            'l - a red gem.');

        assertRngSliceExact(result.getRngSlices()[329], [],
            'seed0361 named red-glass inventory prompt RNG');
        assert.equal(decodedTopline(result.getScreens()[329]),
            'What do you want to name? [a-hj-l or ?*]');
        assert.deepEqual(result.getCursors()[329], [41, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[330], [],
            'seed0361 named red-glass object prompt RNG');
        assert.equal(decodedTopline(result.getScreens()[330]),
            'What do you want to name this red gem?');
        assert.deepEqual(result.getCursors()[330], [39, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[338], [],
            'seed0361 named red-glass catch RNG');
        assert.equal(decodedTopline(result.getScreens()[338]),
            'The black unicorn catches the red gem named junk.--More--');
        assert.deepEqual(result.getCursors()[338], [57, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[339], [
            'rnd(79)=40', 'rn2(21)=17',
            'rnd(79)=74', 'rn2(21)=11',
            'rnd(79)=66', 'rn2(21)=10',
            'rnd(79)=39', 'rn2(21)=20',
            'rnd(79)=47', 'rn2(21)=2',
            'rnd(79)=5', 'rn2(21)=15',
        ], 'seed0361 named red-glass rejection relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[339]),
            'The black unicorn is not interested in your junk.--More--');
        assert.deepEqual(result.getCursors()[339], [57, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[340], [
            'rn2(100)=46',
            'rn2(5)=0', 'rn2(15)=7', 'rn2(3)=1',
            'rn2(3)=2', 'rn2(5)=3',
            'rn2(12)=9', 'rn2(12)=1', 'rn2(12)=6', 'rn2(12)=11',
            'rn2(70)=28', 'rn2(3)=1', 'rn2(200)=152',
            'rn2(20)=10', 'rn2(19)=8', 'rn2(73)=42',
        ], 'seed0361 named red-glass landing and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[340]),
            'The black unicorn vanishes!');
        assert.deepEqual(result.getCursors()[340], [32, 7, 1]);
        for (const input of [341, 342, 343]) {
            assertRngSliceExact(result.getRngSlices()[input], [],
                `seed0361 named red-glass sentinel ${input} RNG`);
            assert.equal(decodedTopline(result.getScreens()[input]),
                "Unknown command ' '.");
        }

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const floorGlass = game.level.objects?.[33]?.[5]?.find(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(floorGlass);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            avenge: unicorn.mavenge ?? 0,
            sleeping: unicorn.msleeping ?? 0,
            canmove: unicorn.mcanmove,
            inventory: unicorn.minvent || [],
        }, {
            x: 5,
            y: 15,
            hp: 28,
            hpmax: 28,
            peaceful: 1,
            tame: 0,
            avenge: 0,
            sleeping: 0,
            canmove: 1,
            inventory: [],
        });
        assert.deepEqual({
            otyp: floorGlass.otyp,
            where: floorGlass.where,
            x: floorGlass.ox,
            y: floorGlass.oy,
            dknown: floorGlass.dknown,
            typeKnown: floorGlass.typeKnown ?? false,
            oname: floorGlass.oextra?.oname || floorGlass.oname || null,
            name: floorGlass.name,
        }, {
            otyp: WORTHLESS_PIECE_OF_RED_GLASS,
            where: 'floor',
            x: 33,
            y: 5,
            dknown: true,
            typeKnown: false,
            oname: 'junk',
            name: 'red gem',
        });
        assert.equal(game.inventory.some(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            peaceful: priest.mpeaceful,
            level: priest.m_lev,
            shralign: priest.epri?.shralign,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
            peaceful: 1,
            level: 15,
            shralign: 1,
        });
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 known red-glass wish rejects after Wizard identify',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nworthless piece of red glass\n'
            + '#wizidentify\nl\ntlk     ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 346);
        assertRngSliceExact(result.getRngSlices()[284],
            SEED0361_BLACK_UNICORN_GENESIS_RNG,
            'seed0361 known-glass black unicorn genesis RNG');
        assertRngSliceExact(result.getRngSlices()[322], [
            'rn2(78)=6', 'rnd(2)=2', 'rn2(6)=1', 'rn2(100)=31',
        ], 'seed0361 known red-glass wish RNG');

        assertRngSliceExact(result.getRngSlices()[335], [],
            'seed0361 known red-glass identify menu RNG');
        const identifyMenu = decodeScreen(result.getScreens()[335]);
        assert.deepEqual(identifyMenu.slice(0, 11).map(row =>
            row.slice(12).map(cell => cell.ch).join('').trimEnd()), [
            'Debug Identify -- unidentified or partially identified items',
            '_ - select any or all of them to permanently identify (^I for all)',
            'Amulets',
            'k - a blessed amulet of life saving (being worn)',
            'Weapons',
            'i - the blessed +5 Grayswandir (weapon in right hand)',
            'Armor',
            'j - a blessed +5 silver dragon scale mail (being worn)',
            'Gems/Stones',
            'l - an uncursed worthless piece of red glass',
            '(end)',
        ]);
        assert.equal(identifyMenu[0][12].attr, 0);
        for (const row of [2, 4, 6, 8])
            assert.equal(identifyMenu[row][12].attr, 1);
        assert.deepEqual(result.getCursors()[335], [18, 10, 1]);

        assertRngSliceExact(result.getRngSlices()[336], [],
            'seed0361 known red-glass identify selection RNG');
        assert.equal(decodeScreen(result.getScreens()[336])[9]
            .slice(12).map(cell => cell.ch).join('').trimEnd(),
        'l + an uncursed worthless piece of red glass');
        assert.deepEqual(result.getCursors()[336], [18, 10, 1]);

        assertRngSliceExact(result.getRngSlices()[337], ['rn2(19)=6'],
            'seed0361 known red-glass identify commit RNG');
        assert.equal(decodedTopline(result.getScreens()[337]),
            'l - an uncursed worthless piece of red glass.');
        assert.deepEqual(result.getCursors()[337], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[340], [],
            'seed0361 known red-glass catch RNG');
        assert.equal(decodedTopline(result.getScreens()[340]),
            'The black unicorn catches the worthless piece of red glass.--More--');
        assert.deepEqual(result.getCursors()[340], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[341], [
            'rnd(79)=22', 'rn2(21)=12',
            'rnd(79)=68', 'rn2(21)=11',
        ], 'seed0361 known red-glass rejection relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[341]),
            'The black unicorn is not interested in your junk.--More--');
        assert.deepEqual(result.getCursors()[341], [57, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[342], [
            'rn2(100)=45',
            'rn2(5)=1', 'rn2(15)=11', 'rn2(3)=1',
            'rn2(3)=2', 'rn2(5)=3',
            'rn2(12)=6', 'rn2(12)=10', 'rn2(12)=1', 'rn2(12)=1',
            'rn2(70)=37', 'rn2(3)=2', 'rn2(200)=193',
            'rn2(20)=9', 'rn2(19)=1', 'rn2(73)=66',
        ], 'seed0361 known red-glass landing and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[342]),
            'The black unicorn vanishes!');
        assert.deepEqual(result.getCursors()[342], [32, 7, 1]);
        for (const input of [343, 344, 345]) {
            assertRngSliceExact(result.getRngSlices()[input], [],
                `seed0361 known red-glass sentinel ${input} RNG`);
            assert.equal(decodedTopline(result.getScreens()[input]),
                "Unknown command ' '.");
        }

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const floorGlass = game.level.objects?.[33]?.[5]?.find(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(floorGlass);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            inventory: unicorn.minvent || [],
        }, {
            x: 68,
            y: 11,
            hp: 28,
            hpmax: 28,
            peaceful: 1,
            tame: 0,
            inventory: [],
        });
        assert.deepEqual({
            otyp: floorGlass.otyp,
            where: floorGlass.where,
            x: floorGlass.ox,
            y: floorGlass.oy,
            typeKnown: floorGlass.typeKnown,
            known: floorGlass.known,
            dknown: floorGlass.dknown,
            bknown: floorGlass.bknown,
            rknown: floorGlass.rknown,
            name: floorGlass.name,
        }, {
            otyp: WORTHLESS_PIECE_OF_RED_GLASS,
            where: 'floor',
            x: 33,
            y: 5,
            typeKnown: true,
            known: true,
            dknown: true,
            bknown: true,
            rknown: true,
            name: 'red gem',
        });
        assert.equal(game._knownObjectTypes.has(
            WORTHLESS_PIECE_OF_RED_GLASS), true);
        assert.equal(game.inventory.some(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS), false);
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
        }, {
            x: 35,
            y: 5,
            hp: 69,
            hpmax: 69,
        });
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(game.u._exercise?.[4] ?? 0, 0);
        assert.equal(game.u.ualign.type, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game._goldCount, 0);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 called red-glass wish rejects through global type name',
    async () => {
        const publicSession = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0361-archeologist-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = publicSession.moves.slice(0, 220)
            + '\u0014  ' + 'l'.repeat(21) + 'kk.  '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nworthless piece of red glass\n'
            + '#name\noljunk\ntlk     ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...publicSession, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 344);
        assertRngSliceExact(result.getRngSlices()[322], [
            'rn2(78)=6', 'rnd(2)=2', 'rn2(6)=1', 'rn2(100)=31',
        ], 'seed0361 called red-glass wish RNG');

        assertRngSliceExact(result.getRngSlices()[329], [],
            'seed0361 called red-glass selection prompt RNG');
        assert.equal(decodedTopline(result.getScreens()[329]),
            'What do you want to call? [kl or ?*]');
        assert.deepEqual(result.getCursors()[329], [37, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[330], [],
            'seed0361 called red-glass editor prompt RNG');
        assert.equal(decodedTopline(result.getScreens()[330]),
            'Call a red gem:');
        assert.deepEqual(result.getCursors()[330], [16, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[334], [],
            'seed0361 called red-glass editor text RNG');
        assert.equal(decodedTopline(result.getScreens()[334]),
            'Call a red gem: junk');
        assert.deepEqual(result.getCursors()[334], [20, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[335], [],
            'seed0361 called red-glass commit RNG');
        assert.equal(decodedTopline(result.getScreens()[335]), '');
        assert.deepEqual(result.getCursors()[335], [32, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[338], [],
            'seed0361 called red-glass catch RNG');
        assert.equal(decodedTopline(result.getScreens()[338]),
            'The black unicorn catches the gem called junk.--More--');
        assert.deepEqual(result.getCursors()[338], [54, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[339], [
            'rnd(79)=40', 'rn2(21)=17',
            'rnd(79)=74', 'rn2(21)=11',
            'rnd(79)=66', 'rn2(21)=10',
            'rnd(79)=39', 'rn2(21)=20',
            'rnd(79)=47', 'rn2(21)=2',
            'rnd(79)=5', 'rn2(21)=15',
        ], 'seed0361 called red-glass rejection relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[339]),
            'The black unicorn is not interested in your junk.--More--');
        assert.deepEqual(result.getCursors()[339], [57, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[340], [
            'rn2(100)=46',
            'rn2(5)=0', 'rn2(15)=7', 'rn2(3)=1',
            'rn2(3)=2', 'rn2(5)=3',
            'rn2(12)=9', 'rn2(12)=1', 'rn2(12)=6', 'rn2(12)=11',
            'rn2(70)=28', 'rn2(3)=1', 'rn2(200)=152',
            'rn2(20)=10', 'rn2(19)=8', 'rn2(73)=42',
        ], 'seed0361 called red-glass landing and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[340]),
            'The black unicorn vanishes!');
        for (const input of [341, 342, 343]) {
            assertRngSliceExact(result.getRngSlices()[input], [],
                `seed0361 called red-glass sentinel ${input} RNG`);
            assert.equal(decodedTopline(result.getScreens()[input]),
                "Unknown command ' '.");
        }

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        const floorGlass = game.level.objects?.[33]?.[5]?.find(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS);
        assert.ok(unicorn);
        assert.ok(priest);
        assert.ok(floorGlass);
        assert.equal(game._objectCallNames?.[
            WORTHLESS_PIECE_OF_RED_GLASS], 'junk');
        assert.equal(game._knownObjectTypes?.has(
            WORTHLESS_PIECE_OF_RED_GLASS) ?? false, false);
        assert.deepEqual({
            x: unicorn.mx,
            y: unicorn.my,
            inventory: unicorn.minvent || [],
        }, {
            x: 5,
            y: 15,
            inventory: [],
        });
        assert.deepEqual({
            where: floorGlass.where,
            x: floorGlass.ox,
            y: floorGlass.oy,
            dknown: floorGlass.dknown,
            typeKnown: floorGlass.typeKnown ?? false,
            oname: floorGlass.oextra?.oname || floorGlass.oname || null,
            name: floorGlass.name,
        }, {
            where: 'floor',
            x: 33,
            y: 5,
            dknown: true,
            typeKnown: false,
            oname: null,
            name: 'red gem',
        });
        assert.equal(game.inventory.some(object =>
            object.otyp === WORTHLESS_PIECE_OF_RED_GLASS), false);
        assert.deepEqual({ x: priest.mx, y: priest.my }, { x: 35, y: 5 });
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(game.u.ualign.record, 10);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 30);
    });

test('seed0361 co-aligned priest gasps then drinks gain-level potion',
    async () => {
        const moves = '  n#levelchange\n20\n' + ' '.repeat(20)
            + '\u001618\n\u0014  ' + 'h'.repeat(20) + '.   '
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\ngold\n#wizwish\ngold\n'
            + '#wizwish\nrock\ntik   ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 361,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:Magellan,role:Archeologist,race:human,gender:male,align:lawful,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 154);
        assertRngSliceExact(result.getRngSlices()[150], [
            'rnd(2)=1', 'rnd(3)=2', 'rn2(3)=0', 'rnd(20)=13',
            'rnd(2)=2', 'rn2(5)=0', 'rn2(5)=1',
        ], 'seed0361 co-aligned priest attack RNG');
        assert.equal(decodedTopline(result.getScreens()[150]),
            'The rock hits the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[150], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[151], [
            'rn2(19)=3', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(5)=3', 'rn2(5)=0', 'rn2(5)=3',
            'rn2(5)=1', 'rn2(5)=1',
        ], 'seed0361 co-aligned priest gasp continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[151]),
            'The priestess of Quetzalcoatl exclaims "Uh-oh." then shrugs.--More--');
        assert.deepEqual(result.getCursors()[151], [68, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[152], [],
            'seed0361 co-aligned priest potion pager RNG');
        assert.equal(decodedTopline(result.getScreens()[152]),
            'The priestess of Quetzalcoatl drinks a purple-red potion!--More--');
        assert.deepEqual(result.getCursors()[152], [65, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[153], [
            'rn2(19)=5', 'rnd(8)=1',
            'rn2(12)=3', 'rn2(12)=9', 'rn2(12)=0',
            'rn2(12)=1', 'rn2(12)=8', 'rn2(70)=3',
            'rn2(3)=2', 'rnl(7)=5', 'rn2(400)=299',
            'rn2(200)=53', 'rn2(20)=4', 'rn2(64)=30',
        ], 'seed0361 co-aligned priest growth continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[153]),
            'The priestess of Quetzalcoatl seems more experienced.');
        assert.deepEqual(result.getCursors()[153], [11, 6, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === 12 && monster.my === 4);
        const priest = game.level.monsters.find(monster => monster.ispriest);
        assert.ok(target);
        assert.ok(priest);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 22,
            hpmax: 24,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            x: priest.mx,
            y: priest.my,
            hp: priest.mhp,
            hpmax: priest.mhpmax,
            level: priest.m_lev,
            peaceful: priest.mpeaceful,
            fleeing: priest.mflee ?? 0,
            ispriest: priest.ispriest ?? 0,
            shralign: priest.epri?.shralign,
        }, {
            x: 11,
            y: 4,
            hp: 70,
            hpmax: 70,
            level: 16,
            peaceful: 1,
            fleeing: 0,
            ispriest: 1,
            shralign: 1,
        });
        assert.equal(priest.minvent.some(object =>
            object.otyp === POT_GAIN_LEVEL), false);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal((game.level.objects?.[12]?.[4] || [])
            .some(object => object.otyp === ROCK), false);
        assert.equal(game._knownObjectTypes.has(POT_GAIN_LEVEL), true);
        assert.equal(game._goldCount, 2);
        assert.equal(game.u.ualign.type, 1);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0001 watchman arrests hero after peaceful rock attack', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizgenesis\nblack unicorn\n'
            + '#wizgenesis\nwatchman\n'
            + '#wizwish\ngold\n'
            + '#wizwish\nrock\ntgl ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[81], [
        'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rnd(20)=5',
        'rn2(3)=0',
    ], 'seed0001 watch arrest attack RNG');
    assert.equal(decodedTopline(result.getScreens()[81]),
        'The rock misses the black unicorn.  The black unicorn neighs!--More--');
    assert.deepEqual(result.getCursors()[81], [69, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[82], [
        'rn2(100)=80',
        'rn2(12)=4', 'rn2(12)=3', 'rn2(12)=4',
        'rn2(12)=9', 'rn2(12)=10', 'rn2(70)=56',
        'rn2(400)=97', 'rn2(200)=3', 'rn2(20)=9',
        'rn2(76)=0', 'rnd(3)=3',
    ], 'seed0001 watch arrest continuation RNG');
    assert.equal(decodedTopline(result.getScreens()[82]),
        '"Halt!  You\'re under arrest!"  The guard gets angry!');
    assert.deepEqual(result.getCursors()[82], [52, 9, 1]);

    const target = game.level.monsters.find(monster =>
        monster.mnum === 103 && monster.mx === game.u.ux + 1
            && monster.my === game.u.uy);
    const watchman = game.level.monsters.find(monster =>
        monster.mnum === 282 && monster.mx === game.u.ux - 1
            && monster.my === game.u.uy);
    assert.ok(target);
    assert.ok(watchman);
    assert.deepEqual({
        hp: target.mhp,
        hpmax: target.mhpmax,
        peaceful: target.mpeaceful,
        fleeing: target.mflee ?? 0,
    }, {
        hp: 8,
        hpmax: 8,
        peaceful: 0,
        fleeing: 0,
    });
    assert.deepEqual({
        hp: watchman.mhp,
        hpmax: watchman.mhpmax,
        peaceful: watchman.mpeaceful,
        sleeping: watchman.msleeping ?? 0,
        canmove: watchman.mcanmove,
        frozen: watchman.mfrozen ?? 0,
        fleeing: watchman.mflee ?? 0,
    }, {
        hp: 23,
        hpmax: 23,
        peaceful: 0,
        sleeping: 0,
        canmove: 1,
        frozen: 0,
        fleeing: 0,
    });
    const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(landedRocks.length, 1);
    assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
    assert.equal(landedRocks[0].where, 'floor');
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game._goldCount, 1);
    assert.equal(game.u.ualign.record, 9);
    assert.equal(game.u.ualign.abuse, 1);
    assert.equal(game.context.move, 1);
});

test('seed0001 two watchmen share one plural rock arrest', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizgenesis\nblack unicorn\n'
            + '#wizgenesis\nwatchman\n'
            + '#wizgenesis\nwatchman\n'
            + '#wizwish\ngold\n'.repeat(4)
            + '#wizwish\nrock\ntgl ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[144], [
        'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=2', 'rnd(20)=12',
        'rn2(3)=0',
    ], 'seed0001 plural watch arrest attack RNG');
    assert.equal(decodedTopline(result.getScreens()[144]),
        'The rock misses the black unicorn.  The black unicorn neighs!--More--');
    assert.deepEqual(result.getCursors()[144], [69, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[145], [
        'rn2(100)=81',
        'rn2(12)=2', 'rn2(12)=2', 'rn2(12)=1',
        'rn2(12)=5', 'rn2(12)=4', 'rn2(12)=11',
        'rn2(70)=67', 'rn2(400)=254', 'rn2(200)=29',
        'rn2(20)=8', 'rn2(76)=73',
    ], 'seed0001 plural watch arrest continuation RNG');
    assert.equal(decodedTopline(result.getScreens()[145]),
        '"Halt!  You\'re under arrest!"  The guards get angry!');
    assert.deepEqual(result.getCursors()[145], [52, 9, 1]);

    const target = game.level.monsters.find(monster =>
        monster.mnum === 103 && monster.mx === game.u.ux + 1
            && monster.my === game.u.uy);
    const watchmen = game.level.monsters
        .filter(monster => monster.mnum === 282)
        .sort((left, right) => left.m_id - right.m_id);
    assert.ok(target);
    assert.equal(watchmen.length, 2);
    assert.deepEqual({
        hp: target.mhp,
        hpmax: target.mhpmax,
        peaceful: target.mpeaceful,
        fleeing: target.mflee ?? 0,
    }, {
        hp: 8,
        hpmax: 8,
        peaceful: 0,
        fleeing: 0,
    });
    assert.deepEqual(watchmen.map(watchman => ({
        x: watchman.mx - game.u.ux,
        y: watchman.my - game.u.uy,
        hp: watchman.mhp,
        hpmax: watchman.mhpmax,
        peaceful: watchman.mpeaceful,
        sleeping: watchman.msleeping ?? 0,
        canmove: watchman.mcanmove,
        frozen: watchman.mfrozen ?? 0,
        fleeing: watchman.mflee ?? 0,
    })), [{
        x: -1,
        y: 0,
        hp: 23,
        hpmax: 23,
        peaceful: 0,
        sleeping: 0,
        canmove: 1,
        frozen: 0,
        fleeing: 0,
    }, {
        x: 0,
        y: -1,
        hp: 15,
        hpmax: 15,
        peaceful: 0,
        sleeping: 0,
        canmove: 1,
        frozen: 0,
        fleeing: 0,
    }]);
    const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(landedRocks.length, 1);
    assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
    assert.equal(landedRocks[0].where, 'floor');
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game._goldCount, 4);
    assert.equal(game.u.ualign.record, 9);
    assert.equal(game.u.ualign.abuse, 1);
    assert.equal(game.context.move, 1);
});

test('seed0001 unicorn growl wakes watchman before plural rock arrest',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\nsleeping watchman\n'
                + '#wizgenesis\nwatchman\n'
                + '#wizwish\ngold\n'.repeat(4)
                + '#wizwish\nrock\ntgl  ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[153], [
            'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=2', 'rnd(20)=12',
            'rn2(3)=0',
        ], 'seed0001 sleeping watch attack RNG');
        assert.equal(decodedTopline(result.getScreens()[153]),
            'The rock misses the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[153], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[154], [],
            'seed0001 growl wake and arrest continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[154]),
            'The watchman wakes up.  "Halt!  You\'re under arrest!"--More--');
        assert.deepEqual(result.getCursors()[154], [61, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[155], [
            'rn2(100)=81',
            'rn2(12)=2', 'rn2(12)=2', 'rn2(12)=1',
            'rn2(12)=5', 'rn2(12)=4', 'rn2(12)=11',
            'rn2(70)=67', 'rn2(400)=254', 'rn2(200)=29',
            'rn2(20)=8', 'rn2(76)=73',
        ], 'seed0001 post-wake plural arrest continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[155]),
            'The guards get angry!');
        assert.deepEqual(result.getCursors()[155], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const watchmen = game.level.monsters
            .filter(monster => monster.mnum === 282)
            .sort((left, right) => left.m_id - right.m_id);
        assert.ok(target);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 8,
            hpmax: 8,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual(watchmen.map(watchman => ({
            dx: watchman.mx - game.u.ux,
            dy: watchman.my - game.u.uy,
            hp: watchman.mhp,
            hpmax: watchman.mhpmax,
            peaceful: watchman.mpeaceful,
            sleeping: watchman.msleeping ?? 0,
            canmove: watchman.mcanmove,
            frozen: watchman.mfrozen ?? 0,
            fleeing: watchman.mflee ?? 0,
        })), [{
            dx: -1,
            dy: 0,
            hp: 23,
            hpmax: 23,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
        }, {
            dx: 0,
            dy: -1,
            hp: 15,
            hpmax: 15,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
        }]);
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 4);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0001 sleeping guard wakes inside plural Grey-elf rock arrest',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nGrey-elf\n'
                + '#wizgenesis\nsleeping watchman\n'
                + '#wizgenesis\nwatchman\n'
                + '#wizwish\nrock\ntgl  ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[92], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=1', 'rnd(20)=9',
            'rn2(3)=0',
        ], 'seed0001 sleeping-guard Grey-elf attack RNG');
        assert.equal(decodedTopline(result.getScreens()[92]),
            'The rock misses the Grey-elf.  The Grey-elf gets angry!--More--');
        assert.deepEqual(result.getCursors()[92], [63, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[93], [],
            'seed0001 sleeping-guard arrest wake RNG');
        assert.equal(decodedTopline(result.getScreens()[93]),
            '"Halt!  You\'re under arrest!"  The guard wakes up.--More--');
        assert.deepEqual(result.getCursors()[93], [58, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[94], [
            'rn2(100)=11',
            'rn2(12)=7', 'rn2(12)=4', 'rn2(12)=5',
            'rn2(12)=4', 'rn2(12)=4', 'rn2(12)=11',
            'rn2(70)=32', 'rn2(400)=142', 'rn2(200)=122',
            'rn2(20)=7', 'rn2(76)=18',
        ], 'seed0001 post-wake Grey-elf arrest continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[94]),
            'The guards get angry!');
        assert.deepEqual(result.getCursors()[94], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 267 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const watchmen = game.level.monsters
            .filter(monster => monster.mnum === 282)
            .sort((left, right) => left.m_id - right.m_id);
        assert.ok(target);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            sleeping: target.msleeping ?? 0,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 19,
            hpmax: 19,
            peaceful: 0,
            sleeping: 0,
            fleeing: 0,
        });
        assert.deepEqual(watchmen.map(watchman => ({
            dx: watchman.mx - game.u.ux,
            dy: watchman.my - game.u.uy,
            hp: watchman.mhp,
            hpmax: watchman.mhpmax,
            peaceful: watchman.mpeaceful,
            sleeping: watchman.msleeping ?? 0,
            canmove: watchman.mcanmove,
            frozen: watchman.mfrozen ?? 0,
            fleeing: watchman.mflee ?? 0,
        })), [{
            dx: -1,
            dy: 0,
            hp: 18,
            hpmax: 18,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
        }, {
            dx: 1,
            dy: -1,
            hp: 23,
            hpmax: 23,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
        }]);
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 0);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0001 distant watchman approaches after peaceful rock attack',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nwatchman\n\x14  lll.'
                + '#wizgenesis\nblack unicorn\n'
                + '#wizwish\nrock\ntgh  ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[74], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rnd(20)=1',
            'rnd(2)=1',
        ], 'seed0001 approaching watch arrest attack RNG');
        assert.equal(decodedTopline(result.getScreens()[74]),
            'The rock hits the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[74], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[75], [
            'rn2(19)=3', 'rn2(3)=1',
            'rn2(4)=1', 'rn2(5)=0', 'rn2(5)=1', 'rn2(5)=2',
        ], 'seed0001 approaching watch arrest first continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[75]),
            '"Halt!  You\'re under arrest!"  An angry guard is approaching!--More--');
        assert.deepEqual(result.getCursors()[75], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[76], [
            'rn2(4)=3',
            'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(3)=2', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(3)=1',
            'rn2(5)=3', 'rn2(5)=1', 'rn2(4)=0',
            'rn2(5)=4', 'rn2(5)=3',
            'rn2(12)=5', 'rn2(12)=11', 'rn2(12)=2',
            'rn2(12)=4', 'rn2(12)=4', 'rn2(70)=28',
            'rn2(400)=396', 'rn2(200)=129', 'rn2(20)=18',
            'rn2(76)=70',
        ], 'seed0001 approaching watch arrest second continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[76]),
            'The watchman wields a spear!');
        assert.deepEqual(result.getCursors()[76], [55, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const watchman = game.level.monsters.find(monster =>
            monster.mnum === 282);
        assert.ok(target);
        assert.ok(watchman);
        assert.deepEqual({
            dx: target.mx - game.u.ux,
            dy: target.my - game.u.uy,
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            dx: -1,
            dy: 0,
            hp: 9,
            hpmax: 10,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            dx: watchman.mx - game.u.ux,
            dy: watchman.my - game.u.uy,
            hp: watchman.mhp,
            hpmax: watchman.mhpmax,
            peaceful: watchman.mpeaceful,
            sleeping: watchman.msleeping ?? 0,
            canmove: watchman.mcanmove,
            frozen: watchman.mfrozen ?? 0,
            fleeing: watchman.mflee ?? 0,
            weapon: watchman.mw?.otyp,
            wielded: watchman.mw?.wielded,
        }, {
            dx: -2,
            dy: 0,
            hp: 19,
            hpmax: 19,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
            weapon: SPEAR,
            wielded: true,
        });
        const floorRocks = (game.level.objects || []).flatMap(column =>
            (column || []).flatMap(stack => stack || []))
            .filter(object => object.otyp === ROCK);
        assert.equal(floorRocks.length, 0);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 0);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.context.move, 1);
    });

test('seed0001 blinded hero hears watchman whistle after rock attack',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\nwatchman\n'
                + '#wizintrinsic\ni\n '
                + '#wizwish\ngold\n'
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[66], [],
            'seed0001 first blindness pager RNG');
        assert.equal(decodedTopline(result.getScreens()[66]),
            'A cloud of darkness falls upon you.--More--');
        assert.deepEqual(result.getCursors()[66], [43, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[67], [],
            'seed0001 first blindness continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[67]), '');
        assert.deepEqual(result.getCursors()[67], [52, 9, 1]);

        assertRngSliceExact(result.getRngSlices()[98], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rnd(20)=5',
            'rn2(3)=0',
        ], 'seed0001 blind watch whistle attack RNG');
        assert.equal(decodedTopline(result.getScreens()[98]),
            'The stone misses.  It neighs!  "Halt!  You\'re under arrest!"--More--');
        assert.deepEqual(result.getCursors()[98], [68, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[99], [
            'rn2(100)=80',
            'rn2(12)=4', 'rn2(12)=3', 'rn2(12)=4',
            'rn2(12)=9', 'rn2(12)=10', 'rn2(70)=56',
            'rn2(400)=97', 'rn2(200)=3', 'rn2(20)=9',
            'rn2(76)=0', 'rnd(3)=3',
        ], 'seed0001 blind watch whistle continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[99]),
            "You hear the shrill sound of a guard's whistle.");
        assert.deepEqual(result.getCursors()[99], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const watchman = game.level.monsters.find(monster =>
            monster.mnum === 282 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(watchman);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 8,
            hpmax: 8,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: watchman.mhp,
            hpmax: watchman.mhpmax,
            peaceful: watchman.mpeaceful,
            sleeping: watchman.msleeping ?? 0,
            canmove: watchman.mcanmove,
            frozen: watchman.mfrozen ?? 0,
            fleeing: watchman.mflee ?? 0,
        }, {
            hp: 23,
            hpmax: 23,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 1);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.blind, true);
        assert.equal(game.u.blindTurns, 29);
        assert.equal(game.context.move, 1);
    });

test('seed0001 deaf hero gets arrest-only watch response after rock attack',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizgenesis\nwatchman\n'
                + '#wizintrinsic\nj\n '
                + '#wizwish\ngold\n'
                + '#wizwish\nrock\ntgl ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[66], [],
            'seed0001 first deafness pager RNG');
        assert.equal(decodedTopline(result.getScreens()[66]),
            'You are unable to hear anything.--More--');
        assert.ok(result.getScreens()[66].includes('Deaf'));
        assert.deepEqual(result.getCursors()[66], [40, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[67], [],
            'seed0001 first deafness continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[67]), '');
        assert.ok(result.getScreens()[67].includes('Deaf'));
        assert.deepEqual(result.getCursors()[67], [52, 9, 1]);

        assertRngSliceExact(result.getRngSlices()[98], [
            'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rnd(20)=5',
            'rn2(3)=0',
        ], 'seed0001 deaf watch attack RNG');
        assert.equal(decodedTopline(result.getScreens()[98]),
            'The rock misses the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[98], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[99], [
            'rn2(100)=80',
            'rn2(12)=4', 'rn2(12)=3', 'rn2(12)=4',
            'rn2(12)=9', 'rn2(12)=10', 'rn2(70)=56',
            'rn2(20)=17', 'rn2(76)=31',
        ], 'seed0001 deaf watch continuation RNG');
        assert.equal(decodedTopline(result.getScreens()[99]),
            '"Halt!  You\'re under arrest!"');
        assert.deepEqual(result.getCursors()[99], [52, 9, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const watchman = game.level.monsters.find(monster =>
            monster.mnum === 282 && monster.mx === game.u.ux - 1
                && monster.my === game.u.uy);
        assert.ok(target);
        assert.ok(watchman);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 8,
            hpmax: 8,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: watchman.mhp,
            hpmax: watchman.mhpmax,
            peaceful: watchman.mpeaceful,
            sleeping: watchman.msleeping ?? 0,
            canmove: watchman.mcanmove,
            frozen: watchman.mfrozen ?? 0,
            fleeing: watchman.mflee ?? 0,
        }, {
            hp: 23,
            hpmax: 23,
            peaceful: 0,
            sleeping: 0,
            canmove: 1,
            frozen: 0,
            fleeing: 0,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 1);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.equal(game.deaf, true);
        assert.equal(game.u.deafTurns, 29);
        assert.equal(game.context.move, 1);
    });

test('seed0001 page-local wizintrinsic lets a ki-rin see an invisible rock attack',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Knight,race:human,gender:female,align:lawful,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nki-rin\n'
                + '#wizgenesis\nki-rin\n'
                + '#wizintrinsic\n b\n '
                + '#wizwish\ngold\n'.repeat(3)
                + '#wizwish\nrock\ntil',
            storage: new Map(),
        });

        const pageTwo = decodeScreen(result.getScreens()[56]);
        assert.equal(pageTwo[0].map(cell => cell.ch).join('').trimEnd(),
            ' a - see invisible');
        assert.equal(pageTwo[1].map(cell => cell.ch).join('').trimEnd(),
            ' b - invisible');
        assert.deepEqual(result.getCursors()[56], [9, 23, 1]);
        const selectedPage = decodeScreen(result.getScreens()[57]);
        assert.equal(selectedPage[1].map(cell => cell.ch).join('').trimEnd(),
            ' b + invisible');
        assert.equal(decodedTopline(result.getScreens()[58]),
            'Timeout for invisible set to 30.--More--');
        assert.deepEqual(result.getCursors()[58], [40, 0, 1]);
        assert.equal(decodeScreen(result.getScreens()[58])[7][12].ch, '@');
        assert.equal(decodeScreen(result.getScreens()[59])[7][12].ch, '<');
        assert.deepEqual(result.getCursors()[59], [12, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[118], [
            'rnd(2)=1', 'rnd(3)=3', 'rn2(3)=1', 'rnd(20)=6',
            'rn2(3)=0', 'rn2(3)=1', 'rn2(100)=14',
            'rn2(12)=0', 'rn2(12)=6', 'rn2(12)=2',
            'rn2(70)=30', 'rn2(400)=249', 'rn2(300)=11',
            'rn2(20)=4', 'rn2(67)=1',
        ], 'seed0001 invisible-hero ki-rin observer RNG');
        assert.equal(decodedTopline(result.getScreens()[118]),
            'The rock misses the ki-rin.  The ki-rin screams!');
        assert.deepEqual(result.getCursors()[118], [12, 7, 1]);

        const target = game.level.monsters.find(monster =>
            monster.mnum === 124 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy);
        const observer = game.level.monsters.find(monster =>
            monster.mnum === 124 && monster.mx === game.u.ux + 1
                && monster.my === game.u.uy + 1);
        assert.ok(target);
        assert.ok(observer);
        assert.deepEqual({
            hp: target.mhp,
            hpmax: target.mhpmax,
            peaceful: target.mpeaceful,
            fleeing: target.mflee ?? 0,
        }, {
            hp: 75,
            hpmax: 75,
            peaceful: 0,
            fleeing: 0,
        });
        assert.deepEqual({
            hp: observer.mhp,
            hpmax: observer.mhpmax,
            peaceful: observer.mpeaceful,
            fleeing: observer.mflee ?? 0,
        }, {
            hp: 73,
            hpmax: 73,
            peaceful: 1,
            fleeing: 0,
        });
        const landedRocks = (game.level.objects?.[target.mx]?.[target.my] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(landedRocks.length, 1);
        assert.equal(landedRocks[0].quan ?? landedRocks[0].quantity, 1);
        assert.equal(landedRocks[0].where, 'floor');
        assert.equal(game.u.invisible, true);
        assert.equal(game.u.invisibleTurns, 29);
        assert.equal(game._goldCount, 3);
        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.context.move, 1);
    });

test('seed0001 Wizard wish creates iron bars at the hero square', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\n',
        storage: new Map(),
    });

    assertRngSliceExact(
        result.getRngSlices()[22], [],
        'seed0001 Wizard iron-bars wish RNG',
    );
    assert.equal(decodedTopline(result.getScreens()[22]), 'Iron bars.');
    assert.deepEqual(result.getCursors()[22], [52, 9, 1]);
    assert.equal(game.level.at(game.u.ux, game.u.uy).typ, IRONBARS);
    assert.equal(game.context.move, 0);
});

test('seed0001 Wizard wish creates a wall of water at the hero square', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\nwall of water\n',
        storage: new Map(),
    });

    assertRngSliceExact(
        result.getRngSlices()[26], [],
        'seed0001 Wizard water-wall wish RNG',
    );
    assert.equal(decodedTopline(result.getScreens()[26]), 'A wall of water.');
    assert.deepEqual(result.getCursors()[26], [52, 9, 1]);
    const loc = game.level.at(game.u.ux, game.u.uy);
    assert.equal(loc.typ, WATER);
    assert.equal(loc.flags ?? 0, 0);
    assert.equal(loc.doormask ?? 0, 0);
    assert.equal(loc.wall_info ?? 0, 0);
    assert.equal(loc.ladder ?? 0, 0);
    assert.equal(game.context.move, 0);
});

test('seed0005 Wizard wish creates a pool at the hero square', async () => {
    const result = await runSegment({
        seed: 5,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\npool\n',
        storage: new Map(),
    });

    assertRngSliceExact(
        result.getRngSlices()[17], [],
        'seed0005 Wizard pool wish RNG',
    );
    assert.equal(decodedTopline(result.getScreens()[17]), 'A pool of water.');
    assert.deepEqual(result.getCursors()[17], [37, 5, 1]);
    const loc = game.level.at(game.u.ux, game.u.uy);
    assert.equal(loc.typ, POOL);
    assert.equal(loc.flags ?? 0, 0);
    assert.equal(loc.doormask ?? 0, 0);
    assert.equal(loc.wall_info ?? 0, 0);
    assert.equal(loc.ladder ?? 0, 0);
    assert.equal(game.context.move, 0);
});

test('seed0005 Wizard singular rock wish overrides generated stack quantity', async () => {
    const result = await runSegment({
        seed: 5,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\npool\nk#wizwish\nrock\n',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[32], [
        'rn2(101)=92', 'rnd(2)=1', 'rn2(6)=5', 'rn2(100)=95',
    ], 'seed0005 Wizard singular rock wish RNG');
    assert.equal(decodedTopline(result.getScreens()[32]), 'g - a rock.');
    assert.deepEqual(result.getCursors()[32], [37, 4, 1]);
    const rock = game.inventory.find(object => object.otyp === ROCK);
    assert.ok(rock);
    assert.equal(rock.invlet, 'g');
    assert.equal(rock.quan, 1);
    assert.equal(rock.quantity ?? rock.quan, 1);
    assert.equal(game.context.move, 0);
});

test('seed0001 Wizard singular gold wish uses an indefinite article', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nkk#wizwish\ngold\n',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[38], [
        'rnd(2)=2', 'rn2(100)=82',
    ], 'seed0001 Wizard singular-gold wish RNG');
    assert.equal(decodedTopline(result.getScreens()[38]), '$ - a gold piece.');
    assert.deepEqual(result.getCursors()[38], [52, 7, 1]);
    assert.equal(game._goldCount, 1);
    assert.equal(game.context.move, 0);
});

test('seed0001 repeated singular gold wishes omit merged-stack periods',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizwish\ngold\n#wizwish\ngold\n#wizwish\ngold\n#wizwish\ngold\n#wizwish\ngold\n',
            storage: new Map(),
        });

        const commits = [
            [17, ['rnd(2)=1', 'rn2(100)=49'], '$ - a gold piece.'],
            [31, ['rnd(2)=1', 'rn2(100)=31'], '$ - a gold piece'],
            [45, ['rnd(2)=2', 'rn2(100)=11'], '$ - a gold piece'],
            [59, ['rnd(2)=2', 'rn2(100)=32'], '$ - a gold piece'],
            [73, ['rnd(2)=1', 'rn2(100)=97'], '$ - a gold piece'],
        ];
        for (const [step, rng, topline] of commits) {
            assertRngSliceExact(
                result.getRngSlices()[step], rng,
                `seed0001 gold merge commit ${step}`,
            );
            assert.equal(decodedTopline(result.getScreens()[step]), topline);
            assert.deepEqual(result.getCursors()[step], [52, 9, 1]);
        }
        assert.equal(game._goldCount, 5);
        assert.equal(game.context.move, 0);
    });

test('seed0005 thrown rock skips a pool before a closed-door landing', async () => {
    const result = await runSegment({
        seed: 5,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\npool\nk#wizwish\nrock\ntgj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[35], [
        'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=0', 'rn2(20)=8',
        'rn2(5)=0', 'rn2(100)=60', 'rn2(100)=58', 'rn2(100)=2',
        'rn2(100)=97', 'rn2(100)=68', 'rn2(100)=8', 'rn2(100)=9',
        'rn2(100)=60', 'rn2(1)=0', 'rn2(2)=0', 'rn2(3)=0',
        'rn2(4)=3', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=1',
        'rn2(5)=3', 'rn2(5)=0', 'rn2(100)=60', 'rn2(100)=51',
        'rn2(4)=3', 'rn2(5)=3', 'rn2(12)=3', 'rn2(12)=1',
        'rn2(12)=0', 'rn2(12)=0', 'rn2(70)=68', 'rn2(400)=134',
        'rn2(200)=136', 'rn2(20)=18', 'rn2(73)=7',
    ], 'seed0005 rock-skip RNG');
    assert.equal(
        decodedTopline(result.getScreens()[35]),
        'The rock skips.  Splash!',
    );
    assert.deepEqual(result.getCursors()[35], [37, 4, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [38, 3]);
    assert.equal(game.level.at(38, 4).typ, POOL);
    assert.equal(game.level.at(38, 5).typ, DOOR);
    assert.equal(game.level.at(38, 5).doormask & D_CLOSED, D_CLOSED);
    const rocks = (game.level.objects?.[38]?.[4] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 thrown rock obeys a nonzero pool-skip permission roll', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\npool\nk#wizwish\nrock\ntgj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[35], [
        'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rn2(20)=17',
        'rn2(5)=2', 'rn2(100)=33', 'rn2(100)=84', 'rn2(8)=5',
        'rn2(4)=3', 'rn2(5)=2', 'rn2(4)=0', 'rn2(5)=1',
        'rn2(5)=2', 'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1',
        'rn2(5)=2', 'rn2(4)=3', 'rn2(5)=3', 'rn2(5)=4',
        'rn2(5)=0', 'rn2(5)=3', 'rn2(5)=1', 'rn2(5)=4',
        'rn2(100)=16', 'rn2(100)=50', 'rn2(8)=7', 'rn2(100)=3',
        'rn2(100)=91', 'rn2(100)=28', 'rn2(100)=32', 'rn2(100)=10',
        'rn2(100)=43', 'rn2(1)=0', 'rn2(100)=62', 'rn2(2)=1',
        'rn2(3)=0', 'rn2(4)=2', 'rn2(5)=4', 'rn2(6)=0',
        'rn2(5)=3', 'rn2(12)=4', 'rn2(12)=4', 'rn2(12)=5',
        'rn2(12)=6', 'rn2(70)=50', 'rn2(400)=125', 'rn2(200)=138',
        'rn2(20)=18', 'rn2(70)=42',
    ], 'seed0001 rock-skip permission RNG');
    assert.equal(decodedTopline(result.getScreens()[35]), 'Splash!');
    assert.deepEqual(result.getCursors()[35], [52, 8, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 7]);
    assert.equal(game.level.at(53, 8).typ, POOL);
    const rocks = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 singular rock pays skip initialization on dry flight', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\nrock\ntgk',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[20], [
        'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=2', 'rn2(100)=32',
        'rn2(12)=6', 'rn2(12)=9', 'rn2(12)=10', 'rn2(12)=9',
        'rn2(70)=43', 'rn2(400)=308', 'rn2(200)=62', 'rn2(20)=18',
        'rn2(70)=57',
    ], 'seed0001 dry-rock flight RNG');
    assert.equal(decodedTopline(result.getScreens()[20]), '');
    assert.deepEqual(result.getCursors()[20], [52, 9, 1]);
    assert.equal(decodeScreen(result.getScreens()[20])[5][52].ch, '*');
    assert.deepEqual([game.u.ux, game.u.uy], [53, 8]);
    assert.equal(game.level.at(53, 4).typ, ROOM);
    const rocks = (game.level.objects?.[53]?.[4] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(
        (game.level.objects?.[53]?.[7] || [])
            .some(object => object.otyp === ROCK),
        false,
    );
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 two-rock stack splits one child into full dry flight', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\n2 rocks\ntgk',
        storage: new Map(),
    });

    assert.equal(decodedTopline(result.getScreens()[20]), 'g - 2 rocks.');
    assertRngSliceExact(result.getRngSlices()[23], [
        'rnd(2)=2', 'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=1',
        'rn2(100)=14', 'rn2(12)=9', 'rn2(12)=10', 'rn2(12)=9',
        'rn2(12)=9', 'rn2(70)=68', 'rn2(400)=262', 'rn2(200)=18',
        'rn2(20)=17', 'rn2(70)=52',
    ], 'seed0001 two-rock split flight RNG');
    assert.equal(decodedTopline(result.getScreens()[23]), '');
    assert.deepEqual(result.getCursors()[23], [52, 9, 1]);
    assert.equal(decodeScreen(result.getScreens()[23])[5][52].ch, '*');
    assert.deepEqual([game.u.ux, game.u.uy], [53, 8]);

    const retained = game.inventory.filter(object => object.otyp === ROCK);
    assert.equal(retained.length, 1);
    assert.equal(retained[0].invlet, 'g');
    assert.equal(retained[0].quan ?? retained[0].quantity, 1);
    const landed = (game.level.objects?.[53]?.[4] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(landed.length, 1);
    assert.equal(landed[0].quan ?? landed[0].quantity, 1);
    assert.notEqual(landed[0].o_id, retained[0].o_id);
    assert.equal(landed[0].where, 'floor');
    assert.equal(
        (game.level.objects?.[53]?.[7] || [])
            .some(object => object.otyp === ROCK),
        false,
    );
    assert.equal(game.context.move, 1);
});

test('seed0001 adjacent rock miss wakes Sirius before contact landing',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizwish\nrock\ntgl',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[20], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=2', 'rnd(20)=13',
            'rn2(3)=0', 'rn2(100)=97', 'rn2(12)=10', 'rn2(12)=9',
            'rn2(12)=9', 'rn2(12)=4', 'rn2(70)=2', 'rn2(400)=218',
            'rn2(200)=117', 'rn2(20)=2', 'rn2(70)=23',
        ], 'seed0001 adjacent-rock miss RNG');
        assert.equal(
            decodedTopline(result.getScreens()[20]),
            'The rock misses Sirius.',
        );
        assert.deepEqual(result.getCursors()[20], [52, 9, 1]);

        const sirius = game.level.monsters.find(monster =>
            monster.name === 'Sirius');
        assert.ok(sirius);
        assert.deepEqual(
            {
                position: [sirius.mx, sirius.my],
                mhp: sirius.mhp,
                mhpmax: sirius.mhpmax,
                mtame: sirius.mtame,
                mpeaceful: sirius.mpeaceful,
                msleeping: sirius.msleeping,
            },
            {
                position: [54, 8],
                mhp: sirius.mhpmax,
                mhpmax: sirius.mhpmax,
                mtame: 10,
                mpeaceful: 1,
                msleeping: 0,
            },
        );
        const rocks = (game.level.objects?.[54]?.[8] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(rocks.length, 1);
        assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
        assert.equal(rocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game.context.move, 1);
    });

test('seed0001 padded adjacent rock hit abuses Sirius and survives mulch',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizwish\ngold\n#wizwish\ngold\n#wizwish\ngold\n#wizwish\ngold\n#wizwish\ngold\n#wizwish\nrock\ntgl',
            storage: new Map(),
        });

        assert.equal(decodedTopline(result.getScreens()[73]), '$ - a gold piece');
        assertRngSliceExact(result.getRngSlices()[90], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=1', 'rnd(20)=3',
            'rnd(2)=2', 'rn2(9)=2', 'rnd(2)=2', 'rn2(19)=16',
            'rn2(3)=0', 'rn2(100)=88', 'rn2(12)=6', 'rn2(12)=10',
            'rn2(12)=3', 'rn2(12)=8', 'rn2(70)=33', 'rn2(400)=137',
            'rn2(200)=131', 'rn2(20)=3', 'rn2(70)=59',
        ], 'seed0001 adjacent-rock hit RNG');
        assert.equal(
            decodedTopline(result.getScreens()[90]),
            'Sirius yelps!  The rock hits Sirius.',
        );
        assert.deepEqual(result.getCursors()[90], [52, 9, 1]);

        const sirius = game.level.monsters.find(monster =>
            monster.name === 'Sirius');
        assert.ok(sirius);
        assert.deepEqual(
            {
                position: [sirius.mx, sirius.my],
                mhp: sirius.mhp,
                mhpmax: sirius.mhpmax,
                mtame: sirius.mtame,
                mpeaceful: sirius.mpeaceful,
                pet: sirius.pet,
                abuse: sirius.edog?.abuse,
                mflee: sirius.mflee,
                mfleetim: sirius.mfleetim,
            },
            {
                position: [54, 8],
                mhp: 3,
                mhpmax: 5,
                mtame: 9,
                mpeaceful: 1,
                pet: true,
                abuse: 1,
                mflee: 1,
                mfleetim: 19,
            },
        );
        const rocks = (game.level.objects?.[54]?.[8] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(rocks.length, 1);
        assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
        assert.equal(rocks[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 5);
        assert.equal(game.context.move, 1);
    });

test('seed0001 padded adjacent rock hit consumes nonzero-mulch projectile',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n' + '#wizwish\ngold\n'.repeat(44)
                + '#wizwish\nrock\ntgl',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[636], [
            'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rnd(20)=1',
            'rnd(2)=2', 'rn2(9)=5', 'rnd(2)=1', 'rn2(19)=4',
            'rn2(3)=1', 'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=9',
            'rn2(12)=8', 'rn2(70)=8', 'rn2(400)=263',
            'rn2(200)=142', 'rn2(20)=19', 'rn2(70)=10',
        ], 'seed0001 adjacent-rock nonzero-mulch RNG');
        assert.equal(
            decodedTopline(result.getScreens()[636]),
            'Sirius yelps!  The rock hits Sirius.',
        );
        assert.deepEqual(result.getCursors()[636], [52, 9, 1]);

        const sirius = game.level.monsters.find(monster =>
            monster.name === 'Sirius');
        assert.ok(sirius);
        assert.deepEqual(
            {
                position: [sirius.mx, sirius.my],
                mhp: sirius.mhp,
                mhpmax: sirius.mhpmax,
                mtame: sirius.mtame,
                mpeaceful: sirius.mpeaceful,
                pet: sirius.pet,
                abuse: sirius.edog?.abuse,
                mflee: sirius.mflee,
                mfleetim: sirius.mfleetim,
            },
            {
                position: [54, 8],
                mhp: 3,
                mhpmax: 5,
                mtame: 9,
                mpeaceful: 1,
                pet: true,
                abuse: 1,
                mflee: 1,
                mfleetim: 9,
            },
        );
        const rocks = (game.level.objects?.[54]?.[8] || [])
            .filter(object => object.otyp === ROCK);
        assert.equal(rocks.length, 0);
        assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
        assert.equal(game._goldCount, 44);
        assert.equal(game.context.move, 1);
    });

test('seed0001 blocked rock initializes bhit before landing under the hero', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\nrock\ntgj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[20], [
        'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=2', 'rn2(100)=32',
        'rn2(12)=6', 'rn2(12)=9', 'rn2(12)=10', 'rn2(12)=9',
        'rn2(70)=43', 'rn2(400)=308', 'rn2(200)=62', 'rn2(20)=18',
        'rn2(70)=57',
    ], 'seed0001 blocked-rock RNG');
    assert.equal(decodedTopline(result.getScreens()[20]), '');
    assert.deepEqual(result.getCursors()[20], [52, 9, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 8]);
    const rocks = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(rocks[0].where, 'floor');
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 point-blank rock passes iron bars as GEM_CLASS', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nk#wizwish\nrock\ntgj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[40], [
        'rnd(1)=1', 'rnd(3)=1', 'rn2(3)=2', 'rn2(100)=17',
        'rn2(5)=2', 'rn2(100)=33', 'rn2(8)=0', 'rn2(100)=89',
        'rn2(5)=2', 'rn2(4)=2', 'rn2(3)=1', 'rn2(3)=0',
        'rn2(5)=2', 'rn2(4)=3', 'rn2(5)=2', 'rn2(5)=3',
        'rn2(5)=2', 'rn2(5)=1', 'rn2(5)=3', 'rn2(4)=1',
        'rn2(3)=1', 'rn2(3)=1', 'rn2(5)=1', 'rn2(5)=4',
        'rn2(5)=1', 'rn2(100)=50', 'rn2(8)=7', 'rn2(100)=3',
        'rn2(8)=3', 'rn2(4)=0', 'rn2(5)=2', 'rn2(12)=6',
        'rn2(12)=7', 'rn2(12)=3', 'rn2(12)=6', 'rn2(70)=19',
        'rn2(400)=396', 'rn2(200)=78', 'rn2(20)=14', 'rn2(70)=66',
    ], 'seed0001 point-blank bars rock RNG');
    assert.equal(decodedTopline(result.getScreens()[40]), '');
    assert.deepEqual(result.getCursors()[40], [52, 8, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 7]);
    assert.equal(game.level.at(53, 8).typ, IRONBARS);
    const rocks = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(decodeScreen(result.getScreens()[40])[9][52].ch, '*');
    assert.deepEqual(
        [game.startingPet?.mx, game.startingPet?.my],
        [54, 7],
    );
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 distant rock pays the bars probe and passes on nonzero', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nkk#wizwish\nrock\ntgj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[41], [
        'rnd(1)=1', 'rnd(3)=2', 'rn2(3)=0', 'rn2(5)=4',
        'rn2(100)=53', 'rn2(5)=0', 'rn2(100)=51', 'rn2(8)=7',
        'rn2(100)=83', 'rn2(8)=6', 'rn2(4)=2', 'rn2(100)=86',
        'rn2(1)=0', 'rn2(5)=2', 'rn2(4)=1', 'rn2(3)=2',
        'rn2(3)=0', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=0',
        'rn2(4)=3', 'rn2(5)=1', 'rn2(5)=4', 'rn2(5)=4',
        'rn2(4)=3', 'rn2(5)=4', 'rn2(5)=4', 'rn2(32)=12',
        'rn2(5)=1', 'rn2(4)=0', 'rn2(5)=3', 'rn2(8)=3',
        'rn2(5)=3', 'rn2(12)=8', 'rn2(12)=0', 'rn2(12)=0',
        'rn2(12)=9', 'rn2(70)=53', 'rn2(400)=256', 'rn2(200)=70',
        'rn2(20)=7', 'rn2(70)=9',
    ], 'seed0001 distant-bars rock RNG');
    assert.equal(decodedTopline(result.getScreens()[41]), '');
    assert.deepEqual(result.getCursors()[41], [52, 7, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 6]);
    assert.equal(game.level.at(53, 8).typ, IRONBARS);
    const rocks = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(
        (game.level.objects?.[53]?.[7] || [])
            .some(object => object.otyp === ROCK),
        false,
    );
    assert.deepEqual(
        [game.startingPet?.mx, game.startingPet?.my],
        [54, 6],
    );
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 distant rock collision survives two bars resistance checks', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nkk#wizwish\ngold\n#wizwish\nrock\ntgj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[55], [
        'rnd(1)=1', 'rnd(3)=3', 'rn2(3)=0', 'rn2(5)=0',
        'rn2(100)=51', 'rn2(100)=75', 'rn2(5)=3', 'rn2(100)=22',
        'rn2(8)=6', 'rn2(100)=86', 'rn2(8)=0', 'rn2(100)=47',
        'rn2(100)=89', 'rn2(5)=1', 'rn2(4)=2', 'rn2(3)=1',
        'rn2(3)=2', 'rn2(5)=0', 'rn2(4)=3', 'rn2(5)=1',
        'rn2(5)=4', 'rn2(5)=4', 'rn2(4)=3', 'rn2(5)=4',
        'rn2(5)=4', 'rn2(5)=2', 'rn2(4)=2', 'rn2(5)=4',
        'rn2(5)=3', 'rn2(32)=19', 'rn2(5)=3', 'rn2(4)=0',
        'rn2(5)=1', 'rn2(8)=0', 'rn2(5)=2', 'rn2(12)=5',
        'rn2(12)=0', 'rn2(12)=2', 'rn2(12)=7', 'rn2(70)=9',
        'rn2(400)=250', 'rn2(200)=65', 'rn2(20)=12', 'rn2(70)=8',
    ], 'seed0001 zero-probe bars rock RNG');
    assert.equal(decodedTopline(result.getScreens()[55]), 'Clonk!');
    assert.deepEqual(result.getCursors()[55], [52, 7, 1]);
    assert.equal(decodeScreen(result.getScreens()[55])[8][52].ch, '*');
    assert.deepEqual([game.u.ux, game.u.uy], [53, 6]);
    assert.equal(game.level.at(53, 8).typ, IRONBARS);
    const rocks = (game.level.objects?.[53]?.[7] || [])
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan ?? rocks[0].quantity, 1);
    assert.equal(rocks[0].oeroded ?? 0, 0);
    assert.equal(
        (game.level.objects?.[53]?.[8] || [])
            .some(object => object.otyp === ROCK),
        false,
    );
    assert.deepEqual(
        [game.startingPet?.mx, game.startingPet?.my],
        [54, 6],
    );
    assert.equal(game._goldCount, 1);
    assert.equal(game.inventory.some(object => object.otyp === ROCK), false);
    assert.equal(game.context.move, 1);
});

test('seed0001 hand-thrown arrow stops in a water wall and rusts', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\nwall of water\nktdj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[30], [
        'rnd(2)=2', 'rn2(20)=6', 'rnl(4)=1', 'rn2(5)=3',
        'rn2(100)=8', 'rn2(100)=62', 'rn2(8)=2', 'rn2(5)=2',
        'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(5)=4',
        'rn2(4)=3', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=1',
        'rn2(5)=2', 'rn2(5)=3', 'rn2(4)=0', 'rn2(5)=3',
        'rn2(5)=2', 'rn2(5)=1', 'rn2(100)=23', 'rn2(100)=49',
        'rn2(8)=3', 'rn2(100)=78', 'rn2(100)=91', 'rn2(100)=9',
        'rn2(100)=16', 'rn2(100)=50', 'rn2(100)=51', 'rn2(1)=0',
        'rn2(100)=91', 'rn2(2)=0', 'rn2(3)=1', 'rn2(4)=2',
        'rn2(5)=3', 'rn2(6)=3', 'rn2(5)=2', 'rn2(12)=1',
        'rn2(12)=0', 'rn2(12)=10', 'rn2(12)=2', 'rn2(70)=66',
        'rn2(400)=33', 'rn2(200)=196', 'rn2(20)=8', 'rn2(70)=43',
    ], 'seed0001 water-wall arrow RNG');
    assert.equal(
        decodedTopline(result.getScreens()[30]),
        "You aren't wielding a bow, so you throw your arrow by hand.  Plop!",
    );
    assert.deepEqual(result.getCursors()[30], [52, 8, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 7]);
    assert.equal(game.level.at(53, 8).typ, WATER);
    const floorArrows = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 1);
    assert.equal(floorArrows[0].oeroded ?? 0, 1);
});

test('seed0001 hand-thrown arrow passes point-blank iron bars', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nktdj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[26], [
        'rnd(2)=2', 'rn2(100)=26', 'rn2(5)=0', 'rn2(100)=13',
        'rn2(8)=4', 'rn2(100)=62', 'rn2(8)=2', 'rn2(5)=2',
        'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(5)=4',
        'rn2(4)=3', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=1',
        'rn2(5)=2', 'rn2(5)=3', 'rn2(4)=0', 'rn2(5)=3',
        'rn2(5)=2', 'rn2(5)=1', 'rn2(100)=23', 'rn2(8)=5',
        'rn2(100)=55', 'rn2(8)=2', 'rn2(1)=0', 'rn2(100)=9',
        'rn2(5)=1', 'rn2(12)=10', 'rn2(12)=7', 'rn2(12)=7',
        'rn2(12)=11', 'rn2(70)=58', 'rn2(400)=232', 'rn2(200)=10',
        'rn2(20)=3', 'rn2(70)=33',
    ], 'seed0001 point-blank iron-bars arrow RNG');
    assert.equal(
        decodedTopline(result.getScreens()[26]),
        "You aren't wielding a bow, so you throw your arrow by hand.",
    );
    assert.deepEqual(result.getCursors()[26], [52, 8, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 7]);
    assert.equal(game.level.at(53, 8).typ, IRONBARS);
    const floorArrows = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 1);
});

test('seed0001 hand-thrown arrow passes distant iron bars on a nonzero probe', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nkktdj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[27], [
        'rnd(2)=2', 'rn2(5)=2', 'rn2(100)=30', 'rn2(5)=0',
        'rn2(100)=38', 'rn2(8)=2', 'rn2(100)=92', 'rn2(100)=29',
        'rn2(1)=0', 'rn2(5)=0', 'rn2(4)=3', 'rn2(3)=1',
        'rn2(3)=1', 'rn2(5)=2', 'rn2(5)=0', 'rn2(4)=2',
        'rn2(5)=0', 'rn2(5)=2', 'rn2(5)=4', 'rn2(4)=0',
        'rn2(32)=10', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=0',
        'rn2(8)=3', 'rn2(5)=1', 'rn2(12)=2', 'rn2(12)=4',
        'rn2(12)=3', 'rn2(12)=5', 'rn2(70)=24', 'rn2(400)=172',
        'rn2(200)=146', 'rn2(20)=4', 'rn2(70)=43',
    ], 'seed0001 distant iron-bars arrow RNG');
    assert.equal(
        decodedTopline(result.getScreens()[27]),
        "You aren't wielding a bow, so you throw your arrow by hand.",
    );
    assert.deepEqual(result.getCursors()[27], [52, 7, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [53, 6]);
    assert.equal(game.level.at(53, 8).typ, IRONBARS);
    const floorArrows = (game.level.objects?.[53]?.[8] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 1);
});

test('seed0027 distant iron-bars collision backs a surviving arrow before the bars', async () => {
    const result = await runSegment({
        seed: 27,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizwish\niron bars\nkktdj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[27], [
        'rnd(2)=2', 'rn2(5)=0', 'rn2(100)=88', 'rn2(100)=36',
        'rn2(5)=4', 'rn2(100)=18', 'rn2(8)=0', 'rn2(100)=99',
        'rn2(100)=25', 'rn2(5)=0', 'rn2(12)=8', 'rn2(12)=2',
        'rn2(70)=47', 'rn2(400)=76', 'rn2(20)=3', 'rn2(67)=10',
    ], 'seed0027 distant iron-bars collision RNG');
    assert.equal(
        decodedTopline(result.getScreens()[27]),
        "You aren't wielding a bow, so you throw your arrow by hand.  Clonk!",
    );
    assert.deepEqual(result.getCursors()[27], [29, 16, 1]);
    assert.deepEqual([game.u.ux, game.u.uy], [30, 15]);
    assert.equal(game.level.at(30, 17).typ, IRONBARS);
    const floorArrows = (game.level.objects?.[30]?.[16] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 1);
    assert.ok(game.level.monsters.some(monster =>
        !monster.dead && monster.mx === 30 && monster.my === 16));
});

test('seed1800 thrown dart enters fobj before the kitten goal scan', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed1800-tourist-eat-throw.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 11), storage: new Map(),
    });
    assertRngSliceExact(
        result.getRngSlices()[11],
        session.steps[11].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed1800 input 11 RNG',
    );
    assertScreenExact(
        result.getScreens()[11],
        session.steps[11].screen,
        'seed1800 input 11 screen',
    );
    assert.deepEqual(
        result.getCursors()[11],
        session.steps[11].cursor,
        'seed1800 input 11 cursor',
    );
    assert.equal(
        game.level.objects?.[game.u.ux]?.[game.u.uy]
            ?.some(object => object.otyp === DART),
        true,
    );
    const kitten = game.level.monsters.find(monster => monster.pet);
    assert.deepEqual([kitten?.mx, kitten?.my], [49, 16]);
});

test('seed0101 blocked hand-thrown arrow survives under the hero', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0101-ranger-quiver-throw-travel-engrave.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 9), storage: new Map(),
    });
    assertRngSliceExact(
        result.getRngSlices()[9],
        session.steps[9].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0101 input 9 RNG',
    );
    assertScreenExact(
        result.getScreens()[9],
        session.steps[9].screen,
        'seed0101 input 9 screen',
    );
    assert.deepEqual(
        result.getCursors()[9],
        session.steps[9].cursor,
        'seed0101 input 9 cursor',
    );
    const floorArrows = game.level.objects?.[game.u.ux]?.[game.u.uy]
        ?.filter(object => object.otyp === ARROW) || [];
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quantity ?? floorArrows[0].quan, 1);
});

test('seed0101 blocked arrow is immediately pickable into its parent stack',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0101-ranger-quiver-throw-travel-engrave.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];

        const result = await runSegment({
            ...session,
            moves: `${session.moves.slice(0, 9)},`,
            storage: new Map(),
        });
        assertRngSliceExact(
            result.getRngSlices()[10],
            [
                'rn2(5)=1', 'rn2(100)=57', 'rn2(8)=3', 'rn2(1)=0',
                'rn2(5)=3', 'rn2(4)=3', 'rn2(3)=0', 'rn2(3)=1',
                'rn2(5)=1', 'rn2(4)=3', 'rn2(5)=0', 'rn2(5)=3',
                'rn2(5)=3', 'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=1',
                'rn2(3)=0', 'rn2(3)=2', 'rn2(5)=2', 'rn2(4)=0',
                'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=3', 'rn2(5)=0',
                'rn2(5)=1', 'rn2(100)=57', 'rn2(8)=1', 'rn2(1)=0',
                'rn2(5)=4', 'rn2(12)=8', 'rn2(12)=5', 'rn2(12)=4',
                'rn2(12)=5', 'rn2(70)=43', 'rn2(20)=3', 'rn2(73)=62',
            ],
            'seed0101 native-derived input 10 RNG',
        );
        assert.equal(
            decodedTopline(result.getScreens()[10]),
            'd - a +0 arrow (31 in total).',
        );
        assert.deepEqual(result.getCursors()[10], [28, 4, 1]);
        const parent = game.inventory.find(object =>
            object.otyp === ARROW && object.invlet === 'd');
        assert.equal(parent?.quantity ?? parent?.quan, 31);
        assert.equal(
            game.level.objects?.[game.u.ux]?.[game.u.uy]
                ?.some(object => object.otyp === ARROW) || false,
            false,
        );
    });

test('seed0101 hand-thrown arrow crosses an open cell before landing',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0101-ranger-quiver-throw-travel-engrave.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const result = await runSegment({
            ...session,
            moves: `${session.moves.slice(0, 8)}j`,
            storage: new Map(),
        });

        assertRngSliceExact(
            result.getRngSlices()[9],
            session.steps[9].rng.map(call => call.replace(/\s+@.*$/, '')),
            'seed0101 south-arrow input 9 RNG',
        );
        assert.equal(
            decodedTopline(result.getScreens()[9]),
            "You aren't wielding a bow, so you throw your arrow by hand.",
        );
        assert.deepEqual(result.getCursors()[9], session.steps[9].cursor);
        const landing = game.level.objects?.[game.u.ux]?.[game.u.uy + 1]
            ?.filter(object => object.otyp === ARROW) || [];
        assert.equal(landing.length, 1);
        assert.equal(landing[0].quantity ?? landing[0].quan, 1);
        assert.equal(
            game.level.objects?.[game.u.ux]?.[game.u.uy]
                ?.some(object => object.otyp === ARROW) || false,
            false,
        );
    });

test('seed0101 ranged arrow composes live movement and pickup', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0101-ranger-quiver-throw-travel-engrave.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session,
        moves: `${session.moves.slice(0, 8)}jj,`,
        storage: new Map(),
    });
    assertRngSliceExact(result.getRngSlices()[10], [
        'rn2(5)=1', 'rn2(100)=57', 'rn2(8)=3', 'rn2(100)=23',
        'rn2(8)=5', 'rn2(4)=3', 'rn2(1)=0', 'rn2(5)=3',
        'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=0',
        'rn2(3)=1', 'rn2(5)=3', 'rn2(4)=2', 'rn2(5)=1',
        'rn2(5)=0', 'rn2(5)=3', 'rn2(5)=2', 'rn2(5)=4',
        'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=1',
        'rn2(3)=1', 'rn2(5)=2', 'rn2(5)=4', 'rn2(4)=3',
        'rn2(3)=0', 'rn2(3)=2', 'rn2(5)=2', 'rn2(4)=0',
        'rn2(5)=1', 'rn2(5)=3', 'rn2(100)=3', 'rn2(8)=7',
        'rn2(100)=3', 'rn2(8)=1', 'rn2(100)=77', 'rn2(100)=36',
        'rn2(100)=10', 'rn2(100)=45', 'rn2(100)=60', 'rn2(100)=28',
        'rn2(1)=0', 'rn2(2)=1', 'rn2(3)=0', 'rn2(5)=1',
        'rn2(12)=7', 'rn2(12)=4', 'rn2(12)=5', 'rn2(12)=11',
        'rn2(70)=45', 'rn2(20)=17', 'rn2(73)=54',
    ], 'seed0101 south-arrow move RNG');
    assertRngSliceExact(result.getRngSlices()[11], [
        'rn2(5)=0', 'rn2(100)=95', 'rn2(8)=2', 'rn2(100)=61',
        'rn2(100)=33', 'rn2(100)=27', 'rn2(100)=37', 'rn2(100)=68',
        'rn2(100)=19', 'rn2(1)=0', 'rn2(2)=1', 'rn2(5)=0',
        'rn2(4)=3', 'rn2(5)=2', 'rn2(5)=1', 'rn2(5)=0',
        'rn2(4)=2', 'rn2(5)=2', 'rn2(5)=4', 'rn2(5)=3',
        'rn2(5)=0', 'rn2(5)=0', 'rn2(5)=1', 'rn2(32)=20',
        'rn2(5)=4', 'rn2(5)=4', 'rn2(20)=6', 'rn2(5)=2',
        'rn2(12)=9', 'rn2(12)=2', 'rn2(12)=2', 'rn2(12)=9',
        'rn2(70)=1', 'rn2(20)=17', 'rn2(73)=64',
    ], 'seed0101 south-arrow pickup RNG');
    assert.equal(
        decodedTopline(result.getScreens()[10]),
        'You see here a +0 arrow.',
    );
    assert.equal(
        decodedTopline(result.getScreens()[11]),
        'd - a +0 arrow (31 in total).',
    );
    assert.deepEqual(result.getCursors()[10], [28, 5, 1]);
    assert.deepEqual(result.getCursors()[11], [28, 5, 1]);
    const parent = game.inventory.find(object =>
        object.otyp === ARROW && object.invlet === 'd');
    assert.equal(parent?.quantity ?? parent?.quan, 31);
});

test('seed0101 adjacent hand-thrown arrow miss resumes after its pager',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0101-ranger-quiver-throw-travel-engrave.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const result = await runSegment({
            ...session,
            moves: `${session.moves.slice(0, 8)}h `,
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[9], [
            'rnd(2)=1', 'rnd(20)=5',
        ], 'seed0101 adjacent-arrow contact RNG');
        assert.equal(
            decodedTopline(result.getScreens()[9]),
            "You aren't wielding a bow, so you throw your arrow by hand.--More--",
        );
        assert.deepEqual(result.getCursors()[9], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[10], [
            'rn2(3)=0', 'rn2(100)=53',
            'rn2(12)=6', 'rn2(12)=1', 'rn2(12)=3', 'rn2(12)=10',
            'rn2(70)=12', 'rn2(20)=16', 'rn2(73)=11',
        ], 'seed0101 adjacent-arrow miss continuation RNG');
        assert.equal(
            decodedTopline(result.getScreens()[10]),
            'The arrow misses Sirius.',
        );
        assert.deepEqual(result.getCursors()[10], [28, 4, 1]);

        const sirius = game.level.monsters.find(monster =>
            monster.name === 'Sirius');
        assert.ok(sirius);
        assert.equal(sirius.mtame, 10);
        assert.equal(sirius.mpeaceful, 1);
        const floorArrows = game.level.objects?.[sirius.mx]?.[sirius.my]
            ?.filter(object => object.otyp === ARROW) || [];
        assert.equal(floorArrows.length, 1);
        assert.equal(floorArrows[0].quantity ?? floorArrows[0].quan, 1);
    });

test('seed0001 hand-thrown arrow hits and angers peaceful black unicorn',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizwish\ngold\n'.repeat(19)
                + 'tdy ',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[298], [
            'rnd(2)=1', 'rnd(20)=1', 'rnd(2)=2',
        ], 'seed0001 peaceful-unicorn hand-arrow hit prefix RNG');
        assert.equal(decodedTopline(result.getScreens()[298]),
            "You aren't wielding a bow, so you throw your arrow by hand.--More--");
        assert.deepEqual(result.getCursors()[298], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[299], [
            'rn2(19)=17', 'rn2(3)=0', 'rnl(4)=2', 'rn2(100)=47',
            'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=9', 'rn2(12)=8',
            'rn2(12)=6', 'rn2(70)=33', 'rn2(400)=142',
            'rn2(200)=19', 'rn2(20)=0', 'rn2(70)=37',
        ], 'seed0001 peaceful-unicorn hand-arrow resumed RNG');
        assert.equal(decodedTopline(result.getScreens()[299]),
            'The arrow hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[299], [52, 9, 1]);

        const contactX = game.u.ux - 1;
        const contactY = game.u.uy - 1;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === contactX
                && monster.my === contactY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            sleeping: unicorn.msleeping,
        }, {
            hp: 11,
            hpmax: 13,
            peaceful: 0,
            tame: 0,
            sleeping: 0,
        });
        const arrows = (game.level.objects?.[contactX]?.[contactY] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(arrows.length, 1);
        assert.equal(arrows[0].quan ?? arrows[0].quantity, 1);
        assert.equal(arrows[0].where, 'floor');
        assert.equal(game._goldCount, 19);
        assert.equal(game.context.move, 1);
    });

test('seed0111 launched arrow hit damages its pet and mulches', async () => {
    const result = await runSegment({
        seed: 111,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx tdh',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[8], [
        'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=7', 'rnd(6)=5',
        'rn2(9)=5', 'rnd(5)=5', 'rn2(19)=9', 'rn2(3)=1',
        'rn2(40)=29', 'rn2(5)=1', 'rn2(100)=2', 'rn2(1)=0',
        'rn2(5)=1', 'rn2(40)=13', 'rn2(5)=3', 'rn2(100)=48',
        'rn2(4)=0', 'rn2(5)=4', 'rn2(12)=7', 'rn2(70)=40',
        'rn2(200)=72', 'rn2(20)=8', 'rn2(67)=46',
    ], 'seed0111 launched-arrow hit RNG');
    assert.equal(
        decodedTopline(result.getScreens()[8]),
        'Sirius yelps!  The arrow hits Sirius!',
    );
    assert.deepEqual(result.getCursors()[8], [32, 5, 1]);

    const sirius = game.level.monsters.find(monster =>
        monster.name === 'Sirius');
    assert.ok(sirius);
    assert.deepEqual(
        {
            mhp: sirius.mhp,
            mhpmax: sirius.mhpmax,
            mtame: sirius.mtame,
            pet: sirius.pet,
            abuse: sirius.edog?.abuse,
            mflee: sirius.mflee,
            mfleetim: sirius.mfleetim,
        },
        {
            mhp: 3,
            mhpmax: 8,
            mtame: 9,
            pet: true,
            abuse: 1,
            mflee: 1,
            mfleetim: 49,
        },
    );
    const parent = game.inventory.find(object =>
        object.otyp === ARROW && object.invlet === 'd');
    assert.equal(parent?.quantity ?? parent?.quan, 29);
    const contactArrows = game.level.objects?.[sirius.mx]?.[sirius.my]
        ?.filter(object => object.otyp === ARROW) || [];
    assert.equal(contactArrows.length, 0);
});

test('seed0111 enchanted arrow hit survives mulch and lands under its pet',
    async () => {
        const result = await runSegment({
            seed: 111,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx tch',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[8], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=7', 'rnd(6)=5',
            'rn2(9)=5', 'rnd(7)=6', 'rn2(19)=9', 'rn2(4)=3',
            'rn2(100)=29', 'rn2(40)=6', 'rn2(5)=2', 'rn2(100)=82',
            'rn2(20)=16', 'rn2(100)=53', 'rn2(8)=3', 'rn2(100)=48',
            'rn2(1)=0', 'rn2(5)=4', 'rn2(40)=31', 'rn2(5)=0',
            'rn2(100)=72', 'rn2(8)=0', 'rn2(100)=18', 'rn2(100)=29',
            'rn2(5)=3', 'rn2(12)=6', 'rn2(70)=43', 'rn2(200)=55',
            'rn2(20)=13', 'rn2(67)=55',
        ], 'seed0111 enchanted-arrow surviving-hit RNG');
        assert.equal(
            decodedTopline(result.getScreens()[8]),
            'Sirius yelps!  The arrow hits Sirius!',
        );
        assert.deepEqual(result.getCursors()[8], [32, 5, 1]);

        const sirius = game.level.monsters.find(monster =>
            monster.name === 'Sirius');
        assert.ok(sirius);
        assert.deepEqual(
            {
                mhp: sirius.mhp,
                mhpmax: sirius.mhpmax,
                mtame: sirius.mtame,
                abuse: sirius.edog?.abuse,
                mflee: sirius.mflee,
                mfleetim: sirius.mfleetim,
            },
            {
                mhp: 1,
                mhpmax: 8,
                mtame: 9,
                abuse: 1,
                mflee: 1,
                mfleetim: 59,
            },
        );
        const parent = game.inventory.find(object =>
            object.otyp === ARROW && object.invlet === 'c');
        assert.equal(parent?.quantity ?? parent?.quan, 57);
        const contactArrows = game.level.objects?.[sirius.mx]?.[sirius.my]
            ?.filter(object => object.otyp === ARROW
                && (object.spe ?? object.enchantment ?? 0) === 2) || [];
        assert.equal(contactArrows.length, 1);
        assert.equal(contactArrows[0].quantity ?? contactArrows[0].quan, 1);
    });

test('seed0106 two-arrow volley resumes inside its second hit', async () => {
    const result = await runSegment({
        seed: 106,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx tdh ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[8], [
        'rnd(2)=2', 'rnd(2)=1', 'rnd(20)=10', 'rn2(3)=0',
        'rn2(100)=42', 'rnd(2)=2', 'rnd(20)=3', 'rnd(6)=1',
        'rn2(9)=4', 'rnd(1)=1',
    ], 'seed0106 two-arrow pre-pager RNG');
    assert.equal(
        decodedTopline(result.getScreens()[8]),
        'You shoot 2 arrows.  The 1st arrow misses Sirius.  Sirius yelps!--More--',
    );
    assert.deepEqual(result.getCursors()[8], [72, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[9], [
        'rn2(19)=12', 'rn2(3)=1', 'rnl(4)=0', 'rn2(100)=5',
        'rn2(40)=5', 'rn2(5)=0', 'rn2(100)=27', 'rn2(20)=13',
        'rn2(100)=15', 'rn2(8)=1', 'rn2(5)=0', 'rn2(4)=3',
        'rn2(3)=1', 'rn2(3)=1', 'rn2(5)=3', 'rn2(5)=1',
        'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=1',
        'rn2(4)=3', 'rn2(5)=1', 'rn2(5)=2', 'rn2(5)=0',
        'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=4',
        'rn2(4)=0', 'rn2(5)=1', 'rn2(40)=7', 'rn2(5)=3',
        'rn2(100)=57', 'rn2(20)=17', 'rn2(100)=61', 'rn2(8)=0',
        'rn2(5)=3', 'rn2(12)=3', 'rn2(12)=10', 'rn2(12)=3',
        'rn2(12)=11', 'rn2(12)=5', 'rn2(70)=1', 'rn2(20)=13',
        'rn2(70)=45',
    ], 'seed0106 two-arrow resumed RNG');
    assert.equal(
        decodedTopline(result.getScreens()[9]),
        'The 2nd arrow hits Sirius.',
    );
    assert.deepEqual(result.getCursors()[9], [30, 16, 1]);

    const sirius = game.level.monsters.find(monster =>
        monster.name === 'Sirius');
    assert.ok(sirius);
    assert.deepEqual(
        {
            mhp: sirius.mhp,
            mhpmax: sirius.mhpmax,
            mtame: sirius.mtame,
            abuse: sirius.edog?.abuse,
            mflee: sirius.mflee,
            mfleetim: sirius.mfleetim,
        },
        {
            mhp: 5,
            mhpmax: 6,
            mtame: 9,
            abuse: 1,
            mflee: 1,
            mfleetim: 9,
        },
    );
    const parent = game.inventory.find(object =>
        object.otyp === ARROW && object.invlet === 'd');
    assert.equal(parent?.quantity ?? parent?.quan, 36);
    const contactArrows = game.level.objects?.[sirius.mx]?.[sirius.my]
        ?.filter(object => object.otyp === ARROW
            && !!object.blessed
            && (object.spe ?? object.enchantment ?? 0) === 0) || [];
    assert.equal(
        contactArrows.reduce((sum, object) =>
            sum + (object.quantity ?? object.quan ?? 1), 0),
        2,
    );
});

test('seed0366 non-pet arrow hit composes with a later pet kill', async () => {
    const result = await runSegment({
        seed: 366,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx tdh  ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[8], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=19', 'rn2(3)=2',
        'rn2(100)=39', 'rnd(2)=2', 'rnd(20)=4', 'rnd(6)=1',
    ], 'seed0366 non-pet hit pre-pager RNG');
    assert.equal(
        decodedTopline(result.getScreens()[8]),
        'You shoot 2 arrows.  The 1st arrow misses the lichen.--More--',
    );
    assert.deepEqual(result.getCursors()[8], [61, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[9], [
        'rn2(19)=9', 'rn2(3)=0', 'rn2(100)=74', 'rn2(5)=0',
        'rn2(100)=26', 'rn2(8)=4', 'rn2(100)=24', 'rn2(8)=3',
        'rn2(100)=89', 'rnd(20)=3', 'd(1,6)=2', 'rn2(3)=0',
        'rn2(6)=1',
    ], 'seed0366 hit and pet attack RNG');
    assert.equal(
        decodedTopline(result.getScreens()[9]),
        'The 2nd arrow hits the lichen.  Sirius bites the lichen.--More--',
    );
    assert.deepEqual(result.getCursors()[9], [64, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[10], [
        'rn2(2)=0', 'rnd(2)=2', 'rn2(3)=2', 'rn2(4)=3',
        'rn2(5)=0', 'rn2(7)=1', 'rn2(8)=2', 'rn2(11)=1',
        'rn2(15)=14', 'rn2(16)=10', 'rn2(21)=19', 'rn2(3)=2',
        'rn2(4)=0', 'rn2(5)=3', 'rn2(7)=6', 'rn2(8)=3',
        'rn2(11)=9', 'rn2(15)=1', 'rn2(16)=2', 'rn2(21)=20',
        'rnd(1)=1', 'rn2(5)=4', 'rn2(12)=2', 'rn2(70)=31',
        'rn2(20)=18', 'rn2(76)=7',
    ], 'seed0366 resumed lichen death RNG');
    assert.equal(decodedTopline(result.getScreens()[10]), 'The lichen is killed!');
    assert.deepEqual(result.getCursors()[10], [9, 5, 1]);
});

test('seed0015 peaceful shopkeeper misses retain state and proper name', async () => {
    const result = await runSegment({
        seed: 15,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00163\n  x tdu ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[13], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=14', 'rn2(3)=2',
        'rn2(100)=2', 'rnd(2)=2', 'rnd(20)=15',
    ], 'seed0015 first peaceful shopkeeper miss RNG');
    assert.equal(
        decodedTopline(result.getScreens()[13]),
        'You shoot 2 arrows.  The 1st arrow misses Kopasker.--More--',
    );
    assert.deepEqual(result.getCursors()[13], [59, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[14], [
        'rn2(3)=2', 'rn2(100)=47', 'rn2(5)=0', 'rn2(100)=20',
        'rn2(8)=2', 'rn2(100)=62', 'rn2(100)=9', 'rn2(100)=10',
        'rn2(100)=8', 'rn2(100)=70', 'rn2(100)=18', 'rn2(100)=5',
        'rn2(100)=61', 'rn2(100)=35', 'rn2(100)=48', 'rn2(100)=36',
        'rn2(100)=35', 'rn2(100)=90', 'rn2(100)=82', 'rn2(100)=13',
        'rn2(100)=28', 'rn2(100)=87', 'rn2(100)=65', 'rn2(100)=66',
        'rn2(100)=44', 'rn2(100)=15', 'rn2(100)=75', 'rn2(100)=34',
        'rn2(100)=8', 'rn2(100)=38', 'rn2(100)=9', 'rn2(100)=83',
        'rn2(100)=99', 'rn2(100)=47', 'rn2(100)=74', 'rn2(100)=42',
        'rn2(100)=15', 'rn2(1)=0', 'rn2(100)=32', 'rn2(2)=0',
        'rn2(3)=0', 'rn2(5)=0', 'rn2(4)=0', 'rn2(5)=2',
        'rn2(1)=0', 'rn2(2)=0', 'rn2(5)=3', 'rn2(4)=0',
        'rn2(5)=0', 'rn2(5)=2', 'rn2(5)=1', 'rn2(5)=2',
        'rn2(12)=11', 'rn2(12)=8', 'rn2(12)=2', 'rn2(12)=3',
        'rn2(70)=68', 'rn2(400)=164', 'rn2(200)=159', 'rn2(200)=83',
        'rn2(20)=4', 'rn2(67)=14',
    ], 'seed0015 resumed peaceful shopkeeper miss RNG');
    assert.equal(
        decodedTopline(result.getScreens()[14]),
        'The 2nd arrow misses Kopasker.',
    );
    assert.deepEqual(result.getCursors()[14], [14, 8, 1]);

    const shopkeeper = game.level.monsters.find(monster => monster.isshk);
    assert.ok(shopkeeper);
    assert.equal(shopkeeper.eshk?.shknam, 'Kopasker');
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(shopkeeper.eshk?.following ?? 0, 0);
});

test('seed0070 zero arrow-miss probe enters in-shop shopkeeper anger', async () => {
    const result = await runSegment({
        seed: 70,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00163\n  x tdk',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[13], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=11', 'rn2(3)=0',
        'rn2(100)=93', 'rnd(2)=1', 'rnd(20)=20',
    ], 'seed0070 first miss and anger RNG');
    assert.equal(
        decodedTopline(result.getScreens()[13]),
        'You shoot 2 arrows.  The 1st arrow misses Inuvik.  Inuvik gets angry!--More--',
    );
    assert.deepEqual(result.getCursors()[13], [77, 0, 1]);

    const shopkeeper = game.level.monsters.find(monster => monster.isshk);
    assert.ok(shopkeeper);
    assert.equal(shopkeeper.eshk?.shknam, 'Inuvik');
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.msleeping, 0);
    assert.equal(shopkeeper.eshk?.following ?? 0, 0);
    assert.equal(game._shopRooms?.current, 11);
    assert.equal(game.u.ualign?.record, 9);
});

test('seed0070 displaced target sends the angry shopkeeper striking wand east', async () => {
    const result = await runSegment({
        seed: 70,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00163\n  x tdk ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[14], [
        'rn2(3)=1', 'rn2(100)=69', 'rn2(5)=4', 'rn2(100)=12',
        'rn2(20)=16', 'rn2(100)=14', 'rn2(8)=7', 'rn2(100)=28',
        'rn2(8)=5', 'rn2(100)=12', 'rn2(8)=4', 'rn2(100)=59',
        'rn2(8)=0', 'rn2(100)=66', 'rn2(100)=5', 'rn2(100)=17',
        'rn2(100)=0', 'rn2(100)=35', 'rn2(100)=88', 'rn2(100)=3',
        'rn2(100)=26', 'rn2(100)=75', 'rn2(100)=51', 'rn2(1)=0',
        'rn2(100)=40', 'rn2(2)=0', 'rn2(100)=19', 'rn2(3)=0',
        'rn2(5)=4', 'rn2(4)=2', 'rn2(3)=1', 'rn2(3)=2',
        'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=1', 'rn2(3)=0',
        'rn2(3)=2', 'rn2(3)=0', 'rn2(5)=2', 'rn2(8)=6',
        'rn2(100)=18', 'rn2(100)=6', 'rn2(100)=88', 'rn2(4)=1',
        'rn2(3)=1', 'rn2(3)=1', 'rn2(5)=2', 'rn2(5)=1',
        'rn2(5)=1', 'rn2(100)=94', 'rn2(20)=2', 'rn2(4)=1',
    ], 'seed0070 false-target striking-wand RNG');
    assert.equal(
        decodedTopline(result.getScreens()[14]),
        'The 2nd arrow misses Inuvik.  Inuvik zaps an iridium wand!--More--',
    );
    assert.deepEqual(result.getCursors()[14], [66, 0, 1]);

    const shopkeeper = game.level.monsters.find(monster => monster.isshk);
    const wand = shopkeeper?.minvent?.find(
        object => object.otyp === WAN_STRIKING,
    );
    assert.ok(shopkeeper);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [69, 17]);
    assert.deepEqual([shopkeeper.mux, shopkeeper.muy], [70, 17]);
    assert.deepEqual([game.u.ux, game.u.uy], [69, 18]);
    assert.equal(game.objectDescriptions?.[WAN_STRIKING], 'iridium');
    assert.equal(wand?.spe, 7);
    assert.equal(shopkeeper.mwandexp, true);
});

test('seed0572 shopkeeper hit suspends before anger and shot two', async () => {
    const result = await runSegment({
        seed: 572,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00163\n  x tdk ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[13], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=3', 'rnd(6)=3',
    ], 'seed0572 first-hit suspension RNG');
    assert.equal(
        decodedTopline(result.getScreens()[13]),
        'You shoot 2 arrows.  The 1st arrow hits Tuktoyaktuk.--More--',
    );
    assert.deepEqual(result.getCursors()[13], [60, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[14], [
        'rn2(19)=2', 'rn2(3)=2', 'rnd(2)=2', 'rnd(20)=5',
        'rn2(3)=0', 'rn2(100)=68', 'rn2(5)=1', 'rn2(100)=51',
        'rn2(20)=4', 'rn2(1)=0', 'rn2(3)=0',
    ], 'seed0572 resumed anger and shot-two RNG');
    assert.equal(
        decodedTopline(result.getScreens()[14]),
        'Tuktoyaktuk gets angry!  The 2nd arrow misses Tuktoyaktuk.--More--',
    );
    assert.deepEqual(result.getCursors()[14], [66, 0, 1]);

    const shopkeeper = game.level.monsters.find(monster => monster.isshk);
    assert.ok(shopkeeper);
    assert.equal(shopkeeper.eshk?.shknam, 'Tuktoyaktuk');
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.mhp, 42);
    assert.equal(shopkeeper.eshk?.following ?? 0, 0);
    assert.equal(game.u.ualign?.record, 9);
});

test('seed0645 surviving arrow corrodes on the acid blob passive', async () => {
    const result = await runSegment({
        seed: 645,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00163\n  x tdl ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[13], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=15', 'rn2(3)=0',
        'rn2(100)=26', 'rnd(2)=2', 'rnd(20)=1', 'rnd(6)=5',
    ], 'seed0645 pre-passive volley RNG');
    assert.equal(
        decodedTopline(result.getScreens()[13]),
        'You shoot 2 arrows.  The 1st arrow misses the acid blob.--More--',
    );
    assert.deepEqual(result.getCursors()[13], [64, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[14], [
        'rn2(19)=10', 'rn2(3)=0', 'rn2(6)=0', 'rn2(100)=57',
        'rn2(5)=0', 'rn2(100)=43', 'rn2(8)=5', 'rn2(100)=78',
        'rn2(8)=0', 'rn2(5)=2', 'rn2(5)=1', 'rn2(100)=36',
        'rn2(8)=2', 'rn2(100)=39', 'rn2(5)=1', 'rn2(12)=1',
        'rn2(12)=4', 'rn2(12)=5', 'rn2(12)=9', 'rn2(70)=69',
        'rn2(400)=258', 'rn2(20)=1', 'rn2(73)=50',
    ], 'seed0645 acid passive and scheduler RNG');
    assert.equal(
        decodedTopline(result.getScreens()[14]),
        'The 2nd arrow hits the acid blob!  The arrow corrodes!',
    );
    assert.deepEqual(result.getCursors()[14], [47, 4, 1]);

    const blob = game.level.monsters.find(monster => monster.mnum === 6);
    assert.ok(blob);
    assert.equal(blob.mhp, 3);
    const floorArrows = (game.level.objects?.[51]?.[3] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 2);
    assert.deepEqual(
        floorArrows.map(object => object.oeroded2 ?? 0).sort(),
        [0, 1],
    );
});

test('seed0237 greased arrow resists acid passive and loses grease',
    async () => {
        const result = await runSegment({
            seed: 237,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
                + '#wizgenesis\npeaceful acid blob\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 80);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(56)=48', 'rnd(2)=1', 'rn2(6)=3', 'rn2(11)=2',
            'rn2(10)=2', 'rn2(10)=2', 'rn2(100)=70',
            'rn2(100)=2', 'rn2(80)=53', 'rn2(80)=34',
            'rn2(1000)=30', 'rn2(100)=84',
        ], 'seed0237 greased-arrow acid wish RNG');
        assert.equal(decodedTopline(result.getScreens()[43]),
            'g - 2 greased arrows.');
        assert.deepEqual(result.getCursors()[43], [68, 5, 1]);

        assertRngSliceExact(result.getRngSlices()[77], [
            'rnd(2)=1', 'rnd(2)=1', 'rn2(7)=2', 'rnd(20)=6',
            'rnd(6)=2', 'rn2(19)=2', 'rn2(4)=2', 'rn2(6)=0',
            'rn2(2)=0', 'rn2(100)=11', 'rn2(4)=0', 'rn2(5)=4',
            'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=1', 'rn2(5)=1',
            'rn2(4)=0', 'rn2(5)=1', 'rn2(5)=3', 'rn2(12)=9',
            'rn2(12)=11', 'rn2(12)=2', 'rn2(12)=4',
            'rn2(70)=69', 'rn2(20)=1', 'rn2(70)=14',
        ], 'seed0237 acid grease-wear and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[77]),
            'The arrow hits the acid blob.');
        assert.deepEqual(result.getCursors()[77], [68, 5, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 70,
            y: 3,
            hp: 4,
            hpmax: 8,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[70]?.[3] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            greased: floorArrows[0].greased ?? false,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            greased: false,
            corrosion: 0,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            greased: inventorySibling.greased ?? false,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            greased: true,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0343 greased arrow resists acid passive and retains grease',
    async () => {
        const result = await runSegment({
            seed: 343,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
                + '#wizgenesis\npeaceful acid blob\ntgy  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 80);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(56)=14', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=10',
            'rn2(10)=8', 'rn2(10)=9', 'rn2(100)=43',
            'rn2(100)=40', 'rn2(80)=34', 'rn2(80)=66',
            'rn2(1000)=755', 'rn2(100)=35',
        ], 'seed0343 greased-arrow acid wish RNG');
        assert.equal(decodedTopline(result.getScreens()[43]),
            'g - 2 greased arrows.');
        assert.deepEqual(result.getCursors()[43], [61, 6, 1]);

        assertRngSliceExact(result.getRngSlices()[77], [
            'rnd(2)=1', 'rnd(2)=2', 'rn2(7)=4', 'rnd(20)=3',
            'rnd(6)=1', 'rn2(19)=6', 'rn2(4)=2', 'rn2(6)=0',
            'rn2(2)=1', 'rn2(100)=30', 'rn2(4)=0', 'rn2(5)=1',
            'rn2(5)=0', 'rn2(12)=2', 'rn2(12)=7', 'rn2(70)=2',
            'rn2(400)=315', 'rn2(200)=137', 'rn2(20)=1',
            'rn2(73)=41',
        ], 'seed0343 acid grease-retention and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[77]),
            'The arrow hits the acid blob.');
        assert.deepEqual(result.getCursors()[77], [61, 6, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 61,
            y: 4,
            hp: 5,
            hpmax: 8,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[61]?.[4] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            greased: floorArrows[0].greased ?? false,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            greased: true,
            corrosion: 0,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            greased: inventorySibling.greased ?? false,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            greased: true,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0320 iron orcish arrow corrodes on acid-blob passive',
    async () => {
        const result = await runSegment({
            seed: 320,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizgenesis\npeaceful acid blob\ntgj  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 79);
        assertRngSliceExact(result.getRngSlices()[42], [
            'rn2(21)=18', 'rnd(2)=2', 'rn2(6)=3', 'rn2(11)=2',
            'rn2(10)=9', 'rn2(10)=1', 'rn2(100)=7',
            'rn2(100)=55', 'rn2(80)=43', 'rn2(80)=45',
            'rn2(1000)=883', 'rn2(100)=90',
        ], 'seed0320 orcish-arrow acid wish RNG');
        assert.equal(decodedTopline(result.getScreens()[42]),
            'g - 2 orcish arrows.');
        assert.deepEqual(result.getCursors()[42], [42, 10, 1]);

        assertRngSliceExact(result.getRngSlices()[76], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=4', 'rnd(5)=5',
            'rn2(19)=6', 'rn2(4)=3', 'rn2(6)=0', 'rn2(100)=36',
            'rn2(4)=1', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=1',
            'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=4', 'rn2(5)=4',
            'rn2(5)=0', 'rn2(5)=1', 'rn2(12)=10', 'rn2(12)=2',
            'rn2(70)=64', 'rn2(20)=17', 'rn2(70)=7',
        ], 'seed0320 orcish-arrow acid material and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[76]),
            'The orcish arrow hits the acid blob!  The orcish arrow corrodes!');
        assert.deepEqual(result.getCursors()[76], [42, 10, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 43,
            y: 10,
            hp: 1,
            hpmax: 8,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[43]?.[10] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 1,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ORCISH_ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0320 wooden elven arrow ignores acid-blob corrosion', async () => {
    const result = await runSegment({
        seed: 320,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx #wizwish\n2 uncursed +2 elven arrows\n'
            + '#wizgenesis\npeaceful acid blob\ntgj  ',
        storage: new Map(),
    });

    assert.equal(result.getScreens().length, 78);
    assertRngSliceExact(result.getRngSlices()[41], [
        'rn2(21)=18', 'rnd(2)=2', 'rn2(6)=3', 'rn2(11)=2',
        'rn2(10)=9', 'rn2(10)=1', 'rn2(100)=7',
        'rn2(100)=55', 'rn2(80)=43', 'rn2(80)=45',
        'rn2(1000)=883', 'rn2(100)=90',
    ], 'seed0320 elven-arrow acid wish RNG');
    assert.equal(decodedTopline(result.getScreens()[41]),
        'g - 2 elven arrows.');
    assert.deepEqual(result.getCursors()[41], [42, 10, 1]);

    assertRngSliceExact(result.getRngSlices()[75], [
        'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=4', 'rnd(7)=5',
        'rn2(19)=6', 'rn2(4)=3', 'rn2(6)=0', 'rn2(100)=36',
        'rn2(4)=1', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=1',
        'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=4', 'rn2(5)=4',
        'rn2(5)=0', 'rn2(5)=1', 'rn2(12)=10', 'rn2(12)=2',
        'rn2(70)=64', 'rn2(20)=17', 'rn2(70)=7',
    ], 'seed0320 elven-arrow acid material-negative RNG');
    assert.equal(decodedTopline(result.getScreens()[75]),
        'The elven arrow hits the acid blob!');
    assert.deepEqual(result.getCursors()[75], [42, 10, 1]);

    const blob = game.level.monsters.find(monster => monster.mnum === 6);
    assert.ok(blob);
    assert.deepEqual({
        x: blob.mx,
        y: blob.my,
        hp: blob.mhp,
        hpmax: blob.mhpmax,
        peaceful: blob.mpeaceful,
        cancelled: blob.mcan ?? 0,
    }, {
        x: 43,
        y: 10,
        hp: 1,
        hpmax: 8,
        peaceful: 0,
        cancelled: 0,
    });

    const floorArrows = (game.level.objects?.[43]?.[10] || [])
        .filter(object => object.otyp === ELVEN_ARROW);
    assert.equal(floorArrows.length, 1);
    assert.deepEqual({
        quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
        enchantment: floorArrows[0].spe ?? 0,
        corrosion: floorArrows[0].oeroded2 ?? 0,
        where: floorArrows[0].where,
    }, {
        quantity: 1,
        enchantment: 2,
        corrosion: 0,
        where: 'floor',
    });

    const inventorySibling = game.inventory.find(object =>
        object.otyp === ELVEN_ARROW && object.invlet === 'g');
    assert.ok(inventorySibling);
    assert.deepEqual({
        quantity: inventorySibling.quantity ?? inventorySibling.quan,
        enchantment: inventorySibling.spe ?? 0,
        corrosion: inventorySibling.oeroded2 ?? 0,
    }, {
        quantity: 1,
        enchantment: 2,
        corrosion: 0,
    });
    assert.equal(game.context.move, 0);
});

test('seed0320 corrodeproof arrow learns proof on acid-blob passive',
    async () => {
        const result = await runSegment({
            seed: 320,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed corrodeproof +2 arrows\n'
                + '#wizgenesis\npeaceful acid blob\ntgj  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 85);
        assertRngSliceExact(result.getRngSlices()[48], [
            'rn2(56)=32', 'rnd(2)=2', 'rn2(6)=3', 'rn2(11)=2',
            'rn2(10)=9', 'rn2(10)=1', 'rn2(100)=7',
            'rn2(100)=55', 'rn2(80)=43', 'rn2(80)=45',
            'rn2(1000)=883', 'rn2(100)=90',
        ], 'seed0320 corrodeproof-arrow acid wish RNG');
        assert.equal(decodedTopline(result.getScreens()[48]),
            'g - 2 arrows.');
        assert.deepEqual(result.getCursors()[48], [42, 10, 1]);

        assertRngSliceExact(result.getRngSlices()[82], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=4', 'rnd(6)=4',
            'rn2(19)=6', 'rn2(4)=3', 'rn2(6)=0',
        ], 'seed0320 acid proof hit and passive prefix RNG');
        assert.equal(decodedTopline(result.getScreens()[82]),
            'The arrow hits the acid blob!--More--');
        assert.deepEqual(result.getCursors()[82], [37, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[83], [
            'rn2(100)=36', 'rn2(4)=1', 'rn2(3)=2', 'rn2(3)=1',
            'rn2(5)=1', 'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=4',
            'rn2(5)=4', 'rn2(5)=0', 'rn2(5)=1', 'rn2(12)=10',
            'rn2(12)=2', 'rn2(70)=64', 'rn2(20)=17',
            'rn2(70)=7',
        ], 'seed0320 acid proof floor and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[83]),
            'Somehow, the arrow is not affected by the corrosion.');
        assert.deepEqual(result.getCursors()[83], [42, 10, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 43,
            y: 10,
            hp: 2,
            hpmax: 8,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[43]?.[10] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            proof: true,
            proofKnown: true,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
            proof: inventorySibling.oerodeproof ?? false,
            proofKnown: inventorySibling.rknown ?? false,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            proof: true,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed1032 blessed arrow silently resists acid-blob corrosion',
    async () => {
        const result = await runSegment({
            seed: 1032,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 blessed +2 arrows\n'
                + '#wizgenesis\npeaceful acid blob\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 71);
        assertRngSliceExact(result.getRngSlices()[34], [
            'rn2(56)=8', 'rnd(2)=1', 'rn2(6)=4', 'rn2(11)=4',
            'rn2(10)=2', 'rn2(10)=5', 'rn2(100)=95',
            'rn2(100)=59', 'rn2(80)=19', 'rn2(80)=35',
            'rn2(1000)=807', 'rn2(100)=20',
        ], 'seed1032 blessed-arrow acid wish RNG');
        assert.equal(decodedTopline(result.getScreens()[34]),
            'g - 2 arrows.');
        assert.deepEqual(result.getCursors()[34], [31, 7, 1]);

        assertRngSliceExact(result.getRngSlices()[68], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=9', 'rnd(6)=2',
            'rn2(19)=7', 'rn2(4)=2', 'rnl(4)=3', 'rn2(6)=0',
            'rnl(4)=0', 'rn2(100)=30', 'rn2(4)=2', 'rn2(3)=0',
            'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=0', 'rn2(5)=1',
            'rn2(4)=3', 'rn2(5)=4', 'rn2(5)=0', 'rn2(5)=0',
            'rn2(12)=3', 'rn2(12)=0', 'rn2(12)=8', 'rn2(70)=18',
            'rn2(400)=172', 'rn2(200)=197', 'rn2(20)=2',
            'rn2(73)=50',
        ], 'seed1032 acid blessed protection and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[68]),
            'The arrow hits the acid blob.');
        assert.deepEqual(result.getCursors()[68], [31, 7, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 33,
            y: 5,
            hp: 2,
            hpmax: 6,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[33]?.[5] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
            blessed: inventorySibling.blessed ?? false,
            proof: inventorySibling.oerodeproof ?? false,
            proofKnown: inventorySibling.rknown ?? false,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

for (const degreeCase of [
    {
        name: 'seed0605 corroded arrow corrodes further on acid-blob passive',
        wish: '2 corroded +2 arrows',
        states: 72,
        wishIndex: 35,
        wishTop: 'g - 2 corroded arrows.',
        actionIndex: 69,
        mulch: 'rn2(2)=0',
        actionTop: 'The arrow hits the acid blob!  The arrow corrodes further!',
        targetHp: 3,
        before: 1,
        after: 2,
    },
    {
        name: 'seed0605 very corroded arrow corrodes completely on acid passive',
        wish: '2 very corroded +2 arrows',
        states: 77,
        wishIndex: 40,
        wishTop: 'g - 2 very corroded arrows.',
        actionIndex: 74,
        mulch: 'rn2(3)=0',
        actionTop: 'The arrow hits the acid blob.  The arrow corrodes completely!',
        targetHp: 4,
        before: 2,
        after: 3,
    },
    {
        name: 'seed0605 completely corroded arrow ignores further acid corrosion',
        wish: '2 thoroughly corroded +2 arrows',
        states: 83,
        wishIndex: 46,
        wishTop: 'g - 2 thoroughly corroded arrows.',
        actionIndex: 80,
        mulch: 'rn2(4)=0',
        actionTop: 'The arrow hits the acid blob.',
        targetHp: 5,
        before: 3,
        after: 3,
    },
]) {
    test(degreeCase.name, async () => {
        const result = await runSegment({
            seed: 605,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: `  nx #wizwish\n${degreeCase.wish}\n`
                + '#wizgenesis\npeaceful acid blob\ntgh  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, degreeCase.states);
        assertRngSliceExact(result.getRngSlices()[degreeCase.wishIndex], [
            'rn2(56)=55', 'rnd(2)=2', 'rn2(6)=5', 'rn2(11)=4',
            'rn2(10)=8', 'rn2(10)=9', 'rn2(100)=66',
            'rn2(100)=83', 'rn2(80)=61', 'rn2(80)=48',
            'rn2(1000)=706', 'rn2(100)=87',
        ], `${degreeCase.name} wish RNG`);
        assert.equal(decodedTopline(
            result.getScreens()[degreeCase.wishIndex]), degreeCase.wishTop);
        assert.deepEqual(result.getCursors()[degreeCase.wishIndex],
            [56, 4, 1]);

        assertRngSliceExact(result.getRngSlices()[degreeCase.actionIndex], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=6', 'rnd(6)=4',
            'rn2(19)=13', degreeCase.mulch, 'rn2(6)=0',
            'rn2(100)=6', 'rn2(4)=2', 'rn2(3)=1', 'rn2(3)=0',
            'rn2(5)=1', 'rn2(4)=0', 'rn2(5)=3', 'rn2(4)=0',
            'rn2(5)=3', 'rn2(5)=3', 'rn2(12)=9', 'rn2(12)=9',
            'rn2(12)=8', 'rn2(12)=7', 'rn2(12)=8', 'rn2(70)=48',
            'rn2(200)=9', 'rn2(20)=0', 'rn2(70)=61',
        ], `${degreeCase.name} action and scheduler RNG`);
        assert.equal(decodedTopline(
            result.getScreens()[degreeCase.actionIndex]),
        degreeCase.actionTop);
        assert.deepEqual(result.getCursors()[degreeCase.actionIndex],
            [56, 4, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 56,
            y: 3,
            hp: degreeCase.targetHp,
            hpmax: 8,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[56]?.[3] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: degreeCase.after,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: degreeCase.before,
        });
        assert.equal(game.context.move, 0);
    });
}

test('seed0116 cancellation wand leaves acid passive active for orcish arrow',
    async () => {
        const result = await runSegment({
            seed: 116,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nwand of cancellation\n'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful acid blob\n'
                + 'zhjaijtgj  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 136);
        assertRngSliceExact(result.getRngSlices()[72], [
            'rn2(46)=45', 'rnd(2)=2', 'rn2(5)=2', 'rn2(17)=2',
            'rn2(100)=67',
        ], 'seed0116 cancellation-wand wish RNG');
        assert.equal(decodedTopline(result.getScreens()[72]),
            'h - a runed wand.');
        assert.deepEqual(result.getCursors()[72], [30, 9, 1]);

        assertRngSliceExact(result.getRngSlices()[127], [
            'rn2(19)=6', 'rn2(8)=3', 'rn2(111)=54',
            'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=2',
            'rn2(4)=3', 'rn2(5)=1', 'rn2(5)=1', 'rn2(5)=2',
            'rn2(5)=1', 'rn2(5)=3', 'rn2(12)=3', 'rn2(12)=5',
            'rn2(70)=41', 'rn2(400)=357', 'rn2(20)=9',
            'rn2(70)=47',
        ], 'seed0116 cancellation wand and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[127]), '');
        assert.deepEqual(result.getCursors()[127], [30, 9, 1]);

        assertRngSliceExact(result.getRngSlices()[130], [],
            'seed0116 cancelled status RNG');
        assert.equal(decodedTopline(result.getScreens()[130]),
            'Status of the acid blob (neutral, tiny):  Level 1  HP 4(4)  AC 8, cancelled.');
        assert.deepEqual(result.getCursors()[130], [30, 9, 1]);

        assertRngSliceExact(result.getRngSlices()[133], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=10', 'rnd(5)=1',
            'rn2(19)=8', 'rn2(4)=1', 'rn2(6)=0', 'rn2(100)=77',
            'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=3', 'rn2(5)=1',
            'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=1', 'rn2(24)=8',
            'rn2(5)=2', 'rn2(12)=9', 'rn2(12)=5', 'rn2(70)=5',
            'rn2(400)=257', 'rn2(20)=14', 'rn2(70)=60',
        ], 'seed0116 cancelled acid passive and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[133]),
            'The orcish arrow hits the acid blob.  The orcish arrow corrodes!');
        assert.deepEqual(result.getCursors()[133], [30, 9, 1]);

        const blob = game.level.monsters.find(monster => monster.mnum === 6);
        assert.ok(blob);
        assert.deepEqual({
            x: blob.mx,
            y: blob.my,
            hp: blob.mhp,
            hpmax: blob.mhpmax,
            peaceful: blob.mpeaceful,
            cancelled: blob.mcan ?? 0,
        }, {
            x: 31,
            y: 9,
            hp: 1,
            hpmax: 4,
            peaceful: 0,
            cancelled: 1,
        });

        const floorArrows = (game.level.objects?.[31]?.[9] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 1,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ORCISH_ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
        });

        const cancellationWand = game.inventory.find(object =>
            object.otyp === WAN_CANCELLATION && object.invlet === 'h');
        assert.ok(cancellationWand);
        assert.deepEqual({
            enchantment: cancellationWand.spe,
            chargesKnown: cancellationWand.chargesKnown ?? false,
        }, {
            enchantment: 5,
            chargesKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0205 cancelled rust monster suppresses orcish-arrow rust passive',
    async () => {
        const result = await runSegment({
            seed: 205,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nwand of cancellation\n'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'zhuaiu tgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 140);
        assertRngSliceExact(result.getRngSlices()[130], [
            'rn2(19)=12', 'rn2(8)=7', 'rn2(108)=57',
            'rn2(4)=3', 'rn2(3)=1', 'rn2(3)=2', 'rn2(3)=1',
            'rn2(3)=1', 'rn2(5)=0', 'rn2(5)=1', 'rn2(12)=6',
            'rn2(12)=7', 'rn2(70)=21', 'rn2(300)=230',
            'rn2(20)=6', 'rn2(73)=12',
        ], 'seed0205 cancelled rust-monster wand and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[130]), '');
        assert.deepEqual(result.getCursors()[130], [20, 16, 1]);

        assertRngSliceExact(result.getRngSlices()[133], [],
            'seed0205 cancelled rust-monster status RNG');
        assert.equal(decodedRow(result.getScreens()[133], 0),
            'Status of the rust monster (neutral, medium):  Level 4  HP 9(9)  AC 2,');
        assert.equal(decodedRow(result.getScreens()[133], 1),
            'cancelled.--More--');
        assert.deepEqual(result.getCursors()[133], [18, 1, 1]);

        assertRngSliceExact(result.getRngSlices()[137], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=2', 'rnd(5)=2',
            'rn2(19)=12', 'rn2(4)=2', 'rn2(100)=79',
            'rn2(5)=0', 'rnd(20)=14', 'd(0,0)=0', 'rn2(3)=0',
            'rn2(6)=0', 'rnd(21)=21',
        ], 'seed0205 cancelled rust touch and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[137]),
            'The orcish arrow hits the rust monster.  The rust monster touches you!--More--');
        assert.deepEqual(result.getCursors()[137], [78, 0, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 22,
            y: 14,
            hp: 5,
            hpmax: 9,
            peaceful: 0,
            cancelled: 1,
        });

        const floorArrows = (game.level.objects?.[22]?.[14] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ORCISH_ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            rust: inventorySibling.oeroded ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0002 cancelled black pudding suppresses orcish-arrow corrosion',
    async () => {
        const result = await runSegment({
            seed: 2,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nwand of cancellation\n'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful black pudding\n'
                + 'zhhaih tgh  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 141);
        assertRngSliceExact(result.getRngSlices()[131], [
            'rn2(19)=7', 'rn2(8)=3', 'rn2(103)=83',
            'rn2(4)=0', 'rn2(5)=2', 'rn2(5)=2', 'rn2(12)=6',
            'rn2(12)=5', 'rn2(12)=0', 'rn2(70)=51',
            'rn2(400)=308', 'rn2(300)=50', 'rn2(20)=14',
            'rn2(67)=12',
        ], 'seed0002 cancelled black-pudding wand and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[131]), '');
        assert.deepEqual(result.getCursors()[131], [47, 17, 1]);

        assertRngSliceExact(result.getRngSlices()[134], [],
            'seed0002 cancelled black-pudding status RNG');
        assert.equal(decodedRow(result.getScreens()[134], 0),
            'Status of the black pudding (neutral, large):  Level 9  HP 35(35)  AC 6,');
        assert.equal(decodedRow(result.getScreens()[134], 1),
            'cancelled.--More--');
        assert.deepEqual(result.getCursors()[134], [18, 1, 1]);

        assertRngSliceExact(result.getRngSlices()[138], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=4', 'rnd(6)=6',
            'rn2(19)=6', 'rn2(4)=1', 'rn2(100)=44',
            'rn2(4)=2', 'rn2(3)=1', 'rn2(3)=1', 'rn2(5)=3',
            'rn2(5)=3', 'rn2(5)=4', 'rn2(32)=21', 'rn2(5)=0',
            'rn2(12)=6', 'rn2(12)=7', 'rn2(12)=2', 'rn2(70)=3',
            'rn2(400)=54', 'rn2(300)=193', 'rn2(20)=8',
            'rn2(67)=18',
        ], 'seed0002 cancelled black-pudding projectile and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[138]),
            'The orcish arrow hits the black pudding!');
        assert.deepEqual(result.getCursors()[138], [47, 17, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 47,
            y: 16,
            hp: 27,
            hpmax: 35,
            peaceful: 0,
            cancelled: 1,
        });

        const floorArrows = (game.level.objects?.[47]?.[16] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ORCISH_ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.deepEqual({
            quantity: inventorySibling.quantity ?? inventorySibling.quan,
            enchantment: inventorySibling.spe ?? 0,
            rust: inventorySibling.oeroded ?? 0,
            corrosion: inventorySibling.oeroded2 ?? 0,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0002 orcish arrow leads cancelled black-pudding bite damage',
    async () => {
        const result = await runSegment({
            seed: 2,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed +2 helmet\nWh'
                + '#wizwish\nwand of cancellation\n'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful black pudding\n'
                + 'zikajk tgk  m. m. m.        ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 187);
        assertRngSliceExact(result.getRngSlices()[164], [],
            'seed0002 cancelled worn-corrosion status RNG');
        assert.equal(decodedRow(result.getScreens()[164], 0),
            'Status of the black pudding (neutral, large):  Level 9  HP 49(49)  AC 6,');
        assert.equal(decodedRow(result.getScreens()[164], 1),
            'cancelled.--More--');
        assert.deepEqual(result.getCursors()[164], [18, 1, 1]);

        assertRngSliceExact(result.getRngSlices()[175], [
            'rn2(5)=0', 'rnd(20)=11', 'd(3,8)=19',
            'rn2(3)=0', 'rn2(6)=3',
        ], 'seed0002 cancelled corrosion bite and knockback RNG');
        assert.equal(decodedTopline(result.getScreens()[175]),
            'The black pudding bites!--More--');
        assert.equal(decodedRow(result.getScreens()[175], 23),
            'Dlvl:1 $:0 HP:0(15) Pw:2(2) AC:4 Xp:1');
        assert.deepEqual(result.getCursors()[175], [32, 0, 1]);

        assert.equal(decodedTopline(result.getScreens()[176]),
            'You die...--More--');
        assert.equal(decodedTopline(result.getScreens()[179]),
            'Die? [yn] (n)');
        assertRngSliceExact(result.getRngSlices()[180], [
            'rn2(4)=3', 'rn2(5)=0', 'rn2(5)=4', 'rn2(5)=0',
            'rn2(5)=2', 'rn2(5)=0', 'rn2(4)=0', 'rn2(12)=11',
            'rn2(5)=3', 'rn2(12)=4', 'rn2(12)=1', 'rn2(12)=9',
            'rn2(70)=36', 'rn2(400)=26', 'rn2(300)=36',
            'rn2(20)=17', 'rn2(67)=18',
        ], 'seed0002 declined-death recovery and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[180]),
            "OK, so you don't die.  You survived that attempt on your life.");

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 48,
            y: 15,
            hp: 49,
            hpmax: 49,
            peaceful: 0,
            cancelled: 1,
        });
        assertWornCorrosionHelmet({ corrosion: 0 });
        assert.equal(game.u.uac, 4);
        assert.equal(game.u.uhp, 15);
        assert.equal(game.u.uhpmax, 15);
        assert.equal(game.context.move, 0);
    });

test('seed0053 orcish arrow leads rust touches from cloak to worn helmet',
    async () => {
        const result = await runSegment({
            seed: 53,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'ail tglm.    ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 141);
        assertRngSliceExact(result.getRngSlices()[70], [
            'rn2(11)=9', 'rnd(2)=1', 'rn2(10)=5', 'rn2(11)=5',
            'rn2(10)=2', 'rn2(10)=9', 'rn2(100)=58',
            'rn2(80)=27', 'rn2(80)=48', 'rn2(1000)=40',
            'rn2(100)=81',
        ], 'seed0053 helmet wish RNG');
        assert.equal(decodedTopline(result.getScreens()[70]),
            'h - a plumed helmet.');
        assert.deepEqual(result.getCursors()[70], [50, 3, 1]);
        assert.equal(decodedTopline(result.getScreens()[72]),
            'You finish your dressing maneuver.');

        assertRngSliceExact(result.getRngSlices()[130], [],
            'seed0053 uncancelled rust status RNG');
        assert.equal(decodedRow(result.getScreens()[130], 0),
            'Status of the rust monster (neutral, medium):  Level 4  HP 20(20)  AC 2,');
        assert.equal(decodedRow(result.getScreens()[130], 1),
            'peaceful.--More--');
        assert.deepEqual(result.getCursors()[130], [17, 1, 1]);

        assertRngSliceExact(result.getRngSlices()[136], [
            'rn2(4)=0', 'rn2(5)=4', 'rnd(20)=16', 'd(0,0)=0',
            'rn2(5)=1',
        ], 'seed0053 first rust-touch and body-slot RNG');
        assert.equal(decodedTopline(result.getScreens()[136]),
            'The rust monster touches you!--More--');
        assert.deepEqual(result.getCursors()[136], [37, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[137], [
            'rn2(3)=0', 'rn2(6)=5', 'rnd(21)=4', 'd(0,0)=0',
        ], 'seed0053 first rust post-hit and second-touch RNG');
        assert.equal(decodedTopline(result.getScreens()[137]),
            'Your cloak of displacement is not affected by oxidation.--More--');
        assert.deepEqual(result.getCursors()[137], [64, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[138], [
            'rn2(5)=3', 'rn2(5)=1',
        ], 'seed0053 second rust armor-slot RNG');
        assert.equal(decodedTopline(result.getScreens()[138]),
            'The rust monster touches you again!--More--');
        assert.deepEqual(result.getCursors()[138], [43, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[139], [
            'rn2(3)=1', 'rn2(6)=0', 'rn2(5)=4', 'rn2(16)=11',
            'rn2(5)=1', 'rn2(5)=4', 'rn2(12)=8', 'rn2(5)=4',
            'rn2(5)=1', 'rn2(20)=10', 'rn2(5)=2', 'rn2(5)=0',
            'rnd(20)=11', 'd(0,0)=0',
        ], 'seed0053 second post-hit and third-touch RNG');
        assert.equal(decodedTopline(result.getScreens()[139]),
            'Your cloak of displacement is not affected by oxidation.--More--');
        assert.deepEqual(result.getCursors()[139], [64, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[140], [
            'rn2(5)=0', 'rn2(3)=1', 'rn2(6)=4', 'rnd(21)=12',
            'd(0,0)=0',
        ], 'seed0053 helmet-rust and fourth-touch RNG');
        assert.equal(decodedTopline(result.getScreens()[140]),
            'The rust monster touches you!  Your plumed helmet rusts!--More--');
        assert.deepEqual(result.getCursors()[140], [64, 0, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 52,
            y: 2,
            hp: 15,
            hpmax: 20,
            peaceful: 0,
            cancelled: 0,
        });

        assert.ok(game.uarmh);
        assert.deepEqual({
            type: game.uarmh.otyp,
            letter: game.uarmh.invlet,
            enchantment: game.uarmh.spe,
            rust: game.uarmh.oeroded ?? 0,
            proof: game.uarmh.oerodeproof ?? false,
            proofKnown: game.uarmh.rknown ?? false,
        }, {
            type: HELMET,
            letter: 'h',
            enchantment: 2,
            rust: 1,
            proof: false,
            proofKnown: false,
        });
        assert.equal(game.uarmc?.otyp, CLOAK_OF_DISPLACEMENT);
        assert.equal(game.uarmc?.oeroded ?? 0, 0);

        const floorArrows = (game.level.objects?.[52]?.[2] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 1,
            where: 'floor',
        });

        const inventorySibling = game.inventory.find(object =>
            object.otyp === ORCISH_ARROW && object.invlet === 'g');
        assert.ok(inventorySibling);
        assert.equal(inventorySibling.oeroded ?? 0, 0);
        assert.equal(game.context.move, 1);
    });

test('seed0053 orcish arrow leads greased helmet retention then dissolution',
    async () => {
        const result = await runSegment({
            seed: 53,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed greased +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'ail tglm.          ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 155);
        assertRngSliceExact(result.getRngSlices()[148], [
            'rn2(5)=0',
        ], 'seed0053 first greased-helmet selection RNG');
        assert.equal(decodedTopline(result.getScreens()[148]),
            'The rust monster touches you!--More--');
        assert.deepEqual(result.getCursors()[148], [37, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[149], [
            'rn2(2)=1', 'rn2(3)=1', 'rn2(6)=2', 'rnd(21)=2',
            'd(0,0)=0',
        ], 'seed0053 grease retention and second touch RNG');
        assert.equal(decodedTopline(result.getScreens()[149]),
            'Your plumed helmet is protected by the layer of grease!--More--');
        assert.deepEqual(result.getCursors()[149], [63, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[150], [
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=0',
        ], 'seed0053 second greased-helmet selection RNG');
        assert.equal(decodedTopline(result.getScreens()[150]),
            'The rust monster touches you again!--More--');

        assertRngSliceExact(result.getRngSlices()[151], [
            'rn2(2)=0',
        ], 'seed0053 grease wear RNG');
        assert.equal(decodedTopline(result.getScreens()[151]),
            'Your plumed helmet is protected by the layer of grease!--More--');
        assert.deepEqual(result.getCursors()[151], [63, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[152], [
            'rn2(3)=0', 'rn2(6)=4', 'rn2(12)=4', 'rn2(12)=4',
            'rn2(12)=9', 'rn2(12)=8', 'rn2(70)=44',
            'rn2(300)=86', 'rn2(200)=140', 'rn2(20)=9',
            'rn2(79)=55',
        ], 'seed0053 grease dissolve and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[152]),
            'The grease dissolves.');

        assert.ok(game.uarmh);
        assert.deepEqual({
            type: game.uarmh.otyp,
            enchantment: game.uarmh.spe,
            rust: game.uarmh.oeroded ?? 0,
            greased: game.uarmh.greased ?? false,
        }, {
            type: HELMET,
            enchantment: 2,
            rust: 0,
            greased: false,
        });
        assert.equal(game.uarmc?.oeroded ?? 0, 0);
        assert.equal(game.context.move, 0);
    });

test('seed0053 orcish arrow leads rustproof helmet learning and cloak retry',
    async () => {
        const result = await runSegment({
            seed: 53,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed rustproof +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'ail tglm.          ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 157);
        assertRngSliceExact(result.getRngSlices()[150], [
            'rn2(5)=0',
        ], 'seed0053 rustproof helmet selection RNG');
        assert.equal(decodedTopline(result.getScreens()[150]),
            'The rust monster touches you!--More--');

        assertRngSliceExact(result.getRngSlices()[151], [
            'rn2(5)=4', 'rn2(5)=1',
        ], 'seed0053 proof learning and resumed armor selection RNG');
        assert.equal(decodedTopline(result.getScreens()[151]),
            'Somehow, your plumed helmet is not affected by the oxidation.--More--');
        assert.deepEqual(result.getCursors()[151], [69, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[152], [
            'rn2(3)=2', 'rn2(6)=1', 'rnd(21)=8', 'd(0,0)=0',
        ], 'seed0053 proof body-stop and second touch RNG');
        assert.equal(decodedTopline(result.getScreens()[152]),
            'Your cloak of displacement is not affected by oxidation.--More--');

        assert.ok(game.uarmh);
        assert.deepEqual({
            type: game.uarmh.otyp,
            enchantment: game.uarmh.spe,
            rust: game.uarmh.oeroded ?? 0,
            proof: game.uarmh.oerodeproof ?? false,
            proofKnown: game.uarmh.rknown ?? false,
        }, {
            type: HELMET,
            enchantment: 2,
            rust: 0,
            proof: true,
            proofKnown: true,
        });
        assert.equal(game.uarmc?.oeroded ?? 0, 0);
        assert.equal(game.context.move, 0);
    });

test('seed0141 orcish arrow leads silent blessed helmet rust protection',
    async () => {
        const result = await runSegment({
            seed: 141,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nblessed +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'aiy tgym.          ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 146);
        assertRngSliceExact(result.getRngSlices()[141], [
            'rn2(5)=0', 'rnl(4)=0', 'rn2(5)=3', 'rn2(5)=1',
        ], 'seed0141 blessed protection and body selection RNG');
        assert.equal(decodedTopline(result.getScreens()[141]),
            'The rust monster touches you again!--More--');
        assert.deepEqual(result.getCursors()[141], [43, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[142], [
            'rn2(3)=2', 'rn2(6)=0', 'rn2(12)=0', 'rn2(12)=4',
            'rn2(12)=1', 'rn2(12)=2', 'rn2(70)=14',
            'rn2(20)=9', 'rn2(76)=36',
        ], 'seed0141 silent blessing body-stop and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[142]),
            'Your cloak of displacement is not affected by oxidation.');

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
        }, {
            x: 49,
            y: 15,
            hp: 13,
            hpmax: 17,
            peaceful: 0,
        });

        assert.ok(game.uarmh);
        assert.deepEqual({
            type: game.uarmh.otyp,
            enchantment: game.uarmh.spe,
            rust: game.uarmh.oeroded ?? 0,
            blessed: game.uarmh.blessed ?? false,
            proof: game.uarmh.oerodeproof ?? false,
            proofKnown: game.uarmh.rknown ?? false,
        }, {
            type: HELMET,
            enchantment: 2,
            rust: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
        });
        assert.equal(game.uarmc?.oeroded ?? 0, 0);
        assert.equal(game.context.move, 0);
    });

test('seed0053 orcish arrow drives rusty helmet through further and complete',
    async () => {
        const result = await runSegment({
            seed: 53,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed rusty +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'ail tglm.          ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 153);
        assertRngSliceExact(result.getRngSlices()[146], [
            'rn2(5)=0', 'rn2(3)=1', 'rn2(6)=4', 'rnd(21)=12',
            'd(0,0)=0',
        ], 'seed0053 rusty helmet further transition RNG');
        assert.equal(decodedTopline(result.getScreens()[146]),
            'The rust monster touches you!  Your plumed helmet rusts further!--More--');
        assert.deepEqual(result.getCursors()[146], [72, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[147], [
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=0',
        ], 'seed0053 second rusty helmet selection RNG');
        assert.equal(decodedTopline(result.getScreens()[147]),
            'The rust monster touches you again!--More--');

        assertRngSliceExact(result.getRngSlices()[148], [
            'rn2(3)=2', 'rn2(6)=0', 'rn2(12)=10', 'rn2(12)=4',
            'rn2(12)=4', 'rn2(12)=9', 'rn2(70)=18',
            'rn2(300)=14', 'rn2(200)=86', 'rn2(20)=0',
            'rn2(79)=33',
        ], 'seed0053 helmet complete-rust and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[148]),
            'Your plumed helmet rusts completely!');

        assert.ok(game.uarmh);
        assert.deepEqual({
            type: game.uarmh.otyp,
            enchantment: game.uarmh.spe,
            rust: game.uarmh.oeroded ?? 0,
        }, {
            type: HELMET,
            enchantment: 2,
            rust: 3,
        });
        assert.equal(game.uarmc?.oeroded ?? 0, 0);
        assert.equal(game.context.move, 0);
    });

test('seed0053 orcish arrow completes very rusty helmet then retries armor',
    async () => {
        const result = await runSegment({
            seed: 53,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed very rusty +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'ail tglm.          ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 158);
        assertRngSliceExact(result.getRngSlices()[151], [
            'rn2(5)=0', 'rn2(3)=1', 'rn2(6)=4', 'rnd(21)=12',
            'd(0,0)=0',
        ], 'seed0053 very-rusty helmet complete transition RNG');
        assert.equal(decodedTopline(result.getScreens()[151]),
            'The rust monster touches you!  Your plumed helmet rusts completely!--More--');
        assert.deepEqual(result.getCursors()[151], [75, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[152], [
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=0',
            'rn2(5)=4', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=3',
            'rn2(5)=0', 'rn2(5)=1',
        ], 'seed0053 max-rust retry to body RNG');
        assert.equal(decodedTopline(result.getScreens()[152]),
            'The rust monster touches you again!--More--');

        assert.equal(decodedTopline(result.getScreens()[153]),
            'Your cloak of displacement is not affected by oxidation.');
        assert.ok(game.uarmh);
        assert.equal(game.uarmh.oeroded ?? 0, 3);
        assert.equal(game.uarmc?.oeroded ?? 0, 0);
        assert.equal(game.context.move, 0);
    });

test('seed0053 orcish arrow leaves max-rust helmet silent and retries cloak',
    async () => {
        const result = await runSegment({
            seed: 53,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizwish\nuncursed thoroughly rusty +2 helmet\nWh'
                + '#wizwish\nstethoscope\n'
                + '#wizgenesis\npeaceful rust monster\n'
                + 'ail tglm.          ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 164);
        assertRngSliceExact(result.getRngSlices()[157], [
            'rn2(5)=0', 'rn2(5)=4', 'rn2(5)=1',
        ], 'seed0053 max-rust silent retry RNG');
        assert.equal(decodedTopline(result.getScreens()[157]),
            'The rust monster touches you!--More--');
        assert.deepEqual(result.getCursors()[157], [37, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[158], [
            'rn2(3)=2', 'rn2(6)=1', 'rnd(21)=8', 'd(0,0)=0',
        ], 'seed0053 max-rust body stop and second touch RNG');
        assert.equal(decodedTopline(result.getScreens()[158]),
            'Your cloak of displacement is not affected by oxidation.--More--');

        assert.ok(game.uarmh);
        assert.deepEqual({
            type: game.uarmh.otyp,
            enchantment: game.uarmh.spe,
            rust: game.uarmh.oeroded ?? 0,
        }, {
            type: HELMET,
            enchantment: 2,
            rust: 3,
        });
        assert.equal(game.uarmc?.oeroded ?? 0, 0);
        assert.equal(game.context.move, 0);
    });

const SEED0011_WORN_CORROSION_DIRECT_RNG = [
    'rn2(5)=0', 'rnd(20)=4', 'd(3,8)=12', 'rn2(5)=0',
    'rn2(3)=2', 'rn2(6)=5', 'rn2(5)=3', 'rn2(24)=0',
    'rn2(5)=4', 'rn2(4)=2', 'rn2(3)=1', 'rn2(3)=1',
    'rn2(5)=1', 'rn2(5)=4', 'rn2(4)=1', 'rn2(5)=1',
    'rn2(5)=4', 'rn2(5)=3', 'rn2(5)=4', 'rn2(5)=0',
    'rn2(5)=0', 'rn2(5)=4', 'rn2(5)=1', 'rn2(5)=2',
    'rn2(4)=0', 'rn2(20)=4', 'rn2(5)=2', 'rn2(12)=5',
    'rn2(12)=1', 'rn2(12)=2', 'rn2(12)=1', 'rn2(12)=8',
    'rn2(12)=6', 'rn2(70)=52', 'rn2(100)=19',
    'rn2(400)=97', 'rn2(300)=216', 'rn2(20)=4', 'rn2(73)=30',
];

const SEED0011_WORN_CORROSION_RETRY_TAIL_RNG = [
    'rn2(3)=1', 'rn2(6)=1', 'rn2(5)=1', 'rn2(24)=23',
    'rn2(5)=3', 'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1',
    'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=0', 'rn2(4)=2',
    'rn2(5)=1', 'rn2(5)=2', 'rn2(5)=0', 'rn2(5)=4',
    'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=1', 'rn2(5)=0',
    'rn2(5)=2', 'rn2(5)=1', 'rn2(5)=4', 'rn2(4)=0',
    'rn2(20)=19', 'rn2(5)=2', 'rn2(12)=0', 'rn2(12)=4',
    'rn2(12)=11', 'rn2(12)=0', 'rn2(12)=3', 'rn2(12)=0',
    'rn2(70)=15', 'rn2(100)=88', 'rn2(400)=144',
    'rn2(300)=60', 'rn2(20)=16', 'rn2(73)=4',
];

const SEED0011_SUIT_FATAL_RECOVERY_RNG = [
    'rn2(5)=1', 'rn2(24)=20', 'rn2(20)=19', 'rn2(5)=2',
    'rn2(5)=0', 'rn2(24)=10', 'rn2(5)=3', 'rn2(5)=2',
    'rn2(8)=7', 'rn2(5)=1', 'rn2(5)=2', 'rn2(20)=7',
    'rn2(5)=2', 'rn2(5)=0', 'rn2(20)=4', 'rn2(5)=2',
    'rn2(12)=6', 'rn2(12)=7', 'rn2(12)=7', 'rn2(12)=1',
    'rn2(12)=5', 'rn2(12)=8', 'rn2(70)=27', 'rn2(400)=44',
    'rn2(300)=84', 'rn2(20)=5', 'rn2(73)=17',
];

async function runWornCorrosionSegment({
    seed = 11,
    helmet = 'uncursed +2 helmet',
    acknowledgements = '        ',
} = {}) {
    return runSegment({
        seed,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
            + `#wizwish\n${helmet}\nWh`
            + '#wizwish\nstethoscope\n'
            + '#wizgenesis\npeaceful black pudding\n'
            + `ail tglm.${acknowledgements}`,
        storage: new Map(),
    });
}

async function runWornSuitCorrosionSegment(material) {
    return runSegment({
        seed: 11,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: `  nTe #wizwish\nuncursed +2 ${material} plate mail\n`
            + 'Wg     #wizgenesis\nblack pudding\n'
            + 'm. m. m. m.        ',
        storage: new Map(),
    });
}

function assertWornCorrosionHelmet({
    blessed = false,
    greased = false,
    proof = false,
    proofKnown = false,
    corrosion,
}) {
    assert.ok(game.uarmh);
    assert.deepEqual({
        type: game.uarmh.otyp,
        enchantment: game.uarmh.spe,
        blessed: !!game.uarmh.blessed,
        greased: !!game.uarmh.greased,
        proof: !!game.uarmh.oerodeproof,
        proofKnown: !!game.uarmh.rknown,
        rust: game.uarmh.oeroded ?? 0,
        corrosion: game.uarmh.oeroded2 ?? 0,
    }, {
        type: HELMET,
        enchantment: 2,
        blessed,
        greased,
        proof,
        proofKnown,
        rust: 0,
        corrosion,
    });
}

test('seed0011 orcish arrow provokes black-pudding bite corrosion',
    async () => {
        const result = await runWornCorrosionSegment({
            acknowledgements: '  ',
        });

        assert.equal(result.getScreens().length, 140);
        assertRngSliceExact(
            result.getRngSlices()[137],
            SEED0011_WORN_CORROSION_DIRECT_RNG,
            'seed0011 worn-helmet corrosion bite and scheduler RNG',
        );
        assert.equal(decodedTopline(result.getScreens()[137]),
            'The black pudding bites!  Your visored helmet corrodes!');
        assert.deepEqual(result.getCursors()[137], [70, 5, 1]);

        assertWornCorrosionHelmet({ corrosion: 1 });
        assert.equal(game.u.uac, 5);
        assert.equal(game.u.uhp, 3);
        assert.equal(game.u.uhpmax, 15);
        assert.equal(game.context.move, 0);
    });

test('seed0011 orcish arrow leads greased helmet corrosion retention',
    async () => {
        const result = await runWornCorrosionSegment({
            helmet: 'uncursed greased +2 helmet',
        });

        assert.equal(result.getScreens().length, 154);
        assertRngSliceExact(result.getRngSlices()[145], [
            'rn2(5)=0', 'rnd(20)=4', 'd(3,8)=12', 'rn2(5)=0',
        ], 'seed0011 greased helmet corrosion contact RNG');
        assert.equal(decodedTopline(result.getScreens()[145]),
            'The black pudding bites!--More--');
        assert.deepEqual(result.getCursors()[145], [32, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[146], [
            'rn2(2)=1', 'rn2(3)=2', 'rn2(6)=0', 'rn2(5)=0',
            'rn2(24)=7', 'rn2(5)=1', 'rn2(4)=3', 'rn2(3)=1',
            'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=0', 'rn2(5)=1',
            'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=4', 'rn2(5)=0',
            'rn2(5)=0', 'rn2(5)=4', 'rn2(5)=1', 'rn2(5)=2',
            'rn2(4)=0', 'rn2(5)=4', 'rn2(20)=12', 'rn2(5)=3',
            'rn2(12)=1', 'rn2(12)=2', 'rn2(12)=1', 'rn2(12)=8',
            'rn2(12)=6', 'rn2(12)=8', 'rn2(70)=39',
            'rn2(100)=97', 'rn2(400)=316', 'rn2(300)=4',
            'rn2(20)=15', 'rn2(73)=45',
        ], 'seed0011 grease retention and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[146]),
            'Your visored helmet is protected by the layer of grease!');
        assert.deepEqual(result.getCursors()[146], [70, 5, 1]);

        assertWornCorrosionHelmet({ greased: true, corrosion: 0 });
        assert.equal(game.u.uac, 4);
        assert.equal(game.u.uhp, 3);
        assert.equal(game.context.move, 0);
    });

test('seed0003 orcish arrow leads greased helmet corrosion wear',
    async () => {
        const result = await runWornCorrosionSegment({
            seed: 3,
            helmet: 'uncursed greased +2 helmet',
        });

        assert.equal(result.getScreens().length, 154);
        assertRngSliceExact(result.getRngSlices()[145], [
            'rn2(5)=1', 'rnd(20)=7', 'd(3,8)=11',
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=0',
        ], 'seed0003 greased helmet corrosion contact RNG');
        assert.equal(decodedTopline(result.getScreens()[145]),
            'The black pudding bites!--More--');

        assertRngSliceExact(result.getRngSlices()[146], [
            'rn2(2)=0',
        ], 'seed0003 grease wear RNG');
        assert.equal(decodedTopline(result.getScreens()[146]),
            'Your crested helmet is protected by the layer of grease!--More--');
        assert.deepEqual(result.getCursors()[146], [64, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[147], [
            'rn2(3)=0', 'rn2(6)=0', 'rn2(5)=0', 'rn2(12)=2',
            'rn2(5)=0', 'rn2(5)=2', 'rn2(32)=28', 'rn2(5)=4',
            'rn2(12)=1', 'rn2(12)=2', 'rn2(12)=8', 'rn2(70)=40',
            'rn2(100)=46', 'rn2(20)=15', 'rn2(76)=64',
        ], 'seed0003 grease dissolution and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[147]),
            'The grease dissolves.');
        assert.deepEqual(result.getCursors()[147], [30, 4, 1]);

        assertWornCorrosionHelmet({ corrosion: 0 });
        assert.equal(game.u.uac, 4);
        assert.equal(game.u.uhp, 4);
        assert.equal(game.context.move, 0);
    });

test('seed0011 orcish arrow leads corrodeproof helmet learning and retry',
    async () => {
        const result = await runWornCorrosionSegment({
            helmet: 'uncursed corrodeproof +2 helmet',
        });

        assert.equal(result.getScreens().length, 159);
        assertRngSliceExact(result.getRngSlices()[150], [
            'rn2(5)=0', 'rnd(20)=4', 'd(3,8)=12', 'rn2(5)=0',
        ], 'seed0011 corrodeproof helmet contact RNG');
        assert.equal(decodedTopline(result.getScreens()[150]),
            'The black pudding bites!--More--');

        assertRngSliceExact(result.getRngSlices()[151], [
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=3',
            'rn2(5)=0', 'rn2(5)=4', 'rn2(5)=1',
        ], 'seed0011 corrodeproof learning and body retry RNG');
        assert.equal(decodedTopline(result.getScreens()[151]),
            'Somehow, your visored helmet is not affected by the corrosion.--More--');
        assert.deepEqual(result.getCursors()[151], [70, 0, 1]);

        assertRngSliceExact(
            result.getRngSlices()[152],
            SEED0011_WORN_CORROSION_RETRY_TAIL_RNG,
            'seed0011 corrodeproof retry tail and scheduler RNG',
        );
        assert.equal(decodedTopline(result.getScreens()[152]),
            'Your cloak of displacement is not affected by corrosion.');
        assertWornCorrosionHelmet({
            proof: true,
            proofKnown: true,
            corrosion: 0,
        });
        assert.equal(game.u.uac, 4);
        assert.equal(game.u.uhp, 3);
        assert.equal(game.context.move, 0);
    });

test('seed0745 orcish arrow leads silent blessed corrosion protection',
    async () => {
        const result = await runWornCorrosionSegment({
            seed: 745,
            helmet: 'blessed +2 helmet',
        });

        assert.equal(result.getScreens().length, 145);
        assertRngSliceExact(result.getRngSlices()[136], [
            'rn2(4)=2', 'rn2(5)=4', 'rn2(5)=3', 'rn2(5)=1',
            'rn2(5)=2', 'rn2(5)=0', 'rn2(4)=0', 'rn2(5)=0',
            'rnd(20)=11', 'd(3,8)=12', 'rn2(5)=4', 'rn2(5)=4',
            'rn2(5)=0', 'rnl(4)=0', 'rn2(5)=2', 'rn2(5)=1',
        ], 'seed0745 blessed corrosion protection RNG');
        assert.equal(decodedTopline(result.getScreens()[136]),
            'The black pudding bites!--More--');
        assert.deepEqual(result.getCursors()[136], [32, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[137], [
            'rn2(3)=2', 'rn2(6)=5', 'rn2(5)=2', 'rn2(12)=1',
            'rn2(5)=0', 'rn2(12)=2', 'rn2(12)=10', 'rn2(12)=7',
            'rn2(12)=11', 'rn2(70)=56', 'rn2(100)=61',
            'rn2(400)=21', 'rn2(20)=1', 'rn2(76)=46',
        ], 'seed0745 blessed corrosion body stop and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[137]),
            'Your cloak of displacement is not affected by corrosion.');
        assert.deepEqual(result.getCursors()[137], [50, 16, 1]);

        assertWornCorrosionHelmet({ blessed: true, corrosion: 0 });
        assert.equal(game.u.uac, 4);
        assert.equal(game.u.uhp, 3);
        assert.equal(game.context.move, 0);
    });

for (const scenario of [
    {
        name: 'seed0011 orcish arrow corrodes worn helmet further',
        helmet: 'uncursed corroded +2 helmet',
        index: 146,
        screens: 155,
        topline: 'The black pudding bites!  Your visored helmet corrodes further!',
        corrosion: 2,
    },
    {
        name: 'seed0011 orcish arrow corrodes worn helmet completely',
        helmet: 'uncursed very corroded +2 helmet',
        index: 151,
        screens: 160,
        topline: 'The black pudding bites!  Your visored helmet corrodes completely!',
        corrosion: 3,
    },
]) {
    test(scenario.name, async () => {
        const result = await runWornCorrosionSegment({
            helmet: scenario.helmet,
        });

        assert.equal(result.getScreens().length, scenario.screens);
        assertRngSliceExact(
            result.getRngSlices()[scenario.index],
            SEED0011_WORN_CORROSION_DIRECT_RNG,
            `${scenario.name} RNG`,
        );
        assert.equal(
            decodedTopline(result.getScreens()[scenario.index]),
            scenario.topline,
        );
        assert.deepEqual(result.getCursors()[scenario.index], [70, 5, 1]);
        assertWornCorrosionHelmet({ corrosion: scenario.corrosion });
        assert.equal(game.u.uac, 5);
        assert.equal(game.u.uhp, 3);
        assert.equal(game.context.move, 0);
    });
}

test('seed0011 orcish arrow leaves max-corroded helmet silent and retries',
    async () => {
        const result = await runWornCorrosionSegment({
            helmet: 'uncursed thoroughly corroded +2 helmet',
        });

        assert.equal(result.getScreens().length, 166);
        assertRngSliceExact(result.getRngSlices()[157], [
            'rn2(5)=0', 'rnd(20)=4', 'd(3,8)=12', 'rn2(5)=0',
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=0',
            'rn2(5)=4', 'rn2(5)=1',
        ], 'seed0011 max-corrosion silent retry RNG');
        assert.equal(decodedTopline(result.getScreens()[157]),
            'The black pudding bites!--More--');
        assert.deepEqual(result.getCursors()[157], [32, 0, 1]);

        assertRngSliceExact(
            result.getRngSlices()[158],
            SEED0011_WORN_CORROSION_RETRY_TAIL_RNG,
            'seed0011 max-corrosion retry tail and scheduler RNG',
        );
        assert.equal(decodedTopline(result.getScreens()[158]),
            'Your cloak of displacement is not affected by corrosion.');
        assertWornCorrosionHelmet({ corrosion: 3 });
        assert.equal(game.u.uac, 5);
        assert.equal(game.u.uhp, 3);
        assert.equal(game.context.move, 0);
    });

test('seed0011 Ranger cloak removal defers off-message past displacement pager',
    async () => {
        const result = await runSegment({
            seed: 11,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nTe        ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 14);
        assertRngSliceExact(result.getRngSlices()[4], [],
            'seed0011 displacement-off pager RNG');
        assert.equal(decodedTopline(result.getScreens()[4]),
            'You feel that monsters no longer have difficulty pinpointing your location.');
        assert.equal(decodedRow(result.getScreens()[4], 1), '--More--');
        assert.equal(decodedRow(result.getScreens()[4], 23),
            'Dlvl:1 $:0 HP:15(15) Pw:2(2) AC:7 Xp:1');
        assert.deepEqual(result.getCursors()[4], [8, 1, 1]);

        assert.equal(decodedTopline(result.getScreens()[5]),
            'You feel that monsters no longer have difficulty pinpointing your location.');
        assert.equal(decodedRow(result.getScreens()[5], 1), '--More--');
        assertRngSliceExact(result.getRngSlices()[6], [
            'rn2(12)=4', 'rn2(12)=0', 'rn2(12)=11', 'rn2(12)=9',
            'rn2(12)=3', 'rn2(70)=19', 'rn2(400)=352',
            'rn2(300)=14', 'rn2(20)=15', 'rn2(73)=69',
        ], 'seed0011 cloak off-message scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[6]),
            'You were wearing an uncursed +2 cloak of displacement.');
        assert.equal(decodedRow(result.getScreens()[6], 23),
            'Dlvl:1 $:0 HP:15(15) Pw:2(2) AC:10 Xp:1');
        assert.deepEqual(result.getCursors()[6], [70, 5, 1]);

        const cloak = game.inventory.find(object =>
            object.otyp === CLOAK_OF_DISPLACEMENT);
        assert.ok(cloak);
        assert.equal(cloak.worn, false);
        assert.equal(game.uarmc, null);
        assert.equal(game.u.uac, 10);
        assert.equal(game.context.move, 0);
    });

test('seed0011 hostile bite corrodes wished bronze body armor',
    async () => {
        const result = await runWornSuitCorrosionSegment('bronze');

        assert.equal(result.getScreens().length, 98);
        assertRngSliceExact(result.getRngSlices()[89], [
            'rn2(5)=3', 'rnd(20)=7', 'd(3,8)=17',
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=0', 'rn2(5)=4',
            'rn2(5)=3', 'rn2(5)=0', 'rn2(5)=0', 'rn2(5)=1',
            'rn2(3)=2', 'rn2(6)=0',
        ], 'seed0011 copper body corrosion and knockback RNG');
        assert.equal(decodedTopline(result.getScreens()[89]),
            'The black pudding bites!  Your bronze plate mail corrodes!--More--');
        assert.equal(decodedRow(result.getScreens()[89], 23),
            'Dlvl:1 $:0 HP:0(15) Pw:2(2) AC:2 Xp:1');
        assert.deepEqual(result.getCursors()[89], [66, 0, 1]);

        assertRngSliceExact(
            result.getRngSlices()[92],
            SEED0011_SUIT_FATAL_RECOVERY_RNG,
            'seed0011 bronze-suit death recovery RNG',
        );
        assert.equal(decodedTopline(result.getScreens()[92]),
            "OK, so you don't die.  You survived that attempt on your life.");
        assert.equal(decodedRow(result.getScreens()[92], 23),
            'Dlvl:1 $:0 HP:15(15) Pw:2(2) AC:3 Xp:1');

        assert.ok(game.uarm);
        assert.equal(game.uarm.name, 'bronze plate mail');
        assert.equal(game.uarm.oeroded ?? 0, 0);
        assert.equal(game.uarm.oeroded2 ?? 0, 1);
        assert.equal(game.uarmc, null);
        assert.equal(game.u.uac, 3);
        assert.equal(game.u.uhp, 15);
        assert.equal(game.context.move, 0);
    });

test('seed0011 hostile bite stops on wished crystal body non-effect',
    async () => {
        const result = await runWornSuitCorrosionSegment('crystal');

        assert.equal(result.getScreens().length, 99);
        assertRngSliceExact(result.getRngSlices()[90], [
            'rn2(5)=3', 'rnd(20)=7', 'd(3,8)=17',
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=0', 'rn2(5)=4',
            'rn2(5)=3', 'rn2(5)=0', 'rn2(5)=0', 'rn2(5)=1',
        ], 'seed0011 crystal body selection RNG');
        assert.equal(decodedTopline(result.getScreens()[90]),
            'The black pudding bites!--More--');
        assert.equal(decodedRow(result.getScreens()[90], 23),
            'Dlvl:1 $:0 HP:15(15) Pw:2(2) AC:1 Xp:1');

        assertRngSliceExact(result.getRngSlices()[91], [
            'rn2(3)=2', 'rn2(6)=0',
        ], 'seed0011 crystal body stop and knockback RNG');
        assert.equal(decodedTopline(result.getScreens()[91]),
            'Your crystal plate mail is not affected by corrosion.--More--');
        assert.equal(decodedRow(result.getScreens()[91], 23),
            'Dlvl:1 $:0 HP:0(15) Pw:2(2) AC:1 Xp:1');
        assert.deepEqual(result.getCursors()[91], [61, 0, 1]);

        assertRngSliceExact(
            result.getRngSlices()[94],
            SEED0011_SUIT_FATAL_RECOVERY_RNG,
            'seed0011 crystal-suit death recovery RNG',
        );
        assert.ok(game.uarm);
        assert.equal(game.uarm.name, 'crystal plate mail');
        assert.equal(game.uarm.oeroded ?? 0, 0);
        assert.equal(game.uarm.oeroded2 ?? 0, 0);
        assert.equal(game.uarmc, null);
        assert.equal(game.u.uac, 1);
        assert.equal(game.u.uhp, 15);
        assert.equal(game.context.move, 0);
    });

test('seed0154 surviving startup arrow rusts on rust-monster passive',
    async () => {
        const result = await runSegment({
            seed: 154,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\npeaceful rust monster\nx tdh ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 44);
        assertRngSliceExact(result.getRngSlices()[42], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=1', 'rnd(6)=2',
            'rn2(19)=12', 'rn2(3)=0', 'rn2(100)=35',
            'rn2(4)=1', 'rn2(5)=3', 'rn2(5)=0', 'rn2(5)=1',
            'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=3', 'rn2(5)=0',
            'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=2', 'rn2(5)=3',
            'rn2(4)=1', 'rn2(5)=4', 'rn2(5)=2', 'rn2(5)=0',
            'rn2(5)=2', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=1',
            'rn2(5)=1', 'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=1',
        ], 'seed0154 rust-passive hit and scheduler RNG');
        assert.equal(
            decodedTopline(result.getScreens()[42]),
            'The arrow hits the rust monster.  The arrow rusts!--More--',
        );
        assert.deepEqual(result.getCursors()[42], [58, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(12)=4', 'rn2(12)=8', 'rn2(12)=1', 'rn2(12)=7',
            'rn2(70)=45', 'rn2(20)=13', 'rn2(67)=26',
        ], 'seed0154 rust-passive pager resume RNG');
        assert.equal(
            decodedTopline(result.getScreens()[43]),
            'The sewer rat strikes at your displaced image and misses you!',
        );
        assert.deepEqual(result.getCursors()[43], [5, 11, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 6,
            y: 11,
            hp: 23,
            hpmax: 25,
            peaceful: 0,
            cancelled: 0,
        });
        const floorArrows = (game.level.objects?.[5]?.[10] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            greased: floorArrows[0].greased ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            cursed: floorArrows[0].cursed ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 0,
            rust: 1,
            corrosion: 0,
            greased: 0,
            blessed: false,
            cursed: false,
            where: 'floor',
        });
        assert.equal(game.context.move, 1);
    });

test('seed0137 surviving startup arrow corrodes on black-pudding passive',
    async () => {
        const result = await runSegment({
            seed: 137,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\npeaceful black pudding\nx tdh',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 44);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=5', 'rnd(6)=5',
            'rn2(19)=1', 'rn2(3)=0', 'rn2(100)=51',
            'rn2(4)=1', 'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=1',
            'rn2(3)=2', 'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(5)=0', 'rn2(4)=3', 'rn2(5)=1',
            'rn2(5)=3', 'rn2(5)=3', 'rn2(5)=1', 'rn2(5)=2',
            'rn2(12)=4', 'rn2(12)=7', 'rn2(70)=22',
            'rn2(400)=360', 'rn2(300)=274', 'rn2(20)=18',
            'rn2(67)=18',
        ], 'seed0137 corrosion-passive hit and scheduler RNG');
        assert.equal(
            decodedTopline(result.getScreens()[43]),
            'The arrow hits the black pudding!  The arrow corrodes!',
        );
        assert.deepEqual(result.getCursors()[43], [44, 10, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 44,
            y: 9,
            hp: 56,
            hpmax: 61,
            peaceful: 0,
            cancelled: 0,
        });
        const floorArrows = (game.level.objects?.[44]?.[9] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            greased: floorArrows[0].greased ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            cursed: floorArrows[0].cursed ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 0,
            rust: 0,
            corrosion: 1,
            greased: 0,
            blessed: false,
            cursed: false,
            where: 'floor',
        });
        assert.equal(game.context.move, 1);
    });

test('seed0002 surviving startup arrow loses enchantment on disenchanter passive',
    async () => {
        const result = await runSegment({
            seed: 2,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #levelchange\n30\n' + ' '.repeat(40)
                + '#wizgenesis\npeaceful disenchanter\ntcl ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 100);
        assertRngSliceExact(result.getRngSlices()[98], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=7', 'rnd(6)=1',
            'rn2(19)=9', 'rn2(4)=3', 'rn2(100)=53',
            'rn2(100)=13', 'rn2(4)=0', 'rn2(5)=2', 'rn2(5)=0',
            'rn2(12)=6', 'rn2(12)=3', 'rn2(12)=5',
            'rn2(70)=29', 'rn2(400)=269', 'rn2(300)=166',
            'rn2(20)=5', 'rn2(67)=42',
        ], 'seed0002 disenchantment-passive hit and scheduler RNG');
        assert.equal(
            decodedTopline(result.getScreens()[98]),
            'The arrow hits the disenchanter.  The disenchanter growls!',
        );
        assert.deepEqual(result.getCursors()[98], [47, 17, 1]);

        const disenchanter = game.level.monsters.find(monster =>
            monster.mnum === 213);
        assert.ok(disenchanter);
        assert.deepEqual({
            x: disenchanter.mx,
            y: disenchanter.my,
            hp: disenchanter.mhp,
            hpmax: disenchanter.mhpmax,
            peaceful: disenchanter.mpeaceful,
            cancelled: disenchanter.mcan ?? 0,
        }, {
            x: 49,
            y: 16,
            hp: 70,
            hpmax: 73,
            peaceful: 0,
            cancelled: 0,
        });
        const floorArrows = (game.level.objects?.[49]?.[16] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            spe: floorArrows[0].spe,
            enchantment: floorArrows[0].enchantment,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            spe: 1,
            enchantment: 1,
            where: 'floor',
        });
        assert.equal(game.context.move, 0);
    });

test('seed0040 surviving startup arrow resists disenchanter passive',
    async () => {
        const result = await runSegment({
            seed: 40,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #levelchange\n30\n' + ' '.repeat(40)
                + '#wizgenesis\npeaceful disenchanter\ntcl ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 100);
        assertRngSliceExact(result.getRngSlices()[98], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=19', 'rnd(6)=4',
            'rn2(19)=17', 'rn2(4)=1', 'rn2(100)=6',
            'rn2(100)=19', 'rn2(4)=3', 'rn2(3)=1', 'rn2(3)=2',
            'rn2(5)=3', 'rn2(4)=0', 'rn2(5)=2', 'rn2(4)=0',
            'rn2(5)=3', 'rn2(3)=2', 'rn2(5)=3', 'rn2(5)=1',
            'rn2(3)=2', 'rn2(12)=0', 'rn2(5)=4', 'rn2(12)=1',
            'rn2(12)=3', 'rn2(12)=1', 'rn2(12)=5', 'rn2(12)=9',
            'rn2(70)=31', 'rnl(7)=1', 'rn2(400)=112',
            'rn2(20)=0', 'rn2(67)=7',
        ], 'seed0040 disenchantment resistance and scheduler RNG');
        assert.equal(
            decodedTopline(result.getScreens()[98]),
            'The arrow hits the disenchanter!  The disenchanter growls!',
        );
        assert.deepEqual(result.getCursors()[98], [75, 12, 1]);

        const disenchanter = game.level.monsters.find(monster =>
            monster.mnum === 213);
        assert.ok(disenchanter);
        assert.deepEqual({
            x: disenchanter.mx,
            y: disenchanter.my,
            hp: disenchanter.mhp,
            hpmax: disenchanter.mhpmax,
            peaceful: disenchanter.mpeaceful,
            cancelled: disenchanter.mcan ?? 0,
        }, {
            x: 77,
            y: 11,
            hp: 62,
            hpmax: 68,
            peaceful: 0,
            cancelled: 0,
        });
        const floorArrows = (game.level.objects?.[77]?.[11] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            spe: floorArrows[0].spe,
            enchantment: floorArrows[0].enchantment,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            spe: 2,
            enchantment: 2,
            where: 'floor',
        });
        assert.equal(game.context.move, 0);
    });

test('seed0027 launched arrow flies over a hidden bear trap', async () => {
    const result = await runSegment({
        seed: 27,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00163\n  x tdj',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[13], [
        'rnd(2)=1', 'rnd(2)=1', 'rn2(100)=94', 'rn2(5)=2',
        'rn2(100)=80', 'rn2(8)=1', 'rn2(100)=43', 'rn2(100)=92',
        'rn2(100)=52', 'rn2(100)=9', 'rn2(4)=3', 'rn2(100)=76',
        'rn2(39)=2', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=4',
        'rn2(5)=1', 'rn2(12)=0', 'rn2(12)=1', 'rn2(12)=6',
        'rn2(12)=3', 'rn2(70)=59', 'rnl(8)=1', 'rn2(20)=3',
        'rn2(67)=27',
    ], 'seed0027 arrow-over-bear-trap RNG');
    assert.equal(decodedTopline(result.getScreens()[13]), '');
    assert.deepEqual(result.getCursors()[13], [14, 16, 1]);
    assert.deepEqual(decodeScreen(result.getScreens()[13])[19][14], {
        ch: ')', color: 6, attr: 0, decgfx: 0,
    });

    const trap = game.level.traps?.find(candidate =>
        candidate.ttyp === BEAR_TRAP
        && candidate.tx === 15 && candidate.ty === 16);
    assert.ok(trap);
    assert.equal(!!trap.tseen, false);
    const floorArrows = (game.level.objects?.[15]?.[18] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 1);
});

test('seed0595 arrow volley exercises both web-flight branches', async () => {
    const result = await runSegment({
        seed: 595,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00167\n  \u0014  bbbbhhhhhhhhhhhhhhhhhhhhhhhh.x tdk',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[45], [
        'rnd(2)=2', 'rnd(2)=1', 'rn2(3)=2', 'rn2(100)=94',
        'rnd(2)=2', 'rn2(3)=0', 'rn2(100)=48', 'rn2(5)=2',
        'rn2(100)=31', 'rn2(100)=17', 'rn2(100)=82', 'rn2(100)=70',
        'rn2(4)=2', 'rn2(24)=2', 'rnd(5)=2', 'rn2(5)=3',
        'rn2(5)=3', 'rn2(12)=2', 'rn2(5)=1', 'rn2(4)=3',
        'rn2(5)=2', 'rn2(5)=1', 'rn2(5)=3', 'rn2(4)=2',
        'rn2(5)=0', 'rn2(5)=0', 'rn2(32)=10', 'rn2(5)=4',
        'rn2(5)=1', 'rnd(20)=18', 'd(2,4)=7', 'rn2(10)=8',
    ], 'seed0595 paired web-flight RNG');
    assert.equal(
        decodedTopline(result.getScreens()[45]),
        'You shoot 2 arrows.  The arrow gets stuck in a web!--More--',
    );
    assert.deepEqual(result.getCursors()[45], [59, 0, 1]);
    const screen = decodeScreen(result.getScreens()[45]);
    assert.deepEqual(screen[10][14], {
        ch: ')', color: 6, attr: 0, decgfx: 0,
    });
    assert.deepEqual(screen[12][14], {
        ch: ')', color: 6, attr: 0, decgfx: 0,
    });

    const web = game.level.traps?.find(trap =>
        trap.ttyp === WEB && trap.tx === 15 && trap.ty === 11);
    assert.ok(web);
    assert.equal(!!web.tseen, true);
    const continuedArrows = (game.level.objects?.[15]?.[9] || [])
        .filter(object => object.otyp === ARROW);
    const stuckArrows = (game.level.objects?.[15]?.[11] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(continuedArrows.length, 1);
    assert.equal(continuedArrows[0].quan, 1);
    assert.equal(stuckArrows.length, 1);
    assert.equal(stuckArrows[0].quan, 1);
});

test('seed0005 launched arrows traverse an open doorway', async () => {
    const result = await runSegment({
        seed: 5,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00167\n  \u0014  bbbbbbbbbbbbbbhhhhhhhhhhhhhhhhhh.x tdl',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[49], [
        'rnd(2)=2', 'rnd(2)=2', 'rn2(100)=48', 'rnd(2)=1',
        'rn2(100)=18', 'rn2(5)=4', 'rn2(100)=16', 'rn2(100)=28',
        'rn2(20)=9', 'rn2(5)=0', 'rn2(5)=0', 'rn2(5)=2',
        'rn2(5)=4', 'rn2(32)=21', 'rn2(5)=3', 'rn2(4)=0',
        'rn2(5)=0', 'rn2(5)=4', 'rn2(5)=3', 'rn2(100)=2',
        'rn2(32)=19', 'rn2(5)=0', 'rn2(12)=7', 'rn2(12)=2',
        'rn2(12)=2', 'rn2(12)=11', 'rn2(12)=3', 'rn2(12)=10',
        'rn2(12)=11', 'rn2(12)=3', 'rn2(12)=10', 'rn2(12)=7',
        'rn2(70)=46', 'rn2(400)=62', 'rn2(200)=125', 'rn2(20)=5',
        'rn2(73)=49',
    ], 'seed0005 open-door flight RNG');
    assert.equal(decodedTopline(result.getScreens()[49]), 'You shoot 2 arrows.');
    assert.deepEqual(result.getCursors()[49], [28, 19, 1]);
    assert.deepEqual(decodeScreen(result.getScreens()[49])[19][36], {
        ch: ')', color: 6, attr: 0, decgfx: 0,
    });

    const door = game.level.at(30, 18);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_ISOPEN);
    const floorArrows = (game.level.objects?.[37]?.[18] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 2);
});

test('seed0050 launched arrows stop on a sink', async () => {
    const result = await runSegment({
        seed: 50,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n\u00167\n  \u0014  yk.x tdk',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[19], [
        'rnd(2)=2', 'rnd(2)=2', 'rn2(100)=64', 'rnd(2)=1',
        'rn2(100)=24', 'rn2(5)=2', 'rn2(100)=51', 'rn2(8)=3',
        'rn2(100)=85', 'rn2(100)=4', 'rn2(100)=49', 'rn2(100)=53',
        'rn2(100)=23', 'rn2(100)=13', 'rn2(100)=1', 'rn2(1)=0',
        'rn2(2)=1', 'rn2(3)=1', 'rn2(4)=2', 'rn2(5)=4',
        'rn2(6)=0', 'rn2(7)=2', 'rn2(5)=0', 'rn2(5)=4',
        'rn2(32)=28', 'rn2(5)=1', 'rn2(4)=0', 'rn2(5)=0',
        'rn2(5)=2', 'rn2(12)=1', 'rn2(12)=0', 'rn2(12)=1',
        'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=2', 'rn2(70)=18',
        'rn2(300)=227', 'rn2(20)=7', 'rn2(70)=49',
    ], 'seed0050 sink-stop RNG');
    assert.equal(decodedTopline(result.getScreens()[19]), 'You shoot 2 arrows.');
    assert.deepEqual(result.getCursors()[19], [6, 5, 1]);
    assert.deepEqual(decodeScreen(result.getScreens()[19])[4][6], {
        ch: ')', color: 6, attr: 0, decgfx: 0,
    });

    assert.equal(game.level.at(7, 3).typ, SINK);
    const floorArrows = (game.level.objects?.[7]?.[3] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.equal(floorArrows[0].quan, 2);
});

test('seed0419 killing arrow converges on shared xkilled ownership', async () => {
    const result = await runSegment({
        seed: 419,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx tdh ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[8], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=20', 'rn2(3)=2',
        'rn2(100)=94', 'rnd(2)=1', 'rnd(20)=7', 'rnd(6)=3',
    ], 'seed0419 killing-arrow pre-pager RNG');
    assert.equal(
        decodedTopline(result.getScreens()[8]),
        'You shoot 2 arrows.  The 1st arrow misses the kobold zombie.--More--',
    );
    assert.deepEqual(result.getCursors()[8], [68, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[9], [
        'rn2(6)=1', 'rn2(3)=0', 'rnd(2)=1', 'rn2(3)=1',
        'rn2(4)=3', 'rn2(5)=1', 'rn2(7)=1', 'rn2(8)=5',
        'rn2(11)=4', 'rn2(15)=1', 'rn2(16)=13', 'rn2(21)=1',
        'rn2(2)=0', 'rn2(1000)=944', 'rn2(4)=3', 'rne(4)=1',
        'rn2(2)=1', 'rnz(10)=19', 'rn2(19)=8', 'rn2(3)=1',
        'rn2(5)=2', 'rn2(100)=86', 'rn2(8)=7', 'rn2(100)=25',
        'rn2(8)=6', 'rn2(4)=0', 'rn2(100)=48', 'rn2(100)=8',
        'rn2(5)=0', 'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1',
        'rn2(5)=2', 'rn2(4)=3', 'rn2(5)=2', 'rn2(5)=1',
        'rn2(5)=1', 'rn2(4)=0', 'rn2(5)=3', 'rn2(5)=2',
        'rn2(12)=5', 'rn2(12)=6', 'rn2(12)=5', 'rn2(12)=4',
        'rn2(70)=65', 'rn2(20)=12', 'rn2(67)=6',
    ], 'seed0419 resumed xkilled RNG');
    assert.equal(
        decodedTopline(result.getScreens()[9]),
        'The 2nd arrow hits the kobold zombie.  You destroy the kobold zombie!',
    );
    assert.deepEqual(result.getCursors()[9], [23, 9, 1]);
});

test('seed0419 enchanted killing arrow survives beside its corpse', async () => {
    const result = await runSegment({
        seed: 419,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx tch ',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[8], [
        'rnd(2)=2', 'rnd(2)=2', 'rnd(20)=20', 'rn2(3)=2',
        'rn2(100)=94', 'rnd(2)=1', 'rnd(20)=7', 'rnd(6)=3',
    ], 'seed0419 enchanted kill pre-pager RNG');
    assert.equal(
        decodedTopline(result.getScreens()[8]),
        'You shoot 2 arrows.  The 1st arrow misses the kobold zombie.--More--',
    );
    assert.deepEqual(result.getCursors()[8], [68, 0, 1]);

    assertRngSliceExact(result.getRngSlices()[9], [
        'rn2(6)=1', 'rn2(3)=0', 'rnd(2)=1', 'rn2(3)=1',
        'rn2(4)=3', 'rn2(5)=1', 'rn2(7)=1', 'rn2(8)=5',
        'rn2(11)=4', 'rn2(15)=1', 'rn2(16)=13', 'rn2(21)=1',
        'rn2(2)=0', 'rn2(1000)=944', 'rn2(4)=3', 'rne(4)=1',
        'rn2(2)=1', 'rnz(10)=19', 'rn2(19)=8', 'rn2(4)=1',
        'rn2(100)=42', 'rn2(5)=1', 'rn2(100)=87', 'rn2(8)=1',
        'rn2(100)=6', 'rn2(1)=0', 'rn2(100)=48', 'rn2(100)=8',
        'rn2(5)=0', 'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1',
        'rn2(5)=2', 'rn2(4)=3', 'rn2(5)=2', 'rn2(5)=1',
        'rn2(5)=1', 'rn2(4)=0', 'rn2(5)=3', 'rn2(5)=2',
        'rn2(12)=5', 'rn2(12)=6', 'rn2(12)=5', 'rn2(12)=4',
        'rn2(70)=65', 'rn2(20)=12', 'rn2(67)=6',
    ], 'seed0419 enchanted kill resumed RNG');
    assert.equal(
        decodedTopline(result.getScreens()[9]),
        'The 2nd arrow hits the kobold zombie!  You destroy the kobold zombie!',
    );
    assert.deepEqual(result.getCursors()[9], [23, 9, 1]);

    const contactPile = (game.level.objects || [])
        .flatMap(column => Array.isArray(column)
            ? column.filter(pile => Array.isArray(pile)) : [])
        .find(pile => pile.some(object => object.otyp === CORPSE)
            && pile.some(object => object.otyp === ARROW
                && (object.spe ?? object.enchantment ?? 0) === 2));
    assert.ok(contactPile);
    assert.equal(
        contactPile.filter(object => object.otyp === ARROW
            && (object.spe ?? object.enchantment ?? 0) === 2)
            .reduce((sum, object) =>
                sum + (object.quantity ?? object.quan ?? 1), 0),
        2,
    );
    assert.equal(contactPile.filter(object => object.otyp === CORPSE).length, 1);
});

test('seed4500 through punished level teleport preserves source ownership', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 774),
    });
    for (let index = 0; index < 774; index++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
        );
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call => call.replace(/\s+@.*$/, '')),
        );
    }
    assert.deepEqual([game.uball.ox, game.uball.oy, game.uball.owt],
        [36, 8, 640]);
    assert.deepEqual([game.uchain.ox, game.uchain.oy], [36, 8]);
    assert.deepEqual(
        game.level.objects[36][8].slice(0, 2),
        [game.uchain, game.uball],
    );
    assert.equal(game.moves, 119);
    assert.equal(game.u.uhp, 39);
    assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 3 });
    assert.deepEqual([game.u.ux, game.u.uy], [36, 8]);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game._helplessAfter, null);
    assert.equal(game._helplessReason, null);
    assert.equal(game._helplessDoneMessage, null);
    assert.equal(game.u.uconduct.gnostic, 1);
    assert.equal(game.u.invulnerable, false);
    assert.equal(game.u.invulnerableTurns, 8);
    assert.equal(game.u.veryFast, true);
    assert.equal(game.u.veryFastTurns, 8);
    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.uarms, null);
    assert.equal(game.inventory.some(item =>
        item.name === 'scroll of punishment'), false);
    const startingLevel = game._levelCache.get('0:1').level;
    assert.equal(startingLevel.objects[38][10].some(item =>
        item.name === 'scroll of punishment'), true);
    assert.equal(startingLevel.objects.flat(2).some(item =>
        item === game.uball || item === game.uchain), false);
    assert.equal(game.level.flags.has_shop, true);
    assert.equal(game.level.flags.has_vault, true);
    assert.deepEqual(
        game.branches.find(branch =>
            game.dungeons[branch.end2?.dnum]?.dname === 'Fort Ludios')?.end1,
        { dnum: 0, dlevel: 20 },
    );
    assert.equal(game._levelAnnotations.get('0:1'), 'starting level');
    const namedSword = game.uwep;
    assert.equal(namedSword, game.uwep);
    assert.equal(namedSword.invlet, 'z');
    assert.equal(namedSword.oextra?.oname, 'Sword of Justice');
    assert.equal(
        inventoryItemDescription(namedSword),
        'a +1 long sword named Sword of Justice (weapon in right hand)',
    );
    assert.deepEqual(
        [
            game.u.weaponSkills[7].skill,
            game.u.weaponSkills[7].advance,
            game.u.weaponSkills[16].skill,
            game.u.weaponSkills[16].advance,
        ],
        [3, 25, 2, 0],
    );
    assert.deepEqual(
        game.inventory.filter(item => item.oclass === 7)
            .map(item => [
                item.invlet, item.name, item.quantity,
                item.oeaten ?? null, !!item.orotten,
            ]),
        [
            ['g', 'apple', 11, null, false],
            ['h', 'carrot', 11, null, false],
            ['m', 'apple', 1, 25, true],
        ],
    );
});

test('seed4500 dip Escape retains its selector through input621', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const lastStep = 621;
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, lastStep + 1),
    });

    for (const step of [620, 621]) {
        assertScreenExact(
            result.getScreens()[step], session.steps[step].screen,
            `seed4500 dip input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `seed4500 dip input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed4500 dip input ${step} RNG`,
        );
    }
    assert.equal(game.context.move, 0);
});

test('seed4500 nesting rooms keep irregular subroom identity at input796', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const step = 796;
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, step + 1),
    });

    assertRngSliceExact(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
        `seed4500 nesting-room input ${step} RNG`,
    );
    assertScreenExact(
        result.getScreens()[step], session.steps[step].screen,
        `seed4500 nesting-room input ${step} screen`,
    );
    assert.deepEqual(
        result.getCursors()[step], session.steps[step].cursor,
        `seed4500 nesting-room input ${step} cursor`,
    );
});

test('seed4500 fresh hero melee paints committed fatal HP at input1005', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const step = 1005;
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, step),
    });

    assertRngSliceExact(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
        `seed4500 fatal-contact input ${step} RNG`,
    );
    assertScreenExact(
        result.getScreens()[step], session.steps[step].screen,
        `seed4500 fatal-contact input ${step} screen`,
    );
    assert.deepEqual(
        result.getCursors()[step], session.steps[step].cursor,
        `seed4500 fatal-contact input ${step} cursor`,
    );
    assert.equal(game.u.uhp, 0);
    assert.equal(game._statusHpOverride, undefined);
    assert.equal(game._heroMeleeThisCommand, true);
});

test('seed4500 wizard mapping, punished travel, and teleport stay source-exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 829),
    });
    for (let index = 774; index < 829; index++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
        );
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call => call.replace(/\s+@.*$/, '')),
        );
    }
});

test('seed4500 blind combat, debug-death, and empty-I breath stay source-exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 1052),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 1003; index < 1052; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }
    assert.equal(
        game.level.at(42, 6).remembered_glyph?.kind,
        'terrain',
    );
    assert.deepEqual([game.u.ux, game.u.uy], [42, 5]);
    assert.equal(game.moves, 149);
    assert.equal(game.u.uhp, 8);
});

test('seed4500 wield, timed blindness, felt floors, and prayer stay source-exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 1201),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 1052; index < 1202; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }
    assert.equal(game._occupation, null);
    assert.equal(game._commandCount, 0);
    assert.equal(game.moves, 198);
    assert.equal(game.u.uhp, 36);
    assert.equal(game.u.uen, 94);
    assert.equal(game.u.blindTurns, 179);
    assert.deepEqual([game.u.ux, game.u.uy], [36, 12]);
});

test('seed4500 skill snapshot and zero-speed movement clamp stay exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 1445),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const step of [
        267, 268, 631, 985,
        1438, 1439, 1440, 1441, 1442, 1443, 1444,
    ]) {
        assertScreenExact(
            result.getScreens()[step],
            session.steps[step].screen,
            `seed4500 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `seed4500 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed4500 input ${step} RNG`,
        );
    }
    assert.deepEqual(
        [1, 2, 7, 37].map(skill => [
            skill,
            game.u.weaponSkills[skill].skill,
            game.u.weaponSkills[skill].maxSkill,
        ]),
        [[1, 1, 2], [2, 1, 2], [7, 3, 4], [37, 2, 4]],
    );
});

test('weapon strength damage uses NetHack exceptional-strength encoding', () => {
    assert.deepEqual(
        [5, 15, 16, 18, 19, 93, 94, 108, 109, 117, 118]
            .map(strengthDamageBonus),
        [-1, 0, 1, 2, 3, 3, 4, 4, 5, 5, 6],
    );
});

test('seed0900 full-height one-page inventory ends without page numbering', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0900-tourist-explore-actions.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment(session);
    assert.deepEqual(
        decodeScreen(result.getScreens()[4]),
        decodeScreen(session.steps[4].screen),
    );
    assert.deepEqual(result.getCursors()[4], session.steps[4].cursor);
});

test('first-use travel keeps invalid keys inside their tty modal owner', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0101-ranger-quiver-throw-travel-engrave.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment(session);
    assert.deepEqual(
        result.getScreens().slice(10, 16).map(decodeScreen),
        session.steps.slice(10, 16).map(step => decodeScreen(step.screen)),
    );
    assert.deepEqual(
        result.getCursors().slice(10, 16),
        session.steps.slice(10, 16).map(step => step.cursor),
    );
});

test('seed0700 exercise observes the completed global turn', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0700-samurai-explore-descend.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment(session);

    assertRngThrough(result, session, undefined, 'seed0700');
    assert.deepEqual(result.getRngSlices()[18], session.steps[18].rng
        .map(call => call.replace(/\s+@.*$/, '')));
});

test('seed0107 skill headings leave tty menu margins unstyled', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0107-samurai-twoweapon-enhance.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment(session);
    assert.deepEqual(
        decodeScreen(result.getScreens()[50]),
        decodeScreen(session.steps[50].screen),
    );
    assert.deepEqual(result.getCursors()[50], session.steps[50].cursor);
});

test('seed0017 fixed altar path stops its first run on the doorway commit', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0017-samurai-altar-pray.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment(session);
    assert.deepEqual(
        decodeScreen(result.getScreens()[10]),
        decodeScreen(session.steps[10].screen),
    );
    assert.deepEqual(result.getCursors()[10], session.steps[10].cursor);
});

test('seed0017 pray autocompletes from its unique first letter', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0017-samurai-altar-pray.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment(session);
    assert.deepEqual(
        decodeScreen(result.getScreens()[42]),
        decodeScreen(session.steps[42].screen),
    );
    assert.deepEqual(result.getCursors()[42], session.steps[42].cursor);
});

test('lookaroundRun turns through one unambiguous corridor bend', () => {
    const cells = new Map([
        ['10,10', CORR],
        ['9,10', CORR],
        ['10,9', CORR],
    ]);
    const state = { dx: 1, dy: 0, mode: 1, lastStrTurn: 0 };
    const g = { u: { ux: 10, uy: 10 }, level: runLevel(cells) };

    assert.equal(lookaroundRun(state, g), true);
    assert.deepEqual([state.dx, state.dy], [0, -1]);
});

test('lookaroundRun stops before a monster in front', () => {
    const cells = new Map([
        ['10,10', ROOM],
        ['11,10', ROOM],
    ]);
    const state = { dx: 1, dy: 0, mode: 1, lastStrTurn: 0 };
    const g = {
        u: { ux: 10, uy: 10 },
        level: runLevel(cells, [{ mx: 11, my: 10 }]),
    };

    assert.equal(lookaroundRun(state, g), false);
});

test('diagonal movement distinguishes doorless from intact doorways', () => {
    const room = { typ: ROOM, doormask: 0 };
    assert.equal(blocksDiagonalDoor(room, { typ: DOOR, doormask: 0 }), false);
    assert.equal(blocksDiagonalDoor(
        room, { typ: DOOR, doormask: D_BROKEN },
    ), false);
    assert.equal(blocksDiagonalDoor(
        room, { typ: DOOR, doormask: D_ISOPEN },
    ), true);
});

test('seed0004 uppercase L auto-continues to the corridor obstacle', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 16) });

    assert.deepEqual([game.u.ux, game.u.uy], [72, 5]);
    assert.equal(game.moves, 7);
    assert.equal(game._runState, null);
});

test('seed0004 uppercase J stops on the room doorway', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 64) });

    assert.deepEqual([game.u.ux, game.u.uy], [68, 15]);
    assert.equal(game._runState, null);
});

test('seed0004 themed secret door retains horizontal map orientation', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 9),
    });
    const door = game.level.at(65, 6);
    const cells = decodeScreen(result.getScreens()[9]);

    assert.equal(door.typ, SDOOR);
    assert.equal(door.horizontal, true);
    assert.deepEqual(cells[7][64],
        decodeScreen(session.steps[9].screen)[7][64]);
});

test('seed0004 ordinary-room graffiti is retained and projected after sight', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 21),
    });
    const engraving = game.level.engravings.find(candidate =>
        candidate.x === 75 && candidate.y === 4);
    const actual = decodeScreen(result.getScreens()[21])[5][74];
    const expected = decodeScreen(session.steps[21].screen)[5][74];

    assert.equal(engraving.engr_type, 4); // MARK
    assert.equal(engraving.erevealed, true);
    assert.deepEqual(actual, expected);
    assert.deepEqual(actual, {
        ch: '`', color: 12, attr: 0, decgfx: 0,
    });
});

test('seed0004 comma picks up the yellow gem and spends a turn', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 87) });

    assert.equal(game.level.objects[28][4].length, 0);
    assert.equal(game.inventory.at(-1).invlet, 'i');
    assert.equal(game.inventory.at(-1).otyp, 453);
    assert.equal(game.inventory.at(-1).name, 'yellow gem');
    assert.equal(game.inventory.at(-1).class, 'Gems');
    assert.equal(game._pending_message, 'i - a yellow gem.');
});

test('seed0004 floor gold enters the wallet without consuming an inventory letter', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 115) });

    assert.equal(game._goldCount, 4);
    assert.equal(game.inventory.some(object => object.otyp === GOLD_PIECE), false);
    assert.equal(game.inventory.at(-1).invlet, 'j');
    assert.equal(game._pending_message, '$ - 4 gold pieces.');
});

test('seed0004 trap victims retain their cursed floor possessions', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 10) });

    assert.deepEqual(game.level.objects[76][17].map(object => [
        object.otyp, object.cursed,
    ]), [[265, false], [63, true]]);
    assert.deepEqual(game.level.objects[77][17].map(object => [
        object.otyp, object.cursed,
    ]), [
        [265, false], [466, true], [264, true], [456, true],
    ]);
});

test('seed0004 south run stops in the live bear trap', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 28) });

    assert.deepEqual([game.u.ux, game.u.uy], [77, 17]);
    assert.equal(game.u.utrap, 7);
    assert.equal(game.u.utraptype, 1);
    assert.equal(game.u.uhp, 11);
    assert.equal(game._runState, null);
});

test('seed0004 pile dismissal suspends bear-trap damage at the tty pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 28),
    });
    for (const step of [26, 27, 28]) {
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0004 input ${step} RNG`,
        );
        assertScreenExact(
            result.getScreens()[step],
            session.steps[step].screen,
            `seed0004 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step],
            session.steps[step].cursor,
            `seed0004 input ${step} cursor`,
        );
    }
    assert.equal(game.u.uhp, 11);
    assert.equal(game.u.utrap, 7);
});

test('seed0004 reluctant pet pager precedes destination repaint and trap', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 46),
    });
    const pagerCell = decodeScreen(result.getScreens()[34])[18][75];
    const expectedCell = decodeScreen(session.steps[34].screen)[18][75];

    assert.deepEqual(pagerCell, expectedCell);
    assert.equal(pagerCell.ch, '%');
    assert.equal(result.getScreens()[45].split('\n')[0],
        'The saddled pony is caught in a bear trap!');
    for (const step of [34, 45]) {
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0004 input ${step} RNG`,
        );
    }
});

test('seed0004 first trapped turn applies hostile fallback movement', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 29) });

    const kobold = game.level.monsters.find(monster => monster.mnum === 59);
    assert.deepEqual([kobold.mx, kobold.my], [70, 11]);
    assert.deepEqual(kobold.mtrack[0], { x: 71, y: 11 });
});

test('seed0004 adjacent hostile command resolves the first live melee kill', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    await runSegment({ ...session, moves: session.moves.slice(0, 53) });

    assert.equal(game.level.monsters.some(monster => monster.mnum === 59), false);
    assert.equal(game._pending_message, 'You kill the kobold!');
    assert.equal(game._heroTimePending, false);
    assert.deepEqual([game.u.ux, game.u.uy], [76, 11]);
});

test('seed0004 diagonal autoopen reports the locked door without time', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 19),
    });
    for (const index of [17, 18]) {
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
        assert.deepEqual(result.getRngSlices()[index], []);
    }
    assert.deepEqual([game.u.ux, game.u.uy], [72, 6]);
});

test('seed0004 trap release and leg healing compose source-order messages', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 52),
    });
    for (const index of [46, 51])
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
});

test('seed0004 long sword kill honors the grid bug no-corpse flag', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 94),
    });

    assert.equal(game.level.monsters.filter(monster => monster.mnum === 116).length, 1);
    assert.equal((game.level.objects?.[25]?.[7] || [])
        .some(object => object.corpsenm === 116), false);
    assert.deepEqual(decodeScreen(result.getScreens()[93])[8][24],
        decodeScreen(session.steps[93].screen)[8][24]);
});

test('seed0004 9s repeats search across nine scheduler turns', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 173),
    });
    const expected = session.steps[172].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.equal(result.getRngSlices()[172].length, 161);
    assert.deepEqual(result.getRngSlices()[172], expected);
    assert.equal(game._occupation, null);
});

test('seed0004 lost pony uses the visible-area fallback during the west run', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 183),
    });
    const expected = session.steps[182].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[182], expected);
});

test('seed0004 unseen pet trap and reluctance events stay silent', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 183),
    });
    for (const index of [83, 182])
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
});

test('seed0004 pushes the corridor boulder as one live transaction', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 204),
    });
    const expected = session.steps[203].rng.map(call =>
        call.replace(/\s+@.*$/, ''));
    const boulders = [];
    for (let x = 1; x < game.level.objects.length; x++) {
        for (let y = 0; y < (game.level.objects[x]?.length || 0); y++) {
            if (game.level.objects[x]?.[y]?.some(object =>
                object.otyp === BOULDER)) boulders.push([x, y]);
        }
    }

    assert.deepEqual(result.getRngSlices()[203], expected);
    assert.equal(boulders.some(([x, y]) => x === game.u.ux && y === game.u.uy), false);
});

test('seed0004 hostile linedup check sees the pushed boulder', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 213),
    });
    const expected = session.steps[212].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    for (let index = 204; index <= 211; index++)
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
    assert.deepEqual(result.getRngSlices()[212], expected);
});

test('seed0004 long sword wounds and then kills the adjacent jackal', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 216),
    });
    for (const index of [214, 215]) {
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }
    assert.equal(game.level.monsters.filter(monster => monster.mnum === 12).length, 1);
});

test('seed0004 generated goblin evaluates its empty weapon inventory branch', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 218),
    });
    const expected = session.steps[217].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[217], expected);
    assert.equal(game._lastRandomMonsterGeneration.mnum, 70);
});

test('seed0004 unseen jackal refreshes apparent hero then follows local track', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 225),
    });
    const expected = session.steps[225].rng.map(call =>
        call.replace(/\s+@.*$/, ''));
    const jackal = game.level.monsters.find(monster => monster.mnum === 12);

    assert.deepEqual(result.getRngSlices()[225], expected);
    assert.deepEqual([jackal.mx, jackal.my], [40, 13]);
    // set_apparxy() refreshes the retained apparent position to the real hero
    // when invisibility/displacement do not interfere.  gettrack() replaces
    // only the local m_move() goal while the jackal is out of direct sight.
    assert.deepEqual([jackal.mux, jackal.muy], [game.u.ux, game.u.uy]);
});

test('seed0004 floor pager resumes into the live dart trap transaction', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 235),
    });
    const expected = session.steps[235].rng.map(call =>
        call.replace(/\s+@.*$/, ''));
    const dartTrap = game.level.traps.find(trap =>
        trap.tx === 40 && trap.ty === 5 && trap.ttyp === DART_TRAP);
    const darts = game.level.objects[40][5].filter(object =>
        object.otyp === 24);

    // The pager's space is represented by public step 235; the runner keeps
    // the resumed command's calls in that same recorder slice.
    assert.deepEqual(result.getRngSlices()[235], expected);
    assert.equal(dartTrap.tseen, true);
    assert.equal(dartTrap.once, true);
    assert.equal(darts.some(dart => dart.quan === 1 && dart.opoisoned), true);
    assert.equal(game.u.uhp, 14);
});

test('seed0004 redraw projects a seen dart trap above remembered terrain', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 248),
    });
    const dartTrap = game.level.traps.find(trap =>
        trap.tx === 40 && trap.ty === 5 && trap.ttyp === DART_TRAP);
    const actual = decodeScreen(result.getScreens()[248])[6][39];
    const expected = decodeScreen(session.steps[248].screen)[6][39];

    assert.equal(dartTrap.tseen, true);
    assert.deepEqual(actual, expected);
    assert.deepEqual(actual, {
        ch: '^', color: 6, attr: 0, decgfx: 0,
    });
});

test('seed0004 loot and multi-pickup commits each own their scheduler turn', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 247),
    });
    const newt = game.level.monsters.find(monster => monster.mnum === 322);

    for (let index = 0; index < 248; index++) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0004 input ${index} RNG`,
        );
    }
    for (const index of [238, 240, 241, 242, 244, 245, 246])
        assertScreenExact(
            result.getScreens()[index],
            session.steps[index].screen,
            `seed0004 input ${index} screen`,
        );
    assert.deepEqual([game.u.ux, game.u.uy], [40, 5]);
    assert.deepEqual([newt.mx, newt.my], [67, 4]);
    assert.deepEqual(newt.mtrack[0], { x: 67, y: 5 });
    assert.deepEqual(game.inventory.slice(-4).map(object => [
        object.invlet, object.otyp, object.quan,
    ]), [
        ['k', 217, 1], ['l', 227, 1], ['m', 24, 10], ['n', 24, 1],
    ]);
    assert.equal(game._pending_message, 'm - 10 darts.  n - a poisoned dart.');
});

test('seed0004 pony attacks and kills the generated goblin through ALLOW_M', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 250),
    });
    const pony = game.level.monsters.find(monster => monster.mnum === 100);
    const corpse = game.level.objects[65][9].find(object =>
        object.otyp === 265 && object.corpsenm === 70);

    assertRngThrough(result, session, 250, 'seed0004');
    assert.equal(game.level.monsters.some(monster => monster.mnum === 70), false);
    // C's move-318 goblin retaliation misses; the pony subsequently reaches
    // its full 9 HP before this boundary.
    assert.deepEqual([pony.mx, pony.my, pony.mhp], [64, 8, 9]);
    assert.ok(corpse);
});

test('seed0004 tiny-newt death resumes with C-ordered off-hero vision', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 251),
    });
    const expectedSlice = session.steps[251].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[251], expectedSlice);
    assert.equal(game.level.monsters.some(monster => monster.mnum === 322), false);
});

test('seed0004 generated lichen skips random gender before m_initinv', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 272),
    });
    const expectedSlice = session.steps[271].rng.map(call =>
        call.replace(/\s+@.*$/, ''));
    const lichen = game.level.monsters.find(monster => monster.mnum === 158);

    assert.deepEqual(result.getRngSlices()[271], expectedSlice);
    assert.ok(lichen);
    assert.equal(lichen.female, false);
});

test('seed0004 same-level relocation reveals nearby shuffled gem colors', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 105),
    });
    for (const [index, x, y] of [
        [84, 27, 5], [85, 27, 5], [104, 13, 18],
    ]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[index])[y][x],
            decodeScreen(session.steps[index].screen)[y][x],
        );
    }
});

test('seed0004 pony evaluates but rejects fetching the goblin corpse', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 276),
    });
    const expectedSlice = session.steps[275].rng.map(call =>
        call.replace(/\s+@.*$/, ''));
    const pony = game.level.monsters.find(monster => monster.mnum === 100);
    const corpse = game.level.objects[65][9].find(object =>
        object.otyp === 265 && object.corpsenm === 70);

    assert.deepEqual(result.getRngSlices()[275], expectedSlice);
    for (const index of [271, 272, 274, 275])
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
    assert.equal(pony.edog.apport, 3);
    assert.ok(corpse);
});

test('seed0004 mixed pickup equips conflict ring before the next scheduler turn', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 287),
    });
    const screens = result.getScreens();
    const cursors = result.getCursors();

    assert.match(screens[279], /\x1b\[7mPick up what\?\x1b\[0m/);
    assert.match(screens[279], /\x1b\[7mCoins\x1b\[0m/);
    assert.match(screens[279], /\$ - 5 gold pieces/);
    assert.match(screens[279], /\x1b\[7mRings\x1b\[0m/);
    assert.match(screens[279], /a - an engagement ring/);
    assert.match(screens[280], /\$ \+ 5 gold pieces/);
    assert.match(screens[280], /a \+ an engagement ring/);
    assert.match(screens[281], /a - an engagement ring/);
    assert.match(screens[282], /a \+ an engagement ring/);
    assert.ok(screens[283].startsWith(
        '$ - 5 gold pieces (9 in total).  q - an engagement ring.',
    ));
    assert.ok(screens[284].startsWith(
        'What do you want to put on? [q or ?*]',
    ));
    assert.ok(screens[285].startsWith(
        'Which ring-finger, Right or Left? [rl]',
    ));
    assert.ok(screens[286].startsWith(
        'q - an engagement ring (on right hand).',
    ));
    for (const index of [279, 280, 281, 282])
        assert.deepEqual(
            decodeScreen(screens[index]),
            decodeScreen(session.steps[index].screen),
        );
    for (const index of [279, 280, 281, 282, 283, 284, 285, 286])
        assert.deepEqual(cursors[index], session.steps[index].cursor);

    for (const index of [283, 286]) {
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    const ring = game.inventory.find(object => object.otyp === RIN_CONFLICT);
    assert.equal(game._goldCount, 9);
    assert.equal(ring?.invlet, 'q');
    assert.equal(game.uright, ring);
    assert.equal(ring?.wornSlot, 'right-ring');
    assert.equal(game._pending_message, 'What do you want to read? [o or ?*] ');
});

test('seed0004 reads and consumes the teleport scroll before pager dismissal', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 290),
    });
    const screens = result.getScreens();
    const cursors = result.getCursors();

    assert.ok(screens[287].startsWith('What do you want to read? [o or ?*]'));
    assert.ok(screens[288].startsWith(
        'o - a scroll labeled STRC PRST SKRZ KRK.--More--',
    ));
    assert.ok(screens[289].startsWith(
        'As you read the scroll, it disappears.--More--',
    ));
    assert.ok(screens[290].startsWith(
        'You materialize in a different location!',
    ));
    for (const index of [287, 288, 289, 290]) {
        assert.deepEqual(cursors[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    assert.deepEqual([game.u.ux, game.u.uy], [14, 9]);
    assert.equal(game.inventory.some(object => object.otyp === 333), false);
});

test('seed0004 travel getpos reaches the lichen interruption boundary', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 298),
    });
    const screens = result.getScreens();
    const cursors = result.getCursors();

    assert.ok(screens[293].startsWith(
        'Where do you want to travel to?--More--',
    ));
    assert.ok(screens[294].startsWith(
        'Where do you want to travel to?--More--',
    ));
    assert.match(screens[295], /Tip: Farlooking or selecting a map location/);
    assert.deepEqual(
        decodeScreen(screens[295]),
        decodeScreen(session.steps[295].screen),
    );
    assert.ok(screens[296].startsWith(
        "(For instructions type a '?')  Move cursor to the desired destination:",
    ));
    assert.ok(screens[297].startsWith('staircase down'));
    assert.ok(screens[298].startsWith('staircase down'));
    for (const index of [293, 294, 295, 296, 297, 298]) {
        assert.deepEqual(cursors[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    assert.deepEqual([game.u.ux, game.u.uy], [20, 10]);
    assert.equal(game._runState, null);
    assert.deepEqual(game._travelTarget, { x: 42, y: 7 });
});

test('seed0004 tty return rushes south before shared lichen combat', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 301),
    });
    const expectedLines = new Map([
        [299, ''],
        [300, 'You miss the lichen.'],
        [301, 'You kill the lichen!'],
    ]);
    for (const [index, line] of expectedLines) {
        assert.equal(result.getScreens()[index].split('\n')[0], line);
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    const corpse = game.level.objects[21][11]
        .find(object => object.corpsenm === 158);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 11]);
    assert.equal(game.level.monsters.some(monster => monster.mnum === 158), false);
    assert.equal(corpse?.otyp, 265);
    assert.equal(corpse?.name, 'lichen corpse');
    assert.deepEqual(decodeScreen(result.getScreens()[301])[12][20],
        decodeScreen(session.steps[301].screen)[12][20]);
    assert.equal(game._pending_message, 'You kill the lichen!');
});

test('seed0004 floor corpse eating resumes across four scheduler turns', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 304),
    });
    assert.ok(result.getScreens()[303].startsWith(
        'There is a lichen corpse here; eat it? [ynq] (n)',
    ));
    assert.ok(result.getScreens()[304].startsWith(
        'This lichen corpse tastes okay.  You finish eating the lichen corpse.',
    ));
    for (const index of [303, 304]) {
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    assert.equal(game.level.objects[21][11]
        .some(object => object.corpsenm === 158), false);
    assert.equal(game._occupation, null);
    assert.deepEqual([game.u.ux, game.u.uy], [21, 11]);
});

test('seed0012 foul-fountain pager follows both vomiting turns', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0012-monk-vault-escort.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 169),
    });
    for (let step = 164; step <= 168; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
        assert.deepEqual(result.getRngSlices()[step], session.steps[step].rng
            .map(call => call.replace(/\s+@.*$/, '')));
    }
});

test('seed0012 teleport autopickup reveals committed gold after its pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0012-monk-vault-escort.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 242),
    });
    for (let step = 237; step <= 241; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.ok(result.getScreens()[239]
        .includes('$ - 300 gold pieces (307 in total).'));
});

test('seed0012 vault modal defers the post-action Seer tail', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0012-monk-vault-escort.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 277),
    });
    for (let step = 266; step <= 276; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
        assert.deepEqual(result.getRngSlices()[step], session.steps[step].rng
            .map(call => call.replace(/\s+@.*$/, '')));
    }
});

test('seed0002 rotten corpse runs rottenfood before quartered eating', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 279),
    });
    const expected = session.steps[278].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[278], expected);
    assert.deepEqual(
        decodeScreen(result.getScreens()[278]),
        decodeScreen(session.steps[278].screen),
    );
    assert.deepEqual(result.getCursors()[278], session.steps[278].cursor);
    assert.equal(game._occupation, null);
    assert.equal(game.u.uhunger, 721);
    assert.equal(game.level.objects.flat(2)
        .some(object => object?.corpsenm === 70), false);
});

test('seed0002 sink sewage reuses the two-turn vomiting scheduler', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 312),
    });
    const expected = session.steps[311].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[311], expected);
    assert.deepEqual(
        decodeScreen(result.getScreens()[311]),
        decodeScreen(session.steps[311].screen),
    );
    assert.deepEqual(result.getCursors()[311], session.steps[311].cursor);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game._helplessReason, null);
    // eat.c:gethungry() adds load metabolism only above SLT_ENCUMBER;
    // ordinary Burdened melee does not pay the old duplicated surcharge.
    assert.equal(game.u.uhunger, 650);
});

test('seed0002 ordinary healing applies effect before the actor scan', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 316),
    });
    const expected = session.steps[315].rng.map(call =>
        call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[315], expected);
    assert.deepEqual(
        decodeScreen(result.getScreens()[315]),
        decodeScreen(session.steps[315].screen),
    );
    assert.deepEqual(result.getCursors()[315], session.steps[315].cursor);
    assert.deepEqual([game.u.uhp, game.u.uhpmax, game.u.uhppeak], [14, 14, 14]);
    assert.equal(game.inventory.find(object => object.invlet === 'e')?.quan, 2);
});

test('seed0002 burdened descent damages before followers but preserves old pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 320),
    });
    for (const step of [318, 319]) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(result.getScreens()[318].split('\n')[0],
        'You fall down the stairs.--More--');
});

test('seed0002 pet tty continuations preserve shop stock through entry', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 341),
    });
    for (let step = 328; step <= 340; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.equal(
            result.getScreens()[step].split('\n')[0],
            session.steps[step].screen.split('\n')[0],
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(result.getScreens()[330].split('\n')[0],
        'You see here a statue of a newt.--More--');
    assert.equal(result.getScreens()[332].split('\n')[0],
        'The little dog picks up a food ration.--More--');
    assert.equal(result.getScreens()[333].split('\n')[0],
        'You hear someone counting gold coins.');
    assert.equal(result.getScreens()[340].split('\n')[0],
        '"Hello, David!  Welcome to Ermenak\'s used armor dealership!"');
});

test('seed0002 checks the Seer after the complete burdened movement ration', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 344),
    });
    for (const step of [342, 343]) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    // The following comma now pauses inside addtobill()'s quote before the
    // pickup message or another timed action can advance the global turn.
    assert.equal(game.moves, 414);
    assert.equal(game.seer_turn, 447);
});

test('seed0002 prices shop stock and bills pickup before both tty pagers', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 347),
    });
    for (let step = 342; step <= 346; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            result.getScreens()[step].split('\n').slice(0, 2),
            session.steps[step].screen.split('\n').slice(0, 2),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    const shield = game.inventory.find(object => object.otyp === 158);
    assert.ok(shield);
    assert.equal(shield.o_id, 140);
    assert.equal(shield.invlet, 'y');
    assert.equal(shield.unpaid, true);
    const shopkeeper = game.level.rooms.find(room => room.resident?.isshk)
        ?.resident;
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [73, 16]);
    assert.deepEqual(shopkeeper.eshk.bill, [{
        bo_id: 140, bquan: 1, useup: false, price: 50,
    }]);
});

test('seed0002 pays the bill and wears the zero-delay shield', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 430),
    });
    for (let step = 347; step <= 429; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            result.getScreens()[step].split('\n').slice(0, 4),
            session.steps[step].screen.split('\n').slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    const shield = game.inventory.find(object => object.o_id === 140);
    const shopkeeper = game.level.rooms.find(room => room.resident?.isshk)
        ?.resident;
    assert.equal(game._goldCount, 1175);
    assert.equal(shield.unpaid, false);
    assert.equal(shield.worn, true);
    assert.equal(game.uarms, shield);
    assert.equal(game._delayedAction, null);
    assert.deepEqual(shopkeeper.eshk.bill, []);
    assert.equal(shopkeeper.eshk.billct, 0);
});

test('seed0002 restores its tame follower and reaches the sleep-ray prompt', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 460),
    });
    for (let step = 430; step <= 459; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            result.getScreens()[step].split('\n').slice(0, 4),
            session.steps[step].screen.split('\n').slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    const tameFollowers = game.level.monsters.filter(monster => monster.pet);
    assert.deepEqual(tameFollowers.map(monster => [
        monster.mnum, monster.mx, monster.my, monster.mtame,
    ]), [[16, 22, 7, 10]]);
    assert.deepEqual(game.u._exercise, [10, 4, 6, 0, -1, 0]);
    assert.equal(game._nextAttribCheck, 1509);
});

test('seed0002 fires the sleep ray, browses terrain, and cancels adjacent loot', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 512),
    });
    for (let step = 460; step <= 511; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]).slice(0, 4),
            decodeScreen(session.steps[step].screen).slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(result.getScreens()[507].split('\n')[0],
        'Loot in what direction?');
    assert.equal(result.getScreens()[508].split('\n')[0],
        'cmdassist: Invalid direction key!');
    assert.equal(result.getScreens()[510].split('\n')[0], 'Never mind.');
    // The final captured frame precedes input 511; consuming that eastward
    // movement leaves the hero one square beyond the recorded cursor.
    assert.deepEqual([game.u.ux, game.u.uy], [31, 5]);
    assert.equal(game.moves, 622);
});

test('seed0002 autocompletes force and schedules each no-box refusal', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 525),
    });
    for (let step = 512; step <= 524; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]).slice(0, 4),
            decodeScreen(session.steps[step].screen).slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(result.getScreens()[517].split('\n')[0], '# force');
    assert.equal(result.getScreens()[518].split('\n')[0],
        'You decide not to force the issue.');
    assert.equal(result.getScreens()[520].split('\n')[0], '# force');
    assert.equal(result.getScreens()[521].split('\n')[0],
        'You decide not to force the issue.');
    assert.equal(result.getScreens()[523].split('\n')[0], '');
});

test('seed0002 compacts apply letters and treats Return as getobj cancellation', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 530),
    });
    for (let step = 525; step <= 529; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]).slice(0, 4),
            decodeScreen(session.steps[step].screen).slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(result.getScreens()[525].split('\n')[0],
        'What do you want to use or apply? [ch-kop or ?*]');
    assert.equal(result.getScreens()[526].split('\n')[0], 'Never mind.');
    assert.equal(result.getScreens()[527].split('\n')[0],
        'What do you want to use or apply? [ch-kop or ?*]');
    assert.equal(result.getScreens()[528].split('\n')[0], 'Never mind.');
});

test('seed0002 selects a spellbook from inventory and cancels item actions', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 538),
    });
    for (let step = 529; step <= 537; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]).slice(0, 4),
            decodeScreen(session.steps[step].screen).slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.ok(result.getScreens()[530].split('\n')[0].includes(
        '\x1b[7mDo what with the spellbook of stone to flesh?\x1b[0m',
    ));
    assert.equal(result.getScreens()[531].split('\n')[0],
        result.getScreens()[530].split('\n')[0]);
    assert.equal(result.getScreens()[532].split('\n')[0], '');
});

test('seed0002 sleep ray bounces twice and reflects from the shield', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 564),
    });
    for (let step = 538; step <= 563; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]).slice(0, 4),
            decodeScreen(session.steps[step].screen).slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(result.getScreens()[538].split('\n')[0],
        'The sleep ray bounces!  The sleep ray hits you!--More--');
    assert.equal(result.getScreens()[552].split('\n')[0],
        'But it reflects from your shield!  The sleep ray bounces!--More--');
    assert.equal(result.getScreens()[563].split('\n')[0],
        'The sleep ray hits you!  But it reflects from your shield!');
    assert.ok(game._knownObjectTypes.has(158));
    assert.notEqual(game.level.monsters.find(monster => monster.pet)?.mcanmove, 0);
});

test('seed0002 clears cross-level travel target and rejects the hero square', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 569),
    });
    for (let step = 564; step <= 568; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]).slice(0, 4),
            decodeScreen(session.steps[step].screen).slice(0, 4),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.equal(result.getScreens()[564].split('\n')[0],
        "Where do you want to travel to?  (For instructions type a '?')");
    assert.equal(result.getScreens()[565].split('\n')[0],
        'You are already here.');
    assert.equal(game._travelTarget, null);
});

test('seed0002 drums, holds invalid More keys, and scares its follower', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 583),
    });
    for (let step = 569; step <= 582; step++) {
        const expected = session.steps[step].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[step], expected);
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    for (let step = 569; step <= 579; step++) {
        assert.equal(result.getScreens()[step].split('\n')[0],
            'You start playing your drum.  You beat a deafening row!--More--');
    }
    assert.equal(result.getScreens()[580].split('\n')[0],
        'The little dog turns to flee.');
    assert.equal(game.deaf, true);
    assert.equal(game.u.deafTurns, 32);
    assert.deepEqual(game.level.monsters.filter(monster => monster.pet)
        .map(monster => [monster.mx, monster.my, monster.mflee]),
    [[31, 8, 1]]);
});

test('seed0002 inventory projects known zero enchantment and discovered armor', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 585),
    });
    for (let step = 583; step <= 584; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    const inventory = result.getScreens()[583];
    assert.ok(inventory.includes('x - a +0 chain mail (being worn)'));
    assert.ok(inventory.includes('y - a +0 shield of reflection (being worn)'));
});

test('seed0002 monster door feedback retains the pre-recalc destination sighting', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 256),
    });
    assert.deepEqual(
        decodeScreen(result.getScreens()[255]),
        decodeScreen(session.steps[255].screen),
    );
    assert.deepEqual(result.getCursors()[255], session.steps[255].cursor);
    assert.ok(result.getScreens()[255].includes('You see a door open.'));
});

test('seed0002 ranged pager retains and then clears the temporary missile glyph', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 258),
    });
    for (let step = 256; step <= 257; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.ok(result.getScreens()[256]
        .includes('The goblin throws a crude dagger!--More--'));
});

test('seed0002 extended-command editor autocompletes quit and kills its line', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 310),
    });
    for (let step = 306; step <= 308; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
});

test('wizard extended-command completion and deferred rub lifecycle stay exact', async () => {
    const tour = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const tourResult = await runSegment({
        ...tour, moves: tour.moves.slice(0, 7),
    });
    for (const step of [5, 6]) {
        assert.deepEqual(
            decodeScreen(tourResult.getScreens()[step]),
            decodeScreen(tour.steps[step].screen),
        );
        assert.deepEqual(tourResult.getCursors()[step], tour.steps[step].cursor);
    }

    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const wishlistResult = await runSegment({
        ...wishlist, moves: wishlist.moves.slice(0, 57),
    });
    for (let step = 9; step <= 56; step++) {
        assertScreenExact(
            wishlistResult.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            wishlistResult.getCursors()[step], wishlist.steps[step].cursor,
        );
        assertRngSliceExact(
            wishlistResult.getRngSlices()[step],
            wishlist.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
    assert.equal(game.uwep?.otyp, MAGIC_LAMP);
    assert.equal(game.uwep?.spe, 1);
    assert.deepEqual(game._cannedCommands, []);
    assert.equal(game.blind, true);
    assert.equal(game.u?.ucreamed, 3);
    assert.equal(
        game.inventory?.some(object => object.name === 'cream pie'),
        false,
    );
});

test('wizard wipe and controlled polymorph use red-dragon movement ration', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...wishlist, moves: wishlist.moves.slice(0, 121),
    });

    for (let step = 57; step <= 121; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }

    assert.equal(game.u.umonnum, 146);
    assert.equal(game.u.mh, 103);
    assert.equal(game.u.mhmax, 103);
    assert.equal(game.u.mtimedone, 49);
    assert.equal(game.u.acurr.a[0], 118);
    assert.equal(game.u.uac, -1);
    assert.equal(game.u.flying, true);
    assert.equal(game.u._encumbrance, '');
    assert.equal(game.uwep, null);
    assert.equal(game.uarmc, null);
});

test('wizard invokes zero-power Mjollnir through the source scheduler', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...wishlist, moves: wishlist.moves.slice(0, 150),
    });

    for (let step = 140; step <= 150; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }

    const mjollnir = game.inventory.find(object => object.oartifact === 3);
    assert.equal(mjollnir?.invlet, 'p');
    assert.equal(mjollnir?.oartifact, 3);
});

test('wizard drops an unknown-BUC chest through doname', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 170),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 165; step <= 170; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
});

test('wizard red-dragon command capability gates precede object UI', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 207),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 171; step <= 206; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
});

test('controlled generic human selection rebuilds through newman', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 208),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertScreenExact(
        result.getScreens()[207],
        wishlist.steps[207].screen,
        'seed0108 input 207 screen',
    );
    assert.deepEqual(
        result.getCursors()[207], wishlist.steps[207].cursor,
        'seed0108 input 207 cursor',
    );
    assertRngSliceExact(
        result.getRngSlices()[207],
        wishlist.steps[207].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0108 input 207 RNG',
    );
    assert.deepEqual(
        [game.u.ulevel, game.u.uexp, game.u.uhp, game.u.uhpmax,
            game.u.uen, game.u.uenmax, game.u.uhunger],
        [2, 31, 18, 21, 23, 23, 612],
    );
});

test('open cancellation reports through get_adjacent_loc', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 218),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 208; step <= 217; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
});

test('blunt force-lock occupation retains pet prose through success', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 237),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 218; step <= 236; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
});

test('container category cancellation preserves query_category boundary', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 246),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 237; step <= 245; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
});

test('container BUC categories classify gold through goldX', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0007-rogue-snake-swamp.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 116),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 112; step <= 116; step++) {
        assertScreenExact(
            result.getScreens()[step],
            session.steps[step].screen,
            `seed0007 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `seed0007 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0007 input ${step} RNG`,
        );
    }
});

test('tip cancellation stays at the floor-container ynq boundary', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 253),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 246; step <= 252; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
});

test('annotate completion stores the current mapseen name zero-time', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 268),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 253; step <= 267; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
    assert.equal(
        game._levelAnnotations.get(
            `${game.u.uz.dnum}:${game.u.uz.dlevel}`,
        ),
        'Test',
    );
    assert.equal(game.context.move, 0);
});

test('herecmdmenu derives and restores the self-action corner menu', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves.slice(0, 282),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 268; step <= 281; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
    assert.equal(game.context.move, 0);
});

test('wizard Sokoban arrival, attributes, and look-here tail stay exact', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: wishlist.seed,
        datetime: wishlist.datetime,
        nethackrc: wishlist.nethackrc,
        moves: wishlist.moves,
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 0; step < wishlist.steps.length; step++) {
        assertScreenExact(
            result.getScreens()[step],
            wishlist.steps[step].screen,
            `seed0108 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], wishlist.steps[step].cursor,
            `seed0108 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            wishlist.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0108 input ${step} RNG`,
        );
    }
    assert.equal(game._activeSpecialLevel?.prototype, 'soko1');
    assert.equal(game._activeSpecialLevel?.variant, 1);
    assert.equal(game.u?.weaponSkills?.[14]?.skill, 0);
    assert.equal(game.u?.weaponSkills?.[15]?.skill, 2);
});

test('uninterrupted magic-lamp release follows the C djinni and wish graph', async () => {
    const wishlist = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const moves = '  ns#wizwish\nmagic lamp\n#rub\nn '
        + '#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn'
        + '   dagger\n ';
    const result = await runSegment({ ...wishlist, moves });

    const releaseScreen = "In a cloud of smoke, a djinni emerges!  The djinni speaks.--More--\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\u001b[38C---.------ -\n\u001b[38C|..........|\n\u001b[38C|..\u001b[90m)\u001b[97mf\u001b[39m......|\n\u001b[38C|...\u001b[97m@\u001b[93m&\u001b[39m.....\u001b[33m+\u001b[39m\n\u001b[38C------------\n\nWizard the Evoker\u001b[14CSt:8 Dx:18 Co:12 In:18 Wi:10 Ch:9 Neutral\nDlvl:1 $:0 HP:11(12) Pw:7(7) AC:9 Xp:1";
    assertScreenExact(
        result.getScreens()[79], releaseScreen,
        'supplemental C djinni release screen',
    );
    assert.deepEqual(result.getCursors()[79], [66, 0, 1]);
    assertRngSliceExact(result.getRngSlices()[79], [
        'rn2(3)=0', 'rn2(500)=332',
        'rn2(8)=6', 'rn2(7)=3', 'rn2(6)=4', 'rn2(5)=1',
        'rn2(4)=0', 'rn2(3)=0', 'rn2(2)=0',
        'rn2(16)=0', 'rn2(15)=11', 'rn2(14)=1', 'rn2(13)=3',
        'rn2(12)=2', 'rn2(11)=7', 'rn2(10)=2', 'rn2(9)=0',
        'rn2(8)=1', 'rn2(7)=1', 'rn2(6)=4', 'rn2(5)=3',
        'rn2(4)=3', 'rn2(3)=2', 'rn2(2)=0',
        'rn2(17)=12', 'rn2(16)=8', 'rn2(15)=9', 'rn2(14)=5',
        'rn2(13)=7', 'rn2(12)=3', 'rn2(11)=5', 'rn2(10)=6',
        'rn2(9)=4', 'rn2(8)=4', 'rn2(7)=1', 'rn2(6)=2',
        'rn2(5)=4', 'rn2(4)=0', 'rn2(3)=0', 'rn2(2)=1',
        'rnd(2)=1', 'd(6,8)=31', 'rn2(2)=1', 'rn2(16)=7',
        'rn2(2)=1', 'rn2(75)=3', 'rn2(35)=5', 'rn2(13)=8',
        'rnd(2)=2', 'rn2(5)=3', 'rn2(17)=14', 'rn2(50)=4',
        'rn2(10)=6', 'rn2(3)=2', 'rnd(2)=1', 'rn2(4)=1',
        'rn2(100)=11', 'rn2(100)=76', 'rn2(5)=0',
    ], 'supplemental C djinni release RNG');

    const continuation = new Map([
        [80, ['"I am in your debt.  I will grant one wish!"--More--',
            [52, 0, 1], ['rn2(100)=82', 'rn2(100)=6']]],
        [81, ['You may wish for an object.--More--', [35, 0, 1], []]],
        [82, ['For what do you wish?', [22, 0, 1], []]],
        [83, ['For what do you wish? d', [23, 0, 1], []]],
        [84, ['For what do you wish? da', [24, 0, 1], []]],
        [85, ['For what do you wish? dag', [25, 0, 1], []]],
        [86, ['For what do you wish? dagg', [26, 0, 1], []]],
        [87, ['For what do you wish? dagge', [27, 0, 1], []]],
        [88, ['For what do you wish? dagger', [28, 0, 1], []]],
    ]);
    for (const [step, [topline, cursor, rng]] of continuation) {
        assert.equal(decodedTopline(result.getScreens()[step]), topline);
        assert.deepEqual(result.getCursors()[step], cursor);
        assertRngSliceExact(
            result.getRngSlices()[step], rng,
            `supplemental C djinni continuation input ${step} RNG`,
        );
    }

    assert.equal(decodedTopline(result.getScreens()[89]), 'o - a dagger.');
    assert.deepEqual(result.getCursors()[89], [42, 19, 1]);
    assertRngSliceExact(result.getRngSlices()[89], [
        'rn2(31)=30', 'rnd(2)=1', 'rn2(11)=6', 'rn2(10)=7',
        'rn2(10)=4', 'rn2(100)=32', 'rn2(80)=12', 'rn2(80)=3',
        'rn2(1000)=920', 'rn2(100)=19', 'rn2(19)=6',
        'rn2(5)=2', 'rn2(4)=2', 'rn2(100)=42', 'rn2(8)=6',
        'rn2(100)=0', 'rn2(8)=2', 'rn2(3)=1', 'rn2(12)=3',
        'rn2(100)=86', 'rn2(3)=1', 'rn2(12)=5', 'rn2(3)=0',
        'rn2(12)=7', 'rn2(1)=0', 'rn2(100)=26', 'rn2(5)=4',
        'rn2(5)=2', 'rn2(8)=3', 'rn2(5)=0', 'rn2(12)=11',
        'rn2(12)=2', 'rn2(12)=1', 'rn2(70)=5', 'rn2(100)=66',
        'rn2(20)=17', 'rn2(94)=22',
    ], 'supplemental C djinni wish completion RNG');

    assert.equal(game.uwep?.otyp, OIL_LAMP);
    assert.equal(game.uwep?.spe, 0);
    assert.equal(game.uwep?.age, 1332);
    assert.equal(
        game.level?.monsters?.some(monster => monster.mnum === 315),
        false,
    );
    assert.equal(
        game.inventory?.some(object => object.otyp === DAGGER),
        true,
    );
});

test('uncursed and cursed djinni dispositions follow C beatitude remapping', async () => {
    const base = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const uncursedMoves = '  ns#wizwish\nuncursed magic lamp\n#rub\np '
        + '#rub\np#rub\np#rub\np#rub\np#rub\np#rub\np#rub\np'
        + '#rub\np#rub\np#rub\np#rub\np ';
    const uncursed = await runSegment({
        ...base, seed: 109, moves: uncursedMoves,
    });
    assert.equal(
        decodedTopline(uncursed.getScreens()[39]),
        'You now wield a lamp.  You see a puff of smoke.',
    );
    assert.equal(
        decodedTopline(uncursed.getScreens()[64]),
        'In a cloud of smoke, a djinni emerges!  The djinni speaks.--More--',
    );
    assert.deepEqual(uncursed.getCursors()[64], [66, 0, 1]);
    assert.deepEqual(
        uncursed.getRngSlices()[64].slice(-1),
        ['rn2(5)=4'],
    );
    assert.equal(
        decodedTopline(uncursed.getScreens()[69]),
        '"You disturbed me, fool!"',
    );
    let djinni = game.level?.monsters
        ?.find(monster => monster.mnum === 315);
    assert.equal(djinni?.mpeaceful, 0);
    assert.equal(djinni?.mtame || 0, 0);
    assert.equal(game.uwep?.otyp, OIL_LAMP);
    assert.equal(game.uwep?.age, 1424);

    const cursedMoves = '  ns#wizwish\ncursed magic lamp\n#rub\nn '
        + '#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn#rub\nn'
        + '#rub\nn#rub\nn#rub\nn#rub\nn ';
    const cursed = await runSegment({
        ...base, seed: 108, moves: cursedMoves,
    });
    assert.equal(
        decodedTopline(cursed.getScreens()[86]),
        'In a cloud of smoke, a djinni emerges!  The djinni speaks.--More--',
    );
    assert.deepEqual(cursed.getCursors()[86], [66, 0, 1]);
    assert.deepEqual(
        cursed.getRngSlices()[86].slice(-2),
        ['rn2(5)=0', 'rn2(4)=2'],
    );
    assert.equal(
        decodedTopline(cursed.getScreens()[91]),
        '"You freed me!"',
    );
    djinni = game.level?.monsters?.find(monster => monster.mnum === 315);
    assert.equal(djinni?.mpeaceful, 1);
    assert.equal(game.uwep?.otyp, OIL_LAMP);
    assert.equal(game.uwep?.age, 1332);

    const vanishMoves = '  ns#wizwish\nuncursed magic lamp\n#rub\nn ';
    const vanished = await runSegment({
        ...base, seed: 110, moves: vanishMoves,
    });
    assert.equal(
        decodedTopline(vanished.getScreens()[39]),
        'You now wield a lamp.  '
            + 'In a cloud of smoke, a djinni emerges!--More--',
    );
    assert.equal(
        decodedTopline(vanished.getScreens()[40]),
        'The djinni speaks.  "It is about time!"  The djinni vanishes.',
    );
    assert.deepEqual(vanished.getCursors()[40], [51, 17, 1]);
    assertRngSliceExact(vanished.getRngSlices()[40], [
        'rn2(5)=3', 'rn2(19)=7', 'rn2(5)=4', 'rn2(4)=0',
        'rn2(100)=64', 'rn2(1)=0', 'rn2(2)=1', 'rn2(5)=0',
        'rn2(5)=2', 'rn2(12)=4', 'rn2(5)=1', 'rn2(5)=1',
        'rn2(4)=0', 'rn2(1)=0', 'rn2(2)=0', 'rn2(5)=2',
        'rn2(12)=11', 'rn2(12)=3', 'rn2(12)=3', 'rn2(12)=10',
        'rn2(70)=7', 'rn2(200)=94', 'rn2(20)=2', 'rn2(91)=1',
    ], 'supplemental C uncursed-vanish disposition');
    assert.equal(
        game.level?.monsters?.some(monster => monster.mnum === 315),
        false,
    );
    assert.equal(game.uwep?.otyp, OIL_LAMP);
    assert.equal(game.uwep?.age, 1341);
});

test('tame djinni initializes edog state and skips tame allies', async () => {
    const base = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0108-wizard-extcmd-wishlist.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const moves = '  ns#wizwish\nuncursed magic lamp\n#rub\nn '
        + '............';
    const result = await runSegment({ ...base, seed: 105, moves });

    assert.equal(
        decodedTopline(result.getScreens()[40]),
        'The djinni speaks.  "Thank you for freeing me!"',
    );
    assert.deepEqual(result.getCursors()[40], [57, 18, 1]);
    assertRngSliceExact(result.getRngSlices()[40], [
        'rn2(5)=1', 'rn2(19)=18', 'rn2(5)=4', 'rn2(4)=1',
        'rn2(100)=45', 'rn2(100)=46', 'rn2(8)=3', 'rn2(100)=19',
        'rn2(8)=2', 'rn2(100)=28', 'rn2(8)=3', 'rn2(1)=0',
        'rn2(100)=8', 'rn2(5)=1', 'rn2(5)=3', 'rn2(20)=4',
        'rn2(5)=1', 'rn2(12)=1', 'rn2(12)=8', 'rn2(12)=5',
        'rn2(12)=0', 'rn2(12)=11', 'rn2(70)=47', 'rn2(400)=371',
        'rn2(200)=180', 'rn2(20)=4', 'rn2(94)=9',
    ], 'supplemental C tame-djinni transition');

    // On the first wait turn, C's dog_move() skips the occupied kitten
    // square because both actors are tame, then advances the djinni west.
    assert.equal(decodeScreen(result.getScreens()[41])[19][55].ch, '&');
    assert.equal(decodeScreen(result.getScreens()[41])[19][56].ch, '.');
    assertRngSliceExact(result.getRngSlices()[41], [
        'rn2(5)=0', 'rn2(100)=66', 'rn2(100)=96', 'rn2(8)=5',
        'rn2(100)=37', 'rn2(100)=49', 'rn2(100)=80', 'rn2(5)=0',
        'rn2(5)=2', 'rn2(4)=0', 'rn2(100)=63', 'rn2(100)=29',
        'rn2(8)=4', 'rn2(100)=21', 'rn2(8)=3', 'rn2(100)=60',
        'rn2(8)=7', 'rn2(100)=55', 'rn2(1)=0', 'rn2(2)=0',
        'rn2(100)=7', 'rn2(5)=2', 'rn2(5)=0', 'rn2(12)=3',
        'rn2(16)=12', 'rn2(5)=2', 'rn2(12)=4', 'rn2(12)=5',
        'rn2(12)=3', 'rn2(12)=4', 'rn2(12)=4', 'rn2(70)=57',
        'rn2(400)=302', 'rn2(200)=14', 'rn2(20)=9', 'rn2(94)=68',
    ], 'supplemental C tame-allies movement');

    assert.equal(decodeScreen(result.getScreens()[52])[19][53].ch, '&');
    assertRngSliceExact(result.getRngSlices()[52], [
        'rn2(5)=2', 'rn2(100)=75', 'rn2(100)=50', 'rn2(8)=5',
        'rn2(100)=71', 'rn2(100)=71', 'rn2(1)=0', 'rn2(100)=30',
        'rn2(12)=2', 'rn2(12)=8', 'rn2(12)=11', 'rn2(5)=3',
        'rn2(5)=4', 'rn2(4)=3', 'rn2(100)=19', 'rn2(100)=78',
        'rn2(8)=3', 'rn2(100)=94', 'rn2(8)=4', 'rn2(100)=66',
        'rn2(8)=0', 'rn2(100)=86', 'rn2(12)=1', 'rn2(12)=9',
        'rn2(100)=84', 'rn2(12)=11', 'rn2(5)=0', 'rn2(5)=0',
        'rn2(16)=3', 'rn2(12)=6', 'rn2(20)=2', 'rn2(5)=3',
        'rn2(5)=0', 'rn2(5)=2', 'rn2(12)=7', 'rn2(12)=9',
        'rn2(12)=8', 'rn2(12)=7', 'rn2(12)=5', 'rn2(70)=19',
        'rn2(400)=30', 'rn2(200)=177', 'rn2(20)=12', 'rn2(94)=93',
    ], 'supplemental C tame-djinni twelfth wait');

    const djinni = game.level?.monsters
        ?.find(monster => monster.mnum === 315);
    assert.equal(djinni?.mtame, 5);
    assert.equal(djinni?.pet, undefined);
    assert.equal(djinni?.edog?.parentmid, djinni?.m_id);
    assert.equal(djinni?.edog?.apport, 8);
    assert.equal(djinni?.edog?.hungrytime, 1003);
    assert.strictEqual(djinni?.mextra?.edog, djinni?.edog);
    assert.equal(game.u?.uconduct?.pets, 2);
    assert.equal(game.uwep?.otyp, OIL_LAMP);
    assert.equal(game.uwep?.age, 1060);
});

test('seed0361 quest expulsion and rolling-boulder spoteffects stay exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 212),
        storage: new Map(),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 160; index <= 212; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    const expectedFrames = session.steps[206].animation_frames;
    const actualFrames = result.getAnimationFramesByStep()[206];
    assert.deepEqual(
        actualFrames.map(frame => decodeScreen(frame.screen)),
        expectedFrames.map(frame => decodeScreen(frame.screen)),
    );
    assert.deepEqual(
        actualFrames.map(frame => frame.cursor),
        expectedFrames.map(frame => frame.cursor),
    );

    const trap = game.level.traps.find(candidate =>
        candidate.ttyp === 7 && candidate.tx === 35 && candidate.ty === 2);
    assert.equal(trap?.tseen, true);
    assert.deepEqual([trap?.launch.x, trap?.launch.y], [32, 2]);
    assert.deepEqual([trap?.launch2.x, trap?.launch2.y], [38, 2]);
    assert.equal(
        game.level.objects?.[38]?.[2]?.some(object =>
            object.otyp === BOULDER && object.o_id === 346),
        true,
    );
});

test('seed0361 random temple is constructed before ordinary room filling', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 220),
        storage: new Map(),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 213; index <= 220; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    const temple = game.level.rooms.slice(0, game.level.nroom)
        .find(room => room.rtype === TEMPLE);
    assert.deepEqual(
        [temple?.lx, temple?.ly, temple?.hx, temple?.hy, temple?.roomnoidx],
        [30, 4, 40, 9, 3],
    );
    const altar = game.level.at(35, 6);
    assert.equal(altar?.typ, ALTAR);
    assert.equal(altar?.flags, AM_LAWFUL | AM_SHRINE);

    const priest = game.level.monsters.find(monster => monster.ispriest);
    assert.deepEqual(
        [priest?.m_id, priest?.mnum, priest?.mx, priest?.my],
        [469, 275, 35, 5],
    );
    assert.deepEqual(priest?.epri, {
        shroom: 6,
        shralign: 1,
        shrpos: { x: 35, y: 6 },
        shrlevel: { dnum: 0, dlevel: 17 },
        parentmid: 469,
        intone_time: 0,
        enter_time: 0,
        peaceful_time: 0,
        hostile_time: 0,
    });
    assert.equal(
        priest?.minvent.filter(object => object.oclass === 10).length,
        3,
    );
});

test('seed0361 Soko zoo elf retains the winning offensive-item tail', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 226),
        storage: new Map(),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 221; index <= 225; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    const greyElf = game.level.monsters.find(monster =>
        monster.m_id === 567 && monster.mnum === 267);
    assert.deepEqual(
        [greyElf?.m_lev, greyElf?.mhp, greyElf?.mx, greyElf?.my],
        [9, 62, 30, 18],
    );
    assert.equal(
        greyElf?.minvent.some(object =>
            object.o_id === 574 && object.otyp === 320),
        true,
    );
});

test('seed0361 Minend distant wizard retains phase-four AC setup', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 235),
        storage: new Map(),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 226; index <= 234; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    const distantWizard = game._lastQuietMonsterActions.find(action =>
        action.mnum === 167
        && action.movement?.oldx === 50 && action.movement?.oldy === 7);
    assert.equal(
        distantWizard?.movement?.phaseFourArmorClassEvaluated,
        true,
    );
});

test('seed0361 Minend stays exact through three Grayswandir exchanges', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 239),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 235; index <= 239; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }
    const healedLeader = game.level.monsters.find(monster =>
        monster.mnum === 166
        && monster.mx === 52 && monster.my === 19);
    assert.deepEqual(
        [healedLeader?.mhp, healedLeader?.mhpmax],
        [19, 19],
    );
    assert.equal(
        healedLeader?.minvent.some(object => object.otyp === POT_HEALING),
        false,
    );

    const struckRuler = game.level.monsters.find(monster =>
        monster.m_id === 738 && monster.mnum === 168);
    assert.deepEqual(
        [struckRuler?.mx, struckRuler?.my, struckRuler?.mhp,
            struckRuler?.mhpmax],
        [54, 16, 6, 36],
    );
    assert.deepEqual(
        [game.uwep?.oartifact, game.uwep?.oextra?.oname],
        [14, 'Grayswandir'],
    );
    assert.deepEqual(
        [
            game.u.weaponSkills[4].skill,
            game.u.weaponSkills[9].skill,
            game.u.weaponSkills[9].maxSkill,
            game.u.weaponSkills[26].skill,
        ],
        [2, 1, 4, 2],
    );

    const stationaryLeader = game._lastQuietMonsterActions.find(action =>
        action.mnum === 166
        && action.movement?.oldx === 52 && action.movement?.oldy === 19);
    assert.equal(
        stationaryLeader?.movement?.phaseFourArmorClassEvaluated,
        true,
    );
});

test('seed0361 rejected Quest return preserves the materialization pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 285),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 270; index <= 285; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }
    assert.equal(game.quest_status.first_start, true);
    assert.equal(game.quest_status.met_leader, true);
    assert.equal(game.quest_status.not_ready, 1);
    assert.equal(
        game._pending_message,
        'Once again, you are back at the College of Archeology.',
    );
});

test('seed0361 Tower-1 gives Vlad his selected general armament', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 301),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 286; index <= 301; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(game._activeSpecialLevel?.file, 'tower1.lua');
    const vlad = game.level.monsters.find(monster => monster.mnum === 228);
    assert.ok(vlad);
    assert.deepEqual(
        vlad.minvent.slice(0, 2).map(object => object.otyp),
        [CANDELABRUM_OF_INVOCATION, TWO_HANDED_SWORD],
    );
});

test('seed0361 Arc-loca composes its Lua graph and locate-first pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 311),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 302; index <= 311; index++) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(result.getRngSlices()[307].length, 8285);
    assert.equal(game._activeSpecialLevel?.file, 'Arc-loca.lua');
    assert.equal(game.quest_status.first_locate, true);
    assert.equal(game.level.traps.length, 23);
    assert.equal(game.level.engravings.length, 4);
});

test('seed0361 Arc-filb executes its six room-form callbacks', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 314),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 312; index <= 314; index++) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(result.getRngSlices()[314].length, 2560);
    assert.equal(game._activeSpecialLevel?.file, 'Arc-filb.lua');
    assert.equal(game.level.nroom, 6);
    assert.equal(game.level.monsters.length, 7);
    assert.equal(game.level.traps.length, 4);
});

test('seed0361 Arc-goal composes its artifact graph and cached goal-next', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 343),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 315; index <= 343; index++) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(result.getRngSlices()[317].length, 8448);
    assert.equal(game._activeSpecialLevel?.file, 'Arc-goal.lua');
    assert.equal(game.quest_status.made_goal, 2);
    assert.equal(game.level.traps.length, 7);
    assert.equal(game.level.monsters.length, 29);
    const artifact = game.level.objects.flat(2)
        .find(object => object?.questArtifact);
    assert.equal(artifact?.oextra?.oname, 'The Orb of Detection');
    assert.equal(artifact?.spe, 5);
    assert.equal(artifact?.blessed, true);
    assert.equal(game._pending_message, 'You see here 2 food rations.');
});

test('seed0361 sleeping piercer restraps before dochug sleep handling', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0361-archeologist-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 365),
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 344; index <= 364; index++) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(result.getRngSlices()[364].length, 50);
    const piercer = game.level.monsters.find(monster =>
        monster.m_id === 665);
    assert.ok(piercer);
    assert.equal(piercer.msleeping, 1);
    assert.equal(piercer.mundetected, 1);
    const doppelganger = game.level.monsters.find(monster =>
        monster.m_id === 635);
    assert.ok(doppelganger);
    assert.equal(doppelganger.cham, 270);
    assert.equal(doppelganger.mspec_used, 3);
});

test('seed0373 composes Barbarian, Sokoban, Fire, Air, and insight', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0373-barbarian-quest-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves,
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 0; index < session.steps.length; index++) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(result.getRngSlices()[99].length, 2358);
    assert.equal(result.getRngSlices()[100].length, 54);
    assert.equal(result.getRngSlices()[110].length, 2907);
    assert.equal(game._activeSpecialLevel?.file, 'air.lua');
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.noteleport, true);
    assert.equal(game.level.flags.hardfloor, true);
    assert.equal(game.level.flags.hero_memory, false);
    assert.deepEqual([game.u.ux, game.u.uy], [18, 4]);
    assert.equal(game.level.elementalBubbles.length, 66);
    const portal = game.level.traps.find(trap =>
        trap.ttyp === MAGIC_PORTAL);
    assert.ok(portal);
    assert.deepEqual(portal.dst, game.fire_level);
    assert.equal(game.level.monsters.length, 52);
    const wizard = game.level.monsters.find(monster =>
        monster.mnum === 285 && monster.iswiz);
    assert.ok(wizard);
    assert.equal(wizard.mpeaceful, 0);
    assert.ok(game.level.monsters.some(monster => monster.pet));
    assert.equal(game.u.uevent.amulet_wish, 1);
    assert.equal(game.level.regions?.length || 0, 0);
});

test('seed5002 Ctrl-G creates a named monster through the zero-time wizard command', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed5002-wizard-coverage-pair.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 86),
    });

    for (let step = 75; step <= 85; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.deepEqual(
        result.getRngSlices()[85],
        session.steps[85].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
});

test('seed5002 silent search retains fatal HP through its death pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed5002-wizard-coverage-pair.session.json', import.meta.url),
        'utf8',
    ));
    const storage = new Map();
    await runSegment({ ...session.segments[0], storage });

    const segment = session.segments[1];
    const lastStep = 210;
    const result = await runSegment({
        ...segment,
        moves: segment.moves.slice(0, lastStep),
        storage,
    });
    for (const step of [209, 210]) {
        assertRngSliceExact(
            result.getRngSlices()[step],
            segment.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed5002 silent fatal input ${step} RNG`,
        );
        assertScreenExact(
            result.getScreens()[step], segment.steps[step].screen,
            `seed5002 silent fatal input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], segment.steps[step].cursor,
            `seed5002 silent fatal input ${step} cursor`,
        );
    }
    assert.equal(game.u.uhp, 0);
    assert.equal(game._silentPrefixRetainedTopline, true);
    assert.equal(game._statusHpOverride, 1);
});

test('seed5002 ordinary movement commits fatal HP before the mimic pager', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed5002-wizard-coverage-pair.session.json', import.meta.url),
        'utf8',
    ));
    const storage = new Map();
    await runSegment({ ...session.segments[0], storage });

    const segment = session.segments[1];
    const lastStep = 285;
    const result = await runSegment({
        ...segment,
        moves: segment.moves.slice(0, lastStep),
        storage,
    });
    for (const step of [283, 284, 285]) {
        assertRngSliceExact(
            result.getRngSlices()[step],
            segment.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed5002 ordinary fatal input ${step} RNG`,
        );
        assertScreenExact(
            result.getScreens()[step], segment.steps[step].screen,
            `seed5002 ordinary fatal input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], segment.steps[step].cursor,
            `seed5002 ordinary fatal input ${step} cursor`,
        );
    }
    assert.equal(game.u.uhp, 0);
    assert.equal(game._silentPrefixRetainedTopline, false);
});

test('engulfer hit punctuation uses optical canseemon visibility', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0383-wizard-hallucinate.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: session.seed,
            datetime: session.datetime,
            nethackrc: session.nethackrc,
            moves: session.moves.slice(0, 176),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const step of [169, 171, 175]) {
        assertScreenExact(
            result.getScreens()[step],
            session.steps[step].screen,
            `seed0383 input ${step} screen`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `seed0383 input ${step} cursor`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0383 input ${step} RNG`,
        );
    }
});

test('seed0001 wizintrinsic repaints hallucinated map before cosmic pager',
    async () => {
        const result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  n#wizgenesis\nblack unicorn\n'
                + '#wizwish\ngold\n'.repeat(16)
                + '#wizintrinsic\nh\n',
            storage: new Map(),
        });

        assertRngSliceExact(result.getRngSlices()[269], [],
            'seed0001 Hallucination activation RNG');
        assert.equal(decodedTopline(result.getScreens()[269]),
            'Oh wow!  Everything looks so cosmic!--More--');
        assert.deepEqual(result.getCursors()[269], [44, 0, 1]);
        const screen = decodeScreen(result.getScreens()[269]);
        assert.deepEqual(
            [screen[7][53].ch, screen[7][53].color, screen[7][53].decgfx],
            [')', 6, 0],
        );
        assert.deepEqual(
            [screen[8][51].ch, screen[8][51].color, screen[8][51].decgfx],
            ['c', 11, 0],
        );
        assert.deepEqual(
            [screen[9][53].ch, screen[9][53].color, screen[9][53].decgfx],
            ['A', 5, 0],
        );
        assert.equal(game.u.hallucinationTurns, 30);
        assert.equal(game.u.hallucinating, true);
        assert.equal(game.context.move, 0);
    });

test('seed0001 hallucinated rock wish remains appearance-unknown', async () => {
    const result = await runSegment({
        seed: 1,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  n#wizgenesis\nblack unicorn\n'
            + '#wizwish\ngold\n'.repeat(16)
            + '#wizintrinsic\nh\n #wizwish\nrock\n',
        storage: new Map(),
    });

    assertRngSliceExact(result.getRngSlices()[284], [
        'rn2(101)=81', 'rnd(2)=1', 'rn2(6)=1', 'rn2(100)=91',
    ], 'seed0001 Hallucinated rock-wish RNG');
    assert.equal(decodedTopline(result.getScreens()[284]), 'g - a stone.');
    assert.deepEqual(result.getCursors()[284], [52, 9, 1]);
    const rock = game.inventory.find(object =>
        object.otyp === ROCK && object.invlet === 'g');
    assert.ok(rock);
    assert.equal(rock.dknown, false);
    assert.equal(rock.quantity ?? rock.quan, 1);
    assert.equal(game._goldCount, 16);
    assert.equal(game.context.move, 0);
});

test('wizard levelchange streams pluslvl and adjabil messages in source order', async () => {
    const witnesses = [
        ['seed0361-archeologist-tour.session.json', 39],
        ['seed0367-priest-quest-tour.session.json', 39],
        ['seed0383-wizard-hallucinate.session.json', 39],
    ];
    for (const [file, end] of witnesses) {
        const session = JSON.parse(fs.readFileSync(
            new URL(`../sessions/${file}`, import.meta.url), 'utf8',
        )).segments[0];
        const result = await runSegment({
            ...session, moves: session.moves.slice(0, end),
        });
        for (let step = 20; step < end; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(session.steps[step].screen),
                `${file} screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step], session.steps[step].cursor,
                `${file} cursor ${step}`,
            );
            assert.deepEqual(
                result.getRngSlices()[step],
                session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
                `${file} RNG ${step}`,
            );
        }
    }
});

test('eating garlic scares nearby smelling actors before the elapsed-turn scan', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 62),
    });

    assert.deepEqual(
        decodeScreen(result.getScreens()[61]),
        decodeScreen(session.steps[61].screen),
    );
    assert.deepEqual(result.getCursors()[61], session.steps[61].cursor);
    assert.deepEqual(
        result.getRngSlices()[61],
        session.steps[61].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    const kitten = game.level.monsters.find(monster => monster.pet);
    const kobold = game.level.monsters.find(monster => monster.mnum === 59);
    assert.equal(kitten.mflee, 1);
    assert.equal(kitten.mfleetim, 0);
    assert.equal(kobold.mflee, 1);
    assert.equal(kobold.mfleetim, 0);
});

test('role spellcasting metadata drives the Priest clairvoyance failure rate', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 67),
    });

    for (const step of [64, 65, 66]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
        assert.deepEqual(result.getRngSlices()[step], []);
    }
    assert.deepEqual(game.urole.spellcasting, {
        base: 3, healing: -2, shield: 2, armor: 10,
        stat: 'wisdom', special: 'remove curse', specialBonus: -4,
    });
});

test('save confirmation retains invalid bytes until a yn/default answer', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 70),
    });

    for (const step of [67, 68, 69]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
        assert.deepEqual(result.getRngSlices()[step], []);
    }
});

test('wield getobj pages missing letters and retains its retry prompt', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 79),
    });

    for (let step = 71; step <= 75; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
        assert.deepEqual(result.getRngSlices()[step], []);
    }
    assert.equal(game.uwep?.invlet, 'd');
    assert.deepEqual(
        decodeScreen(result.getScreens()[76]),
        decodeScreen(session.steps[76].screen),
    );
    assert.deepEqual(result.getCursors()[76], session.steps[76].cursor);
    assert.deepEqual(
        result.getRngSlices()[76],
        session.steps[76].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    for (const step of [77, 78]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
        );
    }
});

test('colored dragon-mail wishes use generic lookup RNG before final remap', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 114),
    });
    const step = 113;

    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    const mail = game.inventory.find(object => object.invlet === 'i');
    assert.equal(mail?.otyp, 108);
    assert.equal(mail?.spe, 5);
    assert.equal(mail?.blessed, true);
    assert.equal(mail?.bknown, true);
    assert.equal(mail?.owt, 40);
});

test('monster scan skips a defender killed earlier in its safe snapshot', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 140),
    });
    const step = 139;

    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    assert.equal(game.level.monsters.some(monster => monster.mnum === 59), false);
    const kitten = game.level.monsters.find(monster => monster.pet);
    assert.deepEqual([kitten?.mx, kitten?.my], [29, 17]);
});

test('dragon-mail dressing advances negative multi and applies on-effects', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 142),
    });
    const step = 141;

    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    assert.equal(game._delayedAction, null);
    assert.equal(game.uarm?.invlet, 'i');
    assert.equal(game.uarm?.known, true);
    assert.equal(game.u.fast, true);
    assert.equal(game.u.fastFromArmor, true);
    assert.equal(game.u.uac, -5);
});

test('Cleric accessory on-message uses the shared BUC-aware prinv projection', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 144),
    });
    const step = 143;

    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    assert.equal(game.uamul?.invlet, 'j');
    assert.equal(game.uamul?.blessed, true);
    assert.equal(game.uamul?.bknown, true);
    assert.equal(game.uamul?.buc, 'blessed');
});

test('quest level menu and prototype resolve through the selected role filecode', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 149),
    });

    assert.deepEqual(
        decodeScreen(result.getScreens()[147]),
        decodeScreen(session.steps[147].screen),
    );
    assert.deepEqual(result.getCursors()[147], session.steps[147].cursor);
    assert.deepEqual(result.getRngSlices()[147], []);
    assert.equal(game._activeSpecialLevel?.prototype, 'Pri-strt');
    assert.equal(game._activeSpecialLevel?.file, 'Pri-strt.lua');
});

test('Pri-strt static map and tree replacement preserve the Lua RNG prefix', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 149),
    });
    const expected = session.steps[148].rng
        .map(call => call.replace(/\s+@.*$/, ''));

    assert.deepEqual(result.getRngSlices()[148].slice(0, 444), expected.slice(0, 444));
    assert.equal(game._activeSpecialLevel?.prototype, 'Pri-strt');
    assert.equal(game.level.flags.noteleport, true);
    assert.equal(game.level.flags.hardfloor, true);
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.deepEqual(game._activeSpecialLevel?.branchRegion, { x: 73, y: 15 });
    assert.equal(game._activeSpecialLevel?.priestSpaceSelection?.initialCount, 966);
    assert.equal(game._activeSpecialLevel?.priestSpaceSelection?.points.length, 952);
});

test('Pri-strt operation graph and first quest pager match the source replay', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 150),
    });

    for (const step of [148, 149]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
            `screen ${step}`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `cursor ${step}`,
        );
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `RNG ${step}`,
        );
    }
    assert.equal(game.level.monsters.length, 21);
    assert.equal(game.level.traps.length, 7);
});

test('clean Priest leader chat assigns the quest through live state', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    // Mirror frozen/ps_test_runner.mjs: recorded answer steps are not part of
    // the input given to the contestant engine.
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 198),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 188; step <= 198; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
            `screen ${step}`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `cursor ${step}`,
        );
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `RNG ${step}`,
        );
    }
    assert.equal(game.u.ualign.record, 20);
    assert.equal(game.quest_status.met_leader, true);
    assert.equal(game.quest_status.got_quest, true);
    const leader = game.level.monsters.find(monster =>
        monster.m_id === game.quest_status.leader_m_id);
    assert.equal(leader?.mnum, game.urole.ldrnum);
    assert.equal(leader?.questLeader, true);
});

test('clean Pri-loca construction, arrival, and locate pager close one live block', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    // Keep this witness shaped like the official runner: no recorded answer
    // steps and no exact-session fixture dispatch.
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 206),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 203; step <= 205; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
            `screen ${step}`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `cursor ${step}`,
        );
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `RNG ${step}`,
        );
    }

    assert.equal(result.getRngSlices()[203].length, 11734);
    assert.deepEqual(
        game.level.rooms.slice(0, 4).map(room => room.doorct),
        [2, 1, 1, 2],
    );
    const context = game._activeSpecialLevel.context;
    assert.equal(game.level.at(context.xstart, context.ystart).lit, false);
    assert.equal(game.level.at(game.u.ux, game.u.uy).lit, true);
    assert.equal(game.quest_status.first_locate, true);
});

test('clean Pri-goal construction, population, and goal pager close one live block', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    // Keep this witness shaped like the official runner: no recorded answer
    // steps and no exact-session fixture dispatch.
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 212),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 209; step <= 211; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
            `screen ${step}`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `cursor ${step}`,
        );
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `RNG ${step}`,
        );
    }

    assert.equal(result.getRngSlices()[209].length, 2276);
    assert.equal(game.u.uz.dnum, 3);
    assert.equal(game.u.uz.dlevel, 6);
    assert.equal(game._activeSpecialLevel.prototype, 'Pri-goal');
    assert.equal(game._activeSpecialLevel.file, 'Pri-goal.lua');
    assert.deepEqual(
        game._activeSpecialLevel.context,
        { xstart: 27, ystart: 5, width: 26, height: 11 },
    );
    assert.equal(game.quest_status.made_goal, 1);
    assert.equal(game.level.monsters.length, 28);
    assert.equal(game.level.traps.length, 6);

    const floorObjects = [];
    for (const column of game.level.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || []) floorObjects.push(object);
        }
    }
    const mitre = floorObjects.find(object =>
        object.oextra?.oname === 'The Mitre of Holiness');
    assert.equal(mitre?.otyp, 96);
    assert.equal(mitre?.blessed, true);
    assert.equal(mitre?.spe, 0);
    assert.equal(mitre?.artifact, true);
});

test('same-level Wizard menu teleport is a silent zero-RNG redraw', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 217),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let step = 212; step <= 216; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
            `screen ${step}`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `cursor ${step}`,
        );
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `RNG ${step}`,
        );
    }

    assert.equal(result.getRngSlices()[216].length, 0);
    assert.equal(game._activeSpecialLevel.prototype, 'Pri-goal');
    assert.equal(game.u.ux, 54);
    assert.equal(game.u.uy, 14);
});

test('clean Minetown-2 construction closes the room, corridor, shop, and arrival graph', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    // Match frozen/ps_test_runner.mjs: the contestant receives no recorded
    // answer steps and fixture dispatch is disabled explicitly.
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 222),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    const step = 221;
    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    assert.equal(result.getRngSlices()[step].length, 1450);
    assert.equal(game._activeSpecialLevel.prototype, 'minetn');
    assert.equal(game._activeSpecialLevel.file, 'minetn-2.lua');
    assert.equal(game._activeSpecialLevel.variant, 2);
    assert.deepEqual(
        game._activeSpecialLevel.context,
        { xstart: 26, ystart: 4, width: 31, height: 15 },
    );
    assert.equal(game.level.flags.has_town, true);
    assert.equal(game.level.flags.has_shop, true);
    assert.equal(game.level.flags.has_temple, true);
    assert.equal(game.level.nroom, 5);
    assert.equal(game.level.nsubroom, 13);
    assert.equal(game.level.monsters.length, 18);
    assert.deepEqual([game.u.ux, game.u.uy], [26, 7]);
});

test('extrinsic Fast banks a live movement ration across Wizard level travel', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 225),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    // Armor completion, position teleport, post-chat allocation, Minetown
    // arrival, the banked move, and its eventual actor/global turn are one
    // continuous C movement ledger rather than independent command fixtures.
    for (const step of [141, 143, 185, 186, 187, 198, 221, 222, 223, 224]) {
        assertScreenExact(
            result.getScreens()[step],
            session.steps[step].screen,
            `screen ${step}`,
        );
        assert.deepEqual(
            result.getCursors()[step], session.steps[step].cursor,
            `cursor ${step}`,
        );
        assertRngSliceExact(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `RNG ${step}`,
        );
    }
    assert.equal(result.getRngSlices()[222].length, 0);
    assert.equal(result.getRngSlices()[224].length, 25);
    assert.equal(game.u.fastFromArmor, true);
    assert.equal(game.u.veryFastFromArmor, true);
    assert.equal(game.u.veryFast, true);
    assert.equal(game.u.umovement, 12);
    assert.equal(game.moves, 16);
});

test('Priest inventory keeps BUC knowledge while implicit uncursed hides the neutral adjective', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 313),
    };
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertScreenExact(
        result.getScreens()[312],
        session.steps[312].screen,
        'seed0367 input 312 inventory screen',
    );
    assert.deepEqual(
        result.getCursors()[312],
        session.steps[312].cursor,
        'seed0367 input 312 cursor',
    );
    assertRngSliceExact(
        result.getRngSlices()[312],
        [],
        'seed0367 input 312 RNG',
    );
    const robe = game.inventory.find(item => item.invlet === 'b');
    const shield = game.inventory.find(item => item.invlet === 'c');
    assert.equal(robe?.bknown, true);
    assert.equal(shield?.bknown, true);
    assert.equal(robe?.blessed || robe?.cursed, false);
    assert.equal(shield?.blessed || shield?.cursed, false);
});

test('clean Minend-1 construction carries an adjacent stalking watchman', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 230),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    const step = 229;
    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    assert.equal(result.getRngSlices()[step].length, 954);
    assert.equal(game._activeSpecialLevel.prototype, 'minend');
    assert.equal(game._activeSpecialLevel.file, 'minend-1.lua');
    assert.equal(game._activeSpecialLevel.variant, 1);
    assert.deepEqual(
        game._activeSpecialLevel.context,
        { xstart: 3, ystart: 3, width: 75, height: 18 },
    );
    assert.equal(game.level.traps.length, 6);
    assert.equal(game.level.monsters.length, 27);
    const arrivedWatchmen = game.level.monsters.filter(monster =>
        monster.mnum === 282);
    assert.deepEqual(
        arrivedWatchmen.map(monster => [monster.mx, monster.my, monster.mpeaceful]),
        [[44, 5, 1]],
    );
    const cachedMinetown = game._levelCache.get('2:4')?.level;
    assert.equal(cachedMinetown?.monsters.some(monster =>
        monster.mnum === 282 && monster.mx === 27 && monster.my === 8), false);
});

test('clean Minend first actor turn follows the magic-item acquisition graph', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0367-priest-quest-tour.session.json', import.meta.url),
        'utf8',
    )).segments[0];
    const input = {
        seed: session.seed,
        datetime: session.datetime,
        nethackrc: session.nethackrc,
        moves: session.moves.slice(0, 232),
    };
    assert.equal('steps' in input, false);
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment(input);
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    const step = 231;
    assert.deepEqual(
        decodeScreen(result.getScreens()[step]),
        decodeScreen(session.steps[step].screen),
    );
    assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    assert.deepEqual(
        result.getRngSlices()[step],
        session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
    );
    assert.equal(result.getRngSlices()[step].length, 85);

    const wizard = game.level.monsters.find(monster =>
        monster.mnum === 167 && monster.mx === 49 && monster.my === 5);
    assert.ok(wizard);
    assert.equal((wizard.minvent || []).some(object => object.otyp === 413), true);
    assert.equal(
        (game.level.objects?.[49]?.[5] || [])
            .some(object => object.otyp === 413),
        false,
    );
});

test('debug-leveled roles enter the live actor and intrinsic scheduler', async () => {
    const witnesses = [
        ['seed0361-archeologist-tour.session.json', 42, 41],
        ['seed0367-priest-quest-tour.session.json', 51, 50],
    ];
    for (const [file, end, step] of witnesses) {
        const session = JSON.parse(fs.readFileSync(
            new URL(`../sessions/${file}`, import.meta.url), 'utf8',
        )).segments[0];
        const result = await runSegment({
            ...session, moves: session.moves.slice(0, end),
        });
        assert.deepEqual(
            result.getRngSlices()[step],
            session.steps[step].rng.map(call => call.replace(/\s+@.*$/, '')),
            `${file} RNG ${step}`,
        );
    }
});

test('inventory modals retain cancel and invalid-selection ownership', async () => {
    const witnesses = [
        ['seed0361-archeologist-tour.session.json', 45, [43, 44]],
        ['seed0367-priest-quest-tour.session.json', 55, [51, 52, 53, 54]],
    ];
    for (const [file, end, steps] of witnesses) {
        const session = JSON.parse(fs.readFileSync(
            new URL(`../sessions/${file}`, import.meta.url), 'utf8',
        )).segments[0];
        const result = await runSegment({
            ...session, moves: session.moves.slice(0, end),
        });
        for (const step of steps) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(session.steps[step].screen),
                `${file} screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step], session.steps[step].cursor,
                `${file} cursor ${step}`,
            );
        }
    }
});

test('seed0002 untraversed branch stairs retain ordinary stair color', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 449),
    });
    // The level-one entrance is pre-traversed at creation; the level-two
    // cross-dungeon stair is still unknown until the hero uses it.
    for (const step of [12, 325, 375, 448]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
});

test('seed0002 overview menu preserves map cells west of its overlay', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 503),
    });
    for (let step = 501; step <= 502; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
});

test('seed0002 nested item actions defer status redraw until dismissal', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 533),
    });
    for (let step = 530; step <= 532; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
});

test('seed0002 sleep beam persists across both pagers and clears afterward', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 564),
    });
    for (const step of [538, 552, 563]) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
});

test('seed0002 attributes project live deafness and encumbrance rows', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 592),
    });
    for (let step = 589; step <= 591; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    assert.ok(result.getScreens()[590].includes('You are deaf.'));
    assert.ok(result.getScreens()[590]
        .includes('You are burdened; movement is slightly slowed.'));
});

test('seed0002 spell menu recomputes failure from live armor and shield', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 587),
    });
    for (let step = 585; step <= 586; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    const spellRows = decodeScreen(result.getScreens()[585])
        .map(row => row.map(cell => cell.ch).join(''));
    assert.ok(spellRows[3].includes('healing       97%  91%-100%'));
    assert.ok(spellRows[4].includes('healing      100%  91%-100%'));
});

test('seed0002 discoveries merge encounter order, calls, shuffle, and prices', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0002-healer-reflection-drummer.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 589),
    });
    for (let step = 587; step <= 588; step++) {
        assert.deepEqual(
            decodeScreen(result.getScreens()[step]),
            decodeScreen(session.steps[step].screen),
        );
        assert.deepEqual(result.getCursors()[step], session.steps[step].cursor);
    }
    const rows = decodeScreen(result.getScreens()[587])
        .map(row => row.map(cell => cell.ch).join('').trimEnd());
    assert.deepEqual(rows.slice(2, 10), [
        'Weapons',
        '  crude dagger',
        '  throwing spear',
        'Armor',
        '  pair of leather gloves (fencing gloves)',
        '  shield of reflection (polished silver shield) {buy 50}',
        '  plumed helmet {buy 8}',
        '  conical hat {buy 1}',
    ]);
});

test('Caveman starting flint has one typed discovery owner', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed1150-caveman-explore-move.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 43),
    });
    assert.deepEqual(
        decodeScreen(result.getScreens()[43]),
        decodeScreen(session.steps[43].screen),
    );
    assert.deepEqual(result.getCursors()[43], session.steps[43].cursor);
    const rows = decodeScreen(result.getScreens()[43])
        .map(row => row.map(cell => cell.ch).join('').trimEnd());
    assert.equal(rows.filter(row => row.includes('flint')).length, 1);
    assert.equal(rows[5], '  flint stone (gray)');
});

test('ordinary map glyphs do not enter discoveries without examination', async () => {
    const witnesses = [
        ['../sessions/seed0102-ranger-name-cancel.session.json', 17],
        ['../sessions/seed0116-wizard-wear-shop.session.json', 119],
    ];

    for (const [path, discoveryStep] of witnesses) {
        const session = JSON.parse(fs.readFileSync(
            new URL(path, import.meta.url), 'utf8',
        )).segments[0];
        const result = await runSegment(session);

        assert.deepEqual(
            decodeScreen(result.getScreens()[discoveryStep]),
            decodeScreen(session.steps[discoveryStep].screen),
        );
        assert.deepEqual(
            result.getCursors()[discoveryStep],
            session.steps[discoveryStep].cursor,
        );
    }
});

test('seed0004 repeat travel crosses guessed terrain with live object timers', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 307),
    });
    const expectedLines = new Map([
        [305, "Where do you want to travel to?  (For instructions type a '?')"],
        [306, 'staircase down'],
        [307, 'staircase down'],
    ]);
    for (const [index, line] of expectedLines) {
        assert.equal(result.getScreens()[index].split('\n')[0], line);
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    assert.deepEqual([game.u.ux, game.u.uy], [42, 7]);
    assert.deepEqual([game.startingPet.mx, game.startingPet.my], [50, 7]);
    assert.equal(game._runState, null);
    assert.equal(game.level.objects[40][5]
        .some(object => object.corpsenm === 20), false);
    assert.equal(game.level.objects[46][3]
        .some(object => object.otyp === 438), true);
});

test('seed0004 semicolon far-look reuses the travel cursor without time', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 312),
    });
    const expectedLines = new Map([
        [308, 'Pick a monster, object or location.'],
        [309, 'floor of a room'],
        [310, 'dart trap'],
        [311, 'wall'],
        [312, '\x0ex\x0f\x1b[8Cthe interior of a monster or a wall (wall)'],
    ]);
    for (const [index, line] of expectedLines) {
        assert.equal(result.getScreens()[index].split('\n')[0], line);
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    assert.deepEqual([game.u.ux, game.u.uy], [42, 7]);
    assert.equal(game.context.move, 0);
});

test('seed0004 unseen jackal follows the recent hero track', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 318),
    });
    for (let index = 313; index <= 318; index++) {
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }

    const jackals = game.level.monsters.filter(monster => monster.mnum === 12);
    assert.deepEqual(jackals.map(monster => [monster.mx, monster.my]), [
        [36, 13], [45, 5],
    ]);
    assert.equal(result.getRngLog().length, 11557);
});

test('seed0004 visible pony gets the outer Conflict resistance check', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 319),
    });
    const expected = session.steps[319].rng.map(call =>
        call.replace(/\s+@.*$/, ''));
    assert.deepEqual(result.getRngSlices()[319], expected);
    assert.deepEqual([game.startingPet.mx, game.startingPet.my], [50, 8]);
});

test('seed0004 pony screens wallet gold before lettered inventory', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 321),
    });
    for (let index = 320; index <= 321; index++) {
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }
    assert.equal(game._goldCount, 9);
});

test('seed0004 conflicted pony attack pauses and resumes at tty More', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 328),
    });
    for (let index = 327; index <= 328; index++) {
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }
    assert.equal(game.u.uhp, 14);
    assert.deepEqual([game.startingPet.mx, game.startingPet.my], [50, 9]);
});

test('seed0004 inventory apply and thrown carrot feed the pony live', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 338),
    });
    for (const index of [330, 331, 333, 334, 335, 336, 337, 338]) {
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }
    assert.equal(game.inventory.find(item => item.invlet === 'h').quantity, 10);
    assert.deepEqual([game.startingPet.mx, game.startingPet.my], [51, 8]);
    assert.equal(game.level.objects[51][8].some(item => item.otyp === 282), false);
});

test('seed0004 chat and repeated carrot feeding preserve every input boundary', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({
        ...session, moves: session.moves.slice(0, 365),
    });
    for (let index = 339; index <= 365; index++) {
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }
    assert.equal(game.inventory.find(item => item.invlet === 'h').quantity, 7);
    assert.equal(game.startingPet.meating, 1);
});

test('seed0004 blank eat cancellation keeps the final command sweep aligned', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0004-feeding-pony.session.json', import.meta.url),
        'utf8',
    )).segments[0];

    const result = await runSegment({ ...session });
    for (let index = 366; index < session.steps.length; index++) {
        assert.equal(
            result.getScreens()[index].split('\n')[0],
            session.steps[index].screen.split('\n')[0],
        );
        assert.deepEqual(result.getCursors()[index], session.steps[index].cursor);
        const expected = session.steps[index].rng.map(call =>
            call.replace(/\s+@.*$/, ''));
        assert.deepEqual(result.getRngSlices()[index], expected);
    }
    assert.deepEqual(
        decodeScreen(result.getScreens()[403]),
        decodeScreen(session.steps[403].screen),
    );
});

test('seed4500 Kni-goal, attributes, and final floor look stay exact', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed4500-knight-coverage.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({ ...session });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (let index = 1754; index < session.steps.length; index++) {
        assert.deepEqual(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `RNG mismatch at input ${index}`,
        );
        assert.deepEqual(
            decodeScreen(result.getScreens()[index]),
            decodeScreen(session.steps[index].screen),
            `screen mismatch at input ${index}`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `cursor mismatch at input ${index}`,
        );
    }

    assert.equal(game._activeSpecialLevel.prototype, 'Kni-goal');
    assert.equal(game._activeSpecialLevel.file, 'Kni-goal.lua');
    assert.deepEqual(
        game._activeSpecialLevel.context,
        { xstart: 3, ystart: 1, width: 76, height: 20 },
    );
    assert.equal(game.quest_status.made_goal, 1);
    assert.equal(game.level.monsters.length, 29);
    assert.equal(game.level.traps.length, 8);

    const floorObjects = [];
    for (const column of game.level.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || []) floorObjects.push(object);
        }
    }
    const mirror = floorObjects.find(object =>
        object.oextra?.oname === 'The Magic Mirror of Merlin');
    assert.equal(mirror?.otyp, 230);
    assert.equal(mirror?.blessed, true);
    assert.equal(mirror?.spe, 0);
    assert.equal(mirror?.artifact, true);
});

test('seed0360 Castle generation preserves bounded source order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 160),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const index of [136, 137, 139, 140, 158, 159, 160]) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0360 input ${index} RNG`,
        );
        assertScreenExact(
            result.getScreens()[index],
            session.steps[index].screen,
            `seed0360 input ${index} screen`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `seed0360 input ${index} cursor`,
        );
    }
    assert.equal(result.getRngSlices()[159].length, 14103);
    assert.equal(result.getRngSlices()[160].length, 114);
    assert.deepEqual(result.getCursors()[159], [3, 6, 1]);
    assert.equal(game._activeSpecialLevel.prototype, 'castle');
    assert.equal(game._activeSpecialLevel.file, 'castle.lua');
    assert.equal(game.level.flags.has_court, true);
    assert.equal(game.level.flags.has_barracks, true);
    assert.equal(
        game.level.monsters.some(monster =>
            monster.mnum === 63
            && Math.max(
                Math.abs(monster.mx - game.u.ux),
                Math.abs(monster.my - game.u.uy),
            ) <= 1
            && monster.msleeping),
        true,
    );
});

test('seed0360 Valley generation preserves bounded source order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 164),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const index of [159, 160, 164]) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            `seed0360 input ${index} RNG`,
        );
        assertScreenExact(
            result.getScreens()[index],
            session.steps[index].screen,
            `seed0360 input ${index} screen`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `seed0360 input ${index} cursor`,
        );
    }
    assert.equal(result.getRngSlices()[164].length, 14741);
    assert.equal(game._activeSpecialLevel.prototype, 'valley');
    assert.equal(game._activeSpecialLevel.file, 'valley.lua');
    assert.equal(game.level.flags.has_morgue, true);
    assert.equal(
        game.level.monsters.some(monster => monster.cham === 301),
        true,
    );
});

test('seed0360 Minetown variant 5 preserves bounded source order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 180),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[180],
        session.steps[180].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 180 RNG',
    );
    assertScreenExact(
        result.getScreens()[180],
        session.steps[180].screen,
        'seed0360 input 180 screen',
    );
    assert.deepEqual(
        result.getCursors()[180],
        session.steps[180].cursor,
        'seed0360 input 180 cursor',
    );
    assert.equal(result.getRngSlices()[180].length, 1334);
    assert.equal(game._activeSpecialLevel.prototype, 'minetn');
    assert.equal(game._activeSpecialLevel.variant, 5);
    assert.equal(game._activeSpecialLevel.file, 'minetn-5.lua');
    assert.equal(game.level.flags.has_town, true);
    assert.equal(game.level.flags.has_shop, true);
    assert.equal(game.level.flags.has_temple, true);
    // The final vertical flip maps the diagonally grown lit selection corner
    // at Lua (58,1) to the lower-left wall shown on tty row 20.
    assert.equal(game.level.at(61, 19).lit, true);
});

test('seed0360 Minend variant 2 preserves bounded source order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 205),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const index of [192, 205]) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0360 input ${index} RNG`,
        );
        assertScreenExact(
            result.getScreens()[index],
            session.steps[index].screen,
            `seed0360 input ${index} screen`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `seed0360 input ${index} cursor`,
        );
    }
    assert.equal(result.getRngSlices()[192].length, 1216);
    assert.equal(result.getRngSlices()[205].length, 22);
    assert.equal(game._activeSpecialLevel.prototype, 'minend');
    assert.equal(game._activeSpecialLevel.variant, 2);
    assert.equal(game._activeSpecialLevel.file, 'minend-2.lua');
    assert.equal(game.level.flags.is_maze_lev, true);
    // The horizontally and vertically flipped lit-selection perimeter is
    // visible as the upper-left DEC wall at tty cell (24,14).
    assert.equal(game.level.at(25, 13).lit, true);
    // Ordinary Lua engravings retain C's default degrade=true behavior, so a
    // monster standing on the flipped inscription can own wipe_engr_at RNG.
    assert.equal(
        game.level.engravings
            .filter(engraving => engraving.x === 62
                && [16, 17].includes(engraving.y))
            .every(engraving => engraving.nowipeout === false),
        true,
    );
});

test('seed0360 Sokoban tight diagonal precedes boulder pushing', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 231),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const index of [228, 231]) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0360 input ${index} RNG`,
        );
        assertScreenExact(
            result.getScreens()[index],
            session.steps[index].screen,
            `seed0360 input ${index} screen`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `seed0360 input ${index} cursor`,
        );
    }
    assert.equal(result.getRngSlices()[228].length, 0);
    assert.equal(result.getRngSlices()[231].length, 0);
    assert.equal(game.level.flags.sokoban_rules, true);
    const { ux, uy } = game.u;
    for (const [x, y] of [[ux, uy - 1], [ux + 1, uy]]) {
        assert.equal(
            game.level.objects?.[x]?.[y]
                ?.some(object => object.otyp === BOULDER),
            true,
        );
    }
});

test('seed0360 Sokoban 3 variant 2 preserves bounded source order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 238),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[238],
        session.steps[238].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 238 RNG',
    );
    assertScreenExact(
        result.getScreens()[238],
        session.steps[238].screen,
        'seed0360 input 238 screen',
    );
    assert.deepEqual(
        result.getCursors()[238],
        session.steps[238].cursor,
        'seed0360 input 238 cursor',
    );
    assert.equal(result.getRngSlices()[238].length, 100);
    assert.equal(game._activeSpecialLevel.prototype, 'soko3');
    assert.equal(game._activeSpecialLevel.variant, 2);
    assert.equal(game._activeSpecialLevel.file, 'soko3-2.lua');
    assert.equal(game.level.flags.sokoban_rules, true);
    assert.equal(game.level.flags.premapped, true);
    assert.equal(game.level.flags.noteleport, true);
});

test('seed0360 Sokoban 4 variant 1 premaps its branch stair', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 249),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[249],
        session.steps[249].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 249 RNG',
    );
    assertScreenExact(
        result.getScreens()[249],
        session.steps[249].screen,
        'seed0360 input 249 screen',
    );
    assert.deepEqual(
        result.getCursors()[249],
        session.steps[249].cursor,
        'seed0360 input 249 cursor',
    );
    assert.equal(result.getRngSlices()[249].length, 126);
    assert.equal(game._activeSpecialLevel.prototype, 'soko4');
    assert.equal(game._activeSpecialLevel.variant, 1);
    assert.equal(game._activeSpecialLevel.file, 'soko4-1.lua');
    assert.equal(game.level.flags.sokoban_rules, true);
    assert.equal(game.level.flags.premapped, true);
    assert.equal(game.level.flags.hardfloor, true);
    const branch = game.level.dnstair;
    assert.ok(branch);
    assert.equal(game.level.at(branch.x, branch.y).ladder, 2);
    assert.equal(game.level.at(branch.x, branch.y).remembered_glyph?.ch, '>');
});

test('seed0360 Tower 1 waiting vampires preserve distress order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 263),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    for (const index of [262, 263]) {
        assertRngSliceExact(
            result.getRngSlices()[index],
            session.steps[index].rng.map(call => call.replace(/\s+@.*$/, '')),
            `seed0360 input ${index} RNG`,
        );
        assertScreenExact(
            result.getScreens()[index],
            session.steps[index].screen,
            `seed0360 input ${index} screen`,
        );
        assert.deepEqual(
            result.getCursors()[index],
            session.steps[index].cursor,
            `seed0360 input ${index} cursor`,
        );
    }
    assert.equal(result.getRngSlices()[262].length, 602);
    assert.equal(result.getRngSlices()[263].length, 13);
    assert.equal(game._activeSpecialLevel.prototype, 'tower1');
    assert.equal(game._activeSpecialLevel.file, 'tower1.lua');
    const brides = game.level.monsters.filter(monster =>
        ['Madame', 'Marquise', 'Countess'].includes(monster.name));
    assert.equal(brides.length, 3);
    for (const bride of brides) {
        assert.equal(bride.cham, 227);
        assert.equal(bride.mstrategy & STRAT_WAITFORU, STRAT_WAITFORU);
    }
});

test('seed0360 Tower 2 preserves Lua object construction order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 268),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[268],
        session.steps[268].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 268 RNG',
    );
    assertScreenExact(
        result.getScreens()[268],
        session.steps[268].screen,
        'seed0360 input 268 screen',
    );
    assert.deepEqual(
        result.getCursors()[268],
        session.steps[268].cursor,
        'seed0360 input 268 cursor',
    );
    assert.equal(result.getRngSlices()[268].length, 221);
    assert.equal(game._activeSpecialLevel.prototype, 'tower2');
    assert.equal(game._activeSpecialLevel.file, 'tower2.lua');
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.noteleport, true);
    assert.equal(game.level.flags.hardfloor, true);
    assert.equal(game.level.flags.solidify, true);
    assert.equal(
        game._activeSpecialLevel.spellbooks[0],
        SPE_POLYMORPH,
    );
    const towerChests = game.level.objects.flat(2)
        .filter(object => object.otyp === CHEST
            && object.contents?.length === 1);
    assert.deepEqual(
        towerChests.map(chest => chest.contents[0].otyp).sort((a, b) => a - b),
        [AMULET_OF_LIFE_SAVING, AMULET_OF_STRANGULATION],
    );
});

test('seed0360 Tower 3 preserves branch and population order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 274),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[274],
        session.steps[274].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 274 RNG',
    );
    assertScreenExact(
        result.getScreens()[274],
        session.steps[274].screen,
        'seed0360 input 274 screen',
    );
    assert.deepEqual(
        result.getCursors()[274],
        session.steps[274].cursor,
        'seed0360 input 274 cursor',
    );
    assert.equal(result.getRngSlices()[274].length, 1781);
    assert.equal(game._activeSpecialLevel.prototype, 'tower3');
    assert.equal(game._activeSpecialLevel.file, 'tower3.lua');
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.noteleport, true);
    assert.equal(game.level.flags.hardfloor, true);
    assert.equal(game.level.flags.solidify, true);
    assert.deepEqual(
        game._activeSpecialLevel.explicitBranchRegion,
        { lx: 19, ly: 10, hx: 19, hy: 10 },
    );
    assert.equal(game.made_branch, true);
});

test('seed0360 Big Room 4 preserves terrain replacement order', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 295),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[295],
        session.steps[295].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 295 RNG',
    );
    assertScreenExact(
        result.getScreens()[295],
        session.steps[295].screen,
        'seed0360 input 295 screen',
    );
    assert.deepEqual(
        result.getCursors()[295],
        session.steps[295].cursor,
        'seed0360 input 295 cursor',
    );
    assert.equal(result.getRngSlices()[295].length, 8314);
    assert.equal(game._activeSpecialLevel.prototype, 'bigrm');
    assert.equal(game._activeSpecialLevel.variant, 4);
    assert.equal(game._activeSpecialLevel.file, 'bigrm-4.lua');
    assert.equal(game._activeSpecialLevel.terrainChoice, 9);
    assert.equal(game.level.flags.nfountains, 4);
    const context = game._activeSpecialLevel.context;
    let lavaWalls = 0;
    for (let x = 0; x < context.width; x++) {
        for (let y = 0; y < context.height; y++) {
            if (game.level.at(context.xstart + x, context.ystart + y).typ
                === LAVAWALL) lavaWalls++;
        }
    }
    assert.equal(lavaWalls, 40);
});

test('seed0360 Rogue level preserves legacy room graph and ghost', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 301),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[301],
        session.steps[301].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 301 RNG',
    );
    assertScreenExact(
        result.getScreens()[301],
        session.steps[301].screen,
        'seed0360 input 301 screen',
    );
    assert.deepEqual(
        result.getCursors()[301],
        session.steps[301].cursor,
        'seed0360 input 301 cursor',
    );
    assert.equal(result.getRngSlices()[301].length, 263);
    assert.equal(game.level.flags.is_rogue_level, true);
    assert.equal(game.level.flags.rogue_level, true);
    assert.equal(game.level.nroom, 7);
    assert.equal(game._activeSpecialLevel, null);

    const ghost = game.level.monsters.find(monster => monster.mnum === 287);
    assert.ok(ghost);
    assert.equal(ghost.name, 'Glenn Wichman');
    assert.equal(ghost.msleeping, 1);
    const ghostPile = game.level.objects[ghost.mx][ghost.my];
    assert.deepEqual(
        ghostPile.map(object => object.otyp),
        [RING_MAIL, ARROW, BOW, MACE, FOOD_RATION],
    );
    assert.deepEqual(
        ghostPile.map(object => object.quan),
        [1, 25, 1, 1, 5],
    );
    assert.deepEqual(
        ghostPile.map(object => [object.spe, !!object.cursed]),
        [[1, true], [0, false], [1, true], [2, true], [0, false]],
    );
    for (const door of game.level.doors) {
        const loc = game.level.at(door.x, door.y);
        assert.equal(loc.doormask, D_NODOOR);
        assert.ok(loc.typ === DOOR || loc.typ === SDOOR);
    }
});

test('seed0360 Asmodeus preserves both maps and stocked exterior maze', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 307),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[307],
        session.steps[307].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 307 RNG',
    );
    assertScreenExact(
        result.getScreens()[307],
        session.steps[307].screen,
        'seed0360 input 307 screen',
    );
    assert.deepEqual(
        result.getCursors()[307],
        session.steps[307].cursor,
        'seed0360 input 307 cursor',
    );
    assert.equal(result.getRngSlices()[307].length, 3362);
    assert.equal(game._activeSpecialLevel.prototype, 'asmodeus');
    assert.equal(game._activeSpecialLevel.file, 'asmodeus.lua');
    assert.deepEqual(game._activeSpecialLevel.fragments, {
        main: { xstart: 15, ystart: 5, width: 21, height: 12 },
        exit: { xstart: 35, ystart: 9, width: 33, height: 5 },
    });
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.temperature, 1);
    assert.equal(game.level.monsters.length, 21);
    assert.equal(game.level.traps.length, 12);

    const asmodeus = game.level.monsters.find(monster =>
        monster.mnum === 309);
    assert.ok(asmodeus);
    assert.deepEqual([asmodeus.mx, asmodeus.my], [27, 12]);
    assert.equal(asmodeus.minvent.some(object =>
        object.otyp === WAN_COLD), true);
    assert.equal(asmodeus.minvent.some(object =>
        object.otyp === WAN_FIRE), true);
    assert.deepEqual([game.u.ux, game.u.uy], [3, 15]);
});

test('seed0360 Juiblex preserves swamp overlays and deferred arrivals', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 313),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[313],
        session.steps[313].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 313 RNG',
    );
    assertScreenExact(
        result.getScreens()[313],
        session.steps[313].screen,
        'seed0360 input 313 screen',
    );
    assert.deepEqual(
        result.getCursors()[313],
        session.steps[313].cursor,
        'seed0360 input 313 cursor',
    );
    assert.equal(result.getRngSlices()[313].length, 2723);
    assert.equal(game._activeSpecialLevel.prototype, 'juiblex');
    assert.equal(game._activeSpecialLevel.file, 'juiblex.lua');
    assert.deepEqual(game._activeSpecialLevel.fragments, {
        down: { xstart: 1, ystart: 15, width: 8, height: 5 },
        up: { xstart: 69, ystart: 3, width: 8, height: 5 },
        lair: { xstart: 15, ystart: 3, width: 51, height: 18 },
    });
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.shortsighted, true);
    assert.equal(game.level.flags.has_swamp, true);
    assert.equal(game.level.flags.temperature, 0);
    assert.equal(game.level.monsters.length, 33);
    assert.equal(game.level.traps.length, 6);

    const juiblex = game.level.monsters.find(monster =>
        monster.mnum === 303);
    assert.ok(juiblex);
    assert.deepEqual([juiblex.mx, juiblex.my], [40, 11]);
    assert.deepEqual([game.u.ux, game.u.uy], [76, 11]);
});

test('seed0360 Baalzebub preserves corrmaze stocking and beetle fixup', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 318),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[318],
        session.steps[318].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 318 RNG',
    );
    assertScreenExact(
        result.getScreens()[318],
        session.steps[318].screen,
        'seed0360 input 318 screen',
    );
    assert.deepEqual(
        result.getCursors()[318],
        session.steps[318].cursor,
        'seed0360 input 318 cursor',
    );
    assert.equal(result.getRngSlices()[318].length, 1806);
    assert.equal(game._activeSpecialLevel.prototype, 'baalz');
    assert.equal(game._activeSpecialLevel.file, 'baalz.lua');
    assert.deepEqual(game._activeSpecialLevel.context, {
        xstart: 29, ystart: 5, width: 49, height: 13,
    });
    assert.deepEqual(game._activeSpecialLevel.baalzFixupArea, {
        x1: 30, y1: 6, x2: 75, y2: 16,
    });
    assert.deepEqual(game._activeSpecialLevel.baalzPoolMarkers, [
        { x: 68, y: 8 }, { x: 68, y: 14 },
    ]);
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.corrmaze, true);
    assert.equal(game.level.flags.temperature, 1);
    assert.equal(game.level.monsters.length, 11);
    assert.equal(game.level.traps.length, 10);

    const baalzebub = game.level.monsters.find(monster =>
        monster.mnum === 308);
    assert.ok(baalzebub);
    assert.deepEqual([baalzebub.mx, baalzebub.my], [64, 11]);
    assert.deepEqual(game.level.upstair, { x: 3, y: 5 });
    assert.deepEqual(game.level.dnstair, { x: 73, y: 11 });
    assert.deepEqual([game.u.ux, game.u.uy], [5, 17]);

    assert.equal(game.level.at(68, 8).typ, BRCORNER);
    assert.equal(game.level.at(68, 14).typ, TRCORNER);
    assert.equal(game.level.at(68, 9).typ, HWALL);
    assert.equal(game.level.at(68, 13).typ, HWALL);
    for (const y of [9, 13]) {
        assert.equal(game.level.at(31, y).typ, IRONBARS);
        assert.equal(game.level.at(31, y).wall_info & W_NONDIGGABLE,
            W_NONDIGGABLE);
        assert.equal(game.level.at(30, y).wall_info & W_NONDIGGABLE, 0);
        assert.equal(game.level.at(29, y).wall_info & W_NONDIGGABLE, 0);
    }
});

test('seed0360 Orcus preserves ghost-town shops and maze precedence', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 324),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[324],
        session.steps[324].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 324 RNG',
    );
    assertScreenExact(
        result.getScreens()[324],
        session.steps[324].screen,
        'seed0360 input 324 screen',
    );
    assert.deepEqual(
        result.getCursors()[324],
        session.steps[324].cursor,
        'seed0360 input 324 cursor',
    );
    assert.equal(result.getRngSlices()[324].length, 6358);
    assert.equal(game._activeSpecialLevel.prototype, 'orcus');
    assert.equal(game._activeSpecialLevel.file, 'orcus.lua');
    assert.deepEqual(game._activeSpecialLevel.context, {
        xstart: 33, ystart: 3, width: 45, height: 17,
    });
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.shortsighted, true);
    assert.equal(game.level.flags.temperature, 1);
    assert.equal(game.level.flags.has_shop, true);
    assert.equal(game.level.flags.has_morgue, true);
    assert.equal(game.level.monsters.length, 68);
    assert.equal(game.level.traps.length, 14);

    const orcus = game.level.monsters.find(monster =>
        monster.mnum === 305);
    assert.ok(orcus);
    assert.deepEqual([orcus.mx, orcus.my], [66, 4]);
    assert.equal(game.level.monsters.some(monster =>
        monster.mnum === 271), false);
    assert.deepEqual(
        game.level.rooms.slice(0, game.level.nroom)
            .map(room => room.rtype),
        [MORGUE, SHOPBASE, SHOPBASE],
    );
    assert.equal(
        game.level.rooms.slice(0, game.level.nroom)
            .every(room => !room.resident),
        true,
    );
    assert.deepEqual(game.level.upstair, { x: 11, y: 19 });
    assert.deepEqual(game.level.dnstair, { x: 66, y: 4 });
    assert.deepEqual([game.u.ux, game.u.uy], [10, 9]);
});

test('seed0360 Wizard1 preserves tower exits and pseudo-trap rejection', async () => {
    const session = JSON.parse(fs.readFileSync(
        new URL('../sessions/seed0360-wizard-world-tour.session.json',
            import.meta.url),
        'utf8',
    )).segments[0];
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            ...session,
            moves: session.moves.slice(0, 330),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assertRngSliceExact(
        result.getRngSlices()[330],
        session.steps[330].rng.map(call => call.replace(/\s+@.*$/, '')),
        'seed0360 input 330 RNG',
    );
    assertScreenExact(
        result.getScreens()[330],
        session.steps[330].screen,
        'seed0360 input 330 screen',
    );
    assert.deepEqual(
        result.getCursors()[330],
        session.steps[330].cursor,
        'seed0360 input 330 cursor',
    );
    assert.equal(result.getRngSlices()[330].length, 2974);
    assert.equal(game._activeSpecialLevel.prototype, 'wizard1');
    assert.equal(game._activeSpecialLevel.file, 'wizard1.lua');
    assert.deepEqual(game._activeSpecialLevel.context, {
        xstart: 25, ystart: 5, width: 29, height: 13,
    });
    assert.equal(game.level.flags.is_maze_lev, true);
    assert.equal(game.level.flags.noteleport, true);
    assert.equal(game.level.flags.hardfloor, true);
    assert.equal(game.level.flags.temperature, 1);
    assert.equal(game.level.flags.has_morgue, true);
    assert.equal(game.level.monsters.length, 30);
    assert.equal(game.level.traps.length, 11);
    assert.equal(game.level.traps.some(trap =>
        trap.ttyp === 24 || trap.ttyp === 25), false);
    assert.equal(new Set(game.level.traps.map(trap =>
        `${trap.tx},${trap.ty}`)).size, game.level.traps.length);

    const wizard = game.level.monsters.find(monster =>
        monster.mnum === 285);
    assert.ok(wizard);
    assert.deepEqual([wizard.mx, wizard.my], [41, 10]);
    assert.equal(wizard.msleeping, 1);
    assert.equal(game.level.objects[41][10].some(object =>
        object.otyp === SPE_BOOK_OF_THE_DEAD), true);

    const ladder = game.stairs;
    const stairways = [];
    for (let stair = ladder; stair; stair = stair.next) stairways.push({
        x: stair.sx, y: stair.sy,
        up: stair.up, isladder: stair.isladder,
    });
    assert.deepEqual(stairways, [
        { x: 22, y: 13, up: true, isladder: false },
        { x: 59, y: 15, up: false, isladder: false },
        { x: 31, y: 10, up: false, isladder: true },
    ]);
    assert.equal(game.level.at(31, 10).typ, LADDER);
    assert.deepEqual(game.level.upstair, { x: 22, y: 13 });
    assert.deepEqual(game.level.dnstair, { x: 59, y: 15 });
    assert.deepEqual([game.u.ux, game.u.uy], [63, 8]);

    assert.deepEqual(
        game.level.rooms.slice(0, game.level.nroom)
            .map(room => [room.rtype, room.needfill,
                !!(room.arrival_room || room.arrivalRoom)]),
        [[MORGUE, 2, false], [0, 0, true]],
    );
    for (const [x, y] of [
        [25, 5], [36, 5], [52, 5],
        [25, 17], [52, 17], [52, 10],
    ]) {
        assert.equal(
            game.level.at(x, y).wall_info & W_NONDIGGABLE,
            W_NONDIGGABLE,
        );
        assert.equal(
            game.level.at(x, y).wall_info & W_NONPASSWALL,
            W_NONPASSWALL,
        );
    }
});

test('seed0360 Wizard1 monster traps preserve sound, sleep, and waiting order',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 337),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (const index of [335, 337]) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(
            decodedTopline(result.getScreens()[335]),
            'You hear an E note squeak in the distance.',
        );
        const sleepGas = game.level.traps.filter(trap =>
            trap.tx === 40 && trap.ty === 10);
        assert.equal(sleepGas.length, 1);
        assert.equal(sleepGas[0].ttyp, SLP_GAS_TRAP);
        const board = game.level.traps.find(trap =>
            trap.tx === 41 && trap.ty === 11);
        assert.equal(board?.ttyp, SQKY_BOARD);
        assert.equal(board?.tnote, 4);

        const hound = game.level.monsters.find(monster =>
            monster.mnum === 26);
        assert.ok(hound);
        assert.deepEqual([hound.mx, hound.my], [40, 10]);
        assert.equal(hound.mcanmove, 0);
        assert.equal(hound.mfrozen, 8);

        const wizard = game.level.monsters.find(monster =>
            monster.mnum === 285);
        assert.ok(wizard);
        assert.deepEqual([wizard.mx, wizard.my], [41, 10]);
        assert.equal(wizard.msleeping, 0);
        assert.equal(
            wizard.mstrategy & STRAT_WAITFORU,
            STRAT_WAITFORU,
        );
        assert.equal(game.level.objects[41][10].some(object =>
            object.otyp === SPE_BOOK_OF_THE_DEAD), true);
    });

test('seed0360 Wizard2 preserves zoo fill and arrival pile continuation',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 353),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 344; index <= 353; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(result.getRngSlices()[344].length, 12242);
        assert.equal(
            decodedTopline(result.getScreens()[344]),
            'You materialize on a different level!--More--',
        );
        assert.equal(
            decodedTopline(result.getScreens()[348]).trimStart(),
            'Things that are here:',
        );
        assert.equal(game._activeSpecialLevel.prototype, 'wizard2');
        assert.equal(game._activeSpecialLevel.file, 'wizard2.lua');
        assert.deepEqual(game._activeSpecialLevel.context, {
            xstart: 25, ystart: 5, width: 29, height: 13,
        });
        assert.equal(game.level.flags.is_maze_lev, true);
        assert.equal(game.level.flags.noteleport, true);
        assert.equal(game.level.flags.hardfloor, true);
        assert.equal(game.level.flags.temperature, 1);
        assert.equal(game.level.flags.has_zoo, true);
        assert.equal(game.level.monsters.length, 69);
        assert.equal(game.level.traps.length, 17);

        assert.deepEqual(
            game.level.rooms.slice(0, game.level.nroom)
                .map(room => [
                    room.rtype, room.needfill, room.doorct,
                    !!(room.arrival_room || room.arrivalRoom),
                ]),
            [[0, 0, 12, true], [ZOO, 1, 2, false]],
        );
        const zooGold = game.level.objects.flat(2).filter(object =>
            object?.otyp === GOLD_PIECE
            && object.ox >= 34 && object.ox <= 42
            && object.oy >= 8 && object.oy <= 14);
        assert.equal(zooGold.length, 54);
        assert.equal(game.level.monsters.some(monster =>
            monster.mnum === 229
            && monster.minvent?.some(object => object.otyp === 40)
            && monster.minvent?.some(object =>
                object.otyp === LONG_SWORD)), true);

        const stairways = [];
        for (let stair = game.stairs; stair; stair = stair.next) {
            stairways.push({
                x: stair.sx, y: stair.sy,
                up: stair.up, isladder: stair.isladder,
            });
        }
        assert.deepEqual(stairways, [
            { x: 76, y: 5, up: true, isladder: false },
            { x: 7, y: 9, up: false, isladder: false },
            { x: 39, y: 6, up: false, isladder: true },
            { x: 37, y: 16, up: true, isladder: true },
        ]);
        assert.deepEqual([game.u.ux, game.u.uy], [61, 9]);
        assert.deepEqual(
            game.level.objects[61][9].map(object => object.otyp),
            [BOULDER, 466],
        );
    });

test('seed0360 empty throw suggestions retain getobj retry ownership',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 361),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 355; index <= 361; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(
            decodedTopline(result.getScreens()[355]),
            'What do you want to throw? [*]',
        );
        assert.equal(
            decodedTopline(result.getScreens()[356]),
            "You don't have that object.--More--",
        );
        assert.equal(
            decodedTopline(result.getScreens()[360]),
            'What do you want to throw? [*]',
        );
        assert.equal(
            decodedTopline(result.getScreens()[361]),
            'Never mind.',
        );
        assert.equal(game.inventory.length, 17);
        assert.equal(game.uwep?.invlet, 'a');
        assert.equal(game.uwep?.otyp, QUARTERSTAFF);
    });

test('seed0360 Wiz-strt construction and first quest pager preserve source order',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 377),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 373; index <= 376; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(result.getRngSlices()[373].length, 1846);
        assert.equal(
            decodedTopline(result.getScreens()[373]),
            'You materialize on a different level!--More--',
        );
        assert.equal(
            decodedTopline(result.getScreens()[375]),
            'The heat and smoke are gone.',
        );
        assert.equal(game._activeSpecialLevel.prototype, 'Wiz-strt');
        assert.equal(game._activeSpecialLevel.file, 'Wiz-strt.lua');
        assert.deepEqual(game._activeSpecialLevel.context, {
            xstart: 3, ystart: 1, width: 76, height: 20,
        });
        assert.equal(game.level.flags.is_maze_lev, true);
        assert.equal(game.level.flags.noteleport, true);
        assert.equal(game.level.flags.hardfloor, true);
        assert.equal(game.level.flags.temperature, 0);
        assert.equal(game.level.monsters.length, 27);
        // Five random traps survive; the sixth target is a cloud rejected by
        // trap.c:maketrap(), and fixup_special() adds the quest portal.
        assert.equal(game.level.traps.length, 6);
        assert.equal(game.level.monsters.some(monster =>
            monster.mnum === 356
            && monster.minvent?.some(object =>
                object.otyp === QUARTERSTAFF && object.spe === 5)), true);
    });

test('seed0360 no-teleport ruby wish blocks visible unicorn relocation',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = session.moves.slice(0, 375)
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nruby\ntrl  ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...session, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 430);
        assertRngSliceExact(result.getRngSlices()[427], [
            'rn2(3)=0',
        ], 'seed0360 restricted ruby gift RNG');
        assert.equal(decodedTopline(result.getScreens()[427]),
            'The black unicorn catches the red gem.--More--');
        assert.deepEqual(result.getCursors()[427], [46, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[428], [],
            'seed0360 restricted ruby policy pager RNG');
        assert.equal(decodedTopline(result.getScreens()[428]),
            'The black unicorn hesitatingly accepts your gift.--More--');
        assert.deepEqual(result.getCursors()[428], [57, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[429], [
            'rn2(12)=4', 'rn2(12)=9', 'rn2(12)=6', 'rn2(12)=8',
            'rn2(12)=2', 'rn2(12)=1', 'rn2(12)=11', 'rn2(12)=10',
            'rn2(12)=1', 'rn2(12)=5', 'rn2(12)=1', 'rn2(12)=3',
            'rn2(12)=0', 'rn2(12)=1', 'rn2(12)=2', 'rn2(12)=9',
            'rn2(12)=3', 'rn2(12)=0', 'rn2(12)=0', 'rn2(12)=10',
            'rn2(12)=8', 'rn2(12)=2', 'rn2(12)=8', 'rn2(12)=10',
            'rn2(12)=1', 'rn2(12)=7', 'rn2(12)=10', 'rn2(12)=5',
            'rn2(70)=55', 'rn2(3)=2', 'rn2(20)=10', 'rn2(79)=7',
        ], 'seed0360 restricted ruby force and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[429]),
            'A mysterious force prevents the black unicorn from teleporting!');
        assert.deepEqual(result.getCursors()[429], [8, 2, 1]);

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const carriedRuby = unicorn?.minvent?.find(object =>
            object.otyp === RUBY);
        assert.ok(unicorn);
        assert.ok(carriedRuby);
        assert.equal(game.level.flags.noteleport, true);
        assert.deepEqual({
            hero: [game.u.ux, game.u.uy],
            unicorn: [unicorn.mx, unicorn.my],
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            avenge: unicorn.mavenge ?? 0,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            luck: game.u.uluck,
            rubyWhere: carriedRuby.where,
        }, {
            hero: [9, 1],
            unicorn: [10, 1],
            peaceful: 1,
            tame: 0,
            avenge: 0,
            hp: 29,
            hpmax: 29,
            luck: -1,
            rubyWhere: 'minvent',
        });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal(game.level.objects.flat(2)
            .some(object => object?.otyp === RUBY), false);
    });

test('seed0360 Big Room ruby wish visibly reappears after random relocation',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const moves = session.moves.slice(0, 295)
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nruby\ntrn  ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({ ...session, moves });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 350);
        assertRngSliceExact(result.getRngSlices()[347], [
            'rn2(3)=2',
        ], 'seed0360 Big Room ruby gift RNG');
        assert.equal(decodedTopline(result.getScreens()[347]),
            'The black unicorn catches the red gem.--More--');
        assert.deepEqual(result.getCursors()[347], [46, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[348], [
            'rnd(79)=74', 'rn2(21)=2',
            'rnd(79)=21', 'rn2(21)=11',
        ], 'seed0360 Big Room visible relocation RNG');
        assert.equal(decodedTopline(result.getScreens()[348]),
            'The black unicorn hesitatingly accepts your gift.--More--');
        assert.deepEqual(result.getCursors()[348], [57, 0, 1]);
        assert.deepEqual(decodeScreen(result.getScreens()[348])[12][20], {
            ch: 'u', color: 8, attr: 0, decgfx: 0,
        });

        assertRngSliceExact(result.getRngSlices()[349], [],
            'seed0360 Big Room reappearance RNG');
        assert.equal(decodedTopline(result.getScreens()[349]),
            'The black unicorn vanishes and reappears farther away.');
        assert.deepEqual(result.getCursors()[349], [30, 16, 1]);

        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103);
        const carriedRuby = unicorn?.minvent?.find(object =>
            object.otyp === RUBY);
        assert.ok(unicorn);
        assert.ok(carriedRuby);
        assert.equal(game._activeSpecialLevel.prototype, 'bigrm');
        assert.equal(game._activeSpecialLevel.file, 'bigrm-4.lua');
        assert.equal(game.level.flags.noteleport, false);
        assert.deepEqual({
            hero: [game.u.ux, game.u.uy],
            unicorn: [unicorn.mx, unicorn.my],
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            avenge: unicorn.mavenge ?? 0,
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            luck: game.u.uluck,
            rubyWhere: carriedRuby.where,
        }, {
            hero: [31, 15],
            unicorn: [21, 11],
            peaceful: 1,
            tame: 0,
            avenge: 0,
            hp: 35,
            hpmax: 35,
            luck: 1,
            rubyWhere: 'minvent',
        });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal(game.level.objects.flat(2)
            .some(object => object?.otyp === RUBY), false);
    });

test('seed0001 sling-launched ruby bypasses unicorn gift and misses',
    async () => {
        const moves = '  n#wizwish\nsling\nwg'
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nruby\nthh';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 1,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 73);
        assert.equal(decodedTopline(result.getScreens()[70]),
            'What do you want to throw? [h or ?*]');
        assert.deepEqual(result.getCursors()[70], [37, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[72], [
            'rnd(20)=4', 'rn2(3)=2', 'rn2(100)=23',
            'rn2(4)=1', 'rn2(3)=0', 'rn2(3)=0', 'rn2(5)=4',
            'rn2(4)=3', 'rn2(5)=3', 'rn2(5)=1', 'rn2(5)=4',
            'rn2(4)=0', 'rn2(5)=0', 'rn2(5)=1',
            'rn2(12)=7', 'rn2(12)=11', 'rn2(12)=8', 'rn2(12)=4',
            'rn2(70)=20', 'rn2(400)=43', 'rn2(200)=163',
            'rn2(20)=2', 'rn2(76)=29',
        ], 'seed0001 slung ruby miss RNG');
        assert.equal(decodedTopline(result.getScreens()[72]),
            'The red gem misses the black unicorn.');
        assert.deepEqual(result.getCursors()[72], [52, 9, 1]);

        const targetX = game.u.ux - 1;
        const targetY = game.u.uy;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === targetX
                && monster.my === targetY);
        const floorRubies = (game.level.objects?.[targetX]?.[targetY] || [])
            .filter(object => object.otyp === RUBY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            x: unicorn.mx,
            y: unicorn.my,
            minventRubies: (unicorn.minvent || [])
                .filter(object => object.otyp === RUBY).length,
        }, {
            hp: 15,
            hpmax: 15,
            peaceful: 1,
            tame: 0,
            x: targetX,
            y: targetY,
            minventRubies: 0,
        });
        assert.equal(game.uwep?.otyp, SLING);
        assert.equal(game.u.uluck ?? 0, 0);
        assert.equal(floorRubies.length, 1);
        assert.equal(floorRubies[0].where, 'floor');
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal(game.context.move, 1);
    });

test('seed0001 sling-launched ruby hit uses gem damage and hard mulch draw',
    async () => {
        const moves = '  n#wizwish\n+3 sling\nwg'
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nruby\nthh';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 1,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 76);
        assert.equal(decodedTopline(result.getScreens()[73]),
            'What do you want to throw? [h or ?*]');
        assertRngSliceExact(result.getRngSlices()[75], [
            'rnd(20)=4', 'rnd(3)=3', 'rn2(19)=12',
            'rn2(3)=2', 'rn2(2)=1',
            'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=3',
            'rn2(4)=3', 'rn2(5)=4', 'rn2(5)=1', 'rn2(5)=0',
            'rn2(4)=3', 'rn2(3)=1', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(5)=0',
            'rn2(4)=3', 'rn2(5)=3', 'rn2(5)=2', 'rn2(5)=4',
            'rn2(12)=0', 'rn2(12)=10', 'rn2(12)=2', 'rn2(12)=0',
            'rn2(70)=63', 'rn2(400)=396', 'rn2(200)=48',
            'rn2(20)=13', 'rn2(76)=34',
        ], 'seed0001 slung ruby hit and mulch RNG');
        assert.equal(decodedTopline(result.getScreens()[75]),
            'The red gem hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[75], [52, 9, 1]);

        const targetX = game.u.ux - 1;
        const targetY = game.u.uy;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === targetX
                && monster.my === targetY);
        const floorRubies = (game.level.objects?.[targetX]?.[targetY] || [])
            .filter(object => object.otyp === RUBY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            minventRubies: (unicorn.minvent || [])
                .filter(object => object.otyp === RUBY).length,
        }, {
            hp: 14,
            hpmax: 15,
            peaceful: 0,
            tame: 0,
            minventRubies: 0,
        });
        assert.equal(game.uwep?.otyp, SLING);
        assert.equal(game.uwep?.spe, 3);
        assert.equal(game.u._weaponPracticeBySkill?.[21], 1);
        assert.equal(floorRubies.length, 0);
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal(game.context.move, 1);
    });

test('seed0030 sling-launched ruby hard-gem survival settles on floor',
    async () => {
        const moves = '  n#wizwish\n+3 sling\nwg'
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nruby\nthh';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 30,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 76);
        assert.equal(decodedTopline(result.getScreens()[73]),
            'What do you want to throw? [h or ?*]');
        assertRngSliceExact(result.getRngSlices()[75], [
            'rnd(20)=1', 'rnd(3)=3', 'rn2(19)=0',
            'rn2(3)=2', 'rn2(2)=0', 'rn2(100)=38',
            'rn2(4)=0', 'rn2(5)=4', 'rn2(5)=3',
            'rn2(4)=0', 'rn2(5)=3', 'rn2(5)=1',
            'rn2(12)=1', 'rn2(12)=0', 'rn2(12)=6',
            'rn2(70)=2', 'rn2(400)=97', 'rn2(200)=151',
            'rn2(20)=0', 'rn2(73)=54',
        ], 'seed0030 slung ruby hard-gem survival RNG');
        assert.equal(decodedTopline(result.getScreens()[75]),
            'The red gem hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[75], [28, 17, 1]);

        const targetX = game.u.ux - 1;
        const targetY = game.u.uy;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === targetX
                && monster.my === targetY);
        const floorRubies = (game.level.objects?.[targetX]?.[targetY] || [])
            .filter(object => object.otyp === RUBY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            x: unicorn.mx,
            y: unicorn.my,
            minventRubies: (unicorn.minvent || [])
                .filter(object => object.otyp === RUBY).length,
        }, {
            hp: 10,
            hpmax: 11,
            peaceful: 0,
            tame: 0,
            x: 28,
            y: 16,
            minventRubies: 0,
        });
        assert.equal(game.uwep?.otyp, SLING);
        assert.equal(game.uwep?.spe, 3);
        assert.equal(game.u._weaponPracticeBySkill?.[21], 1);
        assert.equal(floorRubies.length, 1);
        assert.deepEqual({
            x: floorRubies[0].ox,
            y: floorRubies[0].oy,
            where: floorRubies[0].where,
        }, { x: 28, y: 16, where: 'floor' });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal(game.context.move, 1);
    });

test('seed0001 sling-launched diamond uses shared hard-gem metadata',
    async () => {
        const moves = '  n#wizwish\n+3 sling\nwg'
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\ndiamond\nthh';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 1,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 79);
        assert.equal(decodedTopline(result.getScreens()[76]),
            'What do you want to throw? [h or ?*]');
        assertRngSliceExact(result.getRngSlices()[78], [
            'rnd(20)=4', 'rnd(3)=3', 'rn2(19)=12',
            'rn2(3)=2', 'rn2(2)=1',
            'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=3',
            'rn2(4)=3', 'rn2(5)=4', 'rn2(5)=1', 'rn2(5)=0',
            'rn2(4)=3', 'rn2(3)=1', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(5)=0',
            'rn2(4)=3', 'rn2(5)=3', 'rn2(5)=2', 'rn2(5)=4',
            'rn2(12)=0', 'rn2(12)=10', 'rn2(12)=2', 'rn2(12)=0',
            'rn2(70)=63', 'rn2(400)=396', 'rn2(200)=48',
            'rn2(20)=13', 'rn2(76)=34',
        ], 'seed0001 slung diamond hard-gem RNG');
        assert.equal(decodedTopline(result.getScreens()[78]),
            'The white gem hits the black unicorn.  The black unicorn neighs!');
        assert.deepEqual(result.getCursors()[78], [52, 9, 1]);

        const targetX = game.u.ux - 1;
        const targetY = game.u.uy;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === targetX
                && monster.my === targetY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
        }, { hp: 14, hpmax: 15, peaceful: 0, tame: 0 });
        assert.equal(game.uwep?.otyp, SLING);
        assert.equal(game.uwep?.spe, 3);
        assert.equal(game.u._weaponPracticeBySkill?.[21], 1);
        assert.equal(game.inventory.some(object => object.otyp === DIAMOND),
            false);
        assert.equal((game.level.objects?.[targetX]?.[targetY] || [])
            .some(object => object.otyp === DIAMOND), false);
        assert.equal(game.context.move, 1);
    });

test('seed0001 sling-launched dilithium omits hard-gem draw', async () => {
    const moves = '  n#wizwish\n+3 sling\nwg'
        + '#wizgenesis\npeaceful black unicorn\n'
        + '#wizwish\ndilithium crystal\nthh';
    const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
    process.env.TELEPORT_DISABLE_FIXTURES = '1';
    let result;
    try {
        result = await runSegment({
            seed: 1,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves,
            storage: new Map(),
        });
    } finally {
        if (previousFixtureSetting === undefined)
            delete process.env.TELEPORT_DISABLE_FIXTURES;
        else
            process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
    }

    assert.equal(result.getScreens().length, 89);
    assert.equal(decodedTopline(result.getScreens()[86]),
        'What do you want to throw? [h or ?*]');
    assertRngSliceExact(result.getRngSlices()[88], [
        'rnd(20)=4', 'rnd(3)=3', 'rn2(19)=12', 'rn2(3)=2',
        'rn2(4)=3', 'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=1',
        'rn2(3)=1', 'rn2(5)=1', 'rn2(5)=4', 'rn2(4)=0',
        'rn2(5)=0', 'rn2(5)=1',
        'rn2(12)=7', 'rn2(12)=11', 'rn2(12)=8', 'rn2(12)=4',
        'rn2(70)=20', 'rn2(400)=43', 'rn2(200)=163',
        'rn2(20)=2', 'rn2(76)=29',
    ], 'seed0001 slung dilithium lower-Mohs RNG');
    assert.equal(decodedTopline(result.getScreens()[88]),
        'The white gem hits the black unicorn.  The black unicorn neighs!');
    assert.deepEqual(result.getCursors()[88], [52, 9, 1]);

    const targetX = game.u.ux - 1;
    const targetY = game.u.uy;
    const unicorn = game.level.monsters.find(monster =>
        monster.mnum === 103 && monster.mx === targetX
            && monster.my === targetY);
    assert.ok(unicorn);
    assert.deepEqual({
        hp: unicorn.mhp,
        hpmax: unicorn.mhpmax,
        peaceful: unicorn.mpeaceful,
        tame: unicorn.mtame ?? 0,
    }, { hp: 14, hpmax: 15, peaceful: 0, tame: 0 });
    assert.equal(game.uwep?.otyp, SLING);
    assert.equal(game.uwep?.spe, 3);
    assert.equal(game.u._weaponPracticeBySkill?.[21], 1);
    assert.equal(game.inventory
        .some(object => object.otyp === DILITHIUM_CRYSTAL), false);
    assert.equal((game.level.objects?.[targetX]?.[targetY] || [])
        .some(object => object.otyp === DILITHIUM_CRYSTAL), false);
    assert.equal(game.context.move, 1);
});

test('seed0018 sling-launched flint uses explicit hard-projectile draw',
    async () => {
        const moves = '  n#wizwish\n+3 sling\nwg'
            + '#wizgenesis\npeaceful black unicorn\n'
            + '#wizwish\nflint\nthh ';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 18,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 78);
        assert.equal(decodedTopline(result.getScreens()[74]),
            'What do you want to throw? [h or ?*]');
        assertRngSliceExact(result.getRngSlices()[76], [
            'rnd(20)=3', 'rnd(6)=4', 'rn2(19)=5',
            'rn2(3)=2', 'rn2(2)=1',
            'rn2(4)=0', 'rn2(5)=0', 'rn2(5)=1',
            'rn2(4)=0', 'rn2(5)=4', 'rn2(5)=2',
            'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(5)=1',
            'rn2(4)=1', 'rn2(5)=1', 'rn2(5)=4', 'rn2(5)=2',
            'rn2(12)=8', 'rn2(12)=6', 'rn2(12)=9', 'rn2(12)=11',
            'rn2(70)=59', 'rn2(400)=0', 'rn2(3)=0',
        ], 'seed0018 slung flint hard-projectile RNG');
        assert.equal(decodedTopline(result.getScreens()[76]),
            'The gray stone hits the black unicorn.  The black unicorn neighs!--More--');
        assert.deepEqual(result.getCursors()[76], [73, 0, 1]);
        assertRngSliceExact(result.getRngSlices()[77], [
            'rn2(20)=1', 'rn2(73)=26',
        ], 'seed0018 slung flint pager resume RNG');
        assert.equal(decodedTopline(result.getScreens()[77]),
            'You hear bubbling water.');
        assert.deepEqual(result.getCursors()[77], [25, 7, 1]);

        const targetX = game.u.ux - 1;
        const targetY = game.u.uy;
        const unicorn = game.level.monsters.find(monster =>
            monster.mnum === 103 && monster.mx === targetX
                && monster.my === targetY);
        assert.ok(unicorn);
        assert.deepEqual({
            hp: unicorn.mhp,
            hpmax: unicorn.mhpmax,
            peaceful: unicorn.mpeaceful,
            tame: unicorn.mtame ?? 0,
            x: unicorn.mx,
            y: unicorn.my,
        }, {
            hp: 12,
            hpmax: 14,
            peaceful: 0,
            tame: 0,
            x: 25,
            y: 6,
        });
        assert.equal(game.uwep?.otyp, SLING);
        assert.equal(game.uwep?.spe, 3);
        assert.equal(game.u._weaponPracticeBySkill?.[21], 1);
        assert.equal(game.inventory.some(object => object.otyp === FLINT),
            false);
        assert.equal((game.level.objects?.[targetX]?.[targetY] || [])
            .some(object => object.otyp === FLINT), false);
        assert.equal(game.context.move, 1);
    });

test('seed0110 sling-launched ruby pays fire passive before floor handoff',
    async () => {
        const moves = '  n#wizwish\n+3 sling\nwg'
            + '#wizgenesis\npeaceful fire elemental\n'
            + '#wizwish\nruby\nthh';
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                seed: 110,
                datetime: '20000110090000',
                nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                    + 'OPTIONS=!autopickup\n'
                    + 'OPTIONS=pettype:none\n'
                    + 'OPTIONS=suppress_alert:3.4.3\n'
                    + 'OPTIONS=symset:DECgraphics\n',
                moves,
                storage: new Map(),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        assert.equal(result.getScreens().length, 77);
        assert.equal(decodedTopline(result.getScreens()[74]),
            'What do you want to throw? [h or ?*]');
        assertRngSliceExact(result.getRngSlices()[76], [
            'rnd(20)=3', 'rnd(3)=3', 'rn2(19)=5',
            'rn2(3)=2', 'rn2(2)=0', 'rn2(6)=4', 'rn2(100)=13',
            'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(3)=0',
            'rn2(5)=0',
            'rn2(4)=1', 'rn2(5)=2', 'rn2(5)=4',
            'rn2(5)=4', 'rn2(5)=3', 'rn2(5)=1', 'rn2(5)=1',
            'rn2(5)=0',
            'rn2(12)=11', 'rn2(12)=6', 'rn2(12)=7',
            'rn2(12)=5', 'rn2(12)=5', 'rn2(12)=3',
            'rn2(70)=8', 'rn2(200)=20', 'rn2(20)=10', 'rn2(67)=34',
        ], 'seed0110 slung ruby fire-passive RNG');
        assert.equal(decodedTopline(result.getScreens()[76]),
            'The red gem hits the fire elemental.');
        assert.deepEqual(result.getCursors()[76], [73, 19, 1]);

        const targetX = game.u.ux - 1;
        const targetY = game.u.uy;
        const elemental = game.level.monsters.find(monster =>
            monster.mnum === 155 && monster.mx === targetX
                && monster.my === targetY);
        const floorRubies = (game.level.objects?.[targetX]?.[targetY] || [])
            .filter(object => object.otyp === RUBY);
        assert.ok(elemental);
        assert.deepEqual({
            hp: elemental.mhp,
            hpmax: elemental.mhpmax,
            peaceful: elemental.mpeaceful,
            x: elemental.mx,
            y: elemental.my,
        }, { hp: 28, hpmax: 29, peaceful: 0, x: 73, y: 18 });
        assert.equal(game.uwep?.otyp, SLING);
        assert.equal(game.u._weaponPracticeBySkill?.[21], 1);
        assert.equal(floorRubies.length, 1);
        assert.deepEqual({
            x: floorRubies[0].ox,
            y: floorRubies[0].oy,
            where: floorRubies[0].where,
            eroded: floorRubies[0].oeroded ?? 0,
            corroded: floorRubies[0].oeroded2 ?? 0,
        }, {
            x: 73,
            y: 18,
            where: 'floor',
            eroded: 0,
            corroded: 0,
        });
        assert.equal(game.inventory.some(object => object.otyp === RUBY), false);
        assert.equal(game.context.move, 1);
    });

test('seed0078 surviving elven arrow smoulders on fire-elemental passive',
    async () => {
        const result = await runSegment({
            seed: 78,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 +2 elven arrows\n'
                + '#wizgenesis\npeaceful fire elemental\ntgj  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 74);
        assertRngSliceExact(result.getRngSlices()[71], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=1', 'rnd(6)=6',
            'rn2(19)=12', 'rn2(4)=1', 'rn2(6)=0', 'rn2(100)=45',
            'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=2', 'rn2(5)=4',
            'rn2(4)=0', 'rn2(5)=2', 'rn2(12)=4', 'rn2(12)=0',
            'rn2(12)=1', 'rn2(70)=28', 'rn2(400)=113',
            'rn2(20)=8', 'rn2(70)=55',
        ], 'seed0078 fire-passive burn and scheduler RNG');
        assert.equal(
            decodedTopline(result.getScreens()[71]),
            'The elven arrow hits the fire elemental!  The elven arrow smoulders!',
        );
        assert.deepEqual(result.getCursors()[71], [4, 4, 1]);

        const elemental = game.level.monsters.find(monster =>
            monster.mnum === 155);
        assert.ok(elemental);
        assert.deepEqual({
            x: elemental.mx,
            y: elemental.my,
            hp: elemental.mhp,
            hpmax: elemental.mhpmax,
            peaceful: elemental.mpeaceful,
            cancelled: elemental.mcan ?? 0,
        }, {
            x: 5,
            y: 4,
            hp: 25,
            hpmax: 33,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[4] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            burn: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            greased: floorArrows[0].greased ?? false,
            blessed: floorArrows[0].blessed ?? false,
            cursed: floorArrows[0].cursed ?? false,
            proof: !!(floorArrows[0].oerodeproof
                || floorArrows[0].fireproof),
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 1,
            corrosion: 0,
            greased: false,
            blessed: false,
            cursed: false,
            proof: false,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            quantity: inventoryArrows[0].quantity
                ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            burn: inventoryArrows[0].oeroded ?? 0,
        }, { quantity: 1, enchantment: 2, burn: 0 });
        assert.equal(game.context.move, 0);
    });

test('seed0078 fireproof elven arrow resists fire-elemental passive',
    async () => {
        const result = await runSegment({
            seed: 78,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 fireproof +2 elven arrows\n'
                + '#wizgenesis\npeaceful fire elemental\ntgj  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 84);
        assertRngSliceExact(result.getRngSlices()[42], [
            'rn2(21)=7', 'rnd(2)=1', 'rn2(6)=0', 'rn2(11)=4',
            'rn2(10)=4', 'rn2(10)=7', 'rn2(100)=58',
            'rn2(100)=39', 'rn2(80)=9', 'rn2(80)=17',
            'rn2(1000)=341', 'rn2(100)=7',
        ], 'seed0078 fireproof wish RNG');
        assert.equal(decodedTopline(result.getScreens()[42]),
            'g - 2 elven arrows.');
        assert.deepEqual(result.getCursors()[42], [4, 4, 1]);

        assertRngSliceExact(result.getRngSlices()[81], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=1', 'rnd(6)=6',
            'rn2(19)=12', 'rn2(4)=1', 'rn2(6)=0',
        ], 'seed0078 fireproof hit and passive RNG');
        assert.equal(decodedTopline(result.getScreens()[81]),
            'The elven arrow hits the fire elemental!--More--');
        assert.deepEqual(result.getCursors()[81], [48, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[82], [
            'rn2(100)=45', 'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=2', 'rn2(12)=4',
            'rn2(12)=0', 'rn2(12)=1', 'rn2(70)=28',
            'rn2(400)=113', 'rn2(20)=8', 'rn2(70)=55',
        ], 'seed0078 fireproof floor and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[82]),
            'Somehow, the elven arrow is not affected by the heat.');
        assert.deepEqual(result.getCursors()[82], [4, 4, 1]);

        const elemental = game.level.monsters.find(monster =>
            monster.mnum === 155);
        assert.ok(elemental);
        assert.deepEqual({
            x: elemental.mx,
            y: elemental.my,
            hp: elemental.mhp,
            hpmax: elemental.mhpmax,
            peaceful: elemental.mpeaceful,
            cancelled: elemental.mcan ?? 0,
        }, {
            x: 5,
            y: 4,
            hp: 25,
            hpmax: 33,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[4] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            burn: floorArrows[0].oeroded ?? 0,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 0,
            proof: true,
            proofKnown: true,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            quantity: inventoryArrows[0].quantity
                ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            burn: inventoryArrows[0].oeroded ?? 0,
            proof: inventoryArrows[0].oerodeproof ?? false,
            proofKnown: inventoryArrows[0].rknown ?? false,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 0,
            proof: true,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0123 blessed elven arrow resists fire-elemental passive',
    async () => {
        const result = await runSegment({
            seed: 123,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 blessed +2 elven arrows\n'
                + '#wizgenesis\npeaceful fire elemental\ntgl  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 82);
        assertRngSliceExact(result.getRngSlices()[40], [
            'rn2(21)=14', 'rnd(2)=2', 'rn2(6)=1', 'rn2(11)=3',
            'rn2(10)=6', 'rn2(10)=5', 'rn2(100)=35',
            'rn2(100)=92', 'rn2(80)=33', 'rn2(80)=27',
            'rn2(1000)=315', 'rn2(100)=67',
        ], 'seed0123 blessed-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[40]),
            'g - 2 elven arrows.');
        assert.deepEqual(result.getCursors()[40], [33, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[79], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=7', 'rnd(6)=5',
            'rn2(19)=10', 'rn2(4)=3', 'rnl(4)=3',
            'rn2(6)=0', 'rnl(4)=0', 'rn2(100)=93',
            'rn2(4)=3', 'rn2(3)=1', 'rn2(3)=1', 'rn2(5)=3',
            'rn2(5)=2', 'rn2(4)=3', 'rn2(3)=0', 'rn2(3)=0',
            'rn2(3)=2', 'rn2(3)=0', 'rn2(5)=0', 'rn2(4)=3',
            'rn2(5)=4', 'rn2(5)=0', 'rn2(5)=1', 'rn2(4)=1',
            'rn2(3)=1', 'rn2(3)=2', 'rn2(3)=0', 'rn2(3)=0',
            'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=1', 'rn2(3)=1',
            'rn2(5)=0', 'rn2(5)=1', 'rn2(12)=9', 'rn2(12)=3',
            'rn2(12)=6', 'rn2(12)=3', 'rn2(70)=2',
            'rn2(400)=117', 'rn2(20)=15', 'rn2(73)=34',
        ], 'seed0123 blessed fire protection and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[79]),
            'The elven arrow hits the fire elemental!');
        assert.deepEqual(result.getCursors()[79], [33, 19, 1]);

        const elemental = game.level.monsters.find(monster =>
            monster.mnum === 155);
        assert.ok(elemental);
        assert.deepEqual({
            x: elemental.mx,
            y: elemental.my,
            hp: elemental.mhp,
            hpmax: elemental.mhpmax,
            peaceful: elemental.mpeaceful,
            cancelled: elemental.mcan ?? 0,
        }, {
            x: 35,
            y: 18,
            hp: 30,
            hpmax: 37,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[35]?.[18] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            burn: floorArrows[0].oeroded ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            quantity: inventoryArrows[0].quantity
                ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            burn: inventoryArrows[0].oeroded ?? 0,
            blessed: inventoryArrows[0].blessed ?? false,
            proof: inventoryArrows[0].oerodeproof ?? false,
            proofKnown: inventoryArrows[0].rknown ?? false,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0069 burnt elven arrow smoulders further on fire passive',
    async () => {
        const result = await runSegment({
            seed: 69,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 burnt +2 elven arrows\n'
                + '#wizgenesis\npeaceful fire elemental\ntgh  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 80);
        assertRngSliceExact(result.getRngSlices()[38], [
            'rn2(21)=3', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=6',
            'rn2(10)=4', 'rn2(10)=6', 'rn2(100)=2',
            'rn2(100)=19', 'rn2(80)=27', 'rn2(80)=13',
            'rn2(1000)=638', 'rn2(100)=13',
        ], 'seed0069 burnt-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[38]),
            'g - 2 burnt elven arrows.');
        assert.deepEqual(result.getCursors()[38], [60, 5, 1]);

        assertRngSliceExact(result.getRngSlices()[77], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=6', 'rnd(6)=2',
            'rn2(19)=5', 'rn2(2)=0', 'rn2(6)=0',
        ], 'seed0069 burnt-arrow hit and burn RNG');
        assert.equal(decodedTopline(result.getScreens()[77]),
            'The elven arrow hits the fire elemental.--More--');
        assert.deepEqual(result.getCursors()[77], [48, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[78], [
            'rn2(100)=94', 'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2',
            'rn2(5)=0', 'rn2(4)=0', 'rn2(5)=3', 'rn2(4)=1',
            'rn2(3)=2', 'rn2(3)=0', 'rn2(3)=0', 'rn2(3)=0',
            'rn2(3)=2', 'rn2(3)=2', 'rn2(5)=2', 'rn2(4)=2',
            'rn2(5)=1', 'rn2(5)=2', 'rn2(5)=0', 'rn2(4)=3',
            'rn2(3)=2', 'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=1',
            'rn2(5)=4', 'rn2(5)=2', 'rn2(12)=4', 'rn2(12)=9',
            'rn2(12)=10', 'rn2(12)=0', 'rn2(12)=4',
            'rn2(70)=38', 'rn2(400)=39', 'rn2(20)=4',
            'rn2(73)=67',
        ], 'seed0069 further-burn floor and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[78]),
            'The elven arrow smoulders further!');
        assert.deepEqual(result.getCursors()[78], [60, 5, 1]);

        const elemental = game.level.monsters.find(monster =>
            monster.mnum === 155);
        assert.ok(elemental);
        assert.deepEqual({
            x: elemental.mx,
            y: elemental.my,
            hp: elemental.mhp,
            hpmax: elemental.mhpmax,
            peaceful: elemental.mpeaceful,
            cancelled: elemental.mcan ?? 0,
        }, {
            x: 60,
            y: 4,
            hp: 32,
            hpmax: 35,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[60]?.[4] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            burn: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            proof: floorArrows[0].oerodeproof ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 2,
            corrosion: 0,
            blessed: false,
            proof: false,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            quantity: inventoryArrows[0].quantity
                ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            burn: inventoryArrows[0].oeroded ?? 0,
        }, { quantity: 1, enchantment: 2, burn: 1 });
        assert.equal(game.context.move, 0);
    });

test('seed0069 completely burnt elven arrow ignores further fire passive',
    async () => {
        const result = await runSegment({
            seed: 69,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 thoroughly burnt +2 elven arrows\n'
                + '#wizgenesis\npeaceful fire elemental\ntgh  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 91);
        assertRngSliceExact(result.getRngSlices()[49], [
            'rn2(21)=3', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=6',
            'rn2(10)=4', 'rn2(10)=6', 'rn2(100)=2',
            'rn2(100)=19', 'rn2(80)=27', 'rn2(80)=13',
            'rn2(1000)=638', 'rn2(100)=13',
        ], 'seed0069 completely-burnt wish RNG');
        assert.equal(decodedTopline(result.getScreens()[49]),
            'g - 2 thoroughly burnt elven arrows.');
        assert.deepEqual(result.getCursors()[49], [60, 5, 1]);

        assertRngSliceExact(result.getRngSlices()[88], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=6', 'rnd(6)=2',
            'rn2(19)=5', 'rn2(4)=0', 'rn2(6)=0', 'rn2(100)=94',
            'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=2', 'rn2(5)=0',
            'rn2(4)=0', 'rn2(5)=3', 'rn2(4)=1', 'rn2(3)=2',
            'rn2(3)=0', 'rn2(3)=0', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(3)=2', 'rn2(5)=2', 'rn2(4)=2', 'rn2(5)=1',
            'rn2(5)=2', 'rn2(5)=0', 'rn2(4)=3', 'rn2(3)=2',
            'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=1', 'rn2(5)=4',
            'rn2(5)=2', 'rn2(12)=4', 'rn2(12)=9', 'rn2(12)=10',
            'rn2(12)=0', 'rn2(12)=4', 'rn2(70)=38',
            'rn2(400)=39', 'rn2(20)=4', 'rn2(73)=67',
        ], 'seed0069 complete-burn no-op and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[88]),
            'The elven arrow hits the fire elemental.');
        assert.deepEqual(result.getCursors()[88], [60, 5, 1]);

        const elemental = game.level.monsters.find(monster =>
            monster.mnum === 155);
        assert.ok(elemental);
        assert.deepEqual({
            x: elemental.mx,
            y: elemental.my,
            hp: elemental.mhp,
            hpmax: elemental.mhpmax,
            peaceful: elemental.mpeaceful,
            cancelled: elemental.mcan ?? 0,
        }, {
            x: 60,
            y: 4,
            hp: 34,
            hpmax: 35,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[60]?.[4] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            burn: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            proof: floorArrows[0].oerodeproof ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            burn: 3,
            corrosion: 0,
            blessed: false,
            proof: false,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            quantity: inventoryArrows[0].quantity
                ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            burn: inventoryArrows[0].oeroded ?? 0,
        }, { quantity: 1, enchantment: 2, burn: 3 });
        assert.equal(game.context.move, 0);
    });

test('seed0005 greased arrow resists rust and retains grease', async () => {
    const result = await runSegment({
        seed: 5,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
            + '#wizgenesis\npeaceful rust monster\ntgy  ',
        storage: new Map(),
    });

    assert.equal(result.getScreens().length, 83);
    assertRngSliceExact(result.getRngSlices()[43], [
        'rn2(56)=32', 'rnd(2)=2', 'rn2(6)=0', 'rn2(11)=4',
        'rn2(10)=6', 'rn2(10)=7', 'rn2(100)=44',
        'rn2(100)=0', 'rn2(1000)=473', 'rn2(100)=5',
    ], 'seed0005 uncursed greased-arrow wish RNG');
    assert.equal(decodedTopline(result.getScreens()[43]),
        'g - 2 greased arrows.');
    assert.deepEqual(result.getCursors()[43], [37, 5, 1]);

    assertRngSliceExact(result.getRngSlices()[80], [
        'rnd(2)=1', 'rnd(2)=1', 'rn2(7)=4', 'rnd(20)=1',
        'rnd(6)=4', 'rn2(19)=12', 'rn2(4)=3', 'rn2(2)=1',
        'rn2(100)=99', 'rn2(4)=0', 'rn2(5)=1', 'rn2(5)=3',
        'rn2(12)=8', 'rn2(12)=4', 'rn2(12)=11', 'rn2(12)=7',
        'rn2(70)=43', 'rn2(400)=35', 'rn2(200)=149',
        'rn2(20)=0', 'rn2(67)=51',
    ], 'seed0005 greased-arrow flight and rust-passive RNG');
    assert.equal(decodedTopline(result.getScreens()[80]),
        'The arrow hits the rust monster!');
    assert.deepEqual(result.getCursors()[80], [37, 5, 1]);

    const rustMonster = game.level.monsters.find(monster =>
        monster.mnum === 212);
    assert.ok(rustMonster);
    assert.deepEqual({
        x: rustMonster.mx,
        y: rustMonster.my,
        hp: rustMonster.mhp,
        hpmax: rustMonster.mhpmax,
        peaceful: rustMonster.mpeaceful,
        cancelled: rustMonster.mcan ?? 0,
    }, {
        x: 37,
        y: 3,
        hp: 6,
        hpmax: 12,
        peaceful: 0,
        cancelled: 0,
    });

    const floorArrows = (game.level.objects?.[37]?.[3] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.deepEqual({
        quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
        enchantment: floorArrows[0].spe ?? 0,
        rust: floorArrows[0].oeroded ?? 0,
        grease: floorArrows[0].greased ?? false,
        blessed: floorArrows[0].blessed ?? false,
        cursed: floorArrows[0].cursed ?? false,
        where: floorArrows[0].where,
    }, {
        quantity: 1,
        enchantment: 2,
        rust: 0,
        grease: true,
        blessed: false,
        cursed: false,
        where: 'floor',
    });

    const wishedInventoryArrows = game.inventory.filter(object =>
        object.otyp === ARROW && object.greased);
    assert.equal(wishedInventoryArrows.length, 1);
    assert.deepEqual({
        letter: wishedInventoryArrows[0].invlet,
        quantity: wishedInventoryArrows[0].quantity
            ?? wishedInventoryArrows[0].quan,
        enchantment: wishedInventoryArrows[0].spe ?? 0,
        rust: wishedInventoryArrows[0].oeroded ?? 0,
        grease: wishedInventoryArrows[0].greased ?? false,
    }, {
        letter: 'g',
        quantity: 1,
        enchantment: 2,
        rust: 0,
        grease: true,
    });
    assert.equal(game.context.move, 0);
});

test('seed0150 greased arrow resists rust and loses grease', async () => {
    const result = await runSegment({
        seed: 150,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
            + 'OPTIONS=!autopickup\n'
            + 'OPTIONS=pettype:none\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
            + '#wizgenesis\npeaceful rust monster\ntgk  ',
        storage: new Map(),
    });

    assert.equal(result.getScreens().length, 83);
    assertRngSliceExact(result.getRngSlices()[43], [
        'rn2(56)=53', 'rnd(2)=1', 'rn2(6)=4', 'rn2(11)=10',
        'rn2(10)=8', 'rn2(10)=0', 'rn2(2)=1', 'rn2(100)=98',
        'rn2(100)=48', 'rn2(80)=41', 'rn2(80)=64',
        'rn2(1000)=467', 'rn2(100)=52',
    ], 'seed0150 uncursed greased-arrow wish RNG');
    assert.equal(decodedTopline(result.getScreens()[43]),
        'g - 2 greased arrows.');
    assert.deepEqual(result.getCursors()[43], [48, 15, 1]);

    assertRngSliceExact(result.getRngSlices()[80], [
        'rnd(2)=1', 'rnd(2)=2', 'rn2(7)=4', 'rnd(20)=4',
        'rnd(6)=6', 'rn2(19)=1', 'rn2(4)=3', 'rn2(2)=0',
        'rn2(100)=97', 'rn2(4)=0', 'rn2(5)=1', 'rn2(5)=2',
        'rn2(12)=7', 'rn2(12)=0', 'rn2(70)=10',
        'rn2(300)=134', 'rn2(200)=187', 'rn2(20)=13',
        'rn2(67)=3',
    ], 'seed0150 grease wear and rust-passive RNG');
    assert.equal(decodedTopline(result.getScreens()[80]),
        'The arrow hits the rust monster!');
    assert.deepEqual(result.getCursors()[80], [48, 15, 1]);

    const rustMonster = game.level.monsters.find(monster =>
        monster.mnum === 212);
    assert.ok(rustMonster);
    assert.deepEqual({
        x: rustMonster.mx,
        y: rustMonster.my,
        hp: rustMonster.mhp,
        hpmax: rustMonster.mhpmax,
        peaceful: rustMonster.mpeaceful,
        cancelled: rustMonster.mcan ?? 0,
    }, {
        x: 49,
        y: 13,
        hp: 5,
        hpmax: 13,
        peaceful: 0,
        cancelled: 0,
    });

    const floorArrows = (game.level.objects?.[49]?.[13] || [])
        .filter(object => object.otyp === ARROW);
    assert.equal(floorArrows.length, 1);
    assert.deepEqual({
        quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
        enchantment: floorArrows[0].spe ?? 0,
        rust: floorArrows[0].oeroded ?? 0,
        grease: floorArrows[0].greased ?? false,
        blessed: floorArrows[0].blessed ?? false,
        cursed: floorArrows[0].cursed ?? false,
        where: floorArrows[0].where,
    }, {
        quantity: 1,
        enchantment: 2,
        rust: 0,
        grease: false,
        blessed: false,
        cursed: false,
        where: 'floor',
    });

    const wishedInventoryArrows = game.inventory.filter(object =>
        object.otyp === ARROW && object.greased);
    assert.equal(wishedInventoryArrows.length, 1);
    assert.deepEqual({
        letter: wishedInventoryArrows[0].invlet,
        quantity: wishedInventoryArrows[0].quantity
            ?? wishedInventoryArrows[0].quan,
        enchantment: wishedInventoryArrows[0].spe ?? 0,
        rust: wishedInventoryArrows[0].oeroded ?? 0,
        grease: wishedInventoryArrows[0].greased ?? false,
    }, {
        letter: 'g',
        quantity: 1,
        enchantment: 2,
        rust: 0,
        grease: true,
    });
    assert.equal(game.context.move, 0);
});

test('seed0007 greased second arrow misfires northwest before contact',
    async () => {
        const result = await runSegment({
            seed: 7,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgj  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 83);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(56)=13', 'rnd(2)=2', 'rn2(6)=2', 'rn2(11)=6',
            'rn2(10)=6', 'rn2(10)=4', 'rn2(100)=74',
            'rn2(100)=55', 'rn2(80)=40', 'rn2(80)=5',
            'rn2(1000)=965', 'rn2(100)=19',
        ], 'seed0007 greased-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[43]),
            'g - 2 greased arrows.');
        assert.deepEqual(result.getCursors()[43], [76, 17, 1]);

        assertRngSliceExact(result.getRngSlices()[80], [
            'rnd(2)=2', 'rnd(2)=2', 'rn2(7)=6', 'rnd(20)=14',
            'rn2(3)=0', 'rn2(100)=37', 'rn2(7)=0',
        ], 'seed0007 first miss and second misfire gate RNG');
        assert.equal(decodedTopline(result.getScreens()[80]),
            'You shoot 2 arrows.  The 1st arrow misses the rust monster.--More--');
        assert.deepEqual(result.getCursors()[80], [67, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[81], [
            'rn2(3)=0', 'rn2(3)=0', 'rn2(100)=92',
            'rn2(4)=1', 'rn2(3)=2', 'rn2(3)=0', 'rn2(3)=0',
            'rn2(3)=1', 'rn2(5)=2', 'rn2(4)=3', 'rn2(5)=2',
            'rn2(5)=3', 'rn2(5)=4', 'rn2(4)=2', 'rn2(3)=0',
            'rn2(3)=0', 'rn2(5)=3', 'rn2(4)=3', 'rn2(5)=3',
            'rn2(5)=2', 'rn2(5)=4', 'rn2(5)=3', 'rn2(5)=2',
            'rn2(5)=3', 'rn2(5)=0', 'rn2(4)=1', 'rn2(3)=1',
            'rn2(3)=1', 'rn2(5)=3', 'rn2(5)=1', 'rn2(12)=1',
            'rn2(12)=9', 'rn2(12)=11', 'rn2(12)=2', 'rn2(12)=2',
            'rn2(70)=65', 'rn2(20)=6', 'rn2(70)=62',
        ], 'seed0007 rerouted arrow and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[81]),
            'The arrow misfires!');
        assert.deepEqual(result.getCursors()[81], [76, 17, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
        }, {
            x: 77,
            y: 17,
            hp: 22,
            hpmax: 22,
            peaceful: 0,
        });

        const floorArrows = game.level.objects.flat(2)
            .filter(object => object?.otyp === ARROW && object.greased)
            .map(object => ({
                x: object.ox,
                y: object.oy,
                quantity: object.quantity ?? object.quan,
                enchantment: object.spe ?? 0,
                rust: object.oeroded ?? 0,
                where: object.where,
            }))
            .sort((left, right) => left.x - right.x || left.y - right.y);
        assert.deepEqual(floorArrows, [
            {
                x: 76,
                y: 15,
                quantity: 1,
                enchantment: 2,
                rust: 0,
                where: 'floor',
            },
            {
                x: 77,
                y: 17,
                quantity: 1,
                enchantment: 2,
                rust: 0,
                where: 'floor',
            },
        ]);
        assert.equal(game.inventory.some(object =>
            object.otyp === ARROW && object.greased), false);
        assert.equal(game.context.move, 0);
    });

test('seed0022 rustproof arrow learns proof on rust-monster passive',
    async () => {
        const result = await runSegment({
            seed: 22,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed rustproof +2 arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgk  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 85);
        assertRngSliceExact(result.getRngSlices()[45], [
            'rn2(56)=11', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=9',
            'rn2(10)=1', 'rn2(10)=0', 'rn2(2)=1', 'rn2(100)=68',
            'rn2(100)=45', 'rn2(80)=13', 'rn2(80)=5',
            'rn2(1000)=882', 'rn2(100)=69',
        ], 'seed0022 rustproof-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[45]),
            'g - 2 arrows.');
        assert.deepEqual(result.getCursors()[45], [58, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[82], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=2', 'rnd(6)=5',
            'rn2(19)=0', 'rn2(4)=1',
        ], 'seed0022 rustproof hit and passive prefix RNG');
        assert.equal(decodedTopline(result.getScreens()[82]),
            'The arrow hits the rust monster!--More--');
        assert.deepEqual(result.getCursors()[82], [40, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[83], [
            'rn2(100)=39', 'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1',
            'rn2(5)=2', 'rn2(4)=1', 'rn2(5)=2', 'rn2(5)=3',
            'rn2(5)=0', 'rn2(5)=1', 'rn2(5)=0', 'rn2(12)=7',
            'rn2(12)=9', 'rn2(12)=10', 'rn2(12)=2', 'rn2(12)=0',
            'rn2(70)=59', 'rnl(8)=6', 'rn2(20)=6', 'rn2(73)=69',
        ], 'seed0022 rustproof floor and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[83]),
            'Somehow, the arrow is not affected by the oxidation.');
        assert.deepEqual(result.getCursors()[83], [58, 19, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 59,
            y: 17,
            hp: 19,
            hpmax: 26,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[59]?.[17] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            proof: true,
            proofKnown: true,
            where: 'floor',
        });

        const proofInventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.oerodeproof);
        assert.equal(proofInventoryArrows.length, 1);
        assert.deepEqual({
            letter: proofInventoryArrows[0].invlet,
            quantity: proofInventoryArrows[0].quantity
                ?? proofInventoryArrows[0].quan,
            enchantment: proofInventoryArrows[0].spe ?? 0,
            rust: proofInventoryArrows[0].oeroded ?? 0,
            proof: proofInventoryArrows[0].oerodeproof ?? false,
            proofKnown: proofInventoryArrows[0].rknown ?? false,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 0,
            proof: true,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0123 blessed arrow silently resists rust-monster passive',
    async () => {
        const result = await runSegment({
            seed: 123,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 blessed +2 arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgl  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 74);
        assertRngSliceExact(result.getRngSlices()[34], [
            'rn2(56)=7', 'rnd(2)=2', 'rn2(6)=1', 'rn2(11)=3',
            'rn2(10)=6', 'rn2(10)=5', 'rn2(100)=35',
            'rn2(100)=92', 'rn2(80)=33', 'rn2(80)=27',
            'rn2(1000)=315', 'rn2(100)=67',
        ], 'seed0123 blessed-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[34]),
            'g - 2 arrows.');
        assert.deepEqual(result.getCursors()[34], [33, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[71], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=7', 'rnd(6)=5',
            'rn2(19)=10', 'rn2(4)=3', 'rnl(4)=3', 'rnl(4)=0',
            'rn2(100)=84', 'rn2(4)=1', 'rn2(3)=1', 'rn2(3)=1',
            'rn2(5)=4', 'rn2(5)=3', 'rn2(4)=0', 'rn2(5)=3',
            'rn2(5)=2', 'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=0',
            'rn2(5)=0', 'rn2(4)=3', 'rn2(5)=4', 'rn2(5)=0',
            'rn2(5)=1', 'rn2(12)=9', 'rn2(12)=4', 'rn2(12)=5',
            'rn2(12)=6', 'rn2(70)=18', 'rn2(400)=95',
            'rn2(20)=4', 'rn2(73)=37',
        ], 'seed0123 blessed rust protection and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[71]),
            'The arrow hits the rust monster!');
        assert.deepEqual(result.getCursors()[71], [33, 19, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 35,
            y: 18,
            hp: 17,
            hpmax: 24,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[35]?.[18] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
            where: 'floor',
        });

        const blessedInventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.blessed);
        assert.equal(blessedInventoryArrows.length, 1);
        assert.deepEqual({
            letter: blessedInventoryArrows[0].invlet,
            quantity: blessedInventoryArrows[0].quantity
                ?? blessedInventoryArrows[0].quan,
            enchantment: blessedInventoryArrows[0].spe ?? 0,
            rust: blessedInventoryArrows[0].oeroded ?? 0,
            proof: blessedInventoryArrows[0].oerodeproof ?? false,
            proofKnown: blessedInventoryArrows[0].rknown ?? false,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 0,
            proof: false,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0026 rusty arrow rusts further on rust-monster passive',
    async () => {
        const result = await runSegment({
            seed: 26,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 rusty +2 arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 72);
        assertRngSliceExact(result.getRngSlices()[32], [
            'rn2(56)=53', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=2',
            'rn2(10)=8', 'rn2(10)=3', 'rn2(100)=45',
            'rn2(100)=92', 'rn2(80)=25', 'rn2(80)=77',
            'rn2(1000)=83', 'rn2(100)=35',
        ], 'seed0026 rusty-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[32]),
            'g - 2 rusty arrows.');
        assert.deepEqual(result.getCursors()[32], [3, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[69], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=2', 'rnd(6)=4',
            'rn2(19)=3', 'rn2(2)=0', 'rn2(100)=80',
            'rn2(4)=2', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=1',
            'rn2(4)=2', 'rn2(5)=4', 'rn2(5)=4', 'rn2(5)=3',
            'rn2(5)=3', 'rn2(5)=2', 'rn2(5)=0', 'rn2(5)=1',
            'rn2(5)=2', 'rn2(5)=4', 'rn2(5)=3', 'rn2(5)=3',
            'rn2(5)=2', 'rn2(5)=3', 'rn2(12)=7', 'rn2(12)=7',
            'rn2(12)=11', 'rn2(12)=3', 'rn2(70)=26',
            'rn2(200)=172', 'rn2(20)=2', 'rn2(70)=45',
        ], 'seed0026 further-rust and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[69]),
            'The arrow hits the rust monster!  The arrow rusts further!');
        assert.deepEqual(result.getCursors()[69], [3, 19, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 5,
            y: 17,
            hp: 18,
            hpmax: 23,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[17] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 2,
            corrosion: 0,
            where: 'floor',
        });

        const rustyInventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.oeroded === 1);
        assert.equal(rustyInventoryArrows.length, 1);
        assert.deepEqual({
            letter: rustyInventoryArrows[0].invlet,
            quantity: rustyInventoryArrows[0].quantity
                ?? rustyInventoryArrows[0].quan,
            enchantment: rustyInventoryArrows[0].spe ?? 0,
            rust: rustyInventoryArrows[0].oeroded ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 1,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0172 completely rusty arrow ignores further rust passive',
    async () => {
        const result = await runSegment({
            seed: 172,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 thoroughly rusty +2 arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgk  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 83);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(56)=8', 'rnd(2)=1', 'rn2(6)=3', 'rn2(11)=10',
            'rn2(10)=1', 'rn2(10)=6', 'rn2(100)=97',
            'rn2(100)=42', 'rn2(80)=53', 'rn2(80)=75',
            'rn2(1000)=83', 'rn2(100)=28',
        ], 'seed0172 completely-rusty wish RNG');
        assert.equal(decodedTopline(result.getScreens()[43]),
            'g - 2 thoroughly rusty arrows.');
        assert.deepEqual(result.getCursors()[43], [34, 9, 1]);

        assertRngSliceExact(result.getRngSlices()[80], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=4', 'rnd(6)=1',
            'rn2(19)=17', 'rn2(4)=0', 'rn2(100)=69',
            'rn2(4)=0', 'rn2(5)=1', 'rn2(5)=1', 'rn2(12)=0',
            'rn2(12)=5', 'rn2(12)=5', 'rn2(70)=25', 'rnl(8)=5',
            'rn2(400)=299', 'rn2(300)=70', 'rn2(200)=89',
            'rn2(20)=3', 'rn2(67)=13',
        ], 'seed0172 complete-rust no-op and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[80]),
            'The arrow hits the rust monster.');
        assert.deepEqual(result.getCursors()[80], [34, 9, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 35,
            y: 7,
            hp: 16,
            hpmax: 17,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[35]?.[7] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 3,
            corrosion: 0,
            where: 'floor',
        });

        const rustyInventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.oeroded === 3);
        assert.equal(rustyInventoryArrows.length, 1);
        assert.deepEqual({
            letter: rustyInventoryArrows[0].invlet,
            quantity: rustyInventoryArrows[0].quantity
                ?? rustyInventoryArrows[0].quan,
            enchantment: rustyInventoryArrows[0].spe ?? 0,
            rust: rustyInventoryArrows[0].oeroded ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 3,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0022 iron orcish arrow rusts on rust-monster passive',
    async () => {
        const result = await runSegment({
            seed: 22,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgk  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 82);
        assertRngSliceExact(result.getRngSlices()[42], [
            'rn2(21)=4', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=9',
            'rn2(10)=1', 'rn2(10)=0', 'rn2(2)=1', 'rn2(100)=68',
            'rn2(100)=45', 'rn2(80)=13', 'rn2(80)=5',
            'rn2(1000)=882', 'rn2(100)=69',
        ], 'seed0022 orcish-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[42]),
            'g - 2 orcish arrows.');
        assert.deepEqual(result.getCursors()[42], [58, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[79], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=2', 'rnd(5)=3',
            'rn2(19)=0', 'rn2(4)=1', 'rn2(100)=39',
            'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=2',
            'rn2(4)=1', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=0',
            'rn2(5)=1', 'rn2(5)=0', 'rn2(12)=7', 'rn2(12)=9',
            'rn2(12)=10', 'rn2(12)=2', 'rn2(12)=0',
            'rn2(70)=59', 'rnl(8)=6', 'rn2(20)=6', 'rn2(73)=69',
        ], 'seed0022 orcish-arrow rust and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[79]),
            'The orcish arrow hits the rust monster!  The orcish arrow rusts!');
        assert.deepEqual(result.getCursors()[79], [58, 19, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 59,
            y: 17,
            hp: 21,
            hpmax: 26,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[59]?.[17] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 1,
            corrosion: 0,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ORCISH_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            rust: inventoryArrows[0].oeroded ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0022 wooden elven arrow ignores rust-monster passive',
    async () => {
        const result = await runSegment({
            seed: 22,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 elven arrows\n'
                + '#wizgenesis\npeaceful rust monster\ntgk  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 81);
        assertRngSliceExact(result.getRngSlices()[41], [
            'rn2(21)=4', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=9',
            'rn2(10)=1', 'rn2(10)=0', 'rn2(2)=1', 'rn2(100)=68',
            'rn2(100)=45', 'rn2(80)=13', 'rn2(80)=5',
            'rn2(1000)=882', 'rn2(100)=69',
        ], 'seed0022 elven-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[41]),
            'g - 2 elven arrows.');
        assert.deepEqual(result.getCursors()[41], [58, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[78], [
            'rnd(2)=1', 'rnd(2)=2', 'rnd(20)=2', 'rnd(7)=2',
            'rn2(19)=0', 'rn2(4)=1', 'rn2(100)=39',
            'rn2(4)=3', 'rn2(3)=2', 'rn2(3)=1', 'rn2(5)=2',
            'rn2(4)=1', 'rn2(5)=2', 'rn2(5)=3', 'rn2(5)=0',
            'rn2(5)=1', 'rn2(5)=0', 'rn2(12)=7', 'rn2(12)=9',
            'rn2(12)=10', 'rn2(12)=2', 'rn2(12)=0',
            'rn2(70)=59', 'rnl(8)=6', 'rn2(20)=6', 'rn2(73)=69',
        ], 'seed0022 elven-arrow rust-negative RNG');
        assert.equal(decodedTopline(result.getScreens()[78]),
            'The elven arrow hits the rust monster.');
        assert.deepEqual(result.getCursors()[78], [58, 19, 1]);

        const rustMonster = game.level.monsters.find(monster =>
            monster.mnum === 212);
        assert.ok(rustMonster);
        assert.deepEqual({
            x: rustMonster.mx,
            y: rustMonster.my,
            hp: rustMonster.mhp,
            hpmax: rustMonster.mhpmax,
            peaceful: rustMonster.mpeaceful,
            cancelled: rustMonster.mcan ?? 0,
        }, {
            x: 59,
            y: 17,
            hp: 22,
            hpmax: 26,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[59]?.[17] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            rust: inventoryArrows[0].oeroded ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0026 iron orcish arrow corrodes on black-pudding passive',
    async () => {
        const result = await runSegment({
            seed: 26,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 orcish arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 83);
        assertRngSliceExact(result.getRngSlices()[42], [
            'rn2(21)=18', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=2',
            'rn2(10)=8', 'rn2(10)=3', 'rn2(100)=45',
            'rn2(100)=92', 'rn2(80)=25', 'rn2(80)=77',
            'rn2(1000)=83', 'rn2(100)=35',
        ], 'seed0026 orcish-arrow corrosion wish RNG');
        assert.equal(decodedTopline(result.getScreens()[42]),
            'g - 2 orcish arrows.');
        assert.deepEqual(result.getCursors()[42], [3, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[80], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=1', 'rnd(6)=3',
            'rn2(19)=8', 'rn2(4)=3', 'rn2(100)=41',
            'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=0',
            'rn2(3)=1', 'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=1',
            'rn2(3)=0', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=3',
            'rn2(12)=4', 'rn2(12)=10', 'rn2(12)=7', 'rn2(12)=7',
            'rn2(70)=49', 'rn2(200)=35', 'rn2(20)=6', 'rn2(70)=22',
        ], 'seed0026 orcish-arrow corrosion and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[80]),
            'The orcish arrow hits the black pudding!  The orcish arrow corrodes!');
        assert.deepEqual(result.getCursors()[80], [3, 19, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 5,
            y: 17,
            hp: 37,
            hpmax: 42,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[17] || [])
            .filter(object => object.otyp === ORCISH_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 1,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ORCISH_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            rust: inventoryArrows[0].oeroded ?? 0,
            corrosion: inventoryArrows[0].oeroded2 ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0026 wooden elven arrow ignores black-pudding corrosion',
    async () => {
        const result = await runSegment({
            seed: 26,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed +2 elven arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 82);
        assertRngSliceExact(result.getRngSlices()[41], [
            'rn2(21)=18', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=2',
            'rn2(10)=8', 'rn2(10)=3', 'rn2(100)=45',
            'rn2(100)=92', 'rn2(80)=25', 'rn2(80)=77',
            'rn2(1000)=83', 'rn2(100)=35',
        ], 'seed0026 elven-arrow corrosion-negative wish RNG');
        assert.equal(decodedTopline(result.getScreens()[41]),
            'g - 2 elven arrows.');
        assert.deepEqual(result.getCursors()[41], [3, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[79], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=1', 'rnd(6)=3',
            'rn2(19)=8', 'rn2(4)=3', 'rn2(100)=41',
            'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=0',
            'rn2(3)=1', 'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=1',
            'rn2(3)=0', 'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=3',
            'rn2(12)=4', 'rn2(12)=10', 'rn2(12)=7', 'rn2(12)=7',
            'rn2(70)=49', 'rn2(200)=35', 'rn2(20)=6', 'rn2(70)=22',
        ], 'seed0026 elven-arrow corrosion-negative RNG');
        assert.equal(decodedTopline(result.getScreens()[79]),
            'The elven arrow hits the black pudding!');
        assert.deepEqual(result.getCursors()[79], [3, 19, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 5,
            y: 17,
            hp: 37,
            hpmax: 42,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[17] || [])
            .filter(object => object.otyp === ELVEN_ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            rust: floorArrows[0].oeroded ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ELVEN_ARROW);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            rust: inventoryArrows[0].oeroded ?? 0,
            corrosion: inventoryArrows[0].oeroded2 ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            rust: 0,
            corrosion: 0,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0026 corrodeproof arrow learns proof on black-pudding passive',
    async () => {
        const result = await runSegment({
            seed: 26,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed corrodeproof +2 arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 89);
        assertRngSliceExact(result.getRngSlices()[48], [
            'rn2(56)=53', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=2',
            'rn2(10)=8', 'rn2(10)=3', 'rn2(100)=45',
            'rn2(100)=92', 'rn2(80)=25', 'rn2(80)=77',
            'rn2(1000)=83', 'rn2(100)=35',
        ], 'seed0026 corrodeproof-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[48]),
            'g - 2 arrows.');
        assert.deepEqual(result.getCursors()[48], [3, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[86], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=1', 'rnd(6)=3',
            'rn2(19)=8', 'rn2(4)=3',
        ], 'seed0026 corrodeproof hit and passive prefix RNG');
        assert.equal(decodedTopline(result.getScreens()[86]),
            'The arrow hits the black pudding!--More--');
        assert.deepEqual(result.getCursors()[86], [41, 0, 1]);

        assertRngSliceExact(result.getRngSlices()[87], [
            'rn2(100)=41', 'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=0', 'rn2(3)=1',
            'rn2(3)=1', 'rn2(3)=0', 'rn2(5)=4', 'rn2(4)=0',
            'rn2(5)=3', 'rn2(12)=4', 'rn2(12)=10', 'rn2(12)=7',
            'rn2(12)=7', 'rn2(70)=49', 'rn2(200)=35',
            'rn2(20)=6', 'rn2(70)=22',
        ], 'seed0026 corrodeproof floor and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[87]),
            'Somehow, the arrow is not affected by the corrosion.');
        assert.deepEqual(result.getCursors()[87], [3, 19, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 5,
            y: 17,
            hp: 37,
            hpmax: 42,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[17] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            proof: true,
            proofKnown: true,
            where: 'floor',
        });

        const proofInventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.oerodeproof);
        assert.equal(proofInventoryArrows.length, 1);
        assert.deepEqual({
            letter: proofInventoryArrows[0].invlet,
            quantity: proofInventoryArrows[0].quantity
                ?? proofInventoryArrows[0].quan,
            enchantment: proofInventoryArrows[0].spe ?? 0,
            corrosion: proofInventoryArrows[0].oeroded2 ?? 0,
            proof: proofInventoryArrows[0].oerodeproof ?? false,
            proofKnown: proofInventoryArrows[0].rknown ?? false,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            proof: true,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0069 blessed arrow silently resists black-pudding corrosion',
    async () => {
        const result = await runSegment({
            seed: 69,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 blessed +2 arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgh  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 75);
        assertRngSliceExact(result.getRngSlices()[34], [
            'rn2(56)=45', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=6',
            'rn2(10)=4', 'rn2(10)=6', 'rn2(100)=2',
            'rn2(100)=19', 'rn2(80)=27', 'rn2(80)=13',
            'rn2(1000)=638', 'rn2(100)=13',
        ], 'seed0069 blessed corrosion wish RNG');
        assert.equal(decodedTopline(result.getScreens()[34]),
            'g - 2 arrows.');
        assert.deepEqual(result.getCursors()[34], [60, 5, 1]);

        assertRngSliceExact(result.getRngSlices()[72], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=7', 'rnd(6)=1',
            'rn2(19)=17', 'rn2(4)=3', 'rnl(4)=0', 'rnl(4)=0',
            'rn2(100)=78', 'rn2(4)=2', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(5)=4', 'rn2(4)=2', 'rn2(5)=3', 'rn2(5)=3',
            'rn2(5)=1', 'rn2(4)=1', 'rn2(3)=0', 'rn2(3)=0',
            'rn2(3)=0', 'rn2(3)=2', 'rn2(5)=3', 'rn2(4)=1',
            'rn2(5)=3', 'rn2(5)=1', 'rn2(5)=2', 'rn2(5)=0',
            'rn2(5)=4', 'rn2(5)=3', 'rn2(5)=4', 'rn2(4)=1',
            'rn2(3)=1', 'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=1',
            'rn2(5)=4', 'rn2(5)=4', 'rn2(12)=0', 'rn2(12)=4',
            'rn2(12)=4', 'rn2(12)=3', 'rn2(12)=8', 'rn2(70)=57',
            'rn2(400)=328', 'rn2(20)=11', 'rn2(73)=19',
        ], 'seed0069 blessed corrosion protection and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[72]),
            'The arrow hits the black pudding.');
        assert.deepEqual(result.getCursors()[72], [60, 5, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 60,
            y: 4,
            hp: 40,
            hpmax: 43,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[60]?.[4] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            blessed: floorArrows[0].blessed ?? false,
            proof: floorArrows[0].oerodeproof ?? false,
            proofKnown: floorArrows[0].rknown ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            blessed: true,
            proof: false,
            proofKnown: false,
            where: 'floor',
        });

        const blessedInventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.blessed);
        assert.equal(blessedInventoryArrows.length, 1);
        assert.deepEqual({
            letter: blessedInventoryArrows[0].invlet,
            quantity: blessedInventoryArrows[0].quantity
                ?? blessedInventoryArrows[0].quan,
            enchantment: blessedInventoryArrows[0].spe ?? 0,
            corrosion: blessedInventoryArrows[0].oeroded2 ?? 0,
            proof: blessedInventoryArrows[0].oerodeproof ?? false,
            proofKnown: blessedInventoryArrows[0].rknown ?? false,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            proof: false,
            proofKnown: false,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0004 corroded arrow corrodes further on black-pudding passive',
    async () => {
        const result = await runSegment({
            seed: 4,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 corroded +2 arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgl  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 76);
        assertRngSliceExact(result.getRngSlices()[35], [
            'rn2(56)=5', 'rnd(2)=1', 'rn2(6)=1', 'rn2(11)=10',
            'rn2(10)=4', 'rn2(10)=9', 'rn2(100)=20',
            'rn2(100)=31', 'rn2(80)=25', 'rn2(80)=19',
            'rn2(1000)=104', 'rn2(100)=40',
        ], 'seed0004 corroded-arrow wish RNG');
        assert.equal(decodedTopline(result.getScreens()[35]),
            'g - 2 corroded arrows.');
        assert.deepEqual(result.getCursors()[35], [52, 12, 1]);

        assertRngSliceExact(result.getRngSlices()[73], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=3', 'rnd(6)=5',
            'rn2(19)=15', 'rn2(2)=0', 'rn2(100)=84',
            'rn2(4)=2', 'rn2(3)=1', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(3)=1', 'rn2(5)=0', 'rn2(4)=0', 'rn2(5)=1',
            'rn2(12)=8', 'rn2(12)=0', 'rn2(12)=4', 'rn2(12)=4',
            'rn2(70)=61', 'rn2(20)=1', 'rn2(73)=29',
        ], 'seed0004 further-corrosion and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[73]),
            'The arrow hits the black pudding!  The arrow corrodes further!');
        assert.deepEqual(result.getCursors()[73], [52, 12, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 54,
            y: 11,
            hp: 31,
            hpmax: 37,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[54]?.[11] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 2,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.oeroded2 === 1);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            corrosion: inventoryArrows[0].oeroded2 ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            corrosion: 1,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0123 completely corroded arrow ignores further corrosion',
    async () => {
        const result = await runSegment({
            seed: 123,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 thoroughly corroded +2 arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgl  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 87);
        assertRngSliceExact(result.getRngSlices()[46], [
            'rn2(56)=7', 'rnd(2)=2', 'rn2(6)=1', 'rn2(11)=3',
            'rn2(10)=6', 'rn2(10)=5', 'rn2(100)=35',
            'rn2(100)=92', 'rn2(80)=33', 'rn2(80)=27',
            'rn2(1000)=315', 'rn2(100)=67',
        ], 'seed0123 completely-corroded wish RNG');
        assert.equal(decodedTopline(result.getScreens()[46]),
            'g - 2 thoroughly corroded arrows.');
        assert.deepEqual(result.getCursors()[46], [33, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[84], [
            'rnd(2)=1', 'rnd(2)=1', 'rnd(20)=1', 'rnd(6)=1',
            'rn2(19)=1', 'rn2(4)=0', 'rn2(100)=26',
            'rn2(4)=0', 'rn2(5)=3', 'rn2(5)=1', 'rn2(4)=3',
            'rn2(3)=0', 'rn2(3)=0', 'rn2(3)=2', 'rn2(3)=1',
            'rn2(5)=2', 'rn2(4)=1', 'rn2(5)=3', 'rn2(5)=2',
            'rn2(5)=3', 'rn2(4)=0', 'rn2(5)=3', 'rn2(5)=1',
            'rn2(12)=9', 'rn2(12)=4', 'rn2(12)=3', 'rn2(12)=11',
            'rn2(70)=40', 'rn2(400)=386', 'rn2(20)=13',
            'rn2(73)=68',
        ], 'seed0123 complete-corrosion no-op and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[84]),
            'The arrow hits the black pudding.');
        assert.deepEqual(result.getCursors()[84], [33, 19, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
            cancelled: pudding.mcan ?? 0,
        }, {
            x: 35,
            y: 18,
            hp: 42,
            hpmax: 43,
            peaceful: 0,
            cancelled: 0,
        });

        const floorArrows = (game.level.objects?.[35]?.[18] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 3,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.oeroded2 === 3);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            corrosion: inventoryArrows[0].oeroded2 ?? 0,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            corrosion: 3,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0015 greased arrow resists black-pudding corrosion and retains grease',
    async () => {
        const result = await runSegment({
            seed: 15,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgy  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 84);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(56)=55', 'rnd(2)=2', 'rn2(6)=2', 'rn2(11)=6',
            'rn2(10)=9', 'rn2(10)=2', 'rn2(100)=47',
            'rn2(100)=78', 'rn2(80)=56', 'rn2(80)=26',
            'rn2(1000)=770', 'rn2(100)=30',
        ], 'seed0015 greased-arrow corrosion wish RNG');
        assert.equal(decodedTopline(result.getScreens()[43]),
            'g - 2 greased arrows.');
        assert.deepEqual(result.getCursors()[43], [39, 18, 1]);

        assertRngSliceExact(result.getRngSlices()[81], [
            'rnd(2)=1', 'rnd(2)=2', 'rn2(7)=2', 'rnd(20)=6',
            'rnd(6)=4', 'rn2(19)=14', 'rn2(4)=1', 'rn2(2)=1',
            'rn2(100)=89', 'rn2(4)=3', 'rn2(3)=0', 'rn2(3)=2',
            'rn2(3)=0', 'rn2(3)=0', 'rn2(5)=2', 'rn2(4)=2',
            'rn2(5)=2', 'rn2(5)=2', 'rn2(5)=2', 'rnd(20)=4',
            'd(1,3)=1', 'rn2(3)=0', 'rn2(6)=0', 'rn2(12)=4',
            'rn2(12)=7', 'rn2(70)=7', 'rn2(100)=65',
            'rn2(400)=67', 'rn2(300)=223', 'rn2(20)=15',
            'rn2(70)=38',
        ], 'seed0015 retained grease and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[81]),
            'The arrow hits the black pudding!  The fox bites!');
        assert.deepEqual(result.getCursors()[81], [39, 18, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
        }, {
            x: 39,
            y: 16,
            hp: 39,
            hpmax: 45,
            peaceful: 0,
        });

        const floorArrows = (game.level.objects?.[39]?.[16] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            greased: floorArrows[0].greased ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            greased: true,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.greased);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            corrosion: inventoryArrows[0].oeroded2 ?? 0,
            greased: inventoryArrows[0].greased ?? false,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            greased: true,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0026 greased arrow resists black-pudding corrosion and loses grease',
    async () => {
        const result = await runSegment({
            seed: 26,
            datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:ricky,role:Ranger,race:human,gender:female,align:chaotic,playmode:debug\n'
                + 'OPTIONS=!autopickup\n'
                + 'OPTIONS=pettype:none\n'
                + 'OPTIONS=suppress_alert:3.4.3\n'
                + 'OPTIONS=symset:DECgraphics\n',
            moves: '  nx #wizwish\n2 uncursed greased +2 arrows\n'
                + '#wizgenesis\npeaceful black pudding\ntgu  ',
            storage: new Map(),
        });

        assert.equal(result.getScreens().length, 84);
        assertRngSliceExact(result.getRngSlices()[43], [
            'rn2(56)=53', 'rnd(2)=1', 'rn2(6)=2', 'rn2(11)=2',
            'rn2(10)=8', 'rn2(10)=3', 'rn2(100)=45',
            'rn2(100)=92', 'rn2(80)=25', 'rn2(80)=77',
            'rn2(1000)=83', 'rn2(100)=35',
        ], 'seed0026 greased-arrow corrosion wish RNG');
        assert.equal(decodedTopline(result.getScreens()[43]),
            'g - 2 greased arrows.');
        assert.deepEqual(result.getCursors()[43], [3, 19, 1]);

        assertRngSliceExact(result.getRngSlices()[81], [
            'rnd(2)=1', 'rnd(2)=1', 'rn2(7)=1', 'rnd(20)=7',
            'rnd(6)=6', 'rn2(19)=4', 'rn2(4)=1', 'rn2(2)=0',
            'rn2(100)=64', 'rn2(4)=3', 'rn2(3)=0', 'rn2(3)=1',
            'rn2(3)=0', 'rn2(3)=1', 'rn2(3)=1', 'rn2(3)=0',
            'rn2(5)=4', 'rn2(4)=0', 'rn2(5)=3', 'rn2(12)=4',
            'rn2(12)=10', 'rn2(12)=7', 'rn2(12)=7',
            'rn2(70)=49', 'rn2(200)=35', 'rn2(20)=6',
            'rn2(70)=22',
        ], 'seed0026 worn grease and scheduler RNG');
        assert.equal(decodedTopline(result.getScreens()[81]),
            'The arrow hits the black pudding!');
        assert.deepEqual(result.getCursors()[81], [3, 19, 1]);

        const pudding = game.level.monsters.find(monster =>
            monster.mnum === 209);
        assert.ok(pudding);
        assert.deepEqual({
            x: pudding.mx,
            y: pudding.my,
            hp: pudding.mhp,
            hpmax: pudding.mhpmax,
            peaceful: pudding.mpeaceful,
        }, {
            x: 5,
            y: 17,
            hp: 34,
            hpmax: 42,
            peaceful: 0,
        });

        const floorArrows = (game.level.objects?.[5]?.[17] || [])
            .filter(object => object.otyp === ARROW);
        assert.equal(floorArrows.length, 1);
        assert.deepEqual({
            quantity: floorArrows[0].quantity ?? floorArrows[0].quan,
            enchantment: floorArrows[0].spe ?? 0,
            corrosion: floorArrows[0].oeroded2 ?? 0,
            greased: floorArrows[0].greased ?? false,
            where: floorArrows[0].where,
        }, {
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            greased: false,
            where: 'floor',
        });

        const inventoryArrows = game.inventory.filter(object =>
            object.otyp === ARROW && object.greased);
        assert.equal(inventoryArrows.length, 1);
        assert.deepEqual({
            letter: inventoryArrows[0].invlet,
            quantity: inventoryArrows[0].quantity ?? inventoryArrows[0].quan,
            enchantment: inventoryArrows[0].spe ?? 0,
            corrosion: inventoryArrows[0].oeroded2 ?? 0,
            greased: inventoryArrows[0].greased ?? false,
        }, {
            letter: 'g',
            quantity: 1,
            enchantment: 2,
            corrosion: 0,
            greased: true,
        });
        assert.equal(game.context.move, 0);
    });

test('seed0360 quest tengu, travel getpos, and monster portal migration stay exact',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 400),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 384; index <= 399; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(result.getRngSlices()[384].length, 116);
        assert.equal(result.getRngSlices()[399].length, 875);
        assert.equal(
            decodedTopline(result.getScreens()[389]),
            'human wizard called wizard',
        );
        assert.equal(
            decodedTopline(result.getScreens()[395]),
            'unexplored area (no travel path)',
        );
        const portal = game.level.traps.find(trap =>
            trap.ttyp === MAGIC_PORTAL && trap.tx === 66 && trap.ty === 13);
        assert.ok(portal);
        const migratedWraith = game._migratingMonsters?.find(monster =>
            monster.mnum === 230
            && monster.migrationSource?.x === 66
            && monster.migrationSource?.y === 13);
        assert.ok(migratedWraith);
        assert.equal(migratedWraith.mconf, 1);
        assert.deepEqual(
            migratedWraith.migrationDestination,
            portal.dst,
        );
        assert.equal(game.level.monsters.includes(migratedWraith), false);
    });

test('seed0360 armor discovery and displaced monster targeting stay exact',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 511),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 457; index <= 510; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(
            decodedTopline(result.getScreens()[457]),
            's - a pair of padded gloves.',
        );
        assert.equal(
            decodedTopline(result.getScreens()[495]),
            'You finish your dressing maneuver.',
        );
        assert.equal(
            decodedTopline(result.getScreens()[497]),
            'You feel that monsters have difficulty pinpointing your location.--More--',
        );
        assert.equal(
            decodedTopline(result.getScreens()[498]),
            'You are now wearing a cloak of displacement.',
        );
        assert.equal(result.getRngSlices()[499].length, 103);
        assert.equal(result.getRngSlices()[500].length, 246);
        assert.equal(game.uarmg?.otyp, GAUNTLETS_OF_POWER);
        assert.equal(game.uarmc?.otyp, CLOAK_OF_DISPLACEMENT);
        assert.equal(game.u.acurr.a[0], 9);
        assert.equal(game._knownObjectTypes.has(GAUNTLETS_OF_POWER), true);
        assert.equal(game._knownObjectTypes.has(CLOAK_OF_DISPLACEMENT), true);
    });

test('seed0360 travel descriptions and apparent-target travel stop stay exact',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 545),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 511; index <= 544; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(
            decodedTopline(result.getScreens()[523]),
            'fog/vapor cloud',
        );
        assert.equal(
            decodedTopline(result.getScreens()[531]),
            'dark part of a room',
        );
        assert.equal(
            decodedTopline(result.getScreens()[539]),
            'stone (no travel path)',
        );
        assert.equal(result.getRngSlices()[527].length, 1056);
        assert.equal(result.getRngSlices()[543].length, 3001);
        assert.equal(
            decodedTopline(result.getScreens()[544]),
            'In what direction?',
        );
    });

test('seed0360 stone kicks and wounded-leg pager stay exact',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 597),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 545; index <= 596; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(
            decodedTopline(result.getScreens()[545]),
            'Ouch!  That hurts!',
        );
        assert.equal(result.getRngSlices()[545].length, 270);
        assert.equal(result.getRngSlices()[547].length, 97);
        assert.equal(
            decodedTopline(result.getScreens()[548]),
            'Your right leg is in no shape for kicking.--More--',
        );
        assert.equal(decodedTopline(result.getScreens()[570]), '');
        assert.equal(game.u.uhp, 131);
        assert.equal(game.u.acurr.a[1], 12);
        assert.equal(game.u._woundedLegSide, 'right');
        assert.ok(game.u._woundedLegTurns > 0);
    });

test('seed0360 airborne known-trap avoidance stays exact',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 624),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES = previousFixtureSetting;
        }

        for (let index = 597; index <= 623; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(result.getRngSlices()[597].length, 293);
        assert.equal(result.getRngSlices()[598].length, 111);
        assert.equal(game.u.uhp, 131);
        assert.equal(game.u.acurr.a[1], 12);
    });

test('seed0360 wizard mapping and quest-start getpos stay exact',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 667),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        for (let index = 624; index <= 667; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.deepEqual(result.getRngSlices()[624], ['rn2(19)=2']);
        assert.equal(decodedTopline(result.getScreens()[624]), '');
        assert.equal(
            decodedTopline(result.getScreens()[626]),
            'blocked staircase down (no travel path)',
        );
        assert.deepEqual(result.getCursors()[642], [26, 21, 1]);
        assert.equal(
            decodedTopline(result.getScreens()[661]),
            "Unknown direction: '^D' (use 'h', 'j', 'k', 'l' or '.').",
        );
        assert.equal(
            decodedTopline(result.getScreens()[665]),
            "Unknown direction: '^T' (use 'h', 'j', 'k', 'l' or '.').",
        );
    });

test('seed0360 Wiz-loca and filler generation preserve source order',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves.slice(0, 788),
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        for (let index = 668; index <= 788; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }

        assert.equal(result.getRngSlices()[668].length, 1093);
        assert.equal(result.getRngSlices()[671].length, 25);
        assert.equal(result.getRngSlices()[673].length, 648);
        assert.equal(result.getRngSlices()[680].length, 144);
        assert.equal(
            decodedTopline(result.getScreens()[668]),
            'A mysterious force prevents the tengu from teleporting!--More--',
        );
        assert.equal(
            decodedTopline(result.getScreens()[671]),
            'The quasit strikes at your displaced image and misses you!--More--',
        );
        assert.equal(
            decodedTopline(result.getScreens()[680]),
            'Sorry...  You materialize in a different location!',
        );
        assert.equal(
            decodedTopline(result.getScreens()[692]),
            '~        a doorway or the floor of a room or the dark part of a room or ice',
        );
        assert.deepEqual(result.getCursors()[692], [25, 1, 1]);
        assert.equal(decodedTopline(result.getScreens()[693]), '');
        assert.deepEqual(result.getCursors()[693], [23, 5, 1]);
        assert.equal(
            decodedTopline(result.getScreens()[696]),
            '~        a doorway or the floor of a room or the dark part of a room or ice',
        );
        assert.deepEqual(result.getCursors()[696], [25, 1, 1]);
        assert.equal(
            decodedTopline(result.getScreens()[714]),
            "Where do you want to travel to?  (For instructions type a '?')",
        );
        assert.deepEqual(result.getCursors()[714], [22, 6, 1]);
        assert.equal(
            decodedTopline(result.getScreens()[729]),
            "          Use 'h', 'j', 'k', 'l' to move the cursor to the desired destination.",
        );
        assert.deepEqual(result.getCursors()[729], [18, 16, 1]);
        assert.equal(
            decodedTopline(result.getScreens()[730]),
            'Move cursor to the desired destination:',
        );
        assert.deepEqual(result.getCursors()[730], [32, 10, 1]);
        assert.equal(decodedTopline(result.getScreens()[731]), '');
        assert.deepEqual(result.getCursors()[731], [22, 6, 1]);
        assert.equal(result.getRngSlices()[732].length, 85);
        for (const index of [737, 745]) {
            assert.equal(
                decodedTopline(result.getScreens()[index]),
                'A mysterious force prevents you from descending.',
            );
            assert.deepEqual(result.getCursors()[index], [22, 6, 1]);
            assert.equal(result.getRngSlices()[index].length, 0);
        }
        assert.equal(decodedTopline(result.getScreens()[760]), '');
        assert.deepEqual(result.getCursors()[760], [22, 6, 1]);
        assert.equal(result.getRngSlices()[760].length, 0);
        assert.equal(result.getRngSlices()[769].length, 46);
        assertRngSliceExact(
            result.getRngSlices()[780],
            session.steps[780].rng.map(call =>
                call.replace(/\s+@.*$/, '')),
            'seed0360 input 780 Wiz-loca generation RNG',
        );
        assert.equal(result.getRngSlices()[780].length, 1752);
        assert.equal(result.getRngSlices()[784].length, 1854);
        assert.equal(result.getRngSlices()[787].length, 1691);
        const stationaryVampireBatActions = (
            game._lastQuietMonsterActions || []
        ).filter(action =>
            action.mnum === 129
            && action.movement?.moved === false
        );
        assert.ok(stationaryVampireBatActions.length > 0);
        assert.equal(stationaryVampireBatActions.every(action =>
            action.movement?.phaseFourArmorClassEvaluated === true
        ), true);
        const wizStartLevel = [
            game.level,
            ...[...(game._levelCache?.values?.() || [])].map(
                entry => entry?.level,
            ),
        ].find(level => level?.monsters?.some(
            monster => monster.m_id === 3999,
        ));
        const wizStartMonsters = new Map(
            (wizStartLevel?.monsters || []).map(
                monster => [monster.m_id, monster],
            ),
        );
        assert.deepEqual(
            [
                wizStartMonsters.get(3999)?.permspeed,
                wizStartMonsters.get(3999)?.mspeed,
            ],
            [MFAST, MFAST],
        );
        assert.deepEqual(
            [
                wizStartMonsters.get(4010)?.permspeed,
                wizStartMonsters.get(4010)?.mspeed,
            ],
            [MFAST, MFAST],
        );
        assert.deepEqual(
            [
                wizStartMonsters.get(4014)?.permspeed,
                wizStartMonsters.get(4014)?.mspeed,
            ],
            [MFAST, MFAST],
        );
    });

test('seed0360 late quest tour preserves source order',
    async () => {
        const session = JSON.parse(fs.readFileSync(
            new URL('../sessions/seed0360-wizard-world-tour.session.json',
                import.meta.url),
            'utf8',
        )).segments[0];
        const previousFixtureSetting = process.env.TELEPORT_DISABLE_FIXTURES;
        process.env.TELEPORT_DISABLE_FIXTURES = '1';
        let result;
        try {
            result = await runSegment({
                ...session,
                moves: session.moves,
            });
        } finally {
            if (previousFixtureSetting === undefined)
                delete process.env.TELEPORT_DISABLE_FIXTURES;
            else
                process.env.TELEPORT_DISABLE_FIXTURES
                    = previousFixtureSetting;
        }

        for (let index = 789; index < session.steps.length; index++) {
            assertRngSliceExact(
                result.getRngSlices()[index],
                session.steps[index].rng.map(call =>
                    call.replace(/\s+@.*$/, '')),
                `seed0360 input ${index} RNG`,
            );
            assertScreenExact(
                result.getScreens()[index],
                session.steps[index].screen,
                `seed0360 input ${index} screen`,
            );
            assert.deepEqual(
                result.getCursors()[index],
                session.steps[index].cursor,
                `seed0360 input ${index} cursor`,
            );
        }
    });
