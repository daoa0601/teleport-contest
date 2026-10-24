import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { flush_screen } from '../js/display.js';
import { floorObjectDescription, showFloorPile } from '../js/floor_object_display.js';
import { game } from '../js/gstate.js';
import { fullyIdentifyObject, inventoryItemDescription } from '../js/invent.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    CHEST, CRYSKNIFE, FIGURINE, LONG_SWORD, POT_BOOZE, POT_WATER,
    RIN_PROTECTION, SHORT_SWORD, STATUE, TIN, YA,
} from '../js/object_data.js';
import { learnObjectType, recordObjectCall } from '../js/object_knowledge.js';
import { objectName } from '../js/objnam.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a Samurai sees sake when looking at a known potion on the floor', async () => {
    freshObjectRoom({ role: 'samurai' });
    const potion = await floorObject(POT_BOOZE, game.u.ux, game.u.uy, { bknown: false });

    await showFloorPile([potion]);
    await flush_screen(1);

    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(),
        'You see here a potion of sake.');
    assert.equal(await inventoryItemDescription(potion), 'a potion of sake');
});

void test('Samurai weapon names and known enchantments apply on the floor too', async () => {
    freshObjectRoom({ role: 'samurai' });
    const sword = await knownObject(SHORT_SWORD, { spe: 2, bknown: false });

    assert.equal(await floorObjectDescription(sword), 'a +2 wakizashi');
    assert.equal(await inventoryItemDescription(sword), 'a +2 wakizashi');
});

void test('named ya stacks retain their arrow noun in inventory and floor descriptions', async () => {
    freshObjectRoom({ role: 'samurai' });
    const arrows = await knownObject(YA, { quan: 3, spe: 1, oname: 'Needle', bknown: false });

    assert.equal(await inventoryItemDescription(arrows), '3 +1 ya named Needle');
    assert.equal(await floorObjectDescription(arrows), '3 +1 ya named Needle');
});

void test('holy water wording requires both type and blessing knowledge', async () => {
    freshObjectRoom();
    const potion = await knownObject(POT_WATER, {
        typeKnown: false, known: false, bknown: false, blessed: true,
    });
    assert.equal(await inventoryItemDescription(potion), 'a clear potion');
    potion.bknown = true;
    assert.equal(await inventoryItemDescription(potion), 'a blessed clear potion');

    learnObjectType(POT_WATER);

    assert.equal(await inventoryItemDescription(potion), 'a potion of holy water');
    potion.bknown = false;
    assert.equal(await inventoryItemDescription(potion), 'a potion of water');
});

void test('identification override retains the blessing of globally unknown water', async () => {
    freshObjectRoom();
    const potion = await knownObject(POT_WATER, {
        typeKnown: false, known: false, bknown: false, blessed: true,
    });
    game.iflags.override_ID = true;

    assert.equal(await inventoryItemDescription(potion), 'a blessed potion of holy water');
    assert.equal(potion.bknown, false);
});

void test('fully identified Grimtooth uses its artifact identity without a poison prefix', async () => {
    freshObjectRoom();
    const artifact = artifactByName('Grimtooth');
    assert.ok(artifact);
    const dagger = await knownObject(artifact.baseType, { spe: 0 });
    assert.equal(nameArtifact(dagger, artifact), true);
    fullyIdentifyObject(dagger);

    assert.ok(dagger.opoisoned);
    assert.equal(await inventoryItemDescription(dagger), 'the +0 Grimtooth');
});

void test('dilution is visible only after the potion appearance has been observed', async () => {
    freshObjectRoom();
    const potion = await knownObject(POT_BOOZE, {
        dknown: false, bknown: false, odiluted: true,
    });
    assert.equal(await inventoryItemDescription(potion), 'a potion');

    potion.dknown = true;

    assert.equal(await inventoryItemDescription(potion), 'a diluted potion of booze');
});

void test('an unknown called ring uses the class noun without revealing its true type', async () => {
    freshObjectRoom();
    const ring = await knownObject(RIN_PROTECTION, {
        typeKnown: false, known: false, bknown: false,
    });
    recordObjectCall(RIN_PROTECTION, 'Luck');

    assert.equal(objectName(ring), 'ring called Luck');
    assert.equal(await inventoryItemDescription(ring), 'a ring called Luck');
});

void test('a called potion retains its dilution but omits the appearance adjective', async () => {
    freshObjectRoom();
    const potion = await knownObject(POT_BOOZE, {
        typeKnown: false, known: false, bknown: false, odiluted: true,
    });
    recordObjectCall(POT_BOOZE, 'tonic');

    assert.equal(objectName(potion), 'diluted potion called tonic');
    assert.equal(await floorObjectDescription(potion), 'a diluted potion called tonic');
});

void test('plural tins retain their known contents and individual name', async () => {
    freshObjectRoom();
    const tins = await knownObject(TIN, {
        quan: 2, spe: 1, corpsenm: -1, bknown: false, oname: 'Lunch',
    });

    assert.equal(await inventoryItemDescription(tins), '2 tins of spinach named Lunch');
    assert.equal(await floorObjectDescription(tins), '2 tins of spinach named Lunch');
});

void test('figurines retain species and individual names after pluralization', async () => {
    freshObjectRoom();
    const figurines = await knownObject(FIGURINE, {
        quan: 2, corpsenm: MONSTER_NAME.indexOf('kitten'), spe: 0,
        bknown: false, oname: 'Keepsake',
    });

    assert.equal(await inventoryItemDescription(figurines), '2 figurines of a kitten named Keepsake');
});

void test('named statues describe their subject on both the floor and in inventory', async () => {
    freshObjectRoom();
    const statue = await knownObject(STATUE, {
        corpsenm: MONSTER_NAME.indexOf('kitten'), spe: 0,
        bknown: false, oname: 'Mittens',
    });

    assert.equal(await inventoryItemDescription(statue), 'a statue of a kitten named Mittens');
    assert.equal(await floorObjectDescription(statue), 'a statue of a kitten named Mittens');
});

void test('known empty containers describe their traps, locks, and grease', async () => {
    freshObjectRoom();
    const chest = await knownObject(CHEST, {
        bknown: false, cknown: true, lknown: true, olocked: true,
        otrapped: true, tknown: true, greased: true, contents: [],
    });

    assert.equal(await floorObjectDescription(chest), 'an empty trapped locked greased chest');
});

void test('iron corrosion and known proofing use their native descriptions', async () => {
    freshObjectRoom();
    const sword = await knownObject(LONG_SWORD, {
        bknown: false, spe: 1, oeroded2: 2, oerodeproof: true, rknown: false,
    });
    assert.equal(await inventoryItemDescription(sword), 'a very corroded +1 long sword');

    sword.rknown = true;

    assert.equal(await inventoryItemDescription(sword), 'a very corroded rustproof +1 long sword');
});

void test('a known erodeproof crysknife is fixed without ordinary erosion words', async () => {
    freshObjectRoom();
    const knife = await knownObject(CRYSKNIFE, {
        bknown: false, spe: 0, rknown: true, oerodeproof: true, oeroded: 2,
    });

    assert.equal(await inventoryItemDescription(knife), 'a fixed +0 crysknife');
});
