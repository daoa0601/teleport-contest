import { addTrap } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { PIT, SINK, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame, requireGameLevel } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { LEVITATION_BOOTS, OBJECT_NAMES, POT_LEVITATION } from '../js/object_data.js';
import { levitationAtWill, refreshProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput, finishAtCommandInput } from './support/pager-input.js';

const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');

function timedLevitation(turns: number) {
    game.u.levitationTurns = turns;
    refreshProperty('levitation');
}

function pitAt(x = game.u.ux, y = game.u.uy) {
    addTrap(requireGameLevel(game), PIT, x, y, { tseen: true });
}

void test('quaffing a blessed potion consumes it and lifts the hero out of a pit', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    pitAt();
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    const potion = await addInventoryObject(POT_LEVITATION, {
        invlet: 'a', blessed: true, dknown: true,
    });
    installPagerInput(resetInputState(), {
        expected: /You float up, out of the pit|start to float/,
        limit: 2,
    });
    pushKeys('a');
    await rhack('q'.charCodeAt(0));
    assert.equal(game.inventory.includes(potion), false);
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.levitating, true);
    assert.equal(levitationAtWill(), true);
    assert.equal(game._knownObjectTypes?.has(POT_LEVITATION), true);
    assert.equal(game.context.move, 1);
});

void test('putting on a ring over a sink crashes without announcing that it remains worn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = SINK;
    const ring = await addInventoryObject(RIN_LEVITATION, { invlet: 'a', dknown: true });
    const hp = game.u.uhp;
    installPagerInput(resetInputState(), { expected: /start to float|crash|You were wearing/, limit: 4 });
    pushKeys('al');
    await rhack('P'.charCodeAt(0));
    assert.equal(game.uleft, null);
    assert.equal(game.inventory.includes(ring), true);
    assert.equal(game.u.levitating, false);
    assert.ok(game.u.uhp < hp);
    assert.match(game._pending_message, /You were wearing/);
    assert.doesNotMatch(game._pending_message, /a - /);
});

void test('moving over a pit on the final levitation turn either defers or lands once', async () => {
    const outcomes = new Set();
    for (let seed = 1n; seed <= 16n; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        addTrap(requireGameLevel(game), PIT, game.u.ux + 1, game.u.uy, { tseen: false });
        timedLevitation(1);
        const hp = game.u.uhp;
        initRng(seed);
        installPagerInput(resetInputState(), {
            expected: /float gently to the floor|You fall into a pit/,
            limit: 2,
        });
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, 11);
        if (game.u.levitating) {
            outcomes.add('deferred');
            assert.equal(game.u.levitationTurns, 2);
            assert.equal(game.u.utrap || 0, 0);
            assert.equal(game.u.uhp, hp);
        } else {
            outcomes.add('landed');
            assert.equal(game.u.levitationTurns, 0);
            assert.ok(game.u.utrap !== undefined);
            assert.ok(game.u.utrap > 0);
            assert.equal(game.u.utraptype, TT_PIT);
            assert.ok(hp - game.u.uhp >= 1 && hp - game.u.uhp <= 6,
                'one pit landing deals 1..6 damage');
        }
    }
    assert.deepEqual(outcomes, new Set(['deferred', 'landed']));
});

void test('ordinary world time expires levitation and lands in the pit below', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    pitAt();
    timedLevitation(1);
    installPagerInput(input, { expected: /float gently to the floor|You fall into a pit/, limit: 2 });
    input.feed('.');
    await moveloop_core();
    await finishAtCommandInput(input, () => moveloop_core(), /float gently to the floor|You fall into a pit/);
    assert.equal(game.u.levitationTurns, 0);
    assert.equal(game.u.levitating, false);
    assert.ok(game.u.utrap !== undefined);
    assert.ok(game.u.utrap > 0);
    assert.equal(game.u.utraptype, TT_PIT);
});

void test('simultaneous levitation and fumbling expiry does not trip the airborne hero', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    timedLevitation(1);
    game.u.fumblingTurns = 1;
    installPagerInput(input, { expected: /float gently to the floor/, limit: 1 });
    input.feed('l');
    await moveloop_core();
    await finishAtCommandInput(input, () => moveloop_core(), /float gently to the floor/);
    assert.equal(game.u.levitating, false);
    input.feed('l');
    await moveloop_core();
    assert.equal(game.u.ux, 12, 'landing must not impose a fumbling delay');
});

void test('resuming recovery messages still runs the later levitation expiry', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    timedLevitation(1);
    game.u.stunnedTurns = 1;
    game.u.confusionTurns = 1;
    installPagerInput(input, {
        expected: /feel a bit steadier|feel less confused|float gently to the floor/,
        limit: 3,
    });
    input.feed('.');
    await moveloop_core();
    await finishAtCommandInput(input, () => moveloop_core(), /float gently to the floor/);
    assert.equal(game.u.stunnedTurns, 0);
    assert.equal(game.u.confusionTurns, 0);
    assert.equal(game.u.levitationTurns, 0);
    assert.equal(game.u.levitating, false);
});

void test('finishing a levitation-boots dressing delay lifts the hero out of a pit', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    pitAt();
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    await addInventoryObject(LEVITATION_BOOTS, { invlet: 'a', dknown: true });
    const input = resetInputState();
    installPagerInput(input, {
        expected: /finish.*dressing|You float up, out of the pit|levitation boots/,
        limit: 3,
    });
    pushKeys('Wa');
    await finishAtCommandInput(input, async () => {
        for (let step = 0; step < 6 && game.u.utrap; step++)
            await moveloop_core();
    }, /You finish your dressing maneuver|You float up, out of the pit|You float over a pit/);
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.levitating, true);
});

void test('the down command ends blessed levitation without needing a staircase', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await addInventoryObject(POT_LEVITATION, { invlet: 'a', blessed: true, dknown: true });
    installPagerInput(resetInputState(), { expected: /start to float|float gently to the floor/, limit: 2 });
    pushKeys('a');
    await rhack('q'.charCodeAt(0));
    await rhack('>'.charCodeAt(0));
    assert.equal(game.u.levitationTurns, 0);
    assert.equal(game.u.levitating, false);
    assert.equal(levitationAtWill(), false);
    assert.equal(game.context.move, 1);
});

void test('uncontrolled levitation refuses the down command without spending time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    timedLevitation(20);
    installPagerInput(resetInputState(), { expected: /floating high above the floor/, limit: 1 });
    await rhack('>'.charCodeAt(0));
    assert.equal(game.u.levitationTurns, 20);
    assert.equal(game.u.levitating, true);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /floating high above the floor/);
});

void test('the drop command refuses a worn levitation ring without changing its source', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(RIN_LEVITATION, { invlet: 'a', dknown: true });
    await wearHeroAccessory(ring, 'uleft');
    installPagerInput(resetInputState(), {
        expected: /start to float|cannot drop something you are wearing/,
        limit: 2,
    });
    pushKeys('a');
    await rhack('d'.charCodeAt(0));
    assert.equal(game.uleft, ring);
    assert.equal(game.inventory.includes(ring), true);
    assert.equal(game.u.levitating, true);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /cannot drop something you are wearing/);
});
