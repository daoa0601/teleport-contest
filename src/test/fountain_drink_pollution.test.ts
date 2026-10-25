import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';

// fountain.c:drinkfountain() fate 20: morehungry(rn1(20, 11)) then vomit()
// leaves the hero helpless for two turns.
void test('foul fountain water costs nutrition and gags the hero for two turns', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = FOUNTAIN;
    const hunger = game.u.uhunger;
    resetInputState().feed('y' + ' '.repeat(20));
    initRng(91n);

    await rhack('q'.charCodeAt(0));

    assert.match(game._pending_message, /The water is foul!  You gag and vomit\./);
    assert.ok(game.u.uhunger <= hunger - 11 && game.u.uhunger >= hunger - 30,
        `Expected a nutrition loss between 11 and 30, got ${hunger - game.u.uhunger}`);
    assert.equal(game._helplessTurns, 2);
    assert.equal(game.context.move, 1);
});

// fountain.c:drinkfountain() fate 21 with Poison_resistance: the runoff
// message, rnd(4) juice damage, and none of poison_strdmg's strength loss.
void test('poison resistance turns contaminated water into fruit-farm runoff', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = FOUNTAIN;
    grantIntrinsicProperty('poisonResistance', 'outside');
    const hp = game.u.uhp;
    const strength = game.u.acurr.a[0];
    resetInputState().feed('y' + ' '.repeat(20));
    initRng(26n);

    await rhack('q'.charCodeAt(0));

    assert.match(game._pending_message,
        /Perhaps it is runoff from the nearby slime mold farm\./);
    assert.ok(hp - game.u.uhp >= 1 && hp - game.u.uhp <= 4,
        `Expected 1 to 4 damage from the unrefrigerated sip, got ${hp - game.u.uhp}`);
    assert.equal(game.u.acurr.a[0], strength, 'Resisted water costs no strength');
});
