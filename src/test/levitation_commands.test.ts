import test from 'node:test';
import assert from 'node:assert/strict';

import { AIR, ROOM, STAIRS, TT_BEARTRAP, TT_INFLOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { terrain_glyph } from '../js/display.js';
import {
    grantIntrinsicProperty, grantWornProperty, hasIntrinsicProperty,
    hasInvokedProperty, hasWornProperty, refreshProperty,
} from '../js/properties.js';
import { descendFromLevitation } from '../js/levitation_commands.js';
import { applyLevitationPotion } from '../js/levitation_potion.js';
import { artifactByName } from '../js/artifacts.js';
import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { POT_LEVITATION } from '../js/object_data.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function collector() {
    const messages: string[] = [];
    return { messages, publish: (text: string) => { messages.push(text); } };
}

function uncontrolledLevitation() {
    grantIntrinsicProperty('levitation', 'outside');
    refreshProperty('levitation');
}

void test('without any levitation source the descent proceeds ordinarily', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const log = collector();

    const result = await descendFromLevitation(game, { publish: log.publish });

    assert.deepEqual(result, { handled: false, spentTurn: false });
    assert.deepEqual(log.messages, []);
});

void test('an uncontrolled ring only reports floating above the floor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantWornProperty('levitation', await knownObject(POT_LEVITATION), 'uleft');
    const log = collector();

    const result = await descendFromLevitation(game, { publish: log.publish });

    assert.deepEqual(result, { handled: true, spentTurn: false });
    assert.deepEqual(log.messages, ['You are floating high above the floor.']);
    assert.equal(game.u.levitating, true);
});

void test('descending from a blessed potion lands the hero and spends the turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await applyLevitationPotion(
        await knownObject(POT_LEVITATION, { blessed: true }),
        { publish: collector().publish });
    game._pending_message = '';

    const result = await descendFromLevitation(game, { publish: collector().publish });

    assert.deepEqual(result, { handled: true, spentTurn: true });
    assert.equal(game.u.levitating, false);
    assert.equal(game.u.levitationTurns, 0);
    assert.ok(!hasIntrinsicProperty('levitation', 'potion'));
    assert.match(game._pending_message, /float gently to the floor/);
});

void test('a worn ring keeps the hero aloft after the potion part is ended', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantWornProperty('levitation', await knownObject(POT_LEVITATION), 'uleft');
    await applyLevitationPotion(
        await knownObject(POT_LEVITATION, { blessed: true }),
        { publish: collector().publish });
    assert.ok(hasIntrinsicProperty('levitation', 'potion'));
    const log = collector();

    const result = await descendFromLevitation(game, { publish: log.publish });

    // float_down returned 0: the ring still levitates, so the command falls
    // through to the floating message without spending the turn.
    assert.deepEqual(result, { handled: true, spentTurn: false });
    assert.equal(game.u.levitating, true);
    assert.ok(hasWornProperty('levitation'));
    assert.ok(!hasIntrinsicProperty('levitation', 'potion'));
    assert.ok(log.messages.some(text =>
        /floating high above the floor/.test(text)));
});

void test('a trapped hero ends controlled levitation with the latent message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_BEARTRAP;
    installPagerInput(resetInputState(), {
        expected: /float up slightly|no longer trying to float up from the trap's jaws/, limit: 2,
    });
    await applyLevitationPotion(
        await knownObject(POT_LEVITATION, { blessed: true }),
        { publish: collector().publish });
    const log = collector();

    const result = await descendFromLevitation(game, { publish: log.publish });

    assert.deepEqual(result, { handled: true, spentTurn: true });
    assert.equal(game.u.levitationTurns, 0);
    assert.ok(!hasIntrinsicProperty('levitation', 'potion'));
    assert.ok(log.messages.some(text =>
        /latent levitation ceases/.test(text)));
});

void test('descending from an invoked artifact cools it down for a long while', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const artifact = artifactByName('The Heart of Ahriman');
    assert.ok(artifact);
    const object = await addInventoryObject(artifact.baseType, {
        oartifact: artifact.id,
    });
    await invokeArtifactPower(object, artifact, {
        publish: collector().publish,
    });
    assert.ok(hasInvokedProperty('levitation'));
    const moves = game.moves ?? 0;

    const result = await descendFromLevitation(game, { publish: collector().publish });

    assert.deepEqual(result, { handled: true, spentTurn: true });
    assert.ok(!hasInvokedProperty('levitation'));
    assert.ok(object.age > moves,
        `expected a positive cooldown, got ${object.age - moves}`);
    assert.equal(game.u.levitating, false);
});

void test('a blind levitating hero names the stair surface even when its glyph is covered', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    game.u.blindTurns = 5;
    uncontrolledLevitation();
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    assert.equal(location.typ, STAIRS);

    location.remembered_glyph = terrain_glyph(location, game.u.ux, game.u.uy);
    let log = collector();
    let result = await descendFromLevitation(game, { publish: log.publish });
    assert.deepEqual(result, { handled: true, spentTurn: false });
    assert.ok(log.messages.some(text => /above the stairs/.test(text)));

    // C dodown() rejects the covered stair glyph, then surface() still
    // returns "stairs" because a stairway occupies the hero's square.
    location.remembered_glyph = {
        kind: 'terrain', ch: '.', color: 7, terrainName: 'floor of a room',
    };
    log = collector();
    result = await descendFromLevitation(game, { publish: log.publish });
    assert.deepEqual(result, { handled: true, spentTurn: false });
    assert.deepEqual(log.messages, ['You are floating high above the stairs.']);
});

void test('a sighted hero names the ladder beneath without glyph help', async () => {
    freshConnectedLevels({ ladder: true });
    requirePlayingGame(game);
    uncontrolledLevitation();
    const log = collector();

    const result = await descendFromLevitation(game, { publish: log.publish });

    assert.deepEqual(result, { handled: true, spentTurn: false });
    assert.ok(log.messages.some(text => /above the ladder/.test(text)));
});

void test('stuck into the floor, the floating message names the trap', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_INFLOOR;
    uncontrolledLevitation();
    const log = collector();

    const result = await descendFromLevitation(game, { publish: log.publish });

    assert.deepEqual(result, { handled: true, spentTurn: false });
    assert.deepEqual(log.messages, ['You are trapped in the floor.']);
});

void test('the endgame planes describe floating in their own medium', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    uncontrolledLevitation();
    game.air_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
    game.level.requireAt(game.u.ux, game.u.uy).typ = AIR;
    let log = collector();
    await descendFromLevitation(game, { publish: log.publish });
    assert.ok(log.messages.some(text => /floating in the air/.test(text)));

    freshObjectRoom();

    requirePlayingGame(game);
    uncontrolledLevitation();
    game.water_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
    game.level.requireAt(game.u.ux, game.u.uy).typ = ROOM;
    log = collector();
    await descendFromLevitation(game, { publish: log.publish });
    assert.ok(log.messages.some(text =>
        /floating in a bubble of air/.test(text)));
});
