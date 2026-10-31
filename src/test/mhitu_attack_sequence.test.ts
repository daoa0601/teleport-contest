import test from 'node:test';
import assert from 'node:assert/strict';
import { M_ATTK_HIT, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { beginMonsterHeroAttack, completeHeroAttackSlot } from '../js/mhitu.js';
import { d, rn2 } from '../js/rng.js';
import type { MonsterCallLog } from '../js/monster_action_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C mhitu.c:mattacku() + hitmu(): one sewer rat bite. The to-hit roll beats
// the threshold, hitmu() rolls the declared 1d3, mdamageu() subtracts it, and
// the remaining five (empty) attack slots finish the sequence without
// touching the hero again.
void test('a sewer rat bite resolves its whole mattacku sequence from mhitu.js', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const rat = await createMonsterAt('sewer rat', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    rat.mux = game.u.ux;
    rat.muy = game.u.uy;
    const calls: MonsterCallLog = [];

    const initiation = await beginMonsterHeroAttack(rat, game, rn2, () => 1, () => 3, calls);
    const sequence = initiation.heroAttackSequence;
    const attack = sequence?.current;
    assert.equal(attack?.kind, 'hero-attack');
    assert.equal(attack?.hit, true);
    assert.equal(attack?.damage, 3, 'hitmu() rolls the full declared 1d3');
    assert.equal(game.u.uhp, 97, 'mdamageu() subtracts the bite during the slot');

    const action = { monster: rat, calls,
        movement: { oldx: 11, oldy: 10, x: 11, y: 10, moved: false, ...initiation } };
    const next = await completeHeroAttackSlot(action, game, rn2, d, () => 1);

    assert.equal(sequence?.done, true, 'the sixth slot ends mattacku()');
    assert.equal(sequence?.results[0], M_ATTK_HIT);
    assert.equal(game.u.uhp, 97, 'the empty slots deal no further damage');
});

// C mhitu.c:mattacku() AT_ENGL -> gulpmu() -> mhitm.c:engulf_target(): an
// engulf admission failure keeps the hero's HP and still finishes the
// sequence. A giant hero is MZ_HUGE, so engulf_target() refuses the ochre
// jelly's swallow and the slot reports the refusal.
void test('a refused engulf completes its slot without hero damage', async () => {
    await freshRoomWithPolymorphedHero('giant', { polymorph: { hitPoints: 100 } });
    requirePlayingGame(game);
    const jelly = await createMonsterAt('ochre jelly', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    jelly.mux = game.u.ux;
    jelly.muy = game.u.uy;
    const hp = game.u.mh;
    const calls: MonsterCallLog = [];

    const initiation = await beginMonsterHeroAttack(jelly, game,
        (limit: number) => Math.min(1, limit - 1), () => 1, () => 6, calls);
    const sequence = initiation.heroAttackSequence;
    const attack = sequence?.current;
    assert.equal(attack?.kind, 'hero-attack');
    assert.equal(attack?.effect, 'engulf-refused',
        'engulf_target() refuses a MZ_HUGE hero');
    assert.equal(game.u.mh, hp);

    const action = { monster: jelly, calls,
        movement: { oldx: 11, oldy: 10, x: 11, y: 10, moved: false, ...initiation } };
    await completeHeroAttackSlot(action, game, (limit: number) => Math.min(1, limit - 1), d, () => 1);
    assert.equal(sequence?.done, true);
    assert.equal(game.u.mh, hp, 'gulpmu() refusal deals no damage');
});
