import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { A_STR, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsUnaware, putHeroToSleep } from '../js/hero_sleep.js';
import { pushKeys } from '../js/input.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { poisonHero } from '../js/poison.js';
import { applyMonsterStoningAttack } from '../js/stoning.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a hero awakened by combat staggers aloud when the next blow knocks them back', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 10, 11, NO_MINVENT);
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    jackal.mpeaceful = false;
    jackal.msleeping = 0;
    jackal.mux = game.u.ux;
    jackal.muy = game.u.uy;
    putHeroToSleep(8);
    // Sleep was already in progress when this monster turn began.
    game.multi = -8;
    game.u.usleep = game.moves - 1;
    pushKeys(' '.repeat(20));
    await performMonsterHeroAttack(jackal, game, {
        random: () => 0, rollDice: count => count, rollOne: () => 1,
    });
    assert.equal(game._helplessTurns, 1, 'The jackal hit must shorten sleep before knockback');
    const messages: string[] = [];

    await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
        random: () => 0,
        publish: message => { messages.push(message); },
    });

    assert.equal(game.u.ux, 8);
    assert.equal(game.u.usleep, 0);
    assert.equal(heroIsUnaware(), false);
    assert.ok(messages.includes('You stagger...'), messages.join('\n'));
});

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
