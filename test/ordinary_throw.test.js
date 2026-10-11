import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, A_LAWFUL, A_STR, P_BASIC, P_BOW, P_CROSSBOW, P_DART, P_SKILLED, W_ARMG, W_WEP, } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ACID_VENOM, AMULET_OF_LIFE_SAVING, ARROW, BLINDING_VENOM, BOW, CLUB, CROSSBOW, CROSSBOW_BOLT, DART, EGG, ELVEN_ARROW, ELVEN_BOW, GAUNTLETS_OF_POWER, ROCK, STATUE, YA, YUMI, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { races } from '../js/roles.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon, } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const PM_COCKATRICE = MONSTER_NAME.indexOf('cockatrice');
const PM_PYROLISK = MONSTER_NAME.indexOf('pyrolisk');
async function throwItem(object) {
    // These cases measure combat outcomes. Input still requires a real,
    // visible pager, including the final death window whose topline is blank.
    const input = resetInputState();
    let pages = 0;
    input.display = { async readKey() {
            const display = requireGameDisplay(game);
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++pages <= 32, 'Throwing requested too many message pages');
            assert.match(screen, /--More--|Hit space to continue/, `Unexpected input while throwing: ${game._pending_message}`);
            return 32;
        } };
    await throwInventoryObject(object, 'l');
}
async function carriedClub() {
    return await addInventoryWeapon(CLUB, { invlet: 'a', spe: 0 });
}
async function fireBowAtJackal({ role = 'caveman', race = 'human', bowType = BOW, arrowType = ARROW, glovesType = null, seed = 1n, heroLevel = 1, dexterity = 10, strength = 10, damageBonus = 0, } = {}) {
    const selectedRace = races.find(candidate => candidate.name === race);
    assert.ok(selectedRace);
    freshObjectRoom({ right: 20, role, race: selectedRace, gameplaySeed: 4900n });
    requirePlayingGame(game);
    game.u.ulevel = heroLevel;
    game.u.acurr.a[A_DEX] = dexterity;
    game.u.acurr.a[A_STR] = strength;
    game.u.udaminc = damageBonus;
    installHeroWeaponSkills({ [P_BOW]: P_BASIC });
    const bow = await addInventoryWeapon(bowType, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const arrow = await addInventoryWeapon(arrowType, { invlet: 'b' });
    game.uwep = game.u.uwep = bow;
    if (glovesType !== null) {
        const gloves = await addInventoryObject(glovesType, {
            invlet: 'c', owornmask: W_ARMG, worn: true,
        });
        game.uarmg = game.u.uarmg = gloves;
    }
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 20;
    initRng(seed);
    await throwItem(arrow);
    return 20 - jackal.mhp;
}
void test('throwing a club carries it across its strength-based range', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4101n });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 10;
    const club = await carriedClub();
    await throwItem(club);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(floorObjects(level).includes(club), true);
    assert.deepEqual([club.ox, club.oy], [15, 10]);
});
void test('a thrown club can hit a monster and land on its square', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4102n });
    requirePlayingGame(game);
    game.u.ulevel = 20;
    game.u.acurr.a[A_DEX] = 18;
    const club = await carriedClub();
    const jackal = await createMonsterAt('jackal', 13, 10);
    jackal.mhp = jackal.mhpmax = 20;
    jackal.mcanmove = 0;
    await throwItem(club);
    assert.ok(jackal.mhp < 20);
    assert.equal(floorObjects(level).includes(club), true);
    assert.deepEqual([club.ox, club.oy], [13, 10]);
});
void test('thrown blinding venom blinds a monster without hurting it', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4108n });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    const venom = await addInventoryObject(BLINDING_VENOM, { invlet: 'a' });
    const jackal = await createMonsterAt('jackal', 13, 10);
    jackal.mhp = jackal.mhpmax = 20;
    initRng(1n);
    await throwItem(venom);
    assert.equal(jackal.mhp, 20);
    assert.equal(jackal.mcansee, 0);
    assert.equal(game.inventory.includes(venom), false);
    assert.equal(floorObjects(level).includes(venom), false);
});
void test('thrown acid venom burns and frightens a pet', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4109n });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    const venom = await addInventoryObject(ACID_VENOM, { invlet: 'a' });
    const jackal = await createMonsterAt('jackal', 13, 10);
    initializePet(jackal, { state: game });
    jackal.mhp = jackal.mhpmax = 20;
    initRng(1n);
    await throwItem(venom);
    assert.ok(jackal.mhp < 20);
    assert.equal(jackal.mtame, 4);
    assert.equal(jackal.mflee, 1);
    assert.equal(venom.where, 'gone');
    assert.equal(game.inventory.includes(venom), false);
    assert.equal(floorObjects(level).includes(venom), false);
});
void test('an ordinary thrown egg splats and deals one point of damage', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4110n });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    const egg = await addInventoryObject(EGG, {
        invlet: 'a', corpsenm: -1, age: game.moves,
    });
    const jackal = await createMonsterAt('jackal', 13, 10);
    jackal.mhp = jackal.mhpmax = 20;
    initRng(1n);
    await throwItem(egg);
    assert.equal(jackal.mhp, 19);
    assert.equal(egg.where, 'gone');
    assert.equal(floorObjects(level).includes(egg), false);
});
void test('a cockatrice egg petrifies a monster and costs Luck', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4111n });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    game.u.uluck = 0;
    const egg = await addInventoryObject(EGG, {
        invlet: 'a', corpsenm: PM_COCKATRICE, spe: 1, known: false,
    });
    const jackal = await createMonsterAt('jackal', 13, 10);
    jackal.mhp = jackal.mhpmax = 20;
    initRng(1n);
    await throwItem(egg);
    assert.equal(game.level.monsters.includes(jackal), false);
    assert.ok(floorObjectsAt(level, 13, 10).some(object => object.otyp === STATUE && object.corpsenm === jackal.mnum));
    assert.equal(egg.where, 'gone');
    assert.equal(egg.known, true);
    assert.equal(game.u.uluck, -1);
});
void test('a fresh egg turns to rock when it hits a cockatrice', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4112n });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    const egg = await addInventoryObject(EGG, {
        invlet: 'a', corpsenm: -1, age: game.moves,
    });
    const cockatrice = await createMonsterAt('cockatrice', 13, 10);
    cockatrice.mhp = cockatrice.mhpmax = 20;
    initRng(1n);
    await throwItem(egg);
    assert.equal(cockatrice.mhp, 19);
    assert.equal(egg.otyp, ROCK);
    assert.equal(egg.where, 'floor');
    assert.deepEqual([egg.ox, egg.oy], [13, 10]);
});
void test('a pyrolisk egg explodes around the monster it hits', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4113n });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 18;
    const egg = await addInventoryObject(EGG, {
        invlet: 'a', corpsenm: PM_PYROLISK, age: game.moves,
    });
    const target = await createMonsterAt('jackal', 13, 10);
    target.mhp = target.mhpmax = 100;
    const neighbor = await createMonsterAt('fox', 13, 11);
    neighbor.mhp = neighbor.mhpmax = 100;
    initRng(1n);
    await throwItem(egg);
    assert.ok(target.mhp < 100);
    assert.ok(neighbor.mhp < 100);
    assert.equal(egg.where, 'gone');
    assert.equal(floorObjects(level).includes(egg), false);
});
void test('grease can make a thrown club slip away from its chosen path', async () => {
    freshObjectRoom({ right: 20, gameplaySeed: 4103n });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 10;
    const club = await carriedClub();
    club.greased = true;
    initRng(2333n);
    await throwItem(club);
    assert.notDeepEqual([club.ox, club.oy], [15, 10]);
    assert.match(game._pending_message, /slips as you throw it/);
});
void test('a crossbow sends its bolt eight squares regardless of Strength', async () => {
    const level = freshObjectRoom({ right: 22, gameplaySeed: 4104n });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 3;
    const crossbow = await addInventoryWeapon(CROSSBOW, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const bolt = await addInventoryWeapon(CROSSBOW_BOLT, { invlet: 'b' });
    game.uwep = game.u.uwep = crossbow;
    await throwItem(bolt);
    assert.equal(floorObjects(level).includes(bolt), true);
    assert.deepEqual([bolt.ox, bolt.oy], [18, 10]);
});
void test('a skilled Ranger can fire several crossbow bolts in one turn', async () => {
    const level = freshObjectRoom({
        right: 22,
        role: 'ranger',
        gameplaySeed: 4106n,
    });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 18;
    installHeroWeaponSkills({ [P_CROSSBOW]: P_SKILLED });
    const crossbow = await addInventoryWeapon(CROSSBOW, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const bolts = await addInventoryWeapon(CROSSBOW_BOLT, {
        invlet: 'b', quan: 3, quantity: 3,
    });
    game.uwep = game.u.uwep = crossbow;
    initRng(4n);
    await throwItem(bolts);
    const landedBolts = floorObjects(level)
        .filter(object => object.otyp === CROSSBOW_BOLT);
    assert.equal(game.inventory.includes(bolts), false);
    assert.equal(landedBolts.reduce((count, object) => count + (object.quan ?? 1), 0), 3);
});
void test('a launcher uses ring damage but not Strength damage', async () => {
    const shot = (overrides) => fireBowAtJackal({
        heroLevel: 20,
        dexterity: 18,
        seed: 1n,
        ...overrides,
    });
    const baseDamage = await shot({ strength: 3 });
    const ringDamage = await shot({ strength: 3, damageBonus: 3 });
    const strongDamage = await shot({ strength: 18 });
    assert.equal(ringDamage, baseDamage + 3);
    assert.equal(strongDamage, baseDamage);
});
void test('an elf is more accurate with an elven bow', async () => {
    const humanDamage = await fireBowAtJackal({
        role: 'ranger',
        bowType: ELVEN_BOW,
        arrowType: ELVEN_ARROW,
        heroLevel: 2,
        seed: 11n,
    });
    const elfDamage = await fireBowAtJackal({
        role: 'ranger',
        race: 'elf',
        bowType: ELVEN_BOW,
        arrowType: ELVEN_ARROW,
        heroLevel: 2,
        seed: 11n,
    });
    assert.equal(humanDamage, 0);
    assert.ok(elfDamage > 0);
});
void test('a Samurai does extra damage with a yumi and ya', async () => {
    const ordinaryDamage = await fireBowAtJackal({
        bowType: YUMI,
        arrowType: YA,
        heroLevel: 20,
        dexterity: 18,
        seed: 1n,
    });
    const samuraiDamage = await fireBowAtJackal({
        role: 'samurai',
        bowType: YUMI,
        arrowType: YA,
        heroLevel: 20,
        dexterity: 18,
        seed: 1n,
    });
    assert.equal(samuraiDamage, ordinaryDamage + 1);
});
void test('gauntlets of power hinder a bow shot', async () => {
    const bareDamage = await fireBowAtJackal({ seed: 11n, heroLevel: 4 });
    const glovedDamage = await fireBowAtJackal({
        glovesType: GAUNTLETS_OF_POWER,
        seed: 11n,
        heroLevel: 4,
    });
    assert.ok(bareDamage > 0);
    assert.equal(glovedDamage, 0);
});
void test('a poisoned thrown dart harms the target and costs lawful alignment', async () => {
    const throwDart = async (poisoned) => {
        freshObjectRoom({
            right: 20,
            gameplaySeed: 4910n,
            hero: { ualign: { type: A_LAWFUL, record: 10 } },
        });
        requirePlayingGame(game);
        game.u.ulevel = 20;
        game.u.acurr.a[A_DEX] = 18;
        installHeroWeaponSkills({ [P_DART]: P_BASIC });
        const dart = await addInventoryWeapon(DART, {
            invlet: 'a', opoisoned: poisoned,
        });
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 20;
        initRng(1n);
        await throwItem(dart);
        return {
            damage: 20 - jackal.mhp,
            alignment: game.u.ualign.record,
        };
    };
    const plain = await throwDart(false);
    const poisoned = await throwDart(true);
    assert.ok(poisoned.damage > plain.damage, `plain dart dealt ${plain.damage}; poisoned dart dealt ${poisoned.damage}`);
    assert.equal(poisoned.alignment, 9);
});
for (const lifesaving of [false, true]) {
    void test(`a gas-spore death blast ${lifesaving ? 'resumes wake and XP effects after life saving' : 'stops before wake and XP effects on fatal injury'}`, async () => {
        const level = freshObjectRoom({
            right: 20, hero: { uhp: 1, uhpmax: 100, uexp: 0 },
            flags: { disclose: '-i -a -v -c -o' },
        });
        requirePlayingGame(game);
        const club = await carriedClub();
        if (lifesaving) {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const spore = await createMonsterAt('gas spore', 11, 10);
        spore.mhp = 1;
        game.u.uhitinc = 20;
        const sleeper = await createMonsterAt('kobold', 17, 10);
        sleeper.msleeping = 1;
        const experience = game.u.uexp ?? 0;
        initRng(1n);
        await throwItem(club);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(club.where, 'floor');
        assert.equal(floorObjectsAt(level, 11, 10).filter(object => object === club).length, 1);
        assert.equal(sleeper.msleeping, lifesaving ? 0 : 1);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok(game.u.uexp > experience);
        }
        else {
            assert.equal(game.u.uexp, experience);
        }
    });
}
void test('a fatal chained gas-spore blast stops the outer blast before its remaining victims', async () => {
    freshObjectRoom({
        right: 20, hero: { uhp: 1, uhpmax: 100, uexp: 0 },
        flags: { disclose: '-i -a -v -c -o' },
    });
    requirePlayingGame(game);
    const club = await carriedClub();
    const spore = await createMonsterAt('gas spore', 11, 10);
    spore.mhp = 1;
    game.u.uhitinc = 20;
    const chain = await createMonsterAt('gas spore', 11, 9);
    chain.mhp = 1;
    const bystander = await createMonsterAt('kobold', 12, 11);
    bystander.mhp = bystander.mhpmax = 100;
    initRng(1n);
    await throwItem(club);
    assert.equal(!!game.program_state.gameover, true);
    assert.equal(chain.dead, true);
    assert.equal(bystander.mhp, 100);
    assert.equal(game.u.uexp, 0);
});
//# sourceMappingURL=ordinary_throw.test.js.map