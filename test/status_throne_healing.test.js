import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { throneSitEffect } from '../js/throne.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
for (const health of [10, 38]) {
    void test(`throne healing displays restored health from ${health} HP`, async () => {
        freshObjectRoom({
            gameplaySeed: 8n,
            flags: { debug: true },
            hero: { uhp: health, uhpmax: 40 },
        });
        await bot();
        pushKeys('4\n');
        await throneSitEffect();
        await flush_screen(1);
        const maximum = health === 10 ? 40 : 44;
        assert.equal(game.u.uhp, maximum);
        assert.equal(game.u.uhpmax, maximum);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`HP:${maximum}\\(${maximum}\\)`));
    });
}
void test('throne healing displays restored monster health and its increased maximum', async () => {
    freshObjectRoom({
        gameplaySeed: 8n,
        flags: { debug: true },
        hero: {
            uhp: 10, uhpmax: 40,
            mtimedone: 100, umonnum: MONSTER_NAME.indexOf('kobold'),
            mh: 18, mhmax: 20,
        },
    });
    await bot();
    pushKeys('4\n');
    await throneSitEffect();
    await flush_screen(1);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.mh, 24);
    assert.equal(game.u.mhmax, 24);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:24\(24\)/);
});
//# sourceMappingURL=status_throne_healing.test.js.map