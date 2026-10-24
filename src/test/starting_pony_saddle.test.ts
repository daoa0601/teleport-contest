import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription } from '../js/cmd.js';
import { W_SADDLE } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { runSegment } from '../js/jsmain.js';
import { dodiscovered } from '../js/o_init.js';
import { SADDLE } from '../js/object_data.js';
import { monsterSaddle } from '../js/steed.js';
import { makedog } from '../js/u_init.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

async function startKnight(options = '') {
    const engine = await runSegment({
        seed: 73, datetime: '20260830120000', moves: '', storage: memoryStorage(),
        nethackrc: [
            'OPTIONS=name:Rider,role:knight,race:human,gender:male,align:lawful',
            'OPTIONS=!legacy,!tutorial,!autopickup',
            options,
        ].join('\n'),
    });
    assert.equal(engine.lastRunResult?.kind, 'input-needed');
    requirePlayingGame(game);
    const pony = game.level.monsters.find(monster => monster.m_id === game.context.startingpet_mid);
    assert.ok(pony, 'A Knight must start with a pony');
    return pony;
}

void test('a starting pony receives a fully identified saddle when it is visible', async () => {
    freshObjectRoom({ role: 'knight' });

    const pony = await makedog();

    assert.ok(pony);
    const saddle = monsterSaddle(pony);
    assert.ok(saddle, 'The starting pony must wear a saddle');
    newsym(pony.mx, pony.my);
    assert.equal(await farlookLocationDescription(pony.mx, pony.my), 'tame saddled pony');
    assert.equal(inventoryItemDescription(saddle), 'an uncursed saddle (being worn)');
    assert.equal(saddle.known, true);
    assert.equal(saddle.dknown, true);
    assert.equal(saddle.bknown, true);
    assert.equal(saddle.rknown, true);
    assert.equal(saddle.where, 'minvent');
    assert.equal(saddle.ocarry, pony);
    assert.equal(saddle.owornmask, W_SADDLE);
    assert.equal(saddle.leashmon, pony.m_id);
});

for (const options of ['', 'OPTIONS=permablind']) {
    void test(`startup leaves the saddle's beatitude unknown ${options ? 'when blind' : 'before vision is established'}`, async () => {
        const pony = await startKnight(options);

        const saddle = monsterSaddle(pony);

        assert.ok(saddle, 'The starting pony must wear a saddle');
        assert.equal(inventoryItemDescription(saddle), 'a saddle (being worn)');
        assert.equal(saddle.bknown ?? false, false);
        assert.equal(saddle.rknown ?? false, false);
        assert.equal(saddle.dknown, false);
        assert.equal(pony.mtame, 10);
    });
}

void test('a new Knight encounters the saddle but lists only objects with alternate appearances', async () => {
    await startKnight();
    const input = resetInputState();
    const lines: string[] = [];
    let pages = 0;
    input.display = {
        async readKey(): Promise<number> {
            assert.ok(++pages <= 8, 'Knight discoveries must finish within eight pages');
            lines.push(...requireGameDisplay().grid.map(row =>
                row.map(cell => cell.ch).join('').trimEnd()));
            return ' '.charCodeAt(0);
        },
    };

    try {
        await dodiscovered();
    } finally {
        input.display = null;
    }

    assert.ok(pages > 0, 'The discoveries command must display its window');
    assert.equal(game._encounteredObjectTypes?.has(SADDLE), true,
        'Creating the saddle must register an encounter even though its plain name is omitted');
    assert.ok(lines.includes('* dwarvish iron helm (hard hat)'));
    assert.ok(lines.includes('  small shield (wooden shield)'));
    assert.equal(lines.some(line => line.includes('saddle')), false);
});

void test('a pauper Knight starts with a bare-backed pony', async () => {
    const pony = await startKnight('OPTIONS=pauper');

    assert.equal(monsterSaddle(pony), null);
    assert.equal(await farlookLocationDescription(pony.mx, pony.my), 'tame pony');
});
