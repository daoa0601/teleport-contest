import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { BOLT_LIM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
const THREAT_DISTANCE = (BOLT_LIM + 1) * (BOLT_LIM + 1);
// A one-row corridor: the peaceful monster starts just outside bolt range
// and its only move brings it inside.
async function searchWhileMonsterApproaches(hallucinationTurns) {
    freshTurnRoom({ left: 8, right: 20, top: 10, bottom: 10, hero: { hallucinationTurns } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 20, 10);
    monster.mpeaceful = 1;
    vision_recalc(0);
    const binding = game.commandBindings.lookup('s'.charCodeAt(0));
    assert.ok(binding);
    game.multi = 30;
    game._occupation = { key: 'command', text: 'searching', binding };
    pushKeys('\x1b'.repeat(8));
    const distance = () => (monster.mx - game.u.ux) ** 2 + (monster.my - game.u.uy) ** 2;
    assert.ok(distance() > THREAT_DISTANCE);
    for (let turn = 0; turn < 20 && game._occupation && distance() > THREAT_DISTANCE; turn++)
        await moveloop_core();
    assert.ok(distance() <= THREAT_DISTANCE, 'The monster must walk into bolt range.');
    return `${String(game._lastPlineMessage ?? '')} ${game._pending_message || ''}`;
}
void test('a hallucinating hero stops searching when a peaceful monster comes into range', async () => {
    const messages = await searchWhileMonsterApproaches(50);
    assert.equal(game._occupation, null);
    assert.match(messages, /You stop searching\./);
});
void test('a sober hero keeps searching while a peaceful monster approaches', async () => {
    const messages = await searchWhileMonsterApproaches(0);
    assert.ok(game._occupation, 'A peaceful monster is no threat to a hero who sees it clearly.');
    assert.doesNotMatch(messages, /You stop searching/);
});
//# sourceMappingURL=monster_threat_interrupt.test.js.map