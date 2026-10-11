import test from 'node:test';
import assert from 'node:assert/strict';

import { LAVAPOOL, POOL, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    grantIntrinsicProperty, grantWornProperty, hasIntrinsicProperty,
    levitationAtWill, refreshProperty, setInvokedProperty,
} from '../js/properties.js';
import {
    advanceFlyingTimeout, advanceLevitationTimeout, levitationDialogue,
} from '../js/levitation_timeout.js';
import { applyLevitationPotion } from '../js/levitation_potion.js';
import { POT_LEVITATION } from '../js/object_data.js';
import { saveGame, restoreGame } from '../js/save.js';
import { knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

function collector() {
    const messages: string[] = [];
    return { messages, publish: (text: string) => { messages.push(text); } };
}

function levitatingFor(turns: number, state = game) {
    state.u.levitationTurns = turns;
    refreshProperty('levitation', state);
    return state;
}

void test('the levitation countdown warns at five turns and three turns', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const log = collector();

    assert.equal(await levitationDialogue(levitatingFor(5), log),
        'You float slightly lower.');
    assert.equal(await levitationDialogue(levitatingFor(3), log),
        'You wobble unsteadily in the air.');
});

void test('the levitation countdown stays quiet on even, late, and long timeouts', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const log = collector();

    for (const turns of [7, 4, 1]) {
        assert.equal(
            await levitationDialogue(levitatingFor(turns), log), null,
            `unexpected dialogue at ${turns} turns`);
    }
});

void test('floating above a hazard warns about the surface below', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    let message = await levitationDialogue(levitatingFor(3), collector());
    assert.equal(message, 'You wobble unsteadily over the water.');

    game.level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    message = await levitationDialogue(levitatingFor(3), collector());
    assert.equal(message, 'You wobble unsteadily over the lava.');
});

void test('worn levitation sources suppress the countdown dialogue', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantWornProperty('levitation', await knownObject(POT_LEVITATION), 'uarmf');

    assert.equal(await levitationDialogue(levitatingFor(3), collector()),
        null);
});

void test('an invoked levitation artifact suppresses the countdown dialogue', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setInvokedProperty('levitation', { oartifact: 22 }, true, game);

    assert.equal(await levitationDialogue(levitatingFor(3), collector()),
        null);
});

void test('the blessed-potion at-will marker does not suppress the dialogue', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    // The marker is intrinsic (C I_SPECIAL lives in HLevitation); only the
    // extrinsic field, not the intrinsic one, silences the countdown.
    grantIntrinsicProperty('levitation', 'potion');

    assert.equal(
        await levitationDialogue(levitatingFor(3), collector()) !== null,
        true);
});

void test('embedded in rock, the countdown stays silent outside hazards', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = STONE;
    assert.equal(await levitationDialogue(levitatingFor(3), collector()),
        null);
});

void test('each turn advances the timeout without expiring it early', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    levitatingFor(6);

    await advanceLevitationTimeout();
    assert.equal(game.u.levitationTurns, 5);
    assert.equal(game.u.levitating, true);
});

void test('levitation expiry lands the hero and clears the at-will marker', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await applyLevitationPotion(await knownObject(POT_LEVITATION, { blessed: true }),
        { publish: collector().publish });
    assert.ok(hasIntrinsicProperty('levitation', 'potion'));
    const turns = game.u.levitationTurns;
    assert.ok(turns !== undefined);
    game._pending_message = '';

    for (let i = 0; i < turns - 1; i++)
        await advanceLevitationTimeout();
    await advanceLevitationTimeout();
    assert.equal(game.u.levitating, false);
    assert.equal(game.u.levitationTurns, 0);
    assert.ok(!hasIntrinsicProperty('levitation', 'potion'));
    assert.match(game._pending_message, /float gently to the floor/);
});

void test('timed flight expiring with levitation is bypassed, not taken over', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    levitatingFor(1);
    game.u.flyingTurns = 1;
    game._pending_message = '';

    await advanceLevitationTimeout();
    await advanceFlyingTimeout();

    assert.equal(game.u.levitating, false);
    assert.equal(game.u.flying, false);
    assert.equal(game.u.flyingTurns, 0);
    assert.match(game._pending_message, /float gently to the floor/);
    assert.doesNotMatch(game._pending_message, /You land/);
    assert.doesNotMatch(game._pending_message, /now flying/);
});

void test('timed flight alone lands with its own message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.flyingTurns = 1;
    refreshProperty('flying');
    assert.equal(game.u.flying, true);
    const log = collector();

    await advanceFlyingTimeout(game, { publish: log.publish });

    assert.equal(game.u.flyingTurns, 0);
    assert.equal(game.u.flying, false);
    assert.ok(log.messages.includes('You land.'));
});

void test('an independent flight source keeps the hero airborne at timeout', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('flying', 'outside');
    game.u.flyingTurns = 1;
    refreshProperty('flying');
    const log = collector();

    await advanceFlyingTimeout(game, { publish: log.publish });

    assert.equal(game.u.flyingTurns, 0);
    assert.equal(game.u.flying, true);
    assert.ok(!log.messages.includes('You land.'));
});

void test('saving and restoring preserves timed at-will levitation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Levitation-Timeout';
    await applyLevitationPotion(await knownObject(POT_LEVITATION, { blessed: true }),
        { publish: collector().publish });
    const turns = game.u.levitationTurns;
    assert.ok(turns !== undefined);
    assert.ok(turns !== undefined);
    assert.ok(turns > 0 && hasIntrinsicProperty('levitation', 'potion'));

    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);

    assert.equal(game.u.levitationTurns, turns);
    assert.ok(hasIntrinsicProperty('levitation', 'potion'));
    assert.ok(levitationAtWill());
    assert.equal(game.u.levitating, true);
});
