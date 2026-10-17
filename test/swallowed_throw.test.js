import { monsterAtPosition } from '../js/monster_location.js';
import { requireScreenRow } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { A_CON, A_DEX, A_STR, A_WIS, LOST_STOLEN, P_BASIC, PIT, W_AMUL, W_QUIVER, W_SWAPWEP, W_WEP, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKey, pushKeys, resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { beginObjectBurn } from '../js/light.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ACID_VENOM, AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING, ARROW, BOOMERANG, BOW, CLOVE_OF_GARLIC, CREAM_PIE, DAGGER, DART, EGG, FIGURINE, LONG_SWORD, MAGIC_LAMP, OBJECT_SUBTYPE, OIL_LAMP, PICK_AXE, POT_FRUIT_JUICE, POT_ACID, POT_BLINDNESS, POT_BOOZE, POT_FULL_HEALING, POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HEALING, POT_LEVITATION, POT_MONSTER_DETECTION, POT_INVISIBILITY, POT_OBJECT_DETECTION, POT_OIL, POT_PARALYSIS, POT_RESTORE_ABILITY, POT_SICKNESS, POT_SLEEPING, POT_WATER, ROCK, SCR_BLANK_PAPER, SPEAR, STATUE, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon, artifactObject, knownObject, } from './support/game-objects.js';
import { installHeroWeaponSkills, installHumanWerewolfHero, installPolymorphedHero, wearPolymorphControlRing, } from './support/hero-state.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addTrap, floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
const PM_ENERGY_VORTEX = 109;
const PM_OCHRE_JELLY = 58;
const PM_PURPLE_WORM = 115;
const PM_TRAPPER = 99;
const PM_JUIBLEX = 303;
const PM_WEREWOLF = 21;
const PM_GREMLIN = 40;
const PM_ARCHEOLOGIST = 331;
async function freshSwallowedState(mnum) {
    freshObjectRoom({
        right: 12,
        flags: { verbose: true },
        hero: {
            uhitinc: 0,
            uluck: 0,
        },
        context: { move: 0 },
        recalculateVision: false,
    });
    requirePlayingGame(game);
    const engulfer = await createMonsterAt(mnum, 11, 10);
    engulfer.mx = game.u.ux;
    engulfer.my = game.u.uy;
    engulfer.mhp = engulfer.mhpmax = 40;
    game.u.uswallow = 1;
    game.u.ustuck = engulfer;
    return engulfer;
}
async function installLowCapacityRockBurden(quantity) {
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = game.u.acurr.a[A_CON] = 3;
    game.u.amax.a[A_STR] = game.u.amax.a[A_CON] = 3;
    return await addInventoryObject(ROCK, {
        quan: quantity,
        quantity,
        owt: 10 * quantity,
    });
}
function setBasicWeaponSkill(object) {
    const skill = Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0);
    installHeroWeaponSkills({ [skill]: P_BASIC });
    return skill;
}
async function throwThroughEngulferDeath(projectile, engulfer, retainedObject = projectile) {
    const input = resetInputState();
    const action = throwInventoryObject(projectile, 'h');
    await input.waitUntilBlocked();
    assert.ok(game.nhDisplay);
    const row = requireScreenRow(0);
    assert.ok(row);
    const message = row.map(cell => cell.ch).join('');
    assert.match(message, /You kill the trapper!--More--/);
    assert.ok(engulfer.minvent.includes(retainedObject), 'the death redraw pages before releasing the swallowed projectile');
    input.feed(' ');
    await action;
}
void test('swallowed live throw transfers a cursed figurine and replaces its timer', async () => {
    const engulfer = await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    initRng(2301n);
    const figurine = await addInventoryObject(FIGURINE, {
        corpsenm: MONSTER_NAME.indexOf('wumpus'),
        cursed: true,
    });
    const timer = objectTimers(figurine)[0];
    assert.ok(timer);
    const priorTimer = { ...timer };
    initRng(2302n);
    await throwInventoryObject(figurine);
    assert.equal(game.context.move, 1);
    assert.equal(game.inventory.includes(figurine), false);
    assert.strictEqual(engulfer.minvent[0], figurine);
    assert.strictEqual(engulfer.inventory, engulfer.minvent);
    assert.equal(figurine.where, 'minvent');
    assert.equal(figurine.carrierMid, engulfer.m_id);
    assert.equal(figurine.how_lost, LOST_STOLEN);
    const replacement = objectTimers(figurine);
    assert.equal(replacement.length, 1);
    assert.ok(replacement[0]);
    assert.notEqual(replacement[0].id, priorTimer.id);
    assert.equal(game._pending_message, "The figurine of a wumpus vanishes into the energy vortex's currents.");
});
void test('swallowed split stack merges only after thrown ownership becomes stolen', async () => {
    const engulfer = await freshSwallowedState(PM_PURPLE_WORM);
    requirePlayingGame(game);
    initRng(2303n);
    const carried = await addInventoryObject(SCR_BLANK_PAPER, {
        quan: 2,
        quantity: 2,
    });
    const survivor = {
        ...carried,
        o_id: 2314,
        invlet: null,
        quan: 3,
        quantity: 3,
        where: 'free',
        how_lost: LOST_STOLEN,
        objectTimers: [],
    };
    delete survivor.carrierMid;
    await linkObjectToMonsterInventory(engulfer, survivor);
    initRng(2304n);
    await throwInventoryObject(carried, 'h');
    assert.equal(carried.quan, 1);
    assert.equal(carried.quantity, 1);
    assert.deepEqual(game.inventory, [carried]);
    assert.deepEqual(engulfer.minvent, [survivor]);
    assert.equal(survivor.quan, 4);
    assert.equal(survivor.quantity, 4);
    assert.equal(survivor.how_lost, LOST_STOLEN);
    assert.match(game._pending_message, /^The scroll of blank paper vanishes into the purple worm's entrails\.$/);
    assert.equal(floorObjects(game.level).length, 0);
});
void test('swallowed timed lamp links before snuffing and restores unused fuel', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    initRng(2305n);
    const lamp = await addInventoryObject(OIL_LAMP, { age: 200 });
    assert.equal(lamp.invlet, 'a');
    assert.equal(lamp.oclass, 6);
    assert.equal(beginObjectBurn(lamp, game, game.moves), true);
    assert.equal(lamp.age, 150);
    assert.equal(objectTimers(lamp)[0]?.deadline, 90);
    game.moves = 60;
    initRng(2306n);
    await throwInventoryObject(lamp, 'j');
    assert.equal(game.inventory.includes(lamp), false);
    assert.strictEqual(engulfer.minvent[0], lamp);
    assert.equal(lamp.where, 'minvent');
    assert.equal(lamp.carrierMid, engulfer.m_id);
    assert.equal(lamp.how_lost, LOST_STOLEN);
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, 180);
    assert.deepEqual(objectTimers(lamp), []);
    assert.equal(game.vision_full_recalc, 1);
    assert.equal(game._pending_message, 'The oil lamp vanishes into the trapper.  The oil lamp goes out.');
});
void test('garlic thrown inside an engulfer is transferred without attacking', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const garlic = await addInventoryObject(CLOVE_OF_GARLIC);
    await throwInventoryObject(garlic, 'l');
    assert.equal(engulfer.mhp, 40);
    assert.strictEqual(engulfer.minvent[0], garlic);
    assert.equal(garlic.where, 'minvent');
});
void test('a cream pie thrown from inside an engulfer is consumed', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const pie = await addInventoryObject(CREAM_PIE);
    await throwInventoryObject(pie, 'l');
    assert.equal(pie.where, 'gone');
    assert.equal(game.inventory.includes(pie), false);
    assert.equal(engulfer.mcansee, 1);
    assert.equal(engulfer.mhp, 40);
});
void test('a fatal egg throw releases the hero from an engulfer', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 1;
    const egg = await addInventoryObject(EGG, {
        corpsenm: -1,
        age: game.moves,
    });
    await throwInventoryObject(egg, 'l', Array.from({ length: 8 }, () => ' '));
    assert.notEqual(monsterAtPosition(game.level, engulfer.mx, engulfer.my), engulfer);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(egg.where, 'gone');
    assert.equal(game.inventory.includes(egg), false);
});
void test('acid venom can kill an engulfer and release the hero', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 1;
    const venom = await addInventoryObject(ACID_VENOM);
    await throwInventoryObject(venom, 'l', Array.from({ length: 8 }, () => ' '));
    assert.equal(venom.where, 'gone');
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.notEqual(monsterAtPosition(game.level, engulfer.mx, engulfer.my), engulfer);
});
void test('blind swallowed contact silently snuffs an untimed magic lamp', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    game.u.blindTurns = 5;
    initRng(2307n);
    const lamp = await addInventoryObject(MAGIC_LAMP, { age: 40 });
    assert.equal(lamp.invlet, 'a');
    assert.equal(lamp.oclass, 6);
    assert.equal(beginObjectBurn(lamp, game, game.moves), true);
    assert.equal(lamp.lamplit, true);
    assert.deepEqual(objectTimers(lamp), []);
    initRng(2308n);
    await throwInventoryObject(lamp, 'k');
    assert.strictEqual(engulfer.minvent[0], lamp);
    assert.equal(lamp.where, 'minvent');
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, 40);
    assert.deepEqual(objectTimers(lamp), []);
    assert.equal(game._pending_message, 'The magic lamp vanishes into the trapper.');
});
void test('swallowed ordinary weapon damages, trains, and transfers after contact', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const dagger = await addInventoryWeapon(DAGGER);
    const skill = setBasicWeaponSkill(dagger);
    initRng(2310n);
    await throwInventoryObject(dagger, 'l');
    assert.equal(engulfer.mhp, 37);
    assert.strictEqual(engulfer.minvent[0], dagger);
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(dagger.where, 'minvent');
    assert.equal(dagger.carrierMid, engulfer.m_id);
    assert.equal(dagger.how_lost, LOST_STOLEN);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(game.u._exercise?.[A_DEX], 1);
    assert.equal(game._pending_message, 'The dagger hits the trapper.');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('an unwielded bow can be thrown at a swallowing monster', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const bow = await addInventoryWeapon(BOW);
    setBasicWeaponSkill(bow);
    initRng(2310n);
    await throwInventoryObject(bow, 'l');
    assert.ok(engulfer.mhp < 40);
    assert.strictEqual(engulfer.minvent[0], bow);
});
void test('a swallowed boomerang hits its engulfer before returning to the hero', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const boomerang = await addInventoryWeapon(BOOMERANG);
    setBasicWeaponSkill(boomerang);
    initRng(2310n);
    await throwInventoryObject(boomerang, 'l');
    assert.ok(engulfer.mhp < 40);
    assert.equal(engulfer.minvent.includes(boomerang), false);
    assert.equal(boomerang.where, 'inventory');
    assert.equal(game.uwep, boomerang);
});
void test('a swallowed weapon can hurt the pet that engulfed the hero', async () => {
    const pet = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    initializePet(pet);
    assert.ok(pet.edog);
    const dagger = await addInventoryWeapon(DAGGER);
    setBasicWeaponSkill(dagger);
    initRng(2310n);
    await throwInventoryObject(dagger, 'l', Array.from({ length: 12 }, () => ' '));
    assert.ok(pet.mhp < 40);
    assert.equal(pet.mtame, 4);
    assert.equal(pet.edog.abuse, 1);
    assert.equal(Boolean(game.u.uswallow), false);
    assert.equal(dagger.where, 'floor');
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(dagger));
    assert.equal(pet.minvent.includes(dagger), false);
});
void test('an ordinary swallowed weapon reports contact without damaging a shade', async () => {
    const shade = await freshSwallowedState(MONSTER_NAME.indexOf('shade'));
    requirePlayingGame(game);
    const dagger = await addInventoryWeapon(DAGGER);
    setBasicWeaponSkill(dagger);
    initRng(2310n);
    await throwInventoryObject(dagger, 'l');
    assert.equal(shade.mhp, 40);
    assert.equal(shade.minvent.includes(dagger), true);
    assert.equal(game._pending_message, 'The dagger hits the shade.');
});
void test('a wielded swallowed weapon leaves the hand unless welded', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const dagger = await addInventoryWeapon(DAGGER, {
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = dagger;
    setBasicWeaponSkill(dagger);
    initRng(2310n);
    await throwInventoryObject(dagger, 'l');
    assert.equal(game.uwep, null);
    assert.equal(dagger.wielded, false);
    assert.strictEqual(engulfer.minvent[0], dagger);
    const untouchedEngulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const weldedDagger = await addInventoryWeapon(DAGGER, {
        cursed: true,
        bknown: false,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = weldedDagger;
    setBasicWeaponSkill(weldedDagger);
    initRng(2310n);
    await throwInventoryObject(weldedDagger, 'l');
    assert.equal(untouchedEngulfer.mhp, 40);
    assert.strictEqual(game.uwep, weldedDagger);
    assert.equal(weldedDagger.bknown, true);
    assert.match(game._pending_message, /welded to your hand/);
});
void test('throwing a dual-wielded weapon ends two-weapon mode', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const dagger = await addInventoryWeapon(DAGGER, {
        invlet: 'a', wielded: true, owornmask: W_WEP,
    });
    const sword = await addInventoryWeapon(LONG_SWORD, {
        invlet: 'b', alternate: true, owornmask: W_SWAPWEP,
    });
    game.uwep = game.u.uwep = dagger;
    game.uswapwep = game.u.uswapwep = sword;
    game.u.twoweap = true;
    setBasicWeaponSkill(dagger);
    initRng(2310n);
    await throwInventoryObject(dagger, 'l');
    assert.equal(game.u.twoweap, false);
    assert.strictEqual(game.uswapwep, sword);
    assert.strictEqual(engulfer.minvent[0], dagger);
});
void test('throwing a quivered dart preserves two-weapon mode', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const sword = await addInventoryWeapon(LONG_SWORD, {
        invlet: 'a', wielded: true, owornmask: W_WEP,
    });
    const dagger = await addInventoryWeapon(DAGGER, {
        invlet: 'b', alternate: true, owornmask: W_SWAPWEP,
    });
    const dart = await addInventoryWeapon(DART, {
        invlet: 'c', ready: true, owornmask: W_QUIVER,
    });
    game.uwep = game.u.uwep = sword;
    game.uswapwep = game.u.uswapwep = dagger;
    game.uquiver = game.u.uquiver = dart;
    game.u.twoweap = true;
    setBasicWeaponSkill(dart);
    initRng(2310n);
    await throwInventoryObject(dart, 'l');
    assert.equal(game.u.twoweap, true);
    assert.strictEqual(game.uwep, sword);
    assert.strictEqual(game.uswapwep, dagger);
    assert.ok(engulfer.mhp < 40);
});
void test('a polymorphed throw does not use human Strength damage', async () => {
    async function daggerDamage(formName) {
        const target = await freshSwallowedState(PM_TRAPPER);
        requirePlayingGame(game);
        game.u.acurr.a[A_STR] = 18;
        if (formName)
            installPolymorphedHero(formName);
        const dagger = await addInventoryWeapon(DAGGER);
        setBasicWeaponSkill(dagger);
        initRng(2310n);
        await throwInventoryObject(dagger, 'l');
        return 40 - target.mhp;
    }
    const humanDamage = await daggerDamage();
    const polymorphedDamage = await daggerDamage('giant');
    assert.equal(humanDamage, polymorphedDamage + 2);
});
void test('swallowed throws take one weapon from a stack', async () => {
    for (const weaponType of [DAGGER, DART]) {
        const engulfer = await freshSwallowedState(PM_TRAPPER);
        requirePlayingGame(game);
        const stack = await addInventoryWeapon(weaponType, {
            quan: 3,
            quantity: 3,
        });
        setBasicWeaponSkill(stack);
        initRng(2310n);
        await throwInventoryObject(stack, 'l');
        assert.equal(stack.quan, 2);
        assert.equal(stack.quantity, 2);
        assert.ok(game.inventory.includes(stack));
        assert.ok(engulfer.mhp < 40);
    }
});
void test('a blessed swallowed weapon deals extra damage to a demon', async () => {
    const ordinaryTarget = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    const ordinaryDagger = await addInventoryWeapon(DAGGER);
    setBasicWeaponSkill(ordinaryDagger);
    initRng(2310n);
    await throwInventoryObject(ordinaryDagger, 'l');
    const ordinaryDamage = 40 - ordinaryTarget.mhp;
    const blessedTarget = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    const blessedDagger = await addInventoryWeapon(DAGGER, { blessed: true });
    setBasicWeaponSkill(blessedDagger);
    initRng(2310n);
    await throwInventoryObject(blessedDagger, 'l');
    assert.ok(40 - blessedTarget.mhp > ordinaryDamage);
});
void test('a swallowed artifact applies its special weapon damage', async () => {
    const ordinaryTarget = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const ordinarySword = await addInventoryWeapon(LONG_SWORD);
    setBasicWeaponSkill(ordinarySword);
    initRng(2310n);
    await throwInventoryObject(ordinarySword, 'l');
    const ordinaryDamage = 40 - ordinaryTarget.mhp;
    const artifactTarget = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const fireBrand = await addInventoryItem(await artifactObject('Fire Brand'));
    setBasicWeaponSkill(fireBrand);
    initRng(2310n);
    await throwInventoryObject(fireBrand, 'l', [' ']);
    assert.ok(40 - artifactTarget.mhp > ordinaryDamage);
});
void test('throwing a wielded Sunsword stops its light before swallowed contact', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const sunsword = await addInventoryItem(await artifactObject('Sunsword'));
    await setPrimaryWeapon(sunsword);
    setBasicWeaponSkill(sunsword);
    assert.equal(beginObjectBurn(sunsword, game, game.moves), true);
    initRng(2310n);
    await throwInventoryObject(sunsword, 'l', [' ']);
    assert.equal(sunsword.lamplit, false);
    assert.equal(game.uwep, null);
    assert.strictEqual(engulfer.minvent[0], sunsword);
    assert.ok(engulfer.mhp < 40);
});
void test('a swallowed engulfer can resist Grimtooth poison', async () => {
    const engulfer = await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    const grimtooth = await addInventoryItem(await artifactObject('Grimtooth'));
    setBasicWeaponSkill(grimtooth);
    initRng(5n);
    await throwInventoryObject(grimtooth, 'l', [' ']);
    assert.ok(engulfer.mhp < 40);
    assert.match(game._pending_message, /poison doesn't seem to affect the energy vortex/);
});
void test('swallowed weapon-tool preserves minimal-damage skill cadence', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const pick = await addInventoryWeapon(PICK_AXE);
    const skill = setBasicWeaponSkill(pick);
    initRng(2311n);
    await throwInventoryObject(pick, 'k');
    assert.equal(engulfer.mhp, 39);
    assert.strictEqual(engulfer.minvent[0], pick);
    assert.equal(pick.where, 'minvent');
    assert.equal(pick.carrierMid, engulfer.m_id);
    assert.equal(pick.how_lost, LOST_STOLEN);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 0);
    assert.equal(game.u._exercise?.[A_DEX], 0);
    assert.equal(game._pending_message, 'The pick-axe hits the trapper.');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('swallowed weapon corrodes before the engulfer keeps it', async () => {
    const engulfer = await freshSwallowedState(PM_OCHRE_JELLY);
    requirePlayingGame(game);
    const pick = await addInventoryWeapon(PICK_AXE);
    setBasicWeaponSkill(pick);
    initRng(5n);
    await throwInventoryObject(pick, 'k');
    assert.strictEqual(engulfer.minvent[0], pick);
    assert.equal(pick.oeroded2, 1);
});
void test('swallowed multi-die weapon uses the shared physical damage owner', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const sword = await addInventoryWeapon(TWO_HANDED_SWORD);
    const skill = setBasicWeaponSkill(sword);
    initRng(2313n);
    await throwInventoryObject(sword, 'j');
    assert.equal(engulfer.mhp, 28);
    assert.strictEqual(engulfer.minvent[0], sword);
    assert.equal(sword.where, 'minvent');
    assert.equal(sword.how_lost, LOST_STOLEN);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(game.u._exercise?.[A_DEX], 0);
    assert.equal(game._pending_message, 'The two-handed sword hits the trapper!');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('cursed swallowed throwing weapon slips before hitting the engulfer', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const spear = await addInventoryWeapon(SPEAR, { cursed: true });
    const skill = setBasicWeaponSkill(spear);
    initRng(2333n);
    await throwInventoryObject(spear, 'l');
    assert.equal(engulfer.mhp, 33);
    assert.strictEqual(engulfer.minvent[0], spear);
    assert.equal(spear.how_lost, LOST_STOLEN);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(game._pending_message, 'The spear slips as you throw it!  The spear hits the trapper!');
    assert.equal(game.u.dx, -1);
    assert.equal(game.u.dy, -1);
    assert.equal(game.u.dz, 0);
    assert.equal(floorObjects(game.level).length, 0);
});
void test('swallowed dart survives mulch and transfers after live missile damage', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const dart = await addInventoryWeapon(DART, { unpaid: true });
    const { shopkeeper } = await createStaffedShop({
        keeperX: 14,
        keeperY: 12,
        bill: [{ bo_id: dart.o_id, bquan: 1, useup: false, price: 25 }],
    });
    const skill = setBasicWeaponSkill(dart);
    initRng(2413n);
    await throwInventoryObject(dart, 'l');
    assert.equal(engulfer.mhp, 38);
    assert.strictEqual(engulfer.minvent[0], dart);
    assert.equal(dart.where, 'minvent');
    assert.equal(dart.carrierMid, engulfer.m_id);
    assert.equal(dart.how_lost, LOST_STOLEN);
    assert.equal(dart.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(game._pending_message, 'The dart hits the trapper.');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('a blessed swallowed dart deals extra damage to a demon', async () => {
    const ordinaryTarget = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    const ordinaryDart = await addInventoryWeapon(DART);
    setBasicWeaponSkill(ordinaryDart);
    initRng(2413n);
    await throwInventoryObject(ordinaryDart, 'l');
    const ordinaryDamage = 40 - ordinaryTarget.mhp;
    const blessedTarget = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    const blessedDart = await addInventoryWeapon(DART, { blessed: true });
    setBasicWeaponSkill(blessedDart);
    initRng(2413n);
    await throwInventoryObject(blessedDart, 'l');
    assert.ok(40 - blessedTarget.mhp > ordinaryDamage);
});
void test('a swallowed engulfer can resist poison on a thrown dart', async () => {
    const engulfer = await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    const dart = await addInventoryWeapon(DART, { opoisoned: true });
    setBasicWeaponSkill(dart);
    initRng(2413n);
    await throwInventoryObject(dart, 'l', [' ']);
    assert.ok(engulfer.mhp < 40);
    assert.match(game._pending_message, /poison doesn't seem to affect the energy vortex/);
});
void test('swallowed dart mulch removes the detached identity after damage', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const dart = await addInventoryWeapon(DART, { unpaid: true });
    const { shopkeeper } = await createStaffedShop({
        keeperX: 14,
        keeperY: 12,
        bill: [{ bo_id: dart.o_id, bquan: 1, useup: false, price: 25 }],
    });
    const skill = setBasicWeaponSkill(dart);
    initRng(2502n);
    await throwInventoryObject(dart, 'h');
    assert.equal(engulfer.mhp, 38);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(dart.where, 'gone');
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(shopkeeper.eshk.debit, 25);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(floorObjects(game.level).length, 0);
});
void test('swallowed projectile passive follows mulch survival before acquisition', async () => {
    const engulfer = await freshSwallowedState(PM_OCHRE_JELLY);
    requirePlayingGame(game);
    const dart = await addInventoryWeapon(DART);
    const skill = setBasicWeaponSkill(dart);
    initRng(2645n);
    await throwInventoryObject(dart, 'l');
    assert.equal(engulfer.mhp, 37);
    assert.strictEqual(engulfer.minvent[0], dart);
    assert.equal(dart.where, 'minvent');
    assert.equal(dart.oeroded2, 1);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
});
void test('swallowed launched arrow uses launcher skill and excludes Strength', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const bow = await addInventoryWeapon(BOW);
    const skill = setBasicWeaponSkill(bow);
    game.uwep = game.u.uwep = bow;
    const arrow = await addInventoryWeapon(ARROW);
    game.u.acurr.a[A_STR] = 18;
    initRng(2413n);
    await throwInventoryObject(arrow, 'k');
    assert.equal(engulfer.mhp, 36);
    assert.deepEqual(game.inventory, [bow]);
    assert.strictEqual(engulfer.minvent[0], arrow);
    assert.equal(arrow.where, 'minvent');
    assert.equal(arrow.how_lost, LOST_STOLEN);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(game._pending_message, 'The arrow hits the trapper.');
});
void test('swallowed hand-thrown arrow uses ranged damage and Strength without skill', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const arrow = await addInventoryWeapon(ARROW);
    const skill = setBasicWeaponSkill(arrow);
    game.u.acurr.a[A_STR] = 18;
    initRng(2413n);
    await throwInventoryObject(arrow, 'j');
    assert.equal(engulfer.mhp, 36);
    assert.strictEqual(engulfer.minvent[0], arrow);
    assert.equal(arrow.where, 'minvent');
    assert.equal(arrow.how_lost, LOST_STOLEN);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 0);
    assert.equal(game._pending_message, 'The arrow hits the trapper.');
});
void test('swallowed sickness harms both the engulfer and hero', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_SICKNESS);
    initRng(2510n);
    await throwInventoryObject(potion, 'l');
    assert.equal(engulfer.mhp, 19);
    assert.equal(game.u.uhp, 35);
    assert.equal(game.u._exercise?.[A_CON], -1);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('swallowed booze confuses both the engulfer and hero', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.m_lev = 12;
    engulfer.mconf = 0;
    game.u.confusionTurns = 0;
    const potion = await addInventoryObject(POT_BOOZE);
    initRng(2955n);
    await throwInventoryObject(potion, 'l');
    assert.equal(engulfer.mhp, 39);
    assert.equal(engulfer.mconf, 1);
    assert.equal(game.u.confusionTurns, 3);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects(game.level).length, 0);
    assert.equal(game._pending_message, 'Crash!  You feel somewhat dizzy.');
});
void test('swallowed sleeping potion freezes engulfer and installs hero sleep turns', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.m_lev = 12;
    engulfer.mfrozen = 0;
    engulfer.meating = 3;
    const potion = await addInventoryObject(POT_SLEEPING);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 39);
    assert.equal(engulfer.mcanmove, 0);
    assert.equal(engulfer.mfrozen, 8);
    assert.equal(engulfer.meating, 0);
    assert.equal(game._helplessTurns, 1);
    assert.equal(game._helplessReason, 'sleeping off a magical draught');
    assert.equal(game._helplessDoneMessage, 'You can move again.');
    assert.deepEqual(game.inventory, []);
    assert.equal(potion.where, 'gone');
});
void test('swallowed blindness times engulfer sight before blinding the hero', async () => {
    const engulfer = await freshSwallowedState(PM_PURPLE_WORM);
    requirePlayingGame(game);
    engulfer.m_lev = 12;
    engulfer.mcansee = 1;
    engulfer.mblinded = 0;
    game.u.blindTurns = 0;
    game.blind = false;
    const potion = await addInventoryObject(POT_BLINDNESS);
    initRng(3300n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 39);
    assert.equal(engulfer.mcansee, 0);
    assert.equal(engulfer.mblinded, 120);
    assert.equal(game.u.blindTurns, 4);
    assert.equal(game.blind, true);
    assert.equal(game.vision_full_recalc, 0);
    assert.deepEqual(game.inventory, []);
    assert.equal(potion.where, 'gone');
});
void test('swallowed cursed invisibility reveals and angers an invisible engulfer', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.minvis = 1;
    engulfer.perminvis = 1;
    engulfer.invis_blkd = 0;
    const potion = await addInventoryObject(POT_INVISIBILITY, {
        cursed: true,
    });
    initRng(2511n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 39);
    assert.equal(engulfer.perminvis, 0);
    assert.equal(engulfer.minvis, 0);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('swallowed blessed water damages a demonic engulfer through the live owner', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_WATER, { blessed: true });
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(engulfer.mhp, 31);
    assert.equal(potion.where, 'gone');
});
void test('swallowed cursed water heals a demonic engulfer without angering it', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    engulfer.mhp = 20;
    engulfer.msleeping = 1;
    const potion = await addInventoryObject(POT_WATER, { cursed: true });
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(engulfer.mhp, 31);
    assert.equal(engulfer.msleeping, 0);
    assert.equal(potion.where, 'gone');
});
void test('swallowed cursed-water vapor changes an unthreatened lycanthrope hero', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    engulfer.mhp = 20;
    installHumanWerewolfHero();
    const potion = await addInventoryObject(POT_WATER, { cursed: true });
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 30 }, () => ' '));
    assert.equal(game.u.umonnum, PM_WEREWOLF);
    assert.ok(game.u.mtimedone >= 500 && game.u.mtimedone <= 999);
    assert.equal(game.u.mh, game.u.mhmax);
    assert.ok(game.u.mh > 0);
    assert.equal(game.u.uconduct?.polyselfs, 1);
    assert.equal(potion.where, 'gone');
});
void test('Unchanging suppresses cursed-water lycanthrope vapor transformation', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_UNCHANGING), 'uamul');
    const potion = await addInventoryObject(POT_WATER, { cursed: true });
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(game.u.umonnum, PM_ARCHEOLOGIST);
    assert.equal(game.u.mtimedone, 0);
    assert.equal(game.u.uconduct?.polyselfs ?? 0, 0);
    assert.equal(potion.where, 'gone');
});
void test('gremlin hero water vapor creates a named tame clone and splits form HP', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    game.plname = 'Splitter';
    game.u.umonnum = PM_GREMLIN;
    game.u.mtimedone = 300;
    game.u.mh = 19;
    game.u.mhmax = 17;
    const potion = await addInventoryObject(POT_WATER);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 30 }, () => ' '));
    const clones = game.level.monsters.filter(monster => monster.mcloned);
    assert.equal(clones.length, 1);
    const clone = clones[0];
    assert.ok(clone);
    assert.ok(clone.edog);
    assert.equal(clone.mnum, PM_GREMLIN);
    assert.equal(clone.name, 'Splitter');
    assert.equal(clone.pet, true);
    assert.equal(clone.mtame, 5);
    assert.equal(clone.mpeaceful, 1);
    assert.equal(clone.mhp, 8);
    assert.equal(clone.mhpmax, 8);
    assert.deepEqual(clone.minvent, []);
    assert.strictEqual(clone.inventory, clone.minvent);
    assert.deepEqual(clone.edog.ogoal, { x: -1, y: -1 });
    assert.equal(clone.edog.apport, 12);
    assert.equal(clone.edog.hungrytime, 1040);
    assert.notDeepEqual([clone.mx, clone.my], [game.u.ux, game.u.uy]);
    assert.equal(game.u.umonnum, PM_GREMLIN);
    assert.equal(game.u.mh, 9);
    assert.equal(game.u.mhmax, 9);
    assert.equal(game.u.uconduct?.pets, 1);
    assert.equal(potion.where, 'gone');
    assert.match(game._pending_message, /You multiply!$/);
});
void test('one-HP gremlin vapor consumes water without constructing a clone', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    game.u.umonnum = PM_GREMLIN;
    game.u.mtimedone = 300;
    game.u.mh = 5;
    game.u.mhmax = 1;
    const potion = await addInventoryObject(POT_WATER);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(game.level.monsters.some(monster => monster.mcloned), false);
    assert.equal(game.u.mh, 1);
    assert.equal(game.u.mhmax, 1);
    assert.equal(game.u.uconduct?.pets ?? 0, 0);
    assert.equal(potion.where, 'gone');
    assert.doesNotMatch(game._pending_message, /multiply/);
});
void test('four-HP gremlin throw is not a stamina drop while unencumbered', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    game.u.umonnum = PM_GREMLIN;
    game.u.mtimedone = 300;
    game.u.mh = 4;
    game.u.mhmax = 1;
    const potion = await addInventoryObject(POT_WATER);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.deepEqual(game.inventory, []);
    assert.equal(game.level.monsters.some(monster => monster.mcloned), false);
    assert.equal(game.u.mh, 1);
    assert.equal(game.u.mhmax, 1);
    assert.equal(potion.where, 'gone');
    assert.doesNotMatch(game._pending_message || '', /so little stamina/);
});
void test('overtaxed throw rejects before object and direction input', async () => {
    await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    const rocks = await installLowCapacityRockBurden(50);
    initRng(2511n);
    await rhack('t'.charCodeAt(0));
    assert.deepEqual(game.inventory, [rocks]);
    assert.equal(game._pending_message, "You can't do that while carrying so much stuff.");
    assert.equal(game.context.move, 0);
});
void test('burdened low-HP hero throws without the Stressed stamina branch', async () => {
    await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    game.u.uhp = 9;
    const rocks = await installLowCapacityRockBurden(20);
    const potion = await addInventoryObject(POT_FRUIT_JUICE);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(game.u._exercise, undefined);
    assert.deepEqual(game.inventory, [rocks]);
    assert.equal(potion.where, 'gone');
    assert.equal(game.u.dx, 1);
    assert.equal(game.u.dy, 0);
    assert.equal(game.u.dz, 0);
    assert.doesNotMatch(game._pending_message || '', /so little stamina/);
});
void test('stressed low-HP hero drops then completes swallowed potion contact', async () => {
    const engulfer = await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    game.u.uhp = 9;
    const rocks = await installLowCapacityRockBurden(30);
    const potion = await addInventoryObject(POT_FRUIT_JUICE);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(game.u._exercise?.[A_CON], -1);
    assert.deepEqual(game.inventory, [rocks]);
    assert.equal(potion.where, 'gone');
    assert.equal(game.u.dx, 0);
    assert.equal(game.u.dy, 0);
    assert.equal(game.u.dz, 1);
    assert.equal(engulfer.msleeping, 0);
});
void test('stressed four-HP gremlin drops without physical exercise then contacts', async () => {
    await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    game.u.umonnum = PM_GREMLIN;
    game.u.mtimedone = 300;
    game.u.mh = 4;
    game.u.mhmax = 1;
    game.u.acurr.a[A_STR] = game.u.acurr.a[A_CON] = 3;
    game.u.amax.a[A_STR] = game.u.amax.a[A_CON] = 3;
    const potion = await addInventoryObject(POT_WATER);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.equal(game.u._exercise, undefined);
    assert.equal(game.u.mh, 1);
    assert.equal(game.u.mhmax, 1);
    assert.equal(potion.where, 'gone');
    assert.equal(game.u.dx, 0);
    assert.equal(game.u.dy, 0);
    assert.equal(game.u.dz, 1);
});
void test('controlled lycanthrope acceptance completes swallowed mutation', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    const ring = await wearPolymorphControlRing();
    const potion = await addInventoryObject(POT_WATER, { cursed: true });
    initRng(2511n);
    const input = resetInputState();
    const throwing = throwInventoryObject(potion, 'l');
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'Crash!');
    assert.notEqual(game.u.umonnum, PM_WEREWOLF);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /change into a wolf/);
    input.feed('y');
    await throwing;
    assert.deepEqual(game.inventory, [ring]);
    assert.equal(game.u.umonnum, PM_WEREWOLF);
    assert.equal(game.u.uconduct?.polyselfs, 1);
    assert.equal(potion.where, 'gone');
});
void test('stun bypasses the lycanthrope control prompt and permits transformation', async () => {
    const engulfer = await freshSwallowedState(PM_JUIBLEX);
    requirePlayingGame(game);
    installHumanWerewolfHero();
    await wearPolymorphControlRing();
    game.u.stunned = true;
    game.u.stunnedTurns = 4;
    const potion = await addInventoryObject(POT_WATER, { cursed: true });
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 30 }, () => ' '));
    assert.equal(game.u.umonnum, PM_WEREWOLF);
    assert.equal(game.u.uconduct?.polyselfs, 1);
    assert.equal(potion.where, 'gone');
});
void test('swallowed acid damages the engulfer and exercises hero Constitution', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_ACID);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.ok(engulfer.mhp >= 31 && engulfer.mhp <= 39);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.u._exercise?.[A_CON], -1);
    assert.equal(potion.where, 'gone');
});
void test('swallowed unlit oil breaks without evaporation or floor fallback', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.msleeping = 1;
    const potion = await addInventoryObject(POT_OIL);
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 20 }, () => ' '));
    assert.ok(engulfer.mhp <= 40 && engulfer.mhp >= 39);
    assert.equal(engulfer.msleeping, 0);
    assert.equal(game._pending_message, 'Crash!');
    assert.doesNotMatch(game._pending_message, /evaporates/);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('a swallowed potion can be thrown from the hero hand', async () => {
    await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_FRUIT_JUICE);
    assert.ok(potion.invlet);
    pushKey(potion.invlet);
    await rhack('w'.charCodeAt(0));
    initRng(2511n);
    await throwInventoryObject(potion, 'l', Array.from({ length: 10 }, () => ' '));
    assert.equal(game.uwep, null);
    assert.equal(potion.where, 'gone');
});
void test('swallowed healing family heals both monster and hero through vapor', async () => {
    const cases = [
        {
            type: POT_HEALING,
            blessed: true,
            cursed: false,
            seed: 2813n,
            heroGain: 1,
        },
        {
            type: POT_FULL_HEALING,
            blessed: false,
            cursed: true,
            seed: 2810n,
            heroGain: 3,
        },
    ];
    for (const specimen of cases) {
        const engulfer = await freshSwallowedState(PM_TRAPPER);
        requirePlayingGame(game);
        engulfer.mhp = 9;
        engulfer.mcansee = 0;
        engulfer.mblinded = 20;
        engulfer.msleeping = 1;
        game.u.uhp = 30;
        game.u.uhpmax = 40;
        game.u.blindTurns = 5;
        game.u.deafTurns = 7;
        const potion = await addInventoryObject(specimen.type, {
            cursed: specimen.cursed,
            blessed: specimen.blessed,
        });
        initRng(specimen.seed);
        await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
        assert.equal(engulfer.mhp, engulfer.mhpmax);
        assert.equal(engulfer.mcansee, 1);
        assert.equal(engulfer.mblinded, 0);
        assert.equal(engulfer.msleeping, 0);
        assert.equal(game.u.uhp, 30 + specimen.heroGain);
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(potion.where, 'gone');
    }
});
void test('swallowed blessed gain ability restores every reduced base attribute', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 11;
    game.u.acurr.a = [12, 12, 12, 12, 12, 12];
    game.u.acurr.a[A_STR] = 10;
    game.u.acurr.a[A_WIS] = 9;
    game.u.acurr.a[A_CON] = 8;
    game.u.amax.a = [12, 12, 12, 12, 12, 12];
    const potion = await addInventoryObject(POT_GAIN_ABILITY, {
        blessed: true,
    });
    initRng(2824n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
    assert.equal(engulfer.mhp, engulfer.mhpmax);
    assert.equal(game.u.acurr.a[A_STR], 11);
    assert.equal(game.u.acurr.a[A_WIS], 10);
    assert.equal(game.u.acurr.a[A_CON], 9);
    assert.equal(potion.where, 'gone');
});
void test('cursed restore ability vapor smells but cannot restore attributes', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 12;
    game.u.acurr.a = [12, 12, 12, 12, 12, 12];
    game.u.acurr.a[A_STR] = 10;
    game.u.acurr.a[A_WIS] = 9;
    game.u.acurr.a[A_CON] = 8;
    game.u.amax.a = [12, 12, 12, 12, 12, 12];
    const potion = await addInventoryObject(POT_RESTORE_ABILITY, {
        cursed: true,
    });
    initRng(2820n);
    await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
    assert.equal(engulfer.mhp, engulfer.mhpmax);
    assert.equal(game.u.acurr.a[A_STR], 10);
    assert.equal(game.u.acurr.a[A_WIS], 9);
    assert.equal(game.u.acurr.a[A_CON], 8);
    assert.equal(game._pending_message, 'Crash!  Ulch!  That potion smells terrible!');
    assert.equal(potion.where, 'gone');
});
void test('all monster-inert potions crash unseen, chip, and disappear live', async () => {
    const inertTypes = [
        POT_GAIN_LEVEL, POT_GAIN_ENERGY, POT_LEVITATION,
        POT_FRUIT_JUICE, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION,
    ];
    const expectedHp = [39, 40, 39, 39, 40, 39];
    for (const [index, otyp] of inertTypes.entries()) {
        const engulfer = await freshSwallowedState(PM_TRAPPER);
        requirePlayingGame(game);
        if (index === 0)
            engulfer.msleeping = 1;
        const potion = await addInventoryObject(otyp);
        initRng(2511n + BigInt(index));
        await throwInventoryObject(potion, 'l', [' ', ' ', ' ']);
        assert.equal(engulfer.mhp, expectedHp[index]);
        assert.equal(engulfer.msleeping, 0);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(potion.ox, 0);
        assert.equal(potion.oy, 0);
        assert.equal(game._pending_message, 'Crash!');
        assert.equal(floorObjects(game.level).length, 0);
    }
});
void test('unseen swallowed bottle selection remains hallucination-sensitive', async () => {
    const engulfer = await freshSwallowedState(PM_ENERGY_VORTEX);
    requirePlayingGame(game);
    game.u.hallucinationTurns = 8;
    const potion = await addInventoryObject(POT_GAIN_LEVEL);
    initRng(2520n);
    await throwInventoryObject(potion, 'h', [' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 39);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(game._pending_message, 'Crash!');
});
void test('swallowed inert potion stack splits one consumed identity', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_FRUIT_JUICE, {
        quan: 2,
        quantity: 2,
    });
    initRng(2521n);
    await throwInventoryObject(potion, 'j', [' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 40);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 1);
    assert.equal(potion.quantity, 1);
    assert.equal(potion.where, 'inventory');
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(floorObjects(game.level).length, 0);
});
void test('dknown unknown swallowed potion records a live type call after impact', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_FRUIT_JUICE, {
        known: false,
        typeKnown: false,
    });
    const sibling = await addInventoryObject(POT_FRUIT_JUICE, {
        blessed: true,
        known: false,
        typeKnown: false,
    });
    initRng(2522n);
    await throwInventoryObject(potion, 'l', [
        ...Array.from({ length: 20 }, () => ' '), ...'mystery', '\n',
    ]);
    assert.equal(engulfer.mhp, 39);
    assert.deepEqual(game.inventory, [sibling]);
    assert.equal(potion.where, 'gone');
    assert.equal(game._objectCallNames?.[POT_FRUIT_JUICE], 'mystery');
    assert.equal(inventoryItemDescription(sibling), 'a blessed potion called mystery');
    assert.equal(floorObjects(game.level).length, 0);
});
void test('unseen unknown inert potion needs no naming continuation', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_FRUIT_JUICE, {
        bknown: false,
        dknown: false,
        known: false,
        typeKnown: false,
    });
    potion.bknown = potion.dknown = potion.known = potion.typeKnown = false;
    initRng(2523n);
    await throwInventoryObject(potion, 'l');
    assert.equal(engulfer.mhp, 39);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(game._pending_message, 'Crash!');
});
void test('greased inert potion slips before its swallowed impact transaction', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_GAIN_ENERGY, {
        greased: true,
    });
    initRng(2524n);
    await throwInventoryObject(potion, 'h', [' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 39);
    assert.deepEqual(game.inventory, []);
    assert.equal(potion.where, 'gone');
    assert.equal(game._pending_message, 'The potion of gain energy slips as you throw it!  Crash!');
    assert.equal(game.u.dx, 0);
    assert.equal(game.u.dy, 0);
    assert.equal(game.u.dz, 1);
});
void test('a killing swallowed dart is acquired, dropped, and autopicked before cleanup', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 1;
    game.flags.pickup = true;
    const dart = await addInventoryWeapon(DART);
    const skill = setBasicWeaponSkill(dart);
    initRng(2312n);
    await throwThroughEngulferDeath(dart, engulfer);
    assert.equal(engulfer.mhp, 0);
    assert.equal(engulfer.dead, true);
    assert.notEqual(monsterAtPosition(game.level, engulfer.mx, engulfer.my), engulfer);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.uswldtim, 0);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.ok(engulfer.mspec_used !== undefined && [1, 2].includes(engulfer.mspec_used));
    assert.deepEqual(game.inventory, [dart]);
    assert.equal(dart.where, 'inventory');
    assert.equal(dart.how_lost, 0);
    assert.equal('carrierMid' in dart, false);
    assert.equal(floorObjects(game.level).includes(dart), false);
    assert.equal(game.u.weaponSkills?.[skill]?.advance, 1);
    assert.equal(game.u._exercise?.[A_DEX], 1);
    assert.equal(game.u.uconduct?.killer, 1);
    assert.equal(game.mvitals?.[PM_TRAPPER]?.died, 1);
    assert.ok((game.u.uexp ?? 0) > 0);
    assert.equal(floorObjects(game.level)
        .some(object => /corpse/.test(object.name || '')), false);
    assert.equal(game._pending_message, 'a - a +0 dart.');
});
void test('a swallowed monster can survive a killing throw with life saving', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 1;
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    await equipMonsterObject(engulfer, amulet, W_AMUL);
    const dart = await addInventoryWeapon(DART);
    setBasicWeaponSkill(dart);
    initRng(2312n);
    await throwInventoryObject(dart, 'h', [' ', ' ', ' ']);
    assert.equal(engulfer.mhp, engulfer.mhpmax);
    assert.equal(game.u.uswallow, 1);
    assert.strictEqual(game.u.ustuck, engulfer);
    assert.equal(engulfer.minvent.includes(amulet), false);
    assert.equal(engulfer.minvent.includes(dart), true);
});
void test('a killing swallowed weapon remains on the death square without autopickup', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 1;
    game.flags.pickup = false;
    const dagger = await addInventoryWeapon(DAGGER);
    setBasicWeaponSkill(dagger);
    initRng(2312n);
    await throwInventoryObject(dagger, 'h', [' ']);
    const pile = floorObjectsAt(game.level, 10, 10);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(pile, [dagger]);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.how_lost, LOST_STOLEN);
    assert.equal('carrierMid' in dagger, false);
    assert.match(game._pending_message, /You see here a \+0 dagger\./);
});
for (const { name, fixedLetters } of [
    { name: 'a killing projectile releases prior minvent ahead of itself into autopickup', fixedLetters: false },
    { name: 'a recovered killing projectile keeps its earlier letter after prior minvent is autopicked', fixedLetters: true },
]) {
    void test(name, async () => {
        const engulfer = await freshSwallowedState(PM_TRAPPER);
        requirePlayingGame(game);
        engulfer.mhp = 1;
        game.flags.pickup = true;
        game.flags.fixinv = fixedLetters;
        const prior = await knownObject(SCR_BLANK_PAPER);
        await linkObjectToMonsterInventory(engulfer, prior);
        const dart = await addInventoryWeapon(DART);
        const originalLetter = dart.invlet;
        setBasicWeaponSkill(dart);
        initRng(2312n);
        await throwInventoryObject(dart, 'h', [' ']);
        assert.equal(game.inventory.length, 2);
        assert.equal(game.inventory[0], fixedLetters ? dart : prior);
        assert.equal(game.inventory[1], fixedLetters ? prior : dart);
        assert.equal(dart.invlet, originalLetter);
        assert.equal(prior.where, 'inventory');
        assert.equal(dart.where, 'inventory');
        assert.equal(prior.how_lost, 0);
        assert.equal(dart.how_lost, 0);
        assert.equal('carrierMid' in prior, false);
        assert.equal('carrierMid' in dart, false);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(floorObjects(game.level).length, 0);
    });
}
void test('a killing projectile merges in minvent before the survivor is released', async () => {
    const engulfer = await freshSwallowedState(PM_TRAPPER);
    requirePlayingGame(game);
    engulfer.mhp = 1;
    game.flags.pickup = true;
    const survivor = await knownObject(DART, {
        quan: 2,
        quantity: 2,
        spe: 0,
        enchantment: 0,
        oeroded: 0,
        oeroded2: 0,
        how_lost: LOST_STOLEN,
    });
    await linkObjectToMonsterInventory(engulfer, survivor);
    const dart = await addInventoryWeapon(DART);
    setBasicWeaponSkill(dart);
    initRng(2312n);
    await throwThroughEngulferDeath(dart, engulfer, survivor);
    assert.deepEqual(game.inventory, [survivor]);
    assert.equal(survivor.quan, 3);
    assert.equal(survivor.quantity, 3);
    assert.equal(survivor.where, 'inventory');
    assert.equal(survivor.how_lost, 0);
    assert.equal(dart.where, 'gone');
    assert.equal('carrierMid' in survivor, false);
    assert.equal('carrierMid' in dart, false);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(floorObjects(game.level).length, 0);
});
for (const [name, type] of [
    ['dart', DART], ['egg', EGG], ['acid venom', ACID_VENOM],
    ['acid potion', POT_ACID],
]) {
    for (const lifeSaving of [false, true]) {
        void test(`swallowed ${name} kill ${lifeSaving ? 'continues after life saving' : 'stops at fatal expulsion'}`, async () => {
            const engulfer = await freshSwallowedState(PM_TRAPPER);
            requirePlayingGame(game);
            engulfer.mhp = 1;
            game.u.uhp = 1;
            game.u.uhpmax = 40;
            game.u.uexp = 0;
            game.flags.pickup = false;
            addTrap(game.level, PIT, game.u.ux, game.u.uy);
            if (lifeSaving) {
                const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
                await wearHeroAccessory(amulet, 'uamul');
            }
            const projectile = await addInventoryObject(type);
            if (type === DART)
                setBasicWeaponSkill(projectile);
            initRng(2312n);
            await throwInventoryObject(projectile, 'h', [...' '.repeat(80)]);
            assert.equal(engulfer.dead, true);
            assert.equal(game.u.uswallow, 0);
            assert.equal(!!game.program_state.gameover, !lifeSaving);
            if (lifeSaving) {
                assert.ok(game.u.uhp > 0);
                assert.ok(game.u.uexp > 0);
                if (type === POT_ACID)
                    assert.equal(projectile.where, 'gone');
            }
            else {
                assert.equal(game.u.uexp, 0);
                if (type === POT_ACID) {
                    assert.equal(projectile.where, 'floor');
                    assert.ok(floorObjectsAt(game.level, 9, 10).includes(projectile));
                }
            }
        });
    }
}
for (const [name, type] of [
    ['dagger', DAGGER],
    ['acid potion', POT_ACID],
]) {
    for (const lifeSaving of [false, true]) {
        void test(`swallowed melee ${name} ${lifeSaving ? 'continues after life saving' : 'processes fatal expulsion'}`, async () => {
            const engulfer = await freshSwallowedState(PM_TRAPPER);
            requirePlayingGame(game);
            engulfer.mhp = 1;
            game.u.uhp = 1;
            game.u.uhpmax = 40;
            game.u.uexp = 0;
            game.flags.pickup = false;
            addTrap(game.level, PIT, game.u.ux, game.u.uy);
            if (lifeSaving) {
                const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
                await wearHeroAccessory(amulet, 'uamul');
            }
            const weapon = await addInventoryObject(type);
            await setPrimaryWeapon(weapon, game);
            initRng(2312n);
            pushKeys(' '.repeat(80));
            await rhack('h'.charCodeAt(0));
            assert.equal(engulfer.dead, true);
            assert.equal(game.u.uswallow, 0);
            assert.equal(!!game.program_state.gameover, !lifeSaving);
            if (lifeSaving) {
                assert.ok(game.u.uhp > 0);
                assert.equal(game.uamul, null);
                assert.ok(game.u.uexp > 0);
            }
            else {
                assert.equal(game.u.uexp, 0);
            }
        });
    }
}
for (const wearsLifeSaving of [false, true]) {
    void test(`a swallowed melee petrifying egg releases the hero above a pit ${wearsLifeSaving ? 'without consuming life saving' : 'without a landing injury'}`, async () => {
        const engulfer = await freshSwallowedState(PM_TRAPPER);
        requirePlayingGame(game);
        engulfer.mhp = 1;
        game.u.uhp = 1;
        game.u.uhpmax = 40;
        game.u.uexp = 0;
        game.flags.pickup = false;
        const trap = addTrap(game.level, PIT, game.u.ux, game.u.uy);
        const amulet = wearsLifeSaving
            ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet)
            await wearHeroAccessory(amulet, 'uamul');
        const egg = await addInventoryObject(EGG, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
        await setPrimaryWeapon(egg, game);
        initRng(2312n);
        installPagerInput(resetInputState(), {
            expected: /trapper|egg|statue|stone|experience level|amulet of life saving/,
            limit: 8,
        });
        await rhack('h'.charCodeAt(0));
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game.u.uhp, 1);
        assert.equal(game.u.uswallow, 0);
        assert.equal(game.u.ustuck, null);
        assert.ok(!game.u.utrap);
        assert.equal(!!trap.tseen, false);
        assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy)
            .some(object => object.otyp === STATUE && object.corpsenm === PM_TRAPPER));
        assert.ok(game.u.uexp > 0);
        if (amulet) {
            assert.equal(game.uamul, amulet);
            assert.equal(amulet.where, 'inventory');
        }
    });
}
//# sourceMappingURL=swallowed_throw.test.js.map