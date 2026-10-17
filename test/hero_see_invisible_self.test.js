import test from 'node:test';
import assert from 'node:assert/strict';
// C display.h:canseeself() uses youprop.h Invisible, which is Invis without
// See_invisible: an invisible hero who can see invisible sees their glyph.
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { grantHeroSeeInvisible } from '../js/hero_seeing.js';
import { applyPotionLikeInvisibility } from '../js/hero_invisibility.js';
import { pushKeys } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
const heroCell = () => game.nhDisplay?.grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch;
void test('an invisible hero who gains see invisible is drawn again', async () => {
    freshObjectRoom();
    pushKeys(' '.repeat(10));
    await applyPotionLikeInvisibility({ random: () => 1, rollDice: () => 20 });
    await flush_screen(1);
    assert.notEqual(heroCell(), '@');
    await grantHeroSeeInvisible({ duration: 100 });
    await flush_screen(1);
    assert.equal(heroCell(), '@');
});
//# sourceMappingURL=hero_see_invisible_self.test.js.map