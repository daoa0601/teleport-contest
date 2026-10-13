import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_SLOW, AT_TUCH } from '../js/monster_attack_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty } from '../js/properties.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const negated of [false, true]) {
    void test(`a shade's ${negated ? 'negated' : 'unblocked'} slowing touch ${negated ? 'leaves' : 'removes'} innate speed`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const shade = await createMonsterAt('shade', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        grantIntrinsicProperty('fast', 'outside');
        const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_TUCH,
            damageType: AD_SLOW, hit: true, damage: 4, negated };
        const messages: string[] = [];

        await resolveMonsterContactEffect(shade, attack, { state: game,
            publish: async message => { messages.push(message); }, random: () => 0 });

        assert.equal(hasPermanentIntrinsicProperty('fast'), negated);
        assert.equal(attack.damage, 4);
    });
}
