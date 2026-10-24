import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, IRONBARS, M_ATTK_MISS, MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOTAIL, MM_NOWAIT, NEED_WEAPON, NO_MINVENT, NO_WEAPON_WANTED, STONE, W_AMUL, W_WEP, } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { resolveMonsterCombatThrow } from '../js/monster_combat_throw.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { monsterVolleyCount, readyRangedMonsterWeapon, throwMonsterProjectile, throwMonsterWeaponAtMonster } from '../js/monster_throw.js';
import { selectMonsterRangedWeapon } from '../js/monster_weapon.js';
import { AMULET_OF_LIFE_SAVING, ARROW, BOULDER, BOW, CREAM_PIE, DAGGER, DART, EGG, ELVEN_ARROW, ELVEN_BOW, OBJECT_NAMES, POT_ACID, POT_CONFUSION, SLING, STATUE, YA, YUMI } from '../js/object_data.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { uninitializedObject, untimedCorpse } from './support/game-objects.js';
import { floorObjectQuantityAt, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';
import { installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
const SILVER_DAGGER = OBJECT_NAMES.indexOf('silver dagger');
async function combatant(species, { x = 9, y = 10, hitPoints, tame = false, inventory = [], } = {}) {
    const monster = await createMonsterAt(species, x, y, TEST_MONSTER_FLAGS);
    if (tame)
        initializePet(monster, { state: game });
    if (hitPoints !== undefined)
        monster.mhp = monster.mhpmax = hitPoints;
    for (const object of inventory)
        await addObjectToMonsterInventory(monster, object, game);
    return monster;
}
function projectileRoom() {
    const level = freshRangedCombatRoom({ gameplaySeed: 37n, recalculateVision: true });
    requirePlayingGame(game);
    game.context.mon_moving = true;
    installPagerInput(resetInputState(), {
        expected: /shoot|throw|hit|miss|stone|poison|sear|blind|reconstitut|medallion|looks much better|kill|destroy|Splat|snap|Clonk|clang|moves|wield|slowing down|eats a lizard corpse|seems limber/,
        limit: 30,
    });
    return level;
}
const ordinaryChoices = (bound) => Math.min(1, bound - 1);
const minimumRoll = () => 1;
void test('a monster throwing a nonpetrifying egg reports the invalid attack without hitting the hero', async () => {
    projectileRoom();
    requirePlayingGame(game);
    const source = await combatant('orc', { x: 15, y: 12 });
    const species = MONSTER_NAME.indexOf('red dragon');
    const egg = await uninitializedObject(EGG, { corpsenm: species });
    await addObjectToMonsterInventory(source, egg);
    game.u.confused = true;
    const health = game.u.uhp;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };
    const shot = await throwMonsterProjectile(source, egg, {
        state: game, dx: 1, dy: 0, range: 3,
        random: ordinaryChoices, rollOne: minimumRoll,
    });
    messages.push(game._pending_message);
    assert.ok(messages.some(message => message.includes(`monster throwing egg type ${species}`)), `Expected the invalid egg diagnostic; received: ${messages.join(' | ')}`);
    assert.equal(shot.hit, false);
    assert.equal(game.u.uhp, health);
    assert.equal(egg.where, 'floor');
});
void test('a monster-thrown acid potion wakes sleeping monsters near a shrieking victim', async () => {
    projectileRoom();
    requirePlayingGame(game);
    const source = await combatant('orc');
    const target = await combatant('orc', { x: 12, hitPoints: 30 });
    const sleeper = await combatant('orc', { x: 12, y: 11 });
    sleeper.msleeping = 1;
    const potion = await uninitializedObject(POT_ACID);
    await addObjectToMonsterInventory(source, potion);
    const messages = [];
    await throwMonsterProjectile(source, potion, {
        state: game, dx: 1, dy: 0, range: 3, target,
        random: ordinaryChoices, rollOne: minimumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(target.mhp < 30);
    assert.equal(sleeper.msleeping, 0);
    assert.match(messages.join('\n'), /shrieks in pain![\s\S]*wakes up\./);
    assert.equal(source.minvent.includes(potion), false);
});
void test('a monster-thrown acid potion destroys its victim without crediting the hero', async () => {
    projectileRoom();
    requirePlayingGame(game);
    const source = await combatant('goblin');
    const target = await combatant('kobold zombie', { x: 12, hitPoints: 1 });
    const potion = await uninitializedObject(POT_ACID);
    await addObjectToMonsterInventory(source, potion);
    const experience = game.u.uexp;
    const messages = [];
    await throwMonsterProjectile(source, potion, {
        state: game, dx: 1, dy: 0, range: 3, target,
        random: ordinaryChoices, rollOne: minimumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(target.mhp <= 0);
    assert.match(messages.join('\n'), /shrieks in pain!\nThe kobold zombie is destroyed!/);
    assert.equal(game.u.uexp, experience);
});
for (const adjacent of [true, false]) {
    void test(`monster-thrown potion vapor ${adjacent ? 'can reach an adjacent hero' : 'cannot reach a distant hero'}`, async () => {
        projectileRoom();
        requirePlayingGame(game);
        const source = await combatant('orc');
        const target = await combatant('orc', { x: 12, hitPoints: 30 });
        game.u.ux = adjacent ? 12 : 18;
        game.u.uy = 11;
        game.u.acurr.a[A_DEX] = 3;
        game.u.confusionTurns = 0;
        vision_recalc(0);
        installPagerInput(resetInputState(), {
            expected: /crashes on|evaporates|You feel somewhat dizzy/,
            limit: 24,
        });
        // Exposure is a Dexterity roll. Give the nearby hero several real
        // chances without pinning the test to one random draw.
        const attempts = adjacent ? 8 : 1;
        for (let attempt = 0; attempt < attempts && !game.u.confusionTurns; attempt++) {
            const potion = await uninitializedObject(POT_CONFUSION);
            await addObjectToMonsterInventory(source, potion);
            const shot = await throwMonsterProjectile(source, potion, {
                state: game, dx: 1, dy: 0, range: 3, target,
                random: ordinaryChoices, rollOne: minimumRoll,
            });
            assert.equal(shot.hit, true);
            assert.equal(potion.where, 'gone');
            assert.equal(source.minvent.includes(potion), false);
        }
        assert.equal(game.u.confusionTurns > 0, adjacent);
        assert.equal(game._thrownObject, null);
    });
}
void test('a monster readies the launcher required by its ammunition', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const bow = await uninitializedObject(BOW);
    const arrows = await uninitializedObject(ARROW, { quan: 6 });
    const archer = await combatant('orc', {
        x: 10,
        inventory: [arrows, bow],
    });
    archer.weaponCheck = NEED_WEAPON;
    const readied = await readyRangedMonsterWeapon(archer);
    assert.equal(readied, true);
    assert.equal(archer.mw, bow);
    assert.equal(bow.wielded, true);
    assert.equal(selectMonsterRangedWeapon(archer)?.weapon, arrows);
});
void test('trying to ready a bow spends the attack when the current weapon is welded', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const arrows = await uninitializedObject(ARROW, { quan: 6 });
    const orc = await combatant('orc', { inventory: [arrows, await uninitializedObject(BOW)] });
    const dagger = await equipMonsterObject(orc, await uninitializedObject(DAGGER, { cursed: true }), W_WEP);
    orc.weaponCheck = NEED_WEAPON;
    const target = await combatant('lichen', { x: 12 });
    const health = target.mhp;
    pushKeys('  ');
    const attack = await throwMonsterWeaponAtMonster(orc, target, game);
    assert.equal(attack?.spentWielding, true);
    assert.equal(orc.mw?.o_id, dagger.o_id);
    assert.equal(arrows.quan, 6);
    assert.equal(target.mhp, health);
});
void test('a monster can shoot ya from an ordinary bow', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const arrows = await uninitializedObject(YA, { quan: 6 });
    const orc = await combatant('orc', { inventory: [arrows] });
    await equipMonsterObject(orc, await uninitializedObject(BOW), W_WEP);
    orc.weaponCheck = NEED_WEAPON;
    const target = await combatant('lichen', { x: 12 });
    const attack = await throwMonsterWeaponAtMonster(orc, target, game);
    assert.ok(attack && 'shots' in attack);
    assert.equal(attack?.launched, true);
    assert.ok(arrows.quan < 6);
});
void test('a monster prefers a yumi to a more recently acquired ordinary bow', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const orc = await combatant('orc', {
        inventory: [await uninitializedObject(ARROW), await uninitializedObject(YUMI), await uninitializedObject(BOW)],
    });
    const selection = selectMonsterRangedWeapon(orc);
    assert.equal(selection?.weapon.otyp, ARROW);
    assert.equal(selection?.launcher?.otyp, YUMI);
});
void test('a monster keeps its welded dagger but can throw a spare one', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const orc = await combatant('orc');
    const held = await equipMonsterObject(orc, await uninitializedObject(DAGGER, { cursed: true }), W_WEP);
    orc.weaponCheck = NO_WEAPON_WANTED;
    assert.equal(selectMonsterRangedWeapon(orc), null);
    const spare = await addObjectToMonsterInventory(orc, await uninitializedObject(DAGGER));
    assert.ok(spare);
    assert.equal(selectMonsterRangedWeapon(orc)?.weapon.o_id, spare.o_id);
    assert.equal(orc.mw?.o_id, held.o_id);
});
void test('Kops choose pies and giants choose boulders before ordinary missiles', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const kop = await combatant('Keystone Kop', {
        inventory: [await uninitializedObject(CREAM_PIE), await uninitializedObject(DAGGER)],
    });
    const giant = await combatant('giant', {
        x: 10,
        inventory: [await uninitializedObject(BOULDER), await uninitializedObject(DAGGER)],
    });
    assert.equal(selectMonsterRangedWeapon(kop)?.weapon.otyp, CREAM_PIE);
    assert.equal(selectMonsterRangedWeapon(giant)?.weapon.otyp, BOULDER);
});
void test('a monster that does not collect gems uses one in its sling before throwing darts', async () => {
    freshRangedCombatRoom();
    requirePlayingGame(game);
    const gem = await uninitializedObject(OBJECT_NAMES.indexOf('emerald'));
    const soldier = await combatant('soldier', {
        inventory: [gem, await uninitializedObject(SLING), await uninitializedObject(DART)],
    });
    const selection = selectMonsterRangedWeapon(soldier);
    assert.equal(selection?.weapon.o_id, gem.o_id);
    assert.equal(selection?.launcher?.otyp, SLING);
});
void test('a completed throw detaches, damages, and lands one dagger before returning', async () => {
    const level = projectileRoom();
    const dagger = await uninitializedObject(DAGGER, { quan: 3 });
    const source = await combatant('orc', { inventory: [dagger] });
    const target = await combatant('lichen', { x: 12, hitPoints: 30 });
    const volley = await throwMonsterWeaponAtMonster(source, target, game, { random: ordinaryChoices, rollOne: minimumRoll });
    assert.ok(volley?.madeAttack);
    assert.equal(volley.heroDied, false);
    assert.equal(dagger.quan, 2);
    assert.ok(target.mhp < 30);
    assert.equal(floorObjectQuantityAt(level, 12, 10, DAGGER), 1);
    assert.equal(game._thrownObject, null);
});
void test('spending the slot to ready a launcher is a native miss without a projectile', async () => {
    projectileRoom();
    const arrows = await uninitializedObject(ARROW, { quan: 4 });
    const bow = await uninitializedObject(BOW);
    const source = await combatant('orc', { inventory: [arrows, bow] });
    source.weaponCheck = NEED_WEAPON;
    const target = await combatant('lichen', { x: 12, hitPoints: 30 });
    const result = await resolveMonsterCombatThrow(source, target, { state: game });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(source.mw, bow);
    assert.equal(arrows.quan, 4);
    assert.equal(target.mhp, 30);
});
void test('a monster cannot shoot another monster through intervening stone', async () => {
    const level = projectileRoom();
    const dagger = await uninitializedObject(DAGGER, { quan: 3 });
    const source = await combatant('orc', { inventory: [dagger] });
    const target = await combatant('lichen', { x: 12, hitPoints: 30 });
    level.requireAt(11, 10).typ = STONE;
    vision_note_blocker_change(11, 10);
    vision_recalc(0);
    const result = await resolveMonsterCombatThrow(source, target, { state: game });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(target.mhp, 30);
    assert.equal(dagger.quan, 3);
});
void test('polearms are not applied against monster targets', async () => {
    projectileRoom();
    const source = await combatant('soldier');
    await equipMonsterObject(source, await uninitializedObject(OBJECT_NAMES.indexOf('halberd')), W_WEP);
    source.weaponCheck = NO_WEAPON_WANTED;
    const target = await combatant('lichen', { x: 12 });
    const health = target.mhp;
    const result = await resolveMonsterCombatThrow(source, target, { state: game });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(target.mhp, health);
});
void test('launcher range prevents distant shots even along a clear diagonal', async () => {
    projectileRoom();
    const arrows = await uninitializedObject(ARROW, { quan: 4 });
    const source = await combatant('orc', { x: 8, y: 6, inventory: [arrows] });
    await equipMonsterObject(source, await uninitializedObject(BOW), W_WEP);
    source.weaponCheck = NO_WEAPON_WANTED;
    const target = await combatant('lichen', { x: 13, y: 11 });
    const result = await resolveMonsterCombatThrow(source, target, { state: game });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(arrows.quan, 4);
});
void test('a fleeing target can make its pursuer withhold the throw', async () => {
    projectileRoom();
    const daggers = await uninitializedObject(DAGGER, { quan: 3 });
    const source = await combatant('orc', { inventory: [daggers] });
    const target = await combatant('lichen', { x: 12 });
    target.mflee = 1;
    const result = await resolveMonsterCombatThrow(source, target, { state: game, random: ordinaryChoices });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(daggers.quan, 3);
});
void test('a poisoned dart harms susceptible targets but resistance prevents its extra damage', async () => {
    const losses = [];
    for (const species of ['lichen', 'green dragon']) {
        projectileRoom();
        const source = await combatant('orc');
        const target = await combatant(species, { x: 12, hitPoints: 50 });
        const dart = await uninitializedObject(DART, { opoisoned: 1 });
        await throwMonsterProjectile(source, dart, {
            state: game, dx: 1, dy: 0, range: 3, target,
            random: ordinaryChoices, rollOne: minimumRoll,
        });
        losses.push(50 - target.mhp);
    }
    const [poisoned, resistant] = losses;
    assert.ok(poisoned !== undefined && resistant !== undefined);
    assert.equal(poisoned, resistant + 1);
});
void test('deadly projectile poison resolves actual death without hero kill credit during a monster turn', async () => {
    projectileRoom();
    const source = await combatant('orc');
    const target = await combatant('lichen', { x: 12, hitPoints: 50 });
    const dart = await uninitializedObject(DART, { opoisoned: 1 });
    const shot = await throwMonsterProjectile(source, dart, {
        state: game, dx: 1, dy: 0, range: 3, target, rollOne: minimumRoll,
        random: bound => bound === 30 ? 0 : ordinaryChoices(bound),
    });
    assert.equal(shot.targetDied, true);
    assert.equal(target.dead, true);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});
void test('silver missiles deal their silver damage and show searing feedback', async () => {
    projectileRoom();
    const source = await combatant('orc');
    const target = await combatant('vampire', { x: 12, hitPoints: 80 });
    const dagger = await uninitializedObject(SILVER_DAGGER);
    const messages = [];
    await throwMonsterProjectile(source, dagger, {
        state: game, dx: 1, dy: 0, range: 3, target, rollOne: minimumRoll,
        random: ordinaryChoices, publish: message => { messages.push(message); },
    });
    assert.ok(target.mhp <= 78);
    assert.ok(messages.some(message => /silver sears/.test(message)));
});
void test('a cream pie blinds its real monster target without removing HP', async () => {
    projectileRoom();
    const source = await combatant('Keystone Kop');
    const target = await combatant('orc', { x: 12, hitPoints: 30 });
    const pie = await uninitializedObject(CREAM_PIE);
    await throwMonsterProjectile(source, pie, {
        state: game, dx: 1, dy: 0, range: 3, target, random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.equal(target.mhp, 30);
    assert.equal(target.mcansee, 0);
    assert.equal(target.mblinded, 21);
    assert.equal(pie.where, 'gone');
});
void test('a petrifying egg turns an intervening monster into a statue during flight', async () => {
    const level = projectileRoom();
    const source = await combatant('orc');
    const blocker = await combatant('orc', { x: 11, hitPoints: 30 });
    const target = await combatant('lichen', { x: 13, hitPoints: 30 });
    const egg = await uninitializedObject(EGG, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    await throwMonsterProjectile(source, egg, {
        state: game, dx: 1, dy: 0, range: 4, target, random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.equal(blocker.dead, true);
    assert.equal(target.mhp, 30);
    assert.ok(floorObjectsAt(level, 11, 10).some(object => object.otyp === STATUE));
    assert.equal(egg.where, 'gone');
});
void test('a defender consumes its lizard cure before a petrifying egg can make a statue', async () => {
    const level = projectileRoom();
    const source = await combatant('orc');
    const target = await combatant('orc', { x: 12, hitPoints: 30 });
    const cure = await untimedCorpse(MONSTER_NAME.indexOf('lizard'));
    await addObjectToMonsterInventory(target, cure);
    const egg = await uninitializedObject(EGG, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    await throwMonsterProjectile(source, egg, {
        state: game, dx: 1, dy: 0, range: 3, target, random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.equal(cure.where, 'gone');
    assert.ok(target.mhp > 0);
    assert.equal(floorObjectsAt(level, 12, 10).some(object => object.otyp === STATUE), false);
});
void test('a missed intervening monster does not stop a missile aimed at a later monster', async () => {
    projectileRoom();
    const source = await combatant('orc');
    source.m_lev = 30;
    const blocker = await combatant('arch-lich', { x: 11, hitPoints: 100 });
    const target = await combatant('lichen', { x: 13, hitPoints: 100 });
    const dagger = await uninitializedObject(DAGGER);
    const shot = await throwMonsterProjectile(source, dagger, {
        state: game, dx: 1, dy: 0, range: 4, target, archer: source,
        random: ordinaryChoices, rollOne: sides => sides,
    });
    assert.equal(blocker.mhp, 100);
    assert.ok(target.mhp < 100);
    assert.equal(shot.target, target);
    assert.equal(dagger.ox, 13);
});
void test('worm-tail collision uses its occupied square for hit context and landing', async () => {
    const level = projectileRoom();
    const source = await combatant('orc');
    const worm = await createMonsterAt('long worm', 13, 11, NO_MINVENT | MM_NOTAIL);
    initializeMonsterWormBody(worm, { segmentCount: 0 });
    assertWormBody(worm);
    worm.wormSegments = [{ x: 12, y: 10 }];
    worm.mhp = worm.mhpmax = 30;
    const dagger = await uninitializedObject(DAGGER);
    await throwMonsterProjectile(source, dagger, {
        state: game, dx: 1, dy: 0, range: 4, target: worm, random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.ok(worm.mhp < 30);
    assert.equal(game.notonhead, true);
    assert.deepEqual(game.bhitpos, { x: 12, y: 10 });
    assert.ok(floorObjectsAt(level, 12, 10).includes(dagger));
});
void test('a monster-targeted shot can strike the hero standing in its path', async () => {
    projectileRoom();
    requirePlayingGame(game);
    game.u.ux = 11;
    game.u.uy = 10;
    const source = await combatant('orc');
    const target = await combatant('lichen', { x: 13, hitPoints: 30 });
    const health = game.u.uhp;
    const dagger = await uninitializedObject(DAGGER);
    const shot = await throwMonsterProjectile(source, dagger, {
        state: game, dx: 1, dy: 0, range: 4, target, random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.equal(shot.heroTarget, true);
    assert.ok(game.u.uhp < health);
    assert.equal(target.mhp, 30);
});
void test('a cursed throw can land at its source when it slips with no remaining direction', async () => {
    const level = projectileRoom();
    const source = await combatant('orc');
    const dagger = await uninitializedObject(DAGGER, { cursed: true });
    await throwMonsterProjectile(source, dagger, {
        state: game, dx: 1, dy: 0, range: 4,
        random: bound => bound === 7 ? 0 : ordinaryChoices(bound),
    });
    assert.ok(floorObjectsAt(level, source.mx, source.my).includes(dagger));
    assert.equal(game._thrownObject, null);
});
void test('a large projectile stops before iron bars', async () => {
    const level = projectileRoom();
    level.requireAt(10, 10).typ = IRONBARS;
    const source = await combatant('giant');
    const boulder = await uninitializedObject(BOULDER);
    await throwMonsterProjectile(source, boulder, {
        state: game, dx: 1, dy: 0, range: 4, random: ordinaryChoices,
    });
    assert.ok(floorObjectsAt(level, 9, 10).includes(boulder));
});
void test('a rogue completes its multishot volley even after the intended target dies', async () => {
    const level = projectileRoom();
    const daggers = await uninitializedObject(DAGGER, { quan: 4 });
    const source = await combatant('rogue', { inventory: [daggers] });
    const target = await combatant('lichen', { x: 12, hitPoints: 1 });
    const volley = await throwMonsterWeaponAtMonster(source, target, game, {
        random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.ok(volley?.madeAttack);
    assert.equal(volley.volley, 2);
    assert.equal(volley.shots.length, 2);
    assert.equal(target.dead, true);
    assert.equal(daggers.quan, 2);
    assert.equal(floorObjectQuantityAt(level, 12, 10, DAGGER), 2);
});
void test('life saving completes before the next missile in a volley arrives', async () => {
    projectileRoom();
    const daggers = await uninitializedObject(DAGGER, { quan: 4 });
    const source = await combatant('rogue', { inventory: [daggers] });
    const target = await combatant('orc', { x: 12, hitPoints: 1 });
    target.mhpmax = 30;
    const amulet = await equipMonsterObject(target, await uninitializedObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const volley = await throwMonsterWeaponAtMonster(source, target, game, { random: ordinaryChoices, rollOne: minimumRoll });
    assert.ok(volley?.madeAttack);
    assert.equal(volley.shots.length, 2);
    assert.equal(amulet.where, 'gone');
    assert.ok(target.mhp > 0 && target.mhp < target.mhpmax);
    assert.equal(volley.shots[0]?.targetDied, false);
});
void test('native multishot accounts for elven equipment and launcher enchantment', async () => {
    projectileRoom();
    const source = await combatant('elf-lord');
    const arrows = await uninitializedObject(ELVEN_ARROW, { quan: 8 });
    const bow = await uninitializedObject(ELVEN_BOW, { spe: 5 });
    const count = monsterVolleyCount(source, arrows, bow, sides => sides);
    assert.equal(count, 7);
});
// C mthrowu.c:thitu() -> losehp(): You("die...") flushes the lethal HP to
// the status line before tty pages the hit message.
void test('a fatal missile hit shows zero HP while its hit message waits', async () => {
    projectileRoom();
    requirePlayingGame(game);
    game.flags.debug = true;
    game.u.ux = 11;
    game.u.uy = 10;
    game.u.uhp = 1;
    game.u.uhpmax = 12;
    const source = await combatant('orc');
    const dagger = await uninitializedObject(DAGGER);
    const input = resetInputState();
    const hitScreens = [];
    input.display = {
        async readKey() {
            const rows = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join(''));
            if (rows[0]?.includes('Die?'))
                return 'n'.charCodeAt(0);
            if (rows[0]?.includes('You are hit by'))
                hitScreens.push(rows.join('\n'));
            return ' '.charCodeAt(0);
        },
    };
    await throwMonsterProjectile(source, dagger, {
        state: game, dx: 1, dy: 0, range: 4, target: null, random: ordinaryChoices, rollOne: minimumRoll,
    });
    assert.equal(hitScreens.length, 1);
    assert.match(hitScreens[0] ?? '', /--More--/);
    assert.match(hitScreens[0] ?? '', /HP:0\(12\)/);
});
for (const [species, unseen] of [['gnome lord', 'someone'], ['jackal', 'something']]) {
    void test(`a monster throwing at an unseen ${species} names it ${unseen}`, async () => {
        projectileRoom();
        requirePlayingGame(game);
        const source = await combatant('goblin', { inventory: [await uninitializedObject(DAGGER)] });
        const target = await combatant(species, { x: 12, hitPoints: 30 });
        target.minvis = true;
        const messages = [];
        await throwMonsterWeaponAtMonster(source, target, game, {
            random: ordinaryChoices, rollOne: minimumRoll,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(messages[0], `The goblin throws a dagger at ${unseen}!`);
    });
}
//# sourceMappingURL=monster_throw.test.js.map