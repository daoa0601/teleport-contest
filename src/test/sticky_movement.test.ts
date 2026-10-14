import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT, WATER, WEB } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
import { resetInputState } from '../js/input.js';

async function heldHero() {
    freshObjectRoom();
    requirePlayingGame(game);
    const holder = await createMonsterAt('owlbear', 9, 10, NO_MINVENT);
    holder.mcanmove = 1;
    holder.mpeaceful = 0;
    game.u.ustuck = holder;
    initRng(1);
    return holder;
}

async function topline(): Promise<string> {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('a failed escape spends a movement attempt without moving the held hero', async () => {
    const holder = await heldHero();

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 10);
    assert.equal(game.u.ustuck, holder);
    assert.equal(game.context.move, 1);
    assert.equal(await topline(), 'You cannot escape from the owlbear!');
});

void test('a tame holder without conflict always lets the hero pull free', async () => {
    const holder = await heldHero();
    holder.mtame = 10;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.ustuck, null);
    assert.match(await topline(), /You pull free from/);
});

void test('pulling free stays visible before refusing a step into a wall of water', async () => {
    const holder = await heldHero();
    holder.mtame = 10;
    requirePlayingGame(game);
    game.flags.tips = false;
    game.level.requireAt(11, 10).typ = WATER;
    const messages: string[] = [];
    resetInputState().display = { async readKey() {
        messages.push(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd());
        return 32;
    } };

    await rhack('l'.charCodeAt(0));

    assert.ok(messages.some(line => /You pull free from.*--More--/.test(line)));
    assert.match(await topline(), /You avoid stepping into the wall of water\./);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.ustuck, null);
});

void test('a holder that has moved away no longer restricts movement', async () => {
    const holder = await heldHero();
    holder.mx = 7;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.ustuck, null);
});

void test('a sticky polymorphed hero releases its captive when moving away', async () => {
    await heldHero();
    installPolymorphedHero('large mimic');

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.ustuck, null);
    assert.match(await topline(), /You release the owlbear/);
});

for (const grip of ['release', 'escape']) {
    for (const peaceful of [true, false]) {
        void test(`${grip} prose stays visible when move-without-pickup bumps into a ${peaceful ? 'peaceful' : 'hostile'} monster`, async () => {
            const holder = await heldHero();
            if (grip === 'release') installPolymorphedHero('large mimic');
            else holder.mtame = 10;
            const target = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
            target.mpeaceful = peaceful;
            pushKeys('l' + ' '.repeat(20));

            await rhack('m'.charCodeAt(0));

            const line = await topline();
            assert.match(line, grip === 'release' ? /You release the owlbear\./ : /You pull free from your owlbear\./);
            assert.match(line, peaceful ? /Pardon me, jackal\./ : /You move right into the jackal\./);
            assert.equal(game.u.ustuck, null);
            assert.equal(game.u.ux, 10);
            assert.equal(target.mx, 11);
            assert.equal(game.context.move, 1);
        });
    }
}

void test('struggling can wake a frozen holder without escaping its grasp', async () => {
    const holder = await heldHero();
    holder.mcanmove = 0;
    holder.mfrozen = 8;
    holder.msleeping = 1;
    initRng(3);

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 10);
    assert.equal(game.u.ustuck, holder);
    assert.equal(holder.mfrozen, 1);
    assert.equal(holder.msleeping, 0);
});

void test('a frozen holder is easier to escape', async () => {
    const holder = await heldHero();
    holder.mcanmove = 0;
    holder.mfrozen = 8;
    initRng(6);

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.ustuck, null);
    assert.equal(holder.mfrozen, 8);
});

void test('a pet refuses to swap onto a trap under the hero', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog, { state: game });
    addTrap(level, WEB, 10, 10);
    initRng(1);

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 10);
    assert.equal(dog.mx, 11);
    assert.match(await topline(), /doesn't want to swap places/);
});
