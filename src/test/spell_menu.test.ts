import { capturedScreen } from './support/screen.js';
import { requirePlayingGame } from '../js/gstate.js';
import type { RoleKey } from '../js/roles.js';
import type { InputGate } from '../js/input.js';
import { requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_TRADITIONAL } from '../js/const.js';
import { flushPendingTopline, pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeStunned } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import {
    OBJECT_NAMES, OBJECT_SPELL_CATEGORY, SPE_DIG, SPE_FIREBALL, SPE_FORCE_BOLT,
    SPE_HEALING, SPE_SLEEP, SPE_TURN_UNDEAD,
} from '../js/object_data.js';
import { applyNethackrc, doOptions } from '../js/options.js';
import { ensureHeroSkills } from '../js/skills.js';
import { forceLearnSpell } from '../js/spell.js';
import { selectSpellToCast, viewKnownSpells } from '../js/spell_menu.js';
import { freshObjectRoom } from './support/object-room.js';
import { trainSpellSkill } from './support/spells.js';
import { ATR_INVERSE, ATR_NONE } from '../js/terminal.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';

const spellType = (name: string) => OBJECT_NAMES.findIndex((candidate, type) =>
    candidate === name && OBJECT_SPELL_CATEGORY[type]);

function learnSpells(types: readonly number[], role: RoleKey = 'wizard') {
    freshObjectRoom({ role, moves: 1 });
    requirePlayingGame(game);
    ensureHeroSkills(game);
    for (const type of types) forceLearnSpell(type);
    return game.spells;
}

function menuText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

function displayedSpells() {
    return menuText().split('\n').filter(line => /^\s*[a-zA-Z] [-*] /.test(line));
}

function spellRow(index: number): string {
    const row = displayedSpells()[index];
    assert.ok(row !== undefined, `Expected spell menu row ${index}`);
    return row;
}

function textAttribute(text: string) {
    const row = requireGameDisplay().grid.find(cells => cells.map(cell => cell.ch).join('').includes(text));
    assert.ok(row, `Expected visible menu text: ${text}`);
    const column = row.map(cell => cell.ch).join('').indexOf(text);
    assert.ok(row[column] != null);
    return row[column].attr;
}

async function answerMenu(input: InputGate, key: string) {
    input.feed(key);
    await input.waitUntilBlocked();
}

void test('selection without memorized spells explains why no menu opens', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    assert.equal(await selectSpellToCast(), null);

    assert.match(game._pending_message, /don't know any spells right now/);
});

void test('stunning rejects selection before opening a spell menu', async () => {
    learnSpells([SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    await makeStunned(5, { talk: false });

    assert.equal(await selectSpellToCast(), null);

    assert.match(game._pending_message, /too impaired to cast/);
});

void test('a full casting menu acknowledges pending prose and returns the memorized entry', async () => {
    const [spell] = learnSpells([SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    await pline('You finish your preparations.');
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    assert.match(menuText(), /preparations\.--More--/);
    await answerMenu(input, ' ');
    assert.match(menuText(), /Choose which spell to cast/);
    assert.match(menuText(), /a - force bolt\s+1\s+attack\s+\d+%\s+100%/);
    assert.equal(textAttribute('Choose which spell to cast'), ATR_INVERSE);
    assert.equal(textAttribute('Name'), ATR_INVERSE);
    assert.equal(textAttribute('a - force bolt'), ATR_NONE);
    input.feed('a');

    assert.equal(await selection, spell);
    assert.equal(game.moves, 1);
});

void test('spell viewing and sorting highlight their prompts without highlighting choices', async () => {
    learnSpells([SPE_HEALING, SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    const input = resetInputState();
    const viewing = viewKnownSpells();
    await input.waitUntilBlocked();
    assert.equal(textAttribute('Currently known spells'), ATR_INVERSE);
    assert.equal(textAttribute('a - healing'), ATR_NONE);
    await answerMenu(input, '+');
    assert.equal(textAttribute('View known spells list sorted'), ATR_INVERSE);
    assert.equal(textAttribute('a * by casting letter'), ATR_NONE);
    await answerMenu(input, '\x1b');
    input.feed('\x1b');
    await viewing;
});

void test('recording a spell menu compresses long highlighted gaps while the live display preserves them', async () => {
    const engine = new Engine({
        seed: 812,
        display: new GameDisplay(null),
        nethackrc: 'OPTIONS=name:Student,role:wizard,race:human,gender:male,align:neutral,!legacy,!tutorial,!tips',
    });
    const capture = engine.inputGate.beforeRead;
    assert.ok(capture);
    engine.inputGate.beforeRead = async () => {
        await capture();
        assert.match(menuText(), /--More--/, 'startup setup should request only a message acknowledgment');
        engine.inputGate.feed(' ');
    };
    try {
        await engine.start();
        await flushPendingTopline();
        engine.inputGate.beforeRead = capture;
        const selecting = selectSpellToCast();
        await engine.inputGate.waitUntilBlocked();
        const row = requireGameDisplay().grid.findIndex(cells =>
            cells.map(cell => cell.ch).join('').includes('Name'));
        assert.ok(row >= 0, 'the live spell table heading should be visible');
        const live = requireGameDisplay().grid[row];
        assert.ok(live != null, 'Expected live to be initialized');
        const text = live.map(cell => cell.ch).join('');
        const name = text.indexOf('Name');
        const level = text.indexOf('Level');
        const captured = decodeScreen(capturedScreen(engine, -1))[row];

        assert.ok(live[name + 4] != null);
        assert.equal(live[name + 4]?.attr, ATR_INVERSE, 'native inverse continues through column padding');
        assert.ok(captured != null, 'Expected captured to be initialized');
        assert.ok(captured[name + 4] != null);
        assert.equal(captured[name + 4]?.attr, ATR_NONE, 'long recorded gaps leave unpainted cells on decode');
        assert.ok(captured[name] != null);
        assert.equal(captured[name]?.attr, ATR_INVERSE, 'recording preserves the label highlight');
        assert.ok(captured[name - 1] != null);
        assert.equal(captured[name - 1]?.attr, ATR_INVERSE, 'the four-space header indent remains literal');
        assert.ok(captured[level + 5] != null);
        assert.equal(captured[level + 5]?.attr, ATR_INVERSE, 'a single separator space remains literal');
        engine.inputGate.feed('\x1b');
        await selecting;
    } finally {
        await engine.lua.destroy();
    }
});

void test('uppercase casting letters select spells on later pages without aliasing lowercase letters', async () => {
    const types = OBJECT_SPELL_CATEGORY.flatMap((category, type) => category ? [type] : []);
    const spells = learnSpells(types);
    requirePlayingGame(game);
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    await answerMenu(input, 'A');
    assert.match(menuText(), /\(1 of 2\)/, 'an off-page selector must not select a spell');
    await answerMenu(input, '>');
    assert.match(menuText(), /A - restore ability/);
    input.feed('A');

    assert.equal(await selection, spells[26]);
});

void test('menu search can select a spell on a different page', async () => {
    learnSpells(OBJECT_SPELL_CATEGORY.flatMap((category, type) => category ? [type] : []));
    requirePlayingGame(game);
    const wanted = game.spells.find(spell => OBJECT_NAMES[spell.otyp] === 'polymorph');
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    await answerMenu(input, ':');
    input.feed('polymorph\n');

    assert.equal(await selection, wanted);
});

void test('traditional selection preserves uppercase letters and displays their range', async () => {
    const types = OBJECT_SPELL_CATEGORY.flatMap((category, type) => category ? [type] : []).slice(0, 28);
    const spells = learnSpells(types);
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=menustyle:traditional');
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    assert.match(menuText(), /Cast which spell\? \[a-zA-B \*\?\]/);
    input.feed('B');

    assert.equal(await selection, spells[27]);
    assert.equal(game.flags.menu_style, MENU_TRADITIONAL);
});

void test('traditional invalid choices acknowledge their explanation before retrying', async () => {
    const [spell] = learnSpells([SPE_HEALING]);
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=menustyle:traditional');
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    await answerMenu(input, 'A');
    assert.match(menuText(), /don't know that spell\.--More--/);
    await answerMenu(input, ' ');
    assert.match(menuText(), /Cast which spell\? \[a \*\?\]/);
    input.feed('a');

    assert.equal(await selection, spell);
});

void test('traditional selection stops after ten invalid choices', async () => {
    learnSpells([SPE_HEALING]);
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=menustyle:traditional');
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    for (let tries = 0; tries < 9; tries++) {
        await answerMenu(input, 'z');
        await answerMenu(input, ' ');
    }
    input.feed('z');

    assert.equal(await selection, null);
    assert.match(game._pending_message, /That's enough tries\./);
});

for (const help of ['?', '*']) {
    void test(`traditional ${help} opens the ordinary spell menu`, async () => {
        const [spell] = learnSpells([SPE_HEALING]);
        requirePlayingGame(game);
        applyNethackrc('OPTIONS=menustyle:traditional');
        const input = resetInputState();
        const selection = selectSpellToCast();
        await input.waitUntilBlocked();
        await answerMenu(input, help);
        assert.match(menuText(), /Choose which spell to cast/);
        input.feed('a');

        assert.equal(await selection, spell);
    });
}

void test('traditional Escape cancels without consuming a turn', async () => {
    learnSpells([SPE_HEALING]);
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=menustyle:traditional');
    resetInputState().feed('\x1b');

    assert.equal(await selectSpellToCast(), null);
    assert.match(game._pending_message, /Never mind\./);
    assert.equal(game.moves, 1);
});

void test('viewing a single spell is read-only until a dismissal key', async () => {
    const [spell] = learnSpells([SPE_HEALING]);
    requirePlayingGame(game);
    const input = resetInputState();
    const view = viewKnownSpells();
    await input.waitUntilBlocked();
    await answerMenu(input, 'a');
    assert.match(menuText(), /Currently known spells/);
    assert.doesNotMatch(menuText(), /sort spells|Reordering/);
    input.feed(' ');
    await view;

    assert.equal(game.spells[0], spell);
});

void test('swapping spells changes their casting letters and preserves the entries', async () => {
    const [healing, bolt] = learnSpells([SPE_HEALING, SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    const input = resetInputState();
    const view = viewKnownSpells();
    await input.waitUntilBlocked();
    await answerMenu(input, 'a');
    assert.match(menuText(), /Reordering spells; swap 'a' with/);
    assert.match(menuText(), /a \* healing/);
    await answerMenu(input, 'b');
    assert.match(menuText(), /a - force bolt/);
    input.feed('\x1b');
    await view;
    input.feed('a');

    assert.equal(await selectSpellToCast(), bolt);
    assert.equal(game.spells[1], healing);
});

void test('accepting a preselected swap exits viewing without changing spell letters', async () => {
    const [healing] = learnSpells([SPE_HEALING, SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('a\n');

    await viewKnownSpells();

    assert.equal(game.spells[0], healing);
    assert.doesNotMatch(menuText(), /Currently known spells|Reordering/);
});

for (const deselect of ['a', '\x1b', '-\n', '\\\n']) {
    void test(`deselecting a swap (${JSON.stringify(deselect)}) returns to viewing`, async () => {
        const [healing] = learnSpells([SPE_HEALING, SPE_FORCE_BOLT]);
        requirePlayingGame(game);
        const input = resetInputState();
        const view = viewKnownSpells();
        await input.waitUntilBlocked();
        await answerMenu(input, 'a');
        await answerMenu(input, deselect);
        assert.match(menuText(), /Currently known spells/);
        input.feed('\x1b');
        await view;

        assert.equal(game.spells[0], healing);
    });
}

for (const [choice, first, second] of [
    ['b', 'detect food', 'fireball'],
    ['c', 'force bolt', 'healing'],
    ['d', 'turn undead', 'fireball'],
    ['e', 'fireball', 'force bolt'],
    ['f', 'force bolt', 'fireball'],
    ['g', 'fireball', 'force bolt'],
] as const) {
    void test(`spell sorting ${choice} changes the displayed order while preserving casting letters`, async () => {
        const [original] = learnSpells([
            SPE_TURN_UNDEAD, SPE_SLEEP, SPE_HEALING, SPE_FIREBALL, SPE_FORCE_BOLT, spellType('detect food'),
        ]);
        requirePlayingGame(game);
        const input = resetInputState();
        const view = viewKnownSpells();
        await input.waitUntilBlocked();
        await answerMenu(input, '+');
        assert.match(menuText(), /a \* by casting letter/);
        await answerMenu(input, choice);
        const lines = displayedSpells();
        assert.ok(lines[0] != null);
        assert.ok(lines[0].includes(first), `first displayed spell should be ${first}: ${lines[0]}`);
        assert.ok(lines[1] != null);
        assert.ok(lines[1].includes(second), `second displayed spell should be ${second}: ${lines[1]}`);
        assert.equal(game.spells[0], original);
        input.feed('\x1b');
        await view;

        const reopened = viewKnownSpells();
        await input.waitUntilBlocked();
        assert.match(spellRow(0), /a - turn undead/);
        input.feed('\x1b');
        await reopened;
    });
}

void test('retaining a sorted order reassigns casting letters and keeps knowledge with each spell', async () => {
    const [healing, bolt] = learnSpells([SPE_HEALING, SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    assert.ok(healing != null, 'Expected healing to be initialized');
    healing.know = 3000;
    const input = resetInputState();
    const view = viewKnownSpells();
    await input.waitUntilBlocked();
    await answerMenu(input, '+');
    await answerMenu(input, 'b');
    await answerMenu(input, '+');
    await answerMenu(input, 'z');
    assert.match(spellRow(0), /a - force bolt/);
    await answerMenu(input, '+');
    assert.match(menuText(), /a \* by casting letter/);
    await answerMenu(input, '\x1b');
    input.feed('\x1b');
    await view;

    assert.equal(game.spells[0], bolt);
    assert.equal(game.spells[1], healing);
    assert.equal(healing.know, 3000);
});

void test('maintain current ordering keeps a display sort after swapping entries', async () => {
    learnSpells([SPE_HEALING, SPE_FORCE_BOLT, SPE_DIG]);
    requirePlayingGame(game);
    const input = resetInputState();
    const view = viewKnownSpells();
    await input.waitUntilBlocked();
    await answerMenu(input, '+');
    await answerMenu(input, 'b');
    assert.match(spellRow(0), /c - dig/);
    await answerMenu(input, 'c');
    await answerMenu(input, 'a');
    assert.match(spellRow(0), /c - healing/);
    await answerMenu(input, '+');
    await answerMenu(input, 'h');
    assert.match(spellRow(0), /c - healing/);
    await answerMenu(input, '+');
    await answerMenu(input, 'a');
    assert.match(spellRow(0), /a - dig/);
    input.feed('\x1b');
    await view;
});

void test('retention ranges become more precise as the real spell skill improves', async () => {
    learnSpells([SPE_FORCE_BOLT]);
    requirePlayingGame(game);
    game.moves = 10201; // 9800 turns of the initial 20000-turn memory remain.
    for (const [skill, range] of [[2, '41%-50%'], [3, '46%-50%'], [4, '49%-50%']] as const) {
        await trainSpellSkill(SPE_FORCE_BOLT, skill);
        const input = resetInputState();
        const view = viewKnownSpells();
        await input.waitUntilBlocked();
        assert.ok(spellRow(0).includes(range), `${range} should reflect the current skill`);
        input.feed(' ');
        await view;
    }
});

void test('restricted spell skills show the unskilled retention range and expired spells show gone', async () => {
    learnSpells([SPE_HEALING], 'caveman');
    requirePlayingGame(game);
    game.moves = 10201;
    const input = resetInputState();
    let view = viewKnownSpells();
    await input.waitUntilBlocked();
    assert.match(spellRow(0), /26%-50%/);
    input.feed(' ');
    await view;
    game.moves = 20001;
    view = viewKnownSpells();
    await input.waitUntilBlocked();
    assert.match(spellRow(0), /\(gone\)/);
    input.feed(' ');
    await view;
});

void test('the advanced menustyle option changes subsequent casting prompts', async () => {
    learnSpells([SPE_HEALING]);
    requirePlayingGame(game);
    const input = resetInputState();
    let phase = 'find option';
    let pages = 0;
    input.beforeRead = () => {
        const screen = menuText();
        if (phase === 'find option') {
            const line = screen.split('\n').find(row => row.includes('menustyle '));
            const key = line?.match(/^\s*([a-zA-Z]) - /)?.[1];
            if (key) {
                phase = 'commit option';
                input.feed(key);
            } else {
                assert.ok(++pages < 12, 'menustyle should appear in the advanced options menu');
                input.feed(' ');
            }
        } else if (phase === 'commit option') {
            phase = 'choose style';
            input.feed('\n');
        } else {
            assert.match(screen, /Select menustyle:/);
            assert.match(screen, /f \* full/);
            input.beforeRead = null;
            input.feed('t');
        }
    };
    await doOptions(true);
    assert.equal(game.flags.menu_style, MENU_TRADITIONAL);
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    assert.match(menuText(), /menustyle.*changed to.*traditional.*--More--/);
    await answerMenu(input, ' ');
    assert.match(menuText(), /Cast which spell\?/);
    input.feed('\x1b');
    assert.equal(await selection, null);
});
