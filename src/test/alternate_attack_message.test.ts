import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an owlbear recovering its grip does not call its replacement claw hit another repeated attack', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
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
