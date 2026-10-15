import assert from 'node:assert/strict';
import test from 'node:test';
import { DBWALL, DB_MOAT, DB_NORTH, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, STONE } from '../js/const.js';
import { grantCorpseIntrinsic } from '../js/corpse_intrinsics.js';
import { openDrawbridge } from '../js/dbridge.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { formatHeardMessage, formatSeenMessage } from '../js/hero_speech.js';
import { finishWallPassageTimeout } from '../js/timeout_warnings.js';
import { freshPlayableRoom } from './support/playable-room.js';
for (const condition of ['awake', 'asleep', 'unconscious']) {
    void test(`wall passage ending inside rock reaches an ${condition} hero`, async () => {
        freshPlayableRoom();
        const level = requireGameLevel();
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx || dy)
                    level.requireAt(game.u.ux + dx, game.u.uy + dy).typ = STONE;
            }
        }
        if (condition === 'asleep')
            putHeroToSleep(5);
        if (condition === 'unconscious') {
            game._helplessTurns = 5;
            game._helplessDoneMessage = 'You regain consciousness.';
        }
        await finishWallPassageTimeout();
        assert.equal(game._lastPlineMessage, condition === 'awake'
            ? 'You feel hemmed in again.' : 'You dream that you feel hemmed in again.');
    });
}
void test('dreamed sounds bypass deafness and underwater hearing takes precedence over dreaming', () => {
    freshPlayableRoom();
    game.u.deafTurns = 5;
    assert.equal(formatHeardMessage('a bell.'), null);
    putHeroToSleep(5);
    assert.equal(formatHeardMessage('a bell.'), 'You dream that you hear a bell.');
    game.u.uinwater = true;
    assert.equal(formatHeardMessage('a bell.'), 'You barely hear a bell.');
    game.flags.acoustics = false;
    assert.equal(formatHeardMessage('a bell.'), null);
});
void test('seeing becomes sensing when blind and dreaming takes precedence over blindness', () => {
    freshPlayableRoom();
    assert.equal(formatSeenMessage('a flame.'), 'You see a flame.');
    game.u.blindTurns = 5;
    assert.equal(formatSeenMessage('a flame.'), 'You sense a flame.');
    putHeroToSleep(5);
    assert.equal(formatSeenMessage('a flame.'), 'You dream that you see a flame.');
});
void test('hallucination changes a corpse-granted dream to cosmic awareness', async () => {
    freshPlayableRoom();
    game.u.hallucinationTurns = 5;
    putHeroToSleep(5);
    await grantCorpseIntrinsic(MONSTER_NAME.indexOf('floating eye'));
    assert.equal(game._lastPlineMessage, 'You dream that you feel in touch with the cosmos.');
});
void test('an unaware hero dreams of the mental acuity gained from a floating eye corpse', async () => {
    freshPlayableRoom();
    putHeroToSleep(5);
    await grantCorpseIntrinsic(MONSTER_NAME.indexOf('floating eye'));
    assert.equal(game._lastPlineMessage, 'You dream that you feel a strange mental acuity.');
    assert.equal(game.u.telepathy, true);
});
for (const condition of ['asleep and deaf', 'acoustics disabled', 'asleep and sighted']) {
    void test(`a drawbridge opens with ${condition}`, async () => {
        const level = freshPlayableRoom();
        const bridge = level.requireAt(12, 10);
        bridge.typ = DRAWBRIDGE_UP;
        bridge.drawbridgemask = DB_NORTH | DB_MOAT;
        level.requireAt(12, 9).typ = DBWALL;
        if (condition !== 'asleep and sighted')
            setHeroBlindnessTurns(10);
        if (condition === 'asleep and deaf') {
            game.u.deafTurns = 10;
            putHeroToSleep(5);
        }
        else if (condition === 'acoustics disabled')
            game.flags.acoustics = false;
        else
            putHeroToSleep(5);
        vision_recalc(0);
        assert.equal(await openDrawbridge(12, 10), true);
        assert.equal(bridge.typ, DRAWBRIDGE_DOWN, 'Suppression must not prevent the bridge from moving');
        assert.equal(game._lastPlineMessage, condition === 'asleep and deaf'
            ? 'You dream that you hear gears turning and chains rattling.'
            : condition === 'asleep and sighted' ? 'You dream that you see a drawbridge coming down!' : '');
    });
}
void test('fire resistance from a corpse retains native You wording during sleep', async () => {
    freshPlayableRoom();
    putHeroToSleep(5);
    await grantCorpseIntrinsic(MONSTER_NAME.indexOf('red dragon'));
    assert.equal(game.u.fireResistance, true);
    assert.equal(game._lastPlineMessage, 'You feel a momentary chill.');
});
//# sourceMappingURL=hero_sensory_messages.test.js.map