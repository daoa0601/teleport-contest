import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, map_invisible, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { returnHeroToHumanForm } from '../js/polyself.js';
import { vision_recalc } from '../js/vision.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenCell } from './support/screen.js';

void test('returning from an eyeless body keeps the unseen attacker through the announcement pager', async () => {
    freshRoomWithPolymorphedHero('earth elemental', { hero: { warning: true } });
    vision_recalc(0);
    const monster = await createMonsterAt('xorn', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = 1;
    monster.mpeaceful = false;
    monster.m_lev = 8;
    await plineWithContinuation('You feel your borrowed body beginning to fade away.');
    map_invisible(11, 10);
    const input = resetInputState();
    let acknowledgments = 0;
    input.beforeRead = () => {
        assert.equal(requireScreenCell(10, 11).ch, 'I');
        acknowledgments++;
        input.feed(' ');
    };

    await returnHeroToHumanForm();
    await flush_screen(1);

    assert.ok(acknowledgments > 0, 'The return announcement must wait for acknowledgment');
    assert.equal(game.blind, false);
    assert.equal(requireScreenCell(10, 11).ch, '2', 'Warning replaces the marker after sight is restored');
});

void test('returning from a luminous eyeless body refreshes sight before the announcement pager', async () => {
    freshRoomWithPolymorphedHero('fire elemental', { hero: { warning: true } });
    vision_recalc(0);
    const monster = await createMonsterAt('xorn', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.mpeaceful = false;
    monster.m_lev = 8;
    await plineWithContinuation('You feel your borrowed body beginning to fade away.');
    map_invisible(11, 10);
    const input = resetInputState();
    let acknowledgments = 0;
    input.beforeRead = () => {
        assert.equal(requireScreenCell(10, 11).ch, 'X',
            'Extinguishing the body light restores sight before paging the previous message');
        acknowledgments++;
        input.feed(' ');
    };

    await returnHeroToHumanForm();

    assert.ok(acknowledgments > 0, 'The return announcement must wait for acknowledgment');
    assert.equal(game.blind, false);
});
