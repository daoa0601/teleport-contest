import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, SQKY_BOARD } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a squeaky board announces a visible sleeper before waking it', async () => {
    const level = freshObjectRoom();
    const sleeper = await createMonsterAt('water nymph', 11, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    const input = resetInputState();
    const operation = triggerHeroTrap(addTrap(level, SQKY_BOARD, 10, 10, { tnote: 4 }));
    assert.equal(await Promise.race([
        operation.then(() => 'finished'), input.waitUntilBlocked().then(() => 'input'),
    ]), 'input', 'the wake-up message must first page the board announcement');
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '', /A board beneath you squeaks an E note loudly.--More--/);
    assert.equal(sleeper.msleeping, 1);
    input.feed(' ');
    await operation;
    assert.equal(sleeper.msleeping, 0);
    assert.equal(game._pending_message, 'The water nymph wakes up.');
});
void test('the hero board noise uses the hero level for its waking radius', async () => {
    const level = freshObjectRoom({ right: 22, hero: { ulevel: 8 } });
    const sleeper = await createMonsterAt('newt', 20, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    const input = resetInputState();
    input.feed(' ');
    await triggerHeroTrap(addTrap(level, SQKY_BOARD, 10, 10, { tnote: 4 }));
    assert.equal(sleeper.msleeping, 0, 'distance 100 is inside level 8 noise radius 160');
});
//# sourceMappingURL=hero_squeaky_board_paging.test.js.map