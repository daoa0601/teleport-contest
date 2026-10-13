import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, SICK_ALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import { AD_HEAL, AT_CLAW } from '../js/monster_attack_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('nurse treatment silently cures food poisoning and terminal illness', async () => {
    freshObjectRoom({ hero: { sick: true, sickTurns: 7, sickType: SICK_ALL,
            sickCause: 'contaminated food' } });
    requirePlayingGame(game);
    const nurse = await createMonsterAt('nurse', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const attack = { kind: 'hero-attack', attackType: AT_CLAW, damageType: AD_HEAL,
        hit: true, damage: 9 };
    await resolveMonsterContactEffect(nurse, attack, { state: game,
        publish: async () => { }, random: () => 1, rollOne: () => 4 });
    assert.equal(game.u.sick, false);
    assert.equal(game.u.sickTurns, 0);
    assert.equal(game.u.sickType, 0);
    assert.equal(game.u.sickCause, undefined);
    assert.doesNotMatch(game._pending_message ?? '', /cured|better|relief/, 'the nurse cures sickness without publishing a cure message');
});
void test('an unarmed, unarmored hero receives nurse healing and a lasting maximum HP gain', async () => {
    freshObjectRoom({ hero: { uhp: 30, uhpmax: 40, uhppeak: 40 } });
    requirePlayingGame(game);
    const nurse = await createMonsterAt('nurse', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const messages = [];
    const attack = { kind: 'hero-attack', attackType: AT_CLAW, damageType: AD_HEAL,
        hit: true, damage: 9 };
    await resolveMonsterContactEffect(nurse, attack, { state: game,
        publish: async (message) => { messages.push(message); },
        random: range => range === 7 ? 0 : 1, rollOne: () => 4 });
    assert.equal(game.u.uhp, 34);
    assert.equal(game.u.uhpmax, 41);
    assert.equal(game.u.uhppeak, 41);
    assert.equal(attack.damage, 0);
    assert.match(messages.join('\n'), /The nurse hits!  \(I hope you don't mind\.\)/);
});
//# sourceMappingURL=monster_nurse_contact.test.js.map