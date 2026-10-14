import type { RoleKey } from '../js/roles.js';
import type { ShopBillEntry, ShopkeeperData, Monster } from '../js/monster_types.js';
import { isRoom } from '../js/map_types.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    D_LOCKED, D_NODOOR, DOOR, HWALL, MON_LIMBO, POOL, ROOM,
    SHOP_DOOR_COST,
    SHOP_WALL_COST,
    W_ARM, W_QUIVER, W_SWAPWEP,
} from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { canSpotMonster } from '../js/display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { bindInputGate, InputGate, resetInputState } from '../js/input.js';
import {
    ARROW, DAGGER, BOULDER, CHAIN_MAIL, LAND_MINE, LEASH, LOCK_PICK, POT_FRUIT_JUICE,
} from '../js/object_data.js';
import {
    addShopDamage, makeAngryShopkeeper, pacifyShopkeeper,
    payForShopDamage, repairShopDamage, rileShopkeeper, setPaidShopkeeper,
    shopDig, shopkeeperRepairsDamage,
} from '../js/shop_damage.js';
import { deliverMigratingMonsters } from '../js/monster_migration.js';
import { createMonsterAt } from './support/monsters.js';
import { checkSpecialRoom } from '../js/shk.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

const SHOP = { left: 9, right: 13, top: 9, bottom: 11 };

// A staffed shop with a real west wall gap candidate and a door entrance.
async function damageShop({ bill = [], role = 'caveman', moves = 100 }: { bill?: ShopBillEntry[]; role?: RoleKey; moves?: number } = {}) {
    freshObjectRoom({
        ...SHOP, role, moves,
        hero: { ualign: { type: 1, record: 10 } },
    });
    const input = resetInputState();
    input.beforeRead = () => {
        assert.ok(game.nhDisplay);
        const screen = game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, /--More--/, `Unexpected shop damage input: ${screen.split('\n')[0]}`);
        input.feed(' ');
    };
    const { roomno, shopkeeper } = await createStaffedShop({
        ...SHOP, keeperX: 12, keeperY: 10, doorX: 9, doorY: 10, bill,
    });
    // The door and the wall west of it carry the shop room number, as C's
    // room boundary does.
    const doorSquare = requireGameLevel(game).requireAt(9, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_NODOOR;
    doorSquare.roomno = roomno;
    doorSquare.edge = true;
    doorSquare.lit = true;
    doorSquare.waslit = true;
    const wallSquare = requireGameLevel(game).requireAt(8, 10);
    wallSquare.typ = HWALL;
    wallSquare.roomno = roomno;
    wallSquare.edge = true;
    wallSquare.lit = true;
    wallSquare.waslit = true;
    vision_recalc(0);
    game.u.ux0 = 4;
    game.u.uy0 = 10;
    await checkSpecialRoom();
    return { roomno, shopkeeper };
}

void test('shop wall damage is recorded once per spot and accumulates cost', async () => {
    const { shopkeeper } = await damageShop();
    addShopDamage(8, 10, SHOP_WALL_COST);
    game.moves += 1;
    addShopDamage(8, 10, 10);
    const records = requireGameLevel(game).damagelist;
    assert.ok(records);
    const record = records[0];
    assert.ok(record);
    assert.equal(records.length, 1);
    assert.equal(record.place.x, 8);
    assert.equal(record.place.y, 10);
    assert.equal(record.cost, SHOP_WALL_COST + 10);
    assert.equal(record.when, game.moves);
    assert.equal(record.typ, HWALL);
    assert.equal(shopkeeper.mpeaceful, 1);
});

void test('a door away from the shop entrance is never scheduled for repair', async () => {
    await damageShop();
    const doorSquare = requireGameLevel(game).requireAt(9, 9);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_NODOOR;
    doorSquare.edge = true;
    addShopDamage(9, 9, SHOP_DOOR_COST);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    assert.equal((requireGameLevel(game).damagelist ?? []).length, 1);
    assert.equal(requireGameLevel(game).damagelist?.[0]?.place.y, 10);
});

void test('paying for fresh damage keeps the keeper peaceful and the record',
    async () => {
        await damageShop();
        setHeroGoldAmount(game, 500);
        addShopDamage(9, 10, SHOP_DOOR_COST);
        initRng(61n);
        await answerDamageQuestion('y');

        assert.equal(heroGoldAmount(game), 500 - SHOP_DOOR_COST);
        assert.equal(shopkeeper0().mpeaceful, 1);
        assert.equal(shopkeeper0().eshk.following, 0);
        // C leaves the record scheduled for later repair.
        assert.equal((requireGameLevel(game).damagelist ?? []).length, 1);
        assert.match(game._lastPlineMessage, /shifts location|appears|returns/);
    });

void test('refusing to pay angers the keeper and drains alignment', async () => {
    await damageShop();
    setHeroGoldAmount(game, 500);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    initRng(61n);
    await answerDamageQuestion('n');

    const keeper = shopkeeper0();
    assert.equal(keeper.mpeaceful, 0);
    assert.equal(keeper.eshk.following, 1);
    assert.equal(keeper.eshk.surcharge, true);
    requirePlayingGame(game);
    assert.equal(game.u.ualign.record, 9);
    assert.equal(heroGoldAmount(game), 500);
    assert.equal(game._lastPlineMessage,
        '"Oh, yes!  You\'ll pay!"');
});

void test('an unbribable keeper scolds instead of asking for payment', async () => {
    await damageShop();
    setHeroGoldAmount(game, 5000);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    initRng(61n);
    await payForShopDamage('dig into', { cantMollify: true });

    const keeper = shopkeeper0();
    assert.equal(keeper.mpeaceful, 0);
    assert.equal(keeper.eshk.following, 1);
    assert.equal(heroGoldAmount(game), 5000);
    assert.equal(game._lastPlineMessage,
        '"How dare you dig into my shop?"');
});

void test('a hero who cannot cover the damage is scolded, not billed', async () => {
    await damageShop();
    setHeroGoldAmount(game, 10);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    initRng(61n);
    await payForShopDamage('break');

    assert.equal(shopkeeper0().mpeaceful, 0);
    assert.equal(heroGoldAmount(game), 10);
});

void test('yesterday\'s damage is not charged to the hero again', async () => {
    await damageShop();
    setHeroGoldAmount(game, 500);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    game.moves += 1;
    initRng(61n);
    await payForShopDamage('break');

    assert.equal(heroGoldAmount(game), 500);
    assert.equal(shopkeeper0().mpeaceful, 1);
    assert.equal((requireGameLevel(game).damagelist ?? []).length, 1);
});

void test('digging the shop floor draws a spoken warning', async () => {
    await damageShop();
    await shopDig(0);
    assert.equal(game._lastPlineMessage,
        '"Sir, do not damage the floor here!"');
});

void test('a knight digging the shop floor feels like a thief', async () => {
    await damageShop({ role: 'knight' });
    await shopDig(0);
    assert.equal(game._lastPlineMessage, 'You feel like a common thief.');
    requirePlayingGame(game);
    assert.equal(game.u.ualign.record, 9);
});

void test('a floor opening under the indebted hero loses the backpack',
    async () => {
        await damageShop();
        const potion = await addInventoryObject(POT_FRUIT_JUICE);
        const keeper = shopkeeper0();
        keeper.eshk.bill = [{
            bo_id: potion.o_id, bquan: 1, useup: false, price: 60,
        }];
        keeper.eshk.billct = 1;
        const armor = await addInventoryObject(CHAIN_MAIL, {
            owornmask: W_ARM, worn: true,
        });
        const quiver = await addInventoryObject(ARROW, {
            owornmask: W_QUIVER, ready: true,
        });
        const spare = await addInventoryObject(DAGGER, {
            owornmask: W_SWAPWEP, alternate: true,
        });
        const leash = await addInventoryObject(LEASH, { leashmon: 5 });
        game.uswapwep = spare;
        game.u.uswapwep = spare;
        game.uquiver = quiver;
        game.u.uquiver = quiver;

        initRng(28101n);
        await shopDig(1);

        const moved = keeper.minvent || keeper.inventory || [];
        // The keeper reached the hero's side to grab the pack.
        const dx = Math.abs(keeper.mx - game.u.ux);
        const dy = Math.abs(keeper.my - game.u.uy);
        assert.ok(dx <= 1 && dy <= 1, `keeper at ${keeper.mx},${keeper.my}`);
        assert.ok(moved.some(object => object === potion));
        assert.ok(moved.some(object => object === quiver));
        assert.ok(moved.some(object => object === spare));
        // Worn armor and an attached leash stay with the hero.
        assert.ok(game.inventory.includes(armor));
        assert.ok(game.inventory.includes(leash));
        assert.ok(!moved.includes(armor));
        assert.ok(!moved.includes(leash));
        assert.match(game._lastPlineMessage, /grabs your backpack!/);
    });

void test('a floor opening with no open bill changes nothing', async () => {
    await damageShop();
    const before = game.inventory.slice();
    initRng(28101n);
    await shopDig(1);
    assert.deepEqual(game.inventory, before);
    assert.equal(shopkeeper0().mx, 12);
});

void test('the keeper repairs a wall gap after the repair delay', async () => {
    const { shopkeeper } = await damageShop();
    addShopDamage(8, 10, SHOP_WALL_COST);
    // The dig opened the wall into a doorway.
    requireGameLevel(game).requireAt(8, 10).typ = DOOR;
    requireGameLevel(game).requireAt(8, 10).doormask = D_NODOOR;
    game.moves += 5;

    const disposition = await shopkeeperRepairsDamage(shopkeeper);
    assert.equal(disposition, 2);
    assert.equal(requireGameLevel(game).requireAt(8, 10).typ, HWALL);
    assert.equal((requireGameLevel(game).damagelist ?? []).length, 0);
    assert.equal(game._lastPlineMessage,
        'Suddenly, a section of the wall closes up!');
});

void test('repair is postponed within the repair delay', async () => {
    const { shopkeeper } = await damageShop();
    addShopDamage(8, 10, SHOP_WALL_COST);
    requireGameLevel(game).requireAt(8, 10).typ = DOOR;
    requireGameLevel(game).requireAt(8, 10).doormask = D_NODOOR;
    game.moves += 4;

    const damage = requireGameLevel(game).damagelist?.[0];
    assert.ok(damage);
    const disposition = await repairShopDamage(shopkeeper, damage);
    assert.equal(disposition, 0);
    assert.equal(requireGameLevel(game).requireAt(8, 10).typ, DOOR);
    assert.equal((requireGameLevel(game).damagelist ?? []).length, 1);
});

void test('wall repair scatters litter into the shop and merges boulders', async () => {
    const { shopkeeper, roomno } = await damageShop();
    addShopDamage(8, 10, SHOP_WALL_COST);
    requireGameLevel(game).requireAt(8, 10).typ = DOOR;
    requireGameLevel(game).requireAt(8, 10).doormask = D_NODOOR;
    const junk = await floorObject(POT_FRUIT_JUICE, 8, 10);
    junk.unpaid = true; // billed state is a fixture concern, not creation
    shopkeeper.eshk.bill = [{
        bo_id: junk.o_id, bquan: 1, useup: false, price: 50,
    }];
    shopkeeper.eshk.billct = 1;
    const rock = await floorObject(BOULDER, 8, 10);
    game.moves += 5;

    initRng(5n);
    await shopkeeperRepairsDamage(shopkeeper);

    assert.equal(requireGameLevel(game).requireAt(8, 10).typ, HWALL);
    // The unpaid item was pulled into the shop and off the bill.
    assert.equal(junk.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    const pile = floorObjectsAt(requireGameLevel(game), 8, 10);
    assert.ok(!pile.includes(junk));
    assert.ok(!pile.includes(rock));
    assert.ok((junk.ox !== 8 || junk.oy !== 10));
    const spot = requireGameLevel(game).requireAt(junk.ox, junk.oy);
    assert.equal(spot.roomno, roomno);
});

void test('repairing a mined floor converts the trap into pocketed goods', async () => {
    const { shopkeeper, roomno } = await damageShop();
    requireGameLevel(game).requireAt(10, 11).roomno = roomno;
    addTrap(requireGameLevel(game), 6, 10, 11, { tseen: 1 });
    requireGameLevel(game).damagelist = [{
        when: game.moves - 5, place: { x: 10, y: 11 },
        cost: 0, typ: ROOM, flags: 0,
    }];

    const disposition = await shopkeeperRepairsDamage(shopkeeper);
    assert.equal(disposition, 3);
    assert.equal(requireGameLevel(game).traps.length, 0);
    const carried = shopkeeper.minvent || shopkeeper.inventory || [];
    assert.ok(carried.some(object => object.otyp === LAND_MINE));
    assert.equal(game._lastPlineMessage, 'The land mine vanishes.');
});

void test('an angry settlement moves open bills into robbery', async () => {
    const { shopkeeper } = await damageShop();
    const carried = await addInventoryObject(POT_FRUIT_JUICE);
    carried.unpaid = true;
    shopkeeper.eshk.bill = [{
        bo_id: carried.o_id, bquan: 2, useup: false, price: 100,
    }];
    shopkeeper.eshk.billct = 1;
    shopkeeper.eshk.debit = 50;
    shopkeeper.eshk.credit = 20;

    await makeAngryShopkeeper(shopkeeper);

    assert.equal(shopkeeper.eshk.robbed, 230);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(carried.unpaid, false);
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.eshk.following, 1);
    assert.match(game._lastPlineMessage, /gets angry!|is furious!/);
});

void test('the aggravation surcharge raises and lowers bill prices', async () => {
    const { shopkeeper } = await damageShop();
    shopkeeper.eshk.bill = [
        { bo_id: 1, bquan: 1, useup: false, price: 9 },
    ];
    rileShopkeeper(shopkeeper);
    assert.ok(shopkeeper.eshk.bill[0]);
    assert.equal(shopkeeper.eshk.bill[0].price, 12);
    assert.equal(shopkeeper.mpeaceful, 0);
    pacifyShopkeeper(shopkeeper, true);
    assert.equal(shopkeeper.eshk.bill[0].price, 9);
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(shopkeeper.eshk.surcharge, false);
});

void test('settlement clears an unpaid floor shipment', async () => {
    const { shopkeeper } = await damageShop();
    const crate = await floorObject(POT_FRUIT_JUICE, 10, 10);
    crate.unpaid = true; // billed state is a fixture concern, not creation
    shopkeeper.eshk.bill = [{
        bo_id: crate.o_id, bquan: 1, useup: false, price: 40,
    }];
    setPaidShopkeeper(shopkeeper);
    assert.equal(crate.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
});

function shopkeeper0() {
    const room = requireGameLevel(game).rooms.at(-1);
    assert.ok(room && isRoom(room));
    const keeper = room.resident;
    requireShopkeeper(keeper);
    return keeper;
}

function requireShopkeeper(keeper: Monster | null | undefined): asserts keeper is Monster & { eshk: ShopkeeperData } {
    assert.ok(keeper?.eshk, 'The staffed shop needs its shopkeeper');
}

void test('repairing a picked lock interrupts the door occupation', async () => {
    const { shopkeeper } = await damageShop();
    // The gap was re-doored and closed; the record still wants the wall.
    const doorSquare = requireGameLevel(game).requireAt(9, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_LOCKED;
    requireGameLevel(game).damagelist = [{
        when: game.moves - 5, place: { x: 9, y: 10 },
        cost: 0, typ: HWALL, flags: 0,
    }];
    game._occupation = {
        key: 'pick-lock',
        text: 'picking the lock',
        remaining: 51,
        usedtime: 0,
        door: requireGameLevel(game).requireAt(9, 10),
        x: 9,
        y: 10,
        tool: await addInventoryObject(LOCK_PICK),
        chance: 9,
    };

    const disposition = await shopkeeperRepairsDamage(shopkeeper);
    assert.equal(disposition, 2);
    assert.equal(requireGameLevel(game).requireAt(9, 10).typ, HWALL);
    assert.equal(game._occupation, null);
    assert.equal(game._lastPlineMessage, 'You stop picking the lock.');
});

void test('a female hero is addressed as a minx when asked to pay', async () => {
    await damageShop();
    game.flags.female = true;
    setHeroGoldAmount(game, 500);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    initRng(61n);
    const question = await answerDamageQuestion('y');
    assert.match(question, /^"Minx!  You did 400 zorkmids worth of damage!"  Pay\? \[yn\] \(n\) $/);
});

void test('a neuter polymorphed hero is addressed as a beast', async () => {
    await damageShop();
    setHeroGoldAmount(game, 500);
    game.u.mtimedone = 1;
    game.u.umonnum = 6;  // acid blob: M2_NEUTER
    addShopDamage(9, 10, SHOP_DOOR_COST);
    initRng(61n);
    const question = await answerDamageQuestion('y');
    assert.match(question, /^"Beast!  You did 400 zorkmids worth of damage!"  Pay\? \[yn\] \(n\) $/);
});

// Supply the payment answer only after its actual input boundary. In
// particular, a pending arrival message must not consume the y/n response.
async function answerDamageQuestion(answer: 'y' | 'n'): Promise<string> {
    let question: string | null = null;
    const acknowledgments = new Set<string>();
    const gate = new InputGate({
        beforeRead: () => {
            const display = game.nhDisplay;
            assert.ok(display, 'Shop damage needs a display');
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--')) {
                const message = game._lastPlineMessage;
                assert.ok(message, 'The pager must display a shop message');
                assert.match(message, /leaps towards you!|accepts your restitution\./);
                assert.ok(!acknowledgments.has(message), `Repeated shop pager: ${message}`);
                acknowledgments.add(message);
                gate.feed(' ');
                return;
            }
            assert.equal(question, null, 'The keeper must ask for payment once');
            assert.match(screen, /You did 400 zorkmids worth of damage!.*Pay\?/);
            question = game._lastPlineMessage;
            gate.feed(answer);
        },
    });
    bindInputGate(gate);
    try {
        await payForShopDamage('break');
        assert.ok(question, 'The keeper must ask for payment');
        return question;
    } finally {
        resetInputState();
    }
}

void test('a crowded doorway resident is displaced to limbo and re-arrives', async () => {
    await damageShop();
    // Leave the shop before filling its walkable squares with residents.
    game.u.ux = 5;
    game.u.uy = 5;
    await checkSpecialRoom();
    // The keeper's home square becomes a pool, so the square it vacates is
    // unusable for the displaced kobold; with every other walkable square
    // filled, the resident truly has nowhere to go.
    requireGameLevel(game).requireAt(12, 10).typ = POOL;
    const fillers: Monster[] = [];
    for (let x = 9; x <= 13; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x === 12 && y === 10) continue;  // keeper
            if (x === 9 && y === 10) continue;  // door: blocker below
            fillers.push(await createMonsterAt('kobold', x, y));
        }
    }
    const blocker = await createMonsterAt('kobold', 9, 10);
    setHeroGoldAmount(game, 500);
    addShopDamage(9, 10, SHOP_DOOR_COST);
    initRng(7n);
    await payForShopDamage('break');

    const keeper = shopkeeper0();
    // The keeper took the exact vacated doorway square.
    assert.equal(keeper.mx, 9);
    assert.equal(keeper.my, 10);
    // The displaced resident left the level for limbo.
    assert.ok(!requireGameLevel(game).monsters.includes(blocker));
    assert.equal(blocker.mx, 0);
    assert.ok((game._migratingMonsters || []).includes(blocker));
    assert.ok((blocker.mstate ?? 0) & MON_LIMBO);
    assert.equal(keeper.mpeaceful, 0);

    // Once the level has room again, the migration owner delivers it back.
    requireGameLevel(game).monsters = requireGameLevel(game).monsters.filter(
        monster => monster !== fillers[0]);
    const delivered = await deliverMigratingMonsters(game);
    assert.ok(delivered >= 1);
    assert.ok(requireGameLevel(game).monsters.includes(blocker));
    assert.ok(blocker.mx > 0);
    assert.ok(!game._migratingMonsters?.includes(blocker));
});

void test('a deaf damage complaint uses the possessive of the keeper current form', async () => {
    const { shopkeeper } = await damageShop();
    shopkeeper.mnum = MONSTER_NAME.indexOf('red naga');
    shopkeeper.female = true;
    game.u.deafTurns = 10;
    game.deaf = true;
    addShopDamage(9, 10, SHOP_DOOR_COST);

    await payForShopDamage('break', { cantMollify: true });

    assert.match(game._lastPlineMessage, /that you decided to break its door!/);
    assert.equal(shopkeeper.eshk.following, 1);
});

void test('sensing a nearby keeper does not reveal its trap repair to a blind hero', async () => {
    const { shopkeeper, roomno } = await damageShop();
    game.blind = true;
    game.u.telepathy = true;
    vision_recalc(0);
    assert.equal(canSpotMonster(shopkeeper), true);
    requireGameLevel(game).requireAt(12, 11).roomno = roomno;
    addTrap(requireGameLevel(game), 6, 12, 11, { tseen: 1 });
    requireGameLevel(game).damagelist = [{
        when: game.moves - 5, place: { x: 12, y: 11 },
        cost: 0, typ: ROOM, flags: 0,
    }];
    const lastMessage = game._lastPlineMessage;

    const damage = requireGameLevel(game).damagelist?.[0];
    assert.ok(damage);
    const disposition = await repairShopDamage(shopkeeper, damage);

    assert.equal(disposition, 3);
    assert.equal(requireGameLevel(game).traps.length, 0);
    assert.ok(shopkeeper.minvent?.some(object => object.otyp === LAND_MINE));
    assert.equal(game._lastPlineMessage, lastMessage);
});

void test('telepathy does not reveal an unheard shop repair incantation', async () => {
    const { shopkeeper, roomno } = await damageShop();
    game.u.blindTurns = 10;
    game.blind = true;
    game.u.deafTurns = 10;
    game.deaf = true;
    game.u.telepathy = true;
    vision_recalc(0);
    const level = requireGameLevel(game);
    level.requireAt(12, 11).roomno = roomno;
    addTrap(level, 6, 12, 11, { tseen: 1 });
    level.damagelist = [{ when: game.moves - 5, place: { x: 12, y: 11 },
        cost: 0, typ: ROOM, flags: 0 }];
    const before = game._lastPlineMessage;

    await shopkeeperRepairsDamage(shopkeeper);

    assert.equal(game._lastPlineMessage, before);
    assert.ok(!level.traps.some(trap => trap.tx === 12 && trap.ty === 11));
    assert.equal(level.damagelist.length, 0);
});

void test('a damage complaint uses the hero current deafness before a status refresh', async () => {
    const { shopkeeper } = await damageShop();
    game.u.deafTurns = 10;
    game.deaf = false;
    addShopDamage(9, 10, SHOP_DOOR_COST);

    await payForShopDamage('break', { cantMollify: true });

    assert.match(game._lastPlineMessage, /that you decided to break .* door!/);
    assert.equal(shopkeeper.eshk.following, 1);
});
