import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import {
    DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP,
    D_CLOSED, D_ISOPEN, NO_MINVENT, PIT, STONE,
} from '../js/const.js';
import { grantCorpseIntrinsic } from '../js/corpse_intrinsics.js';
import { openDrawbridge } from '../js/dbridge.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resolveMonsterDoorPassage } from '../js/monster_door_passage.js';
import { setPropertyTimeout } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { finishWallPassageTimeout } from '../js/timeout_warnings.js';
import { maketrap } from '../js/mklev.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshPlayableRoom, freshTurnRoom } from './support/playable-room.js';

for (const cause of ['sleep', 'blackout'] as const) {
    void test(`wall passage ending inside rock reaches a hero during ${cause}`, async () => {
        const level = freshPlayableRoom();
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx || dy) level.requireAt(game.u.ux + dx, game.u.uy + dy).typ = STONE;
            }
        }
        if (cause === 'sleep') await putHeroToSleep(5);
        else {
            game._helplessTurns = 5;
            game._helplessDoneMessage = 'You regain consciousness.';
        }

        await finishWallPassageTimeout();

        assert.equal(game._lastPlineMessage, 'You dream that you feel hemmed in again.');
    });
}

for (const condition of ['underwater', 'asleep and deaf', 'acoustics disabled', 'asleep and sighted'] as const) {
    void test(`a drawbridge opens with the hero ${condition}`, async () => {
        const level = freshPlayableRoom();
        const bridge = level.requireAt(12, 10);
        bridge.typ = DRAWBRIDGE_UP;
        bridge.drawbridgemask = DB_NORTH | DB_MOAT;
        level.requireAt(12, 9).typ = DBWALL;
        if (condition !== 'asleep and sighted') setHeroBlindnessTurns(10);
        if (condition === 'underwater') game.u.uinwater = true;
        if (condition === 'asleep and deaf') setPropertyTimeout('deaf', 10);
        if (condition.startsWith('asleep')) await putHeroToSleep(5);
        if (condition === 'acoustics disabled') game.flags.acoustics = false;
        vision_recalc(0);

        assert.equal(await openDrawbridge(12, 10), true);

        assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
        const expected = condition === 'underwater' ? 'You barely hear gears turning and chains rattling.'
            : condition === 'asleep and deaf' ? 'You dream that you hear gears turning and chains rattling.'
                : condition === 'asleep and sighted' ? 'You dream that you see a drawbridge coming down!' : '';
        assert.equal(game._lastPlineMessage, expected);
    });
}

for (const asleep of [false, true]) {
    void test(`a blind clinger ${asleep ? 'dreams of' : 'senses'} a known pit below it`, async () => {
        freshPlayableRoom();
        installPolymorphedHero('wumpus');
        const trap = await maketrap(game.u.ux, game.u.uy, PIT);
        assert.ok(trap);
        trap.tseen = true;
        setHeroBlindnessTurns(10);
        if (asleep) await putHeroToSleep(5);

        await triggerHeroTrap(trap, { forceTrap: true });

        assert.equal(game.u.utrap ?? 0, 0);
        assert.equal(game._lastPlineMessage, asleep
            ? 'You dream that you see a pit below you.' : 'You sense a pit below you.');
    });
}

void test('a deaf unconscious hero gets no unseen door-opening message', async () => {
    const level = freshPlayableRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    setHeroBlindnessTurns(10);
    setPropertyTimeout('deaf', 10);
    game._helplessTurns = 5;
    game._helplessDoneMessage = 'You regain consciousness.';
    vision_recalc(0);
    requirePlayingGame(game);
    const messages: string[] = [];

    await resolveMonsterDoorPassage(monster, game, {
        canOpen: true, canUnlock: false, canTunnel: false, wasDoorVisible: false,
        publish: message => { messages.push(message); },
    });

    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(messages.length, 0);
});

for (const property of ['stunned', 'confusion'] as const) {
    void test(`${property} expiry stays silent while the hero is unaware`, async () => {
        freshTurnRoom();
        setPropertyTimeout(property, 1);
        await putHeroToSleep(5);

        await moveloop_core();
        await moveloop_core();

        assert.equal(property === 'stunned' ? game.u.stunnedTurns : game.u.confusionTurns, 0);
        assert.doesNotMatch(game._lastPlineMessage || '', /steadier|confused|wobbly|trippy/);
    });
}

void test('stun expiry describes a hallucinating hero as less wobbly', async () => {
    const input = freshTurnRoom();
    setPropertyTimeout('stunned', 1);
    setPropertyTimeout('hallucination', 10);
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game._lastPlineMessage, 'You feel less wobbly now.');
});

void test('a floating eye corpse gives a sleeping hero a dream of mental acuity', async () => {
    freshPlayableRoom();
    await putHeroToSleep(5);

    await grantCorpseIntrinsic(MONSTER_NAME.indexOf('floating eye'));

    assert.equal(game.u.telepathy, true);
    assert.equal(game._lastPlineMessage, 'You dream that you feel a strange mental acuity.');
});

void test('a red dragon corpse keeps its native You message during sleep', async () => {
    freshPlayableRoom();
    await putHeroToSleep(5);

    await grantCorpseIntrinsic(MONSTER_NAME.indexOf('red dragon'));

    assert.equal(game.u.fireResistance, true);
    assert.equal(game._lastPlineMessage, 'You feel a momentary chill.');
});
