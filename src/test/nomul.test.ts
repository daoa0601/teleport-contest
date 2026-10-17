import assert from 'node:assert/strict';
import test from 'node:test';
import { finishHeroHelplessness, moveloop_core } from '../js/allmain.js';
import { stopDonning } from '../js/armor.js';
import { nomul } from '../js/command_state.js';
import { game } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { startRun } from '../js/runmode.js';
import { SPEED_BOOTS } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an involuntary delay ends running and queued commands', () => {
    freshObjectRoom();
    startRun(1, 0);
    game.context.travel = true;
    game._cannedCommands = [{ kind: 'swap-weapon' }];
    game.u.invulnerable = true;
    game.context.botl = false;

    nomul(-3);

    assert.equal(game.multi, -3);
    assert.equal(game._helplessTurns, 3);
    assert.equal(game.context.run, 0);
    assert.equal(game.context.travel, false);
    assert.equal(game.context.mv, false);
    assert.equal(game._cannedCommands.length, 0);
    assert.equal(game.u.invulnerable, false);
    assert.equal(game.context.botl, true);
});

void test('a shorter delay preserves sleep, protection, and pending commands', () => {
    freshObjectRoom();
    putHeroToSleep(8);
    game.u.invulnerable = true;
    game._cannedCommands = [{ kind: 'swap-weapon' }];
    game.context.botl = false;

    nomul(-2);

    assert.equal(game._helplessTurns, 8);
    assert.equal(game.multi, -8);
    assert.ok(game.u.usleep);
    assert.equal(game.u.invulnerable, true);
    assert.equal(game._cannedCommands.length, 1);
    assert.equal(game.context.botl, false);
});

void test('an equal delay clears sleep and protection without requesting a status refresh', () => {
    freshObjectRoom();
    putHeroToSleep(3);
    game.u.invulnerable = true;
    game.context.botl = false;

    nomul(-3);

    assert.equal(game.multi, -3);
    assert.equal(game.u.usleep, 0);
    assert.equal(game.u.invulnerable, false);
    assert.equal(game.context.botl, false);
});

void test('cancelling dressing wakes a sleeping hero and clears the old recovery message', async () => {
    const input = freshTurnRoom();
    const boots = await addInventoryObject(SPEED_BOOTS, { known: false });
    installPagerInput(input, { expected: /./, limit: 20 });
    input.feed(`W${boots.invlet}`);
    await moveloop_core();
    putHeroToSleep(1);
    input.feed(' '.repeat(20));

    await stopDonning();

    assert.equal(game.u.usleep, 0);
    assert.equal(game.uarmf, null);
    nomul(-1);
    await finishHeroHelplessness();
    assert.match(game._pending_message, /You can move again\./);
    assert.doesNotMatch(game._pending_message, /You wake up\./);
});

for (const sleepTurns of [1, 8]) {
    void test(`sleep for ${sleepTurns} turns shares dressing's delay and replaces its recovery message`, async () => {
        const input = freshTurnRoom();
        const boots = await addInventoryObject(SPEED_BOOTS, { known: false });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
        installPagerInput(input, { expected: /./, limit: 20 });
        input.feed(`W${boots.invlet}`);
        await moveloop_core();
        const remaining = game._helplessTurns ?? 0;
        putHeroToSleep(sleepTurns);
        const deadline = game.moves + Math.max(remaining, sleepTurns);
        input.feed(' '.repeat(100));

        for (let attempt = 0; attempt < 30 && game.moves < deadline; attempt++) {
            await moveloop_core();
            if (game.moves < deadline)
                assert.equal(boots.known, false, `Dressing finished ${deadline - game.moves} turns early`);
        }

        assert.equal(game.moves, deadline);
        assert.equal(boots.known, true);
        const feedback = [...messages, game._pending_message || game._retained_message].join('\n');
        assert.match(feedback, /You wake up\./);
        assert.doesNotMatch(feedback, /You finish your dressing maneuver\./);
    });
}
