// C refs: end.c disclose()/should_query_disclose_option() and insight.c
// list_vanquished()/list_genocided().  The vanquished prompt hides the
// sort-order choice 'a' when only one species was vanquished; the list
// itself keeps the default traditional order (monster level, then index).

import assert from 'node:assert/strict';
import test from 'node:test';

import { finishOrdinaryDeath, vanquishedLines } from '../js/end.js';
import { docrt, flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME } from '../js/monster_data.js';
import { makePlural } from '../js/object_grammar.js';
import { G_EXTINCT, G_GENOD } from '../js/const.js';
import { ATR_BOLD, ATR_INVERSE, NO_COLOR } from '../js/terminal.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';

const M2_PNAME = 0x00080000;
const G_UNIQ = 0x1000;

function visibleRow(): string {
    const display = game.nhDisplay;
    assert.ok(display, 'disclosure assertions need a live display');
    const row = display.grid[0];
    assert.ok(row, 'the display has a message row');
    return row.map(cell => cell.ch).join('').trimEnd();
}

function screenText(): string {
    const display = game.nhDisplay;
    assert.ok(display, 'disclosure assertions need a live display');
    return display.grid.map(rowCells =>
        rowCells.map(cell => cell.ch).join('').trimEnd()).join('\n');
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
        const finished = await Promise.race([
            ending.then(() => true),
            input.waitUntilBlocked().then(() => false),
        ]);
        if (finished) return;
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

for (const { description, question, heading, nextQuestion, count, mvflags } of [
    {
        description: 'vanquished', question: /creatures vanquished/, heading: /Vanquished creatures:/,
        nextQuestion: /your conduct/, count: 1, mvflags: 0,
    },
    {
        description: 'genocided', question: /species/, heading: /species:/,
        nextQuestion: /your conduct/, count: 0, mvflags: G_GENOD,
    },
    {
        description: 'extinct', question: /species/, heading: /species:/,
        nextQuestion: /your conduct/, count: 0, mvflags: G_EXTINCT,
    },
    {
        description: 'conduct', question: /your conduct/, heading: /Voluntary challenges:/,
        nextQuestion: /dungeon overview/, count: 0, mvflags: 0,
    },
]) {
    void test(`dismissing full-screen ${description} disclosure restores hallucinated monsters before the next question`, async () => {
        freshPlayableRoom({ seed: 61023n });
        requirePlayingGame(game);
        await createMonsterAt('newt', 12, 10);
        game.u.hallucinationTurns = 20;
        await docrt();
        await flush_screen(1);
        recordSpecies('gnome', count, mvflags);
        game.flags.menu_overlay = false;
        const input = resetInputState();
        const ending = deathWithPrompts();
        try {
            await advanceToQuestion(input, question);
            const oldGlyph = game.nhDisplay?.grid[11]?.[11];
            assert.ok(oldGlyph, 'the visible monster has a terminal cell');
            const oldAppearance = { ch: oldGlyph.ch, color: oldGlyph.color };
            input.feed('y');
            await input.waitUntilBlocked();
            assert.match(screenText(), heading);
            input.feed(' ');
            await input.waitUntilBlocked();

            assert.match(visibleRow(), nextQuestion);
            const monsterGlyph = game.nhDisplay?.grid[11]?.[11];
            assert.ok(monsterGlyph, 'the visible monster has a terminal cell');
            assert.ok(monsterGlyph.ch !== oldAppearance.ch || monsterGlyph.color !== oldAppearance.color,
                'dismissal gives the visible monster a fresh hallucinated appearance');
        } finally {
            await declineRemainingPrompts(input, ending);
        }
    });
}

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

void test('a single genocided species keeps the special default in its prompt', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('gnome', 1, G_GENOD);
    game.flags.disclose = '?g';
    const input = resetInputState();
    const ending = deathWithPrompts();

    const row = await advanceToQuestion(input, /species genocided/);

    assert.equal(row, 'Do you want a list of species genocided? [ynq] (a)');
    await declineRemainingPrompts(input, ending);
});

void test("answering 'a' picks a sort order before the vanquished list", async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('newt', 5);
    recordSpecies('jackal', 2);
    const input = resetInputState();
    const ending = deathWithPrompts();

    await advanceToQuestion(input, /creatures vanquished/);
    input.feed('a');
    await input.waitUntilBlocked();

    // Native marks the current order with '*' and puts the title first.
    let screen = screenText();
    assert.match(visibleRow(), /Sort order for vanquished monster counts/);
    assert.equal(screen.split('\n')[1]?.trim(), '');
    assert.match(screen, /t \* traditional: by monster level/);
    assert.match(screen, /a - alphabetically, first unique monsters, then others/);
    input.feed('a');
    await input.waitUntilBlocked();

    // Alphabetical order lists the jackals before the newt regardless of
    // their kill counts.
    screen = screenText();
    assert.ok(screen.indexOf('2 jackals') >= 0, 'the list names the jackals');
    assert.ok(screen.indexOf('5 newts') > screen.indexOf('2 jackals'),
        'alphabetical order puts jackals first');
    input.feed(' ');
    await declineRemainingPrompts(input, ending);
});

void test('the sort menu marks the current order as selected', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('newt', 1);
    recordSpecies('jackal', 2);
    const input = resetInputState();
    const ending = deathWithPrompts();
    await advanceToQuestion(input, /creatures vanquished/);
    input.feed('a');
    await input.waitUntilBlocked();
    try {
        assert.match(screenText(), /t \* traditional: by monster level/);
    } finally {
        input.feed(27);
        await declineRemainingPrompts(input, ending);
    }
});

for (const [name, key] of [['Enter', '\n'], ['Space', ' ']] as const) {
    void test(`${name} accepts the current vanquished sort order`, async () => {
        freshPlayableRoom();
        requirePlayingGame(game);
        recordSpecies('newt', 1);
        recordSpecies('jackal', 2);
        const input = resetInputState();
        const ending = deathWithPrompts();
        await advanceToQuestion(input, /creatures vanquished/);
        input.feed('a');
        await input.waitUntilBlocked();
        input.feed(key);
        await input.waitUntilBlocked();
        try {
            assert.match(screenText(), /Vanquished creatures:/);
            assert.doesNotMatch(screenText(), /Sort order for/);
            assert.equal(game.flags.vanqSortmode ?? 0, 0);
        } finally {
            input.feed(27);
            await declineRemainingPrompts(input, ending);
        }
    });
}

for (const category of ['v', 'g'] as const) {
    for (const { ask, style, attr } of [
        { ask: false, style: 'default', attr: ATR_INVERSE },
        { ask: true, style: 'default', attr: ATR_INVERSE },
        { ask: false, style: 'bold', attr: ATR_BOLD },
        { ask: true, style: 'bold', attr: ATR_BOLD },
    ]) {
        void test(`${ask ? 'prompted' : 'automatic'} ${category === 'v' ? 'vanquished' : 'genocided'} disclosure ${ask ? 'omits' : 'uses'} ${style} class heading attributes`, async () => {
            freshPlayableRoom({ moves: 40 });
            requirePlayingGame(game);
            if (style === 'bold') game.iflags.menu_headings = { attr, color: NO_COLOR };
            recordSpecies('newt', 1, category === 'g' ? G_GENOD : 0);
            recordSpecies('jackal', 2, category === 'g' ? G_GENOD : 0);
            game.flags.vanqSortmode = 5;
            game.flags.disclose = `-i -a -c -o ${category === 'v' ? '-g' : '-v'} ${ask ? 'n' : '+'}${category}`;
            const input = resetInputState();
            const ending = deathWithPrompts();
            if (ask) {
                await advanceToQuestion(input, category === 'v' ? /creatures vanquished/ : /species genocided/);
                input.feed('y');
            }
            await input.waitUntilBlocked();
            try {
                const display = game.nhDisplay;
                assert.ok(display);
                const header = display.grid.find(row => row.map(cell => cell.ch).join('').trim() === 'Dog or other canine');
                assert.ok(header, 'the list groups jackals under the Dog or other canine heading');
                const firstLetter = header.find(cell => cell.ch === 'D');
                assert.equal(firstLetter?.attr, ask ? 0 : attr);
            } finally {
                input.feed(' ');
                await declineRemainingPrompts(input, ending);
            }
        });
    }
}

void test('escaping the sort-order menu skips the list without stopping disclosure', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('newt', 1);
    recordSpecies('jackal', 2);
    recordSpecies('gnome', 1, G_GENOD);
    const input = resetInputState();
    const ending = deathWithPrompts();

    await advanceToQuestion(input, /creatures vanquished/);
    input.feed('a');
    await input.waitUntilBlocked();
    assert.match(screenText(), /Sort order for vanquished monster counts/);
    input.feed(27);
    await input.waitUntilBlocked();

    // ESC cancels only the vanquished list; the genocided question still
    // gets asked instead of the disclosure being cut short.
    assert.equal(visibleRow(), 'Do you want a list of species genocided? [ynq] (n)');
    await declineRemainingPrompts(input, ending);
});

void test('a count order chosen for vanquished degrades to alphabetical for genocided', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    recordSpecies('newt', 5);
    recordSpecies('jackal', 2);
    recordSpecies('gnome leader', 1, G_GENOD);
    recordSpecies('gnome', 1, G_GENOD);
    const input = resetInputState();
    const ending = deathWithPrompts();

    await advanceToQuestion(input, /creatures vanquished/);
    input.feed('a');
    await input.waitUntilBlocked();
    input.feed('n');
    await input.waitUntilBlocked();

    // By count, high to low: the five newts lead the two jackals.
    let screen = screenText();
    assert.ok(screen.indexOf('5 newts') >= 0);
    assert.ok(screen.indexOf('a newt') < 0, 'counts pluralize the newts');
    assert.ok(screen.indexOf('2 jackals') > screen.indexOf('5 newts'));
    input.feed(' ');

    const row = await advanceToQuestion(input, /species genocided/);
    assert.equal(row, 'Do you want a list of species genocided? [ynaq] (n)');
    input.feed('a');
    await input.waitUntilBlocked();

    // The genocided menu hides the counting orders; its alphabetical
    // choice orders the species list rather than reusing the count order.
    screen = screenText();
    assert.match(screen, /Sort order for genocided monster types/);
    assert.doesNotMatch(screen, /n [-+] by count, high to low/);
    input.feed('a');
    await input.waitUntilBlocked();
    screen = screenText();
    assert.ok(screen.indexOf(' gnomes') < screen.indexOf(' gnome leaders'),
        'the genocided list stays alphabetical');
    input.feed(' ');
    await declineRemainingPrompts(input, ending);
});

void test('a long genocided list pages through every species and its totals', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const species = MONSTER_NAME.filter((name, mnum) => mnum > 0
        && !((MONSTER_GENO[mnum] ?? 0) & G_UNIQ)).slice(0, 30);
    assert.equal(species.length, 30, 'thirty ordinary species are needed');
    for (const name of species) recordSpecies(name, 0, G_GENOD);
    const input = resetInputState();
    const ending = deathWithPrompts();

    await advanceToQuestion(input, /species genocided/);
    input.feed('y');
    await input.waitUntilBlocked();

    // The first page fills the screen and waits behind its pager marker.
    const display = game.nhDisplay;
    assert.ok(display);
    const markerRowCells = display.grid[display.rows - 1];
    assert.ok(markerRowCells, 'the pager marker owns the bottom row');
    assert.equal(markerRowCells.map(cell => cell.ch).join('').trim(), '--More--');
    const firstPage = screenText();
    input.feed(' ');
    await input.waitUntilBlocked();

    // The second page keeps the remaining species and the footers that
    // truncation used to drop.
    const secondPage = screenText();
    assert.match(secondPage, /30 species genocided\./);
    const pagedLines = [...firstPage.split('\n'), ...secondPage.split('\n')]
        .map(line => line.trimEnd());
    for (const name of species) {
        assert.ok(pagedLines.includes(` ${makePlural(name)}`),
            `the paged list still names the ${makePlural(name)}`);
    }
    input.feed(' ');
    await declineRemainingPrompts(input, ending);
});
