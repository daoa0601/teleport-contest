import assert from 'node:assert/strict';
import test from 'node:test';
import { A_STR, PIT, STONE, STR19, TT_INFLOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { remove_object } from '../js/floor_object.js';
import { addInventoryItem } from '../js/u_init.js';
import { BOULDER, HEAVY_IRON_BALL } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { maketrap } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { throwInventoryObject } from './support/commands.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
// A punished hero carrying the attached ball: unlink the floor ball and hold
// it, the state pickup leaves behind when the ball is picked up.
async function holdAttachedBall() {
    resetInputState();
    await punishHero();
    const ball = game.uball;
    if (!ball || !game.uchain) {
        throw new Error('punishing the hero must attach a ball and chain');
    }
    remove_object(ball);
    await addInventoryItem(ball, null, false);
    return ball;
}
void test('a strong hero throws a loose heavy iron ball its rolling range', async () => {
    await freshObjectRoom({ right: 35 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const ball = await addInventoryObject(HEAVY_IRON_BALL);
    initRng(910n);
    await throwInventoryObject(ball);
    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 18);
    assert.equal(ball.oy, 10);
});
void test('a punished hero throws the chained ball no further than the chain', async () => {
    const level = await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const ball = await holdAttachedBall();
    const chain = game.uchain;
    initRng(911n);
    await throwInventoryObject(ball);
    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 15);
    assert.equal(ball.oy, 10);
    assert.ok(floorObjectsAt(level, 15, 10).includes(ball));
    assert.ok(chain && chain.where === 'floor' && chain.ox === 14 && chain.oy === 10, 'the chain is dragged behind the thrown ball');
});
void test('a hero held by a monster throws the chained ball only one square', async () => {
    // The same throw without a holder reaches the chain limit of five squares.
    await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const freeBall = await holdAttachedBall();
    initRng(912n);
    await throwInventoryObject(freeBall);
    assert.equal(freeBall.ox, 15, 'an unheld hero throws the chained ball five squares');
    await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const heldBall = await holdAttachedBall();
    const holder = await createMonsterAt('ogre', 12, 8);
    game.u.ustuck = holder;
    initRng(912n);
    await throwInventoryObject(heldBall);
    assert.equal(holder.mx, 12);
    assert.equal(heldBall.where, 'floor');
    assert.equal(heldBall.ox, 11);
    assert.equal(heldBall.oy, 10);
});
void test('a hero stuck in the floor throws the chained ball one square', async () => {
    // The same throw without the trap reaches the chain limit of five squares.
    await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const freeBall = await holdAttachedBall();
    initRng(913n);
    await throwInventoryObject(freeBall);
    assert.equal(freeBall.ox, 15, 'an untrapped hero throws the chained ball five squares');
    await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const trappedBall = await holdAttachedBall();
    game.u.utrap = 5;
    game.u.utraptype = TT_INFLOOR;
    initRng(913n);
    await throwInventoryObject(trappedBall);
    assert.equal(trappedBall.where, 'floor');
    assert.equal(trappedBall.ox, 11);
    assert.equal(trappedBall.oy, 10);
});
void test('a chained ball thrown through a tight Sokoban diagonal jerks to a halt', async () => {
    const level = await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    level.flags.sokoban_rules = true;
    const ball = await holdAttachedBall();
    for (const [x, y] of [[10, 9], [11, 10]]) {
        level.requireAt(x, y).typ = STONE;
        vision_note_blocker_change(x, y);
    }
    await vision_recalc(0);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(917n);
    await throwInventoryObject(ball, 'u', ' '.repeat(8));
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /The heavy iron ball jerks to an abrupt halt\./);
    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 11);
    assert.equal(ball.oy, 9);
});
void test('a thrown iron ball stops on a boulder square and reports the hit', async () => {
    await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    await floorObject(BOULDER, 13, 10);
    const ball = await addInventoryObject(HEAVY_IRON_BALL);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(915n);
    await throwInventoryObject(ball, 'l', ' '.repeat(8));
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /The heavy iron ball hits a boulder\./);
    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 13);
    assert.equal(ball.oy, 10);
});
void test('a chained ball thrown across a Sokoban pit stops on the pit', async () => {
    const level = await freshObjectRoom({ right: 35, flags: { pickup: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    level.flags.sokoban_rules = true;
    const ball = await holdAttachedBall();
    await maketrap(14, 10, PIT);
    const blocker = await createMonsterAt('orc', 15, 10);
    blocker.mhp = blocker.mhpmax = 100;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(916n);
    await throwInventoryObject(ball, 'l', ' '.repeat(8));
    const text = [...messages, game._pending_message].join('\n');
    assert.doesNotMatch(text, /abrupt halt/);
    assert.doesNotMatch(text, /heavy iron ball (hits|misses)/, 'the pit stops the flight before the chained ball reaches the orc');
    assert.equal(blocker.mhp, 100);
    assert.equal(ball.where, 'floor');
    assert.equal(ball.ox, 14);
    assert.equal(ball.oy, 10);
});
//# sourceMappingURL=throw_iron_ball.test.js.map