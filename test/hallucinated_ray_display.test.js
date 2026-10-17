import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { monsterName } from '../js/monster_name.js';
import { castNativeRay } from '../js/ray_attack.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT;
void test('each hallucinated ray hit uses the next perceived monster identity', async () => {
    freshObjectRoom({
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
    const messages = [];
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
    freshObjectRoom({ flags: { verbose: true }, hero: { hallucinationTurns: 20 } });
    const rider = await createMonsterAt('Death', 11, 10, MONSTER_FLAGS);
    rider.mhp = rider.mhpmax = 100;
    initRng(7n);
    const messages = [];
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
void test('a one-eyed hero sees a Rider reintegrate before one eye', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    installPolymorphedHero('Cyclops');
    const rider = await createMonsterAt('Death', 11, 10, MONSTER_FLAGS);
    rider.mhp = rider.mhpmax = 100;
    const messages = [];
    await castNativeRay(24, 1, 'l', {
        random: limit => limit === 20 ? 19 : 1, rollOne: () => 1,
        publish: message => { messages.push(message); },
    });
    assert.equal(messages[2], "Death's body reintegrates before your eye!");
    assert.equal(rider.mhp, 100);
});
//# sourceMappingURL=hallucinated_ray_display.test.js.map