import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, NO_MINVENT, PIT, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction, takeMonsterTurn } from '../js/monmove.js';
import { ROCK } from '../js/object_data.js';
import { maketrap } from '../js/mklev.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C monmove.c:m_move() calls tele_restrict() after a tengu's one-in-five
// teleport probe; the refusal line pages, and the same m_move() then runs
// ordinary destination selection and postmov().
void test('a restricted tengu prints its refusal and completes the move in one call', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const tengu = await createMonsterAt('tengu', 12, 10, MM_ANGRY | NO_MINVENT);
    tengu.msleeping = 0;
    const action = await runMonsterAction(tengu, game, () => 0, (count, sides) => sides, () => 1);
    assert.ok(action.movement);
    assert.match(game._lastPlineMessage ?? '', /A mysterious force prevents the tengu from teleporting!/);
    assert.ok(action.movement.postMoveStatus !== undefined, 'm_move() reached its native movement result after the refusal line');
});
// C m_move() gives an already-trapped actor its mintrap() escape attempt
// first: the pull-free line pages there, and a freed monster continues with
// ordinary movement in the same call.
void test('a webbed monster rolls its escape and pulls free inside m_move()', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 12, 10, MM_ANGRY | NO_MINVENT);
    await maketrap(12, 10, WEB);
    goblin.msleeping = 0;
    goblin.mtrapped = 1;
    await takeMonsterTurn(goblin, game, () => 0, (count, sides) => sides, () => 1);
    assert.equal(goblin.mtrapped, 0, 'the escape roll ran inside m_move()');
    assert.match(game._lastPlineMessage ?? '', /pulls free of the/);
    assert.notDeepEqual([goblin.mx, goblin.my], [12, 10], 'a freed monster continues with ordinary destination selection');
});
// C monmove.c:postmov() runs mintrap() after the move: the pit line pages,
// the falling damage is rolled, and the postmov tail continues before
// dochug() gets its result.
void test('a monster falling into a pit is announced and hurt inside its own move', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 12, 10, MM_ANGRY | NO_MINVENT);
    goblin.msleeping = 0;
    goblin.mhp = goblin.mhpmax = 20;
    goblin.mux = 16;
    goblin.muy = 10;
    await maketrap(13, 10, PIT);
    await takeMonsterTurn(goblin, game, () => 0, (count, sides) => sides, () => 1);
    assert.deepEqual([goblin.mx, goblin.my], [13, 10]);
    assert.equal(goblin.mtrapped, 1);
    assert.ok(goblin.mhp < 20, 'the pit damage was rolled inside postmov()');
    assert.match(game._lastPlineMessage ?? '', /falls into a pit/);
});
// C monmove.c:postmov() -> mon.c:hideunder(): the "You see ..." line pages
// after the move, and after_shk_move() and the dochug tail follow it.
void test('a concealer announces its new cover inside its own move', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10 });
    requirePlayingGame(game);
    const cobra = await createMonsterAt('cobra', 12, 10, MM_ANGRY | NO_MINVENT);
    cobra.msleeping = 0;
    await floorObject(ROCK, 13, 10);
    cobra.mux = 16;
    cobra.muy = 10;
    await takeMonsterTurn(cobra, game, limit => Math.max(0, limit - 1), (count, sides) => sides, () => 1);
    assert.deepEqual([cobra.mx, cobra.my], [13, 10]);
    assert.equal(cobra.mundetected, 1, 'hideunder() concealed the cobra');
    assert.match(game._lastPlineMessage ?? '', /You see the cobra .* under a rock\./);
});
//# sourceMappingURL=monster_move_transaction.test.js.map