import test from 'node:test';
import assert from 'node:assert/strict';

import { TT_BEARTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty, hasIntrinsicProperty } from '../js/properties.js';
import { artifactByName } from '../js/artifacts.js';
import {
    artifactInvokeIsActive, deactivateArtifactProperty, invokeArtifactPower,
} from '../js/artifact_invoke.js';
import { applyLevitationPotion } from '../js/levitation_potion.js';
import { wearHeroArmor } from '../js/armor.js';
import {
    FEDORA, ORCISH_HELM, POT_LEVITATION,
} from '../js/object_data.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { freshObjectRoom } from './support/object-room.js';

function collector() {
    const messages: string[] = [];
    return { messages, publish: (text: string) => { messages.push(text); } };
}

async function heartOfAhriman() {
    const artifact = artifactByName('The Heart of Ahriman');
    assert.ok(artifact);
    const object = await addInventoryObject(artifact.baseType, {
        oartifact: artifact.id,
    });
    return { artifact, object };
}

void test('invoking the Heart of Ahriman starts levitation', async () => {
    freshObjectRoom({ gameplaySeed: 71n });
    requirePlayingGame(game);
    const { artifact, object } = await heartOfAhriman();
    const log = collector();

    const result = await invokeArtifactPower(object, artifact, {
        publish: log.publish,
    });

    assert.deepEqual(result, { used: true, ready: true, on: true });
    assert.equal(game.u.levitating, true);
    assert.ok(artifactInvokeIsActive(artifact));
    assert.match(game._pending_message, /float in the air/);
});

void test('a tired Heart of Ahriman refuses to levitate and cools down longer', async () => {
    freshObjectRoom({ gameplaySeed: 72n });
    requirePlayingGame(game);
    const { artifact, object } = await heartOfAhriman();
    object.age = (game.moves ?? 0) + 500;
    const log = collector();

    const result = await invokeArtifactPower(object, artifact, {
        publish: log.publish,
    });

    assert.deepEqual(result, { used: true, ready: false, on: false });
    assert.equal(game.u.levitating, false);
    assert.ok(!artifactInvokeIsActive(artifact));
    assert.ok(object.age > (game.moves ?? 0) + 500);
    assert.ok(log.messages.some(text => /ignoring you/.test(text)));
});

void test('an independent levitation source makes the invocation nothing special', async () => {
    freshObjectRoom({ gameplaySeed: 73n });
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    const { artifact, object } = await heartOfAhriman();
    const log = collector();

    const result = await invokeArtifactPower(object, artifact, {
        publish: log.publish,
    });

    assert.deepEqual(result, { used: true, ready: true, on: true });
    assert.ok(log.messages.some(text =>
        /surge of power, but nothing seems to happen/.test(text)));
    assert.ok(!log.messages.some(text => /float in the air/.test(text)));
});

void test('turning the invoked Heart of Ahriman off lands the hero', async () => {
    freshObjectRoom({ gameplaySeed: 74n });
    requirePlayingGame(game);
    const { artifact, object } = await heartOfAhriman();
    await invokeArtifactPower(object, artifact, { publish: collector().publish });

    const result = await invokeArtifactPower(object, artifact, {
        publish: collector().publish,
    });

    assert.deepEqual(result, { used: true, ready: true, on: false });
    assert.equal(game.u.levitating, false);
    assert.ok(!artifactInvokeIsActive(artifact));
});

void test('losing the invoked artifact from inventory deactivates its levitation', async () => {
    freshObjectRoom({ gameplaySeed: 75n });
    requirePlayingGame(game);
    const { artifact, object } = await heartOfAhriman();
    await invokeArtifactPower(object, artifact, { publish: collector().publish });
    assert.equal(game.u.levitating, true);

    const stopped = await deactivateArtifactProperty(object, artifact, {
        publish: collector().publish,
    });

    assert.equal(stopped, true);
    assert.equal(game.u.levitating, false);
});

void test('quaffing an uncursed levitation potion floats the hero with a timeout', async () => {
    freshObjectRoom({ gameplaySeed: 76n });
    requirePlayingGame(game);
    const log = collector();

    const result = await applyLevitationPotion(
        await knownObject(POT_LEVITATION), { publish: log.publish });

    assert.deepEqual(result, { nothingHappened: false });
    assert.equal(game.u.levitating, true);
    assert.ok(game.u.levitationTurns !== undefined);
    assert.ok(game.u.levitationTurns >= 11 && game.u.levitationTurns <= 150,
        `unexpected timeout ${game.u.levitationTurns}`);
    assert.match(game._pending_message, /float in the air/);
    assert.ok(!hasIntrinsicProperty('levitation', 'potion'));
});

void test('a blessed levitation potion lasts longer and descends at will', async () => {
    freshObjectRoom({ gameplaySeed: 77n });
    requirePlayingGame(game);

    const result = await applyLevitationPotion(
        await knownObject(POT_LEVITATION, { blessed: true }),
        { publish: collector().publish });

    assert.deepEqual(result, { nothingHappened: false });
    assert.equal(game.u.levitating, true);
    assert.ok(game.u.levitationTurns !== undefined);
    assert.ok(game.u.levitationTurns >= 251 && game.u.levitationTurns <= 300,
        `unexpected timeout ${game.u.levitationTurns}`);
    assert.ok(hasIntrinsicProperty('levitation', 'potion'));
});

void test('a cursed levitation potion bruises the hero against the ceiling', async () => {
    freshObjectRoom({ gameplaySeed: 78n, hero: { uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    const log = collector();

    const result = await applyLevitationPotion(
        await knownObject(POT_LEVITATION, { cursed: true }),
        { publish: log.publish });

    assert.deepEqual(result, { nothingHappened: false });
    assert.equal(game.u.levitating, true);
    assert.equal(game.u.levitationTurns, 1);
    assert.ok(game.u.uhp >= 30 && game.u.uhp <= 39,
        `unexpected damage to ${game.u.uhp}`);
    assert.ok(log.messages.some(text => /hit your .* on the/.test(text)));
});

void test('a hard helmet blunts the cursed levitation ceiling impact', async () => {
    freshObjectRoom({ gameplaySeed: 79n, hero: { uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(ORCISH_HELM));

    await applyLevitationPotion(await knownObject(POT_LEVITATION, { cursed: true }),
        { publish: collector().publish });

    assert.ok(game.u.uhp >= 37 && game.u.uhp <= 39,
        `unexpected damage to ${game.u.uhp}`);
});

void test('a soft hat and half physical damage blunt the ceiling impact further', async () => {
    freshObjectRoom({
        gameplaySeed: 80n,
        hero: { uhp: 40, uhpmax: 40, halfPhysicalDamage: true },
    });
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(FEDORA));

    await applyLevitationPotion(await knownObject(POT_LEVITATION, { cursed: true }),
        { publish: collector().publish });

    assert.ok(game.u.uhp >= 37 && game.u.uhp <= 39,
        `unexpected damage to ${game.u.uhp}`);
});

void test('a cursed levitation potion on an up staircase carries the hero up a level', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    initRng(81n);
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    assert.equal(game.u.uz.dlevel, 2);

    const input = resetInputState();
    const potion = await knownObject(POT_LEVITATION, { cursed: true });
    const rising = applyLevitationPotion(potion, { publish: collector().publish });
    await input.waitUntilBlocked();
    let result;
    try {
        const row = game.nhDisplay?.grid[0];
        assert.ok(row);
        const topline = row.map(cell => cell.ch).join('');
        assert.match(topline, /float in the air!.*float up the stairs\.--More--/);
        assert.equal(game.u.uz.dlevel, 1);
    } finally {
        // Native arrival docrt()/cls() flushes the old level's message.
        input.feed(' ');
        result = await rising;
    }

    assert.deepEqual(result, { nothingHappened: false });
    assert.equal(game.u.uz.dlevel, 1);
    assert.ok(game.level === source, 'the hero did not climb to the source level');
});

void test('drinking levitation while already aloft does nothing observable', async () => {
    freshObjectRoom({ gameplaySeed: 82n });
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    const log = collector();

    const result = await applyLevitationPotion(
        await knownObject(POT_LEVITATION), { publish: log.publish });

    assert.deepEqual(result, { nothingHappened: true });
    assert.ok(!log.messages.some(text => /float in the air/.test(text)));
    assert.doesNotMatch(game._pending_message || '', /float in the air/);
    // The timeout still accumulates for when the other source ends.
    assert.ok(game.u.levitationTurns !== undefined);
    assert.ok(game.u.levitationTurns >= 11);
});

void test('a floor-trapped hero floats against the trap and takes no ceiling hit', async () => {
    freshObjectRoom({ gameplaySeed: 83n, hero: { uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_BEARTRAP;

    const result = await applyLevitationPotion(
        await knownObject(POT_LEVITATION, { cursed: true }),
        { publish: collector().publish });

    // C: !Levitation && !BLevitation held, so float_up ran with trapped
    // feedback; the cursed branch then saw BLevitation and skipped both the
    // staircase and the ceiling (potion.c:1174-1193).
    assert.deepEqual(result, { nothingHappened: false });
    assert.match(game._pending_message, /still stuck/);
    assert.ok(game.u.levitationTurns !== undefined);
    assert.ok(game.u.levitationTurns >= 1,
        'the timeout must still accrue while trapped');
    assert.equal(game.u.uhp, 40, 'a trapped hero takes no ceiling damage');
});
