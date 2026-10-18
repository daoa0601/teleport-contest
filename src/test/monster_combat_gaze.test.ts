import test from 'node:test';
import assert from 'node:assert/strict';

import {
    M_AP_TYPE, M_ATTK_AGR_DIED, M_ATTK_MISS, MM_NOGRP, NO_MINVENT, W_AMUL, W_ARMS,
} from '../js/const.js';
import { canSeeMonster, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AT_GAZE } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { resolveMonsterCombatGaze } from '../js/monster_combat_gaze.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import type { MessagePublisher } from '../js/display.js';

async function gazeRoom(source = 'umber hulk', target = 'orc') {
    freshObjectRoom({ heroX: 8, heroY: 10, flags: { verbose: true } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt(source, 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt(target, 12, 10, MM_NOGRP | NO_MINVENT);
    for (const monster of [attacker, defender]) {
        monster.mhp = monster.mhpmax = 100;
        monster.msleeping = 0;
        monster.mcansee = 1;
        monster.mcan = 0;
    }
    const foundAttack = MONSTER_ATTACKS[attacker.mnum]?.find(([method]) => method === AT_GAZE);
    assert.ok(foundAttack, `${source} needs its native gaze attack.`);
    const attack = foundAttack;
    installPagerInput(resetInputState(), {
        expected: /gazes|nothing happens|blinded|confus|reflect|stone|medallion|reconstitutes|looks much better|But wait/i,
        limit: 15,
    });
    const messages: string[] = [];
    const publish: MessagePublisher = async (message, options) => {
        messages.push(message);
        await plineWithContinuation(message, options);
    };
    async function gaze({ visible = true, stun = true } = {}) {
        requirePlayingGame(game);
        const options = {
            state: game, visible, publish,
            random: (limit: number) => stun ? limit - 1 : 0,
            rollDice: (count: number, sides: number) => count * Math.min(sides, 3),
        };
        return resolveMonsterCombatGaze(attacker, defender, attack, {
            ...options,
            resolveDamage: (aggressor, victim, selected) => resolveMonsterCombatDamage(
                aggressor, victim, selected, options,
            ),
        });
    }
    initRng(6611n);
    return { attacker, defender, gaze, messages };
}

for (const impediment of ['cancelled attacker', 'blind attacker', 'blind defender', 'sleeping defender', 'invisible attacker']) {
    void test(`${impediment} prevents an umber hulk's gaze from confusing its opponent`, async () => {
        const { attacker, defender, gaze, messages } = await gazeRoom();
        switch (impediment) {
        case 'cancelled attacker': attacker.mcan = 1; break;
        case 'blind attacker': attacker.mcansee = 0; break;
        case 'blind defender': defender.mcansee = 0; break;
        case 'sleeping defender': defender.msleeping = 1; break;
        case 'invisible attacker': attacker.minvis = 1; break;
        }

        const result = await gaze();

        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.ok(!defender.mconf);
        assert.equal(defender.mhp, 100);
        assert.ok(messages.includes('but nothing happens.'));
        if (impediment === 'sleeping defender') assert.equal(defender.msleeping, 1);
    });
}

void test('an uncancelled gaze confuses a seeing opponent without HP damage', async () => {
    const { defender, gaze } = await gazeRoom();

    await gaze();

    assert.equal(defender.mconf, 1);
    assert.equal(defender.mhp, 100);
});

void test('a monster that perceives invisibility can meet an invisible attacker gaze', async () => {
    const { attacker, defender, gaze } = await gazeRoom('umber hulk', 'elf');
    attacker.minvis = 1;

    await gaze();

    assert.equal(defender.mconf, 1);
});

void test('even a cancelled unseen gaze exposes a mimic disguise', async () => {
    const { attacker, defender, gaze, messages } = await gazeRoom('umber hulk', 'small mimic');
    assert.notEqual(M_AP_TYPE(defender), 0);
    attacker.mcan = 1;
    defender.mundetected = 1;

    await gaze({ visible: false });

    assert.equal(M_AP_TYPE(defender), 0);
    assert.equal(defender.mundetected, 0);
    assert.equal(defender.mhp, 100);
    assert.equal(messages.length, 0);
});

void test('a blinded Archon still blinds and can stun its opponent', async () => {
    const { attacker, defender, gaze, messages } = await gazeRoom('Archon');
    attacker.mcansee = 0;
    attacker.mblinded = 10;

    await gaze();

    assert.equal(defender.mcansee, 0);
    assert.equal(defender.mblinded, 6);
    assert.equal(defender.mstun, 1);
    assert.equal(defender.mhp, 100);
    assert.ok(messages.some(message => /blinded Archon gazes toward/.test(message)));
});

void test('an Archon can blind without stunning', async () => {
    const { defender, gaze } = await gazeRoom('Archon');

    await gaze({ stun: false });

    assert.equal(defender.mcansee, 0);
    assert.equal(defender.mblinded, 6);
    assert.ok(!defender.mstun);
});

void test('light-resistant eyes prevent both Archon blindness and its stun', async () => {
    const { defender, gaze } = await gazeRoom('Archon', 'yellow light');

    const result = await gaze();

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(defender.mcansee, 1);
    assert.ok(!defender.mblinded);
    assert.ok(!defender.mstun);
    assert.equal(defender.mhp, 100);
});

void test('a reflecting shield does not turn an Archon gaze back on its owner', async () => {
    const { attacker, defender, gaze } = await gazeRoom('Archon');
    await equipMonsterObject(defender, await knownObject(SHIELD_OF_REFLECTION, { typeKnown: false }), W_ARMS);

    await gaze();

    assert.equal(defender.mcansee, 0);
    assert.equal(attacker.mcansee, 1);
    assert.ok(!game._knownObjectTypes?.has(SHIELD_OF_REFLECTION));
});

void test('visible reflection petrifies Medusa and identifies the reflecting shield without hero kill credit', async () => {
    const { attacker, defender, gaze, messages } = await gazeRoom('Medusa');
    requirePlayingGame(game);
    await equipMonsterObject(defender, await knownObject(SHIELD_OF_REFLECTION, { typeKnown: false }), W_ARMS);
    const experience = game.u.uexp;

    const result = await gaze();

    assert.equal(result.nativeResult, M_ATTK_AGR_DIED);
    assert.equal(monsterAtPosition(game.level, attacker.mx, attacker.my), null);
    assert.ok(floorObjectsAt(game.level, attacker.mx, attacker.my)
        .some(object => object.otyp === STATUE && object.corpsenm === attacker.mnum));
    assert.equal(defender.mhp, 100);
    assert.equal(game.u.uexp, experience);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.ok(game._knownObjectTypes?.has(SHIELD_OF_REFLECTION));
    assert.ok(messages.some(message => /gaze is reflected away by the orc's shield/.test(message)));
});

void test('Medusa reflection of an already reflected gaze protects both monsters', async () => {
    const { attacker, defender, gaze, messages } = await gazeRoom('Medusa');
    await equipMonsterObject(defender, await knownObject(SHIELD_OF_REFLECTION, { typeKnown: false }), W_ARMS);
    await equipMonsterObject(attacker, await knownObject(AMULET_OF_REFLECTION, { typeKnown: false }), W_AMUL);

    const result = await gaze();

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(attacker.mhp, 100);
    assert.equal(defender.mhp, 100);
    assert.ok(game._knownObjectTypes?.has(AMULET_OF_REFLECTION));
    assert.ok(messages.some(message => /Medusa's amulet/.test(message)));
});

void test('a reflection the hero cannot see still petrifies Medusa without identifying the shield', async () => {
    const { attacker, defender, gaze, messages } = await gazeRoom('Medusa');
    requirePlayingGame(game);
    await equipMonsterObject(defender, await knownObject(SHIELD_OF_REFLECTION, { typeKnown: false }), W_ARMS);
    await makeBlinded(10, { talk: false });
    assert.equal(canSeeMonster(defender), false, 'Blindness must update actual optical visibility.');
    assert.ok(!game._knownObjectTypes?.has(SHIELD_OF_REFLECTION), 'The shield starts unidentified.');

    const result = await gaze({ visible: false });

    assert.equal(result.nativeResult, M_ATTK_AGR_DIED);
    assert.equal(monsterAtPosition(game.level, attacker.mx, attacker.my), null);
    assert.ok(!game._knownObjectTypes?.has(SHIELD_OF_REFLECTION));
    assert.equal(messages.length, 0);
});

void test('Medusa cannot notice reflection from an invisible opponent', async () => {
    const { attacker, defender, gaze, messages } = await gazeRoom('Medusa');
    await equipMonsterObject(defender, await knownObject(AMULET_OF_REFLECTION, { typeKnown: false }), W_AMUL);
    defender.minvis = 1;

    const result = await gaze();

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(attacker.mhp, 100);
    assert.equal(defender.mhp, 100);
    assert.ok(!game._knownObjectTypes?.has(AMULET_OF_REFLECTION));
    assert.ok(messages.some(message => /doesn't seem to notice.*gaze was reflected/.test(message)));
});

void test('sleep prevents reflection before an unseen amulet can be identified', async () => {
    const { attacker, defender, gaze } = await gazeRoom('Medusa');
    await equipMonsterObject(defender, await knownObject(AMULET_OF_REFLECTION, { typeKnown: false }), W_AMUL);
    defender.msleeping = 1;

    const result = await gaze();

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(attacker.mhp, 100);
    assert.equal(defender.msleeping, 1);
    assert.ok(!game._knownObjectTypes?.has(AMULET_OF_REFLECTION));
});

void test('life saving lets Medusa survive her reflected gaze without a statue', async () => {
    const { attacker, defender, gaze } = await gazeRoom('Medusa');
    requirePlayingGame(game);
    await equipMonsterObject(defender, await knownObject(SHIELD_OF_REFLECTION, { typeKnown: false }), W_ARMS);
    const amulet = await equipMonsterObject(attacker, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);

    const result = await gaze();

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(amulet.where, 'gone');
    assert.ok(attacker.mhp > 0);
    assert.equal(monsterAtPosition(game.level, attacker.mx, attacker.my), attacker);
    assert.equal(floorObjectsAt(game.level, attacker.mx, attacker.my)
        .some(object => object.otyp === STATUE), false);
});
