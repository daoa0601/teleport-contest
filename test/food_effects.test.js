import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { A_DEX, A_STR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    APPLE, CARROT, EGG, EUCALYPTUS_LEAF, FORTUNE_COOKIE,
    LUMP_OF_ROYAL_JELLY, SPRIG_OF_WOLFSBANE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { carriedObject } from './support/game-objects.js';
import { installHumanWerewolfHero } from './support/hero-state.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('eating a carrot clears temporary blindness', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.u.blindTurns = 12;
    game.u.ucreamed = 0;
    syncBlindness(game);
    const carrot = carriedObject(CARROT, { age: game.moves });
    game.inventory = [carrot];
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.blind, false);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.inventory.includes(carrot), false);
});

test('eating an uncursed eucalyptus leaf cures illness and nausea',
    async () => {
        freshWeaponArena();
        initRng(45300n);
        game.u.sick = true;
        game.u.sickTurns = 18;
        game.u.vomiting = true;
        game.u.vomitingTurns = 9;
        const leaf = carriedObject(EUCALYPTUS_LEAF, {
            age: game.moves,
        });
        game.inventory = [leaf];
        pushKey('a');
        pushKey(' ');

        await rhack('e'.charCodeAt(0));

        assert.equal(game.u.sick, false);
        assert.equal(game.u.sickTurns, 0);
        assert.equal(game.u.vomiting, false);
        assert.equal(game.u.vomitingTurns, 0);
        assert.equal(game.inventory.includes(leaf), false);
    });

test('eating wolfsbane cures lycanthropy and ends beast form', async () => {
    freshWeaponArena();
    initRng(45300n);
    installHumanWerewolfHero({ beast: true });
    const wolfsbane = carriedObject(SPRIG_OF_WOLFSBANE, {
        age: game.moves,
    });
    game.inventory = [wolfsbane];
    pushKey('a');
    pushKey(' ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.ulycn, -1);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.mh, 0);
    assert.equal(game.inventory.includes(wolfsbane), false);
});

test('eating a cockatrice egg starts petrification', async () => {
    freshWeaponArena();
    initRng(45300n);
    const egg = carriedObject(EGG, {
        age: game.moves,
        corpsenm: 10,
    });
    game.inventory = [egg];
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.stonedTurns, 5);
    assert.equal(game.u.stoned, true);
    assert.equal(game.inventory.includes(egg), false);
});

test('eating royal jelly strengthens and heals the hero', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.u.uhp = 5;
    game.u.uhpmax = 40;
    game.u._woundedLegTurns = 12;
    game.u._woundedLegSide = 'left';
    game.u.acurr.a[A_DEX]--;
    const strength = game.u.acurr.a[A_STR];
    const jelly = carriedObject(LUMP_OF_ROYAL_JELLY, {
        age: game.moves,
    });
    game.inventory = [jelly];
    pushKeys('a   ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], strength + 1);
    assert.ok(game.u.uhp > 5);
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.inventory.includes(jelly), false);
});

test('eating a cursed apple puts the hero to sleep', async () => {
    freshWeaponArena();
    initRng(45300n);
    const apple = carriedObject(APPLE, {
        age: game.moves,
        cursed: true,
    });
    game.inventory = [apple];
    pushKeys('a  ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game._helplessReason, 'sleeping');
    assert.ok(game._helplessTurns >= 20);
    assert.ok(game._helplessTurns <= 30);
    assert.equal(game.inventory.includes(apple), false);
});

test('reading a fortune cookie grants nutrition and literacy', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.u.uhunger = 900;
    game.u.uconduct = {};
    const cookie = carriedObject(FORTUNE_COOKIE, {
        age: game.moves,
    });
    game.inventory = [cookie];
    pushKeys('a    ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uhunger, 940);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(game.inventory.includes(cookie), false);
});
