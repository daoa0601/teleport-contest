import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CORR } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('blindness expiry redraws a warm monster in a dark corridor through infravision', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    for (let x = 8; x <= 18; x++) {
        const location = game.level.requireAt(x, 10);
        location.typ = CORR;
        location.lit = false;
        location.waslit = false;
    }
    const dog = await createMonsterAt('little dog', 14, 10);
    dog.mcanmove = false;
    dog.mfrozen = 10;
    grantIntrinsicProperty('infravision', 'outside');
    setHeroBlindnessTurns(1);
    vision_reset();
    vision_recalc(0);
    newsym(14, 10);
    assert.notEqual(game.level.requireAt(14, 10).disp_ch, 'd');
    input.feed('..');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.blind, false);
    assert.equal(dog.mx, 14);
    assert.equal(game.level.requireAt(14, 10).disp_ch, 'd');
});
//# sourceMappingURL=sight_timeout_display.test.js.map