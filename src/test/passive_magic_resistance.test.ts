import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroContactPassive } from '../js/uhitm.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C uhitm.c:passive() AD_MAGM (uhitm.c:5981) gates on the youprop.h
// Antimagic macro (HAntimagic || EAntimagic). The polymorph contribution is
// folded into HAntimagic by polyself.c:set_uasmon()
// (PROPSET(ANTIMAGIC, dmgtype(mdat, AD_MAGM) || mdat == baby gray dragon
// || dmgtype(mdat, AD_RBRE))), so a baby gray dragon hero resists the
// Oracle's counterattack missiles without worn or carried items.
void test('a baby gray dragon hero resists the Oracle’s passive magic missiles', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    installPolymorphedHero('baby gray dragon', { hitPoints: 40, maxHitPoints: 40 });
    const oracle = await createMonsterAt('oracle', 11, 10, NO_MINVENT);
    const messages: string[] = [];

    const result = await applyHeroContactPassive(oracle, {
        hit: true,
        random: () => 0,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.resisted, true);
    assert.equal(result.appliedDamage, undefined);
    assert.deepEqual(messages, ['A hail of magic missiles narrowly misses you!']);
});

// The same gate without any Antimagic source: the hero is struck and hurt.
void test('a hero without antimagic is struck by the Oracle’s magic missiles', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const oracle = await createMonsterAt('oracle', 11, 10, NO_MINVENT);
    const messages: string[] = [];

    const result = await applyHeroContactPassive(oracle, {
        hit: true,
        random: () => 0,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.resisted, false);
    assert.ok((result.appliedDamage ?? 0) > 0);
    assert.deepEqual(messages, ['You are hit by magic missiles appearing from thin air!']);
});
