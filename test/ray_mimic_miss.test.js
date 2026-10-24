import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { castNativeRay } from '../js/ray_attack.js';
import { ARROW } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a detected mimic disguised as an object still reports a ray miss', async () => {
    freshObjectRoom({ hero: { detectMonsters: true }, flags: { verbose: true } });
    requirePlayingGame(game);
    const mimic = await createMonsterAt('giant mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = ARROW;
    const messages = [];
    await castNativeRay(0, 2, 'l', {
        state: game,
        forceMiss: true,
        publish: message => { messages.push(message); },
    });
    // C zap.c: disguised_as_non_mon() excludes sensed mimics, so the miss
    // line still names the perceived disguise.
    assert.ok(messages.some(line => /misses/.test(line)), `expected a miss line, got: ${messages.join(' / ')}`);
});
//# sourceMappingURL=ray_mimic_miss.test.js.map