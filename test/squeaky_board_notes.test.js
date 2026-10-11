import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { SQKY_BOARD } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap, } from '../js/monmove.js';
import { addTrap } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('the hero hears an F note when stepping on a squeaky board', async () => {
    const level = freshObjectRoom();
    const trap = addTrap(level, SQKY_BOARD, 11, 10, { tseen: false, tnote: 5 });
    await rhack('l'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(trap.tseen, true);
    assert.equal(topline(), 'A board beneath you squeaks an F note loudly.');
});
void test('the hero hears a G sharp when stepping on a squeaky board', async () => {
    const level = freshObjectRoom();
    const trap = addTrap(level, SQKY_BOARD, 11, 10, { tseen: false, tnote: 8 });
    await rhack('l'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(trap.tseen, true);
    assert.equal(topline(), 'A board beneath you squeaks a G sharp loudly.');
});
void test('a visible monster makes a squeaky board sound an F sharp', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(SQKY_BOARD, {
        trap: { tnote: 6 },
    });
    requirePlayingGame(game);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game);
    await flush_screen(1);
    assert.equal(trap.tseen, true);
    assert.equal(topline(), 'A board beneath the giant squeaks an F sharp loudly.');
});
void test('a visible monster makes a squeaky board sound a G sharp', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(SQKY_BOARD, {
        trap: { tnote: 8 },
    });
    requirePlayingGame(game);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game);
    await flush_screen(1);
    assert.equal(trap.tseen, true);
    assert.equal(topline(), 'A board beneath the giant squeaks a G sharp loudly.');
});
void test('an unseen monster can be heard squeaking an F sharp nearby', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(SQKY_BOARD, {
        monster: { minvis: true },
        trap: { tnote: 6 },
    });
    requirePlayingGame(game);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game);
    await flush_screen(1);
    assert.equal(trap.tseen ?? false, false);
    assert.equal(topline(), 'You hear an F sharp squeak nearby.');
});
//# sourceMappingURL=squeaky_board_notes.test.js.map