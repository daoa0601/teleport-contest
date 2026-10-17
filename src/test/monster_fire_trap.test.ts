import type { TrapMonsterOptions } from './support/monster-traps.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FIRE_TRAP, MAGIC_TRAP, W_AMUL, W_ARM,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterArmor } from '../js/monworn.js';
import { monsterName } from '../js/monster_name.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import {
    AMULET_OF_LIFE_SAVING, CORPSE, LEATHER_ARMOR, OBJECT_NAMES, POT_OIL, RED_DRAGON_SCALE_MAIL,
    SCR_IDENTIFY, TOWEL,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { equipMonsterObject } from './support/monsters.js';

async function freshMonsterFireTrap({
    trapType = FIRE_TRAP,
    visible = true,
    species = 'little dog',
    hitPoints = 20,
    maxHitPoints = hitPoints,
    ...monsterState
}: TrapMonsterOptions & { trapType?: number; visible?: boolean } = {}) {
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
    if (!visible) await makeBlinded(1, { talk: false });
    return result;
}

function quietFireRandom(range: number) {
    return range === 5 ? 1 : 0;
}

void test('a visible fire trap names the monster standing in its flames', async () => {
    const { monster } = await freshMonsterFireTrap({ species: 'minotaur', hitPoints: 100 });
    requirePlayingGame(game);
    const messages: string[] = [];
    const action = await triggerImmediateMonsterTrap(monster, game);

    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async message => { messages.push(message); },
    });

    assert.equal(messages[0], 'A tower of flame erupts from the floor under the minotaur!');
});

void test('a fire trap burns a vulnerable monster', async () => {
    const { monster, trap } = await freshMonsterFireTrap();
    requirePlayingGame(game);
    const messages: string[] = [];
    initRng(29n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async (message: string) => messages.push(message),
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
    const messages: string[] = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    initRng(1n);

    await resumeDeferredMonsterTrap(action, game, {
        random: quietFireRandom,
        publish: async message => { messages.push(message); },
    });

    const burnMessage = messages.find(message => message.endsWith('leather armor smoulders!'));
    assert.ok(burnMessage, 'The trap must describe the burning leather armor');
    assert.doesNotMatch(burnMessage, /ArmorControl|goblin/);
    assert.equal(armor.oeroded, 1);
});

void test('armor that silently resists a fire trap does not change later hallucinated descriptions', async () => {
    async function describeAfterFireTrap(wearArmor: boolean) {
        const { monster } = await freshMonsterFireTrap({ species: 'goblin' });
        requirePlayingGame(game);
        const armor = wearArmor ? await knownObject(OBJECT_NAMES.indexOf('plate mail')) : null;
        if (armor) await equipMonsterObject(monster, armor, W_ARM);
        game.u.hallucinationTurns = 20;
        const action = await triggerImmediateMonsterTrap(monster, game, { rollDice: () => 2 });
        initRng(1n);
        const messages: string[] = [];

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

void test('worn fire resistance stops the flame but not an exploding potion',
    async () => {
        const { monster } = await freshMonsterFireTrap({ species: 'soldier' });
        requirePlayingGame(game);
        const potion = await knownObject(POT_OIL, {});
        const towel = await knownObject(TOWEL, { spe: 2 });
        const armor = await knownObject(RED_DRAGON_SCALE_MAIL);
        await addObjectToMonsterInventory(monster, potion, game);
        await addObjectToMonsterInventory(monster, towel, game);
        await addObjectToMonsterInventory(monster, armor, game);
        await initializeMonsterArmor(monster);
        const messages: string[] = [];
        let fiveSidedRolls = 0;
        const random = (range: number) => {
            if (range !== 5) return 0;
            return fiveSidedRolls++ === 0 ? 1 : 0;
        };
        initRng(31n);

        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            random,
            rollOne: () => 2,
            publish: async (message: string) => messages.push(message),
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
        publish: async () => {},
    });

    assert.equal(monster.dead, true);
    assert.deepEqual(game.level.monsters, []);
    assert.equal(
        floorObjects(game.level).some(object => object.otyp === CORPSE),
        false,
    );
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
        publish: async () => {},
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
        random: (range: number) => range === 5 ? 1 : range === 100 ? 99 : 0,
        publish: async () => {},
    });

    assert.equal(scroll.where, 'gone');
    assert.deepEqual(floorObjectsAt(game.level, 11, 10), []);
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
        publish: async () => {},
    });
    assert.ok(monster.mhp < 20);
    assert.equal(trap.tseen, true);
});
