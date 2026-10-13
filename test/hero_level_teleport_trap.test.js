import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_TELEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a level teleport trap pages its announcement before asking for a level', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    const operation = triggerHeroTrap(trap);
    assert.equal(await Promise.race([
        operation.then(() => 'finished'), input.waitUntilBlocked().then(() => 'input'),
    ]), 'input', 'the trap must request input before returning to the turn');
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '', /You step onto a level teleport trap!--More--/);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(game.u.confusionTurns ?? 0, 0);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^To what level do you want to teleport\?/);
    input.feed('\x1b');
    await operation;
    assert.equal(game.level, level, 'cancelling keeps the hero on this level');
    assert.equal(game.u.confusionTurns, 3, 'an uncontrolled hero is confused even after cancelling');
    assert.equal(game._pending_message, 'You feel disoriented.');
});
void test('teleport control prevents the trap from confusing the hero after cancellation', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportControl', 'outside');
    const input = resetInputState();
    input.feed(' \x1b');
    await triggerHeroTrap(addTrap(level, LEVEL_TELEP, 10, 10));
    assert.equal(game.u.confusionTurns ?? 0, 0);
    assert.equal(game._pending_message, 'You briefly feel centered.');
});
void test('magic resistance leaves an unintentionally triggered level teleport trap in place', async () => {
    const level = freshObjectRoom({ hero: { antimagic: true } });
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    input.feed(' ');
    await triggerHeroTrap(trap);
    assert.equal(level.traps.includes(trap), true);
    assert.equal(trap.tseen, true);
    assert.match(game._pending_message, /You feel a wrenching sensation\.$/);
});
//# sourceMappingURL=hero_level_teleport_trap.test.js.map