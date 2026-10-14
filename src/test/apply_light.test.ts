import { installPagerInput } from './support/pager-input.js';
import { inventoryLetter } from './support/commands.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import type { GameObject } from '../js/object_types.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { addTrap } from './support/level-state.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { runExtendedCommand } from './support/commands.js';
import { lightCocktail, useCandle, useCandelabrum, useLamp } from '../js/apply_light.js';
import { beginObjectBurn, endObjectBurn, objectLightRadius } from '../js/light.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { flush_screen } from '../js/display.js';
import { objectQuantity, splitObjectStack } from '../js/object_stack.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { runDueTimers } from '../js/timer_effects.js';
import { objectWeight } from '../js/weight.js';
import { billForObject } from '../js/shk.js';
import { createMonsterAt } from './support/monsters.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { NO_MINVENT } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { holdAnotherObject } from '../js/hero_hold_object.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { VIBRATING_SQUARE } from '../js/const.js';
import {
    CANDELABRUM_OF_INVOCATION,
    DART,
    FOOD_RATION,
    MAGIC_LAMP,
    OIL_LAMP,
    OBJECT_COST,
    POT_OIL,
    ROCK,
    CORPSE,
    LOADSTONE,
    TALLOW_CANDLE,
    WAX_CANDLE,
} from '../js/object_data.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import {
    addInventoryObject,
    artifactObject,
    floorObject,
    knownObject,
} from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { mksobj } from '../js/mklev.js';
import { addInventoryItem } from '../js/u_init.js';

function screen() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
}
function freshLight({ dark = false, ...options }: ObjectRoomOptions & { dark?: boolean } = {}) {
    const level = freshObjectRoom({ left: 2, right: 30, ...options });
    requirePlayingGame(game);
    if (dark) {
        for (let x = 2; x <= 30; x++)
            for (let y = 6; y <= 14; y++) {
                level.requireAt(x, y).lit = false;
                level.requireAt(x, y).waslit = false;
            }
        vision_reset();
        vision_recalc(0);
    }
    const input = resetInputState();
    installPagerInput(input, {
        expected:
            /You use them, you bought them|Yendorian Fuel Tax|enough elbow-room|candle|Candle|lamp|Lamp|lantern|Lantern|candelabrum|Candelabrum|light|Light|flame|Flame|burn|Burn|oil|Oil|You bought|You owe|Thank you|You drop the food/,
        limit: 24,
    });
    const pager = input.display;
    assert.ok(pager);
    let attachments = 0;
    input.display = {
        async readKey() {
            if (
                !screen().includes('--More--') &&
                /Attach .*candelabrum/i.test(game._pending_message)
            ) {
                assert.ok(
                    ++attachments <= 1,
                    'a light action must ask to attach candles at most once',
                );
                return 'y'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };
    return input;
}
async function billed(object: GameObject, quantity = objectQuantity(object)) {
    const price = OBJECT_COST[object.otyp];
    assert.ok(price !== undefined);
    const { shopkeeper } = await createStaffedShop({
        keeperX: 14,
        bill: [
            {
                bo_id: object.o_id,
                bquan: quantity,
                price,
                useup: false,
            },
        ],
    });
    object.unpaid = true;
    return shopkeeper;
}

for (const initialize of [false, true]) {
    void test(`a newly created oil potion burns for 400 turns with initialization ${initialize}`, async () => {
        freshLight({ moves: 10 });
        const oil = await addInventoryItem(await mksobj(POT_OIL, initialize, false));
        await lightCocktail(oil);

        game.moves = 409;
        await runDueTimers();

        assert.equal(oil.lamplit, true);
        assert.ok(game.inventory.includes(oil));

        game.moves = 410;
        await runDueTimers();

        assert.equal(oil.where, 'gone');
        assert.equal(game.inventory.includes(oil), false);
    });
}

for (const type of [TALLOW_CANDLE, WAX_CANDLE]) {
    void test(`an applied ${type === TALLOW_CANDLE ? 'tallow' : 'wax'} candle stack lights and restores remaining fuel when snuffed`, async () => {
        freshLight();
        requirePlayingGame(game);
        const candles = await addInventoryObject(type, { quantity: 4, age: 200 });
        assert.equal((await useCandle(candles)).spentTime, true);
        assert.equal(candles.lamplit, true);
        assert.equal(objectLightRadius(candles), 3);
        game.moves += 10;

        await useCandle(candles);

        assert.equal(candles.lamplit, false);
        assert.equal(candles.age, 190);
        assert.equal(candles.timed, 0);
    });
}

void test('attaching part of a lit stack transfers its actual fuel and reduces the remaining light radius', async () => {
    freshLight({ dark: true });
    requirePlayingGame(game);
    const candles = await addInventoryObject(WAX_CANDLE, { quantity: 9, age: 200 });
    assert.ok(candles);
    beginObjectBurn(candles);
    vision_recalc(0);
    assert.equal(cansee(14, 10), true);
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 0, age: 0 });
    game.moves += 10;

    const applied = await useCandle(candles);
    vision_recalc(0);

    assert.equal(applied.object, candles);
    assert.equal(objectQuantity(candles), 2);
    assert.equal(candles.lamplit, true);
    assert.equal(objectLightRadius(candles), 2);
    assert.equal(cansee(14, 10), false);
    assert.equal(holder.spe, 7);
    assert.equal(holder.age, 190);
    assert.equal(!!holder.lamplit, false);
    assert.equal(holder.owt, objectWeight(holder));
    assert.equal(game.inventory.length, 2);
});

void test('adding an unlit candle to a lit candelabrum expands its light without restarting its fuel', async () => {
    freshLight();
    requirePlayingGame(game);
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 3, age: 200 });
    beginObjectBurn(holder);
    const candles = await addInventoryObject(TALLOW_CANDLE, { quantity: 1, age: 200 });
    const age = holder.age;

    const applied = await useCandle(candles);

    assert.equal(applied.object, null);
    assert.equal(holder.spe, 4);
    assert.equal(holder.age, age);
    assert.equal(objectLightRadius(holder), 3);
    assert.equal(game.inventory.includes(candles), false);
});

void test('fresh unpaid candles become a used-up bill on first ignition only', async () => {
    freshLight();
    requirePlayingGame(game);
    const candles = await addInventoryObject(TALLOW_CANDLE, {
        quantity: 2,
        age: 20 * candleCost(),
    });
    const keeper = await billed(candles);

    await useLamp(candles);

    assert.equal(candles.unpaid, false);
    assert.equal(keeper.eshk.bill.length, 1);
    assert.equal(keeper.eshk.bill[0]?.useup, true);
    assert.equal(keeper.eshk.bill[0]?.bquan, 2);
    await useLamp(candles);
    await useLamp(candles);
    assert.equal(keeper.eshk.bill.length, 1);
});

void test('attaching billed candles consumes only the attached quantity on their shop bill', async () => {
    freshLight();
    requirePlayingGame(game);
    const candles = await addInventoryObject(TALLOW_CANDLE, { quantity: 4, age: 200 });
    const keeper = await billed(candles);
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 5, age: 200 });

    await useCandle(candles);

    assert.equal(holder.spe, 7);
    assert.equal(objectQuantity(candles), 2);
    const bill = billForObject(candles);
    assert.ok(bill);
    assert.equal(bill.entry.bquan, 2);
    const consumed = keeper.eshk.bill.find((entry) => entry.useup);
    assert.ok(consumed);
    assert.equal(consumed.bquan, 2);
});

for (const onStairs of [false, true]) {
    void test(`seven candles at the invocation position ${onStairs ? 'on stairs consume fuel rapidly' : 'keep their full fuel'}`, async () => {
        freshLight();
        requirePlayingGame(game);
        game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
        game.dungeons = [
            createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 }),
            createDungeon({ dname: 'Gehennom', num_dunlevs: 5, flags: { hellish: true } }),
        ];
        game.u.uz = { dnum: 1, dlevel: 4 };
        addTrap(requireGameLevel(), VIBRATING_SQUARE, 10, 10);
        if (onStairs)
            game.stairs = {
                sx: 10,
                sy: 10,
                up: false,
                isladder: false,
                tolev: { dnum: 1, dlevel: 5 },
                u_traversed: false,
                next: null,
            };
        const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, {
            spe: 7,
            age: 151,
            known: false,
        });

        await useCandelabrum(holder);
        await useCandelabrum(holder);

        assert.equal(holder.age, onStairs ? 76 : 151);
        assert.equal(holder.known, !onStairs);
    });
}

void test('an empty candelabrum gives the attachment tip when candles are carried', async () => {
    freshLight();
    requirePlayingGame(game);
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 0 });
    await addInventoryObject(WAX_CANDLE);

    await useCandelabrum(holder);
    await flush_screen(1);

    assert.match(screen(), /To attach candles, apply them instead/);
    assert.equal(!!holder.lamplit, false);
});

void test('candelabrum ignition pauses before consuming fuel and resumes its source operation', async () => {
    const input = freshLight();
    requirePlayingGame(game);
    input.beforeRead = null;
    input.display = null;
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 7, age: 151 });
    const lighting = useCandelabrum(holder);
    await input.waitUntilBlocked();
    try {
        assert.equal(!!holder.lamplit, false);
        assert.equal(holder.age, 151);
    } finally {
        installPagerInput(input, {
            expected:
                /You use them, you bought them|Yendorian Fuel Tax|enough elbow-room|candle|Candle|lamp|Lamp|lantern|Lantern|candelabrum|Candelabrum|light|Light|flame|Flame|burn|Burn|oil|Oil|You bought|You owe|Thank you|You drop the food/,
            limit: 24,
        });
        input.feed(' ');
        await lighting;
    }
    assert.equal(holder.lamplit, true);
    endObjectBurn(holder);
    assert.equal(holder.age, 76);
});

void test('lighting a potion stack splits one identity; snuffing it rejoins and averages the fuel', async () => {
    freshLight();
    requirePlayingGame(game);
    const stack = await addInventoryObject(POT_OIL, { quantity: 3, age: 200 });

    const lit = await lightCocktail(stack);
    assert.ok(lit.object);
    assert.notEqual(lit.object, stack);
    assert.equal(objectQuantity(stack), 2);
    assert.equal(objectQuantity(lit.object), 1);
    assert.equal(lit.object.lamplit, true);
    game.moves += 5;
    const snuffed = await lightCocktail(lit.object);

    assert.equal(snuffed.object, stack);
    assert.equal(game.inventory.length, 1);
    assert.equal(objectQuantity(stack), 3);
    assert.equal(stack.age, 198);
});

for (const [slot, install] of [
    ['weapon', setPrimaryWeapon],
    ['alternate weapon', setSecondaryWeapon],
    ['quiver', setQuiverObject],
] as const) {
    void test(`snuffing oil in the ${slot} preserves its identity and equipment slot`, async () => {
        freshLight();
        requirePlayingGame(game);
        const stack = await addInventoryObject(POT_OIL, { quantity: 3, age: 200 });
        const oil = splitObjectStack(stack, 1);
        assert.ok(oil);
        await install(oil);
        const mask = oil.owornmask;
        await lightCocktail(oil);

        const snuffed = await lightCocktail(oil);

        assert.equal(snuffed.object, oil);
        assert.equal(oil.owornmask, mask);
        assert.equal(game.inventory.length, 2);
    });
}

void test('lighting billed oil charges fuel tax and retains the full used-up bill', async () => {
    freshLight();
    requirePlayingGame(game);
    const oil = await addInventoryObject(POT_OIL, { age: 200 });
    const keeper = await billed(oil);

    await lightCocktail(oil);

    assert.ok(keeper.eshk.debit > 0);
    assert.equal(keeper.eshk.bill.length, 1);
    assert.equal(keeper.eshk.bill[0]?.useup, true);
    assert.equal(oil.unpaid, false);
});

void test('a split lit potion falls to the actual floor when the inventory has no slot', async () => {
    freshLight();
    requirePlayingGame(game);
    for (let index = 0; index < 51; index++)
        await addInventoryObject(ROCK, { oextra: { oname: `stone ${index}` } });
    const stack = await addInventoryObject(POT_OIL, { quantity: 2, age: 200 });

    const lit = await lightCocktail(stack);

    assert.equal(lit.object, null);
    assert.equal(game.inventory.length, 52);
    assert.equal(objectQuantity(stack), 1);
    const oil = floorObjectsAt(requireGameLevel(), 10, 10).find((item) => item.otyp === POT_OIL);
    assert.ok(oil);
    assert.equal(oil.lamplit, true);
    assert.equal(oil.where, 'floor');
});

void test('underwater ignition fails but an already lit candle can still be snuffed', async () => {
    freshLight();
    requirePlayingGame(game);
    const candle = await addInventoryObject(TALLOW_CANDLE, { age: 200 });
    beginObjectBurn(candle);
    game.u.uinwater = true;

    await useLamp(candle);
    assert.equal(candle.lamplit, false);
    await useLamp(candle);
    const oil = await addInventoryObject(POT_OIL, { age: 200 });
    await lightCocktail(oil);
    assert.equal(!!oil.lamplit, false);
    assert.equal(candle.lamplit, false);
});

for (const blind of [false, true]) {
    void test(`a cursed candelabrum refuses ignition ${blind ? 'silently when blind' : 'with flickering feedback'}`, async () => {
        freshLight({ hero: { blindTurns: blind ? 10 : 0 } });
        requirePlayingGame(game);
        const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, {
            spe: 7,
            age: 200,
            cursed: true,
        });

        await useCandelabrum(holder);
        await flush_screen(1);

        assert.equal(!!holder.lamplit, false);
        assert.equal(holder.age, 200);
        if (blind) assert.doesNotMatch(screen(), /flicker/);
        else assert.match(screen(), /flicker for a moment, then die/);
    });
}

for (const [type, expected] of [
    [OIL_LAMP, 'lamp'],
    [MAGIC_LAMP, 'lamp'],
] as const) {
    void test(`the shared ${type === MAGIC_LAMP ? 'magic' : 'oil'} lamp owner preserves its burn behavior`, async () => {
        freshLight();
        requirePlayingGame(game);
        const lamp = await addInventoryObject(type, { spe: 1, age: 200 });
        await useLamp(lamp);
        await flush_screen(1);
        assert.match(screen(), new RegExp(`Your ${expected} is now on`));
        assert.equal(lamp.lamplit, true);
        await useLamp(lamp);
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 200);
    });
}

void test('candle timers announce short fuel and low flames before consuming the stack', async () => {
    freshLight();
    requirePlayingGame(game);
    const candles = await addInventoryObject(WAX_CANDLE, { quantity: 2, age: 76 });
    assert.ok(candles);
    beginObjectBurn(candles);
    game.moves++;
    await runDueTimers();
    await flush_screen(1);
    assert.match(screen(), /Your candles are getting short\./);
    game.moves += 60;
    await runDueTimers();
    await flush_screen(1);
    assert.match(screen(), /Your candles' flames flicker low!/);
    game.moves += 15;
    await runDueTimers();
    await flush_screen(1);
    assert.equal(game.inventory.includes(candles), false);
    assert.match(screen(), /Your wax candles are consumed!/);
    assert.match(screen(), /Their flames die\./);
});

void test('a burning quivered potion remains equipped during its expiry pager and is removed after acknowledgment', async () => {
    const input = freshLight();
    requirePlayingGame(game);
    const oil = await addInventoryObject(POT_OIL, { age: 1 });
    await setQuiverObject(oil);
    await lightCocktail(oil);
    input.beforeRead = null;
    input.display = null;
    game.moves++;
    const expiry = runDueTimers();
    await input.waitUntilBlocked();
    try {
        assert.equal(game.uquiver, oil);
        assert.equal(game.inventory.includes(oil), true);
    } finally {
        installPagerInput(input, {
            expected:
                /You use them, you bought them|Yendorian Fuel Tax|enough elbow-room|candle|Candle|lamp|Lamp|lantern|Lantern|candelabrum|Candelabrum|light|Light|flame|Flame|burn|Burn|oil|Oil|You bought|You owe|Thank you|You drop the food/,
            limit: 24,
        });
        input.feed(' ');
        await expiry;
    }
    assert.equal(game.uquiver, null);
    assert.equal(game.u.uquiver, null);
    assert.equal(game.inventory.includes(oil), false);
    assert.equal(oil.where, 'gone');
});

for (const type of [TALLOW_CANDLE, POT_OIL]) {
    void test(`a blind hero ${type === TALLOW_CANDLE ? 'feels carried candles expire' : 'receives no oil-expiry sight notice'}`, async () => {
        freshLight({ hero: { blindTurns: 10 } });
        requirePlayingGame(game);
        const light = await addInventoryObject(type, { age: 1 });
        beginObjectBurn(light);
        game.moves++;

        await runDueTimers();
        await flush_screen(1);

        assert.equal(game.inventory.includes(light), false);
        if (type === TALLOW_CANDLE) {
            assert.match(screen(), /consumed!/);
            assert.doesNotMatch(screen(), /flame dies/);
        } else assert.doesNotMatch(screen(), /burnt away|go out/);
    });
}

void test('a candelabrum survives candle expiry with empty sockets and its original weight', async () => {
    freshLight();
    requirePlayingGame(game);
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 7, age: 1 });
    beginObjectBurn(holder);
    game.moves++;

    await runDueTimers();

    assert.equal(game.inventory.includes(holder), true);
    assert.equal(holder.spe, 0);
    assert.equal(holder.lamplit, false);
    assert.equal(holder.owt, objectWeight(holder));
});

void test('expiring partially used unpaid candles preserves the used-up bill object', async () => {
    freshLight();
    requirePlayingGame(game);
    const candle = await addInventoryObject(TALLOW_CANDLE, { age: 1 });
    const keeper = await billed(candle);
    await useLamp(candle);
    game.moves++;

    await runDueTimers();

    assert.equal(game.inventory.includes(candle), false);
    assert.equal(candle.where, 'onbill');
    assert.equal(keeper.eshk.bill[0]?.useup, true);
    assert.equal(keeper.eshk.bill[0]?.bo_id, candle.o_id);
});

void test('an overdue floor candle expires silently and reveals a monster which was hiding beneath it', async () => {
    freshLight();
    requirePlayingGame(game);
    const candles = await floorObject(WAX_CANDLE, 14, 10, { age: 1 });
    const spider = await createMonsterAt('cave spider', 14, 10, NO_MINVENT);
    spider.mundetected = 1;
    assert.ok(candles);
    beginObjectBurn(candles);
    game.moves += 10;

    await runDueTimers();
    await flush_screen(1);

    assert.equal(floorObjectsAt(requireGameLevel(), 14, 10).includes(candles), false);
    assert.equal(spider.mundetected, 0);
    assert.doesNotMatch(screen(), /consumed|flame|getting short/);
});

void test('monster-carried candles retain their carrier in visible burn warnings', async () => {
    freshLight();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    const candles = await addObjectToMonsterInventory(
        soldier,
        await knownObject(WAX_CANDLE, { age: 76 }),
    );
    assert.ok(candles);
    beginObjectBurn(candles);
    game.moves++;

    await runDueTimers();
    await flush_screen(1);

    assert.match(screen(), /soldier's candle is getting short/);
    assert.equal(soldier.minvent.includes(candles), true);
});

void test('overweight acquisition undoes a merge before dropping only the newly acquired stack', async () => {
    freshLight();
    requirePlayingGame(game);
    const carried = await addInventoryObject(FOOD_RATION, { quantity: 5 });
    const added = await knownObject(FOOD_RATION, { quantity: 200, where: 'free' });

    const held = await holdAnotherObject(added, { dropMessage: 'You drop the food!' });

    assert.equal(held.object, null);
    assert.equal(held.heroDied, false);
    assert.equal(objectQuantity(carried), 5);
    assert.equal(
        floorObjectsAt(requireGameLevel(), 10, 10).find((item) => item.otyp === FOOD_RATION)?.quan,
        200,
    );
});

void test('automatic quivering applies to held missiles but fumbling drops them instead', async () => {
    for (const fumbling of [false, true]) {
        freshLight({ flags: { autoquiver: true } });
        requirePlayingGame(game);
        if (fumbling) grantIntrinsicProperty('fumbling', 'outside');
        const dart = await knownObject(DART, { where: 'free' });

        const held = await holdAnotherObject(dart, { dropMessage: 'You drop the dart!' });

        assert.equal(held.object, fumbling ? null : dart);
        assert.equal(game.uquiver || null, fumbling ? null : dart);
        if (fumbling) assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(dart), true);
    }
});

void test('a wished-for unsafe corpse is dropped rather than held bare-handed', async () => {
    freshLight();
    requirePlayingGame(game);
    const corpse = await knownObject(CORPSE, {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        wishedfor: true,
        where: 'free',
    });

    const held = await holdAnotherObject(corpse, { dropMessage: 'You drop the corpse!' });

    assert.equal(held.object, null);
    assert.equal(held.heroDied, false);
    assert.equal(corpse.wishedfor, false);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(corpse), true);
});

void test('a cursed loadstone bypasses the holding burden limit', async () => {
    freshLight();
    requirePlayingGame(game);
    const stone = await knownObject(LOADSTONE, { quantity: 100, cursed: true, where: 'free' });

    const held = await holdAnotherObject(stone);

    assert.equal(held.object, stone);
    assert.equal(game.inventory.includes(stone), true);
});

void test('#apply attaches exactly the available sockets and spends time while retaining surplus candles', async () => {
    freshLight();
    requirePlayingGame(game);
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 5, age: 200 });
    const candles = await addInventoryObject(TALLOW_CANDLE, { quantity: 4, age: 200 });

    await runExtendedCommand('apply', `${candles.invlet}y`);

    assert.equal(holder.spe, 7);
    assert.equal(objectQuantity(candles), 2);
    assert.equal(game.inventory.includes(candles), true);
    assert.equal(game.context.move, 1);
});

void test('#apply lights one oil identity and a later #apply snuffs and merges it', async () => {
    freshLight();
    requirePlayingGame(game);
    const stack = await addInventoryObject(POT_OIL, { quantity: 3, age: 200 });

    await runExtendedCommand('apply', inventoryLetter(stack));

    const lit = game.inventory.find((object) => object.lamplit);
    assert.ok(lit);
    assert.notEqual(lit, stack);
    assert.equal(objectQuantity(lit), 1);
    assert.equal(objectQuantity(stack), 2);
    assert.equal(game.context.move, 1);
    await runExtendedCommand('apply', inventoryLetter(lit));
    assert.equal(game.inventory.length, 1);
    assert.equal(objectQuantity(stack), 3);
    assert.equal(!!stack.lamplit, false);
    assert.equal(game.context.move, 1);
});

void test('swallowing prevents candle handling and oil ignition while occupied candelabrum candles only flicker', async () => {
    freshLight();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 12, 10, NO_MINVENT);
    const candles = await addInventoryObject(WAX_CANDLE, { age: 200 });
    assert.ok(candles);
    beginObjectBurn(candles);
    const oil = await addInventoryObject(POT_OIL, { quantity: 3, age: 200 });
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 7, age: 200 });
    game.u.uswallow = true;
    game.u.ustuck = worm;

    await useCandle(candles);
    await lightCocktail(oil);
    await useCandelabrum(holder);

    assert.equal(
        candles.lamplit,
        true,
        'the swallowed hero cannot handle even already-lit candles',
    );
    assert.equal(!!oil.lamplit, false);
    assert.equal(objectQuantity(oil), 3);
    assert.equal(!!holder.lamplit, false);
    assert.equal(holder.age, 200);
});

void test('holding a rejecting artifact uses its real blast and leaves it on the floor', async () => {
    freshLight({ hero: { uhp: 200, uhpmax: 200, ualign: { type: -1, record: 0 } } });
    requirePlayingGame(game);
    const sword = await artifactObject('Excalibur', { where: 'free' });
    installPagerInput(resetInputState(), {
        expected: /You are blasted by the long sword named Excalibur's power!|The long sword named Excalibur evades your grasp!/,
        limit: 2,
    });

    const held = await holdAnotherObject(sword, { dropMessage: 'You drop the sword!' });

    assert.equal(held.heroDied, false);
    assert.equal(held.object, sword);
    assert.equal(game.inventory.includes(sword), false);
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(sword), true);
    assert.ok(
        game.u.uhp < 200,
        'Excalibur should blast the non-lawful hero before rejecting the grasp',
    );
});

function candleCost(): number {
    const cost = OBJECT_COST[TALLOW_CANDLE];
    assert.ok(cost !== undefined);
    return cost;
}
