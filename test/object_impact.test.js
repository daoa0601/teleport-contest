import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BOULDER, CORPSE, SACK } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopObjectTimer, } from '../js/object_timers.js';
import { disturbBuriedZombies, impactDisturbsZombies, } from '../js/object_impact.js';
import { addBuriedObject } from '../js/buried_object.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
async function buriedZombieAt(x, y, deadline, state = game) {
    const corpse = await knownObject(CORPSE, { corpsenm: 0 });
    addBuriedObject(corpse, x, y, state);
    if (deadline !== null)
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, deadline, state);
    return corpse;
}
async function heavyImpactorAt(x, y, weight, state = game) {
    const object = await knownObject(BOULDER);
    object.owt = weight;
    placeCreatedObject(object, x, y, state);
    return object;
}
function zombifyRemaining(corpse, state = game) {
    const timer = objectTimers(corpse).find(candidate => candidate.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
    return timer ? timer.deadline - (state.moves ?? 0) : null;
}
void test('a violent impact cuts a nearby zombie timer to two thirds', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await buriedZombieAt(11, 10, (game.moves ?? 0) + 30);
    const impactor = await heavyImpactorAt(10, 10, 300);
    impactDisturbsZombies(impactor, true);
    assert.equal(zombifyRemaining(corpse), 20);
});
void test('quiet drops need ten times the weight to wake the dead', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await buriedZombieAt(11, 10, (game.moves ?? 0) + 30);
    const light = await heavyImpactorAt(10, 10, 99);
    impactDisturbsZombies(light, false);
    assert.equal(zombifyRemaining(corpse), 30);
    const heavy = await heavyImpactorAt(10, 10, 100);
    impactDisturbsZombies(heavy, false);
    assert.equal(zombifyRemaining(corpse), 20);
});
void test('a light violent impact still counts as too quiet', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await buriedZombieAt(11, 10, (game.moves ?? 0) + 30);
    const light = await heavyImpactorAt(10, 10, 9);
    impactDisturbsZombies(light, true);
    assert.equal(zombifyRemaining(corpse), 30);
});
void test('a flimsy object never disturbs zombies regardless of weight', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await buriedZombieAt(11, 10, (game.moves ?? 0) + 30);
    const sack = await knownObject(SACK);
    sack.owt = 500; // cloth: C is_flimsy() overrides the weight test
    placeCreatedObject(sack, 10, 10);
    impactDisturbsZombies(sack, true);
    assert.equal(zombifyRemaining(corpse), 30);
});
void test('buried zombies within one step react, further ones sleep', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const moves = game.moves ?? 0;
    const diagonal = await buriedZombieAt(11, 11, moves + 30);
    const straight = await buriedZombieAt(9, 10, moves + 30);
    const far = await buriedZombieAt(13, 10, moves + 30);
    const impactor = await heavyImpactorAt(10, 10, 300);
    impactDisturbsZombies(impactor, true);
    assert.equal(zombifyRemaining(diagonal), 20);
    assert.equal(zombifyRemaining(straight), 20);
    assert.equal(zombifyRemaining(far), 30);
});
void test('short timers floor at one remaining turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const moves = game.moves ?? 0;
    const one = await buriedZombieAt(11, 10, moves + 1);
    const two = await buriedZombieAt(9, 10, moves + 2);
    const impactor = await heavyImpactorAt(10, 10, 300);
    impactDisturbsZombies(impactor, true);
    assert.equal(zombifyRemaining(one), 1);
    assert.equal(zombifyRemaining(two), 1);
});
void test('due and overdue timers are restarted at one turn, not skipped', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const moves = game.moves ?? 0;
    assert.ok(moves > 5, 'fixture moves must exceed the overdue depth');
    const due = await buriedZombieAt(11, 10, moves);
    const overdue = await buriedZombieAt(9, 10, moves - 5);
    const impactor = await heavyImpactorAt(10, 10, 300);
    impactDisturbsZombies(impactor, true);
    // C guards on the absolute peek_timer() deadline, then scales
    // stop_timer()'s possibly-negative remaining time onto the max(1)
    // floor: both corpses wake in one turn.
    assert.equal(zombifyRemaining(due), 1);
    assert.equal(zombifyRemaining(overdue), 1);
});
void test('only a zombify timer on a buried corpse qualifies', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const moves = game.moves ?? 0;
    const reviver = await buriedZombieAt(11, 10, moves + 30);
    stopObjectTimer(reviver, OBJECT_TIMER_KIND.ZOMBIFY_MON);
    scheduleObjectTimer(reviver, OBJECT_TIMER_KIND.REVIVE_MON, moves + 30);
    const untimed = await buriedZombieAt(10, 11, null);
    const notCorpse = await knownObject(BOULDER);
    addBuriedObject(notCorpse, 10, 9);
    const impactor = await heavyImpactorAt(10, 10, 300);
    impactDisturbsZombies(impactor, true);
    assert.equal(zombifyRemaining(reviver), null);
    assert.equal(objectTimers(reviver).some(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON), true);
    assert.equal(zombifyRemaining(untimed), null);
});
void test('direct disturbance shares the impactor coordinate semantics', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const corpse = await buriedZombieAt(12, 12, (game.moves ?? 0) + 90);
    disturbBuriedZombies(12, 11);
    assert.equal(zombifyRemaining(corpse), 60);
});
//# sourceMappingURL=object_impact.test.js.map