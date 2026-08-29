import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { decodeScreen } from '../frozen/screen-decode.mjs';
import {
    DART_TRAP, DOOR, D_BROKEN, FOUNTAIN, MFAST, ROOM, TRAPDOOR, VWALL,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    ARROW, BOULDER, BOW, CANDY_BAR, CORPSE, DART, GOLD_PIECE, OBJECT_NAMES,
    ROCK,
    SCR_BLANK_PAPER, WAN_SPEED_MONSTER, WAN_STRIKING,
} from '../js/object_data.js';
import { SCORE_RECORD_STORAGE_KEY } from '../js/end.js';
import { runSegment } from '../js/jsmain.js';
import {
    assertRngThrough, assertScreenExact,
} from './parity_assertions.js';

process.env.TELEPORT_DISABLE_FIXTURES = '1';

const tourist = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[0];
const fetchTourist = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[1];
const corpseStairTourist = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[2];
const descendingWizard = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[3];
const fetchWizard = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[4];
const pilePriest = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[5];
const eatingPriest = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[6];
const ponyPriest = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[7];
const delayedSamurai = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[8];
const bonesRestoringPriest = JSON.parse(fs.readFileSync(
    new URL('../sessions/seed0030-ten-diverse-deaths.session.json',
        import.meta.url),
    'utf8',
)).segments[9];

const seed0030PriorScores = [
    {
        points: 214, deathdnum: 2, deathlev: 4, maxlvl: 4,
        hp: 0, maxhp: 14,
        name: 'Elara', role: 'Pri', race: 'Hum', gender: 'Fem', align: 'Law',
        dungeon: 'The Gnomish Mines', outcome: 'died',
        death: 'killed by an arrow',
    },
    {
        points: 124, deathdnum: 2, deathlev: 3, maxlvl: 3,
        hp: 0, maxhp: 10,
        name: 'Quincy', role: 'Tou', race: 'Hum', gender: 'Mal', align: 'Neu',
        dungeon: 'The Gnomish Mines', outcome: 'died',
        death: 'killed by a gnome',
    },
    {
        points: 90, deathdnum: 0, deathlev: 2, maxlvl: 2,
        hp: 0, maxhp: 11,
        name: 'Beatrix', role: 'Wiz', race: 'Elf', gender: 'Fem', align: 'Cha',
        dungeon: 'The Dungeons of Doom', outcome: 'died',
        death: 'killed by Ms. Maganasipi; the shopkeeper',
    },
    {
        points: 74, deathdnum: 0, deathlev: 2, maxlvl: 2,
        hp: 0, maxhp: 11,
        name: 'Aleric', role: 'Wiz', race: 'Elf', gender: 'Mal', align: 'Cha',
        dungeon: 'The Dungeons of Doom', outcome: 'died',
        death: 'killed by a goblin',
    },
    {
        points: 70, deathdnum: 0, deathlev: 2, maxlvl: 2,
        hp: 0, maxhp: 16,
        name: 'Florian', role: 'Kni', race: 'Hum', gender: 'Mal', align: 'Law',
        dungeon: 'The Dungeons of Doom', outcome: 'died',
        death: 'killed by a wand',
    },
    {
        points: 62, deathdnum: 0, deathlev: 2, maxlvl: 2,
        hp: 0, maxhp: 11,
        name: 'Caspar', role: 'Wiz', race: 'Elf', gender: 'Mal', align: 'Cha',
        dungeon: 'The Dungeons of Doom', outcome: 'died',
        death: 'killed by a jackal',
    },
    {
        points: 58, deathdnum: 0, deathlev: 2, maxlvl: 2,
        hp: 0, maxhp: 10,
        name: 'Brigid', role: 'Tou', race: 'Hum', gender: 'Fem', align: 'Neu',
        dungeon: 'The Dungeons of Doom', outcome: 'died',
        death: 'killed by a small mimic',
    },
];

test('seed0030 kitten splits one coin from a seven-coin floor stack',
    async () => {
        const lastStep = 7;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        const kitten = game.level.monsters.find(monster => monster.mnum === 32);
        const carriedGold = kitten.minvent.find(
            object => object.otyp === GOLD_PIECE,
        );
        assert.equal(carriedGold.quan, 1);

        const floorGold = game.level.objects.flatMap(column =>
            (column || []).flatMap(pile => pile || []))
            .filter(object => object.otyp === GOLD_PIECE);
        assert.ok(floorGold.some(object => object.quan === 6));
    });

test('seed0030 long engraving pages before the next command turn',
    async () => {
        const lastStep = 25;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }
    });

test('seed0030 descent builds the Teleportation hub in both Lua phases',
    async () => {
        // Step 28 is the descent pager while ordinaryDescend() deliberately
        // keeps game.level on the source floor.  The acknowledging input
        // commits the already-generated destination before step 29.  Its
        // actor turn is the next parity block, so this regression owns exact
        // replay only through the complete input-28 generation transaction.
        const replayStep = 29;
        const exactStep = 28;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, replayStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, exactStep, 'seed0030 segment 0');
        for (let step = 0; step <= exactStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        const hubTraps = game.level.traps.filter(trap =>
            trap.ttyp === 15 && trap.tseen && trap.teledest);
        assert.equal(hubTraps.length, 2);
        for (const trap of hubTraps) {
            assert.notEqual(trap.tx, trap.teledest.x);
            assert.notEqual(trap.ty, trap.teledest.y);
        }
    });

test('seed0030 newt corpse rebuilds a timer after temporary lichen identity',
    async () => {
        const lastStep = 29;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        const newtCorpses = game.level.objects.flatMap(column =>
            (column || []).flatMap(pile => pile || []))
            .filter(object =>
                object.otyp === CORPSE && object.corpsenm === 322);
        assert.equal(newtCorpses.length, 1);
        assert.ok(Number.isInteger(newtCorpses[0].rotAt));
    });

test('seed0030 kitten resumes corpse consumption after the kill pager',
    async () => {
        const lastStep = 30;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        const newtCorpses = game.level.objects.flatMap(column =>
            (column || []).flatMap(pile => pile || []))
            .filter(object =>
                object.otyp === CORPSE && object.corpsenm === 322);
        assert.equal(newtCorpses.length, 0);
        const kitten = game.level.monsters.find(monster => monster.mnum === 32);
        assert.ok(kitten.meating > 0);
    });

test('seed0030 unseen falling-rock trap kills its dwarf before actor tail',
    async () => {
        const lastStep = 49;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        assert.equal(game.level.monsters.some(monster =>
            monster.mnum === 44 && monster.mx === 27 && monster.my === 6),
        false);
        const pile = game.level.objects[27][6];
        assert.equal(pile.filter(object =>
            object.otyp === CORPSE && object.corpsenm === 44).length, 1);
        assert.equal(pile.filter(object => object.otyp === ROCK)
            .reduce((total, object) =>
                total + (object.quan ?? object.quantity ?? 1), 0), 8);
    });

test('seed0030 sleeping potion impact suspends before its vapor effect',
    async () => {
        const lastStep = 50;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        assert.equal(game.u.uhp, 4);
        assert.equal(game.level.monsters.some(monster =>
            (monster.minvent || monster.inventory || [])
                .some(object => object.otyp === 314)), false);
    });

test('seed0030 sleeping vapor owns two helpless turns and recovery',
    async () => {
        const lastStep = 52;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assert.deepEqual(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        assert.equal(game._helplessTurns, 0);
        assert.equal(game._helplessReason, null);
        assert.equal(game._pendingOffensivePotionEffect, null);
    });

test('seed0030 ordinary death rejects bones and skips disabled disclosures',
    async () => {
        const lastStep = 78;
        const result = await runSegment({
            ...tourist,
            moves: tourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, tourist, lastStep, 'seed0030 segment 0');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(tourist.steps[step].screen),
                `seed0030 segment 0 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                tourist.steps[step].cursor,
                `seed0030 segment 0 cursor ${step}`,
            );
        }

        assert.equal(game._canMakeBones, false);
        assert.equal(game.program_state.gameover, true);
    });

test('seed0030 segment1 pet evaluates reachable MANFOOD without sight',
    async () => {
        const lastStep = 10;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }
    });

test('seed0030 segment1 ambient kobold runs its weapon initializer',
    async () => {
        const lastStep = 31;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        const kobold = game.level.monsters.find(monster =>
            monster.mnum === 59 && monster.mx === 66 && monster.my === 14);
        assert.ok(kobold);
        assert.deepEqual(kobold.minvent, []);
    });

test('seed0030 segment1 zero-damage lichen public replay stays exact',
    async () => {
        const lastStep = 35;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

    });

test('seed0030 segment1 kitten leaves a vegan lichen corpse uneaten',
    async () => {
        const lastStep = 39;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        const lichenCorpse = game.level.objects.flatMap(column =>
            (column || []).flatMap(pile => pile || []))
            .find(object => object.otyp === CORPSE
                && object.corpsenm === 158);
        assert.ok(lichenCorpse);
        const kitten = game.level.monsters.find(monster => monster.mnum === 32);
        assert.equal(kitten.meating ?? 0, 0);
    });

test('seed0030 segment1 visible combat maps its unspotted aggressor',
    async () => {
        const lastStep = 50;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        const marker = game.level.at(50, 4)?.remembered_glyph;
        assert.equal(marker?.kind, 'invisible');
        assert.equal(marker.ch, 'I');
    });

test('seed0030 segment1 grid bug death skips forbidden corpse construction',
    async () => {
        const lastStep = 55;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        const pile = game.level.objects?.[52]?.[3] || [];
        assert.equal(pile.some(object =>
            object.otyp === CORPSE && object.corpsenm === 116), false);
        assert.ok(result.getRngSlices()[55].includes('rnd(1)=1'));
    });

test('seed0030 segment1 default themed-fill room dispatches Storeroom',
    async () => {
        const lastStep = 59;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        const generationSlice = result.getRngSlices()[59];
        assert.deepEqual(
            generationSlice.slice(41, 54).map(call =>
                call.replace(/=.*$/, '')),
            Array.from({ length: 13 }, (_, index) => `rn2(${index + 1})`),
        );
    });

test('seed0030 segment1 movement reveals the disguised chest mimic',
    async () => {
        const lastStep = 92;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        // Terminal column/row `(39,8)` is internal map coordinate `(40,7)`.
        const mimic = game.u.ustuck;
        assert.ok(mimic);
        assert.equal(mimic.mnum, 64);
        assert.equal(mimic.mx, 40);
        assert.equal(mimic.my, 7);
        assert.equal(mimic.m_ap_type, 0);
        assert.equal(mimic.mappearance, 0);
    });

test('seed0030 segment1 ambient guard sound suspends after mimic combat',
    async () => {
        const lastStep = 95;
        const result = await runSegment({
            ...fetchTourist,
            moves: fetchTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(result, fetchTourist, lastStep, 'seed0030 segment 1');
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchTourist.steps[step].screen),
                `seed0030 segment 1 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchTourist.steps[step].cursor,
                `seed0030 segment 1 cursor ${step}`,
            );
        }

        assert.equal(result.getRngSlices()[95].length, 29);
        assert.equal(game.nhDisplay.cursorCol, 33);
        assert.equal(game.nhDisplay.cursorRow, 0);
    });

test('seed0030 segment2 look_here composes staircase and corpse',
    async () => {
        const lastStep = 22;
        const result = await runSegment({
            ...corpseStairTourist,
            moves: corpseStairTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, corpseStairTourist, lastStep, 'seed0030 segment 2',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(corpseStairTourist.steps[step].screen),
                `seed0030 segment 2 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                corpseStairTourist.steps[step].cursor,
                `seed0030 segment 2 cursor ${step}`,
            );
        }

        assert.equal(game.u.ux, game.level.dnstair.x);
        assert.equal(game.u.uy, game.level.dnstair.y);
        const objects = game.level.objects?.[game.u.ux]?.[game.u.uy] || [];
        assert.equal(objects.length, 1);
        assert.equal(objects[0].otyp, CORPSE);
        assert.equal(objects[0].corpsenm, 59);
    });

test('seed0030 segment2 kobold corpse enters poisonous meal branch',
    async () => {
        const lastStep = 24;
        const result = await runSegment({
            ...corpseStairTourist,
            moves: corpseStairTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, corpseStairTourist, lastStep, 'seed0030 segment 2',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(corpseStairTourist.steps[step].screen),
                `seed0030 segment 2 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                corpseStairTourist.steps[step].cursor,
                `seed0030 segment 2 cursor ${step}`,
            );
        }

        assert.deepEqual(
            result.getRngSlices()[24].slice(0, 4),
            ['rn2(20)=14', 'rn2(5)=3', 'rnd(4)=4', 'rnd(15)=3'],
        );
        assert.equal(game.u.acurr.a[0], 4);
        assert.equal(game._occupation?.key, 'eat-corpse');
        assert.equal(
            game._occupation?.finishMessage,
            'You finish eating the kobold corpse.',
        );
    });

test('seed0030 segment2 goblin completes an on-square item goal before moving',
    async () => {
        const lastStep = 37;
        const result = await runSegment({
            ...corpseStairTourist,
            moves: corpseStairTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, corpseStairTourist, lastStep, 'seed0030 segment 2',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(corpseStairTourist.steps[step].screen),
                `seed0030 segment 2 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                corpseStairTourist.steps[step].cursor,
                `seed0030 segment 2 cursor ${step}`,
            );
        }

        const glassGoblin = game.level.monsters.find(monster =>
            monster.mnum === 70
            && (monster.minvent || []).some(object =>
                OBJECT_NAMES[object.otyp] ===
                    'worthless piece of black glass'
                && object.quan === 2));
        assert.ok(glassGoblin);
        assert.equal(glassGoblin.mx, 21);
        assert.equal(glassGoblin.my, 7);
        assert.ok(!(game.level.objects?.[20]?.[8] || []).some(object =>
            OBJECT_NAMES[object.otyp] === 'worthless piece of black glass'));
    });

test('seed0030 segment2 force-fights thin air through shared movement',
    async () => {
        const lastStep = 59;
        const result = await runSegment({
            ...corpseStairTourist,
            moves: corpseStairTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, corpseStairTourist, lastStep, 'seed0030 segment 2',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(corpseStairTourist.steps[step].screen),
                `seed0030 segment 2 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                corpseStairTourist.steps[step].cursor,
                `seed0030 segment 2 cursor ${step}`,
            );
        }

        assert.equal(game.u.ux, 55);
        assert.equal(game.u.uy, 4);
        assert.equal(game.context.forcefight, false);
        assert.equal(
            game.level.at(56, 4)?.remembered_glyph?.kind,
            'terrain',
        );
    });

test('seed0030 segment2 thin-air attack repaints following overkill',
    async () => {
        const lastStep = 79;
        const result = await runSegment({
            ...corpseStairTourist,
            moves: corpseStairTourist.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, corpseStairTourist, lastStep, 'seed0030 segment 2',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(corpseStairTourist.steps[step].screen),
                `seed0030 segment 2 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                corpseStairTourist.steps[step].cursor,
                `seed0030 segment 2 cursor ${step}`,
            );
        }

        assert.equal(game.u.uhp, 0);
        assert.equal(game._statusHpOverride, undefined);
        assert.equal(game._heroMeleeThisCommand, true);
        assert.equal(
            game._pending_message,
            'You attack thin air.  The goblin hits!--More--',
        );
    });

test('seed0030 segment3 Z-shaped room rejects its obstructed east wall',
    async () => {
        const exactStep = 72;
        const replayStep = 73;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, replayStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, exactStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= exactStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }

        assert.equal(game.u.uz.dlevel, 2);
        assert.equal(game.level.rooms[1].irregular, true);
        assert.equal(game.level.at(27, 6)?.typ, DOOR);
        assert.notEqual(game.level.at(27, 10)?.typ, DOOR);
    });

test('seed0030 segment3 shopkeeper uses its speed wand before movement',
    async () => {
        const lastStep = 273;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, lastStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        const speedWand = shopkeeper?.minvent?.find(
            object => object.otyp === WAN_SPEED_MONSTER,
        );
        assert.ok(shopkeeper);
        assert.equal(shopkeeper.mx, 10);
        assert.equal(shopkeeper.my, 8);
        assert.equal(shopkeeper.permspeed, MFAST);
        assert.equal(shopkeeper.mspeed, MFAST);
        assert.equal(speedWand?.spe, 7);
    });

test('seed0030 segment3 shop entry preserves recorder time and door avoidance',
    async () => {
        const lastStep = 277;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, lastStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        assert.ok(shopkeeper);
        assert.equal(shopkeeper.eshk?.shknam, 'Maganasipi');
        assert.deepEqual([shopkeeper.mx, shopkeeper.my], [9, 10]);
    });

test('seed0030 segment3 missed shopkeeper attack angers before monster scan',
    async () => {
        const lastStep = 280;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, lastStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        assert.ok(shopkeeper);
        assert.equal(shopkeeper.eshk?.shknam, 'Maganasipi');
        assert.equal(shopkeeper.mpeaceful, 0);
    });

test('seed0030 segment3 striking wand resumes after the anger pager',
    async () => {
        const lastStep = 284;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, lastStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        const strikingWand = shopkeeper?.minvent?.find(
            object => object.otyp === WAN_STRIKING,
        );
        assert.ok(shopkeeper);
        assert.equal(strikingWand?.spe, 5);
        assert.equal(shopkeeper.seenMagicResistance, true);
        assert.equal(shopkeeper.mwandexp, true);
        assert.equal(game._knownObjectTypes?.has(WAN_STRIKING), true);
    });

test('seed0030 segment3 fatal shop settlement precedes the death pager',
    async () => {
        const lastStep = 286;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, lastStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }

        const settlement = game._deathShopSettlement;
        assert.equal(settlement?.taken, true);
        assert.equal(settlement?.shopkeeper?.eshk?.shknam, 'Maganasipi');
        assert.deepEqual(settlement?.repository, { x: 9, y: 9 });
        assert.equal(settlement?.shopkeeper?.eshk?.billct, 0);
        assert.equal(settlement?.inventoryRetainedForDisclosure, true);
        assert.equal(game.inventory?.length, 16);
    });

test('seed0030 segment3 named shopkeeper killer reaches the tombstone',
    async () => {
        const lastStep = 287;
        const result = await runSegment({
            ...descendingWizard,
            moves: descendingWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, descendingWizard, lastStep, 'seed0030 segment 3',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(descendingWizard.steps[step].screen),
                `seed0030 segment 3 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                descendingWizard.steps[step].cursor,
                `seed0030 segment 3 cursor ${step}`,
            );
        }
    });

test('seed0030 segment4 stationary pet postmov remembers its silent drop',
    async () => {
        const lastStep = 8;
        const result = await runSegment({
            ...fetchWizard,
            moves: fetchWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, fetchWizard, lastStep, 'seed0030 segment 4',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchWizard.steps[step].screen),
                `seed0030 segment 4 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchWizard.steps[step].cursor,
                `seed0030 segment 4 cursor ${step}`,
            );
        }

        const pile = game.level.objects?.[51]?.[3] || [];
        assert.equal(pile.length, 1);
        assert.equal(pile[0].otyp, SCR_BLANK_PAPER);
        assert.equal(game.level.at(51, 3)?.remembered_glyph?.kind, 'object');
        assert.equal(game.level.at(51, 3)?.remembered_glyph?.ch, '?');
    });

test('seed0030 segment4 fountain yes clears prompt before tepid result',
    async () => {
        const lastStep = 46;
        const result = await runSegment({
            ...fetchWizard,
            moves: fetchWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, fetchWizard, lastStep, 'seed0030 segment 4',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchWizard.steps[step].screen),
                `seed0030 segment 4 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchWizard.steps[step].cursor,
                `seed0030 segment 4 cursor ${step}`,
            );
        }

        assert.equal(game.u.ux, 72);
        assert.equal(game.u.uy, 6);
        assert.equal(game.level.at(72, 6)?.typ, FOUNTAIN);
        assert.equal(game._pending_message, 'This tepid water is tasteless.');
    });

test('seed0030 segment4 first-contact overkill retains painted HP',
    async () => {
        const lastStep = 190;
        const result = await runSegment({
            ...fetchWizard,
            moves: fetchWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, fetchWizard, lastStep, 'seed0030 segment 4',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchWizard.steps[step].screen),
                `seed0030 segment 4 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchWizard.steps[step].cursor,
                `seed0030 segment 4 cursor ${step}`,
            );
        }

        assert.equal(game.u.uhp, 0);
        assert.equal(game._statusHpOverride, 1);
        assert.equal(game._pending_message, 'The jackal bites!--More--');
    });

test('seed0030 segment4 branch death carries painted HP past contact',
    async () => {
        const lastStep = 192;
        const result = await runSegment({
            ...fetchWizard,
            moves: fetchWizard.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, fetchWizard, lastStep, 'seed0030 segment 4',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(fetchWizard.steps[step].screen),
                `seed0030 segment 4 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                fetchWizard.steps[step].cursor,
                `seed0030 segment 4 cursor ${step}`,
            );
        }

        assert.equal(game.u.uhp, 0);
        assert.equal(game._statusHpOverride, 1);
        assert.equal(game._canMakeBones, false);
        assert.equal(game._pending_message, 'You die...--More--');
    });

test('seed0030 segment5 priest floor naming observes cursed candy bar',
    async () => {
        const lastStep = 2;
        const result = await runSegment({
            ...pilePriest,
            moves: pilePriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, pilePriest, lastStep, 'seed0030 segment 5',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(pilePriest.steps[step].screen),
                `seed0030 segment 5 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                pilePriest.steps[step].cursor,
                `seed0030 segment 5 cursor ${step}`,
            );
        }

        const pile = game.level.objects?.[74]?.[4] || [];
        const candy = pile.find(object => object.otyp === CANDY_BAR);
        const corpse = pile.find(object => object.otyp === CORPSE);
        const darts = pile.find(object => object.otyp === DART);
        assert.ok(candy?.cursed);
        assert.equal(candy.bknown, true);
        assert.equal(candy.buc, 'cursed');
        assert.equal(corpse?.bknown, true);
        assert.equal(corpse?.buc, undefined);
        assert.equal(darts?.bknown, true);
        assert.equal(darts?.buc, undefined);
    });

test('seed0030 segment5 ordinary priest allocates every live monster',
    async () => {
        const lastStep = 5;
        const result = await runSegment({
            ...pilePriest,
            moves: pilePriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, pilePriest, lastStep, 'seed0030 segment 5',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(pilePriest.steps[step].screen),
                `seed0030 segment 5 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                pilePriest.steps[step].cursor,
                `seed0030 segment 5 cursor ${step}`,
            );
        }

        assert.deepEqual(
            game._lastMonsterAllocations?.map(allocation => ({
                mnum: allocation.mnum,
                pet: allocation.pet,
                amount: allocation.amount,
            })),
            [
                { mnum: 16, pet: true, amount: 24 },
                { mnum: 116, pet: false, amount: 12 },
                { mnum: 239, pet: false, amount: 12 },
                { mnum: 158, pet: false, amount: 0 },
                { mnum: 12, pet: false, amount: 12 },
            ],
        );

        const pile = game.level.objects?.[74]?.[4] || [];
        const trapDart = pile.find(object =>
            object.otyp === DART && object.quan === 1);
        assert.equal(trapDart?.spe, 1);
        assert.equal(trapDart?.blessed, true);
        assert.equal(trapDart?.opoisoned, 0);
    });

test('seed0030 segment5 missed trap dart leads pet to glass wand',
    async () => {
        const lastStep = 6;
        const result = await runSegment({
            ...pilePriest,
            moves: pilePriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, pilePriest, lastStep, 'seed0030 segment 5',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(pilePriest.steps[step].screen),
                `seed0030 segment 5 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                pilePriest.steps[step].cursor,
                `seed0030 segment 5 cursor ${step}`,
            );
        }

        const trapPile = game.level.objects?.[74]?.[4] || [];
        const trapDart = trapPile.find(object =>
            object.otyp === DART && object.quan === 1);
        assert.ok(Number.isFinite(trapDart?._fobjOrder));
        assert.equal(game.startingPet?.mx, 74);
        assert.equal(game.startingPet?.my, 5);
        assert.equal(game.startingPet?.movement, 24);
        assert.deepEqual(
            (game.startingPet?.minvent || []).map(object => object.otyp),
            [429],
        );
        assert.ok(!(game.level.objects?.[75]?.[6] || [])
            .some(object => object.otyp === 429));
    });

test('seed0030 segment5 hears unspotted monster behind boulder',
    async () => {
        const lastStep = 51;
        const result = await runSegment({
            ...pilePriest,
            moves: pilePriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, pilePriest, lastStep, 'seed0030 segment 5',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(pilePriest.steps[step].screen),
                `seed0030 segment 5 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                pilePriest.steps[step].cursor,
                `seed0030 segment 5 cursor ${step}`,
            );
        }

        assert.equal(game.u.ux, 32);
        assert.equal(game.u.uy, 10);
        assert.ok((game.level.objects?.[31]?.[10] || [])
            .some(object => object.otyp === BOULDER));
        assert.ok(game.level.monsters.some(monster =>
            monster.mnum === 12 && monster.mx === 30 && monster.my === 10));
        assert.equal(
            game.level.at(30, 10)?.remembered_glyph?.kind,
            'invisible',
        );
    });

test('seed0030 segment5 boulder push clears destination invisible memory',
    async () => {
        const lastStep = 78;
        const result = await runSegment({
            ...pilePriest,
            moves: pilePriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, pilePriest, lastStep, 'seed0030 segment 5',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(pilePriest.steps[step].screen),
                `seed0030 segment 5 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                pilePriest.steps[step].cursor,
                `seed0030 segment 5 cursor ${step}`,
            );
        }

        assert.equal(game.u.ux, 31);
        assert.equal(game.u.uy, 10);
        const targetPile = game.level.objects?.[30]?.[10] || [];
        assert.equal(targetPile[0]?.otyp, BOULDER);
        assert.equal(
            game.level.at(30, 10)?.remembered_glyph?.kind,
            'object',
        );
        assert.equal(game.level.at(30, 10)?.remembered_glyph?.ch, '`');
    });

test('seed0030 segment6 T-shaped rot3 preserves its right-hand corridor arm',
    async () => {
        // Input 22 is the descent pager.  Replay its acknowledgment to expose
        // the already-generated destination, but keep parity ownership bounded
        // to the complete generation transaction through input 22.
        const exactStep = 22;
        const replayStep = 23;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, replayStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, exactStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= exactStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        const room = game.level.rooms[2];
        assert.equal(game.u.uz.dlevel, 2);
        assert.equal(room?.irregular, true);
        assert.deepEqual(
            [room?.lx, room?.ly, room?.hx, room?.hy],
            [24, 8, 29, 16],
        );
        assert.equal(game.level.at(26, 16)?.typ, VWALL);
        assert.equal(game.level.at(27, 16)?.typ, ROOM);
        assert.equal(game.level.at(30, 16)?.typ, DOOR);
    });

test('seed0030 segment6 pet eating postmov clears consumed corpse memory',
    async () => {
        const lastStep = 30;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, lastStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        assert.deepEqual(game.level.objects?.[38]?.[9] || [], []);
        assert.equal(game.startingPet?.mx, 38);
        assert.equal(game.startingPet?.my, 9);
        assert.equal(game.startingPet?.meating, 2);
        assert.equal(
            game.level.at(38, 9)?.remembered_glyph?.kind,
            'terrain',
        );
    });

test('seed0030 segment6 Fake Delphi preserves failed fixed-room transaction',
    async () => {
        // Input 56 is the descent pager.  Its acknowledgment commits the
        // already-generated destination before input 57; replay that one
        // extra key, but keep parity ownership bounded to the generation
        // transaction through input 56.
        const replayStep = 57;
        const exactStep = 56;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, replayStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, exactStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= exactStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        const outer = game.level.rooms
            .slice(0, game.level.nroom)
            .find(room => room.hx - room.lx + 1 === 11
                && room.hy - room.ly + 1 === 9
                && (room.sbrooms || []).some(subroom =>
                    subroom.hx - subroom.lx + 1 === 3
                    && subroom.hy - subroom.ly + 1 === 3
                    && subroom.lx === room.lx + 4
                    && subroom.ly === room.ly + 3));
        assert.equal(game.u.uz.dlevel, 3);
        assert.equal(outer, undefined);
    });

test('seed0030 segment6 look_here composes broken door and rat corpse',
    async () => {
        const lastStep = 86;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, lastStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        assert.notEqual(game.flags?.mention_decor, true);
        assert.equal(game.u.uz.dlevel, 3);
        assert.equal(game.u.ux, 37);
        assert.equal(game.u.uy, 12);
        const loc = game.level.at(game.u.ux, game.u.uy);
        assert.equal(loc?.typ, DOOR);
        assert.equal(loc?.doormask, D_BROKEN);
        const objects = game.level.objects?.[game.u.ux]?.[game.u.uy] || [];
        assert.equal(objects.length, 1);
        assert.equal(objects[0].otyp, CORPSE);
        assert.equal(objects[0].corpsenm, 89);
    });

test('seed0030 segment6 giant rat migrates through the trap door',
    async () => {
        const lastStep = 118;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, lastStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        const trap = game.level.traps.find(candidate =>
            candidate.ttyp === TRAPDOOR
            && candidate.tx === 45 && candidate.ty === 12);
        assert.ok(trap);
        const rat = game._migratingMonsters?.find(monster =>
            monster.mnum === 89
            && monster.migrationSource?.x === 45
            && monster.migrationSource?.y === 12);
        assert.ok(rat);
        assert.equal(game.level.monsters.includes(rat), false);
        assert.equal(rat.migrationMode, 'random');
        assert.deepEqual(rat.migrationDestination, trap.dst);
        assert.deepEqual(rat.migrationDestination, { dnum: 0, dlevel: 4 });
        assert.notEqual(rat.mconf, 1);
    });

test('seed0030 segment6 unseen gnome triggers the dart trap before combat',
    async () => {
        const lastStep = 165;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, lastStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        const trap = game.level.traps.find(candidate =>
            candidate.ttyp === DART_TRAP
            && candidate.tx === 19 && candidate.ty === 10);
        assert.ok(trap);
        assert.equal(trap.once, true);
        const gnome = game.level.monsters.find(monster =>
            monster.mnum === 165 && monster.mx === 19 && monster.my === 10);
        assert.ok(gnome);
        assert.equal(gnome.mnum, 165);
        assert.equal(gnome.mx, 19);
        assert.equal(gnome.my, 10);
        assert.equal(gnome.mhp, 2);
        assert.notEqual((gnome.mtrapseen ?? 0) & (1 << (DART_TRAP - 1)), 0);
        assert.equal(game.u.uhp, 9);
        assert.equal(
            (game.level.objects?.[19]?.[10] || [])
                .some(object => object.otyp === DART),
            false,
        );

    });

test('seed0030 segment6 bow carrier shoots an arrow with native grammar',
    async () => {
        const lastStep = 175;
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, eatingPriest, lastStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        assert.ok(result.getScreens()[174]
            .includes('The gnome shoots an arrow!--More--'));
        assert.ok(result.getScreens()[175]
            .includes('You are hit by an arrow.'));
        const archer = game.level.monsters.find(monster =>
            monster.m_id === 240);
        assert.ok(archer);
        assert.equal(archer.mw?.otyp, BOW);
        assert.equal(archer.mw?.wielded, true);
        const arrows = (archer.minvent || archer.inventory || [])
            .find(object => object.otyp === ARROW);
        assert.ok(arrows);
        assert.equal(arrows.quan ?? arrows.quantity, 4);
        const landedArrow = (game.level.objects?.[game.u.ux]?.[game.u.uy]
            || []).find(object => object.otyp === ARROW);
        assert.ok(landedArrow);
        assert.equal(landedArrow.o_id, 272);
        assert.equal(landedArrow.spe, 1);
        assert.equal(landedArrow.blessed, true);
        assert.equal(landedArrow.where, 'floor');
        assert.equal(game.u.uhp, 8);
    });

test('seed0030 segment6 enchanted arrow enters fatal losehp pager',
    async () => {
        const lastStep = 247;
        const storage = new Map();
        const result = await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, lastStep),
            storage,
        });

        assertRngThrough(
            result, eatingPriest, lastStep, 'seed0030 segment 6',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(eatingPriest.steps[step].screen),
                `seed0030 segment 6 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                eatingPriest.steps[step].cursor,
                `seed0030 segment 6 cursor ${step}`,
            );
        }

        assert.ok(result.getScreens()[238]
            .includes('You are hit by an arrow!'));
        assert.ok(result.getScreens()[240].includes('HP:4(14)'));
        assert.ok(result.getScreens()[241]
            .includes('You are hit by an arrow!--More--'));
        assert.ok(result.getScreens()[244].includes('You die...--More--'));
        assert.ok(result.getScreens()[247]
            .includes('You were level 1 with a maximum of 14 hit points when you died.'));
        assert.equal(game._bonesSaved, true);

        const level = game.u.uz;
        const payload = JSON.parse(storage.get(
            `teleport-bones:${level.dnum}:${level.dlevel}`,
        ));
        const floorObjects = payload.level.objects.flatMap(column =>
            (column || []).flatMap(pile => pile || []));
        const arrows = floorObjects
            .filter(object => object.otyp === ARROW)
            .map(object => ({
                x: object.ox,
                y: object.oy,
                quantity: object.quan ?? object.quantity,
                spe: object.spe,
                blessed: !!object.blessed,
            }))
            .sort((a, b) => a.x - b.x || a.y - b.y);
        assert.equal(floorObjects.length, 20);
        assert.deepEqual(arrows, [
            { x: 28, y: 12, quantity: 1, spe: 1, blessed: true },
            { x: 29, y: 13, quantity: 3, spe: 1, blessed: true },
        ]);
        const savedDwarf = payload.level.monsters.find(monster =>
            monster.m_id === 245);
        assert.ok(savedDwarf);
        assert.equal(savedDwarf.mpeaceful, 1);
    });

test('seed0030 segment9 preserves raw extended-command input through input451',
    async () => {
        const storage = new Map();
        await runSegment({
            ...eatingPriest,
            moves: eatingPriest.moves.slice(0, 247),
            storage,
        });

        const lastStep = 451;
        const result = await runSegment({
            ...bonesRestoringPriest,
            moves: bonesRestoringPriest.moves.slice(0, lastStep),
            storage,
        });

        assertRngThrough(
            result, bonesRestoringPriest, lastStep, 'seed0030 segment 9',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(bonesRestoringPriest.steps[step].screen),
                `seed0030 segment 9 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                bonesRestoringPriest.steps[step].cursor,
                `seed0030 segment 9 cursor ${step}`,
            );
        }

        const restoredDwarf = game.level.monsters.find(monster =>
            monster.m_id === 245);
        assert.ok(restoredDwarf);
        assert.equal(restoredDwarf.mpeaceful, 0);
        assert.equal(restoredDwarf.malign, 4);
        const restoredGhost = game.level.monsters.find(monster =>
            monster.m_id === 279);
        assert.ok(restoredGhost);
        assert.equal(restoredGhost.msleeping, 1);
    });

test('seed0030 segment7 pony kick uses monster-combat default hit verb',
    async () => {
        const lastStep = 28;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep, 'seed0030 segment 7',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 cursor ${step}`,
            );
        }

    });

test('seed0030 segment7 ordinary lichen retains its species article',
    async () => {
        const lastStep = 45;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep, 'seed0030 segment 7 lichen article',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 lichen screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 lichen cursor ${step}`,
            );
        }
    });

test('seed0030 segment7 ambient birth rejects the boulder coordinate',
    async () => {
        const lastStep = 136;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep, 'seed0030 segment 7 ambient birth',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 ambient birth screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 ambient birth cursor ${step}`,
            );
        }

        assert.equal(
            game.level.monsters.some(monster =>
                monster.mx === 47 && monster.my === 13),
            false,
        );
        assert.equal(game._lastRandomMonsterGeneration?.mnum, 322);
    });

test('seed0030 segment7 liquor shopkeeper keeps deterministic identity',
    async () => {
        const lastStep = 149;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep, 'seed0030 segment 7 shopkeeper name',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 shopkeeper name screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 shopkeeper name cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        assert.equal(shopkeeper?.eshk?.shknam, 'Swidnica');
        assert.equal(shopkeeper?.eshk?.shoptype, 17);
    });

test('seed0030 segment7 shopkeeper first striking shot misses after pager',
    async () => {
        const lastStep = 153;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep, 'seed0030 segment 7 striking wand',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 striking wand screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 striking wand cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        const wand = shopkeeper?.minvent?.find(object => object.otyp === 417);
        assert.equal(wand?.spe, 4);
        assert.equal(shopkeeper?.mwandexp, true);
        assert.equal(!!shopkeeper?.seenMagicResistance, false);
        assert.equal(game._knownObjectTypes?.has(417) ?? false, false);
    });

test('seed0030 segment7 experienced striking shots miss then hit',
    async () => {
        const lastStep = 156;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep,
            'seed0030 segment 7 experienced striking wand',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 experienced wand screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 experienced wand cursor ${step}`,
            );
        }

        const shopkeeper = game.level.monsters.find(monster => monster.isshk);
        const wand = shopkeeper?.minvent?.find(object => object.otyp === 417);
        assert.equal(wand?.spe, 2);
        assert.equal(shopkeeper?.mwandexp, true);
        assert.equal(!!shopkeeper?.seenMagicResistance, false);
        assert.equal(game._knownObjectTypes?.has(417), true);
        assert.equal(game.u.uhp, 4);
    });

test('seed0030 segment7 fatal striking hit preserves both death pagers',
    async () => {
        const lastStep = 165;
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, ponyPriest, lastStep,
            'seed0030 segment 7 fatal striking wand',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 fatal wand screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 fatal wand cursor ${step}`,
            );
        }

        assert.equal(game.u.uhp, 0);
        assert.equal(game.u.umortality, 1);
        assert.equal(game.program_state.gameover, true);
        assert.equal(game._deathKiller, 'wand');
        assert.equal(game._canMakeBones, false);
        assert.equal(
            game._deathShopSettlement?.message,
            'Swidnica takes all your possessions.',
        );
    });

test('seed0030 segment7 fatal wand stops on the persistent score list',
    async () => {
        const lastStep = 171;
        const scoresBeforeFlorian = seed0030PriorScores.filter(record =>
            record.name !== 'Florian');
        const storage = new Map([[
            SCORE_RECORD_STORAGE_KEY,
            JSON.stringify(scoresBeforeFlorian),
        ]]);
        const result = await runSegment({
            ...ponyPriest,
            moves: ponyPriest.moves.slice(0, lastStep),
            storage,
        });

        assertRngThrough(
            result, ponyPriest, lastStep,
            'seed0030 segment 7 fatal wand score list',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(ponyPriest.steps[step].screen),
                `seed0030 segment 7 fatal wand score screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                ponyPriest.steps[step].cursor,
                `seed0030 segment 7 fatal wand score cursor ${step}`,
            );
        }

        assert.deepEqual(
            JSON.parse(storage.get(SCORE_RECORD_STORAGE_KEY)),
            seed0030PriorScores,
        );
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.context.move, 0);
    });

test('seed0030 segment8 splint removal keeps live Samurai combat running',
    async () => {
        const lastStep = 4;
        const result = await runSegment({
            ...delayedSamurai,
            moves: delayedSamurai.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, delayedSamurai, lastStep, 'seed0030 segment 8',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(delayedSamurai.steps[step].screen),
                `seed0030 segment 8 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                delayedSamurai.steps[step].cursor,
                `seed0030 segment 8 cursor ${step}`,
            );
        }

        const splintMail = game.inventory.find(object =>
            object.name === 'splint mail');
        assert.equal(splintMail?.worn, true);
        assert.equal(game.uarm, splintMail);
        assert.equal(game._delayedAction?.kind, 'remove');
        assert.equal(game._samuraiLiveScheduler, true);
    });

test('seed0030 segment8 splint completion uses the source suit noun',
    async () => {
        const lastStep = 6;
        const result = await runSegment({
            ...delayedSamurai,
            moves: delayedSamurai.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, delayedSamurai, lastStep, 'seed0030 segment 8',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(delayedSamurai.steps[step].screen),
                `seed0030 segment 8 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                delayedSamurai.steps[step].cursor,
                `seed0030 segment 8 cursor ${step}`,
            );
        }

        const splintMail = game.inventory.find(object =>
            object.name === 'splint mail');
        assert.equal(splintMail?.worn, false);
        assert.equal(game.uarm, null);
        assert.equal(game.u.uac, 10);
        assert.equal(game._delayedAction, null);
    });

test('seed0030 segment8 drop implicit BUC lets pet death tail complete',
    async () => {
        const lastStep = 13;
        const result = await runSegment({
            ...delayedSamurai,
            moves: delayedSamurai.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, delayedSamurai, lastStep, 'seed0030 segment 8',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(delayedSamurai.steps[step].screen),
                `seed0030 segment 8 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                delayedSamurai.steps[step].cursor,
                `seed0030 segment 8 cursor ${step}`,
            );
        }

        assert.equal(game.inventory.some(object =>
            object.name === 'katana'), false);
        const droppedKatana = game.level.objects
            .flatMap(column => (column || []).flatMap(pile => pile || []))
            .find(object => object.name === 'katana');
        assert.ok(droppedKatana);
    });

test('seed0030 segment8 named pet eating uses its proper name',
    async () => {
        const lastStep = 15;
        const result = await runSegment({
            ...delayedSamurai,
            moves: delayedSamurai.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, delayedSamurai, lastStep, 'seed0030 segment 8',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(delayedSamurai.steps[step].screen),
                `seed0030 segment 8 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                delayedSamurai.steps[step].cursor,
                `seed0030 segment 8 cursor ${step}`,
            );
        }

        const hachi = game.level.monsters.find(monster =>
            monster.name === 'Hachi');
        assert.ok(hachi);
        const pile = game.level.objects[hachi.mx]?.[hachi.my] || [];
        assert.equal(pile.some(object =>
            object.otyp === CORPSE && object.name === 'jackal corpse'), false);
    });

test('seed0030 segment8 confirmed quit renders the Samurai summary',
    async () => {
        const lastStep = 37;
        const result = await runSegment({
            ...delayedSamurai,
            moves: delayedSamurai.moves.slice(0, lastStep),
            storage: new Map(),
        });

        assertRngThrough(
            result, delayedSamurai, lastStep, 'seed0030 segment 8',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(delayedSamurai.steps[step].screen),
                `seed0030 segment 8 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                delayedSamurai.steps[step].cursor,
                `seed0030 segment 8 cursor ${step}`,
            );
        }

        assert.equal(game.program_state.gameover, true);
        assert.equal(game.context.move, 0);
    });

test('seed0030 segment8 quit reads the persistent top-ten record',
    async () => {
        const lastStep = 38;
        const storage = new Map([[
            SCORE_RECORD_STORAGE_KEY,
            JSON.stringify(seed0030PriorScores),
        ]]);
        const result = await runSegment({
            ...delayedSamurai,
            moves: delayedSamurai.moves.slice(0, lastStep),
            storage,
        });

        assertRngThrough(
            result, delayedSamurai, lastStep, 'seed0030 segment 8',
        );
        for (let step = 0; step <= lastStep; step++) {
            assertScreenExact(
                decodeScreen(result.getScreens()[step]),
                decodeScreen(delayedSamurai.steps[step].screen),
                `seed0030 segment 8 screen ${step}`,
            );
            assert.deepEqual(
                result.getCursors()[step],
                delayedSamurai.steps[step].cursor,
                `seed0030 segment 8 cursor ${step}`,
            );
        }

        assert.deepEqual(
            JSON.parse(storage.get(SCORE_RECORD_STORAGE_KEY)),
            seed0030PriorScores,
        );
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.context.move, 0);
    });
