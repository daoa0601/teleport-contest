import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('a raven blinding an infravision hero removes distant warm monsters from view', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).lit = false;
    const jackal = await createMonsterAt('jackal', 14, 10, NO_MINVENT);
    const raven = await createMonsterAt('raven', 11, 10, MM_ANGRY | NO_MINVENT);
    raven.mux = game.u.ux;
    raven.muy = game.u.uy;
    grantIntrinsicProperty('infravision', 'race');
    vision_recalc(0);
    newsym(jackal.mx, jackal.my);
    await flush_screen(1);
    assert.equal(requireScreenCell(13, 11).ch, 'd');
    resetInputState().feed(' '.repeat(10));

    await performMonsterHeroAttack(raven, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: () => 3,
    });
    await flush_screen(1);

    assert.equal(game.blind, true);
    assert.notEqual(requireScreenCell(13, 11).ch, 'd');
});

void test('becoming an eyeless body removes monsters previously seen through infravision', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).lit = false;
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    grantIntrinsicProperty('infravision', 'race');
    vision_recalc(0);
    newsym(soldier.mx, soldier.my);
    await flush_screen(1);
    assert.equal(requireScreenCell(13, 11).ch, '@');
    resetInputState().feed(' '.repeat(10));

    await polymonHero(MONSTER_NAME.indexOf('green slime'));
    await flush_screen(1);

    assert.equal(game.blind, true);
    assert.notEqual(requireScreenCell(13, 11).ch, '@');
});
