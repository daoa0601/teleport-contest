import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
for (const { abbreviation, role } of [
    { abbreviation: 'r', role: 'rogue' },
    { abbreviation: 'Ra', role: 'ranger' },
]) {
    void test(`role option ${abbreviation} selects ${role}`, async () => {
        await runSegment({
            seed: 21,
            datetime: '20260831120000',
            nethackrc: `OPTIONS=name:Scout,role:${abbreviation},race:human,gender:male,align:chaotic,!legacy,!tutorial,pettype:none`,
            moves: '',
            storage: memoryStorage(),
        });
        assert.equal(game.urole?.key, role);
    });
}
//# sourceMappingURL=role_abbreviation.test.js.map