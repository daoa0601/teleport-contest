import assert from 'node:assert/strict';
import test from 'node:test';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterStagger } from '../js/mondata.js';
import { makePlural } from '../js/objnam.js';
import { makeStunned } from '../js/potion.js';
import { game } from '../js/gstate.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshTurnRoom } from './support/playable-room.js';

function speciesOf(name: string): number {
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
    const plural = (name: string) =>
        makePlural(monsterStagger(speciesOf(name), 'stagger'));
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

// C potion.c:124 prints the hero's verb through
// stagger(gy.youmonst.data, "stagger") when stunning begins; the port's
// makeStunned (potion.ts) composes monsterStagger(heroSpecies(state))
// on the same line.  A polymorphed body changes the verb, proving the
// migrated path follows the hero's current species.
void test('a stunned hero staggers per current body through make_stunned', async () => {
    freshTurnRoom();
    const lines: string[] = [];
    const publish = async (line: string) => { lines.push(line); };
    await makeStunned(5, { publish });
    assert.equal(lines.at(-1), 'You stagger...');
    await makeStunned(0, { publish });
    assert.match(lines.at(-1) ?? '', /a bit steadier now\./);

    installPolymorphedHero('long worm');
    await makeStunned(7, { publish });
    assert.equal(lines.at(-1), 'You falter...');
});
