import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_CLAW } from '../js/monster_attack_types.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a perceived invisible attacker retains its invisibility in knockback feedback', async () => {
    freshObjectRoom({ hero: { seeInvisible: true } });
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.minvis = true;
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const messages: string[] = [];

    const result = await tryKnockback(giant, defender, { attackType: AT_CLAW, damageType: AD_PHYS }, {
        state: game, random: () => 0, publish: message => { messages.push(message); },
    });

    assert.equal(result.knocked, true);
    assert.ok(messages.some(message => message.startsWith('The invisible hill giant knocks the orc ')),
        messages.join('\n'));
});

void test('knockback preserves the spelling of a named defender', async () => {
    freshObjectRoom();
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    setMonsterGivenName(defender, 'sparky');
    const messages: string[] = [];

    const result = await tryKnockback(giant, defender, { attackType: AT_CLAW, damageType: AD_PHYS }, {
        state: game, random: () => 0, publish: message => { messages.push(message); },
    });

    assert.equal(result.knocked, true);
    assert.ok(messages.some(message => message.startsWith('The hill giant knocks sparky ')),
        messages.join('\n'));
});
