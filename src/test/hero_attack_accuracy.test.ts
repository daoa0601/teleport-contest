import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import {
    A_DEX, A_STR, NO_MINVENT, P_BARE_HANDED_COMBAT, P_BASIC, P_DAGGER,
    P_EXPERT, P_RIDING, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED,
    STR18, W_ARM,
} from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import {
    findHeroMeleeHitThreshold, maybeUnparalyzeMeleeDefender, showHeroMeleeMiss,
} from '../js/hero_attack_accuracy.js';
import { AD_PHYS, AD_SEDU, AT_BITE, AT_CLAW, AT_KICK, AT_TUCH, AT_WEAP } from '../js/monster_attack_types.js';
import { DAGGER, GOLD_PIECE, LEATHER_ARMOR } from '../js/object_data.js';
import { races } from '../js/roles.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills, installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function defender() {
    const monster = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    monster.mpeaceful = 0;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    return monster;
}

async function topline(): Promise<string> {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('exceptional Strength accuracy improves at 18/50 and 18/100', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await defender();
    for (const [strength, expected] of [
        [STR18(49), 20], [STR18(50), 21], [STR18(100), 22],
    ] satisfies [number, number][]) {
        game.u.acurr.a[A_STR] = strength;
        const accuracy = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true });
        assert.equal(accuracy.threshold, expected, `Accuracy at Strength ${strength}`);
    }
});

void test('a monster body uses adjusted form accuracy and its species level', async () => {
    freshObjectRoom({ hero: { ulevel: 8, uz: { dnum: 0, dlevel: 8 } } });
    requirePlayingGame(game);
    const target = await defender();
    installPolymorphedHero('minotaur');
    game.u.acurr.a[A_STR] = 3;
    game.u.acurr.a[A_DEX] = 3;
    const weakAttributes = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true });
    game.u.acurr.a[A_STR] = 125;
    game.u.acurr.a[A_DEX] = 25;
    const strongAttributes = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });

    assert.equal(weakAttributes.threshold, 37);
    assert.equal(strongAttributes.threshold, 37);
});

void test('worn monster armor and accumulated target disabilities affect accuracy', async () => {
    freshObjectRoom();
    const target = await defender();
    const bare = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true });
    await equipMonsterObject(target, await knownObject(LEATHER_ARMOR, { spe: 2 }), W_ARM);
    const armored = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });
    target.mstun = 1;
    target.mflee = 1;
    target.msleeping = 1;
    target.mcanmove = 0;
    const helpless = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });

    assert.equal(armored.threshold, bare.threshold - 4);
    assert.equal(helpless.threshold, armored.threshold + 10);
});

void test('Monk armor penalty and empty-hand bonus end when the hero changes form', async () => {
    freshObjectRoom({ role: 'monk' });
    const target = await defender();
    const unarmored = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true });
    wearHeroArmor(await addInventoryObject(LEATHER_ARMOR));
    const armored = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });
    installPolymorphedHero('minotaur');
    const changed = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });

    assert.equal(unarmored.threshold - armored.threshold, 24);
    assert.equal(armored.armorPenalty, 20);
    assert.equal(changed.armorPenalty, 0);
    assert.equal(changed.threshold, 37);
});

void test('elven accuracy against orcs follows the current body when polymorphed', async () => {
    const elf = races.find(race => race.name === 'elf');
    assert.ok(elf);
    freshObjectRoom({ race: elf });
    const target = await defender();
    assert.equal((await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true })).threshold, 20);
    installPolymorphedHero('minotaur');
    assert.equal((await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false })).threshold, 37);
    installPolymorphedHero('Woodland-elf');
    const orcAccuracy = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });
    const human = await createMonsterAt('human', 12, 10, NO_MINVENT);
    human.msleeping = 0;
    const humanAccuracy = await findHeroMeleeHitThreshold(human, AT_BITE, null, { firstAttack: false });
    assert.equal(orcAccuracy.threshold, humanAccuracy.threshold + 1);
});

void test('accuracy measures current carrying load and trap restraint', async () => {
    freshObjectRoom();
    const target = await defender();
    const unburdened = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true });
    await addInventoryObject(GOLD_PIECE, { quan: 70000 });
    const burdened = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });
    game.u.utrap = 5;
    const trapped = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });

    assert.equal(burdened.threshold, unburdened.threshold - 1);
    assert.equal(trapped.threshold, burdened.threshold - 3);
});

void test('two-weapon penalties apply to wielded weapons but not natural claws', async () => {
    freshObjectRoom();
    const target = await defender();
    installHeroWeaponSkills({
        [P_DAGGER]: P_SKILLED, [P_TWO_WEAPON_COMBAT]: P_BASIC,
        [P_BARE_HANDED_COMBAT]: P_EXPERT,
    });
    const dagger = await addInventoryObject(DAGGER, { spe: 0 });
    const spare = await addInventoryObject(DAGGER, { spe: 0, blessed: true });
    assert.notEqual(spare, dagger, 'The unwielded comparison needs a separate, unmerged dagger.');
    await setPrimaryWeapon(dagger);
    await setSecondaryWeapon(await addInventoryObject(DAGGER, { spe: 0 }));
    setTwoWeaponCombat(true);
    const wielded = await findHeroMeleeHitThreshold(target, AT_WEAP, dagger, { firstAttack: true });
    const unwielded = await findHeroMeleeHitThreshold(target, AT_WEAP, spare, { firstAttack: false });
    const claw = await findHeroMeleeHitThreshold(target, AT_CLAW, null, { firstAttack: false });
    const bite = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: false });

    assert.equal(unwielded.threshold - wielded.threshold, 9);
    assert.equal(claw.threshold - bite.threshold, 2);
});

void test('martial kicks use barehand skill and riding penalties', async () => {
    freshObjectRoom({ role: 'samurai' });
    const target = await defender();
    installHeroWeaponSkills({ [P_BARE_HANDED_COMBAT]: P_SKILLED, [P_RIDING]: P_UNSKILLED });
    const bite = await findHeroMeleeHitThreshold(target, AT_BITE, null, { firstAttack: true });
    const kick = await findHeroMeleeHitThreshold(target, AT_KICK, null, { firstAttack: false });
    game.u.usteed = await createSaddledSteed('pony', { x: 12, y: 10 });
    const mounted = await findHeroMeleeHitThreshold(target, AT_KICK, null, { firstAttack: false });

    assert.equal(kick.threshold - bite.threshold, 4);
    assert.equal(mounted.threshold, kick.threshold - 2);
});

void test('a lawful Knight is penalized once for attacking a helpless living defender', async () => {
    freshObjectRoom({ role: 'knight', hero: { ualign: { type: 1, record: 10 } } });
    const target = await defender();
    target.msleeping = 1;
    await findHeroMeleeHitThreshold(target, AT_WEAP, null, { firstAttack: true });
    await findHeroMeleeHitThreshold(target, AT_WEAP, null, { firstAttack: false });

    assert.equal(game.u.ualign?.record, 9);
    assert.equal(game.u.ualign?.abuse, 1);
    assert.equal(await topline(), 'You caitiff!');
});

void test('a Samurai loses alignment for attacking a peaceful defender', async () => {
    freshObjectRoom({ role: 'samurai', hero: { ualign: { type: 1, record: 0 } } });
    const target = await defender();
    target.mpeaceful = 1;
    await findHeroMeleeHitThreshold(target, AT_WEAP, null, { firstAttack: true });

    assert.equal(game.u.ualign?.record, -1);
    assert.equal(target.mpeaceful, 1, 'accuracy does not itself anger the defender');
    assert.equal(await topline(), 'You dishonorably attack the innocent!');
});

void test('a defender can recover from paralysis before the melee roll', async () => {
    freshObjectRoom();
    const target = await defender();
    target.mcanmove = 0;
    target.mfrozen = 6;
    maybeUnparalyzeMeleeDefender(target, () => 9);
    assert.equal(target.mfrozen, 6);
    maybeUnparalyzeMeleeDefender(target, () => 0);
    assert.equal(target.mcanmove, 1);
    assert.equal(target.mfrozen, 0);
});

void test('a missed seduction preserves a sleeping target and gives friendly prose', async () => {
    freshObjectRoom();
    installPolymorphedHero('wood nymph');
    game.flags.female = true;
    const target = await defender();
    target.female = false;
    target.msleeping = 1;
    await showHeroMeleeMiss(target, [AT_TUCH, AD_SEDU, 0, 0], false);

    assert.equal(target.msleeping, 1);
    assert.equal(await topline(), 'You pretend to be friendly to the goblin.');
});

void test('a miss reports cumbersome armor and uses a pronoun when verbose is disabled', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    const target = await defender();
    target.msleeping = 1;
    let feedback = '';
    await showHeroMeleeMiss(target, [AT_WEAP, AD_PHYS, 1, 6], true, {
        publish: message => { feedback += `${message}\n`; },
    });

    assert.match(feedback, /Your armor is rather cumbersome\.\.\./);
    assert.match(feedback, /You miss it\./);
    assert.doesNotMatch(feedback, /goblin/);
});
