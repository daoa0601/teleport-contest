import { memoryStorage } from './support/memory-storage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { screenText } from './support/screen.js';
void test('enhance shows the role skill names', async () => {
    const result = await runSegment({
        seed: 8311,
        datetime: '20260831120000',
        nethackrc: [
            'OPTIONS=name:Student,role:Monk,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: '#enhance\n ',
        storage: memoryStorage(),
    });
    const skillPage = result.getScreens().map(screenText)
        .find(screen => screen.includes('Current skills:'));
    assert.ok(skillPage);
    assert.match(skillPage, /martial arts/);
});
//# sourceMappingURL=skills.test.js.map