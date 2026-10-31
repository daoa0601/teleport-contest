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

function scriptedRandom(values: number[]): {
    random: (limit: number) => number;
    draws: number[];
} {
    const draws: number[] = [];
    let next = 0;
    return {
        draws,
        random: (limit: number) => {
            draws.push(limit);
            const value = values[next];
            next += 1;
            if (value === undefined || value >= limit)
                throw new Error(`unexpected random(${limit}) #${draws.length}`);
            return value;
        },
    };
}

void test('knocking an eel back consumes goodpos eel draws around the message', async () => {
    await freshObjectRoom();
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    const eel = await createMonsterAt('jellyfish', 12, 10, NO_MINVENT);
    const messages: string[] = [];
    // rn2(3)=1 one step, rn2(6)=0 knock back, rn2(13) the eel draw that
    // MM_IGNOREWATER discards, rn2(2)=0 "powerful", rn2(2)=1 "blow",
    // rn2(13)=0 the hurtle step's eel draw, rn2(4)=0 stun the jellyfish.
    const { random, draws } = scriptedRandom([1, 0, 1, 0, 1, 0, 0]);

    const outcome = await tryKnockback(giant, eel,
        { attackType: AT_CLAW, damageType: AD_PHYS }, {
            state: game, random, publish: message => { messages.push(message); },
        });

    assert.equal(outcome.knocked, true);
    assert.equal(eel.mx, 13);
    assert.equal(eel.mstun, 1);
    assert.deepEqual(draws, [3, 6, 13, 2, 2, 13, 4]);
    assert.ok(messages.includes('The hill giant knocks the jellyfish backward with a powerful blow!'),
        messages.join('\n'));
});

void test('a non-eel defender draws no eel roll in its knockback', async () => {
    await freshObjectRoom();
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    const orc = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const messages: string[] = [];
    const { random, draws } = scriptedRandom([1, 0, 0, 1, 0]);

    const outcome = await tryKnockback(giant, orc,
        { attackType: AT_CLAW, damageType: AD_PHYS }, {
            state: game, random, publish: message => { messages.push(message); },
        });

    assert.equal(outcome.knocked, true);
    assert.equal(orc.mx, 13);
    assert.deepEqual(draws, [3, 6, 2, 2, 4]);
    assert.ok(messages.includes('The hill giant knocks the orc backward with a powerful blow!'),
        messages.join('\n'));
});
