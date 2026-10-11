import { installPagerInput } from './support/pager-input.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, DOOR, HWALL, MM_ANGRY, MM_NOGRP, MM_NOTAIL, NO_MINVENT, PARANOID_BREAKWAND, PIT, W_WEP, } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { advanceMonsterWormBody } from '../js/monster_worm.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, OBJECT_NAMES, TWO_HANDED_SWORD, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_NOTHING, WAN_OPENING, } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { breakWand } from '../js/wand_break.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
function wandRoom({ hero = {}, flags = {}, ...options } = {}) {
    freshObjectRoom({ left: 5, right: 24, top: 5, bottom: 15,
        hero: { uhp: 500, uhpmax: 500, ...hero },
        flags: { verbose: true, ...flags }, gameplaySeed: 19n, ...options });
    requirePlayingGame(game);
    const input = resetInputState();
    const messages = [];
    let reads = 0;
    installPagerInput(input, {
        expected: /wand|charge|explod|Boom|blast|caught|medallion|feel|pit|hole|wall|door|worm|giant|nothing|amulet of life saving|suddenly appears|But wait/i,
        limit: 200,
    });
    input.beforeRead = () => {
        if (++reads > 200)
            throw new Error(`Unexpected broken-wand input: ${game._pending_message}`);
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    return { input, messages };
}
async function wand(otyp = WAN_NOTHING, spe = 3, overrides = {}) {
    return addInventoryObject(otyp, { spe, typeKnown: false, ...overrides });
}
async function bystander(species, x, y, hitPoints = 500, extraFlags = 0) {
    const monster = await createMonsterAt(species, x, y, MM_ANGRY | MM_NOGRP | NO_MINVENT | extraFlags);
    monster.mhp = monster.mhpmax = hitPoints;
    monster.msleeping = 0;
    return monster;
}
void test('applying an inert wand confirms, destroys it, and spends a turn', async () => {
    wandRoom();
    requirePlayingGame(game);
    const object = await wand();
    await applyInventoryObject(object, 'y');
    assert.equal(game.context.move, 1);
    assert.equal(object.where, 'gone');
    assert.ok(!game.inventory.includes(object));
    assert.equal(game.u.uhp, 500);
});
void test('refusing to break a wand preserves its charges and spends no time', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_MAGIC_MISSILE, 3);
    input.feed('n');
    const result = await breakWand(object);
    assert.equal(result.spentTime, false);
    assert.ok(game.inventory.includes(object));
    assert.equal(object.spe, 3);
});
void test('the confirmation waits before removing the wand or spending a charge', async () => {
    wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_MAGIC_MISSILE, 3);
    const input = resetInputState();
    const breaking = breakWand(object);
    await input.waitUntilBlocked();
    try {
        assert.ok(game.inventory.includes(object));
        assert.equal(object.spe, 3);
        assert.equal(game.u.uhp, 500);
    }
    finally {
        input.feed('n');
        await breaking;
    }
});
for (const [answer, broken] of [['y\n', false], ['yes\n', true]]) {
    void test(`paranoid wand confirmation ${broken ? 'accepts yes' : 'rejects a lone y'}`, async () => {
        const { input } = wandRoom({ flags: { paranoia_bits: PARANOID_BREAKWAND } });
        requirePlayingGame(game);
        const object = await wand();
        input.feed(answer);
        const result = await breakWand(object);
        assert.equal(result.spentTime, broken);
        assert.equal(game.inventory.includes(object), !broken);
    });
}
void test('a handless form cannot break a wand', async () => {
    wandRoom();
    requirePlayingGame(game);
    const object = await wand();
    installPolymorphedHero('floating eye');
    const result = await breakWand(object);
    assert.equal(result.spentTime, false);
    assert.ok(game.inventory.includes(object));
    assert.match(game._pending_message, /without hands/);
});
void test('a welded two-handed weapon prevents breaking another object', async () => {
    wandRoom();
    requirePlayingGame(game);
    const object = await wand();
    await setPrimaryWeapon(await addInventoryObject(TWO_HANDED_SWORD, { cursed: true }));
    const result = await breakWand(object);
    assert.equal(result.spentTime, false);
    assert.ok(game.inventory.includes(object));
    assert.match(game._pending_message, /hands are occupied/);
});
for (const [appearance, strength, succeeds] of [
    ['glass', 4, false], ['glass', 5, true], ['balsa', 5, true],
    ['oak', 9, false], ['oak', 10, true],
]) {
    void test(`${appearance} wand breakage ${succeeds ? 'succeeds' : 'fails'} at strength ${strength}`, async () => {
        const { input } = wandRoom();
        requirePlayingGame(game);
        const object = await wand();
        assert.ok(game.objectDescriptions !== undefined && game.objectDescriptions !== null, 'Expected game.objectDescriptions to be initialized');
        game.objectDescriptions[object.otyp] = appearance;
        game.u.acurr.a[A_STR] = strength;
        game.u.amax.a[A_STR] = strength;
        input.feed('y');
        const result = await breakWand(object);
        assert.equal(result.spentTime, succeeds);
        assert.equal(game.inventory.includes(object), !succeeds);
    });
}
for (const charges of [-1, 0]) {
    void test(`an exhausted wand with ${charges} charges breaks without an explosion`, async () => {
        const { input, messages } = wandRoom();
        requirePlayingGame(game);
        const object = await wand(WAN_MAGIC_MISSILE, charges);
        initRng(1n);
        input.feed('y');
        const result = await breakWand(object);
        await flushPendingTopline();
        assert.equal(result.spentTime, true);
        assert.equal(object.where, 'gone');
        assert.equal(game.u.uhp, 500);
        assert.match(messages.join(' '), /nothing else happens/);
        assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
        assert.ok(!game._knownObjectTypes?.has(WAN_MAGIC_MISSILE));
    });
}
void test('breaking a wielded wand clears the weapon slot and voluntary repetition', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand();
    await setPrimaryWeapon(object);
    assert.ok(object.owornmask !== undefined && object.owornmask !== null, 'Expected object.owornmask to be initialized');
    assert.ok(object.owornmask & W_WEP);
    game.multi = 8;
    input.feed('y');
    await breakWand(object);
    assert.equal(game.uwep, null);
    assert.equal(object.owornmask, 0);
    assert.equal(object.where, 'gone');
    assert.equal(game.multi, 0);
});
for (const [otyp, damage] of [
    [WAN_MAGIC_MISSILE, 12], [WAN_FIRE, 24], [WAN_COLD, 24],
    [WAN_LIGHTNING, 48], [WAN_DEATH, 48],
]) {
    void test(`breaking a wand of ${OBJECT_NAMES[otyp]} uses all three original charges`, async () => {
        const { input } = wandRoom();
        requirePlayingGame(game);
        const object = await wand(otyp, 3);
        const jackal = await bystander('jackal', 11, 10);
        input.feed('y');
        const result = await breakWand(object);
        assert.equal(result.heroDied, false);
        assert.equal(game.u.uhp, 500 - damage);
        assert.equal(jackal.mhp, 500 - damage);
        assert.equal(object.where, 'gone');
        assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
        assert.ok(game._knownObjectTypes?.has(otyp));
    });
}
void test('life saving resumes an attack-wand explosion through identification and disposal', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
    const object = await wand(WAN_MAGIC_MISSILE, 3);
    game.u.uhp = 1;
    await flushPendingTopline();
    input.feed('y');
    const result = await breakWand(object);
    assert.equal(result.heroDied, false);
    assert.equal(game.u.umortality, 1);
    assert.ok(game.u.uhp > 0);
    assert.equal(object.where, 'gone');
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(game._knownObjectTypes?.has(WAN_MAGIC_MISSILE));
});
for (const swallowed of [false, true]) {
    void test(`an opening wand releases the hero from ${swallowed ? 'engulfment' : 'a grasp'} without exploding`, async () => {
        const { input } = wandRoom();
        requirePlayingGame(game);
        const object = await wand(WAN_OPENING);
        const holder = await bystander(swallowed ? 'purple worm' : 'owlbear', 11, 10);
        if (swallowed)
            installSwallowedHero(holder);
        else
            game.u.ustuck = holder;
        input.feed('y');
        await breakWand(object);
        assert.equal(game.u.ustuck, null);
        assert.equal(!!game.u.uswallow, false);
        assert.equal(game.u.uhp, 500);
        assert.equal(holder.mhp, 500);
        assert.equal(object.where, 'gone');
        assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
        assert.ok(game._knownObjectTypes?.has(WAN_OPENING));
    });
}
void test('an unseen opening wand releases a grasp without identifying its type', async () => {
    const { input } = wandRoom({ hero: { blindTurns: 20 } });
    requirePlayingGame(game);
    const object = await wand(WAN_OPENING, 2, { dknown: false, observed: false });
    game.u.ustuck = await bystander('owlbear', 11, 10);
    input.feed('y');
    await breakWand(object);
    assert.equal(game.u.ustuck, null);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(!game._knownObjectTypes?.has(WAN_OPENING));
});
void test('a creation wand makes real nearby monsters after the initial blast', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_CREATE_MONSTER, 1);
    grantIntrinsicProperty('antimagic', 'outside');
    input.feed('y');
    await breakWand(object);
    assert.ok(game.level.monsters.length >= 9);
    assert.ok(game.level.monsters.every(monster => monster.mhp > 0 && monster.m_id > 0));
    assert.equal(game.u.uhp, 500);
    assert.equal(object.where, 'gone');
});
void test('a one-charge digging wand opens real pits and lets an adjacent boulder fill its pit', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_DIGGING, 1);
    grantIntrinsicProperty('levitation', 'outside');
    const boulder = await floorObject(BOULDER, 11, 10);
    input.feed('y');
    await breakWand(object);
    assert.equal(boulder.where, 'gone');
    assert.ok(!game.level.traps.some(trap => trap.tx === 11 && trap.ty === 10));
    assert.equal(game.level.traps.filter(trap => trap.ttyp === PIT).length, 8);
    assert.equal(game.u.utrap || 0, 0);
    assert.equal(object.where, 'gone');
});
void test('digging a town wall with a broken wand creates a pit and angers a witness', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_DIGGING, 1);
    grantIntrinsicProperty('levitation', 'outside');
    game.level.flags.has_town = true;
    game.level.requireAt(11, 9).typ = HWALL;
    const watch = await bystander('watchman', 14, 10);
    watch.mpeaceful = 1;
    input.feed('y');
    await breakWand(object);
    assert.equal(watch.mpeaceful, 0);
    assert.equal(game.level.requireAt(11, 9).typ, DOOR);
    assert.ok(game.level.traps.some(trap => trap.tx === 11 && trap.ty === 9 && trap.ttyp === PIT));
});
void test('a broken light wand kills a distant gremlin through the real lighting death owner', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_LIGHT, 1);
    const gremlin = await bystander('gremlin', 14, 10, 1);
    input.feed('y');
    const result = await breakWand(object);
    assert.equal(result.heroDied, false);
    assert.ok(!game.level.monsters.includes(gremlin));
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(game.level.requireAt(14, 10).lit, true);
    assert.equal(object.where, 'gone');
});
void test('flashing a nearby worm tail does not blind the head outside the broken-wand area', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_LIGHT, 1);
    const worm = await bystander('long worm', 11, 10, 500, MM_NOTAIL);
    placeMonsterAt(worm, 12, 10);
    advanceMonsterWormBody(worm);
    assert.ok(worm.wormSegments !== undefined && worm.wormSegments !== null, 'Expected worm.wormSegments to be initialized');
    assert.ok(worm.wormSegments.some(segment => segment.x === 11 && segment.y === 10));
    input.feed('y');
    await breakWand(object);
    assert.equal(worm.mcansee, 1);
    assert.equal(worm.mblinded || 0, 0);
    assert.ok(worm.mhp < 500);
});
void test('a sighted opening-wand confirmation observes its appearance before release identifies it', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_OPENING, 2, { dknown: false, observed: false });
    game.u.ustuck = await bystander('owlbear', 11, 10);
    assert.equal(object.dknown, false);
    input.feed('y');
    await breakWand(object);
    assert.equal(game.u.ustuck, null);
    assert.equal(object.dknown, true);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(game._knownObjectTypes?.has(WAN_OPENING));
});
for (const reason of ['handless', 'weak', 'occupied']) {
    void test(`${reason} admission ${reason === 'occupied' ? 'does not name or observe' : 'names and observes'} an unseen wand`, async () => {
        wandRoom();
        requirePlayingGame(game);
        const object = await wand(WAN_NOTHING, 2, { dknown: false, observed: false });
        if (reason === 'handless')
            installPolymorphedHero('floating eye');
        if (reason === 'weak') {
            game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 3;
        }
        if (reason === 'occupied')
            await setPrimaryWeapon(await addInventoryObject(TWO_HANDED_SWORD, { cursed: true }));
        assert.equal(object.dknown, false);
        await breakWand(object);
        assert.equal(object.dknown, reason !== 'occupied');
        assert.ok(game.inventory.includes(object));
    });
}
void test('a wrested last charge powers the broken wand with one to three charges', async () => {
    const { input, messages } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_MAGIC_MISSILE, 0);
    initRng(49n);
    input.feed('y');
    await breakWand(object);
    await flushPendingTopline();
    assert.match(messages.join(' '), /wrest one last charge/);
    assert.ok([4, 8, 12].includes(500 - game.u.uhp));
    assert.equal(object.where, 'gone');
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(game._knownObjectTypes?.has(WAN_MAGIC_MISSILE));
});
void test('breaking an unpaid wand charges usage and preserves its destroyed-stock bill', async () => {
    const { input } = wandRoom();
    requirePlayingGame(game);
    const object = await wand(WAN_NOTHING, 3, { unpaid: true });
    const { shopkeeper } = await createStaffedShop({
        bill: [{ bo_id: object.o_id, bquan: 1, price: 100, useup: false }],
    });
    object.unpaid = true;
    input.feed('y');
    await breakWand(object);
    assert.ok(shopkeeper.eshk.debit > 0);
    assert.ok(shopkeeper.eshk.bill.some(entry => entry.useup && entry.bquan === 1));
    assert.ok(!game.inventory.includes(object));
    assert.equal(object.where, 'gone');
});
//# sourceMappingURL=wand_break.test.js.map