import assert from 'node:assert/strict';
import test from 'node:test';
import { A_STR, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { poisonHero } from '../js/poison.js';
import { applyMonsterStoningAttack } from '../js/stoning.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a sleeping hero dreams of the cockatrice hiss', async () => {
    freshObjectRoom();
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
    putHeroToSleep(5);
    const messages: string[] = [];

    await applyMonsterStoningAttack(cockatrice, {
        random: sides => sides === 3 ? 0 : 1,
        publish: message => { messages.push(message); },
    });

    assert.ok(messages.includes("You dream that you hear the cockatrice's hissing!"));
});

void test('a sleeping hero dreams of poison weakening its muscles', async () => {
    freshObjectRoom();
    putHeroToSleep(5);
    const strength = game.u.acurr?.a[A_STR];
    assert.ok(strength !== undefined);
    const messages: string[] = [];

    await poisonHero({ reason: "The cobra's bite", killer: 'cobra', attribute: A_STR,
        random: () => 1, rollDice: () => 1,
        publish: message => { messages.push(message); },
    });

    assert.equal(game.u.acurr?.a[A_STR], strength - 1);
    assert.ok(messages.includes('You dream that you feel weaker!'));
});
