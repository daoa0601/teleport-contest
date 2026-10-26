import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { P_POLEARMS } from '../js/const.js';
import { clearMessageWindow, docrt, updateStatusLines } from '../js/display.js';
import { game } from '../js/gstate.js';
import { jumpHero } from '../js/jumping.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { runSegment } from '../js/jsmain.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { vision_reset, vision_recalc } from '../js/vision.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoomLevel } from './support/playable-room.js';
import { planInput } from './support/planned-input.js';
import { requireScreenRow } from './support/screen.js';
import { startLuaCore } from './support/lua-game.js';

const HALBERD = OBJECT_NAMES.indexOf('halberd');

function screenText(row: number): string {
    return requireScreenRow(row).map(cell => cell.ch).join('');
}

async function wieldedHalberd() {
    const pole = await addInventoryObject(HALBERD, { invlet: 'a', spe: 0, enchantment: 0 });
    game.uwep = game.u.uwep = pole;
    installHeroWeaponSkills({ [P_POLEARMS]: 1 });
    return pole;
}

// C apply.c:use_pole() plines "Where do you want to hit?" and then enters
// getpos("the spot to hit"), whose tutorial, verbose notice, and goal line
// all reach the topline before the first pick key.
void test('a first-time polearm aim offers the tutorial and names the spot to hit', async t => {
    freshObjectRoom({ flags: { tips: true, verbose: true } });
    const pole = await wieldedHalberd();
    await startLuaCore(t);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Where do you want to hit\?[\s\S]*--More--/, keys: ' ' },
        { prompt: /Tip: Farlooking or selecting a map location/, keys: ' ' },
        { prompt: /\(For instructions type a '\?'\)  Move cursor to the spot to hit:/, keys: '.' },
    ]);

    await applyInventoryObject(pole);

    assert.equal(game.u.uy, 10, 'The picked square is the hero spot, one step too close');
    assert.match(game._pending_message ?? '', /Too close/);
});

// C apply.c:jump() shares getpos("the desired position"); the tutorial and
// the verbose notice precede the goal line on the topline.
void test('a first-time jump aim explains itself before the desired-position goal', async t => {
    freshObjectRoom({ flags: { tips: true, verbose: true } });
    grantIntrinsicProperty('jumping', 'form');
    await startLuaCore(t);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Where do you want to jump\?[\s\S]*--More--/, keys: ' ' },
        { prompt: /Tip: Farlooking or selecting a map location/, keys: ' ' },
        { prompt: /\(For instructions type a '\?'\)  Move cursor to the desired position:/, keys: '.' },
    ]);

    await jumpHero();
});

async function startTravelEngine(): Promise<{ type: (keys: string) => Promise<void> }> {
    const engine = await runSegment({
        seed: 73, datetime: '20260830120000', moves: ' ', storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Traveler,role:valkyrie,race:human,gender:female,'
            + 'align:lawful,!legacy,!tutorial,!tips,!autopickup,pettype:none,time,runmode:walk',
    });
    game.level = createRoomLevel({ left: 5, right: 20, top: 5, bottom: 15 });
    game.stairs = null;
    game.u.ux = 10;
    game.u.uy = 10;
    vision_reset();
    vision_recalc(0);
    clearMessageWindow();
    await docrt();
    // One no-time command first paints the status lines the engine queued
    // during startup, so a travel below starts from a displayed turn count.
    engine.inputGate.feed('\x1b');
    await engine.runUntilInputNeeded();
    return {
        async type(keys: string): Promise<void> {
            engine.inputGate.feed(keys);
            await engine.runUntilInputNeeded();
        },
    };
}

function statusTime(): number {
    const match = /T:(\d+)/.exec(screenText(23));
    assert.ok(match, `The status line shows a turn count: ${screenText(23)}`);
    return Number(match[1]);
}

// C hack.c:findtravelpath() stops a run that reaches its destination with
// nomul(0) and then restores context.run to 8, so the world turn that pays
// for the final travel step cannot mark the 'time' status field dirty.
// runmode:walk makes runmode_delay_output() repaint after every step, which
// consumes nomul's botl request before that final allocation; the count
// stays one turn behind until some later event repaints the status.
void test('a two-step travel keeps the visible turn count one behind', async () => {
    const engine = await startTravelEngine();
    const start = statusTime();

    await engine.type('_jj.');

    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 12, 'The hero traveled two squares down');
    assert.equal(game.moves, start + 2, 'Both travel steps spent real turns');
    assert.equal(statusTime(), game.moves - 1,
        'The turn paying for the final step leaves the displayed count stale');
    await engine.type('\x1b');
    assert.equal(statusTime(), game.moves - 1,
        'A cancelled command does not refresh the turn count on its own');
});

// C getpos.c:auto_describe() reports through a history-suppressed putstr,
// which first moves the pending topline into ^P recall. The first recall
// after cursor movement therefore shows the empty pending line, not the
// verbose notice that autodescribe replaced.
void test('autodescribe flushes the pending topline before the first recall', async () => {
    const engine = await startTravelEngine();

    await engine.type('_j\x1b');
    assert.equal(screenText(0).trim(), '', 'Cancelling selection clears the topline');
    await engine.type('\x10');

    assert.equal(screenText(0).trim(), '',
        'The first ^P recalls the empty pending line, not the verbose notice');
});

// C cmd.c:reset_cmd_vars() zeroes the run flags directly instead of going
// through hack.c:end_running(), so a no-time command that clears a leftover
// travel run never asks the status window to repaint the time field.
void test('a no-time command after a travel run leaves the displayed turn count stale', async () => {
    freshObjectRoom({ flags: { tips: false, time: true } });
    game.context.botl = true;
    updateStatusLines();
    const shown = statusTime();
    // The run left the engine after its last repaint: further world turns
    // were paid with the run flag still set, so the display lags the count.
    game.moves = shown + 2;
    game.context.run = 8;

    const input = resetInputState();
    input.feed('\x1b');
    await rhack(0);
    updateStatusLines();

    assert.equal(statusTime(), shown,
        'Cancelling a command must not refresh the turn count on its own');
});
