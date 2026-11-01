import { currency } from '../js/currency.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { monsterGrowlSound, publishMonsterNoise, sessionIsNight } from '../js/ambient_sounds.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [season, now] of [['summer', Date.UTC(2026, 6, 1, 12)], ['winter', Date.UTC(2026, 0, 1, 12)]]) {
    void test(`night uses the local hour of the recorder's daylight clock when replayed in ${season}`, context => {
        context.mock.timers.enable({ apis: ['Date'], now });
        assert.equal(sessionIsNight('20020115220000'), false, 'winter 22:00 becomes 21:00');
        assert.equal(sessionIsNight('20020115060000'), true, 'winter 06:00 becomes 05:00');
        assert.equal(sessionIsNight('20020715220000'), true, 'summer 22:00 stays 22:00');
        assert.equal(sessionIsNight('20020715210000'), false, 'summer 21:00 stays 21:00');
    });
}
void test('without a fixed datetime, night follows the current recorder clock', context => {
    context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 6, 1, 2) });
    assert.equal(sessionIsNight(null), true, '02:00 UTC is 22:00 in New York');
});
void test('a zombie uses a groan for its growl', async () => {
    await freshObjectRoom();
    const zombie = await createMonsterAt('human zombie', 11, 10);
    const sound = monsterGrowlSound(zombie);
    assert.equal(sound, 'groan');
});
void test('a shrieker uses the default scream for its growl', async () => {
    await freshObjectRoom();
    const shrieker = await createMonsterAt('shrieker', 11, 10);
    const sound = monsterGrowlSound(shrieker);
    assert.equal(sound, 'scream');
});
void test('a hallucinated gecko sales pitch uses the shared currency name', async () => {
    await freshObjectRoom({ hero: { hallucinationTurns: 100 } });
    const gecko = await createMonsterAt('gecko', 11, 10);
    initRng(913n);
    const expected = currency(15);
    initRng(913n);
    await publishMonsterNoise(gecko);
    assert.equal(game._last_message, `"15 minutes could save you 15 ${expected}."`);
});
//# sourceMappingURL=monster_sound.test.js.map