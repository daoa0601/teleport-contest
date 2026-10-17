import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_WIS, FIRE_TRAP, MAGIC_TRAP, NO_MINVENT, W_AMUL, W_ARM, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap, } from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterArmor } from '../js/monworn.js';
import { monsterName } from '../js/monster_name.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, LEATHER_ARMOR, OBJECT_NAMES, POT_HEALING, POT_OIL, RED_DRAGON_SCALE_MAIL, SCR_IDENTIFY, TOWEL, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { objectTypeKnown } from '../js/shk.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { addTrap, floorObjects, floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function freshMonsterFireTrap({ trapType = FIRE_TRAP, visible = true, species = 'little dog', hitPoints = 20, maxHitPoints = hitPoints, ...monsterState } = {}) {
    const result = await freshMonsterTrapRoom(trapType, {
        monster: {
            species,
            hitPoints,
            maxHitPoints,
            mpeaceful: 1,
            ...monsterState,
        },
    });
    requirePlayingGame(game);
    if (!visible)
        await makeBlinded(1, { talk: false });
    return result;
}
function quietFireRandom(range) {
    return range === 5 ? 1 : 0;
}
void test('a visible fire trap names the monster standing in its flames', async () => {
    const { monster } = await freshMonsterFireTrap({ species: 'minotaur', hitPoints: 100 });
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(messages[0], 'A tower of flame erupts from the floor under the minotaur!');
});
void test('a fire trap burns a vulnerable monster', async () => {
    const { monster, trap } = await freshMonsterFireTrap();
    requirePlayingGame(game);
    const messages = [];
    initRng(29n);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async (message) => messages.push(message),
    });
    assert.ok(monster.mhp < 20);
    assert.ok(monster.mhpmax <= 20);
    assert.equal(trap.tseen, true);
    assert.match(messages[0] ?? '', /tower of flame/);
});
void test('a hallucinating hero sees an imaginary owner when a fire trap burns monster armor', async () => {
    const { monster } = await freshMonsterFireTrap({ species: 'goblin' });
    requirePlayingGame(game);
    setMonsterGivenName(monster, 'ArmorControl');
    const armor = await knownObject(LEATHER_ARMOR, { oeroded: 0 });
    await equipMonsterObject(monster, armor, W_ARM);
    game.u.hallucinationTurns = 20;
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    initRng(1n);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async (message) => { messages.push(message); },
    });
    const burnMessage = messages.find(message => message.endsWith('leather armor smoulders!'));
    assert.ok(burnMessage, 'The trap must describe the burning leather armor');
    assert.doesNotMatch(burnMessage, /ArmorControl|goblin/);
    assert.equal(armor.oeroded, 1);
});
void test('armor that silently resists a fire trap does not change later hallucinated descriptions', async () => {
    async function describeAfterFireTrap(wearArmor) {
        const { monster } = await freshMonsterFireTrap({ species: 'goblin' });
        requirePlayingGame(game);
        const armor = wearArmor ? await knownObject(OBJECT_NAMES.indexOf('plate mail')) : null;
        if (armor)
            await equipMonsterObject(monster, armor, W_ARM);
        game.u.hallucinationTurns = 20;
        const action = await triggerImmediateMonsterTrap(monster, game, { rollDice: () => 2 });
        initRng(1n);
        const messages = [];
        await resumeDeferredMonsterTrap(action, game, {
            random: quietFireRandom,
            publish: message => { messages.push(message); },
        });
        return { messages, nextDescription: monsterName(monster), erosion: armor?.oeroded ?? 0 };
    }
    const unarmored = await describeAfterFireTrap(false);
    const armored = await describeAfterFireTrap(true);
    assert.equal(armored.messages.length, 1);
    assert.equal(armored.messages[0], unarmored.messages[0]);
    assert.equal(armored.erosion, 0);
    assert.equal(armored.nextDescription, unarmored.nextDescription);
});
void test('worn fire resistance stops the flame but not an exploding potion', async () => {
    const { monster } = await freshMonsterFireTrap({ species: 'soldier' });
    requirePlayingGame(game);
    const potion = await knownObject(POT_OIL, {});
    const towel = await knownObject(TOWEL, { spe: 2 });
    const armor = await knownObject(RED_DRAGON_SCALE_MAIL);
    await addObjectToMonsterInventory(monster, potion, game);
    await addObjectToMonsterInventory(monster, towel, game);
    await addObjectToMonsterInventory(monster, armor, game);
    await initializeMonsterArmor(monster);
    const messages = [];
    let fiveSidedRolls = 0;
    const random = (range) => {
        if (range !== 5)
            return 0;
        return fiveSidedRolls++ === 0 ? 1 : 0;
    };
    initRng(31n);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random,
        rollOne: () => 2,
        publish: async (message) => messages.push(message),
    });
    assert.equal(monster.mhp, 18);
    assert.equal(potion.where, 'gone');
    assert.equal(towel.spe, 0);
    assert.ok(messages.some(message => message.endsWith('is uninjured.')));
    assert.ok(messages.some(message => message.includes('explodes!')));
});
void test('a fire trap completely burns a paper golem', async () => {
    const { monster } = await freshMonsterFireTrap({
        species: 'paper golem',
    });
    requirePlayingGame(game);
    initRng(37n);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async () => { },
    });
    assert.equal(monster.dead, true);
    assert.equal(monsterAtPosition(game.level, monster.mx, monster.my), null);
    assert.equal(floorObjects(game.level).some(object => object.otyp === CORPSE), false);
});
void test('a life-saving amulet lets a monster survive a fire trap', async () => {
    const { monster } = await freshMonsterFireTrap({
        visible: false,
        hitPoints: 1,
        maxHitPoints: 1,
    });
    requirePlayingGame(game);
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING, {
        owornmask: W_AMUL,
    });
    await addObjectToMonsterInventory(monster, amulet, game);
    initRng(41n);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async () => { },
    });
    assert.equal(monster.dead, false);
    assert.ok(monster.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.deepEqual(game.level.monsters, [monster]);
});
void test('a fire trap burns scrolls lying under the monster', async () => {
    const { monster } = await freshMonsterFireTrap();
    requirePlayingGame(game);
    const scroll = await floorObject(SCR_IDENTIFY, 11, 10);
    initRng(43n);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: (range) => range === 5 ? 1 : range === 100 ? 99 : 0,
        publish: async () => { },
    });
    assert.equal(scroll.where, 'gone');
    assert.deepEqual(floorObjectsAt(game.level, 11, 10), []);
});
void test('an unseen monster fire trap identifies floor oil and credits Wisdom after a carried potion explodes', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('fire giant', 11, 10, NO_MINVENT);
    monster.mhp = monster.mhpmax = 20;
    addTrap(game.level, FIRE_TRAP, 11, 10);
    await makeBlinded(1, { talk: false });
    const carriedPotion = await knownObject(POT_HEALING);
    await addObjectToMonsterInventory(monster, carriedPotion, game);
    const oil = await floorObject(POT_OIL, 11, 10, { dknown: false, typeKnown: false });
    game.u.acurr.a[A_WIS] = 3;
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game, { rollDice: () => 4 });
    initRng(1n);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        rollOne: () => 3,
        publish: message => { messages.push(message); },
    });
    assert.equal(carriedPotion.where, 'gone');
    assert.equal(monster.mhp, 17);
    assert.equal(oil.lamplit, true);
    assert.equal(objectTypeKnown(oil), true);
    assert.equal(oil.dknown, false);
    assert.equal(game.u._exercise?.[A_WIS], 1, 'identifying oil by ignition must exercise Wisdom');
    assert.equal(messages.length, 0);
});
void test('a magic trap can produce the complete fire-trap effect', async () => {
    const { monster, trap } = await freshMonsterFireTrap({
        trapType: MAGIC_TRAP,
    });
    requirePlayingGame(game);
    initRng(17n);
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async () => { },
    });
    assert.ok(monster.mhp < 20);
    assert.equal(trap.tseen, true);
});
//# sourceMappingURL=monster_fire_trap.test.js.map