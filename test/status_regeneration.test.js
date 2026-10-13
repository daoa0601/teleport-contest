import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { regenerateHeroHp } from '../js/hero_regeneration.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
for (const polymorphed of [false, true]) {
    void test(`regeneration displays restored ${polymorphed ? 'monster-form' : 'human'} HP`, async () => {
        freshObjectRoom({ hero: { uhp: 10 } });
        if (polymorphed)
            installPolymorphedHero('wolf', { hitPoints: 10, maxHitPoints: 40 });
        grantIntrinsicProperty('regeneration', 'outside');
        await bot();
        await regenerateHeroHp(0, 20);
        await flush_screen(1);
        const hp = polymorphed ? game.u.mh : game.u.uhp;
        assert.ok(hp !== undefined && hp > 10);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`HP:${hp}\\(40\\)`));
    });
}
//# sourceMappingURL=status_regeneration.test.js.map