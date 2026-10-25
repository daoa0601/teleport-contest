import test from 'node:test';
import assert from 'node:assert/strict';

import { applyArtifactHit } from '../js/artifact_hit.js';
import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const maximumRoll = (range: number) => range;
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;

// C artifact.c Mb_hit(): the stun effect stuns the defender without confusing
// it when the confusion roll fails, and each of the four d4 damage rolls
// (spec_dbon, probe, stun, and none further) lands at full value.
void test('Magicbane stuns a visible monster without confusing it', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    jackal.mhp = jackal.mhpmax = 30;
    const messages: string[] = [];

    const hit = await applyArtifactHit(await artifactObject('Magicbane'), jackal, 4, {
        state: game,
        dieRoll: 8,
        describeTarget: () => 'the jackal',
        publish: async message => { messages.push(message); },
        random: range => {
            if (range === 100) return 100; // magic-resistance probe passes
            if (range === 11) return 10;   // 0 < 10 selects the stun effect
            return 1;                      // 1-in-12 confusion roll fails
        },
        rollOne: maximumRoll,
    });

    assert.equal(hit.damage, 16);
    assert.equal(jackal.mstun, 1);
    assert.equal(jackal.mconf, undefined);
    assert.equal(messages[0], 'The magic-absorbing blade stuns the jackal!');
    assert.equal(messages.length, 1, 'A non-confused stun prints no status sentence');
});

// C artifact.c Mb_hit(): a scare that the target resists prints the resist
// feedback with a shield effect instead of making it flee, and the retained
// stun and confusion produce the combined status sentence.
void test('Magicbane reports a resisted scare with the retained stun and confusion', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const archon = await createMonsterAt('archon', 12, 10, TEST_MONSTER_FLAGS);
    archon.mhp = archon.mhpmax = 88;
    const messages: string[] = [];

    const hit = await applyArtifactHit(await artifactObject('Magicbane'), archon, 4, {
        state: game,
        dieRoll: 4,
        describeTarget: () => 'the Archon',
        publish: async message => { messages.push(message); },
        random: range => {
            if (range === 100) return 100; // magic-resistance probe passes
            if (range === 2) return 1;     // attempt the resistance check
            if (range === 11) return 11;   // stun is selected alongside scare
            return 0;                      // resistance succeeds; confusion lands
        },
        rollOne: maximumRoll,
    });

    assert.ok('damage' in hit);
    assert.notEqual(archon.mflee, 1);
    assert.equal(archon.mstun, 1);
    assert.equal(archon.mconf, 1);
    assert.deepEqual(messages, [
        'The magic-absorbing blade scares the Archon!',
        'The Archon resists!',
        'The Archon is stunned and confused!',
    ]);
});

// C artifact.c Mb_hit(): an enchanted Magicbane still probes insightfully when
// its 3*abs(spe) roll comes up; the probing verb names the current form.
void test('Magicbane probes insightfully at +1 enchantment', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    jackal.mhp = jackal.mhpmax = 30;
    const messages: string[] = [];

    const hit = await applyArtifactHit(
        await artifactObject('Magicbane', { spe: 1 }),
        jackal,
        4,
        {
            state: game,
            dieRoll: 8,
            describeTarget: () => 'the jackal',
            publish: async message => { messages.push(message); },
            random: range => {
                if (range === 100) return 100; // magic-resistance probe passes
                if (range === 11) return 1;    // 1 < 1 rejects the stun effect
                if (range === 3) return 0;     // 1-in-3 insight roll succeeds
                return 1;                      // confusion roll fails
            },
            rollOne: maximumRoll,
        },
    );

    assert.ok('damage' in hit);
    assert.equal(hit.damage, 12);
    assert.equal(messages[0], 'The magic-absorbing blade probes the jackal!');
    assert.equal(messages[1], 'The probe is insightful.');
    assert.ok(messages.some(message => message.startsWith('Status of the jackal')));
});

// C artifact.c artifact_hit(): Vorpal Blade's beheading of a male hallucinating
// hero adds the "Good job Henry, but that wasn't Anne." aside.
void test('a hallucinating male hero mocks a Vorpal beheading with the Henry line', async () => {
    freshObjectRoom({ flags: { female: false } });
    requirePlayingGame(game);
    await makeHallucinated(20, { talk: false });
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    jackal.mhp = jackal.mhpmax = 20;
    const messages: string[] = [];

    const hit = await applyArtifactHit(await artifactObject('Vorpal Blade'), jackal, 4, {
        state: game,
        dieRoll: 1,
        describeTarget: () => 'the jackal',
        publish: async message => { messages.push(message); },
        random: () => 0,
        rollOne: maximumRoll,
    });

    assert.ok('damage' in hit);
    assert.equal(hit.damage, 2 * 20 + 200);
    assert.deepEqual(messages, [
        'Vorpal Blade beheads the jackal!',
        "Good job Henry, but that wasn't Anne.",
    ]);
});

// C artifact.c artifact_hit(): Vorpal Blade cuts through a noncorporeal
// monster's neck without the fatal beheading damage.
void test('Vorpal Blade slices through a ghost without beheading it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ghost = await createMonsterAt('ghost', 12, 10, TEST_MONSTER_FLAGS);
    ghost.mhp = ghost.mhpmax = 30;
    const messages: string[] = [];

    const hit = await applyArtifactHit(await artifactObject('Vorpal Blade'), ghost, 5, {
        state: game,
        dieRoll: 1,
        describeTarget: () => 'the ghost',
        publish: async message => { messages.push(message); },
        random: () => 0,
        rollOne: maximumRoll,
    });

    assert.ok('damage' in hit);
    assert.equal(hit.damage, 5 + 1);
    assert.deepEqual(messages, ['Vorpal Blade slices through the ghost\'s neck.']);
});

// C artifact.c arti_invoke(): invoking a property-conferring artifact during
// its cooldown is refused, unsets the property, and extends the cooldown by
// 3d10 turns without charging power.
void test('invoking the Heart of Ahriman during its cooldown extends the wait', async () => {
    freshObjectRoom({ role: 'barbarian', hero: { uen: 50, uenmax: 50 } });
    requirePlayingGame(game);
    const heart = await artifactObject('The Heart of Ahriman', {
        invlet: 'a', where: 'inventory', age: 1000,
    });
    game.inventory = [heart];

    const invocation = await invokeArtifactPower(heart, artifactByName('The Heart of Ahriman'), {
        state: game, publish: async () => {}, rollDice: () => 16,
    });

    assert.deepEqual(invocation, { used: true, ready: false, on: false });
    assert.equal(heart.age, 1000 + 3 + 3 + 10);
    assert.equal(game.u.uen, 50);
});
