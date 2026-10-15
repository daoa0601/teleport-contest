import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { M_AP_OBJECT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('changing between mimic bodies preserves the disguise chosen by #monster', async () => {
    freshObjectRoom({ flags: { debug: true } });
    installPolymorphedHero('small mimic');
    await runMonsterAbilityCommand();
    assert.equal(game.u.m_ap_type, M_AP_OBJECT);
    const appearance = game.u.mappearance;
    resetInputState();
    pushKeys('polyself\nlarge mimic\n                        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.m_ap_type, M_AP_OBJECT);
    assert.equal(game.u.mappearance, appearance);
});

void test('a hidden snake is exposed when its new body cannot hide under objects', async () => {
    freshObjectRoom({ flags: { debug: true } });
    installPolymorphedHero('garter snake');
    await floorObject(ROCK, game.u.ux, game.u.uy);
    await runMonsterAbilityCommand();
    assert.equal(game.u.uundetected, 1);
    resetInputState();
    pushKeys('polyself\ngoblin\n                        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.uundetected, 0);
});
