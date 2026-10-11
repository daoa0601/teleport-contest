import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { AMULET_OF_UNCHANGING, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR } from '../js/object_data.js';
import { learnObjectType, recordObjectCall } from '../js/object_knowledge.js';
import { minimalObjectName, objectCombatName, objectName } from '../js/objnam.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an observed unidentified amulet retains its appearance and class noun', async () => {
    freshObjectRoom();
    const amulet = await knownObject(AMULET_OF_UNCHANGING, { typeKnown: false, known: false });
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[AMULET_OF_UNCHANGING] = 'octagonal';

    assert.equal(objectName(amulet), 'octagonal amulet');
    assert.equal(minimalObjectName(amulet), 'octagonal amulet');
});

void test('an unseen amulet conceals its discovered type, call name, and personal name', async () => {
    freshObjectRoom();
    const amulet = await knownObject(AMULET_OF_UNCHANGING, {
        typeKnown: false, dknown: false, oname: 'Keepsake',
    });
    learnObjectType(AMULET_OF_UNCHANGING);
    recordObjectCall(AMULET_OF_UNCHANGING, 'Steady');

    assert.equal(objectName(amulet), 'amulet');
    assert.equal(minimalObjectName(amulet), 'amulet');
    assert.equal(amulet.dknown, false);

    assert.equal(objectCombatName(amulet), 'amulet of unchanging named Keepsake');
    assert.equal(amulet.dknown, true);
});

void test('calling an amulet names its class while minimal naming keeps only its appearance', async () => {
    freshObjectRoom();
    const amulet = await knownObject(AMULET_OF_UNCHANGING, {
        typeKnown: false, known: false, oname: 'Keepsake',
    });
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[AMULET_OF_UNCHANGING] = 'octagonal';
    recordObjectCall(AMULET_OF_UNCHANGING, 'Steady');

    assert.equal(objectName(amulet), 'amulet called Steady named Keepsake');
    assert.equal(minimalObjectName(amulet), 'octagonal amulet');
});

void test('discovering an amulet replaces appearance and call name with its actual type', async () => {
    freshObjectRoom();
    const amulet = await knownObject(AMULET_OF_UNCHANGING, { typeKnown: false, known: false });
    recordObjectCall(AMULET_OF_UNCHANGING, 'Steady');

    learnObjectType(AMULET_OF_UNCHANGING);

    assert.equal(objectName(amulet), 'amulet of unchanging');
    assert.equal(minimalObjectName(amulet), 'amulet of unchanging');
});

for (const [type, identifiedName] of [
    [AMULET_OF_YENDOR, 'Amulet of Yendor'],
    [FAKE_AMULET_OF_YENDOR, 'cheap plastic imitation of the Amulet of Yendor'],
] as const) {
    void test(`${identifiedName} needs individual identification and ignores a type call name`, async () => {
        freshObjectRoom();
        const amulet = await knownObject(type, { typeKnown: false, known: false });
        recordObjectCall(type, 'Authentic');
        learnObjectType(type);

        assert.equal(objectName(amulet), 'Amulet of Yendor');
        assert.equal(minimalObjectName(amulet), 'Amulet of Yendor');
        assert.equal(amulet.known, false);

        amulet.known = true;
        assert.equal(objectName(amulet), identifiedName);
        assert.equal(minimalObjectName(amulet), identifiedName);
    });
}

void test('an individually known fake Amulet does not need discovery of its general type', async () => {
    freshObjectRoom();
    const fake = await knownObject(FAKE_AMULET_OF_YENDOR, { typeKnown: false, known: true });

    assert.equal(objectName(fake), 'cheap plastic imitation of the Amulet of Yendor');
    assert.equal(minimalObjectName(fake), 'cheap plastic imitation of the Amulet of Yendor');
});

void test('identification override reveals an unseen fake Amulet without changing its knowledge', async () => {
    freshObjectRoom();
    const fake = await knownObject(FAKE_AMULET_OF_YENDOR, {
        typeKnown: false, known: false, dknown: false,
    });
    game.iflags.override_ID = true;

    assert.equal(objectName(fake), 'cheap plastic imitation of the Amulet of Yendor');
    assert.equal(minimalObjectName(fake), 'cheap plastic imitation of the Amulet of Yendor');
    assert.equal(fake.known, false);
    assert.equal(fake.dknown, false);
});
