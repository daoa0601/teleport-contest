import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { CORR, DOOR, ROOMOFFSET, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import { createRoom } from './support/topology.js';
import { freshObjectRoom } from './support/object-room.js';

// A closed vault around the hero with one corridor the guard can head for,
// as vault.c:invault() expects it.  The guard countdown is one turn away.
async function closedVaultDueForGuard() {
    const level = await freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    game.u.uinvault = 29;
    game._moveloopStarted = true;
    return level;
}

function visibleToplines(): string {
    return game.nhDisplay?.grid.slice(0, 3)
        .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n') ?? '';
}

// Answers the guard's interrogation and pages every message the turn
// produces, recording the topline in the order the player reads it.
function driveTurn(input: InputGate, toplines: string[], name = 'TestHero\n'): void {
    input.beforeRead = () => {
        const text = visibleToplines();
        toplines.push(text);
        if (/who are you\?/.test(text) && !text.includes('--More--')) input.feed(name);
        else input.feed(' ');
    };
}

void test('the guard arrives and interrogates the hero inside the elapsed turn', async () => {
    const level = await closedVaultDueForGuard();
    game.u.umovement = 12;
    const input = resetInputState();
    const toplines: string[] = [];
    driveTurn(input, toplines);

    // First keystroke: the hero waits, so the next core call owns the
    // world turn in which vault.c:invault() produces the guard.
    input.feed('.');
    await moveloop_core();
    await moveloop_core();

    const read = toplines.join('\n');
    const announcement = read.indexOf("Suddenly one of the Vault's guards enters!");
    const namePrompt = read.indexOf('"Hello stranger, who are you?" -');
    const dialogue = read.indexOf("\"I don't know you.\"");
    const escort = read.indexOf('"Please follow me."');
    assert.ok(announcement >= 0, `the guard must announce itself: ${read}`);
    assert.ok(namePrompt > announcement, `the name question follows the arrival: ${read}`);
    assert.ok(dialogue > namePrompt, `the interrogation follows the name: ${read}`);
    assert.ok(escort > dialogue, `the escort request ends the dialogue: ${read}`);

    const guard = level.monsters.find(monster => monster.isgd);
    assert.ok(guard, 'the arriving guard stays on the level');
    assert.equal(guard?.mpeaceful, 1);
    assert.equal(guard?._egd?.dropgoldcnt, 0, 'a broke hero is told to follow');
    assert.equal(level.requireAt(11, 10).typ, DOOR, 'the guard breaches the vault wall');
});

void test('a helpless hero is told the guard will return, without a name question', async () => {
    const level = await closedVaultDueForGuard();
    // The hero is unconscious for this world turn, so C's once-per-turn
    // block — including invault() — runs while gm.multi is still negative.
    game.multi = -1;
    game._heroTimePending = true;
    game.u.umovement = 0;
    const input = resetInputState();
    const toplines: string[] = [];
    driveTurn(input, toplines);

    await moveloop_core();

    const read = toplines.join('\n');
    const announcement = read.indexOf("Suddenly one of the Vault's guards enters!");
    const departure = read.indexOf("\"I'll be back when you're ready to speak to me!\"");
    const recovery = read.indexOf('You can move again.');
    assert.ok(announcement >= 0, `the guard must still announce itself: ${read}`);
    assert.ok(departure > announcement, `the helpless refusal follows the arrival: ${read}`);
    assert.ok(!read.includes('who are you'), `an unconscious hero is not questioned: ${read}`);
    assert.ok(recovery > departure,
        `the hero recovers only after the guard departs: ${read}`);
    assert.equal(level.monsters.some(monster => monster.isgd), false,
        'the departing guard leaves the level');
    assert.equal(level.requireAt(11, 10).typ, VWALL,
        'a departing guard leaves the vault wall intact');
});
void test('the arrival pages a message already waiting on the topline', async () => {
    const level = await closedVaultDueForGuard();
    game.u.umovement = 12;
    await pline('You see here 398 gold pieces.');
    const input = resetInputState();
    const toplines: string[] = [];
    driveTurn(input, toplines);

    input.feed('.');
    await moveloop_core();
    await moveloop_core();

    const read = toplines.join('\n');
    const pending = read.indexOf('You see here 398 gold pieces.');
    const announcement = read.indexOf("Suddenly one of the Vault's guards enters!");
    const namePrompt = read.indexOf('"Hello stranger, who are you?" -');
    assert.ok(pending >= 0, `the waiting message is read first: ${read}`);
    assert.ok(announcement > pending,
        `the arrival is appended behind the waiting message: ${read}`);
    assert.ok(read.includes("Suddenly one of the Vault's guards enters!--More--"),
        `the appended announcement carries the pager marker: ${read}`);
    assert.ok(namePrompt > announcement, `the name question still follows: ${read}`);
    assert.equal(level.requireAt(11, 10).typ, DOOR);
});
