import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// mhitu.c AD_RUST: an iron golem hero touched by a rust monster prints
// "You rust!" and rehumanizes (polyself.c rehumanize()) whatever prose is
// already on the topline; a pending message only adds a --More-- first.
for (const pending of ['', 'x'.repeat(70)]) {
    void test(`a rusting touch rehumanizes an iron golem hero ${pending ? 'behind a pending message' : 'on a clear topline'}`, async () => {
        await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        resetInputState().feed(' '.repeat(16));
        await polymonHero(MONSTER_NAME.indexOf('iron golem'));
        requirePlayingGame(game);
        assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('iron golem'));
        const rustMonster = await createMonsterAt('rust monster', game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        rustMonster.msleeping = 0;
        rustMonster.mux = game.u.ux;
        rustMonster.muy = game.u.uy;
        resetInputState().feed(' '.repeat(16));
        game._pending_message = pending;
        await performMonsterHeroAttack(rustMonster, game, {
            random: () => 0,
            rollOne: () => 1,
            rollDice: () => 1,
        });
        assert.notEqual(game.u.umonnum, MONSTER_NAME.indexOf('iron golem'), 'the rusted iron golem form is lost');
    });
}
//# sourceMappingURL=mhitu_erosion_rehumanize.test.js.map