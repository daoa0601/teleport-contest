import { ensureQuestStatus } from '../js/quest.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { CORR } from '../js/const.js';
import { flushPendingTopline, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { artifactObject } from './support/game-objects.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryItem } from '../js/u_init.js';
import { installPagerInput } from './support/pager-input.js';

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

void test('regaining sight on timeout preserves counted searching without a stop message', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(1);
    input.feed('3s');
    await moveloop_core();
    assert.ok(game._occupation);
    input.display = {
        async readKey(): Promise<number> {
            assert.fail(`Counted searching requested another key: ${
                game._pending_message || game._retained_message}`);
        },
    };

    await moveloop_core();

    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.blind, false);
    assert.ok(game._occupation, 'regaining sight interrupted the remaining searches');
    assert.ok(game.multi > 0);
    assert.match(game._pending_message || game._retained_message, /You can see again\./);
    assert.doesNotMatch(game._pending_message || game._retained_message, /You stop searching\./);
});

void test('blindness expiry preserves counted searching when the Eyes kept the hero sighted', async () => {
    const input = freshTurnRoom({ role: 'monk', hero: {
        ualign: { type: 0, record: 0 }, uhp: 100, uhpmax: 100,
    } });
    requirePlayingGame(game);
    ensureQuestStatus().touched_artifact = true;
    const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
    installPagerInput(input, { expected: /Eyes|vision/, limit: 4 });
    await applyInventoryObject(eyes);
    await flushPendingTopline();
    input.display = null;
    setHeroBlindnessTurns(1);
    assert.equal(game.blind, false);
    input.feed('3s');
    await moveloop_core();
    assert.ok(game._occupation);

    input.feed('  .');
    await moveloop_core();

    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.blind, false);
    assert.ok(game._occupation, 'searching stopped even though sight never changed');
    assert.ok(game.multi > 0);
});
