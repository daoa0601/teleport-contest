import assert from 'node:assert/strict';
import test from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
import { screenText } from './support/screen.js';

void test('two-weapon commands refresh the optional weapon status field', async () => {
    for (const command of ['X', '#twoweapon\n']) {
        const result = await runSegment({
            seed: 13,
            datetime: '20260831120000',
            nethackrc: [
                'OPTIONS=name:Student,role:Samurai,race:human,gender:male,align:lawful',
                'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none,weaponstatus',
            ].join('\n'),
            moves: command,
            storage: memoryStorage(),
        });
        const screens = result.getScreens();
        const last = screens[screens.length - 1];
        assert.ok(last);
        assert.match(screenText(last), /Dual-weps/);
    }
});

void test('emptying the primary slot refreshes the enabled barehanded condition', async () => {
    const result = await runSegment({
        seed: 13,
        datetime: '20260831120000',
        nethackrc: [
            'OPTIONS=name:Student,role:Samurai,race:human,gender:male,align:lawful',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none,cond_barehanded',
        ].join('\n'),
        moves: 'w-',
        storage: memoryStorage(),
    });
    const screens = result.getScreens();
    const last = screens[screens.length - 1];
    assert.ok(last);
    assert.match(screenText(last), /Bare/);
});
