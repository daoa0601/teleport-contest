import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { CORR, DOOR } from '../js/const.js';
import { magic_map_background, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runSegment } from '../js/jsmain.js';
import { FOOD_RATION } from '../js/object_data.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { requireScreenRow, screenText } from './support/screen.js';
import { createRoom } from './support/topology.js';
// The tty draws a line when the next message pages it behind --More--.
function drawnTopline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
// _buildScreenOutput() renders the pending message as screen row 0.
function committedTopline() {
    return game._pending_message;
}
function drawRect(level, left, right, top, bottom) {
    for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++)
            newsym(x, y);
}
void test('#lookaround describes the whole seen room and each interesting square', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    drawRect(level, 7, 16, 6, 14);
    await floorObject(FOOD_RATION, 12, 8);
    newsym(12, 8);
    const input = resetInputState();
    input.feed('#lookaround\r');
    const action = rhack(0);
    await input.waitUntilBlocked();
    // The room line pages behind --More-- because the food ration line that
    // follows does not fit next to it (C update_topl(): n0 + len + 3 >= CO-8).
    assert.equal(drawnTopline(), 'You are in a rectangular 10 by 9 area.--More--');
    input.feed(' ');
    await action;
    assert.equal(committedTopline(), '(2north,2east): an uncursed food ration.');
    assert.equal(game.context.move, 0, '#lookaround takes no time');
});
void test('#lookaround from a doorway describes the adjacent room with its direction', async () => {
    const level = freshPlayableRoom({
        left: 6, right: 10, top: 6, bottom: 14,
        heroX: 11, heroY: 10, flags: { tips: false },
    });
    // A real room record lets the doorway carry that room's number, which
    // #lookaround reads through the hero's room membership.
    level.rooms = [createRoom({ lx: 6, ly: 6, hx: 10, hy: 14 })];
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.lit = door.waslit = true;
    door.seenv = 255;
    door.roomno = 3;
    const corridor = level.requireAt(12, 10);
    corridor.typ = CORR;
    corridor.lit = corridor.waslit = true;
    corridor.seenv = 255;
    updateHeroRoomMembership(game);
    vision_recalc(0);
    // The whole room is explored: magic mapping supplies the remembered
    // floor the room description needs, including corners out of sight.
    for (let y = 6; y <= 14; y++)
        for (let x = 6; x <= 10; x++) {
            magic_map_background(x, y);
            newsym(x, y);
        }
    newsym(11, 10);
    newsym(12, 10);
    const input = resetInputState();
    input.feed('#lookaround\r');
    const action = rhack(0);
    // The room line always pages behind --More-- before the corridor line
    // (C update_topl(): 55 + 21 + 3 >= CO - 8), so a run that finished
    // without reaching the pager skipped the room description.
    const state = await Promise.race([
        action.then(() => 'finished'),
        input.waitUntilBlocked().then(() => 'pager'),
    ]);
    assert.equal(state, 'pager', 'room description never paged behind --More--');
    assert.equal(drawnTopline(), '(west): You remember that as a rectangular 5 by 9 room.--More--');
    input.feed(' ');
    await action;
    assert.equal(committedTopline(), '(east): lit corridor.');
});
void test('#lookaround in a corridor lists remembered corridors beyond sight', async () => {
    const level = freshPlayableRoom({
        left: 6, right: 10, top: 6, bottom: 14,
        heroX: 12, heroY: 10, flags: { tips: false },
    });
    const heroSquare = level.requireAt(12, 10);
    heroSquare.typ = CORR;
    heroSquare.lit = heroSquare.waslit = true;
    heroSquare.seenv = 255;
    // A distant remembered corridor: drawn on the map, not currently visible.
    const remembered = level.requireAt(40, 5);
    remembered.typ = CORR;
    remembered.lit = false;
    remembered.seenv = 255;
    magic_map_background(40, 5);
    vision_recalc(0);
    newsym(12, 10);
    newsym(40, 5);
    newsym(6, 6);
    const input = resetInputState();
    input.feed('#lookaround\r');
    // A single listed square produces one line and never pages.
    await rhack(0);
    assert.equal(committedTopline(), '(5north,28east): corridor.');
    assert.ok(!committedTopline().includes('floor of a room'), 'boring room floors are not listed');
});
void test('#lookaround names the room and every interesting square on a real level', async () => {
    const result = await runSegment({
        seed: 614,
        datetime: '20260930120000',
        nethackrc: 'OPTIONS=name:Looker,role:Valkyrie,race:human,gender:male,align:lawful\n'
            + 'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
        moves: '#lookaround\n \n \n \n',
        storage: memoryStorage(),
    });
    const screens = result.getScreens().map(screenText);
    const roomLine = screens.find(screen => /You are in (a (rectangular|square) \d+ by \d+|an irregularly shaped \d+ by \d+) room\./
        .test(screen));
    assert.ok(roomLine, `room description missing from ${screens[0]}`);
    const listing = screens.find(screen => /\(\d*[ns]?[a-z]*,\d*[ew][a-z]*\): [^.]+\./.test(screen));
    assert.ok(listing, 'no direction-prefixed square description');
    assert.ok(screens.some(screen => screen.includes('--More--')), 'several descriptions page behind --More--');
});
//# sourceMappingURL=lookaround.test.js.map