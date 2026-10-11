import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { artifactObject, addInventoryObject } from './support/game-objects.js';
import {
    beginLevitatingArtifactDrop, finishLevitatingArtifactDrop,
} from '../js/levitation_drop.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import {
    clearLevitationMasks, grantIntrinsicProperty, hasCarriedProperty,
    hasIntrinsicProperty, hasInvokedProperty, hasRawLevitationSource,
    levitationAtWill, propertyHasOtherSources, refreshProperty,
    restoreLevitationSources, setCarriedProperty, setInvokedProperty,
    stashLevitationSources,
} from '../js/properties.js';
import { addInventoryItem } from '../js/u_init.js';
import { freshObjectRoom } from './support/object-room.js';
import { W_ART, W_ARTI } from '../js/const.js';

const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');

async function invokedAhriman() {
    freshObjectRoom();
    requirePlayingGame(game);
    const heart = await artifactObject('The Heart of Ahriman');
    await addInventoryItem(heart, null, true);
    setInvokedProperty('levitation', heart, true, game);
    return heart;
}

void test('dropping the invoked artifact pins a carried source and stays aloft', async () => {
    const heart = await invokedAhriman();
    assert.equal(game.u.levitating, true);
    const ageBefore = heart.age;
    assert.equal(beginLevitatingArtifactDrop(heart), true);
    // The hero keeps levitating through freeinv() and hitfloor().
    assert.equal(game.u.levitating, true);
    assert.equal(hasInvokedProperty('levitation', game), false);
    assert.equal(hasCarriedProperty('levitation', null, game), true);
    assert.equal(hasCarriedProperty('levitation', heart, game), true);
    // A carried source is not controllable (C ELevitation & ~W_ARTI).
    assert.equal(levitationAtWill(game), false);
    // No invoke downtime was rolled for the finesse drop.
    assert.equal(heart.age, ageBefore);
});

void test('the finesse only qualifies when the artifact alone holds the hero up', async () => {
    const heart = await invokedAhriman();
    // Not levitating at all.
    setInvokedProperty('levitation', heart, false, game);
    assert.equal(beginLevitatingArtifactDrop(heart), false);
    setInvokedProperty('levitation', heart, true, game);

    // Another artifact without the levitation invoke power.
    const orb = await artifactObject('The Orb of Detection');
    assert.equal(beginLevitatingArtifactDrop(orb), false);
    // A plain non-artifact object.
    const stone = await addInventoryObject(OBJECT_NAMES.indexOf('rock'));
    assert.equal(beginLevitatingArtifactDrop(stone), false);

    // A worn levitation ring keeps levitation alive without the artifact.
    const ring = await addInventoryObject(RIN_LEVITATION, { invlet: 'b', dknown: true });
    await wearHeroAccessory(ring, 'uleft');
    assert.equal(beginLevitatingArtifactDrop(heart), false);

    // An innate source likewise.
    freshObjectRoom();
    requirePlayingGame(game);
    const innate = await artifactObject('The Heart of Ahriman');
    setInvokedProperty('levitation', innate, true, game);
    grantIntrinsicProperty('levitation', 'form');
    assert.equal(beginLevitatingArtifactDrop(innate), false);
});

void test('the potion timeout qualifies with the artifact and survives begin', async () => {
    const heart = await invokedAhriman();
    game.u.levitationTurns = 30;
    refreshProperty('levitation');
    assert.equal(beginLevitatingArtifactDrop(heart), true);
    // begin keeps the timed bits; only finish clears them.
    assert.equal(game.u.levitationTurns, 30);
    assert.equal(game.u.levitating, true);
});

void test('finish lands the hero and clears every finesse source', async () => {
    const heart = await invokedAhriman();
    game.u.levitationTurns = 30;
    refreshProperty('levitation');
    assert.equal(beginLevitatingArtifactDrop(heart), true);
    const landed = await finishLevitatingArtifactDrop();
    assert.ok(landed);
    assert.equal(game.u.levitating, false);
    assert.equal(hasCarriedProperty('levitation', null, game), false);
    assert.equal(game.u.levitationTurns, 0);
    assert.equal(hasIntrinsicProperty('levitation', 'potion', game), false);
    assert.equal(hasRawLevitationSource(game), false);
    assert.match(game._pending_message, /You float gently to the floor\./);
});

void test('finish hands control back to an independent flying source', async () => {
    const heart = await invokedAhriman();
    grantIntrinsicProperty('flying', 'outside');
    assert.equal(beginLevitatingArtifactDrop(heart), true);
    assert.equal(game.u.levitating, true);
    const landed = await finishLevitatingArtifactDrop();
    assert.ok(landed);
    assert.equal(game.u.levitating, false);
    assert.equal(game.u.flying, true);
    assert.match(game._pending_message,
        /You have stopped levitating and are now flying\./);
});

void test('carried sources round-trip the stash and clear only through W_ART', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const heart = await artifactObject('The Heart of Ahriman');
    setCarriedProperty('levitation', heart, true, game);
    assert.equal(hasCarriedProperty('levitation', null, game), true);

    const stash = stashLevitationSources(game);
    assert.equal(hasCarriedProperty('levitation', null, game), true);
    restoreLevitationSources(stash, game);
    assert.equal(hasCarriedProperty('levitation', null, game), true);

    clearLevitationMasks(0, W_ARTI, game);
    assert.equal(hasCarriedProperty('levitation', null, game), true);
    clearLevitationMasks(0, W_ART, game);
    assert.equal(hasCarriedProperty('levitation', null, game), false);
});

void test('carried sources count as other extrinsic levitation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const heart = await artifactObject('The Heart of Ahriman');
    setCarriedProperty('levitation', heart, true, game);
    assert.equal(propertyHasOtherSources('levitation', game), true);
    assert.equal(hasRawLevitationSource(game), true);
});

