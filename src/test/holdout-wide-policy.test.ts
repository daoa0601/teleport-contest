import test from 'node:test';
import assert from 'node:assert/strict';
import { createHoldoutPolicy } from '../scripts/lib/holdout-policy.mjs';
import { decodePolicyConfig, decodeSession, type Cursor } from '../scripts/lib/session-types.mjs';
import { decodeGeneratorKind } from '../scripts/holdout/types.mjs';

function screen(message = ''): string[] {
    const rows = new Array<string>(24).fill('');
    rows[0] = message;
    rows[4] = '   -----';
    rows[5] = '   |.@.|';
    rows[6] = '   -----';
    rows[22] = 'Holdout the Candidate St:18 Dx:12 Co:18 In:8 Wi:9 Ch:8 Lawful';
    rows[23] = 'Dlvl:1 $:0 HP:16(16) Pw:1(1) AC:9 Xp:1 T:42';
    return rows;
}

const hero: Cursor = [5, 5, 1];
const policy = (seed = 1, maxSteps = 100) => createHoldoutPolicy({ kind: 'wide', seed, maxSteps });

void test('wide configs and recorded driver summaries survive the JSON boundary', () => {
    assert.equal(decodeGeneratorKind('wide'), 'wide');
    assert.equal(decodePolicyConfig({ kind: 'wide', seed: 1, maxSteps: 10 }).kind, 'wide');
    const driver = policy();
    const session = decodeSession({ version: 5, segments: [{ seed: 1, datetime: '20260101000000',
        nethackrc: '', recording: { termination: 'input-boundary', exitCode: null,
            suppliedKeys: 0, driver: driver.summary } }] });
    assert.equal(session.segments[0]?.recording?.driver?.kind, 'wide');
});

void test('wide selects only advertised inventory items, including letter ranges', () => {
    const message = 'What do you want to zap? [b-dQ or ?*]';
    const answers = new Set<string | null>();
    for (let seed = 1; seed <= 80; seed++) {
        const key = policy(seed).nextKey(screen(message), { cursor: [message.length + 1, 0, 1] });
        assert.ok(key !== null && 'bcdQ\x1b'.includes(key), `unadvertised choice ${JSON.stringify(key)}`);
        answers.add(key);
    }
    assert.ok(answers.has('Q'), 'uppercase inventory letters remain selectable');
    assert.ok(answers.has('c'), 'range interiors remain selectable');
    assert.ok(answers.has('\x1b'), 'some item prompts are cancelled');
});

void test('wide answers wrapped object prompts from their advertised choices', () => {
    const rows = screen('What do you want to throw?');
    rows[1] = '[f-h or ?*]';
    const key = policy().nextKey(rows, { cursor: [13, 1, 1] });
    assert.ok(key !== null && 'fgh\x1b'.includes(key), JSON.stringify(key));
});

void test('wide chooses yes and no, but refuses to leave or save the game', () => {
    const message = 'Are you sure you want to pray? [yn] (n)';
    const answers = new Set<string | null>();
    for (let seed = 1; seed <= 40; seed++) {
        answers.add(policy(seed).nextKey(screen(message), { cursor: [message.length + 1, 0, 1] }));
    }
    assert.ok(answers.has('y'));
    assert.ok(answers.has('n'));
    for (const question of ['Really save? [yn] (n)', 'Really quit? [yn] (n)',
        'Beware, there will be no return! Still climb? [yn] (n)']) {
        assert.equal(policy().nextKey(screen(question), { cursor: [question.length + 1, 0, 1] }), 'n');
    }
});

void test('wide selects one or two menu entries and accepts the selection', () => {
    const rows = screen('What would you like to drop?');
    rows[1] = ' b - a dagger';
    rows[2] = ' Q - a food ration';
    rows[3] = '(end)';
    let selections = 0;
    let accepted = false;
    for (let seed = 1; seed <= 30; seed++) {
        const driver = policy(seed);
        const chosen = new Set<string>();
        for (let step = 0; step < 4; step++) {
            const key = driver.nextKey(rows, { cursor: [7, 3, 1] });
            if (key === '\r' || key === '\x1b') { accepted ||= key === '\r'; break; }
            assert.ok(key === 'b' || key === 'Q', `unexpected menu answer ${JSON.stringify(key)}`);
            assert.ok(!chosen.has(key), 'a selected entry must not be toggled off');
            chosen.add(key);
        }
        assert.ok(chosen.size <= 2);
        selections += chosen.size;
    }
    assert.ok(selections > 0);
    assert.ok(accepted);
});

void test('wide keeps moving the getpos cursor after automatic descriptions replace the prompt', () => {
    let picked = false;
    let moved = false;
    for (let seed = 1; seed <= 20; seed++) {
        const driver = policy(seed);
        let rows = screen("(For instructions type a '?')");
        for (let step = 0; step < 5; step++) {
            const key = driver.nextKey(rows, { cursor: [6, 5, 1] });
            if (key === '.' || key === ',' || key === '\x1b') { picked ||= key !== '\x1b'; break; }
            assert.ok(key !== null && 'hjklyubn'.includes(key), `unexpected targeting key ${JSON.stringify(key)}`);
            moved = true;
            rows = screen('a floor (6,5)');
        }
    }
    assert.ok(moved);
    assert.ok(picked);
});

void test('wide dismisses More and drains prompts before stopping at its key limit', () => {
    const driver = policy(1, 1);
    assert.equal(driver.nextKey(screen('A message --More--'), { cursor: [22, 0, 1] }), ' ');
    const question = 'What do you want to read? [j or ?*]';
    assert.equal(driver.nextKey(screen(question), { cursor: [question.length + 1, 0, 1] }), '\x1b');
    assert.equal(driver.nextKey(screen(), { cursor: hero }), null);
    assert.equal(driver.summary.stopReason, 'max-steps');
});

void test('wide finishes a small count with a command instead of accumulating digits', () => {
    const key = policy().nextKey(screen('Count: 3'), { cursor: [8, 0, 1] });
    assert.ok(key !== null && 'hjklyubns.\x1b'.includes(key), JSON.stringify(key));
});

void test('wide completes player names when the prompt is in the middle of the screen', () => {
    const driver = policy();
    let answer = '';
    for (let step = 0; step < 10; step++) {
        const rows = new Array<string>(24).fill('');
        rows[12] = `Who are you? ${answer}`;
        const key = driver.nextKey(rows, { cursor: [13 + answer.length, 12, 1] });
        assert.ok(key !== null);
        if (key === '\r') break;
        answer += key;
    }
    assert.equal(answer, 'Holdout');
});

void test('wide supplies bounded numeric-pad counts and a following movement command', () => {
    let counted = false;
    for (let seed = 1; seed <= 500 && !counted; seed++) {
        const driver = policy(seed);
        if (driver.nextKey(screen(), { cursor: hero }) !== 'n') continue;
        const digit = driver.nextKey(screen(), { cursor: hero });
        if (digit === null || !'2345'.includes(digit)) continue;
        const move = driver.nextKey(screen(`Count: ${digit}`), { cursor: [8, 0, 1] });
        assert.ok(move !== null && 'hjklyubn'.includes(move), JSON.stringify(move));
        counted = true;
    }
    assert.ok(counted, 'n-prefixed counts are reachable');
});

void test('wide reaches item, extended, control and movement commands without save or quit', () => {
    const driver = policy(47, 6000);
    const keys = new Set<string>();
    let extended = '';
    const words = new Set<string>();
    for (let step = 0; step < 6200; step++) {
        const key = driver.nextKey(screen(extended ? `# ${extended.slice(1)}` : ''),
            { cursor: extended ? [extended.length + 1, 0, 1] : hero });
        if (key === null) break;
        assert.equal(key.length, 1);
        if (extended) {
            if (key === '\r' || key === '\x1b') {
                if (key === '\r') words.add(extended.slice(1));
                extended = '';
            } else extended += key;
        } else if (key === '#') extended = '#';
        else {
            assert.ok(key !== 'S' && key !== 'Q', `exit key ${key}`);
            keys.add(key);
        }
    }
    assert.ok(keys.has('q') && keys.has('z') && keys.has('t'), 'item actions are reachable');
    assert.ok(keys.has('\x18') && keys.has('\x04'), 'control commands are reachable');
    assert.ok(keys.has('G') && keys.has('m') && keys.has('_'), 'movement prefixes and travel are reachable');
    assert.ok(words.has('pray') && words.has('loot') && words.has('adjust'), 'extended actions are reachable');
    assert.ok(!words.has('quit') && !words.has('save'));
});
