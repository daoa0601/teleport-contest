import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitHeroWithObject } from '../js/hero_object_hit.js';
import { AD_ACID } from '../js/monster_attack_types.js';
import { seenResistanceForDamage } from '../js/monster_perception.js';
import { throwMonsterProjectile } from '../js/monster_throw.js';
import { ACID_VENOM } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('acid venom which burns the hero clears an observer’s stale acid resistance knowledge', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const observer = await createMonsterAt('soldier', 12, 10);
    const resistance = seenResistanceForDamage(AD_ACID);
    observer.seen_resistance = resistance;
    const venom = await knownObject(ACID_VENOM);
    const hp = game.u.uhp;
    const messages: string[] = [];

    await hitHeroWithObject(venom, 6, 20, { rollOne: () => 1, publish: async message => messages.push(message) });

    assert.equal(game.u.uhp, hp - 6);
    assert.ok(messages.includes('It burns!'));
    assert.equal((observer.seen_resistance ?? 0) & resistance, 0);
});

void test('acid resistance prevents venom damage and teaches observing monsters', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('acidResistance', 'outside');
    const observer = await createMonsterAt('soldier', 12, 10);
    const venom = await knownObject(ACID_VENOM);
    const hp = game.u.uhp;

    await hitHeroWithObject(venom, 6, 20, { rollOne: () => 1, publish: async () => {} });

    assert.equal(game.u.uhp, hp);
    assert.ok((observer.seen_resistance ?? 0) & seenResistanceForDamage(AD_ACID));
});

void test('acid venom cannot hurt an acid-resistant monster in its flight path', async () => {
    freshObjectRoom();
    const source = await createMonsterAt('soldier', 14, 10);
    const target = await createMonsterAt('ochre jelly', 12, 10);
    const hp = target.mhp;
    const venom = await knownObject(ACID_VENOM);

    const shot = await throwMonsterProjectile(source, venom, {
        dx: -1, dy: 0, range: 4, target, archer: source,
        rollOne: () => 1, publish: async () => {},
    });

    assert.equal(shot.hit, true);
    assert.equal(target.mhp, hp);
    assert.equal(venom.where, 'gone');
});
