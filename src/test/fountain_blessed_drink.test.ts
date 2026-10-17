import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { A_STR, FOUNTAIN } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { readObjectName } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';

for (const wish of ['magic fountain', 'blessed fountain']) {
    void test(`a wished ${wish} restores drained attributes and grants an ability gain`, async () => {
        freshObjectRoom({ hero: { uluck: 0, acurr: { a: [8, 9, 10, 11, 10, 9] } } });
        requirePlayingGame(game);
        await readObjectName(wish, { wizardWish: true });
        resetInputState().feed('y' + ' '.repeat(20));
        initRng(6n);

        await rhack('q'.charCodeAt(0));

        assert.ok(game.u.acurr.a.every(value => value >= 12),
            `Drained attributes remain: ${game.u.acurr.a.join(', ')}`);
        assert.equal(game.u.acurr.a.filter(value => value === 13).length, 1);
        assert.equal(game.level.requireAt(10, 10).typ, FOUNTAIN);
        assert.equal(!!game.level.requireAt(10, 10).blessedftn, false);
        assert.match(game._pending_message, /A wisp of vapor escapes the fountain/);
    });
}

void test('a refreshing drink from a wished magic fountain preserves its blessing and water', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await readObjectName('magic fountain', { wizardWish: true });
    const hunger = game.u.uhunger;
    resetInputState().feed('y' + ' '.repeat(20));
    initRng(5n);

    await rhack('q'.charCodeAt(0));

    const fountain = game.level.requireAt(10, 10);
    assert.equal(fountain.typ, FOUNTAIN);
    assert.equal(!!fountain.blessedftn, true);
    assert.ok(game.u.uhunger > hunger);
    assert.equal(game.u.acurr.a[A_STR], 12);
});

for (const luck of [0, 4]) {
    void test(`a blessed fountain restores drained attributes and grants ${luck < 4 ? 'one gain' : 'all gains'} at luck ${luck}`, async () => {
        freshObjectRoom({ hero: { uluck: luck, acurr: { a: [8, 9, 10, 11, 10, 9] } } });
        requirePlayingGame(game);
        const fountain = game.level.requireAt(10, 10);
        fountain.typ = FOUNTAIN;
        fountain.blessedftn = 1;
        resetInputState().feed('y' + ' '.repeat(20));
        initRng(6n); // A draught with an effect, rather than simple refreshment.

        await rhack('q'.charCodeAt(0));

        assert.equal(fountain.typ, FOUNTAIN);
        assert.equal(fountain.blessedftn, 0);
        assert.ok(game.u.acurr.a.every(value => value >= 12));
        assert.equal(game.u.acurr.a.filter(value => value === 13).length, luck < 4 ? 1 : 6);
        assert.match(game._pending_message, /A wisp of vapor escapes the fountain/);
        assert.equal(game.context.move, 1);
    });
}

void test('Escape during a blessed fountain drink finishes the reward without another acknowledgment', async () => {
    freshObjectRoom({ hero: { uluck: 4 } });
    requirePlayingGame(game);
    const fountain = game.level.requireAt(10, 10);
    fountain.typ = FOUNTAIN;
    fountain.blessedftn = 1;
    const input = resetInputState();
    input.feed('y\x1b');
    input.display = {
        async readKey() {
            assert.fail(`Drinking asks for more input after Escape: ${game._pending_message}`);
        },
    };
    initRng(6n);

    await rhack('q'.charCodeAt(0));

    assert.ok(game.u.acurr.a.every(value => value === 13));
    assert.equal(fountain.blessedftn, 0);
    assert.equal(game.context.move, 1);
});

void test('a refreshing drink preserves the blessing and cannot dry the fountain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const fountain = game.level.requireAt(10, 10);
    fountain.typ = FOUNTAIN;
    fountain.blessedftn = 1;
    const hunger = game.u.uhunger;
    resetInputState().feed('y' + ' '.repeat(10));
    initRng(33n);

    await rhack('q'.charCodeAt(0));

    assert.equal(fountain.typ, FOUNTAIN);
    assert.equal(fountain.blessedftn, 1);
    assert.ok(game.u.uhunger > hunger);
    assert.equal(game.u.acurr.a[A_STR], 12);
});

void test('negative natural luck prevents the blessed fountain attribute reward', async () => {
    freshObjectRoom({ hero: { uluck: -1, moreluck: 3 } });
    requirePlayingGame(game);
    const fountain = game.level.requireAt(10, 10);
    fountain.typ = FOUNTAIN;
    fountain.blessedftn = 1;
    resetInputState().feed('y' + ' '.repeat(10));
    initRng(6n);

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], 12);
    assert.match(game._pending_message, /tepid water is tasteless/);
});
