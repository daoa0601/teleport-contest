import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { TIMEOUT } from '../js/const.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeDeaf } from '../js/hero_hearing.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { heroIsDeaf, syncDeafness } from '../js/senses.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('new timed deafness commits before its awaited message boundary', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await pline('You carefully examine the old inscriptions covering this long corridor.');
    const input = resetInputState();
    const action = makeDeaf(30);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.deafTurns, 30);
        assert.equal(heroIsDeaf(), true);
        assert.equal(game.deaf, true);
    }
    finally {
        input.feed(' ');
        await action;
    }
    assert.match(game._pending_message, /unable to hear anything/);
});
void test('extending an active hearing timeout is silent', async () => {
    freshObjectRoom({ hero: { deafTurns: 10 } });
    requireFixtureGame(game);
    syncDeafness();
    await makeDeaf(40);
    assert.equal(game.u.deafTurns, 40);
    assert.ok(!game._pending_message);
});
void test('clearing timed deafness restores hearing and announces it', async () => {
    freshObjectRoom({ hero: { deafTurns: 10 } });
    requireFixtureGame(game);
    syncDeafness();
    await makeDeaf(0);
    assert.equal(heroIsDeaf(), false);
    assert.equal(game.deaf, false);
    assert.equal(game._pending_message, 'You can hear again.');
});
for (const name of ['permanent', 'equipment']) {
    void test(`${name} deafness remains when the timed component is cured`, async () => {
        freshObjectRoom({ hero: { deafTurns: 10 } });
        requireFixtureGame(game);
        if (name === 'permanent')
            game.u.uroleplay.deaf = true;
        else
            game.u.extrinsicDeaf = true;
        syncDeafness();
        await makeDeaf(0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(heroIsDeaf(), true);
        assert.equal(game._pending_message, 'You are unable to hear anything.');
    });
}
void test('silent healing clears timed deafness without a line', async () => {
    freshObjectRoom({ hero: { deafTurns: 10 } });
    requireFixtureGame(game);
    syncDeafness();
    await makeDeaf(0, { talk: false });
    assert.equal(heroIsDeaf(), false);
    assert.ok(!game._pending_message);
});
void test('an unaware hero gains and loses timed deafness silently', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await putHeroToSleep(8);
    await makeDeaf(30);
    assert.equal(heroIsDeaf(), true);
    await makeDeaf(0);
    assert.equal(heroIsDeaf(), false);
    assert.ok(!game._pending_message);
});
void test('hearing timeouts clamp to the native duration limit', async () => {
    freshObjectRoom({ hero: { deafTurns: 10 } });
    requireFixtureGame(game);
    await makeDeaf(TIMEOUT + 30);
    assert.equal(game.u.deafTurns, TIMEOUT);
    assert.equal(heroIsDeaf(), true);
});
void test('wizard deafness feedback finishes before its native map redraw', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const input = resetInputState();
    const action = runExtendedCommand('wizintrinsic', 'j\n');
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.deafTurns, 30);
        assert.equal(heroIsDeaf(), true);
        assert.match(game._pending_message, /unable to hear anything/);
    }
    finally {
        input.feed(' ');
        await action;
    }
    assert.equal(game.context.move, 0);
    assert.ok(!game._pending_message);
    await runExtendedCommand('wizintrinsic', 'j\n');
    assert.equal(game.u.deafTurns, 60);
});
void test('the real turn timeout restores hearing when temporary deafness ends', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    game.u.deafTurns = 1;
    syncDeafness();
    input.feed('.');
    await moveloop_core();
    const nextTurn = moveloop_core();
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.deafTurns, 0);
        assert.equal(heroIsDeaf(), false);
        assert.match(game._pending_message, /can hear again/);
    }
    finally {
        input.feed('.');
        await nextTurn;
    }
});
void test('restored hearing interrupts actual counted searching before another search', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    game.u.deafTurns = 1;
    syncDeafness();
    input.feed('3s');
    await moveloop_core();
    assert.ok(game._occupation);
    const nextTurn = moveloop_core();
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.deafTurns, 0);
        assert.equal(game._occupation, null);
        assert.equal(game.multi, 0);
        assert.match(game._pending_message, /can hear again.*stop searching/);
    }
    finally {
        input.feed('.');
        await nextTurn;
    }
});
void test('permanent deafness preserves counted searching when its temporary component expires', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    game.u.deafTurns = 1;
    game.u.uroleplay.deaf = true;
    syncDeafness();
    input.feed('3s');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.deafTurns, 0);
    assert.equal(heroIsDeaf(), true);
    assert.ok(game._occupation);
    assert.ok(game.multi > 0);
});
//# sourceMappingURL=hero_hearing.test.js.map