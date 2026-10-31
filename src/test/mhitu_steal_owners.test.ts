import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a monster with two equal claw slots repeats its hit verb', async () => {
    // C mhitu.c:hitmsg(): an attack whose slot directly follows another hit
    // of the same type in the species' attack array appends " again".
    await freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const bear = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
    bear.mux = 10;
    bear.muy = 10;
    bear.mspec_used = 1;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(' '.repeat(10));

    await performMonsterHeroAttack(bear, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 1,
    });

    assert.match(messages.join('\n') + game._pending_message,
        /The owlbear hits!  The owlbear hits again!  The owlbear hits!/);
    assert.ok(game.u.uhp < 500);
});

void test('a blind hero with nothing to steal is robbed by somebody', async () => {
    // C steal.c:steal(): with an empty, goldless knapsack the unseen thief
    // is "Somebody" for a blind hero.
    await freshObjectRoom({ hero: { blindTurns: 50 } });
    requirePlayingGame(game);
    const thief = await createMonsterAt('water nymph', 11, 10,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(' '.repeat(10));

    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });

    assert.match(messages.join('\n') + game._pending_message,
        /Somebody tries to rob you, but finds nothing to steal\./);
    assert.equal(game.inventory.length, 0);
    assert.equal(thief.minvent.length, 0);
});
