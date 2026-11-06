import assert from 'node:assert/strict';
import test from 'node:test';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterStagger } from '../js/mondata.js';
import { makePlural } from '../js/objnam.js';
function speciesOf(name) {
    const index = MONSTER_NAME.indexOf(name);
    assert.ok(index >= 0, `missing monster ${name}`);
    return index;
}
// C mondata.c:stagger() picks the faltering counterpart of the body's
// locomotion: levitate[] for floaters (mondata.h is_floater() is
// mlet == S_EYE || mlet == S_LIGHT), flys[]/flyl[] split by MZ_SMALL,
// slither, ooze, immobile, crawl, else the caller's default verb.
// mhitm.c:1415, mhitu.c:2580 and uhitm.c:1579 print
// makeplural(stagger(mdat, "stagger")); pickup.c:1992 and potion.c:124
// print the plain form for the hero.  A capitalized default keeps its
// capital (stagger()'s locoindx 3).
void test('stagger verbs follow the body class and conjugate like makeplural', () => {
    const plural = (name) => makePlural(monsterStagger(speciesOf(name), 'stagger'));
    assert.equal(plural('floating eye'), 'wobbles');
    assert.equal(plural('yellow light'), 'wobbles');
    assert.equal(plural('killer bee'), 'flutters');
    assert.equal(plural('winged gargoyle'), 'staggers');
    assert.equal(plural('long worm'), 'falters');
    assert.equal(plural('acid blob'), 'trembles');
    assert.equal(plural('brown mold'), 'pulsates');
    assert.equal(plural('quivering blob'), 'falters');
    assert.equal(plural('hill giant'), 'staggers');
    assert.equal(monsterStagger(speciesOf('hill giant'), 'Stagger'), 'Stagger');
    assert.equal(monsterStagger(speciesOf('human'), 'stagger'), 'stagger');
});
//# sourceMappingURL=mondata_stagger.test.js.map