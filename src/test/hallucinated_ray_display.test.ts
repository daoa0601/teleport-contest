import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterName } from '../js/monster_name.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { castNativeRay } from '../js/ray_attack.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';

const MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT;

void test('each hallucinated ray hit uses the next perceived monster identity', async () => {
    await freshObjectRoom({
        right: 30, flags: { verbose: true }, hero: { hallucinationTurns: 20 },
    });
    const first = await createMonsterAt('orc', 11, 10, MONSTER_FLAGS);
    const second = await createMonsterAt('goblin', 13, 10, MONSTER_FLAGS);
    first.mhp = first.mhpmax = 100;
    second.mhp = second.mhpmax = 100;
    initRng(7n);
    const firstIdentity = monsterName(first);
    const secondIdentity = monsterName(second);
    initRng(7n);
    const messages: string[] = [];

    await castNativeRay(0, 1, 'l', {
        random: () => 1, rollOne: () => 1, rollDice: () => 1,
        publish: message => { messages.push(message); },
    });

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.split(' hits ')[1], `${firstIdentity}.`);
    assert.equal(messages[1]?.split(' hits ')[1], `${secondIdentity}.`);
    assert.equal(first.mhp, 99);
    assert.equal(second.mhp, 99);
});

void test('a hallucinated Rider gets a fresh identity in each resurrection message', async () => {
    await freshObjectRoom({ flags: { verbose: true }, hero: { hallucinationTurns: 20 } });
    const rider = await createMonsterAt('Death', 11, 10, MONSTER_FLAGS);
    rider.mhp = rider.mhpmax = 100;
    initRng(7n);
    const messages: string[] = [];

    await castNativeRay(24, 1, 'l', {
        random: limit => limit === 20 ? 19 : 1, rollOne: () => 1,
        publish: message => { messages.push(message); },
    });

    assert.equal(messages.length, 4);
    const disintegrates = messages[1]?.replace(/ disintegrates\.$/, '');
    const reintegrates = messages[2]?.replace(/'s body reintegrates before your eyes!$/, '');
    const resurrects = messages[3]?.replace(/ resurrects!$/, '');
    assert.match(messages[1] ?? '', / disintegrates\.$/);
    assert.match(messages[2] ?? '', / body reintegrates before your eyes!$/);
    assert.match(messages[3] ?? '', / resurrects!$/);
    const identities = [disintegrates, reintegrates, resurrects];
    assert.equal(new Set(identities).size, 3, `Resurrection identities: ${identities.join(', ')}`);
    assert.equal(rider.mhp, 100);
    assert.equal(!!game.program_state.gameover, false);
});

// C zap.c dobuzz(): a disintegration hit always evaluates
// disintegrate_mon()'s flash_str() argument, so a hallucinating hero
// draws one hallucinated blast name before the victim's death message
// and melting gear -- even though neither names the ray.
void test('a disintegrating monster breath draws its hallucinated blast name before the victim melts', async () => {
    await freshObjectRoom({
        right: 30, flags: { verbose: true }, hero: { hallucinationTurns: 20 },
    });
    const breather = await createMonsterAt('black dragon', 8, 7, MONSTER_FLAGS);
    const victim = await createMonsterAt('orc', 12, 7, MONSTER_FLAGS);
    await addObjectToMonsterInventory(victim,
        await knownObject(OBJECT_NAMES.indexOf('food ration')));
    initRng(11n);
    enableRngLog();
    const messages: string[] = [];

    await castNativeRay(-24, 6, 'l', {
        state: game, sourceMonster: breather, originX: 8, originY: 7,
        publish: message => { messages.push(message); },
    });

    const log = getRngLog();
    const toHit = log.findIndex(entry => entry.startsWith('rn2(20)='));
    const blast = log.findIndex(entry => entry.startsWith('rn2(96)='));
    const gearRoll = log.findIndex(entry => entry.startsWith('rn2(100)='));
    assert.ok(toHit >= 0, `the ray rolls to hit: ${log.join(' | ')}`);
    assert.equal(blast, toHit + 1,
        `the disintegrated victim is named before its gear melts: ${log.join(' | ')}`);
    assert.ok(gearRoll > blast, `the food ration rolls after the naming: ${log.join(' | ')}`);
    assert.ok(messages.some(message => / is disintegrated!$/.test(message)),
        messages.join(' | '));
    assert.ok((victim.mhp ?? 0) <= 0);
});

void test("a hero's own disintegration hit still draws the unused hallucinated blast name", async () => {
    await freshObjectRoom({
        right: 30, flags: { verbose: true }, hero: { hallucinationTurns: 20 },
    });
    const victim = await createMonsterAt('orc', 12, 10, MONSTER_FLAGS);
    initRng(23n);
    enableRngLog();
    const messages: string[] = [];

    await castNativeRay(24, 6, 'l', {
        state: game, publish: message => { messages.push(message); },
    });

    const log = getRngLog();
    const toHit = log.findIndex(entry => entry.startsWith('rn2(20)='));
    assert.ok(toHit >= 0, `the ray rolls to hit: ${log.join(' | ')}`);
    assert.equal(log.findIndex(entry => entry.startsWith('rn2(96)=')), toHit + 1,
        `disintegrate_mon() names its ray even when the message does not: ${log.join(' | ')}`);
    assert.ok(messages.some(message => / is disintegrated!$/.test(message)),
        messages.join(' | '));
    assert.ok((victim.mhp ?? 0) <= 0);
});

void test('a one-eyed hero sees a Rider reintegrate before one eye', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
    installPolymorphedHero('Cyclops');
    const rider = await createMonsterAt('Death', 11, 10, MONSTER_FLAGS);
    rider.mhp = rider.mhpmax = 100;
    const messages: string[] = [];

    await castNativeRay(24, 1, 'l', {
        random: limit => limit === 20 ? 19 : 1, rollOne: () => 1,
        publish: message => { messages.push(message); },
    });

    assert.equal(messages[2], "Death's body reintegrates before your eye!");
    assert.equal(rider.mhp, 100);
});
