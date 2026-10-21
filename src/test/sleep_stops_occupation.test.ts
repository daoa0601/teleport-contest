import assert from 'node:assert/strict';
import test from 'node:test';
import { SLP_GAS_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { castNativeRay } from '../js/ray_attack.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C timeout.c fall_asleep() begins with stop_occupation(), which reports
// the interrupted activity before the hero is helpless.
void test('falling asleep in a gas trap interrupts and reports the current occupation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._occupation = { key: 'wipe-face', text: 'wiping your face', remaining: 8 };
    const trap = addTrap(game.level, SLP_GAS_TRAP, game.u.ux, game.u.uy);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        input.feed(' ');
    };

    await triggerHeroTrap(trap, { forceTrap: true });

    messages.push(game._pending_message || '');
    const text = messages.join(' ');
    assert.match(text, /A cloud of gas puts you to sleep!.*You stop wiping your face\./);
    assert.equal(game._occupation, null);
    assert.ok((game.multi ?? 0) < 0);
});

void test('a sleep ray reports the interrupted occupation through the ray publisher', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    game._occupation = { key: 'wipe-face', text: 'wiping your face', remaining: 8 };
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await castNativeRay(-23, 6, 'h', {
        originX: game.u.ux + 4, originY: game.u.uy,
        publish: async text => { messages.push(text); },
        random: () => 0, rollDice: () => 10, rollOne: () => 1,
    });

    assert.ok(messages.includes('You stop wiping your face.'), messages.join(' | '));
    assert.equal(game._occupation, null);
});
