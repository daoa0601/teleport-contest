import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { cansee, couldsee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('a raven blinding the hero removes distant infravision projections', async () => {
    const level = freshObjectRoom({ right: 25, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('infravision', 'race');
    for (let x = 7; x <= 25; x++) {
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    }
    vision_recalc(0);
    await createMonsterAt('goblin', 20, 10, MM_NOGRP | NO_MINVENT);
    const raven = await createMonsterAt('raven', 11, 10, MM_NOGRP | NO_MINVENT);
    raven.mpeaceful = false;
    raven.m_lev = 20;
    raven.mux = game.u.ux;
    raven.muy = game.u.uy;
    newsym(20, 10);
    await flush_screen(1);
    assert.equal(cansee(20, 10), false);
    assert.equal(couldsee(20, 10), true);
    assert.equal(requireScreenCell(19, 11).ch, 'o');
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await performMonsterHeroAttack(raven, game, {
        random: () => 1, rollOne: () => 1, rollDice: () => 3,
    });
    await flush_screen(1);
    assert.equal(game.blind, true);
    assert.equal(requireScreenCell(19, 11).ch, '.');
});
//# sourceMappingURL=contact_blindness_display.test.js.map