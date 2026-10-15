import { createRoom } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, BEAR_TRAP, IRONBARS, GD_EATGOLD, ROOMOFFSET, VAULT, W_ARM } from '../js/const.js';
import { digestAccessory } from '../js/eaten_accessory.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';
import { IRON_BARS_FOOD, isEdibleFood, selectFoodToEat } from '../js/food_selection.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { handleFoodAdmission } from '../js/nonfood_eating.js';
import { AMULET_OF_YENDOR, APPLE, DAGGER, EGG, GOLD_PIECE, LARGE_BOX, LEATHER_ARMOR, OBJECT_NAMES, RIN_SLOW_DIGESTION, SCR_IDENTIFY, TALLOW_CANDLE, POT_HEALING, } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { objectQuantity } from '../js/object_stack.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { initRng, rn2 } from '../js/rng.js';
import { moveVaultGuard } from '../js/vault.js';
import { addInventoryObject, floorObject, uninitializedObject, untimedCorpse } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
function eatingRoom(form = undefined, options = {}) {
    const level = freshObjectRoom({ flags: { verbose: true, tips: false }, ...options });
    requirePlayingGame(game);
    if (form)
        installPolymorphedHero(form);
    return level;
}
void test('diet admission follows material and body without making protected unique objects edible', async () => {
    eatingRoom('rust monster');
    requirePlayingGame(game);
    const dagger = await uninitializedObject(DAGGER);
    const gold = await uninitializedObject(GOLD_PIECE);
    const amulet = await uninitializedObject(AMULET_OF_YENDOR);
    assert.equal(isEdibleFood(dagger), true);
    assert.equal(isEdibleFood(gold), false);
    installPolymorphedHero('rock mole');
    assert.equal(isEdibleFood(gold), true);
    assert.equal(isEdibleFood(amulet), false);
});
void test('a gelatinous cube can eat an empty wooden container but cannot eat its contents with it', async () => {
    eatingRoom('gelatinous cube');
    requirePlayingGame(game);
    const box = await uninitializedObject(LARGE_BOX);
    assert.equal(isEdibleFood(box), true);
    await addCreatedObjectToContainer(box, await uninitializedObject(APPLE));
    assert.equal(isEdibleFood(box), false);
});
void test('ghoul food excludes plant corpses and ordinary rations but admits eggs and meat corpses', async () => {
    eatingRoom('ghoul');
    requirePlayingGame(game);
    assert.equal(isEdibleFood(await untimedCorpse(MONSTER_NAME.indexOf('lichen'))), false);
    assert.equal(isEdibleFood(await untimedCorpse(MONSTER_NAME.indexOf('newt'))), true);
    assert.equal(isEdibleFood(await uninitializedObject(APPLE)), false);
    assert.equal(isEdibleFood(await uninitializedObject(EGG)), true);
});
void test('a fire elemental eats paper but candles are not flammable food', async () => {
    eatingRoom('fire elemental');
    requirePlayingGame(game);
    assert.equal(isEdibleFood(await uninitializedObject(SCR_IDENTIFY)), true);
    assert.equal(isEdibleFood(await uninitializedObject(TALLOW_CANDLE)), false);
});
void test('floor food can be declined one item at a time before an inventory choice', async () => {
    eatingRoom();
    requirePlayingGame(game);
    const apple = await addInventoryObject(APPLE);
    await floorObject(EGG, game.u.ux, game.u.uy);
    await floorObject(APPLE, game.u.ux, game.u.uy);
    assert.ok(apple.invlet);
    pushKeys('nn' + apple.invlet);
    assert.equal(await selectFoodToEat(), apple);
});
void test('the menu prefix and levitation skip floor food and retain real inventory selection', async () => {
    for (const skip of ['menu', 'levitation']) {
        eatingRoom();
        requirePlayingGame(game);
        const apple = await addInventoryObject(APPLE);
        await floorObject(EGG, game.u.ux, game.u.uy);
        if (skip === 'menu')
            game.iflags.menu_requested = true;
        else
            grantIntrinsicProperty('levitation', 'outside');
        assert.ok(apple.invlet);
        pushKeys(apple.invlet);
        assert.equal(await selectFoodToEat(), apple);
    }
});
void test('declined floor food changes the empty-inventory message', async () => {
    eatingRoom();
    requirePlayingGame(game);
    await floorObject(APPLE, game.u.ux, game.u.uy);
    pushKeys('n');
    assert.equal(await selectFoodToEat(), null);
    assert.equal(game._lastPlineMessage, "You don't have anything else to eat.");
});
void test('a metal-eater can select and consume the armed floor bear trap', async () => {
    const level = eatingRoom('rust monster');
    requirePlayingGame(game);
    const trap = addTrap(level, BEAR_TRAP, game.u.ux, game.u.uy, { tseen: true });
    pushKeys('y');
    const food = await selectFoodToEat();
    assert.ok(food && 'otyp' in food);
    assert.equal(level.traps.includes(trap), false);
    installPagerInput(resetInputState(), { expected: /This bear trap is delicious/, limit: 2 });
    const result = await handleFoodAdmission(food);
    assert.equal(result.spentTime, true);
    assert.equal(food.where, 'gone');
    assert.equal(game.u.uconduct?.food, 1);
});
void test('rustproof spitting affects one unit and drops it without gaining nutrition', async () => {
    const level = eatingRoom('rust monster');
    requirePlayingGame(game);
    const stack = await addInventoryObject(DAGGER, { quantity: 3, oerodeproof: true });
    const hunger = game.u.uhunger;
    installPagerInput(resetInputState(), { expected: /Ulch - that .* was rustproofed|You spit the .* out onto the/, limit: 3 });
    const result = await handleFoodAdmission(stack);
    assert.equal(result.spentTime, true);
    assert.equal(objectQuantity(stack), 2);
    assert.equal(stack.oerodeproof, true);
    assert.equal(stack.rknown, true);
    const spit = floorObjectsAt(level, game.u.ux, game.u.uy).find(object => object.otyp === DAGGER);
    assert.ok(spit);
    assert.equal(objectQuantity(spit), 1);
    assert.equal(!!spit.oerodeproof, false);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.u.uconduct?.food || 0, 0);
});
void test('non-food eating consumes one weapon from a stack and clears its temporary meal state', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const stack = await addInventoryObject(DAGGER, { quantity: 2 });
    const hunger = game.u.uhunger;
    installPagerInput(resetInputState(), { expected: /This .*dagger is delicious/, limit: 2 });
    const result = await handleFoodAdmission(stack);
    assert.equal(result.spentTime, true);
    assert.equal(objectQuantity(stack), 1);
    assert.ok(game.u.uhunger > hunger);
    assert.equal(game.context.victual, null);
    assert.equal(game._occupation, null);
    assert.equal(game.u.uconduct?.food, 1);
});
void test('non-food eating rejects worn armor before consuming it', async () => {
    eatingRoom('gelatinous cube');
    requirePlayingGame(game);
    const armor = await addInventoryObject(LEATHER_ARMOR, { owornmask: W_ARM });
    installPagerInput(resetInputState(), { expected: /You can't eat something you're wearing/, limit: 1 });
    const result = await handleFoodAdmission(armor);
    assert.equal(result.spentTime, false);
    assert.equal(armor.where, 'inventory');
    assert.match(game._lastPlineMessage, /wearing/);
});
void test('an indigestible ring survives without granting nutrition', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const ring = await addInventoryObject(RIN_SLOW_DIGESTION, { dknown: false });
    // The live appearance table permits an iron slow-digestion ring.
    assert.ok(game.objectMaterials);
    game.objectMaterials[ring.otyp] = 11;
    const hunger = game.u.uhunger;
    installPagerInput(resetInputState(), { expected: /This ring is indigestible|Blecch!|You feel rather|Everything suddenly goes dark|The world spins/, limit: 4 });
    const result = await handleFoodAdmission(ring);
    assert.equal(result.spentTime, true);
    assert.equal(ring.where, 'inventory');
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.u.uconduct?.food || 0, 0);
});
void test('digesting a strength ring increases the base attribute and identifies its type', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const ring = await uninitializedObject(OBJECT_NAMES.indexOf('gain strength'), { spe: 2, known: false, dknown: false });
    const before = game.u.acurr.a[A_STR];
    installPagerInput(resetInputState(), { expected: /Magic spreads through your body|You feel strong/, limit: 3 });
    initRng(1n);
    await digestAccessory(ring);
    assert.equal(game.u.acurr.a[A_STR], before + 2);
    assert.equal(ring.known, true);
    assert.equal(ring.dknown, true);
    assert.equal(game._knownObjectTypes?.has(ring.otyp), true);
});
void test('free-action digestion grants sleep resistance rather than free action', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const ring = await uninitializedObject(OBJECT_NAMES.indexOf('free action'));
    installPagerInput(resetInputState(), { expected: /Magic spreads through your body|You feel wide awake/, limit: 2 });
    initRng(1n);
    await digestAccessory(ring);
    assert.equal(hasIntrinsicProperty('sleepResistance', 'outside'), true);
    assert.equal(hasIntrinsicProperty('freeAction', 'outside'), false);
});
void test('levitation-ring digestion grants a finite timeout without a permanent source', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const ring = await uninitializedObject(OBJECT_NAMES.indexOf('levitation'));
    installPagerInput(resetInputState(), { expected: /Magic spreads through your body|You start to float/, limit: 2 });
    initRng(1n);
    await digestAccessory(ring);
    assert.ok(game.u.levitationTurns !== undefined);
    assert.ok(game.u.levitationTurns >= 10 && game.u.levitationTurns <= 200);
    assert.equal(propertyIsActive('levitation'), true);
    assert.equal(hasIntrinsicProperty('levitation', 'outside'), false);
});
void test('eating iron bars resumes work and restores passable terrain on completion', async () => {
    const level = eatingRoom('rust monster');
    requirePlayingGame(game);
    const location = level.requireAt(game.u.ux, game.u.uy);
    location.typ = IRONBARS;
    const hunger = game.u.uhunger;
    for (let attempt = 0; attempt < 3; attempt++) {
        const input = resetInputState();
        const food = await answerPrompts(selectFoodToEat(), input, [
            {
                prompt: attempt === 0
                    ? /There are iron bars here; eat them\?/
                    : /There are iron bars here; resume eating them\?/,
                keys: 'y',
            },
        ]);
        assert.ok(food);
        installPagerInput(input, {
            expected: /You (start chewing|continue chewing|pause to swallow|devour the iron bars)/,
            limit: 3,
        });
        assert.equal(food, IRON_BARS_FOOD);
        await handleFoodAdmission(food);
        await flushPendingTopline();
        if (attempt < 2)
            assert.equal(location.typ, IRONBARS);
    }
    assert.notEqual(location.typ, IRONBARS);
    assert.ok(game.u.uhunger >= hunger + 481);
    assert.equal(game.context.digging?.chew, false);
});
void test('a guard who sees gold eaten becomes hostile on its next movement', async () => {
    const level = eatingRoom('rock mole');
    requirePlayingGame(game);
    const vault = createRoom({ lx: 7, ly: 6, hx: 16, hy: 14, rtype: VAULT });
    level.rooms = [vault];
    level.nroom = 1;
    for (let x = vault.lx; x <= vault.hx; x++)
        for (let y = vault.ly; y <= vault.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const guard = await createMonsterAt('guard', 12, 10);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    guard._egd = {
        gdlevel: { ...game.u.uz }, ogx: guard.mx, ogy: guard.my, witness: 0,
        gddone: 0, gdx: guard.mx, gdy: guard.my, vault, warncnt: 1,
        fcbeg: 0, fcend: 0, fakecorr: [], dropgoldcnt: 0,
    };
    const gold = await addInventoryObject(GOLD_PIECE, { quantity: 300 });
    const hunger = game.u.uhunger;
    installPagerInput(resetInputState(), { expected: /This gold is delicious|How dare you consume that gold/, limit: 2 });
    await handleFoodAdmission(gold);
    assert.equal(gold.where, 'gone');
    assert.equal(game.u.uhunger, hunger + 3);
    assert.ok(guard._egd);
    assert.equal(guard._egd.witness, GD_EATGOLD);
    await moveVaultGuard(guard, game, rn2);
    assert.equal(guard.mpeaceful, 0);
    assert.ok(guard._egd);
    assert.equal(guard._egd.witness, 0);
    assert.match(game._lastPlineMessage, /How dare you consume that gold/);
});
void test('digesting a worn ring removes its equipment source before granting its lasting effect', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('poison resistance'));
    await wearHeroAccessory(ring, 'uleft');
    installPagerInput(resetInputState(), { expected: /Magic spreads through your body/, limit: 2 });
    initRng(1n);
    await digestAccessory(ring);
    assert.equal(game.uleft, null);
    assert.equal(ring.owornmask, 0);
    assert.equal(hasIntrinsicProperty('poisonResistance', 'outside'), true);
    assert.equal(game.u.poisonResistance, true);
});
void test('digesting an organic potion applies healing and consumes exactly one bottle', async () => {
    eatingRoom('gelatinous cube');
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_HEALING, { quantity: 2 });
    assert.ok(game.objectMaterials);
    game.objectMaterials[potion.otyp] = 3;
    game.u.mh = 10;
    installPagerInput(resetInputState(), { expected: /This .*potion.* is delicious|You feel better/, limit: 3 });
    const result = await handleFoodAdmission(potion);
    assert.equal(result.spentTime, true);
    assert.equal(objectQuantity(potion), 1);
    assert.ok(game.u.mh > 10);
});
void test('digested protection from shape changers restores an actor and reveals a hidden mimic', async () => {
    eatingRoom('rock mole');
    requirePlayingGame(game);
    const changed = await createMonsterAt('newt', 12, 10);
    changed.cham = MONSTER_NAME.indexOf('chameleon');
    const mimic = await createMonsterAt('small mimic', 14, 10);
    const ring = await uninitializedObject(OBJECT_NAMES.indexOf('protection from shape changers'));
    installPagerInput(resetInputState(), { expected: /Magic spreads through your body/, limit: 2 });
    initRng(1n);
    await digestAccessory(ring);
    assert.equal(changed.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(changed.cham, -1);
    assert.equal((mimic.m_ap_type ?? 0) & 3, 0);
    assert.equal(mimic.msleeping, 1);
    assert.equal(hasIntrinsicProperty('protectionFromShapeChangers', 'outside'), true);
});
//# sourceMappingURL=nonfood_eating.test.js.map