import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { GRAY_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('an energy vortex cooldown miss retains the preceding attack roll', async () => {
    const input = freshTurnRoom({ role: 'barbarian', left: 1, right: 18, top: 1, bottom: 18 });
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 500;
    wearHeroArmor(await addInventoryObject(GRAY_DRAGON_SCALE_MAIL));
    findArmorClass();
    const vortex = await createMonsterAt('energy vortex', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    vortex.mspec_used = 2;
    vortex.movement = 12;
    const messages = [];
    let replies = 0;
    input.beforeRead = () => {
        if (++replies > 50)
            throw new Error(`Unexpected input: ${game._pending_message}`);
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    initRng(25n);
    input.feed('m.');
    await moveloop_core();
    const nextTurn = moveloop_core();
    try {
        const awaitingInput = await Promise.race([
            input.waitUntilBlocked().then(() => true),
            nextTurn.then(() => false),
        ]);
        assert.equal(awaitingInput, true, 'the turn returns to command input after the two misses');
        const row = requireGameDisplay().grid[0];
        assert.ok(row);
        const topline = row.map(cell => cell.ch).join('');
        assert.doesNotMatch(topline, /--More--/);
        assert.match(topline, /energy vortex just misses!.*energy vortex just misses!/);
    }
    finally {
        input.feed('\x1b');
        await nextTurn;
    }
    installPagerInput(input, { expected: /energy vortex just misses!/, limit: 1 });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.equal(game.u.uhp, 500);
    assert.ok(!game.u.uswallow);
    assert.match(text, /energy vortex just misses!/);
    assert.doesNotMatch(text, /energy vortex misses!/, 'the unrolled engulf slot must also report the retained near miss');
});
//# sourceMappingURL=monster_attack_sequence.test.js.map