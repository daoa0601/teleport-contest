// C hack.c test_move()/lookaround(), apply.c avoid_moving_on_trap()/
// avoid_moving_on_liquid(), detect.c mfind0(), and do_name.c hliquid():
// messages that name a square carry its location, either through pline_dir()
// or pline_xy()/set_msg_xy(), so the accessiblemsg option can prefix them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack, continueRun } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { SCORR, SDOOR, TT_LAVA, DOOR, D_CLOSED, PIT } from '../js/const.js';
import { canSpotMonster, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { vision_recalc } from '../js/vision.js';
import { jumpHero } from '../js/jumping.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { BOULDER, FOOD_RATION } from '../js/object_data.js';
import { requireScreenRow } from './support/screen.js';

function screenText(): string {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

void test('mention_walls names an undetected secret door as a wall', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
    input.feed('k ');
    const door = requireGameLevel().requireAt(10, 9);
    door.typ = SDOOR;
    door.seenv = 255;
    await rhack(0);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /It's a wall\./);
});

void test('mention_walls names a secret corridor as solid stone', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
    input.feed('k ');
    requireGameLevel().requireAt(10, 9).typ = SCORR;
    await rhack(0);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /It's solid stone\./);
});

void test('run stop messages carry the blocking square for accessiblemsg', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true, accessiblemsg: true } });
    input.feed('\x0b ' + ' '.repeat(4)); // control-k: rush north
    const orc = await createMonsterAt('orc', 10, 8);
    orc.mpeaceful = false;
    vision_recalc(0);
    await rhack(0);
    await continueRun();
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /\(north\): An orc blocks your path\./);
});

void test('a known trap ahead prefixes its stop message for accessiblemsg', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true, accessiblemsg: true } });
    input.feed('\x0b ' + ' '.repeat(4));
    addTrap(requireGameLevel(), PIT, 10, 8).tseen = true;
    vision_recalc(0);
    await rhack(0);
    await continueRun();
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /\(north\): You stop in front of a pit\./);
});

void test('a closed door stop message carries the door square for accessiblemsg', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true, accessiblemsg: true } });
    input.feed('\x0b ' + ' '.repeat(4));
    const door = requireGameLevel().requireAt(10, 8);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    vision_recalc(0);
    await rhack(0);
    await continueRun();
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /\(north\): You stop in front of the door\./);
});

void test('a boulder blocking a rush names its direction for accessiblemsg', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true, accessiblemsg: true } });
    input.feed('\x0b ' + ' '.repeat(4));
    await floorObject(BOULDER, 10, 8);
    await addInventoryObject(FOOD_RATION);
    await rhack(0);
    await continueRun();
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /\(north\): A boulder blocks your path\./);
});

void test('warning reveal messages carry the hidden monster square for accessiblemsg', async () => {
    freshObjectRoom({ flags: { tips: false, accessiblemsg: true } });
    grantIntrinsicProperty('warning', 'outside');
    const piercer = await createMonsterAt('iron piercer', 11, 10);
    piercer.mundetected = 1;
    piercer.mpeaceful = 0;
    piercer.m_lev = 8;
    piercer.mcanmove = 0;
    piercer.mfrozen = 20;
    vision_recalc(0);
    assert.equal(canSpotMonster(piercer), false);
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 0;
    const input = resetInputState();
    const pages: string[] = [];
    input.beforeRead = () => {
        const text = screenText();
        pages.push(text);
        input.feed(text.includes('--More--') ? ' ' : '.');
    };
    await moveloop_core();
    assert.equal(piercer.mundetected, 0);
    const displayed = pages.join('\n');
    assert.match(displayed, /\(east\): Your danger sense causes you to take a second look close by\./);
    assert.match(displayed, /\(east\): You find an iron piercer\./);
});

void test('a hallucinating hero can perceive another liquid when jumping out of lava', async () => {
    const messages: string[] = [];
    for (let seed = 1; seed <= 8; seed++) {
        freshObjectRoom({ flags: { tips: false, pickup: false }, hero: { utrap: 4, utraptype: TT_LAVA } });
        grantIntrinsicProperty('jumping', 'form');
        game.u.hallucinationTurns = 10;
        const input = resetInputState();
        input.feed('lll.' + ' '.repeat(8));
        initRng(BigInt(seed));
        await jumpHero();
        await flush_screen(1);
        messages.push(requireScreenRow(0).map(cell => cell.ch).join(''));
        assert.equal(game.u.utrap, 0);
    }
    assert.ok(messages.some(message => /You pull yourself above the (?!lava)/.test(message)),
        'hallucination must apply to the liquid in the lava escape message');
});
