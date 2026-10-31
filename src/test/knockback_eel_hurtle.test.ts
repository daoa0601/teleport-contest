// C uhitm.c:mhitm_knockback() words its message after testing the knockback
// destination through dothrow.c:will_hurtle(), which calls teleport.c:goodpos().
// goodpos() draws rn2(13) for an S_EEL defender even though the caller passes
// MM_IGNOREWATER and discards the result, so the wording draws and the stun
// roll after it consume a stream shifted by that eel draw.

import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { tryKnockback } from '../js/uhitm.js';
import { AD_PHYS, AT_CLAW } from '../js/monster_attack_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// A deterministic draw stream for one scenario; the last value repeats if
// the mechanic ever asks for more rolls than the scenario needs.
function scriptedRandom(values: number[]): (limit: number) => number {
    let next = 0;
    return limit => (values[Math.min(next++, values.length - 1)] ?? 0) % limit;
}

void test('knocking an eel back consumes goodpos eel draws around the message', async () => {
    await freshObjectRoom();
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    const eel = await createMonsterAt('jellyfish', 12, 10, NO_MINVENT);
    const messages: string[] = [];
    // Without the eel draw the wording rolls read 1 and 0, so a missing
    // draw yields "forceful strike" and no stun instead of the outcomes
    // asserted below.
    const random = scriptedRandom([1, 0, 1, 0, 1, 0, 0]);

    const outcome = await tryKnockback(giant, eel,
        { attackType: AT_CLAW, damageType: AD_PHYS }, {
            state: game, random, publish: message => { messages.push(message); },
        });

    assert.equal(outcome.knocked, true);
    assert.equal(eel.mx, 13);
    assert.equal(eel.mstun, 1);
    assert.ok(messages.includes('The hill giant knocks the jellyfish backward with a powerful blow!'),
        messages.join('\n'));
});

void test('a non-eel defender draws no eel roll in its knockback', async () => {
    await freshObjectRoom();
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    const orc = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const messages: string[] = [];
    const random = scriptedRandom([1, 0, 0, 1, 0]);

    const outcome = await tryKnockback(giant, orc,
        { attackType: AT_CLAW, damageType: AD_PHYS }, {
            state: game, random, publish: message => { messages.push(message); },
        });

    assert.equal(outcome.knocked, true);
    assert.equal(orc.mx, 13);
    assert.ok(messages.includes('The hill giant knocks the orc backward with a powerful blow!'),
        messages.join('\n'));
});
