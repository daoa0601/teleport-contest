import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { A_CON, A_DEX, DOOR, D_CLOSED, D_ISOPEN, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { makeStunned } from '../js/hero_mental_status.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('opening while stunned redirects a self direction to an adjacent door', async () => {
    const input = freshTurnRoom({ flags: { cmdassist: false } });
    assert.ok(game.level);
    assert.ok(game.u.acurr);
    game.u.acurr.a[A_CON] = game.u.acurr.a[A_DEX] = 25;
    const doors = [[9, 10], [11, 10], [10, 9], [10, 11],
        [9, 9], [11, 9], [9, 11], [11, 11]].map(([x, y]) => {
        if (x === undefined || y === undefined) throw new Error('Door coordinate missing');
        const door = game.level?.requireAt(x, y);
        assert.ok(door);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        return door;
    });
    await makeStunned(20, { talk: false });
    input.feed('o.');
    await rhack(0);
    assert.equal(doors.filter(door => door.doormask === D_ISOPEN).length, 1);
    assert.equal(game.context.move, 1);
});

void test('direction help returns to the opening prompt', async () => {
    const input = freshTurnRoom();
    const door = game.level?.requireAt(11, 10);
    assert.ok(door);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    assert.ok(game.u.acurr);
    game.u.acurr.a[A_CON] = game.u.acurr.a[A_DEX] = 25;
    input.feed('o? l');
    await rhack(0);
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(game.context.move, 1);
});

void test('an impaired close attempt spends time even when no door is found', async () => {
    const input = freshTurnRoom({ flags: { cmdassist: false } });
    await makeStunned(20, { talk: false });
    input.feed('cl');
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You see no door there.');
});

void test('closing toward yourself spends a turn because the hero blocks the door', async () => {
    const input = freshTurnRoom({ flags: { cmdassist: false } });
    input.feed('c.');
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You are in the way!');
});

void test('stunned grid-bug movement stays on the four cardinal axes', async () => {
    freshTurnRoom();
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    await makeStunned(20, { talk: false });
    for (let attempt = 0; attempt < 20; attempt++) {
        game.u.ux = game.u.uy = 10;
        await rhack('l'.charCodeAt(0));
        assert.equal(Math.abs(game.u.ux - 10) + Math.abs(game.u.uy - 10), 1);
    }
});

void test('exhausting stunned movement choices spends a turn and ends a counted walk', async () => {
    const input = freshTurnRoom();
    assert.ok(game.level);
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10) game.level.requireAt(x, y).typ = STONE;
        }
    }
    await makeStunned(20, { talk: false });

    input.feed('4l');
    await rhack(0);

    assert.equal(game.context.move, 1, 'the unsuccessful impaired attempt still takes time');
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(game.multi, 0);
    assert.equal(game.context.mv, false);
});

void test('stunned movement rejects surrounding rock despite temporary wall passing', async () => {
    const input = freshTurnRoom({ hero: { passesWalls: true } });
    assert.ok(game.level);
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10) game.level.requireAt(x, y).typ = STONE;
        }
    }
    await makeStunned(20, { talk: false });

    input.feed('4l');
    await rhack(0);

    assert.equal(game.u.ux, 10, 'impaired movement must find a destination the species can enter');
    assert.equal(game.u.uy, 10);
    assert.equal(game.multi, 0);
    assert.equal(game.context.move, 1);

    await makeStunned(0, { talk: false });
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11, 'temporary wall passing still permits an unimpaired step');
});

void test('a stunned ghost can choose rock because its species passes walls', async () => {
    freshTurnRoom({ hero: { umonnum: MONSTER_NAME.indexOf('ghost'), mtimedone: 100 } });
    assert.ok(game.level);
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10) game.level.requireAt(x, y).typ = STONE;
        }
    }
    await makeStunned(20, { talk: false });

    await rhack('l'.charCodeAt(0));

    assert.equal(Math.max(Math.abs(game.u.ux - 10), Math.abs(game.u.uy - 10)), 1);
    assert.equal(game.context.move, 1);
});
