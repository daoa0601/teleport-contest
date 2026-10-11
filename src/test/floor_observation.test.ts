import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { addObjectToContainer } from '../js/object_container.js';
import { putIntoContainer, takeFromContainer } from '../js/container.js';
import { fullyIdentifyObject } from '../js/invent.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { punishHero } from '../js/punishment.js';
import { applyInventoryObject } from './support/commands.js';
import { rhack } from '../js/cmd.js';
import { gameLogEvents } from '../js/gamelog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { APPLE, CHEST, POT_HEALING } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const finds = () => gameLogEvents().filter(event => event.text.startsWith('found '));

async function floorMagicbane({ descriptionKnown = false } = {}) {
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact !== null && artifact !== undefined);
    const object = await floorObject(artifact.baseType, game.u.ux, game.u.uy, {
        dknown: descriptionKnown, known: false, bknown: false,
    });
    nameArtifact(object, artifact);
    return object;
}

for (const condition of ['sighted', 'blind', 'hallucinating'] as const) {
    void test(`looking at an unseen floor artifact while ${condition} preserves appearance knowledge`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const object = await floorMagicbane();
        if (condition === 'blind') setHeroBlindnessTurns(20);
        if (condition === 'hallucinating') game.u.hallucinationTurns = 20;
        pushKeys(' ');

        await rhack(':'.charCodeAt(0));

        assert.equal(game.context.move, condition === 'blind' ? 1 : 0);
        assert.equal(!!object.dknown, condition === 'sighted');
        assert.equal(finds().length, condition === 'sighted' ? 1 : 0);
        if (condition === 'sighted') {
            assert.equal(finds()[0]?.text, 'found Magicbane on the floor');
            assert.match(game._pending_message, /athame named Magicbane/);
        } else {
            assert.doesNotMatch(game._pending_message, /Magicbane/);
        }
    });
}

void test('blind floor inspection can find an artifact whose appearance was already known', async () => {
    freshObjectRoom();
    await floorMagicbane({ descriptionKnown: true });
    setHeroBlindnessTurns(20);
    pushKeys(' ');

    await rhack(':'.charCodeAt(0));

    assert.equal(finds().length, 1);
    assert.equal(finds()[0]?.text, 'found Magicbane on the floor');
});

void test('an automatic pile count does not find an artifact, but explicit look does', async () => {
    freshObjectRoom({ flags: { pickup: false, pile_limit: 2 } });
    requireFixtureGame(game);
    const object = await floorMagicbane();
    await floorObject(APPLE, game.u.ux, game.u.uy);
    pushKeys(' '.repeat(10));

    await autopickupAtHero();

    assert.ok(!object.dknown);
    assert.equal(finds().length, 0);
    assert.match(game._pending_message, /two objects here/);

    await rhack(':'.charCodeAt(0));

    assert.ok(object.dknown);
    assert.equal(finds().length, 1);
    assert.equal(finds()[0]?.text, 'found Magicbane on the floor');
});

void test('feeling an unfamiliar potion does not reveal its shuffled appearance', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const potion = await floorObject(POT_HEALING, game.u.ux, game.u.uy, {
        known: false, dknown: false, typeKnown: false, bknown: false,
    });
    setHeroBlindnessTurns(20);
    pushKeys(' ');

    await rhack(':'.charCodeAt(0));

    assert.ok(!potion.dknown);
    assert.match(game._pending_message, /You feel here a potion\./);
});

void test('a generic here-menu entry does not inspect the first object in a pile', async () => {
    const level = freshObjectRoom({ role: 'priest' });
    requireFixtureGame(game);
    await floorObject(APPLE, game.u.ux, game.u.uy);
    const object = await floorMagicbane();
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy)[0], object);
    pushKeys('herecmdmenu\n\x1b');

    await rhack('#'.charCodeAt(0));

    assert.ok(!object.dknown);
    assert.ok(!object.bknown);
    assert.equal(finds().length, 0);
});


for (const limit of [0, 1] as const) {
    void test(`automatic one-object inspection with pile limit ${limit}`, async () => {
        freshObjectRoom({ flags: { pickup: false, pile_limit: limit } });
        requireFixtureGame(game);
        const object = await floorMagicbane();
        pushKeys(' '.repeat(10));

        await autopickupAtHero();

        assert.equal(!!object.dknown, limit === 0);
        assert.equal(finds().length, limit === 0 ? 1 : 0);
        if (limit === 1) assert.match(game._pending_message, /There is an object here\./);
        await rhack(':'.charCodeAt(0));
        assert.equal(finds().length, 1);
    });
}

async function boxedArtifact() {
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, otrapped: false, cknown: false,
    });
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact !== null && artifact !== undefined);
    const object = await knownObject(artifact.baseType, {
        known: false, bknown: false, dknown: false,
    });
    nameArtifact(object, artifact);
    await addObjectToContainer(chest, object);
    return { chest, object };
}

for (const condition of ['sighted', 'blind', 'hallucinating'] as const) {
    void test(`looking inside a container while ${condition} names its actual contents`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const { chest, object } = await boxedArtifact();
        if (condition === 'blind') setHeroBlindnessTurns(20);
        if (condition === 'hallucinating') game.u.hallucinationTurns = 20;

        await applyInventoryObject(chest, ': \x1b');

        assert.equal(object.where, 'contained');
        assert.equal(!!object.dknown, condition === 'sighted');
        assert.equal(finds().length, condition === 'sighted' ? 1 : 0);
        if (condition === 'sighted')
            assert.equal(finds()[0]?.text, 'found Magicbane in a container');
    });
}

void test('cancelling a take-out menu still finds the named artifact in its container', async () => {
    freshObjectRoom();
    const { chest, object } = await boxedArtifact();

    await applyInventoryObject(chest, 'o\x1b');

    assert.equal(object.where, 'contained');
    assert.equal(finds().length, 1);
    assert.equal(finds()[0]?.text, 'found Magicbane in a container');
});

for (const blind of [false, true] as const) {
    void test(`undisplayed container extraction ${blind ? 'while blind stays unobserved' : 'first names the item in inventory'}`, async () => {
        freshObjectRoom();
        const { chest, object } = await boxedArtifact();
        if (blind) setHeroBlindnessTurns(20);

        const result = await takeFromContainer(chest, object);

        assert.ok(result.moved);
        assert.equal(object.where, 'inventory');
        assert.equal(!!object.dknown, !blind);
        assert.equal(finds().length, blind ? 0 : 1);
        if (!blind) assert.equal(finds()[0]?.text, 'found Magicbane');
        else assert.doesNotMatch(result.message, /Magicbane/);
    });
}


void test('a blind levitating hero cannot inspect or find a known floor artifact', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await floorMagicbane({ descriptionKnown: true });
    setHeroBlindnessTurns(20);
    grantIntrinsicProperty('levitation', 'outside');
    pushKeys(' '.repeat(10));

    await rhack(':'.charCodeAt(0));

    assert.equal(game.context.move, 0);
    assert.equal(finds().length, 0);
    assert.match(game._pending_message, /can't reach it/);
});

for (const blind of [false, true] as const) {
    void test(`a ${blind ? 'blind' : 'sighted'} Cleric learns floor-item beatitude when it is named`, async () => {
        freshObjectRoom({ role: 'priest' });
        const object = await floorMagicbane();
        if (blind) setHeroBlindnessTurns(20);
        pushKeys(' '.repeat(10));

        await rhack(':'.charCodeAt(0));

        assert.ok(object.bknown);
        assert.equal(!!object.dknown, !blind);
        assert.equal(finds().length, blind ? 0 : 1);
    });
}

void test('an identified floor artifact uses its personal noun and definite article', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const object = await floorMagicbane();
    fullyIdentifyObject(object);
    pushKeys(' '.repeat(10));

    await rhack(':'.charCodeAt(0));

    assert.match(game._pending_message, /You see here the .*Magicbane\./);
    assert.doesNotMatch(game._pending_message, /athame|named/);
    assert.equal(finds().length, 1);
});

void test('a blind content display finds a previously seen artifact only once', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const { chest, object } = await boxedArtifact();
    object.dknown = true;
    setHeroBlindnessTurns(20);

    await applyInventoryObject(chest, ': \x1b');
    await applyInventoryObject(chest, ': \x1b');

    assert.equal(object.where, 'contained');
    assert.equal(finds().length, 1);
    assert.equal(finds()[0]?.text, 'found Magicbane in a container');
    assert.ok(object.oartifact !== undefined);
    assert.ok(!game._artifactDiscoveries?.includes(object.oartifact));
});

void test('put-in feedback first finds an uninspected item before linking it into the container', async () => {
    freshObjectRoom();
    const chest = await addInventoryObject(CHEST, {
        initialize: false, invlet: 'a', olocked: false, otrapped: false,
    });
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact !== null && artifact !== undefined);
    const object = await addInventoryObject(artifact.baseType, {
        observed: false, known: false, bknown: false, dknown: false,
    });
    nameArtifact(object, artifact);

    const result = await putIntoContainer(chest, object);

    assert.ok(result.moved);
    assert.equal(object.where, 'contained');
    assert.match(result.message, /athame named Magicbane/);
    assert.equal(finds().length, 1);
    assert.equal(finds()[0]?.text, 'found Magicbane');
});


void test('the punishment chain does not count toward automatic pile suppression', async () => {
    freshObjectRoom({ flags: { pickup: false, pile_limit: 3 } });
    requireFixtureGame(game);
    pushKeys(' '.repeat(20));
    await punishHero(null, game);
    const object = await floorMagicbane();

    await autopickupAtHero();

    assert.ok(object.dknown);
    assert.equal(finds().length, 1);
    assert.equal(finds()[0]?.text, 'found Magicbane on the floor');
});
