import test from 'node:test';
import assert from 'node:assert/strict';
import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, STONE, W_WEP } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { DAGGER } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
const maximumRoll = (sides) => sides;
for (const injuredHitPoints of [5, 18]) {
    void test(`a monster wielding Stormbringer heals from ${injuredHitPoints} HP without healing the hero`, async () => {
        freshObjectRoom({ hero: { uhp: 3, uhpmax: 20 } });
        requirePlayingGame(game);
        const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
        const defender = await createMonsterAt('pony', 12, 10, TEST_MONSTER_FLAGS);
        attacker.mhp = injuredHitPoints;
        attacker.mhpmax = 20;
        defender.mhp = defender.mhpmax = 30;
        const oldLevel = defender.m_lev;
        const weapon = await equipMonsterObject(attacker, await artifactObject('Stormbringer', { dknown: false }), W_WEP);
        const hit = await applyArtifactHitToMonster(weapon, defender, 4, {
            attacker, state: game, random: () => 1, rollOne: maximumRoll,
        });
        assert.equal(hit.damage, 14);
        assert.equal(defender.m_lev, oldLevel - 1);
        assert.equal(defender.mhpmax, 22);
        assert.equal(attacker.mhp, Math.min(20, injuredHitPoints + 4));
        assert.equal(attacker.mhpmax, 20);
        assert.equal(game.u.uhp, 3);
        assert.equal(weapon.dknown, true, 'Seeing life drain reveals the carried artifact');
    });
}
void test('monster Stormbringer drains a level-zero defender fatally and heals its attacker', async () => {
    freshObjectRoom({ hero: { uhp: 3, uhpmax: 20 } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    attacker.mhp = 1;
    attacker.mhpmax = 20;
    defender.mhp = defender.mhpmax = 4;
    defender.m_lev = 0;
    const hit = await applyArtifactHitToMonster(await artifactObject('Stormbringer'), defender, 4, {
        attacker, state: game, random: () => 1, rollOne: maximumRoll,
    });
    assert.equal(hit.damage, 9);
    assert.equal(defender.m_lev, 0);
    assert.equal(defender.mhpmax, 4);
    assert.equal(attacker.mhp, 3);
    assert.equal(game.u.uhp, 3);
});
void test('a blind hero receives no artifact feedback or healing from two monsters fighting', async () => {
    freshObjectRoom({ hero: { uhp: 3, uhpmax: 20 } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('pony', 12, 10, TEST_MONSTER_FLAGS);
    attacker.mhp = 1;
    attacker.mhpmax = 20;
    defender.mhp = defender.mhpmax = 30;
    game.u.ustuck = defender;
    await makeBlinded(10, { talk: false });
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Stormbringer'), defender, 4, {
        attacker, state: game, random: () => 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.specialMessage, false);
    assert.equal(attacker.mhp, 5);
    assert.equal(game.u.uhp, 3);
    assert.equal(messages.length, 0);
});
void test('artifact feedback is visible when only the monster attacker square can be seen', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('pony', 14, 10, TEST_MONSTER_FLAGS);
    for (let y = 6; y <= 14; y++) {
        level.requireAt(13, y).typ = STONE;
        vision_note_blocker_change(13, y);
    }
    vision_recalc(0);
    assert.equal(cansee(attacker.mx, attacker.my), true);
    assert.equal(cansee(defender.mx, defender.my), false);
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Fire Brand'), defender, 4, {
        attacker, state: game, random: () => 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.specialMessage, true);
    assert.match(messages[0] ?? '', /The fiery blade burns it!/);
});
void test('a monster cannot make a blind hero feel Fire Brand by attacking the hero-held defender', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('pony', 12, 10, TEST_MONSTER_FLAGS);
    game.u.ustuck = defender;
    await makeBlinded(10, { talk: false });
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Fire Brand'), defender, 4, {
        attacker, state: game, random: () => 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.specialMessage, false);
    assert.ok((hit.damage ?? 0) > 4);
    assert.equal(messages.length, 0);
});
void test('the Tsurugi names the monster wielder when cutting a large defender deeply', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('mumak', 12, 10, TEST_MONSTER_FLAGS);
    defender.mhp = defender.mhpmax = 100;
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('The Tsurugi of Muramasa'), defender, 4, {
        attacker, state: game, dieRoll: 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 24);
    assert.equal(hit.specialMessage, true);
    assert.equal(messages[0], 'The orc cuts deeply into the mumak!');
});
void test('a monster using the Tsurugi cannot slice the hero swallower from inside', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('purple worm', 11, 10, TEST_MONSTER_FLAGS);
    defender.mhp = defender.mhpmax = 100;
    installSwallowedHero(defender);
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('The Tsurugi of Muramasa'), defender, 4, {
        attacker, state: game, dieRoll: 1, visible: false, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 24);
    assert.equal(hit.specialMessage, true, 'Native deep cuts suppress ordinary hit feedback even unseen');
    assert.equal(messages.length, 0);
});
for (const visible of [false, true]) {
    void test(`Vorpal Blade's headless miss has ${visible ? 'visible monster' : 'no unseen'} feedback`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
        const defender = await createMonsterAt('gas spore', 12, 10, TEST_MONSTER_FLAGS);
        const messages = [];
        const hit = await applyArtifactHitToMonster(await artifactObject('Vorpal Blade'), defender, 4, {
            attacker, state: game, dieRoll: 1, visible, rollOne: maximumRoll,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(hit.damage, 0);
        assert.equal(hit.attackStopped, true);
        assert.equal(hit.specialMessage, visible);
        if (visible)
            assert.equal(messages[0], 'Somehow, the orc misses wildly.');
        else
            assert.equal(messages.length, 0);
    });
}
void test('Vorpal Blade cannot behead another monster while the hero is swallowed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('jackal', 13, 10, TEST_MONSTER_FLAGS);
    const swallower = await createMonsterAt('purple worm', 11, 10, TEST_MONSTER_FLAGS);
    installSwallowedHero(swallower);
    const hit = await applyArtifactHitToMonster(await artifactObject('Vorpal Blade'), defender, 4, {
        attacker, state: game, dieRoll: 1, visible: false, rollOne: maximumRoll,
    });
    assert.equal(hit.damage, 0);
    assert.equal(hit.specialMessage, false);
});
void test('a monster using Magicbane cancels spellcasting without giving energy to the hero', async () => {
    freshObjectRoom({ hero: { uen: 2, uenmax: 3, uenpeak: 3 } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('gnomish wizard', 12, 10, TEST_MONSTER_FLAGS);
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Magicbane', { spe: 0 }), defender, 4, {
        attacker, state: game, dieRoll: 1, random: range => range - 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 24);
    assert.equal(defender.mcan, 1);
    assert.equal(game.u.uen, 2);
    assert.equal(game.u.uenmax, 3);
    assert.equal(game.u.uenpeak, 3);
    assert.match(messages[0] ?? '', /cancels the gnomish wizard/);
    assert.ok(messages.every(message => !message.includes('absorb magical energy')));
});
void test('unseen monster Magicbane hits stun and confuse without revealing their effects', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    await makeBlinded(10, { talk: false });
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Magicbane', { spe: 0 }), defender, 4, {
        attacker, state: game, dieRoll: 6,
        random: range => range === 12 ? 0 : range - 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(defender.mstun, 1);
    assert.equal(defender.mconf, 1);
    assert.equal(hit.specialMessage, false);
    assert.equal(messages.length, 0);
});
void test('a monster Magicbane probe marks an invisible target without disclosing its inventory', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    defender.minvis = 1;
    const dagger = await uninitializedObject(DAGGER, { dknown: false, bknown: false });
    await addObjectToMonsterInventory(defender, dagger);
    assert.equal(canSeeMonster(defender), false);
    const messages = [];
    const hit = await applyArtifactHitToMonster(await artifactObject('Magicbane', { spe: 0 }), defender, 4, {
        attacker, state: game, dieRoll: 8, random: () => 0, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.specialMessage, true);
    assert.equal(level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(dagger.dknown, false);
    assert.ok(messages.every(message => !/insightful|Status of/.test(message)));
});
void test('the hero Magicbane probe reveals the actual monster inventory in its window', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const defender = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    const dagger = await uninitializedObject(DAGGER, { dknown: false, bknown: false });
    await addObjectToMonsterInventory(defender, dagger);
    const input = resetInputState();
    const messages = [];
    const weapon = await artifactObject('Magicbane', { spe: 0 });
    const hit = await answerPrompts(applyArtifactHitToMonster(weapon, defender, 4, {
        state: game, dieRoll: 8, random: () => 0, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    }), input, [
        { prompt: /jackal's possessions:[\s\S]*dagger[\s\S]*\(end\)/, keys: ' ' },
    ]);
    assert.equal(hit.specialMessage, true);
    assert.equal(dagger.dknown, true);
    assert.ok(messages.some(message => message === 'The probe is insightful.'));
    assert.ok(messages.some(message => message.startsWith('Status of the jackal')));
});
void test('Magicbane names a cancelled shapechanger in its restored form for later feedback', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt('wolf', 12, 10, TEST_MONSTER_FLAGS);
    defender.cham = MONSTER_NAME.indexOf('vampire');
    const messages = [];
    await applyArtifactHitToMonster(await artifactObject('Magicbane', { spe: 0 }), defender, 4, {
        attacker, state: game, dieRoll: 1,
        random: range => range === 12 ? 0 : range - 1, rollOne: maximumRoll,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(defender.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(defender.mcan, 1);
    assert.equal(defender.mconf, 1);
    assert.equal(messages[0], 'The magic-absorbing blade cancels the wolf!');
    assert.ok(messages.includes('The vampire is confused.'));
});
//# sourceMappingURL=monster_artifact_hit.test.js.map