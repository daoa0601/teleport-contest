import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, TT_INFLOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
// C sit.c:dosit() refuses to sit when can_reach_floor() fails.  The three
// failure reasons that dosit itself can still observe, plus the underwater
// floor branch, each describe the refusal with a distinct message, and only
// the wedged-into-floor branch consumes the turn.
void test('a swallowed hero is told there are no seats in the stomach', async () => {
    freshGameplayRoom();
    game.u.uswallow = 1;
    game.u.ustuck = await createMonsterAt('purple worm', 10, 10);
    await runExtendedCommand('sit');
    assert.equal(game._pending_message, 'There are no seats in here!');
    assert.equal(game.context.move, 0);
});
void test('a hero pinned by a hugging monster sits on air', async () => {
    freshGameplayRoom();
    installPolymorphedHero('cockatrice');
    game.u.ustuck = await createMonsterAt('python', 10, 10);
    await runExtendedCommand('sit');
    assert.equal(game._pending_message, 'You are sitting on air.');
    assert.equal(game.context.move, 0);
});
void test('a hero wedged into the floor cannot maneuver to sit', async () => {
    freshGameplayRoom();
    game.u.utrap = 3;
    game.u.utraptype = TT_INFLOOR;
    await runExtendedCommand('sit');
    assert.equal(game._pending_message, "You can't maneuver to sit!");
    assert.equal(game.u.utrap, 4);
    assert.equal(game.context.move, 1);
});
void test('a submerged hero sits down on the muddy bottom', async () => {
    const level = freshGameplayRoom();
    game.u.uinwater = 1;
    level.requireAt(10, 10).typ = POOL;
    await runExtendedCommand('sit');
    assert.equal(game._pending_message, 'You sit down on the muddy bottom.');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=sit_floor_refusals.test.js.map