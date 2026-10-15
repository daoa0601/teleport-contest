import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN, F_WARNED, ROOM } from '../js/const.js';
import { flush_screen, glyphAt, newsym } from '../js/display.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { syncDeafness } from '../js/senses.js';
import { dryFountainAt } from '../js/fountain.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function fountainRoom({ town = false } = {}) {
    freshObjectRoom();
    requireFixtureGame(game);
    const fountain = game.level.requireAt(12, 10);
    fountain.typ = FOUNTAIN;
    fountain.looted = 0;
    game.level.flags.nfountains = 1;
    game.level.flags.has_town = town;
    return fountain;
}

for (const answer of ['n', 'y'] as const) {
    void test(`configured wizard mode can ${answer === 'n' ? 'decline' : 'accept'} fountain drying`, async () => {
        const fountain = fountainRoom();
        requireFixtureGame(game);
        applyNethackrc('OPTIONS=playmode:debug');
        pushKeys(answer + ' '.repeat(30));
        initRng(1n);

        await dryFountainAt(12, 10);

        assert.equal(fountain.typ, answer === 'n' ? FOUNTAIN : ROOM);
        assert.equal(game.level.flags.nfountains, answer === 'n' ? 1 : 0);
    });
}

void test('monster-caused fountain drying does not ask the wizard for permission', async () => {
    const fountain = fountainRoom();
    applyNethackrc('OPTIONS=playmode:debug');
    pushKeys('n' + ' '.repeat(30));
    initRng(1n);

    await dryFountainAt(12, 10, { causedByHero: false });

    assert.equal(fountain.typ, ROOM);
});

void test('visible fountain drying announces the loss before returning', async () => {
    fountainRoom();
    requireFixtureGame(game);
    pushKeys(' '.repeat(30));
    initRng(1n);

    await dryFountainAt(12, 10, { causedByHero: false });
    await flush_screen(1);

    const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen, /The fountain dries up!/);
});

void test('a blind hero does not receive the visible fountain drying line', async () => {
    const fountain = fountainRoom();
    await makeBlinded(10, { talk: false });
    const messages: string[] = [];
    initRng(1n);

    await dryFountainAt(12, 10, { causedByHero: false, publish: async (text: string) => messages.push(text) });

    assert.equal(fountain.typ, ROOM);
    assert.ok(!messages.some(text => /fountain dries up/.test(text)));
});

void test('the newest eligible watchman warns first about a town fountain', async () => {
    const fountain = fountainRoom({ town: true });
    const older = await createMonsterAt('watchman', 13, 10);
    const newer = await createMonsterAt('watch captain', 14, 10);
    older.mpeaceful = newer.mpeaceful = 1;
    const messages: string[] = [];
    initRng(1n);

    await dryFountainAt(12, 10, { publish: async (text: string) => messages.push(text) });

    assert.equal(fountain.typ, FOUNTAIN);
    assert.ok(Number(fountain.looted ?? 0) & F_WARNED);
    assert.ok(messages.some(text => /A watch captain yells:/.test(text)));
});

void test('drying a warned town fountain angers the watch', async () => {
    const fountain = fountainRoom({ town: true });
    const watch = await createMonsterAt('watchman', 13, 10);
    watch.mpeaceful = 1;
    pushKeys(' '.repeat(100));
    initRng(1n);
    await dryFountainAt(12, 10);
    assert.ok(Number(fountain.looted ?? 0) & F_WARNED);

    await dryFountainAt(12, 10);

    assert.equal(fountain.typ, ROOM);
    assert.ok(!watch.mpeaceful);
});

void test('a displayed cloud suppresses the drying line, but an actor drawn over it does not', async () => {
    for (const withMonster of [false, true] as const) {
        const fountain = fountainRoom();
        requireFixtureGame(game);
        game.u.ux = 11;
        if (withMonster) await createMonsterAt('newt', 12, 10);
        await createHarmlessGasCloudSelection(game, [{ x: 12, y: 10 }]);
        newsym(12, 10);
        assert.equal(glyphAt(12, 10)?.kind, withMonster ? 'monster' : 'terrain');
        const messages: string[] = [];
        initRng(1n);

        await dryFountainAt(12, 10, { causedByHero: false, publish: async (text: string) => messages.push(text) });

        assert.equal(fountain.typ, ROOM);
        assert.equal(messages.includes('The fountain dries up!'), withMonster);
    }
});

void test("a deaf hero receives the watchwoman's gesture instead of speech", async () => {
    fountainRoom({ town: true });
    requireFixtureGame(game);
    const watch = await createMonsterAt('watchman', 13, 10);
    watch.mpeaceful = 1;
    watch.female = true;
    game.u.deafTurns = 20;
    syncDeafness();
    const messages: string[] = [];
    initRng(1n);

    await dryFountainAt(12, 10, { publish: async (text: string) => messages.push(text) });

    assert.ok(messages.some(text => /earnestly waves her arms!/.test(text)));
    assert.ok(messages.every(text => !text.includes('yells') && !text.includes('stop using')));
});

void test("an unseen angry guard's whistle cannot be heard by an awake deaf hero", async () => {
    const fountain = fountainRoom({ town: true });
    requireFixtureGame(game);
    fountain.looted = F_WARNED;
    const watch = await createMonsterAt('watchman', 13, 10);
    watch.mpeaceful = 1;
    await makeBlinded(10, { talk: false });
    game.u.deafTurns = 20;
    syncDeafness();
    pushKeys(' '.repeat(100));
    initRng(1n);

    await dryFountainAt(12, 10);
    await flush_screen(1);

    assert.ok(!watch.mpeaceful);
    const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.doesNotMatch(screen, /whistle/);
});

void test('a fountain stays wet while the wizard confirmation waits for input', async () => {
    const fountain = fountainRoom();
    requireFixtureGame(game);
    applyNethackrc('OPTIONS=playmode:debug');
    const input = resetInputState();
    initRng(1n);
    const drying = dryFountainAt(12, 10);
    await input.waitUntilBlocked();
    try {
        assert.equal(fountain.typ, FOUNTAIN);
        assert.equal(game.level.flags.nfountains, 1);
    } finally {
        input.feed('n');
        await drying;
    }
    assert.equal(fountain.typ, FOUNTAIN);
});
