import assert from 'node:assert/strict';
import test from 'node:test';
import { SLP_GAS_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
// C timeout.c fall_asleep() begins with stop_occupation(), which reports
// the interrupted activity before the hero is helpless.
void test('falling asleep in a gas trap interrupts and reports the current occupation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._occupation = { key: 'wipe-face', text: 'wiping your face', remaining: 8 };
    const trap = addTrap(game.level, SLP_GAS_TRAP, game.u.ux, game.u.uy);
    const messages = [];
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
//# sourceMappingURL=sleep_stops_occupation.test.js.map