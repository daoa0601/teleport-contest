import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { A_DEX, A_STR, SICK_VOMITABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    APPLE, CARROT, CORPSE, EGG, EUCALYPTUS_LEAF, FORTUNE_COOKIE,
    LUMP_OF_ROYAL_JELLY, SPRIG_OF_WOLFSBANE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { knownInventoryObject } from './support/game-objects.js';
import { installHumanWerewolfHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

test('eating a carrot clears temporary blindness', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.blindTurns = 12;
    game.u.ucreamed = 0;
    syncBlindness(game);
    const carrot = knownInventoryObject(CARROT, { age: game.moves });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.blind, false);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.inventory.includes(carrot), false);
});

test('eating an uncursed eucalyptus leaf cures illness and nausea',
    async () => {
        freshObjectRoom({ gameplaySeed: 45300n });
        game.u.sick = true;
        game.u.sickTurns = 18;
        game.u.sickType = SICK_VOMITABLE;
        game.u.vomiting = true;
        game.u.vomitingTurns = 9;
        const leaf = knownInventoryObject(EUCALYPTUS_LEAF, {
            age: game.moves,
        });
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
    freshObjectRoom({ gameplaySeed: 45300n });
    installHumanWerewolfHero({ beast: true });
    const wolfsbane = knownInventoryObject(SPRIG_OF_WOLFSBANE, {
        age: game.moves,
    });
    pushKey('a');
    pushKey(' ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.ulycn, -1);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.mh, 0);
    assert.equal(game.inventory.includes(wolfsbane), false);
});

test('eating a cockatrice egg starts petrification', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    const egg = knownInventoryObject(EGG, {
        age: game.moves,
        corpsenm: 10,
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.stonedTurns, 5);
    assert.equal(game.u.stoned, true);
    assert.equal(game.inventory.includes(egg), false);
});

test('eating royal jelly strengthens and heals the hero', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.uhp = 5;
    game.u.uhpmax = 40;
    game.u._woundedLegTurns = 12;
    game.u._woundedLegSide = 'left';
    game.u.acurr.a[A_DEX]--;
    const strength = game.u.acurr.a[A_STR];
    const jelly = knownInventoryObject(LUMP_OF_ROYAL_JELLY, {
        age: game.moves,
    });
    pushKeys('a   ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], strength + 1);
    assert.ok(game.u.uhp > 5);
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.inventory.includes(jelly), false);
});

test('eating a cursed apple puts the hero to sleep', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    const apple = knownInventoryObject(APPLE, {
        age: game.moves,
        cursed: true,
    });
    initRng(45300n);
    pushKeys('a  ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game._helplessReason, 'sleeping');
    assert.ok(game._helplessTurns >= 20);
    assert.ok(game._helplessTurns <= 30);
    assert.equal(game.inventory.includes(apple), false);
});

test('reading a fortune cookie grants nutrition and literacy', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.uhunger = 900;
    game.u.uconduct = {};
    const cookie = knownInventoryObject(FORTUNE_COOKIE, {
        age: game.moves,
    });
    pushKeys('a    ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uhunger, 940);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(game.inventory.includes(cookie), false);
});

test('a tainted corpse is consumed and starts fatal sickness', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.moves = 1000;
    const corpse = knownInventoryObject(CORPSE, {
        age: 1,
        corpsenm: 70,
        name: 'goblin corpse',
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(!!game._occupation, false);
    assert.ok(game.u.sickTurns >= 10);
    assert.ok(game.u.sickTurns <= 19);
    assert.ok(game.u.sickType & SICK_VOMITABLE);
    assert.match(game._pending_message, /tainted/);
});
