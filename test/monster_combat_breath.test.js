import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { M_ATTK_HIT, M_ATTK_MISS, MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, W_AMUL, } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { AD_FIRE, AD_RBRE, AD_SLEE, AT_BREA } from '../js/monster_attack_types.js';
import { resolveMonsterCombatBreath } from '../js/monster_combat_breath.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
const maximumDice = (count, sides) => count * sides;
async function breathRoom({ heroOnRay = false, sourceSpecies = 'red dragon' } = {}) {
    const level = freshObjectRoom({
        left: 2, right: 40, top: 2, bottom: 18,
        heroX: heroOnRay ? 12 : 10, heroY: heroOnRay ? 10 : 14,
        flags: { verbose: true, disclose: '-i -a -v -c -o' },
        hero: { uhp: 100, uhpmax: 100, uac: 10 },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
    const source = await createMonsterAt(sourceSpecies, 10, 10, TEST_MONSTER_FLAGS);
    const target = await createMonsterAt('orc', 14, 10, TEST_MONSTER_FLAGS);
    source.mhp = source.mhpmax = 100;
    target.mhp = target.mhpmax = 1000;
    const attack = (MONSTER_ATTACKS[source.mnum] ?? []).find(([method]) => method === AT_BREA);
    assert.ok(attack, `${sourceSpecies} needs a native breath attack`);
    return { source, target, attack, level };
}
void test('monster breath damages the actual target, forces cooldown, and restores the outer ray position', async () => {
    const { source, target, attack } = await breathRoom();
    requirePlayingGame(game);
    game.bhitpos = { x: 7, y: 8 };
    game.notonhead = true;
    game.multi = 7;
    const messages = [];
    const result = await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1, rollDice: maximumDice,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(result.heroDied, false);
    assert.ok(target.mhp < 1000);
    assert.equal(source.mspec_used, 9);
    assert.equal(game.multi, 0);
    assert.equal(game.bhitpos.x, 7);
    assert.equal(game.bhitpos.y, 8);
    assert.equal(game.notonhead, false);
    assert.ok(messages.includes('The red dragon breathes fire!'));
});
void test('a breath miss on the ray still spends the breath cooldown', async () => {
    const { source, target, attack } = await breathRoom();
    requirePlayingGame(game);
    const result = await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: range => range === 20 ? 0 : 1,
        rollOne: sides => sides, rollDice: maximumDice, publish: async () => { },
    });
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(target.mhp, 1000);
    assert.equal(source.mspec_used, 9);
});
void test('an unaligned cancelled breath returns HIT without coughing or interrupting repetition', async () => {
    const { source, attack } = await breathRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('pony', 14, 11, TEST_MONSTER_FLAGS);
    source.mcan = 1;
    game.multi = 7;
    const messages = [];
    const result = await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(messages.length, 0);
    assert.equal(source.mspec_used || 0, 0);
    assert.equal(game.multi, 7);
});
for (const awareness of ['visible', 'invisible', 'deaf']) {
    void test(`a cancelled aligned breather gives ${awareness} cough feedback and returns MISS`, async () => {
        const { source, target, attack } = await breathRoom();
        requirePlayingGame(game);
        source.mcan = 1;
        if (awareness === 'invisible')
            source.minvis = 1;
        if (awareness === 'deaf')
            game.u.deafTurns = 10;
        const messages = [];
        const result = await resolveMonsterCombatBreath(source, target, attack, {
            state: game, random: () => 1, publish: async (message) => { messages.push(message); },
        });
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(target.mhp, 1000);
        if (awareness === 'visible')
            assert.equal(messages[0], 'The red dragon coughs.');
        else if (awareness === 'invisible')
            assert.equal(messages[0], 'You hear a cough.');
        else
            assert.equal(messages.length, 0);
    });
}
for (const cooldown of [0, 4]) {
    void test(`${cooldown ? 'active cooldown' : 'a failed launch chance'} leaves the target and repetition untouched`, async () => {
        const { source, target, attack } = await breathRoom();
        requirePlayingGame(game);
        source.mspec_used = cooldown;
        game.multi = 7;
        const result = await resolveMonsterCombatBreath(source, target, attack, {
            state: game, random: () => 0, publish: async () => { },
        });
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(target.mhp, 1000);
        assert.equal(source.mspec_used, cooldown);
        assert.equal(game.multi, 7);
    });
}
for (const hungryTime of [9, 10, 100]) {
    void test(`a breathing pet with hunger deadline ${hungryTime} pays nutrition only at the native threshold`, async () => {
        const { source, target, attack } = await breathRoom();
        requirePlayingGame(game);
        initializePet(source, { state: game });
        const pet = source.edog;
        assert.ok(pet);
        pet.hungrytime = hungryTime;
        await resolveMonsterCombatBreath(source, target, attack, {
            state: game, random: () => 1, rollOne: () => 1,
            rollDice: maximumDice, publish: async () => { },
        });
        assert.equal(pet.hungrytime, hungryTime >= 10 ? hungryTime - 10 : hungryTime);
        assert.equal(source.mspec_used, 9);
    });
}
void test('a minion breather does not require pet feeding state', async () => {
    const { source, target, attack } = await breathRoom();
    requirePlayingGame(game);
    source.mtame = 10;
    source.mpeaceful = true;
    source.isminion = true;
    source.emin = { min_align: 0, renegade: false };
    source.mextra = { ...source.mextra, emin: source.emin };
    const result = await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1,
        rollDice: maximumDice, publish: async () => { },
    });
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(source.edog, undefined);
    assert.ok(target.mhp < 1000);
});
void test('monster-target breath preserves a hero involuntary delay', async () => {
    const { source, target, attack } = await breathRoom();
    requirePlayingGame(game);
    game.multi = -4;
    game._helplessTurns = 4;
    await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1,
        rollDice: maximumDice, publish: async () => { },
    });
    assert.equal(game.multi, -4);
    assert.equal(game._helplessTurns, 4);
});
void test('hallucination conceals the visible breather and breath description', async () => {
    const { source, target, attack } = await breathRoom();
    requirePlayingGame(game);
    await makeHallucinated(10, { talk: false });
    const messages = [];
    await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1, rollDice: maximumDice,
        publish: async (message) => { messages.push(message); },
    });
    const launch = messages.find(message => message.includes(' breathes '));
    assert.ok(launch);
    assert.doesNotMatch(launch, /red dragon|breathes fire!/);
    assert.ok(target.mhp < 1000);
});
void test('a blind hero gets no breath launch announcement even when monsters are nearby', async () => {
    const { source, target, attack } = await breathRoom();
    requirePlayingGame(game);
    await makeBlinded(10, { talk: false });
    const messages = [];
    await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1, rollDice: maximumDice,
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(messages.every(message => !message.includes(' breathes ')));
    assert.ok(target.mhp < 1000);
});
void test('a random-breath monster uses its selected effect for the real ray', async () => {
    const { source, target, attack } = await breathRoom({ sourceSpecies: 'Chromatic Dragon' });
    requirePlayingGame(game);
    assert.equal(attack[1], AD_RBRE);
    const messages = [];
    await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1, rollDice: maximumDice,
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(messages.some(message => message.includes('breathes fire!')));
    assert.ok(target.mhp < 1000);
    assert.equal(source.mspec_used, 9);
});
void test('sleep breath incapacitates a monster and uses only the monster-target cooldown', async () => {
    const { source, target, attack } = await breathRoom({ sourceSpecies: 'orange dragon' });
    requirePlayingGame(game);
    assert.equal(attack[1], AD_SLEE);
    await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1,
        rollDice: maximumDice, publish: async () => { },
    });
    assert.equal(target.mhp, 1000);
    assert.equal(target.mcanmove, 0);
    assert.ok((target.mfrozen ?? 0) > 0);
    assert.equal(source.mspec_used, 9);
});
void test('a breath kill uses monster death ownership without awarding hero experience', async () => {
    const { source, target, attack, level } = await breathRoom();
    requirePlayingGame(game);
    target.mhp = 1;
    const result = await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1,
        rollDice: maximumDice, publish: async () => { },
    });
    assert.equal(result.nativeResult, M_ATTK_HIT, 'breamm leaves death flags to its caller');
    assert.notEqual(monsterAtPosition(level, target.mx, target.my), target);
    assert.equal(game.u.uconduct.killer || 0, 0);
    assert.equal(game.u.uexp, 0);
});
void test('monster breath awaits the real defender life-saving pages and then spends its cooldown', async () => {
    const { source, target, attack, level } = await breathRoom();
    requirePlayingGame(game);
    target.mhp = 1;
    const amulet = await equipMonsterObject(target, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const input = resetInputState();
    installPagerInput(input, { expected: /orc|But wait|medallion|looks much better/, limit: 8 });
    await resolveMonsterCombatBreath(source, target, attack, {
        state: game, random: () => 1, rollOne: () => 1,
        rollDice: maximumDice, publish: async () => { },
    });
    assert.equal(amulet.where, 'gone');
    assert.ok(target.mhp > 0);
    assert.equal(level.monsters.includes(target), true);
    assert.equal(source.mspec_used, 9);
});
for (const lifeSaving of [false, true]) {
    void test(`a hero caught in monster-target breath ${lifeSaving ? 'life-saves before the target is hit' : 'dies before the ray reaches its target'}`, async () => {
        const { source, target, attack } = await breathRoom({ heroOnRay: true });
        requirePlayingGame(game);
        assert.equal(attack[1], AD_FIRE);
        game.u.uhp = 1;
        const amulet = lifeSaving ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet)
            await wearHeroAccessory(amulet, 'uamul');
        const input = resetInputState();
        installPagerInput(input, {
            expected: /breathes|blast|medallion|amulet|You die|But wait|feel much better|Goodbye|points|REST|PEACE/i,
            limit: 16,
        });
        const result = await resolveMonsterCombatBreath(source, target, attack, {
            state: game, random: () => 1, rollOne: () => 1,
            rollDice: maximumDice, publish: async () => { },
        });
        assert.equal(result.heroDied, !lifeSaving);
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        if (lifeSaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet && !game.inventory.includes(amulet));
            assert.ok(target.mhp < 1000);
            assert.equal(source.mspec_used, 9);
        }
        else {
            assert.equal(target.mhp, 1000);
            assert.equal(source.mspec_used || 0, 0);
        }
    });
}
//# sourceMappingURL=monster_combat_breath.test.js.map