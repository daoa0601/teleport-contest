import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MV_KNOWS_EGG } from '../js/const.js';
import { game } from '../js/gstate.js';
import { fullyIdentifyObject, identifyPack, inventoryItemDescription, } from '../js/invent.js';
import { mksobj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { objectName } from '../js/objnam.js';
import { CLUB, EGG, POT_HEALING, RIN_CONFLICT, SACK, SADDLE, STATUE, TIN, } from '../js/object_data.js';
import { addInventoryObject, artifactObject, knownObject, } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
async function unidentified(otyp, overrides = {}) {
    return await knownObject(otyp, {
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
        cknown: false,
        lknown: false,
        ...overrides,
    });
}
void test('full identification reveals an object and its type', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const ring = await unidentified(RIN_CONFLICT);
    fullyIdentifyObject(ring);
    assert.equal(ring.known, true);
    assert.equal(ring.bknown, true);
    assert.equal(ring.dknown, true);
    assert.equal(ring.rknown, true);
    assert.equal(ring.typeKnown, true);
    assert.ok(game._knownObjectTypes !== null && game._knownObjectTypes !== undefined);
    assert.ok(game._knownObjectTypes.has(RIN_CONFLICT));
    assert.ok(game._encounteredObjectTypes !== null && game._encounteredObjectTypes !== undefined);
    assert.ok(game._encounteredObjectTypes.has(RIN_CONFLICT));
    assert.match(inventoryItemDescription(ring), /ring of conflict/);
});
void test('a fully identified generated tool uses its canonical name', async () => {
    freshGameplayRoom();
    const saddle = await mksobj(SADDLE, true, false);
    fullyIdentifyObject(saddle);
    assert.match(inventoryItemDescription(saddle), /saddle/);
});
void test('full identification does not observe an object while hallucinating', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.hallucinationTurns = 10;
    const potion = await unidentified(POT_HEALING);
    fullyIdentifyObject(potion);
    assert.equal(potion.typeKnown, true);
    assert.equal(potion.known, true);
    assert.equal(potion.bknown, true);
    assert.equal(potion.rknown, true);
    assert.equal(potion.dknown, false);
    assert.ok(game._knownObjectTypes !== null && game._knownObjectTypes !== undefined);
    assert.ok(game._knownObjectTypes.has(POT_HEALING));
});
void test('full identification does not observe or discover a generic object', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const generic = await unidentified(0, {
        typeKnown: false,
        known: false,
        bknown: false,
        dknown: false,
        rknown: false,
        blessed: false,
        cursed: false,
    });
    fullyIdentifyObject(generic);
    assert.equal(generic.typeKnown, false);
    assert.equal(generic.dknown, false);
    assert.equal(generic.known, true);
    assert.equal(generic.bknown, true);
    assert.equal(generic.rknown, true);
    assert.equal(game._knownObjectTypes?.has(generic.otyp) ?? false, false);
});
void test('full identification reveals only applicable container details', async () => {
    freshGameplayRoom();
    const sack = await unidentified(SACK, { contents: [] });
    const statue = await unidentified(STATUE, { contents: [] });
    const tin = await unidentified(TIN);
    const club = await unidentified(CLUB);
    for (const object of [sack, statue, tin, club])
        fullyIdentifyObject(object);
    assert.deepEqual([sack.cknown, sack.lknown], [true, true], 'containers reveal contents and lock knowledge');
    assert.deepEqual([statue.cknown, statue.lknown], [true, true], 'statues reveal contents and lock knowledge');
    assert.deepEqual([tin.cknown, tin.lknown], [true, false], 'tins reveal contents but have no lock knowledge');
    assert.deepEqual([club.cknown, club.lknown], [false, false], 'unrelated objects do not gain container flags');
});
void test('full identification discovers an artifact and reveals its name', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const sword = await artifactObject('Excalibur', {
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
    });
    assert.notEqual(objectName(sword), 'Excalibur');
    fullyIdentifyObject(sword);
    assert.ok(game._artifactDiscoveries !== null && game._artifactDiscoveries !== undefined);
    assert.ok(sword.oartifact);
    assert.ok(game._artifactDiscoveries.includes(sword.oartifact));
    assert.equal(objectName(sword), 'Excalibur');
});
void test('identifying a baby dragon egg teaches the adult egg species', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const babyDragon = MONSTER_NAME.indexOf('baby gray dragon');
    const adultDragon = MONSTER_NAME.indexOf('gray dragon');
    const babyEgg = await addInventoryObject(EGG, {
        corpsenm: babyDragon,
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
    });
    const adultEgg = await knownObject(EGG, {
        corpsenm: adultDragon,
        known: false,
    });
    await identifyPack(0);
    assert.match(inventoryItemDescription(babyEgg), /baby gray dragon egg/);
    assert.equal((game.mvitals[babyDragon]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    assert.ok((game.mvitals[adultDragon]?.mvflags ?? 0) & MV_KNOWS_EGG);
    assert.match(inventoryItemDescription(adultEgg), /gray dragon egg/);
});
void test('identifyPack teaches an egg species and all such eggs use its name', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const grayDragon = MONSTER_NAME.indexOf('gray dragon');
    const carriedEggs = await addInventoryObject(EGG, {
        corpsenm: grayDragon,
        quan: 2,
        quantity: 2,
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
    });
    const otherEgg = await knownObject(EGG, {
        corpsenm: grayDragon,
        known: false,
    });
    await identifyPack(0);
    assert.ok((game.mvitals[grayDragon]?.mvflags ?? 0) & MV_KNOWS_EGG);
    assert.match(inventoryItemDescription(carriedEggs), /2 .*gray dragon eggs/);
    assert.match(inventoryItemDescription(otherEgg), /gray dragon egg/);
});
//# sourceMappingURL=identify_object.test.js.map