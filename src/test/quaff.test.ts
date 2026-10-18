import type { InventoryObjectOverrides } from './support/game-objects.js';
import type { GameObject } from '../js/object_types.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { A_WIS, FOUNTAIN, M_AP_FURNITURE, NO_MINVENT, SINK, W_WEP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { canSeeMonster } from '../js/display.js';
import { heroIsInvisible } from '../js/hero_invisibility.js';
import { grantHeroSeeInvisible } from '../js/hero_seeing.js';
import { woundHeroLegs } from '../js/hero_legs.js';
import { resetInputState } from '../js/input.js';
import { objectWeight } from '../js/weight.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import {
    POT_FRUIT_JUICE, POT_HEALING, POT_INVISIBILITY,
    POT_MONSTER_DETECTION, POT_OIL,
    POT_RESTORE_ABILITY, POT_SEE_INVISIBLE, POT_SPEED, RIN_INVISIBILITY,
} from '../js/object_data.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { drinkPotion, quaff } from '../js/quaff.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { addShopObjectToBill, billForObject } from '../js/shk.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';

async function potion(type: number, overrides: InventoryObjectOverrides = {}) {
    const object = await addInventoryObject(type, { initialize: false, ...overrides });
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[type] = 'amber'; // An ordinary closed bottle, no occupant appearance.
    return object;
}
async function drink(object: GameObject, answers = '') {
    resetInputState().feed(object.invlet + answers);
    await rhack('q'.charCodeAt(0));
}

async function restoreWithInput(object: GameObject) {
    const input = resetInputState();
    assert.ok(object.invlet);
    input.feed(object.invlet);
    const action = rhack('q'.charCodeAt(0));
    for (;;) {
        const blocked = await Promise.race([action.then(() => false), input.waitUntilBlocked().then(() => true)]);
        if (!blocked) return;
        const message = game._pending_message;
        if (message.startsWith('Call ')) input.feed('restoration\n');
        else {
            assert.match(message, /Wow!|experienced|Welcome/);
            input.feed(' '); // Native level-gain prose exceeds the pending topline.
        }
    }
}

void test('quaffing an ordinary oil bottle replaces the selector with its native taste and spends a turn', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    const oil = await potion(POT_OIL, { invlet: 'h', quan: 2 });
    recordObjectKnowledge(oil.otyp);
    await drink(oil);
    assert.equal(game._pending_message, 'That was smooth!');
    assert.equal(game.context.move, 1);
    assert.equal(oil.quan, 1);
    assert.equal(oil.in_use, false);
    assert.ok(game.u._exercise);
    assert.ok(game.u._exercise[A_WIS] <= 0);
});

void test('an observable potion effect identifies a seen global type even when its inventory view has a name', async () => {
    freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const healing = await potion(POT_HEALING, { typeKnown: false });
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(healing.otyp), false);
    await drink(healing);
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(healing.otyp), true);
    assert.equal(game.u.urexp, 10);
    assert.ok(game.u.uhp > 1);
    assert.equal(game.inventory.includes(healing), false);
});

void test('unknown fruit juice remains owned until the actual calling prompt resumes', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const juice = await potion(POT_FRUIT_JUICE, { typeKnown: false });
    const input = resetInputState();
    assert.ok(juice.invlet);
    input.feed(juice.invlet);
    const action = rhack('q'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game.inventory.includes(juice), true);
    assert.equal(juice.in_use, true);
    assert.equal(game._pending_message, 'This tastes like slime mold juice.');
    assert.equal(game._objectCallNames?.[juice.otyp], undefined);
    input.feed(' '); // getlin acknowledges the taste before asking for a name.
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /Call an amber potion:/);
    input.feed('refreshment\n');
    await action;
    assert.ok(game._objectCallNames != null);
    assert.equal(game._objectCallNames[juice.otyp], 'refreshment');
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(juice.otyp), false);
    assert.equal(game.inventory.includes(juice), false);
    assert.equal(game.u.uhunger, 920);
});

void test('an unseen effect grants healing but does not identify or call the potion', async () => {
    freshObjectRoom({ hero: { blindTurns: 5, uhp: 1 } });
    requirePlayingGame(game);
    const healing = await potion(POT_HEALING, {
        cursed: true, dknown: false, observed: false, typeKnown: false,
    });
    await drink(healing);
    assert.ok(game.u.uhp > 1);
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(healing.otyp), false);
    assert.equal(game.u.urexp || 0, 0);
});

void test('empty detection consumes and offers a call without crediting formal identification', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const detection = await potion(POT_MONSTER_DETECTION, { typeKnown: false });
    await drink(detection, ' empty\n');
    assert.ok(game._objectCallNames != null);
    assert.equal(game._objectCallNames[detection.otyp], 'empty');
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(detection.otyp), false);
    assert.equal(game.inventory.includes(detection), false);
    assert.equal(game.context.move, 1);
});

void test('blessed empty monster detection persists and remains ambiguous', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const detection = await potion(POT_MONSTER_DETECTION, { blessed: true, typeKnown: false });
    await drink(detection, ' loneliness\n');
    assert.ok((game.u.monsterDetectionTurns ?? 0) >= 100 && (game.u.monsterDetectionTurns ?? 0) < 200);
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(detection.otyp), false);
    assert.ok(game._objectCallNames != null);
    assert.equal(game._objectCallNames[detection.otyp], 'loneliness');
});

void test('blessed monster detection identifies the real type when an actual monster is present', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    const detection = await potion(POT_MONSTER_DETECTION, { blessed: true });
    await drink(detection);
    assert.ok(game._knownObjectTypes != null);
    assert.equal(game._knownObjectTypes.has(detection.otyp), true);
    assert.equal(game.inventory.includes(detection), false);
    assert.equal(dog.dead, undefined);
});

void test('a wielded potion stack keeps the undrunk remainder wielded with native stack weight', async () => {
    freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const healing = await potion(POT_HEALING, { quan: 3, owornmask: W_WEP, wielded: true });
    game.uwep = healing;
    await drink(healing);
    assert.equal(game.uwep, healing);
    assert.equal(healing.quan, 2);
    assert.equal(healing.owornmask, W_WEP);
    assert.equal(healing.owt, objectWeight(healing));
    assert.equal(game.inventory.length, 1);
});

void test('drinking the last wielded potion clears the weapon before its effect and removes its identity', async () => {
    freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const healing = await potion(POT_HEALING, { owornmask: W_WEP, wielded: true });
    game.uwep = healing;
    await drink(healing);
    assert.equal(game.uwep, null);
    assert.equal(game.inventory.includes(healing), false);
    assert.equal(healing.where, 'gone');
});

void test('shop quaffing preserves the single bill while quantity is consumed and retains the final used-up stock', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const oil = await potion(POT_OIL, { quan: 2 });
    recordObjectKnowledge(oil.otyp);
    await addShopObjectToBill(oil, game, { ininv: true, silent: true });
    await drink(oil);
    assert.equal(oil.quan, 1);
    const billed = billForObject(oil);
    assert.ok(billed);
    assert.equal(billed.entry.bquan, 2);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    await drink(oil);
    assert.equal(game.inventory.includes(oil), false);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(shopkeeper.eshk.bill[0]?.bquan, 2);
    assert.equal(shopkeeper.eshk.bill[0]?.useup, true);
});

for (const key of ['\x1b', '\n', ' ']) {
    void test(`cancelling quaff selection with ${JSON.stringify(key)} spends no time and preserves stock`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const oil = await potion(POT_OIL);
        resetInputState().feed(key);
        await rhack('q'.charCodeAt(0));
        assert.equal(game.context.move, 0);
        assert.equal(game.inventory.includes(oil), true);
        assert.equal(oil.in_use, undefined);
        assert.equal(game._pending_message, 'Never mind.');
    });
}

void test('strangulation rejects drinking before asking for an inventory letter', async () => {
    freshObjectRoom({ hero: { strangledTurns: 3 } });
    requirePlayingGame(game);
    const oil = await potion(POT_OIL);
    await rhack('q'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    assert.equal(game.inventory.includes(oil), true);
    assert.match(game._pending_message, /can't breathe air/);
});

for (const terrain of [FOUNTAIN, SINK]) {
    void test(`a levitating hero bypasses inaccessible terrain source ${terrain} and selects a potion directly`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = terrain;
        grantIntrinsicProperty('levitation', 'outside');
        const oil = await potion(POT_OIL);
        recordObjectKnowledge(oil.otyp);
        await drink(oil);
        assert.equal(game._pending_message, 'That was smooth!');
        assert.equal(game.context.move, 1);
    });
}

void test('a declined terrain drink uses native nothing-else feedback', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    resetInputState().feed('n');
    await rhack('q'.charCodeAt(0));
    assert.equal(game._pending_message, "You don't have anything else to drink.");
    assert.equal(game.context.move, 0);
});

void test('menu-requested quaff bypasses fountain admission', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    const oil = await potion(POT_OIL);
    recordObjectKnowledge(oil.otyp);
    game.iflags.menu_requested = true;
    assert.ok(oil.invlet);
    resetInputState().feed(oil.invlet);
    const result = await quaff();
    assert.equal(result.spentTime, true);
    assert.equal(game._pending_message, 'That was smooth!');
});

void test('drinking surrounding water spends time without consuming an inventory potion', async () => {
    freshObjectRoom({ hero: { uinwater: true } });
    requirePlayingGame(game);
    const oil = await potion(POT_OIL);
    resetInputState().feed('y');
    await rhack('q'.charCodeAt(0));
    assert.equal(game.context.move, 1);
    assert.equal(game.inventory.includes(oil), true);
    assert.match(game._pending_message, /what lives in this water/);
});

void test('physical restore ability also restores one drained experience level', async () => {
    freshObjectRoom({ hero: { ulevel: 2, ulevelmax: 4, uhp: 40, uenmax: 10, uen: 10 } });
    requirePlayingGame(game);
    const restore = await potion(POT_RESTORE_ABILITY, { typeKnown: false });
    await restoreWithInput(restore);
    assert.equal(game.u.ulevel, 3);
    assert.equal(game.u.ulevelmax, 4);
});

void test('blessed physical restoration recovers all drained experience levels', async () => {
    freshObjectRoom({ hero: { ulevel: 2, ulevelmax: 4, uhp: 40, uenmax: 10, uen: 10 } });
    requirePlayingGame(game);
    const restore = await potion(POT_RESTORE_ABILITY, { blessed: true, typeKnown: false });
    await restoreWithInput(restore);
    assert.equal(game.u.ulevel, 4);
    assert.equal(game.u.ulevelmax, 4);
});

void test('a noncursed speed potion cures unmounted legs instead of granting speed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await woundHeroLegs('left', 30);
    const speed = await potion(POT_SPEED, { typeKnown: false });
    await drink(speed, ' leg tonic\n');
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.u.veryFastTurns || 0, 0);
    assert.equal(propertyIsActive('fast'), false);
});

void test('ordinary speed grants timed acceleration and permanent natural speed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await drink(await potion(POT_SPEED), ' ');
    assert.equal(hasIntrinsicProperty('fast', 'outside'), true);
    assert.ok((game.u.veryFastTurns ?? 0) >= 100 && (game.u.veryFastTurns ?? 0) < 110);
});

void test('cursed speed only grants temporary acceleration', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await drink(await potion(POT_SPEED, { cursed: true }));
    assert.equal(hasIntrinsicProperty('fast', 'outside'), false);
    assert.ok((game.u.veryFastTurns ?? 0) >= 40 && (game.u.veryFastTurns ?? 0) < 50);
});

void test('see-invisible reveals a real invisible monster and times out through the live scheduler', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    dog.minvis = 1;
    const sight = await potion(POT_SEE_INVISIBLE, { typeKnown: false });
    await drink(sight, ' clarity\n');
    assert.equal(canSeeMonster(dog), true);
    assert.ok((game.u.seeInvisibleTurns ?? 0) >= 750 && (game.u.seeInvisibleTurns ?? 0) < 850);
    game.u.seeInvisibleTurns = 1;
    dog.movement = 0;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    input.feed('.');
    await moveloop_core();
    const turn = moveloop_core();
    await input.waitUntilBlocked();
    try {
        assert.equal(game.u.seeInvisibleTurns, 0);
        assert.equal(canSeeMonster(dog), false);
    } finally { input.feed('\x1b'); await turn; }
});

void test('seeing an invisible wall mimic restores its actual light blocking', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    mimic.minvis = 1;
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = 1;
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);
    await grantHeroSeeInvisible({ duration: 50 });
    vision_recalc(0);
    assert.equal(cansee(12, 10), false);
});

void test('cursed invisibility removes only outside permanence while preserving a worn ring', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(RIN_INVISIBILITY);
    await wearHeroAccessory(ring, 'uleft');
    grantIntrinsicProperty('invisible', 'outside');
    const invisible = await potion(POT_INVISIBILITY, { cursed: true, typeKnown: false });
    await drink(invisible, '       \n');
    assert.equal(hasIntrinsicProperty('invisible', 'outside'), false);
    assert.equal(heroIsInvisible(), true);
    assert.equal(game.uleft, ring);
});

void test('effect-only digestion leaves the actual floor bottle for its owning consumption boundary', async () => {
    freshObjectRoom({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const healing = await floorObject(POT_HEALING, game.u.ux, game.u.uy);
    await drinkPotion(healing, { consume: false });
    assert.ok(game.u.uhp > 1);
    assert.equal(healing.where, 'floor');
    assert.equal(floorObjectsAt(requireGameLevel(), healing.ox, healing.oy).includes(healing), true);
    assert.equal(healing.in_use, false);
});

for (const menu of ['?', '*']) {
    void test(`the real ${menu} inventory menu selects and drinks a potion once`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const oil = await potion(POT_OIL);
        recordObjectKnowledge(oil.otyp);
        resetInputState().feed(menu + oil.invlet);
        await rhack('q'.charCodeAt(0));
        assert.equal(game.context.move, 1);
        assert.equal(game.inventory.includes(oil), false);
        assert.equal(game._pending_message, 'That was smooth!');
    });
}

void test('quaffing unlit oil exercises Wisdom through the actual inventory action', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const oil = await potion(POT_OIL, { quan: 12 });
    recordObjectKnowledge(oil.otyp);
    for (let drinkCount = 0; drinkCount < 12; drinkCount++) await drink(oil);
    assert.ok(game.u._exercise);
    assert.ok(game.u._exercise[A_WIS] < 0);
    assert.equal(game.inventory.includes(oil), false);
});
