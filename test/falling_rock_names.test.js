import test from 'node:test';
import assert from 'node:assert/strict';
// C read.c:drop_boulder_on_player() names the conjured rocks with doname(),
// which observes them only when the hero can see.
import { rhack } from '../js/cmd.js';
import { dropBoulderOnHero } from '../js/falling_boulder.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshObjectRoom } from './support/object-room.js';
function rockRoom() {
    freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
    requireFixtureGame(game);
    initRng(7n);
}
void test('rocks seen falling on the hero are still felt as rocks after blindness', async () => {
    rockRoom();
    pushKeys(' '.repeat(10));
    await dropBoulderOnHero({ confused: true });
    assert.match(game._pending_message, /You are hit by \d+ rocks!/);
    setHeroBlindnessTurns(20);
    pushKeys(' '.repeat(10));
    await rhack(':'.charCodeAt(0));
    assert.match(game._pending_message, /You feel here \d+ rocks\./);
});
void test('rocks that fall on a blind hero are only felt as stones', async () => {
    rockRoom();
    setHeroBlindnessTurns(20);
    pushKeys(' '.repeat(10));
    await dropBoulderOnHero({ confused: true });
    assert.match(game._pending_message, /You are hit by \d+ stones!/);
    pushKeys(' '.repeat(10));
    await rhack(':'.charCodeAt(0));
    assert.match(game._pending_message, /You feel here \d+ stones\./);
});
//# sourceMappingURL=falling_rock_names.test.js.map