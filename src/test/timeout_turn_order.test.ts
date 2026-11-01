import assert from 'node:assert/strict';
import test from 'node:test';
import { flushPendingTopline } from '../js/tty_topline.js';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { setPropertyTimeout } from '../js/properties.js';
import { scheduleObjectTimer } from '../js/timeout.js';
import { EGG } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { vision_recalc } from '../js/vision.js';
import type { InputGate } from '../js/input.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, OBJECT_TIMER_KIND } from '../js/const.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

function recordToplines(input: InputGate, messages: string[]): void {
    input.beforeRead = () => {
        messages.push(game._pending_message || game._retained_message || '');
        input.feed(' ');
    };
}

// One moveloop_core() call consumes the queued command; the following
// call runs that command's world-turn maintenance (C moveloop's do/while).
async function runTurns(turns: number): Promise<void> {
    for (let call = 0; call <= turns; call++) await moveloop_core();
    await flushPendingTopline();
}

function positionOf(transcript: string, expected: RegExp, what: string): number {
    const at = transcript.search(expected);
    assert.ok(at >= 0, `Missing ${what} in:\n${transcript}`);
    return at;
}

// C timeout.c:670-945 runs one countdown loop over u.uprops in the prop.h
// enum order: STUNNED, CONFUSION, BLINDED, DEAF, ..., FAST.  All five
// recovery lines of a single turn therefore appear in that order.
void test('simultaneous property expiries report in prop.h order', async () => {
    const input = freshTurnRoom();
    setPropertyTimeout('stunned', 1);
    setPropertyTimeout('confusion', 1);
    setPropertyTimeout('blinded', 1);
    setPropertyTimeout('deaf', 1);
    setPropertyTimeout('fast', 1);
    const messages: string[] = [];
    recordToplines(input, messages);
    input.feed('.');

    await runTurns(1);

    const transcript = messages.join('\n');
    const stun = positionOf(transcript, /steadier now\./, 'stun recovery');
    const confusion = positionOf(transcript, /less confused now\./, 'confusion recovery');
    const blind = positionOf(transcript, /You can see again\./, 'blindness recovery');
    const deaf = positionOf(transcript, /You can hear again\./, 'deafness recovery');
    const fast = positionOf(transcript, /yourself slow down\./, 'speed expiry');
    assert.ok(stun < confusion, `Stun recovery precedes confusion recovery:\n${transcript}`);
    assert.ok(confusion < blind, `Confusion recovery precedes blindness recovery:\n${transcript}`);
    assert.ok(blind < deaf, `Blindness recovery precedes deafness recovery:\n${transcript}`);
    assert.ok(deaf < fast, `Deafness recovery precedes the speed expiry:\n${transcript}`);
});

// C timeout.c:733 runs inside nh_timeout(), which allmain.c:273 calls after
// the monster movement loop: a confusion expiry follows a monster attack
// line that still owns the topline instead of replacing it.
void test('a confusion recovery follows a monster line still on the topline', async () => {
    const input = freshTurnRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const jackal = await createMonsterAt('jackal', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
     jackal.mux = game.u.ux;
     jackal.muy = game.u.uy;
    // A monster created this turn has no movement ration yet (C moveloop
    // allocates after monster movement), so hand it one full action.
    jackal.movement = 12;
    setPropertyTimeout('confusion', 1);
    const messages: string[] = [];
    recordToplines(input, messages);
    input.feed('m.');

    await runTurns(1);

    assert.match(messages.join('\n'), /jackal bites[\s\S]*less confused now\./,
        'The recovery line follows the attack that still owned the topline');
});

// C timeout.c:136-185: stoned_dialogue() prints one countdown line per turn
// while the petrification counter runs 5, 4, 3, ...
void test('the stoning countdown warns once per turn in countdown order', async () => {
    const input = freshTurnRoom();
    startHeroPetrification({ turns: 5, killer: 'cockatrice corpse' });
    const messages: string[] = [];
    recordToplines(input, messages);
    // Resting through a dangerous property needs the forced 'm' prefix.
    input.feed('m.m.m.');

    await runTurns(3);

    const transcript = messages.join('\n');
    const slowing = positionOf(transcript, /You are slowing down\./, 'first countdown line');
    const stiffening = positionOf(transcript, /Your limbs are stiffening\./, 'second countdown line');
    const stone = positionOf(transcript, /Your limbs have turned to stone\./, 'third countdown line');
    assert.ok(slowing < stiffening, `Countdown lines keep their turn order:\n${transcript}`);
    assert.ok(stiffening < stone, `Countdown lines keep their turn order:\n${transcript}`);
});

// C timeout.c:388-443: slime_dialogue() announces the turn before the fatal
// one; the countdown itself survives the turn.
void test('the sliming countdown announces the turn before the fatal one', async () => {
    const input = freshTurnRoom();
    startHeroSliming({ turns: 3 });
    const messages: string[] = [];
    recordToplines(input, messages);
    input.feed('m.');

    await runTurns(1);

    assert.match(messages.join('\n'), /You are turning into a green slime\./);
    assert.equal(game.u.slimedTurns, 2,
        'The countdown advances by exactly one turn');
    assert.equal(Boolean(game.program_state.gameover), false,
        'The turn before the fatal one does not end the game');
});

// C timeout.c:947: run_timers() is the last step of nh_timeout(), after the
// property countdown, so a due egg hatches on the same turn as -- and after
// -- a confusion recovery.
void test('a due egg hatches in the same turn, after the property countdown', async () => {
    const input = freshTurnRoom();
    const baby = MONSTER_NAME.indexOf('baby crocodile');
    const egg = await floorObject(EGG, 12, 10, { initialize: false, corpsenm: baby });
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, (game.moves ?? 0) + 1);
    await vision_recalc(0);
    setPropertyTimeout('confusion', 1);
    const messages: string[] = [];
    recordToplines(input, messages);
    input.feed('.');

    await runTurns(1);

    const transcript = messages.join('\n');
    const recovery = positionOf(transcript, /less confused now\./, 'confusion recovery');
    const hatch = positionOf(transcript, /hatch/, 'egg hatch line');
    assert.ok(recovery < hatch, `run_timers() follows the property countdown:\n${transcript}`);
    assert.ok(game.level?.monsters.some(monster => monster.mnum === baby),
        'The hatched monster is on the level');
    assert.notEqual(egg.where, 'floor');
});
