import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { heroWouldPetrifyFromFlesh } from '../js/stoning.js';
import { freshObjectRoom } from './support/object-room.js';
// C mondata.c:poly_when_stoned() refuses to turn a stoned golem into a stone
// golem once stone golems are genocided, so eating cockatrice flesh counts as
// deadly again: eat.c:eatcorpse() and edibility_prompts() then treat the meal
// as stoneable.
void test('a genocided stone golem makes golem flesh petrifying again', async () => {
    freshObjectRoom();
    await polymonHero(MONSTER_NAME.indexOf('flesh golem'));
    const cockatrice = MONSTER_NAME.indexOf('cockatrice');
    const stoneGolem = MONSTER_NAME.indexOf('stone golem');
    game.mvitals ??= [];
    game.mvitals[stoneGolem] ??= { mvflags: 0, born: 0, died: 0 };
    assert.equal(heroWouldPetrifyFromFlesh(cockatrice), false);
    game.mvitals[stoneGolem].mvflags |= G_GENOD;
    assert.equal(heroWouldPetrifyFromFlesh(cockatrice), true);
});
//# sourceMappingURL=stoning_golem_genocide.test.js.map