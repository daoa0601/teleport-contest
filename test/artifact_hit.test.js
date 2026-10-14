import test from 'node:test';
import assert from 'node:assert/strict';
import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import { hitMonsterWithHeroObject } from '../js/hero_physical_hit.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { OIL_LAMP, SCR_IDENTIFY } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { artifactObject, knownObject, uninitializedObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const maximumRoll = (range) => range;
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
void test('Fire Brand can burn a monster inventory and add its damage', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const scroll = await uninitializedObject(SCR_IDENTIFY);
    const monster = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    await addObjectToMonsterInventory(monster, scroll, game);
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Fire Brand'), monster, 4, {
        state: game,
        describeTarget: () => 'the jackal',
        publish: async (message) => {
            messages.push(message);
        },
        random: () => 0,
        rollOne: maximumRoll,
    });
    assert.ok('damage' in hit);
    assert.equal(hit.damage, 9);
    assert.equal(monster.inventory.length, 0);
    assert.match(messages[0] ?? '', /fiery blade burns the jackal/);
});
void test('Mjollnir wakes monsters near a target struck by lightning', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    const sleeper = await createMonsterAt('lichen', 13, 10, TEST_MONSTER_FLAGS);
    sleeper.msleeping = 1;
    const hit = await applyArtifactHitToMonster(await artifactObject('Mjollnir'), target, 4, {
        state: game,
        publish: async () => { },
        random: () => 1,
        rollOne: maximumRoll,
    });
    assert.ok('damage' in hit);
    assert.equal(hit.damage, 28);
    assert.equal(sleeper.msleeping, 0);
});
void test('Stormbringer drains a monster level and heals its wielder', async () => {
    freshObjectRoom({ hero: { uhp: 5, uhpmax: 12 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('pony', 12, 10, TEST_MONSTER_FLAGS);
    monster.mhp = monster.mhpmax = 20;
    const levelBefore = monster.m_lev;
    const hit = await applyArtifactHitToMonster(await artifactObject('Stormbringer'), monster, 4, {
        state: game,
        describeTarget: () => 'the pony',
        publish: async () => { },
        random: () => 1,
        rollOne: maximumRoll,
    });
    assert.ok('damage' in hit);
    assert.equal(hit.damage, 14);
    assert.equal(monster.m_lev, levelBefore - 1);
    assert.equal(monster.mhpmax, 12);
    assert.equal(game.u.uhp, 9);
});
void test('Magicbane cancels a spellcaster and absorbs its magic', async () => {
    freshObjectRoom({
        hero: { uen: 2, uenmax: 3, uenpeak: 3 },
    });
    requirePlayingGame(game);
    const monster = await createMonsterAt('gnomish wizard', 12, 10, TEST_MONSTER_FLAGS);
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Magicbane', { spe: 0 }), monster, 4, {
        state: game,
        dieRoll: 1,
        describeTarget: () => 'the gnomish wizard',
        publish: async (message) => {
            messages.push(message);
        },
        random: (range) => range - 1,
        rollOne: maximumRoll,
    });
    assert.ok('damage' in hit);
    assert.equal(hit.damage, 24);
    assert.equal(monster.mcan, 1);
    assert.equal(game.u.uen, 3);
    assert.equal(game.u.uenmax, 4);
    assert.equal(game.u.uenpeak, 4);
    assert.match(messages[0] ?? '', /cancels the gnomish wizard/);
    assert.match(messages[1] ?? '', /absorb magical energy/);
});
void test('Magicbane scares a surviving monster for three turns', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    monster.mhp = monster.mhpmax = 30;
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Magicbane', { spe: 0 }), monster, 4, {
        state: game,
        dieRoll: 3,
        describeTarget: () => 'the jackal',
        publish: async (message) => {
            messages.push(message);
        },
        random: (range) => range - 1,
        rollOne: maximumRoll,
    });
    assert.ok('damage' in hit);
    assert.equal(hit.damage, 20);
    assert.equal(monster.mflee, 1);
    assert.equal(monster.mfleetim, 3);
    assert.equal(monster.mstun, undefined);
    assert.match(messages[0] ?? '', /scares the jackal/);
});
void test('the Tsurugi bisects small monsters and cuts deeply into large ones', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const weapon = await artifactObject('The Tsurugi of Muramasa');
    const messages = [];
    const jackal = await createMonsterAt('jackal', 11, 10, TEST_MONSTER_FLAGS);
    jackal.mhp = jackal.mhpmax = 20;
    const mumak = await createMonsterAt('mumak', 12, 10, TEST_MONSTER_FLAGS);
    mumak.mhp = mumak.mhpmax = 20;
    const smallHit = await applyArtifactHitToMonster(weapon, jackal, 4, {
        state: game,
        dieRoll: 1,
        describeTarget: () => 'the jackal',
        publish: async (message) => {
            messages.push(message);
        },
        rollOne: maximumRoll,
    });
    const largeHit = await applyArtifactHitToMonster(weapon, mumak, 4, {
        state: game,
        dieRoll: 1,
        describeTarget: () => 'the mumak',
        publish: async (message) => {
            messages.push(message);
        },
        rollOne: maximumRoll,
    });
    assert.equal(smallHit.damage, 240);
    assert.equal(largeHit.damage, 24);
    assert.match(messages[0] ?? '', /cuts the jackal in half/);
    assert.match(messages[1] ?? '', /slice deeply into the mumak/);
});
void test('Vorpal Blade misses a headless creature and beheads a jabberwock', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const weapon = await artifactObject('Vorpal Blade');
    const messages = [];
    const gasSpore = await createMonsterAt('gas spore', 11, 10, TEST_MONSTER_FLAGS);
    gasSpore.mhp = gasSpore.mhpmax = 20;
    const headless = await applyArtifactHitToMonster(weapon, gasSpore, 4, {
        state: game,
        dieRoll: 1,
        describeTarget: () => 'the gas spore',
        publish: async (message) => {
            messages.push(message);
        },
        rollOne: maximumRoll,
    });
    const jabberwockTarget = await createMonsterAt('jabberwock', 12, 10, TEST_MONSTER_FLAGS);
    jabberwockTarget.mhp = jabberwockTarget.mhpmax = 20;
    const jabberwock = await applyArtifactHitToMonster(weapon, jabberwockTarget, 4, {
        state: game,
        dieRoll: 10,
        describeTarget: () => 'the jabberwock',
        publish: async (message) => {
            messages.push(message);
        },
        random: () => 0,
        rollOne: maximumRoll,
    });
    assert.equal(headless.damage, 0);
    assert.equal(headless.attackStopped, true);
    assert.equal(jabberwock.damage, 240);
    assert.match(messages[0] ?? '', /miss the gas spore wildly/);
    assert.match(messages[1] ?? '', /beheads the jabberwock/);
});
for (const swallowed of [false, true]) {
    void test(`a blind hero feels Fire Brand strike ${swallowed ? 'the swallowing monster' : 'a held monster'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('purple worm', 11, 10, TEST_MONSTER_FLAGS);
        monster.mhp = monster.mhpmax = 500;
        if (swallowed)
            installSwallowedHero(monster);
        else
            game.u.ustuck = monster;
        await makeBlinded(20, { talk: false });
        const weapon = await addInventoryItem(await artifactObject('Fire Brand'));
        await setPrimaryWeapon(weapon);
        const messages = [];
        initRng(71n);
        const hit = await hitMonsterWithHeroObject(monster, weapon, {
            mode: 'melee', dieRoll: 10, publish: async (message) => { messages.push(message); },
        });
        assert.equal(hit.heroDied, false);
        assert.ok(monster.mhp < 500);
        assert.ok(messages.some(message => /The fiery blade burns .+!/.test(message)));
        assert.equal(messages.some(message => /^You hit /.test(message)), false);
    });
}
for (const blind of [false, true]) {
    void test(`Stormbringer ${blind ? 'silently drains' : 'announces its drain against'} the hero's swallower`, async () => {
        freshObjectRoom({ hero: { uhp: 5, uhpmax: 40 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('purple worm', 11, 10, TEST_MONSTER_FLAGS);
        monster.mhp = monster.mhpmax = 500;
        const level = monster.m_lev;
        installSwallowedHero(monster);
        if (blind)
            await makeBlinded(20, { talk: false });
        const weapon = await addInventoryItem(await artifactObject('Stormbringer'));
        await setPrimaryWeapon(weapon);
        const messages = [];
        initRng(71n);
        await hitMonsterWithHeroObject(monster, weapon, {
            mode: 'melee', dieRoll: 10, publish: async (message) => { messages.push(message); },
        });
        assert.equal(monster.m_lev, level - 1);
        assert.ok(game.u.uhp > 5);
        assert.equal(messages.some(message => /draws the life from/.test(message)), !blind);
    });
}
void test('felt elemental damage does not reveal a blind target inventory being destroyed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('purple worm', 11, 10, TEST_MONSTER_FLAGS);
    const scroll = await addObjectToMonsterInventory(monster, await knownObject(SCR_IDENTIFY), game);
    assert.ok(scroll);
    game.u.ustuck = monster;
    await makeBlinded(20, { talk: false });
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Fire Brand'), monster, 20, {
        visible: false, realizesDamage: true, random: () => 0,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.specialMessage, true);
    assert.equal(monster.minvent?.includes(scroll), false);
    assert.ok(messages.some(message => /fiery blade burns/.test(message)));
    assert.equal(messages.some(message => /scroll/.test(message)), false);
});
void test('seeing a swallowed artifact strike does not expose the swallower\'s burning inventory', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('purple worm', 11, 10, TEST_MONSTER_FLAGS);
    const scroll = await addObjectToMonsterInventory(monster, await knownObject(SCR_IDENTIFY), game);
    assert.ok(scroll);
    const lamp = await addObjectToMonsterInventory(monster, await knownObject(OIL_LAMP, { age: 100 }), game);
    assert.ok(lamp);
    installSwallowedHero(monster);
    const messages = [];
    await applyArtifactHitToMonster(await artifactObject('Fire Brand'), monster, 20, {
        visible: true, realizesDamage: true, random: () => 0,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(monster.minvent?.includes(scroll), false);
    assert.equal(lamp.lamplit, true);
    assert.ok(messages.some(message => /fiery blade burns/.test(message)));
    assert.equal(messages.some(message => /scroll|lamp/.test(message)), false);
});
void test('visible fire ignites monster equipment with the carrier ownership', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const lamp = await addObjectToMonsterInventory(monster, await knownObject(OIL_LAMP, { age: 100 }), game);
    assert.ok(lamp);
    const messages = [];
    await applyArtifactHitToMonster(await artifactObject('Fire Brand'), monster, 20, {
        random: () => 0, publish: async (message) => { messages.push(message); },
    });
    assert.equal(lamp.lamplit, true);
    assert.ok(messages.includes("The orc's oil lamp catches light!"));
    assert.equal(messages.some(message => /^Your /.test(message)), false);
});
void test('one hallucinated Magicbane hit keeps the same target identity in its effect feedback', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('gnomish wizard', 11, 10, TEST_MONSTER_FLAGS);
    await makeHallucinated(20, { talk: false });
    const messages = [];
    await applyArtifactHitToMonster(await artifactObject('Magicbane'), monster, 4, {
        dieRoll: 1, random: range => range === 12 ? 0 : range - 1,
        rollOne: maximumRoll, publish: async (message) => { messages.push(message); },
    });
    const first = messages.find(message => message.startsWith('The magic-absorbing blade purges '));
    assert.ok(first, 'Cancellation should describe the hallucinated target.');
    const target = first.slice('The magic-absorbing blade purges '.length, -1);
    const sentenceTarget = target.charAt(0).toUpperCase() + target.slice(1);
    assert.ok(messages.includes(`${sentenceTarget} is confused.`), messages.join('\n'));
    assert.equal(monster.mconf, 1);
});
//# sourceMappingURL=artifact_hit.test.js.map