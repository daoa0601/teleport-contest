import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGameDisplay, game } from '../js/gstate.js';
import { makeConfused, makeStunned } from '../js/hero_mental_status.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { promptDirection } from '../js/tty_prompts.js';
import { freshPlayableRoom } from './support/playable-room.js';
function directionRoom() {
    freshPlayableRoom({ flags: { cmdassist: false } });
    return resetInputState();
}
function visibleText() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
for (const quit of ['\x1b', ' ', '\n', '\r']) {
    void test(`direction cancellation ${JSON.stringify(quit)} preserves the next command`, async () => {
        const input = directionRoom();
        requireFixtureGame(game);
        if (quit === '\n' || quit === '\r')
            game.commandBindings.setNumberPad(1);
        game.u.dx = 1;
        game.u.dy = -1;
        game.u.dz = 1;
        input.feed(quit + 'l');
        assert.equal(await promptDirection(), null);
        assert.equal(game.u.dx, 1);
        assert.equal(game.u.dy, -1);
        assert.equal(game.u.dz, 0);
        assert.equal(await nhgetch(), 'l'.charCodeAt(0));
    });
}
void test('an invalid direction returns without consuming a later valid direction', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    input.feed('!l');
    assert.equal(await promptDirection(), null);
    assert.equal(game._pending_message, 'What a strange direction!');
    assert.equal(await nhgetch(), 'l'.charCodeAt(0));
});
void test('Return honors its native vi movement binding before cancellation characters', async () => {
    const input = directionRoom();
    input.feed('\n');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [0, 1, 0]);
});
void test('self and vertical directions store the native vector on the hero', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    for (const [key, dz] of [['s', 0], ['.', 0], ['<', -1], ['>', 1]]) {
        game.u.dx = 1;
        game.u.dy = 1;
        game.u.dz = 1;
        input.feed(key);
        const direction = await promptDirection();
        assert.ok(direction, 'A valid direction must be accepted.');
        assert.deepEqual({ dx: direction.dx, dy: direction.dy, dz: direction.dz }, { dx: 0, dy: 0, dz });
        assert.deepEqual({ dx: game.u.dx, dy: game.u.dy, dz: game.u.dz }, { dx: 0, dy: 0, dz });
    }
});
void test('a grid bug rejects a diagonal and clears its horizontal vector', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    input.feed('yl');
    assert.equal(await promptDirection(), null);
    assert.deepEqual([game.u.dx, game.u.dy, game.u.dz], [0, 0, 0]);
    assert.equal(game._pending_message, "You can't orient yourself that direction.");
    assert.equal(await nhgetch(), 'l'.charCodeAt(0));
});
void test('explicit direction help waits for dismissal and then prompts again', async () => {
    const input = directionRoom();
    input.feed('?');
    const choosing = promptDirection();
    try {
        assert.equal(await Promise.race([
            input.waitUntilBlocked().then(() => 'waiting'),
            choosing.then(() => 'finished'),
        ]), 'waiting');
        assert.match(visibleText(), /Valid direction keys are:/);
        assert.doesNotMatch(visibleText(), /Invalid direction|Suppress this message/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(visibleText(), /In what direction\?/);
        input.feed('l');
        const direction = await choosing;
        assert.ok(direction, 'A valid direction must be accepted.');
        assert.equal(direction.dx, 1);
        assert.equal(direction.dy, 0);
    }
    finally {
        input.feed(' \x1b');
        await choosing;
    }
});
void test('direction help shows current keypad keys and omits grid-bug diagonals', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    game.commandBindings.setNumberPad(1);
    input.feed('?');
    const choosing = promptDirection();
    try {
        await input.waitUntilBlocked();
        assert.match(visibleText(), /4- \. -6/);
        assert.match(visibleText(), /^ +8 +$/m);
        assert.match(visibleText(), /^ +2 +$/m);
        assert.doesNotMatch(visibleText(), /^ +7|^ +1/m);
    }
    finally {
        input.feed(' \x1b');
        await choosing;
    }
});
void test('invalid-key assistance returns after its window instead of retrying the direction', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.flags.cmdassist = true;
    input.feed('!');
    const choosing = promptDirection();
    try {
        await input.waitUntilBlocked();
        assert.match(visibleText(), /cmdassist: Invalid direction key!/);
        assert.match(visibleText(), /Suppress this message with !cmdassist/);
        input.feed(' l');
        assert.equal(await choosing, null);
        assert.equal(await nhgetch(), 'l'.charCodeAt(0));
    }
    finally {
        input.feed(' \x1b');
        await choosing;
    }
});
void test('a bound redraw key refreshes the map and retries the direction', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.commandBindings.bindKey('!'.charCodeAt(0), 'redraw');
    input.feed('!l');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.equal(direction.dx, 1);
    assert.equal(direction.dy, 0);
    assert.doesNotMatch(visibleText(), /What a strange direction|Invalid direction/);
});
void test('Alt-meta direction input honors a configured meta movement key', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.iflags.altmeta = true;
    game.commandBindings.bindKey('x'.charCodeAt(0) | 128, 'movenorth');
    input.feed('\x1bx');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [0, -1, 0]);
    assert.deepEqual([game.u.dx, game.u.dy, game.u.dz], [0, -1, 0]);
});
void test('Alt-meta keypad movement works in a direction prompt', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.iflags.altmeta = true;
    game.commandBindings.setNumberPad(1);
    input.feed('\x1b4');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [-1, 0, 0]);
});
void test('two Escapes cancel an Alt-meta direction and preserve the next command', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.iflags.altmeta = true;
    input.feed('\x1b\x1bl');
    assert.equal(await promptDirection(), null);
    assert.equal(await nhgetch(), 'l'.charCodeAt(0));
});
void test('stunning can redirect self and restricts grid bugs to cardinal directions', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    await makeStunned(20, { talk: false });
    initRng(271n);
    const selected = new Set();
    for (let attempt = 0; attempt < 24; attempt++) {
        input.feed('.');
        const direction = await promptDirection();
        assert.ok(direction, 'A valid direction must be accepted.');
        assert.equal(Math.abs(direction.dx) + Math.abs(direction.dy), 1);
        assert.deepEqual([game.u.dx, game.u.dy], [direction.dx, direction.dy]);
        selected.add(`${direction.dx},${direction.dy}`);
    }
    assert.ok(selected.size > 1, 'stunning should choose more than one direction');
});
void test('confusion sometimes redirects a horizontal direction but leaves vertical directions intact', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    await makeConfused(20, { talk: false });
    initRng(145n);
    let unchanged = 0, redirected = 0;
    for (let attempt = 0; attempt < 64; attempt++) {
        input.feed('l');
        const direction = await promptDirection();
        assert.ok(direction, 'A valid direction must be accepted.');
        if (direction.dx === 1 && direction.dy === 0)
            unchanged++;
        else
            redirected++;
        assert.deepEqual([game.u.dx, game.u.dy], [direction.dx, direction.dy]);
    }
    assert.ok(unchanged > 0 && redirected > 0);
    await makeStunned(20, { talk: false });
    input.feed('>');
    const down = await promptDirection();
    assert.ok(down);
    assert.deepEqual([down.dx, down.dy, down.dz], [0, 0, 1]);
});
void test('simulated direction clicks reduce distance and bypass grid-bug and impairment restrictions', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    await makeStunned(20, { talk: false });
    input.feed('_uuu.');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [1, -1, 0]);
    assert.deepEqual([game.u.dx, game.u.dy, game.u.dz], [1, -1, 0]);
});
for (const [pickKey, clickType] of [['.', 2], [',', 1], [';', 1], [':', 2]]) {
    void test(`far simulated clicks retain coordinates and report the ${pickKey} click type`, async () => {
        const input = directionRoom();
        requireFixtureGame(game);
        game.iflags.getdir_click = 3;
        input.feed('_lll' + pickKey);
        const direction = await promptDirection();
        assert.ok(direction, 'A valid direction must be accepted.');
        assert.deepEqual([direction.dx, direction.dy, direction.dz], [3, 0, 0]);
        assert.equal(game.iflags.getdir_click, clickType);
    });
}
void test('cancelling a simulated click clears its direction and click mode', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.iflags.getdir_click = 3;
    game.u.dx = 1;
    game.u.dy = 1;
    game.u.dz = 1;
    input.feed('_l\x1bk');
    assert.equal(await promptDirection(), null);
    assert.deepEqual([game.u.dx, game.u.dy, game.u.dz], [0, 0, 0]);
    assert.equal(game.iflags.getdir_click, 0);
    assert.equal(await nhgetch(), 'k'.charCodeAt(0));
});
void test('a simulated click accepts Alt-meta keypad cursor movement and rebound pick keys', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    game.iflags.altmeta = true;
    game.iflags.getdir_click = 3;
    game.commandBindings.setNumberPad(1);
    game.commandBindings.bindSpecialKey('x'.charCodeAt(0) | 128, 'getpos.pick.quick');
    input.feed('_\x1b4\x1bx');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [-8, 0, 0]);
    assert.equal(game.iflags.getdir_click, 1);
});
void test('a rebound simulated-click key takes precedence over its movement binding', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    const key = '!'.charCodeAt(0);
    game.commandBindings.bindSpecialKey(key, 'getdir.mouse');
    game.commandBindings.bindKey(key, 'movenorth');
    input.feed('!ll,');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [1, 0, 0]);
});
void test('self takes precedence when self and simulated-click special keys coincide', async () => {
    const input = directionRoom();
    requireFixtureGame(game);
    const key = '!'.charCodeAt(0);
    game.commandBindings.bindSpecialKey(key, 'getdir.mouse');
    game.commandBindings.bindSpecialKey(key, 'getdir.self');
    input.feed('!');
    const direction = await promptDirection();
    assert.ok(direction, 'A valid direction must be accepted.');
    assert.deepEqual([direction.dx, direction.dy, direction.dz], [0, 0, 0]);
});
//# sourceMappingURL=direction_prompt.test.js.map