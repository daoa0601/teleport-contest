import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
import { screenText } from './support/screen.js';
import { completeHeroStartup } from './support/startup.js';
for (const pauper of [false, true]) {
    void test(`${pauper ? 'pauper' : 'ordinary'} heroes receive only their native starting skill slots`, async () => {
        const state = await completeHeroStartup({ role: 'wizard', flags: { pauper } });
        assert.equal(state.u.weapon_slots, pauper ? 2 : 0);
    });
}
void test('wizard level changes add and remove one skill slot per experience level', async () => {
    const result = await runSegment({
        seed: 41371,
        datetime: '20260831120000',
        nethackrc: [
            'OPTIONS=role:Wizard,race:human,gender:male,align:neutral,playmode:debug',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: '#levelchange\n6\n' + ' '.repeat(30)
            + '#levelchange\n3\n' + ' '.repeat(30) + '#enhance\n ',
        storage: memoryStorage(),
    });
    const menu = result.getScreens().map(screenText).find(screen => screen.includes('Current skills:'));
    assert.equal(game.u.ulevel, 3);
    assert.equal(game.u.weapon_slots, 2);
    assert.ok(menu, 'The enhance command must show the skill menu');
    assert.match(menu, /Current skills:  \(2 slots available\)/);
});
//# sourceMappingURL=starting_skill_slots.test.js.map