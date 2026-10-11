import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { ddoinv, inventoryItemDescription } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { DIAMOND, EMERALD, FLINT, JADE, LOADSTONE, ROCK, RUBY } from '../js/object_data.js';
import { mksobj } from '../js/mklev.js';
import { addCreatedInventoryItem } from '../js/u_init.js';
import { learnObjectType, observeObject, recordObjectCall } from '../js/object_knowledge.js';
import { minimalObjectName, objectCombatName, objectName } from '../js/objnam.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('ordinary rocks are recognized without acquiring type knowledge', async () => {
    freshObjectRoom();
    const rocks = await mksobj(ROCK, false, false);
    rocks.quan = 3;
    await addCreatedInventoryItem(rocks);

    assert.equal(objectName(rocks), 'rock');
    assert.equal(inventoryItemDescription(rocks), '3 rocks');
});

for (const [type, appearance, noun] of [
    [EMERALD, 'green', 'gem'],
    [LOADSTONE, 'gray', 'stone'],
] as const) {
    void test(`unknown ${noun} names distinguish unseen, observed, and user-called objects`, async () => {
        freshObjectRoom();
        const object = await knownObject(type, { typeKnown: false, dknown: false, known: false });
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[type] = appearance;

        assert.equal(objectName(object), noun);
        assert.equal(minimalObjectName(object), noun);

        observeObject(object);
        assert.equal(objectName(object), `${appearance} ${noun}`);
        assert.equal(minimalObjectName(object), `${appearance} ${noun}`);

        recordObjectCall(type, 'Keepsake');
        assert.equal(objectName(object), `${noun} called Keepsake`);
        assert.equal(minimalObjectName(object), `${appearance} ${noun}`);
    });
}

for (const [type, name] of [
    [JADE, 'jade stone'],
    [FLINT, 'flint stone'],
    [DIAMOND, 'diamond'],
    [LOADSTONE, 'loadstone'],
] as const) {
    void test(`discovery names ${name} consistently without adding a second stone suffix`, async () => {
        freshObjectRoom();
        const object = await knownObject(type, { typeKnown: false, known: false, bknown: false });
        recordObjectCall(type, 'Keepsake');

        learnObjectType(type);

        assert.equal(objectName(object), name);
        assert.equal(minimalObjectName(object), name);
        assert.equal(objectCombatName(object), name);
        assert.equal(inventoryItemDescription(object), `a ${name}`);
    });
}

void test('named gemstones pluralize the noun while preserving the individual name once', async () => {
    freshObjectRoom();
    const rubies = await knownObject(RUBY, { typeKnown: false, bknown: false, quan: 2, oname: 'Ember' });
    const jades = await knownObject(JADE, { typeKnown: false, bknown: false, quan: 3, oname: 'River' });
    learnObjectType(RUBY);
    learnObjectType(JADE);

    assert.equal(objectCombatName(rubies), 'rubies named Ember');
    assert.equal(objectCombatName(jades), 'jade stones named River');
    assert.equal(inventoryItemDescription(rubies), '2 rubies named Ember');
    assert.equal(inventoryItemDescription(jades), '3 jade stones named River');
});

void test('inventory displays real gem identities and quantities after appearance and discovery changes', async () => {
    freshObjectRoom();
    const unknown = await addInventoryObject(EMERALD, { typeKnown: false, bknown: false, quan: 2 });
    const jade = await addInventoryObject(JADE, { typeKnown: false, bknown: false, quan: 3 });
    const diamond = await addInventoryObject(DIAMOND, { typeKnown: false, bknown: false });
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[EMERALD] = 'green';
    learnObjectType(JADE);
    learnObjectType(DIAMOND);
    const input = resetInputState();
    let inventory = '';
    input.beforeRead = () => {
        inventory = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    input.feed('\x1b');

    await ddoinv();

    assert.match(inventory, /Gems\/Stones/);
    assert.ok(inventory.includes(`${unknown.invlet} - 2 green gems`));
    assert.ok(inventory.includes(`${jade.invlet} - 3 jade stones`));
    assert.ok(inventory.includes(`${diamond.invlet} - a diamond`));
});

void test('identification override names an unseen gem without teaching its appearance', async () => {
    freshObjectRoom();
    const jade = await knownObject(JADE, { typeKnown: false, dknown: false });
    game.iflags.override_ID = true;

    assert.equal(objectName(jade), 'jade stone');
    assert.equal(minimalObjectName(jade), 'jade stone');
    assert.equal(jade.dknown, false);
});
