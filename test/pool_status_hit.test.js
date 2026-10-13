import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
void test('a completed monster attack redraws the injured hero health', async () => {
    freshObjectRoom({ hero: { uhp: 30, uhpmax: 30, uac: 10 } });
    requirePlayingGame(game);
    const newt = await createMonsterAt('newt', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    newt.mux = game.u.ux;
    newt.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /newt/, limit: 3 });
    await bot();
    await performMonsterHeroAttack(newt, game, { rollOne: () => 1, rollDice: () => 1 });
    assert.equal(game.u.uhp, 29);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:29\(30\)/);
});
//# sourceMappingURL=pool_status_hit.test.js.map