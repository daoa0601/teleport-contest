import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { monsterName } from '../js/do_name.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { castNativeRay } from '../js/ray_attack.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
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
    await freshObjectRoom({ flags: { verbose: true }, hero: { hallucinationTurns: 20 } });
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
// C zap.c dobuzz()/disintegrate_mon(): one flash_str() draw names the ray
// for the whole disintegration; the life-saving hit() message reuses that
// same name instead of drawing again.
void test('a life-saved disintegration victim is named by one blast draw', async () => {
    await freshObjectRoom({
        right: 30, flags: { verbose: true }, hero: { hallucinationTurns: 20 },
    });
    const breather = await createMonsterAt('black dragon', 8, 7, MONSTER_FLAGS);
    const victim = await createMonsterAt('orc', 12, 7, MONSTER_FLAGS);
    await equipMonsterObject(victim, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    await createMonsterAt('silver dragon', 14, 7, MONSTER_FLAGS);
    pushKeys(' '.repeat(40));
    let blastDraws = 0;
    const messages = [];
    await castNativeRay(-24, 6, 'l', {
        state: game, sourceMonster: breather, originX: 8, originY: 7,
        publish: message => { messages.push(message); },
        random: limit => {
            if (limit === 96)
                return Math.min(blastDraws++, 2);
            if (limit === 20)
                return 19;
            return 1;
        },
    });
    // The amulet message spends the single draw ("asteroids"); the silver
    // dragon's reflection line, drawn second, names "beads".
    assert.ok(messages.some(message => /^The blast of asteroids hits /.test(message)), messages.join(' | '));
    assert.ok(messages.some(message => /^The blast of beads hits /.test(message)), messages.join(' | '));
    assert.equal(messages.some(message => /^The blast of bubbles (hits|misses) /.test(message)), false, messages.join(' | '));
});
void test("a hero's own disintegration hit spends the blast name the mirror then shows", async () => {
    await freshObjectRoom({
        right: 30, flags: { verbose: true }, hero: { hallucinationTurns: 20 },
    });
    const victim = await createMonsterAt('orc', 12, 10, MONSTER_FLAGS);
    await createMonsterAt('silver dragon', 14, 10, MONSTER_FLAGS);
    let blastDraws = 0;
    const messages = [];
    await castNativeRay(24, 6, 'l', {
        state: game,
        publish: message => { messages.push(message); },
        random: limit => {
            if (limit === 96)
                return blastDraws++ === 0 ? 0 : 1;
            if (limit === 20)
                return 19;
            return 1;
        },
    });
    assert.ok((victim.mhp ?? 0) <= 0, 'the ray disintegrates the orc');
    assert.ok(messages.some(message => / is disintegrated!$/.test(message)), messages.join(' | '));
    // The unused blast drawn for the disintegration consumes "asteroids",
    // so the silver dragon's reflection line names "beads".
    assert.ok(messages.some(message => /^The blast of beads (hits|misses) /.test(message)), messages.join(' | '));
    assert.equal(messages.some(message => message.startsWith('The blast of asteroids')), false, messages.join(' | '));
});
void test('a one-eyed hero sees a Rider reintegrate before one eye', async () => {
    await freshObjectRoom({ flags: { verbose: true } });
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