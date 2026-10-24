import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT, TRAPNUM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mfndpos } from '../js/monmove.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const type of [0, TRAPNUM]) {
    void test(`monster movement reports and avoids an invalid trap of type ${type}`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
        addTrap(level, type, 11, 10);
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, {
            expected: /very strange trap|Program in disorder|Please report/, limit: 4,
        });
        const destinations = await mfndpos(goblin, game);
        messages.push(game._pending_message);
        const reason = `A monster looked at a very strange trap of type ${type}.`;
        assert.ok(messages.some(message => message.includes(reason)), `Missing native trap diagnostic. Messages: ${messages.join('\n')}`);
        assert.equal(destinations.some(square => square.x === 11 && square.y === 10), false);
        assert.equal(destinations.some(square => square.x === 10 && square.y === 11), true, 'a malformed trap must not prevent movement to a valid neighboring square');
    });
}
void test('movement waits for the trap diagnostic before discovering the hero later in the scan', async () => {
    const level = freshObjectRoom({ heroX: 11, heroY: 10 });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
    goblin.mux = 15;
    goblin.muy = 12;
    addTrap(level, 0, 10, 9);
    const input = resetInputState();
    const searching = mfndpos(goblin, game);
    try {
        const completed = await Promise.race([
            searching.then(() => true),
            input.waitUntilBlocked().then(() => false),
        ]);
        assert.equal(completed, false, 'movement must wait for the diagnostic pager');
        assert.equal(goblin.mux, 15, 'the later hero square has not been examined yet');
        assert.equal(goblin.muy, 12);
    }
    finally {
        installPagerInput(input, {
            expected: /very strange trap|Program in disorder|Please report/, limit: 4,
        });
        input.feed(' ');
        await searching;
    }
    assert.equal(goblin.mux, game.u.ux);
    assert.equal(goblin.muy, game.u.uy);
});
//# sourceMappingURL=monster_movement_invalid_trap.test.js.map