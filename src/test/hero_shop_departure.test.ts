import { createDungeon } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import type { Monster } from '../js/monster_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, G_EXTINCT, G_GENOD, NO_MINVENT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { gameLogEvents } from '../js/gamelog.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mkstairs } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { CHEST, DAGGER } from '../js/object_data.js';
import { unlinkObject } from '../js/object_location.js';
import { leaveHeroShop } from '../js/shop_departure.js';
import { addShopObjectToBill, checkSpecialRoom } from '../js/shk.js';
import { knownObject, floorObject, addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

const kopNames = ['Keystone Kop', 'Kop Sergeant', 'Kop Lieutenant', 'Kop Kaptain'];
const isKop = (monster: Monster) => kopNames.includes(MONSTER_NAME[monster.mnum] ?? '');

async function shop(options = {}) {
    freshObjectRoom({ left: 3, right: 28, top: 3, bottom: 17, gameplaySeed: 81n,
        flags: { verbose: true, autoopen: true, pickup: false }, ...options });
    requireFixtureGame(game);
    game.plname = 'Ada';
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ depth_start: 1, num_dunlevs: 20, entry_lev: 1, flags: {} } })];
    const input = resetInputState();
    const messages: string[] = [];
    let reads = 0;
    input.beforeRead = () => {
        const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.ok(++reads < 100, 'Shop departure requested too many acknowledgments');
        assert.ok(screen.includes('--More--'), `Unexpected shop input: ${screen.split('\n')[0]}`);
        messages.push(game._pending_message || '');
        input.feed(' ');
    };
    const result = await createStaffedShop({ left: 9, right: 13, top: 8, bottom: 12, keeperX: 12 });
    const door = game.level.requireAt(8, 10);
    door.typ = DOOR;
    door.doormask = 2;
    door.roomno = result.roomno;
    door.edge = true;
    return { ...result, messages };
}

async function purchase(quantity = 1) {
    const object = await addInventoryObject(DAGGER, { quan: quantity });
    await addShopObjectToBill(object, game, { silent: true });
    assert.equal(object.unpaid, true);
    return object;
}

async function moveTo(x: number, y = 10) {
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = x;
    game.u.uy = y;
    await checkSpecialRoom();
}

function retireKops(flag = G_GENOD) {
    for (const name of kopNames) {
        const vital = game.mvitals?.[MONSTER_NAME.indexOf(name)];
        assert.ok(vital);
        vital.mvflags |= flag;
    }
}

void test('stepping onto the boundary warns without clearing an unpaid bill', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    const object = await purchase();
    await moveTo(8);
    assert.match(game._lastPlineMessage, /Ada!  Please pay before leaving/);
    assert.equal(object.unpaid, true);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(shopkeeper.eshk.robbed || 0, 0);
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.ok(!game.level.monsters.some(isKop));
    await checkSpecialRoom();
    assert.equal(shopkeeper.eshk.robbed || 0, 0);
});

void test('leaving outright applies partial credit and starts pursuit for the remainder', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    retireKops();
    const object = await purchase(2);
    const firstBill = shopkeeper.eshk.bill[0];
    assert.ok(firstBill);
    const billed = firstBill.price * 2;
    shopkeeper.eshk.credit = 3;
    shopkeeper.eshk.debit = 7;
    shopkeeper.eshk.loan = 7;
    const alignment = game.u.ualign.record;
    await moveTo(7);
    assert.equal(object.unpaid, false);
    assert.equal(shopkeeper.eshk.robbed, billed + 7 - 3);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.loan, 0);
    assert.equal(shopkeeper.eshk.following, 1);
    assert.equal(shopkeeper.eshk.customer, 'Ada');
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.eshk.surcharge, true);
    assert.equal(game.u.ualign.record, alignment - Math.sign(game.u.ualign.type));
    assert.match(gameLogEvents().at(-1)?.text ?? '', /stole .* merchandise from .* general store/);
});

void test('sufficient credit settles the entire transaction without anger or alarm', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    const object = await purchase();
    const firstBill = shopkeeper.eshk.bill[0];
    assert.ok(firstBill);
    shopkeeper.eshk.credit = firstBill.price + 20;
    await moveTo(7);
    assert.equal(object.unpaid, false);
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(shopkeeper.eshk.robbed || 0, 0);
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.ok(!game.level.monsters.some(isKop));
    assert.match(game._lastPlineMessage, /credit .* cover your shopping bill/);
});

void test('a Rogue can steal without changing alignment', async () => {
    const { shopkeeper } = await shop({ role: 'rogue' });
    requireFixtureGame(game);
    retireKops();
    await purchase();
    const alignment = game.u.ualign.record;
    await moveTo(7);
    assert.ok(shopkeeper.eshk.robbed != null);
    assert.ok(shopkeeper.eshk.robbed > 0);
    assert.equal(game.u.ualign.record, alignment);
});

void test('a helpless keeper recovers and treats the boundary crossing as robbery', async () => {
    const { shopkeeper } = await shop();
    retireKops();
    await purchase();
    shopkeeper.msleeping = 1;
    shopkeeper.mcanmove = 0;
    shopkeeper.mfrozen = 5;
    await moveTo(8);
    assert.equal(shopkeeper.msleeping, 0);
    assert.equal(shopkeeper.mcanmove, 1);
    assert.equal(shopkeeper.mfrozen, 0);
    assert.ok(shopkeeper.eshk.robbed != null);
    assert.ok(shopkeeper.eshk.robbed > 0);
    assert.equal(shopkeeper.eshk.following, 1);
});

void test('an absent keeper cannot convert the old bill to a robbery', async () => {
    const { shopkeeper } = await shop();
    const object = await purchase();
    // Native inhishop uses the current position, independently of residence.
    shopkeeper.mx = 20;
    shopkeeper.my = 10;
    await moveTo(7);
    assert.equal(object.unpaid, true);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(shopkeeper.eshk.robbed || 0, 0);
});

void test('a robbery alarm wakes and angers real watch guards when Kops are gone', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    retireKops(G_EXTINCT);
    const watchman = await createMonsterAt('watchman', 15, 10, NO_MINVENT);
    watchman.msleeping = 1;
    watchman.mfrozen = 5;
    await purchase();
    await moveTo(7);
    assert.ok(shopkeeper.eshk.robbed != null);
    assert.ok(shopkeeper.eshk.robbed > 0);
    assert.equal(watchman.mpeaceful, 0);
    assert.equal(watchman.msleeping, 0);
    assert.equal(watchman.mfrozen, 0);
    assert.ok(!game.level.monsters.some(isKop));
});

void test('a doorway exit calls actual Kops near the hero and skips extinct ranks', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    const kopVital = game.mvitals?.[MONSTER_NAME.indexOf('Keystone Kop')];
    assert.ok(kopVital);
    kopVital.mvflags |= G_GENOD;
    await purchase();
    await moveTo(8);
    await moveTo(7);
    assert.ok(shopkeeper.eshk.robbed != null);
    assert.ok(shopkeeper.eshk.robbed > 0);
    const responders = game.level.monsters.filter(isKop);
    assert.ok(responders.length > 0);
    assert.ok(responders.some(monster => MONSTER_NAME[monster.mnum] === 'Kop Sergeant'));
    assert.ok(responders.every(monster => MONSTER_NAME[monster.mnum] !== 'Keystone Kop'));
    assert.ok(responders.every(monster => monster.mpeaceful === 0 && monster.mhp > 0));
});

void test('pursuit clears ownership exemptions on floor contents and pet inventories', async () => {
    await shop();
    requireFixtureGame(game);
    retireKops();
    await purchase();
    const chest = await floorObject(CHEST, 11, 10, { initialize: false, no_charge: true });
    const content = await knownObject(DAGGER, { no_charge: true });
    await addCreatedObjectToContainer(chest, content);
    const pet = await createMonsterAt('little dog', 15, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    const petObject = await knownObject(DAGGER, { no_charge: true });
    await linkObjectToMonsterInventory(pet, petObject);
    assert.equal(chest.no_charge, true);
    assert.equal(content.no_charge, true);
    assert.equal(petObject.no_charge, true);
    await moveTo(7);
    assert.equal(chest.no_charge, false);
    assert.equal(content.no_charge, false);
    assert.equal(petObject.no_charge, false);
});

void test('settling a shop clears unpaid status from an object currently being kicked', async () => {
    await shop();
    requireFixtureGame(game);
    retireKops();
    const object = await purchase();
    unlinkObject(object);
    game._kickedObject = object;
    await moveTo(7);
    assert.equal(object.unpaid, false);
});

void test('a level departure settles the source shop before changing room membership', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    retireKops();
    const object = await purchase();
    await checkSpecialRoom({ newLevel: true });
    assert.equal(object.unpaid, false);
    assert.ok(shopkeeper.eshk.robbed != null);
    assert.ok(shopkeeper.eshk.robbed > 0);
    assert.equal(game.u.ushops.length, 0);
});

void test('ordinary movement out of a shop invokes the same robbery owner', async () => {
    const { shopkeeper } = await shop();
    requireFixtureGame(game);
    retireKops();
    await purchase();
    await rhack('h'.charCodeAt(0));
    await rhack('h'.charCodeAt(0));
    assert.equal(shopkeeper.eshk.robbed || 0, 0);
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 7);
    assert.ok(shopkeeper.eshk.robbed != null);
    assert.ok(shopkeeper.eshk.robbed > 0);
    assert.equal(game.u.ushops.length, 0);
});

void test('explicit departure for negative level teleport settles the real source bill', async () => {
    const { shopkeeper, roomno } = await shop();
    retireKops();
    const object = await purchase();
    await leaveHeroShop([roomno], { newLevel: true });
    await flushPendingTopline();
    assert.equal(object.unpaid, false);
    assert.equal(shopkeeper.eshk.following, 1);
});

for (const buildsUp of [false, true] as const) {
    void test(`a level exit calls Kops at the forward ${buildsUp ? 'up' : 'down'} stairs and the shop`, async () => {
        const { shopkeeper } = await shop();
        requireFixtureGame(game);
        const dungeon = game.dungeons[0];
        assert.ok(dungeon);
        dungeon.entry_lev = buildsUp ? 20 : 1;
        mkstairs(25, 5, true, null);
        mkstairs(25, 15, false, null);
        await purchase();
        await checkSpecialRoom({ newLevel: true });
        const responders = game.level.monsters.filter(isKop);
        assert.ok(responders.length > 0);
        const first = responders[0];
        assert.ok(first != null);
        assert.ok(Math.abs(first.mx - 25) <= 1);
        assert.ok(Math.abs(first.my - (buildsUp ? 5 : 15)) <= 1);
        assert.ok(responders.some(monster => Math.abs(monster.mx - shopkeeper.mx) <= 1
            && Math.abs(monster.my - shopkeeper.my) <= 1));
        assert.ok((game.mvitals?.[first.mnum]?.born ?? 0) > 0);
    });
}
