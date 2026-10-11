// C refs: end.c disclose()/should_query_disclose_option() and insight.c
// list_vanquished()/list_genocided().  The vanquished prompt hides the
// sort-order choice 'a' when only one species was vanquished; the list
// itself keeps the default traditional order (monster level, then index).

import assert from 'node:assert/strict';
import test from 'node:test';

import { finishOrdinaryDeath, vanquishedLines } from '../js/end.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME } from '../js/monster_data.js';
import { G_EXTINCT, G_GENOD } from '../js/const.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';

const M2_PNAME = 0x00080000;
const G_UNIQ = 0x1000;

function visibleRow(): string {
    const display = game.nhDisplay;
    assert.ok(display, 'disclosure assertions need a live display');
    const row = display.grid[0];
    assert.ok(row, 'the display has a message row');
    return row.map(cell => cell.ch).join('').trimEnd();
}

function recordSpecies(name: string, count: number, mvflags = 0): void {
    const mnum = MONSTER_NAME.indexOf(name);
    assert.ok(mnum >= 0, `unknown species ${name}`);
    if (!Array.isArray(game.mvitals)) game.mvitals = [];
    const vital = game.mvitals[mnum];
    if (vital) {
        vital.mvflags = mvflags;
        vital.born = count;
        vital.died = count;
    } else game.mvitals[mnum] = { mvflags, born: count, died: count };
}

function deathWithPrompts(): ReturnType<typeof finishOrdinaryDeath> {
    game.storage = memoryStorage();
    game.flags.tombstone = false;
    return finishOrdinaryDeath({ killer: 'a falling rock' });
}

// Steps through the disclosure prompts, answering each with 'n' (and
// dismissing intermediate --More-- lines with space) until the wanted
// question is on display.
async function advanceToQuestion(
    input: ReturnType<typeof resetInputState>, wanted: RegExp,
): Promise<string> {
    for (let guard = 0; guard < 12; guard++) {
        await input.waitUntilBlocked();
        const row = visibleRow();
        if (wanted.test(row)) return row;
        input.feed(/Do you want/.test(row) ? 'n' : ' ');
    }
    throw new Error(`disclosure never asked ${wanted}`);
}

async function declineRemainingPrompts(
    input: ReturnType<typeof resetInputState>, ending: Promise<unknown>,
): Promise<void> {
    for (let guard = 0; guard < 12; guard++) {
        await input.waitUntilBlocked();
        const row = visibleRow();
        if (/Do you want|--More--/.test(row)) {
            input.feed(/Do you want/.test(row) ? 'n' : ' ');
            continue;
        }
        break;
    }
    // The death summary and score pages still page the terminal.
    for (let guard = 0; guard < 10; guard++) {
        input.feed(' ');
        const settled = await Promise.race([
            ending.then(() => true),
            input.waitUntilBlocked().then(() => false),
        ]);
        if (settled) return;
    }
    await ending;
}

void test('one vanquished species asks [ynq] while several offer [ynaq]', async () => {
    for (const [label, expected] of [
        ['a single species', 'Do you want an account of creatures vanquished? [ynq] (n)'],
        ['several species', 'Do you want an account of creatures vanquished? [ynaq] (n)'],
    ] as const) {
        freshPlayableRoom();
        requirePlayingGame(game);
        recordSpecies('newt', 1);
        if (label === 'several species') recordSpecies('jackal', 2);
        const input = resetInputState();
        const ending = deathWithPrompts();

        const row = await advanceToQuestion(input, /creatures vanquished/);

        assert.equal(row, expected, `prompt choices for ${label}`);
        await declineRemainingPrompts(input, ending);
    }
});

void test('the conduct question names achievements once any are recorded', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.u.uachieved = [23];
    const input = resetInputState();
    const ending = deathWithPrompts();

    const row = await advanceToQuestion(input, /your conduct/);

    assert.equal(row, 'Do you want to see your conduct and achievements? [ynq] (n)');
    await declineRemainingPrompts(input, ending);
});

void test('a genocided species is offered through its own disclosure step', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('gnome', 1, G_GENOD);
    const input = resetInputState();
    const ending = deathWithPrompts();

    const row = await advanceToQuestion(input, /species genocided/);

    assert.equal(row, 'Do you want a list of species genocided? [ynq] (n)');
    input.feed('y');
    await input.waitUntilBlocked();
    const display = game.nhDisplay;
    assert.ok(display);
    const text = display.grid.map(rowCells =>
        rowCells.map(cell => cell.ch).join('').trimEnd()).join('\n');
    assert.match(text, /Genocided species:/);
    assert.match(text, / gnomes/);
    assert.match(text, /1 species genocided\./);
    input.feed(' ');
    await declineRemainingPrompts(input, ending);
});

void test('an extinct-only ending asks about extinct species instead', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('gnome', 1, G_EXTINCT);
    const input = resetInputState();
    const ending = deathWithPrompts();

    const row = await advanceToQuestion(input, /species/);

    assert.equal(row, 'Do you want a list of extinct species? [ynq] (n)');
    await declineRemainingPrompts(input, ending);
});

void test('the vanquished list orders by monster level with native indentation', () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('gnome', 1);
    recordSpecies('acid blob', 1);
    recordSpecies('blue jelly', 2);
    recordSpecies('dwarf', 1);

    const lines = vanquishedLines();

    // blue jelly has the highest level, then dwarf; the level-one pair is
    // tie-broken by monster index, so the acid blob precedes the gnome.
    assert.deepEqual(lines, [
        'Vanquished creatures:',
        '',
        '  2 blue jellies',
        '  a dwarf',
        ' an acid blob',
        '  a gnome',
        '',
        '5 creatures vanquished.',
    ]);
});

void test('unique vanquished species keep their proper-name spelling', () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('Oracle', 1);
    recordSpecies('Medusa', 1);

    assert.equal((MONSTER_GENO[MONSTER_NAME.indexOf('Oracle')] ?? 0) & G_UNIQ, G_UNIQ);
    assert.equal((MONSTER_FLAGS2[MONSTER_NAME.indexOf('Medusa')] ?? 0) & M2_PNAME, M2_PNAME);
    const medusaLevel = MONSTER_LEVEL[MONSTER_NAME.indexOf('Medusa')] ?? -1;
    const oracleLevel = MONSTER_LEVEL[MONSTER_NAME.indexOf('Oracle')] ?? -1;
    assert.ok(medusaLevel > oracleLevel);

    const lines = vanquishedLines();

    assert.deepEqual(lines, [
        'Vanquished creatures:',
        '',
        '    Medusa',
        'the Oracle',
        '',
        '2 creatures vanquished.',
    ]);
});
