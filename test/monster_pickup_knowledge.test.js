import { objectTypeKnown } from '../js/shk.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeMonster, canSenseMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { fullyIdentifyObject, inventoryItemDescription, } from '../js/invent.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { GLOB_OF_BLACK_PUDDING, OBJECT_NAMES, SADDLE, SHIELD_OF_REFLECTION, WAN_WISHING, } from '../js/object_data.js';
import { knownObject, uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function nearbyAnt() {
    freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    return createMonsterAt('giant ant', 11, 10);
}
async function fullyKnownSaddle(overrides = {}) {
    return await knownObject(SADDLE, {
        name: 'saddle',
        plural: 'saddles',
        bknown: true,
        cknown: true,
        dknown: true,
        known: true,
        lknown: true,
        rknown: true,
        tknown: true,
        typeKnown: true,
        ...overrides,
    });
}
void test('an unseen hostile pickup hides the saddle details the hero can no longer track', async () => {
    const ant = await nearbyAnt();
    ant.minvis = true;
    const saddle = await fullyKnownSaddle({
        blessed: true,
        spe: 4,
        oextra: { oname: 'Maple' },
    });
    fullyIdentifyObject(saddle, game);
    assert.equal(saddle.buc, 'blessed');
    assert.equal(inventoryItemDescription(saddle), 'a blessed saddle named Maple');
    const carried = await addObjectToMonsterInventory(ant, saddle, game);
    assert.equal(carried, saddle);
    assert.equal(inventoryItemDescription(saddle), 'a saddle');
    assert.deepEqual({
        bknown: saddle.bknown,
        cknown: saddle.cknown,
        dknown: saddle.dknown,
        known: saddle.known,
        lknown: saddle.lknown,
        rknown: saddle.rknown,
        tknown: saddle.tknown,
    }, {
        bknown: false,
        cknown: false,
        dknown: false,
        known: true,
        lknown: false,
        rknown: false,
        tknown: false,
    });
    assert.equal(objectTypeKnown(saddle), true);
    assert.equal(Object.hasOwn(saddle, 'buc'), false);
    assert.equal(saddle.blessed, true);
    assert.equal(saddle.cursed, false);
    assert.equal(saddle.spe, 4);
    assert.equal(saddle.oextra?.oname, 'Maple');
});
void test('unseen pickup keeps the source description exceptions and type identity', async () => {
    const ant = await nearbyAnt();
    ant.minvis = true;
    const armor = await knownObject(OBJECT_NAMES.indexOf('plate mail'), { dknown: false });
    const shield = await knownObject(SHIELD_OF_REFLECTION);
    const glob = await uninitializedObject(GLOB_OF_BLACK_PUDDING, {
        dknown: false,
    });
    const wand = await knownObject(WAN_WISHING, {
        cknown: true,
        lknown: true,
        rknown: true,
        tknown: true,
        typeKnown: true,
    });
    for (const object of [armor, shield, glob, wand])
        await addObjectToMonsterInventory(ant, object, game);
    assert.equal(armor.dknown, true);
    assert.equal(shield.dknown, false);
    assert.equal(glob.dknown, true);
    assert.equal(wand.known, false);
    assert.equal(objectTypeKnown(wand), true);
    assert.equal(inventoryItemDescription(wand), 'a wand');
});
void test('a visible hostile pickup preserves object knowledge', async () => {
    const ant = await nearbyAnt();
    const saddle = await fullyKnownSaddle({ blessed: true });
    fullyIdentifyObject(saddle, game);
    assert.equal(canSeeMonster(ant), true);
    await addObjectToMonsterInventory(ant, saddle, game);
    assert.equal(saddle.buc, 'blessed');
    assert.equal(inventoryItemDescription(saddle), 'a blessed saddle');
    assert.deepEqual({
        bknown: saddle.bknown,
        cknown: saddle.cknown,
        dknown: saddle.dknown,
        known: saddle.known,
        lknown: saddle.lknown,
        rknown: saddle.rknown,
        tknown: saddle.tknown,
    }, {
        bknown: true,
        cknown: true,
        dknown: true,
        known: true,
        lknown: true,
        rknown: true,
        tknown: true,
    });
});
void test('telepathy does not substitute for seeing a hostile pickup', async () => {
    const ant = await nearbyAnt();
    const saddle = await fullyKnownSaddle({ blessed: true });
    ant.minvis = true;
    game.blind = true;
    game.u.telepathy = true;
    assert.equal(canSeeMonster(ant), false);
    assert.equal(canSenseMonster(ant), true);
    await addObjectToMonsterInventory(ant, saddle, game);
    assert.equal(inventoryItemDescription(saddle), 'a saddle');
    assert.equal(saddle.dknown, false);
    assert.equal(saddle.bknown, false);
});
void test('an unseen tame monster does not erase object knowledge', async () => {
    const ant = await nearbyAnt();
    ant.minvis = true;
    ant.mtame = 10;
    ant.pet = true;
    const saddle = await fullyKnownSaddle({ blessed: true });
    fullyIdentifyObject(saddle, game);
    await addObjectToMonsterInventory(ant, saddle, game);
    assert.equal(saddle.buc, 'blessed');
    assert.equal(inventoryItemDescription(saddle), 'a blessed saddle');
    assert.equal(saddle.dknown, true);
    assert.equal(saddle.bknown, true);
});
void test('touch keeps knowledge when the unseen monster is holding the hero', async () => {
    const ant = await nearbyAnt();
    ant.minvis = true;
    game.u.ustuck = ant;
    const saddle = await fullyKnownSaddle({ blessed: true });
    await addObjectToMonsterInventory(ant, saddle, game);
    assert.equal(inventoryItemDescription(saddle), 'a blessed saddle');
    assert.equal(saddle.dknown, true);
    assert.equal(saddle.bknown, true);
});
void test('a swallowed crysknife pickup keeps its edge with no release', async () => {
    const { pickupAtHero } = await import('../js/pickup.js');
    freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const engulfer = await createMonsterAt('purple worm', 10, 10);
    engulfer.mx = 10;
    engulfer.my = 10;
    game.u.uswallow = true;
    game.u.ustuck = engulfer;
    const CRYSKNIFE = OBJECT_NAMES.indexOf('crysknife');
    const knife = await knownObject(CRYSKNIFE, { dknown: true, oerodeproof: false });
    await addObjectToMonsterInventory(engulfer, knife, game);
    game.flags.pickup = true;
    await pickupAtHero();
    // C pick_obj(): obj_extract_self only - the swallowed knife stays a
    // crysknife in the hero's inventory, un-reverted, unbilled.
    assert.equal(knife.otyp, CRYSKNIFE);
    assert.ok(game.inventory.includes(knife));
    assert.equal(knife.where, 'inventory');
    game.u.uswallow = false;
    game.u.ustuck = null;
});
//# sourceMappingURL=monster_pickup_knowledge.test.js.map