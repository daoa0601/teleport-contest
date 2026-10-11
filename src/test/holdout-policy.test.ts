import test from 'node:test';
import assert from 'node:assert/strict';
import type { Cursor, SessionDriver } from '../scripts/lib/session-types.mjs';

import {
    createHoldoutPolicy,
    decodeScreen,
    parseStatus,
    classifyPrompt,
} from '../scripts/lib/holdout-policy.mjs';

// ---------------------------------------------------------------------------
// Screen fixtures built the way the native recorder serializes them:
// RLE cursor-forward for space runs, SGR color, SO/SI for DEC graphics.
// ---------------------------------------------------------------------------

function rawMapScreen({ message = 'You hit the jackal.', heroX = 4 } = {}) {
    const lines = new Array<string>(24).fill('');
    lines[0] = message;
    lines[2] = '  \x0elqqqqqqk\x0f';
    lines[3] = '  \x0ex\x0f  \x1b[90m~~\x1b[39m~  \x0ex\x0f';
    lines[4] = '  \x0ex\x0f  d   \x0ex\x0f';
    lines[5] = '  \x0ex\x0f';
    const map = new Array<string>(20).fill(' ');
    map[heroX] = '@';
    lines[5] = `  \x0ex\x0f${map.join('')}\x0ex\x0f`;
    lines[6] = '  \x0ex\x0f    >   \x0ex\x0f';
    lines[7] = '  \x0emqqqqqqj\x0f';
    lines[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    lines[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:42';
    return lines;
}

const simpleCommandScreen = () => rawMapScreen({ message: 'You hit the jackal.' });
const HERO_CURSOR: Cursor = [5, 5, 1];

function feed(driver: SessionDriver, screens: readonly string[][], cursor: Cursor = HERO_CURSOR) {
    const keys = [];
    for (const screen of screens) {
        const k = driver.nextKey(screen, { cursor });
        if (k === null) break;
        keys.push(k);
    }
    return keys;
}

// ---------------------------------------------------------------------------
// decodeScreen
// ---------------------------------------------------------------------------

void test('decodeScreen expands cursor-forward runs into spaces at fixed width', () => {
    const rows = decodeScreen(['\x1b[28CWeapons', 'a\x1b[6Cb']);
    assert.equal(rows.length, 24);
    assert.equal(rows[0], ' '.repeat(28) + 'Weapons'.padEnd(80 - 28));
    assert.equal(rows[1], 'a' + ' '.repeat(6) + 'b'.padEnd(73));
    for (const r of rows) assert.equal(r.length, rows[0]?.length);
});

void test('decodeScreen decodes DEC graphics walls and strips color', () => {
    const rows = decodeScreen(['  \x0elqqqqqqk\x0f', '\x0ex\x1b[90m~~~~\x1b[39m~\x0f']);
    assert.equal(rows[0]?.slice(2, 10), '┌──────┐');
    assert.equal(rows[1]?.slice(0, 6), '│·····');
});

void test('decodeScreen is idempotent and pads short input to 24 rows', () => {
    const once = decodeScreen(['\x0elqk\x0f']);
    const twice = decodeScreen(once);
    assert.deepEqual(twice, once);
    assert.equal(twice.length, 24);
});

// ---------------------------------------------------------------------------
// classifyPrompt
// ---------------------------------------------------------------------------

void test('classifyPrompt recognizes a normal command screen', () => {
    const cls = classifyPrompt(simpleCommandScreen(), HERO_CURSOR);
    assert.equal(cls.kind, 'command');
    assert.equal(cls.detail, 'You hit the jackal.');
});

void test('classifyPrompt recognizes --More-- anywhere on the screen', () => {
    const lines = simpleCommandScreen().slice();
    lines[1] = ' --More--';
    assert.equal(classifyPrompt(lines).kind, 'more');
});

void test('classifyPrompt recognizes yes/no questions and their default', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'Do you want your possessions identified? [ynq] (n)';
    const cls = classifyPrompt(lines, [52, 0, 1]);
    assert.equal(cls.kind, 'death');
    const ask = simpleCommandScreen().slice();
    ask[0] = 'Really save? [yn] (n)';
    const cls2 = classifyPrompt(ask, [18, 0, 1]);
    assert.equal(cls2.kind, 'yn');
    assert.equal(cls2.default, 'n');
});

void test('classifyPrompt recognizes direction and count prompts', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'In what direction?';
    assert.equal(classifyPrompt(lines, [18, 0, 1]).kind, 'direction');
    lines[0] = 'Count: 1';
    assert.equal(classifyPrompt(lines, [9, 0, 1]).kind, 'count');
});

void test('classifyPrompt recognizes lettered menus and pagers', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = '\x1b[28C\x1b[7mWeapons\x1b[0m';
    lines[1] = '\x1b[28Cb - 13 +0 daggers';
    lines[2] = '\x1b[28Cc - an uncursed +1 leather armor';
    lines[3] = '\x1b[28C(end)';
    const cls = classifyPrompt(lines);
    assert.equal(cls.kind, 'menu');
    assert.ok(cls.items);
    assert.ok(cls.items.length >= 2);
});

void test('a leftover question message with the cursor on the map stays a command screen', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'What happened?';
    assert.equal(classifyPrompt(lines, HERO_CURSOR).kind, 'command');
    assert.equal(classifyPrompt(lines, [15, 0, 1]).kind, 'text');
});

void test('classifyPrompt recognizes the mid-screen player-name prompt', () => {
    const lines = new Array<string>(24).fill('');
    lines[12] = 'Who are you? ';
    const cls = classifyPrompt(lines, [13, 12, 1]);
    assert.equal(cls.kind, 'text');
    assert.match(cls.detail, /who are you/i);
});

void test('getobj item prompts are text prompts and get cancelled cleanly', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'What do you want to use or apply? [e or ?*]';
    const cls = classifyPrompt(lines, [43, 0, 1]);
    assert.equal(cls.kind, 'text');
    const driver = createHoldoutPolicy({ kind: 'fuzz', seed: 1, maxSteps: 10 });
    assert.equal(driver.nextKey(lines, { cursor: [43, 0, 1] }), '\x1b');
    // With the cursor on the map the same text is a leftover message.
    assert.equal(classifyPrompt(lines, HERO_CURSOR).kind, 'command');
});

void test('classifyPrompt recognizes the getpos picker', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = '(For instructions type a \'?\')';
    assert.equal(classifyPrompt(lines, HERO_CURSOR).kind, 'getpos');
});

// ---------------------------------------------------------------------------
// parseStatus
// ---------------------------------------------------------------------------

void test('parseStatus reads hp, level, turns and hunger', () => {
    const lines = simpleCommandScreen().slice();
    lines[23] = 'Dlvl:2 $:19 HP:14(18) Pw:1(1) AC:9 Xp:1/9 T:409 Weak';
    const st = parseStatus(decodeScreen(lines));
    assert.ok(st);
    assert.equal(st.hp, 14);
    assert.equal(st.hpMax, 18);
    assert.equal(st.dlvl, 2);
    assert.equal(st.turns, 409);
    assert.equal(st.hunger, 'Weak');
});

// ---------------------------------------------------------------------------
// Policy: termination contract
// ---------------------------------------------------------------------------

void test('fuzz policy stops at a command boundary at maxSteps and reports it', () => {
    const driver = createHoldoutPolicy({ kind: 'fuzz', seed: 7, maxSteps: 10 });
    const keys = feed(driver, Array.from({ length: 40 }, simpleCommandScreen));
    assert.equal(keys.length, 10);
    assert.ok(driver.exhausted);
    assert.equal(driver.summary.stopReason, 'max-steps');
    assert.equal(driver.summary.keysSent, 10);
    assert.equal(driver.nextKey(simpleCommandScreen(), { cursor: HERO_CURSOR }), null);
});

void test('policies drain prompts past maxSteps instead of stopping inside them', () => {
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 3, maxSteps: 5 });
    const screens = [];
    for (let i = 0; i < 4; i++) screens.push(simpleCommandScreen());
    const more = simpleCommandScreen();
    more[0] = 'You hit the jackal. --More--';
    for (let i = 0; i < 3; i++) screens.push(more);
    screens.push(simpleCommandScreen());
    const keys = feed(driver, screens);
    assert.equal(keys.length, 7);
    assert.equal(keys.slice(4).join(''), '   ');
    assert.equal(driver.summary.stopReason, 'max-steps');
    assert.ok(driver.exhausted);
});

void test('a policy throws instead of looping in prompts forever (hard overrun)', () => {
    const driver = createHoldoutPolicy({ kind: 'fuzz', seed: 11, maxSteps: 4 });
    const more = simpleCommandScreen();
    more[0] = 'You feel troubled. --More--';
    assert.throws(
        () => feed(driver, Array.from({ length: 500 }, () => more)),
        /no command boundary/,
    );
    assert.ok(driver.exhausted);
    assert.equal(driver.summary.stopReason, 'prompt-overrun');
    assert.equal(driver.nextKey(more, { cursor: HERO_CURSOR }), null);
});

void test('policies tolerate the native death sequence and end cleanly', () => {
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 5, maxSteps: 50 });
    const dead = simpleCommandScreen();
    dead[0] = 'You died...  Do you want your possessions identified? [ynq] (n)';
    dead[23] = 'Dlvl:1 $:0 HP:0(16) Pw:1(1) AC:9 Xp:1/9 T:60';
    const keys = [];
    for (let i = 0; i < 20; i++) {
        const k = driver.nextKey(dead, { cursor: HERO_CURSOR });
        if (k === null) break;
        keys.push(k);
    }
    assert.equal(keys[0], 'n');
    assert.ok(driver.summary.dead);
    const pager = simpleCommandScreen();
    pager[5] = ' --More--';
    assert.equal(driver.nextKey(pager, { cursor: HERO_CURSOR }), ' ');
});

void test('policy factory validates its config', () => {
    assert.throws(() => createHoldoutPolicy({ kind: 'nope', seed: 1, maxSteps: 10 }), /kind/);
    assert.throws(() => createHoldoutPolicy({ kind: 'fuzz', seed: 'x', maxSteps: 10 }), /seed/);
    assert.throws(() => createHoldoutPolicy({ kind: 'fuzz', seed: 1, maxSteps: 0 }), /maxSteps/);
    assert.equal(createHoldoutPolicy({ kind: 'fuzz', seed: 1, maxSteps: 10 }).acceptsGameExit, true);
});

// ---------------------------------------------------------------------------
// Policy: behavior
// ---------------------------------------------------------------------------

void test('fuzz policy is deterministic for the same seed and screens', () => {
    const screens = Array.from({ length: 30 }, simpleCommandScreen);
    const a = feed(createHoldoutPolicy({ kind: 'fuzz', seed: 99, maxSteps: 30 }), screens);
    const b = feed(createHoldoutPolicy({ kind: 'fuzz', seed: 99, maxSteps: 30 }), screens);
    const c = feed(createHoldoutPolicy({ kind: 'fuzz', seed: 100, maxSteps: 30 }), screens);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
});

void test('fuzz policy favors turn-consuming commands and single-character keys', () => {
    const keys = feed(
        createHoldoutPolicy({ kind: 'fuzz', seed: 2024, maxSteps: 400 }),
        Array.from({ length: 500 }, simpleCommandScreen),
    );
    assert.equal(keys.length, 400);
    for (const k of keys) assert.equal(typeof k, 'string', `key ${JSON.stringify(k)}`);
    const counts: Record<string, number> = {};
    for (const k of keys) counts[k] = (counts[k] ?? 0) + 1;
    const moveish = 'hjklyubnHJKLYUBN'.split('').reduce((n, c) => n + (counts[c] ?? 0), 0);
    assert.ok(moveish >= keys.length * 0.5, `movement share ${moveish}/${keys.length}`);
    for (const must of ['s', 'i', ',']) assert.ok(counts[must], `expected some ${must}`);
});

void test('policies descend from remembered stairs once the hero stands on them', () => {
    // First screen shows '>' at (6,6); later screens put the hero there, so
    // the glyph is hidden by '@' and only stair memory can trigger descent.
    const seen = simpleCommandScreen();
    const onStairs = simpleCommandScreen();
    onStairs[6] = '  \x0ex\x0f    @   \x0ex\x0f';
    const explore = createHoldoutPolicy({ kind: 'explore', seed: 17, maxSteps: 10 });
    explore.nextKey(seen, { cursor: HERO_CURSOR });
    const k = explore.nextKey(onStairs, { cursor: [6, 6, 1] });
    assert.equal(k, '>');
    const fuzz = createHoldoutPolicy({ kind: 'fuzz', seed: 424242, maxSteps: 60 });
    fuzz.nextKey(seen, { cursor: HERO_CURSOR });
    const keys = [fuzz.nextKey(onStairs, { cursor: [6, 6, 1] })];
    for (let i = 0; i < 20 && !keys.includes('>'); i++) {
        keys.push(fuzz.nextKey(onStairs, { cursor: [6, 6, 1] }));
    }
    assert.ok(keys.includes('>'));
});

void test('explore policy steps toward unknown map space, not into walls', () => {
    // Room 3 wide, hero at center row 5, unknown space east.
    const fresh = new Array<string>(24).fill('');
    fresh[0] = 'You swap places with your kitten.';
    fresh[4] = '  \x0elqqqk\x0f';
    fresh[5] = '  \x0ex\x0f.@ \x0ex\x0f';
    fresh[6] = '  \x0emqqqj\x0f';
    fresh[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    fresh[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:3';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 1, maxSteps: 6 });
    const keys = feed(driver, [fresh], [3, 5, 1]);
    assert.equal(keys[0], 'l');
});

void test('explore policy rests when badly hurt with no monsters adjacent', () => {
    const lines = simpleCommandScreen();
    lines[23] = 'Dlvl:1 $:0 HP:3(16) Pw:1(1) AC:9 Xp:1 T:9';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 8, maxSteps: 30 });
    const keys = feed(driver, Array.from({ length: 10 }, () => lines), HERO_CURSOR);
    assert.ok(keys.slice(0, 5).every((k) => k === '.'));
});

void test('explore policy attacks an adjacent monster once hp is dropping', () => {
    // 'd' one row above the hero at (5,5): direction k.
    const healthy = simpleCommandScreen();
    healthy[4] = '  \x0ex\x0f    d  \x0ex\x0f';
    healthy[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:9';
    const hurt = simpleCommandScreen();
    hurt[4] = '  \x0ex\x0f    d  \x0ex\x0f';
    hurt[23] = 'Dlvl:1 $:0 HP:13(16) Pw:1(1) AC:9 Xp:1 T:10';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 8, maxSteps: 30 });
    // Full hp next to a letter (often the pet): keep exploring, no attack.
    assert.notEqual(driver.nextKey(healthy, { cursor: HERO_CURSOR }), 'k');
    assert.equal(driver.summary.attacks, 0);
    // After taking damage the same glyph is treated as hostile.
    assert.equal(driver.nextKey(hurt, { cursor: HERO_CURSOR }), 'k');
    assert.equal(driver.summary.attacks, 1);
});

void test('explore policy eats when weak and picks food from a menu', () => {
    const hungry = simpleCommandScreen();
    hungry[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:120 Weak';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 2, maxSteps: 20 });
    assert.equal(driver.nextKey(hungry, { cursor: HERO_CURSOR }), 'e');
    const menu = simpleCommandScreen();
    menu[0] = 'Weapons';
    menu[1] = ' a - an uncursed +0 short sword';
    menu[2] = ' b - 2 food rations';
    menu[3] = ' c - a lock pick';
    menu[4] = '(end)';
    assert.equal(driver.nextKey(menu, { cursor: HERO_CURSOR }), 'b');
});

void test('explore policy learns food letters from the ? listing and eats', () => {
    const hungry = simpleCommandScreen();
    hungry[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:120 Weak';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 2, maxSteps: 20 });
    assert.equal(driver.nextKey(hungry, { cursor: HERO_CURSOR }), 'e');
    const ask = simpleCommandScreen();
    ask[0] = 'What do you want to eat? [d or ?*]';
    assert.equal(driver.nextKey(ask, { cursor: [35, 0, 1] }), '?');
    const listing = simpleCommandScreen();
    listing[0] = 'd - an uncursed food ration.--More--';
    assert.equal(driver.nextKey(listing, { cursor: [45, 0, 1] }), ' ');
    assert.equal(driver.nextKey(ask, { cursor: [35, 0, 1] }), 'd');
});

void test('explore policy searches rather than descending a dead level forever', () => {
    // Hero alone in a fully mapped room: no frontier, no visible stairs.
    const fresh = new Array<string>(24).fill('');
    fresh[0] = '';
    fresh[4] = '  \x0elqqqk\x0f';
    fresh[5] = '  \x0ex\x0f.@.\x0ex\x0f';
    fresh[6] = '  \x0emqqqj\x0f';
    fresh[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    fresh[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:3';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 3, maxSteps: 30 });
    const keys = feed(driver, Array.from({ length: 40 }, () => fresh), [3, 5, 1]);
    assert.ok(keys.includes('s'), `expected search among ${keys.join('')}`);
});

void test('explore policy stops bumping a wall it cannot pass', () => {
    // Hero at (3,5) in a one-wide dead end opening east; the west side is
    // solid. Repeated no-move screens must stop producing 'h'.
    const fresh = new Array<string>(24).fill('');
    fresh[0] = 'Ouch! You bump into a wall.';
    fresh[4] = '   \x0elqqqk\x0f';
    fresh[5] = '    @..\x0ex\x0f';
    fresh[6] = '   \x0emqqqj\x0f';
    fresh[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    fresh[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:5';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 21, maxSteps: 40 });
    const keys = feed(driver, Array.from({ length: 30 }, () => fresh), [4, 5, 1]);
    const hCount = keys.filter((k) => k === 'h').length;
    assert.ok(hCount <= 2, `kept bumping west: ${keys.join('')}`);
});

void test('explore policy opens a closed door on its path', () => {
    // Corridor east ends at a closed door in a wall; the only frontier is
    // the door itself. Expect 'o' followed by the remembered direction.
    const fresh = new Array<string>(24).fill('');
    fresh[0] = '';
    fresh[4] = '  \x0elqqqqk\x0f';
    fresh[5] = '  ##@#+###';
    fresh[6] = '  \x0emqqqqj\x0f';
    fresh[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    fresh[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:5';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 23, maxSteps: 12 });
    const k1 = driver.nextKey(fresh, { cursor: [4, 5, 1] });
    assert.equal(k1, 'l');
    const heroAtDoor = fresh.slice();
    heroAtDoor[5] = '  ###@+###';
    const k2 = driver.nextKey(heroAtDoor, { cursor: [5, 5, 1] });
    assert.equal(k2, 'o');
    const dirPrompt = simpleCommandScreen();
    dirPrompt[0] = 'In what direction?';
    assert.equal(driver.nextKey(dirPrompt, { cursor: [18, 0, 1] }), 'l');
    assert.equal(driver.summary.doorsOpened, 1);
});

void test('chargen questions get answered and name prompts type the configured name', () => {
    const lines = simpleCommandScreen();
    lines[0] = 'Shall I pick a character for you? [ynaq]';
    const driver = createHoldoutPolicy({ kind: 'fuzz', seed: 6, maxSteps: 50, name: 'Ada' });
    assert.equal(driver.nextKey(lines, { cursor: [44, 0, 1] }), 'y');
    const who = new Array<string>(24).fill('');
    who[12] = 'Who are you? ';
    assert.deepEqual(
        [driver.nextKey(who, { cursor: [13, 12, 1] }),
         driver.nextKey(who, { cursor: [14, 12, 1] }),
         driver.nextKey(who, { cursor: [15, 12, 1] }),
         driver.nextKey(who, { cursor: [16, 12, 1] })],
        ['A', 'd', 'a', '\r'],
    );
});

void test('an already-answered yn question with the cursor on the map is a command screen', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'Really step onto that falling rock trap? [yn] (n)';
    // Live prompt: cursor sits at the end of the question.
    assert.equal(classifyPrompt(lines, [50, 0, 1]).kind, 'yn');
    // Stale question after answering: cursor back on the hero.
    const cls = classifyPrompt(lines, HERO_CURSOR);
    assert.equal(cls.kind, 'command');
    const driver = createHoldoutPolicy({ kind: 'fuzz', seed: 5, maxSteps: 3 });
    // The boundary stop works on the stale-question screen.
    driver.nextKey(simpleCommandScreen(), { cursor: HERO_CURSOR });
    driver.nextKey(simpleCommandScreen(), { cursor: HERO_CURSOR });
    driver.nextKey(simpleCommandScreen(), { cursor: HERO_CURSOR });
    assert.equal(driver.nextKey(lines, { cursor: HERO_CURSOR }), null);
    assert.equal(driver.summary.stopReason, 'max-steps');
    // Without a cursor the classifier keeps the legacy text-only behavior.
    assert.equal(classifyPrompt(lines).kind, 'yn');
});

void test('a stale direction question is also demoted', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'In what direction?';
    assert.equal(classifyPrompt(lines, [18, 0, 1]).kind, 'direction');
    assert.equal(classifyPrompt(lines, HERO_CURSOR).kind, 'command');
});

void test('declining a forced step blocks the refused cell', () => {
    // Corridor row 5: floor cells 2-4, then a '%' item hiding a known trap at
    // (5,5). Beyond it is unknown space — the only way forward.
    const build = (heroCol: number, message: string) => {
        const room = new Array<string>(24).fill('');
        room[0] = message;
        const cells = ' '.repeat(9).split('');
        cells[2] = '.';
        cells[3] = '.';
        cells[4] = '.';
        cells[5] = '%';
        cells[heroCol] = '@';
        room[4] = '   -----';
        room[5] = cells.join('');
        room[6] = '   -----';
        room[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
        room[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:9';
        return room;
    };
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 31, maxSteps: 30 });
    let hero = 2;
    let pendingAsk = false;
    const keys = [];
    let asks = 0;
    for (let i = 0; i < 24; i++) {
        if (pendingAsk) {
            pendingAsk = false;
            asks++;
            keys.push(driver.nextKey(
                build(hero, 'Really step onto that falling rock trap? [yn] (n)'),
                { cursor: [50, 0, 1] }));
            continue;
        }
        const k = driver.nextKey(build(hero, ''), { cursor: [hero, 5, 1] });
        if (k === null) break;
        keys.push(k);
        if (k === 'l') {
            if (hero === 4) pendingAsk = true;
            else hero++;
        } else if (k === 'h' && hero > 2) {
            hero--;
        }
    }
    assert.ok(asks <= 1, `kept stepping toward the hidden trap (${asks} refusals): ${keys.join('')}`);
});

void test('a locked-door message on a More screen blocks that door', () => {
    const build = (heroCol: number, message: string) => {
        const room = new Array<string>(24).fill('');
        room[0] = message;
        room[4] = '  \x0elqqqqk\x0f';
        room[5] = `  ##${heroCol === 4 ? '@' : '#'}#${heroCol === 5 ? '@' : '#'}+###`.slice(0, 10);
        // hero at heroCol (4 or 5), door at (6,5)
        room[5] = '  ##' + (heroCol === 4 ? '@' : '#') + (heroCol === 5 ? '@' : '#') + '+###';
        room[6] = '  \x0emqqqqj\x0f';
        room[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
        room[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:5';
        return room;
    };
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 23, maxSteps: 30 });
    assert.equal(driver.nextKey(build(4, ''), { cursor: [4, 5, 1] }), 'l');
    assert.equal(driver.nextKey(build(5, ''), { cursor: [5, 5, 1] }), 'o');
    const dirPrompt = build(5, 'In what direction?');
    assert.equal(driver.nextKey(dirPrompt, { cursor: [18, 0, 1] }), 'l');
    const locked = build(5, 'This door is locked.--More--');
    assert.equal(driver.nextKey(locked, { cursor: [26, 0, 1] }), ' ');
    let sawOpen = false;
    for (let i = 0; i < 12; i++) {
        const k = driver.nextKey(build(5, ''), { cursor: [5, 5, 1] });
        if (k === null) break;
        if (k === 'o') sawOpen = true;
    }
    assert.ok(!sawOpen, 'kept opening the locked door');
});

void test('wizard-mode Die? is accepted and a living screen clears death mode', () => {
    const dead = simpleCommandScreen();
    dead[0] = 'You die...  Do you want your possessions identified? [ynq] (n)';
    dead[23] = 'Dlvl:1 $:0 HP:0(16) Pw:1(1) AC:9 Xp:1/9 T:60';
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 5, maxSteps: 50 });
    driver.nextKey(dead, { cursor: HERO_CURSOR });
    assert.ok(driver.summary.dead);
    const dieAsk = simpleCommandScreen();
    dieAsk[0] = 'Die? [yn] (n)';
    assert.equal(driver.nextKey(dieAsk, { cursor: [4, 0, 1] }), 'y');
    // If the hero ends up alive anyway, normal play resumes.
    const alive = simpleCommandScreen();
    alive[23] = 'Dlvl:1 $:0 HP:5(16) Pw:1(1) AC:9 Xp:1 T:61';
    const k = driver.nextKey(alive, { cursor: HERO_CURSOR });
    assert.notEqual(k, null);
    assert.notEqual(driver.summary.dead, true);
});

void test('a menu overlaid on the map is still a menu', () => {
    // The eat '?' listing can open a full inventory menu that shares rows
    // with visible map glyphs (Comestibles over a room, ranger replay).
    const lines = new Array<string>(24).fill('');
    lines[0] = '\x1b[41C\x1b[7mComestibles\x1b[0m';
    lines[1] = '\x1b[41Cf - 5 uncursed tripe rations';
    lines[2] = '            \x0elqqqqqqqqqk\x0f  g - 2 uncursed food rations';
    lines[3] = '            \x0ex~~~~~~~~~~\x0f  (end)';
    lines[4] = '            \x0ex~~~~~~~~~x\x0f';
    lines[5] = '            \x0e~~~~~~@d~~x\x0f';
    lines[6] = '            \x0ex~~~~~~$~~~';
    lines[7] = '            \x0ex~~o~~~~~~x\x0f';
    lines[8] = '            \x0emqqqqq+qqqj\x0f';
    lines[22] = 'Holdout the Tenderfoot         St:15 Dx:12 Co:14 In:14 Wi:13 Ch:11 Chaotic';
    lines[23] = 'Dlvl:1 $:0 HP:14(14) Pw:2(2) AC:7 Xp:1/0 T:1';
    const cls = classifyPrompt(lines, [47, 3, 1]);
    assert.equal(cls.kind, 'menu');
    assert.ok(cls.items);
    assert.ok(cls.items.length >= 2);
});

void test('bracketed non-yes/no questions are answered from the advertised letters', () => {
    const lines = simpleCommandScreen().slice();
    lines[0] = 'Which ring-finger, Right or Left? [rl]';
    const cls = classifyPrompt(lines, [40, 0, 1]);
    assert.equal(cls.kind, 'yn');
    const driver = createHoldoutPolicy({ kind: 'fuzz', seed: 1, maxSteps: 5 });
    assert.equal(driver.nextKey(lines, { cursor: [40, 0, 1] }), 'r');
    const sel = simpleCommandScreen().slice();
    sel[0] = 'Choose an altar [abc]';
    assert.equal(driver.nextKey(sel, { cursor: [20, 0, 1] }), 'a');
    const ynq = simpleCommandScreen().slice();
    ynq[0] = 'Really save? [ynq] (n)';
    assert.equal(driver.nextKey(ynq, { cursor: [23, 0, 1] }), 'n');
});

void test('a question wrapped onto the next row stays a live prompt', () => {
    const lines = new Array<string>(24).fill('');
    lines[0] = 'Really step onto that falling rock trap';
    lines[1] = 'while helpless? [yn] (n)';
    lines[22] = 'Holdout the Candidate\x1b[9CSt:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    lines[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:9';
    // Cursor at the end of the wrapped text on row 1: live prompt.
    assert.equal(classifyPrompt(lines, [23, 1, 1]).kind, 'yn');
    // Cursor deep on the map away from question text: stale leftover.
    lines[8] = '   @';
    assert.equal(classifyPrompt(lines, [3, 8, 1]).kind, 'command');
});

void test('policies cancel direction prompts, counts and stray text prompts', () => {
    const driver = createHoldoutPolicy({ kind: 'explore', seed: 9, maxSteps: 30 });
    const dir = simpleCommandScreen();
    dir[0] = 'In what direction?';
    assert.equal(driver.nextKey(dir, { cursor: [18, 0, 1] }), '\x1b');
    const count = simpleCommandScreen();
    count[0] = 'Count: 3';
    assert.equal(driver.nextKey(count, { cursor: [9, 0, 1] }), '\x1b');
    const text = simpleCommandScreen();
    text[0] = 'What do you want to call the short sword?';
    assert.equal(driver.nextKey(text, { cursor: [41, 0, 1] }), '\x1b');
});
