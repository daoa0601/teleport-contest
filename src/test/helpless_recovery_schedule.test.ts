import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { nomul } from '../js/command_state.js';
import { resetInputState } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { HOLE, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { dopray } from '../js/pray.js';
import { LEATHER_ARMOR } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { statusConditionBit } from '../js/status_conditions.js';
import { wearHeroArmor } from '../js/armor.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

function recordToplines(input: InputGate, messages: string[]): void {
    input.beforeRead = () => {
        messages.push(game._pending_message || game._retained_message || '');
        input.feed(' ');
    };
}

async function drainHelplessTurns(): Promise<void> {
    let rounds = 0;
    while (game.multi < 0) {
        await moveloop_core();
        assert.ok(++rounds < 40, `Helplessness never ended: ${game._pending_message}`);
    }
    await flushPendingTopline();
}

// C allmain.c:379-388: negative multi counts whole turns inside the
// once-per-turn block; unmul() runs in the pass that decrements the counter
// to zero, so the recovery line lands on the scheduled turn and the status
// update it requests is rendered before the next command input.
void test('a frozen hero recovers on the scheduled turn with a refreshed status line', async () => {
    const input = freshTurnRoom({ flags: { time: true } });
    requirePlayingGame(game);
    const messages: string[] = [];
    recordToplines(input, messages);

    nomul(-3);
    game._helplessReason = "frozen by a monster's gaze";
    const started = game.moves;

    await drainHelplessTurns();

    assert.equal(game.moves - started, 3, 'Three helpless turns pass before recovery');
    assert.equal(game.multi, 0);
    assert.match(messages.join('\n'), /You can move again\./);
    const status = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(status, new RegExp(`T:${game.moves}\\b`),
        'unmul() marks the status line dirty on the recovery turn');
});

// C allmain.c:382-383 prints unmul()'s message with tty pline(): when a line
// from the same turn's monster pass still owns the pager, recovery queues
// behind it instead of replacing it.
void test('recovery waits behind a monster line still holding the pager', async () => {
    const input = freshTurnRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    jackal.mux = game.u.ux;
    jackal.muy = game.u.uy;
    const messages: string[] = [];
    recordToplines(input, messages);

    await putHeroToSleep(3);
    await drainHelplessTurns();

    const transcript = messages.join('\n');
    assert.match(transcript, /jackal bites[\s\S]*You wake up\./,
        'The waking line follows the attack that still owned the topline');
});

// C allmain.c:383 unmul() -> afternmv: interrupted armor removal finishes on
// the same turn the counter reaches zero, after the recovery line.
void test('delayed armor removal finishes on the recovery turn, not earlier', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const messages: string[] = [];
    recordToplines(input, messages);
    input.feed(`${suit.invlet ?? 'a'}`);

    await rhack('T'.charCodeAt(0));
    const duration = -(game.multi ?? 0);
    assert.ok(duration > 1, `Leather armor removal spans several turns (got ${duration})`);

    for (let elapsed = 1; elapsed < duration; elapsed++) {
        await moveloop_core();
        assert.equal(game.uarm, suit,
            `The suit is still worn with ${duration - elapsed} turns left`);
        assert.ok((game.multi ?? 0) < 0);
    }
    await drainHelplessTurns();

    assert.equal(game.uarm, null, 'The suit leaves its slot only on the recovery turn');
    assert.ok(game.inventory.includes(suit));
    // C armoroff() delays with nomovemsg "You finish taking off your X.";
    // Armor_off() then clears the slot silently (off_msg() belongs to
    // accessories), so the recovery line is the completion's whole report.
    assert.match(messages.join('\n'), /You finish taking off your suit\./);
    assert.doesNotMatch(messages.join('\n'), /You were wearing/);
});

// C pray.c:doturn() prays through a three-turn helpless prayer; allmain.c's
// unmul() prints "You finish your prayer." before prayer_done() ends the
// surrounding protection.
void test('a pleased prayer recovers after three turns and ends its protection', async () => {
    const input = freshTurnRoom({ flags: { paranoia_bits: 0 },
        hero: { ublesscnt: 0, uluck: 0, uhp: 10, uhpmax: 20 } });
    requirePlayingGame(game);
    const messages: string[] = [];
    recordToplines(input, messages);
    game.u.ualign.record = 0;
    game.u.ugangr = 0;

    await dopray();

    assert.ok(game.u.invulnerable, 'A pleased prayer surrounds the hero with light');
    assert.ok((game.multi ?? 0) < 0, 'Prayer helplessness starts immediately');
    const started = game.moves;
    await drainHelplessTurns();

    assert.equal(game.moves - started, 3, 'The prayer occupies its three turns');
    assert.equal(game.u.invulnerable, false, 'prayer_done() ends the protection on recovery');
    const transcript = messages.join('\n');
    assert.match(transcript, /shimmering light[\s\S]*You finish your prayer\./);
});

// C allmain.c:385-386: travel scheduled during the recovery turn's own
// maintenance — here the levitation timeout dropping the frozen hero through
// a hole (trap.c:float_down -> fall_through -> schedule_goto) — is taken by
// deferred_goto() right after unmul().
void test('a fall scheduled during the recovery turn travels after the recovery line', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    addTrap(game.level, HOLE, game.u.ux, game.u.uy);
    game.u.levitationTurns = 1;
    const input = resetInputState();
    const messages: string[] = [];
    recordToplines(input, messages);

    nomul(-1);
    game._helplessReason = "frozen by a monster's gaze";
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const started = game.moves;

    await drainHelplessTurns();

    assert.equal(game.moves - started, 1, 'Recovery and travel share one turn');
    assert.equal(game.u.uz.dnum, 0);
    assert.equal(game.u.uz.dlevel, 2, 'deferred_goto() completes the scheduled fall');
    assert.equal(game.multi, 0);
    const transcript = messages.join('\n');
    assert.match(transcript, /You can move again\./);
    assert.doesNotMatch(transcript, /You fall through[\s\S]*You can move again\./,
        'The fall trigger cannot postdate the recovery that travels it');
});

// C allmain.c:381 runs runmode_delay_output() while gm.multi is still
// negative — before the increment that may finish the delay.  The engine's
// delay frame therefore shows the helpless condition ("Zzz") on every
// helpless turn, including the one whose counter reaches zero, and the
// recovery line is published only after that frame.  Regeneration keeps the
// status dirty so each delay repaints the full status row.
void test('every delay frame is captured while the hero is still helpless', async () => {
    const input = freshTurnRoom({ flags: { runmode: 'walk' },
        hero: { uhp: 50, uhpmax: 100 } });
    requirePlayingGame(game);
    const sleepBit = statusConditionBit(['Zzz', 'Zzz', 'Zz']);
    assert.ok(sleepBit, 'The sleep condition has its status bit');
    game.flags.statusConditionMask = (game.flags.statusConditionMask ?? 0) | sleepBit;
    grantIntrinsicProperty('regeneration', 'outside');
    const frames: { status: string; pending: string }[] = [];
    game.animationFrame = async () => {
        frames.push({
            status: requireScreenRow(23).map(cell => cell.ch).join(''),
            pending: game._pending_message || '',
        });
    };
    recordToplines(input, []);

    await putHeroToSleep(2);
    await drainHelplessTurns();

    assert.equal(frames.length, 2, 'One walk-mode delay frame per helpless turn');
    for (const [index, frame] of frames.entries()) {
        assert.match(frame.status, /Zzz/,
            `Delay frame ${index} is captured before the counter moves`);
    }
});
