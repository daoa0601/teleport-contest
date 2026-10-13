import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_ACID, AT_TUCH } from '../js/monster_attack_types.js';
import { resolveMonsterContactEffect } from '../js/monster_contact_effects.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const situation of ['burns', 'resisted', 'cancelled', 'no splash'] as const) {
    void test(`ochre jelly acid contact ${situation}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const jelly = await createMonsterAt('ochre jelly', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        if (situation === 'resisted') grantIntrinsicProperty('acidResistance', 'outside');
        if (situation === 'cancelled') jelly.mcan = 1;
        const messages: string[] = [];
        const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_TUCH,
            damageType: AD_ACID, hit: true, damage: 6 };

        await resolveMonsterContactEffect(jelly, attack, { state: game,
            publish: async message => { messages.push(message); },
            random: () => situation === 'no splash' ? 1 : 0 });

        assert.equal(attack.damage, situation === 'burns' ? 6 : 0);
        if (situation === 'burns') assert.match(messages.join('\n'), /covered in acid!  It burns!/);
        else if (situation === 'resisted') assert.match(messages.join('\n'), /acid, but it seems harmless/);
        else assert.equal(messages.length, 0);
    });
}
