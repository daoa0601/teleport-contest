import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { floatHeroUp } from '../js/trap.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C trap.c:3990-3996 float_up(): after the hero gains levitation, a steed
// that neither floats (is_floater: S_EYE/S_LIGHT) nor flies (M1_FLY) cannot
// stay under the hero and is dismounted; floaters and flyers keep carrying
// the hero.  Driven through floatHeroUp(), which a levitation trap calls.
const cases = [
    ['pony', false],
    ['gray dragon', true],
    ['floating eye', true],
];
for (const [species, staysOn] of cases) {
    void test(`float_up ${staysOn ? 'keeps' : 'dismounts'} a ${species} steed`, async () => {
        await freshObjectRoom();
        requirePlayingGame(game);
        const steed = await createSaddledSteed(species);
        game.u.usteed = steed;
        game.u.ux = steed.mx;
        game.u.uy = steed.my;
        await floatHeroUp(game);
        if (staysOn) {
            assert.equal(game.u.usteed, steed, 'a floating or flying steed keeps carrying the hero');
        }
        else {
            assert.equal(game.u.usteed, null, 'a grounded steed is dismounted');
            assert.match(game._pending_message ?? '', /You cannot stay on /);
        }
    });
}
//# sourceMappingURL=float_up_steed.test.js.map