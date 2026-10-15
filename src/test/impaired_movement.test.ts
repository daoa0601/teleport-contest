import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { ROOM, STONE, W_NONDIGGABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a stunned wall-passing hero can choose a rock square as its destination', async () => {
    const level = freshObjectRoom({ hero: { stunnedTurns: 10 } });
    installPolymorphedHero('xorn');
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++)
            if (x !== 10 || y !== 10) level.requireAt(x, y).typ = STONE;
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 9]);
    assert.equal(game.context.move, 1);
});

void test('an impaired hero spends the turn searching when no neighboring square is reachable', async () => {
    const level = freshObjectRoom({ hero: { stunnedTurns: 10 } });
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++)
            if (x !== 10 || y !== 10) level.requireAt(x, y).typ = STONE;

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.context.move, 1);
});

void test('a stunned grid bug chooses only cardinal movement', async () => {
    freshObjectRoom({ hero: { stunnedTurns: 10 } });
    installPolymorphedHero('grid bug');
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.equal(Math.abs(game.u.ux - 10) + Math.abs(game.u.uy - 10), 1);
});

void test('a stunned tunnelling hero rerolls undiggable stone to reach an open square', async () => {
    const level = freshObjectRoom({ hero: { stunnedTurns: 10 } });
    installPolymorphedHero('rock mole');
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x === 10 && y === 10) continue;
            const neighbor = level.requireAt(x, y);
            neighbor.typ = STONE;
            neighbor.wall_info |= W_NONDIGGABLE;
        }
    }
    level.requireAt(11, 10).typ = ROOM;
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
});
