import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGIC_PORTAL, UTOTYPE_RMPORTAL } from '../js/const.js';
import { game, resetGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishScheduledLevelChange, scheduleLevelChange } from '../js/level_change.js';
import { restoreGame, saveGame } from '../js/save.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';

void test('restoring a deferred stair descent completes it at the destination stairs', async () => {
    freshConnectedLevels();
    game.plname = 'Descending';
    scheduleLevelChange([{ dnum: 0, dlevel: 2 }, { arrival: 'stairs' }]);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();
    initRng(44n);
    assert.equal(restoreGame('Descending', storage), true);
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        assert.ok(++reads < 20, `Unexpected arrival prompt: ${game._pending_message}`);
        input.feed(' ');
    };

    await finishScheduledLevelChange();

    assert.equal(game.u.uz?.dlevel, 2);
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 10);
});

for (const removePortal of [false, true]) {
    void test(`restoring a deferred portal arrival ${removePortal ? 'removes the sealed portal' : 'keeps the portal as its destination'}`, async () => {
        const { destination } = freshConnectedLevels();
        addTrap(destination, MAGIC_PORTAL, 13, 10);
        game.plname = 'Portaling';
        scheduleLevelChange([{ dnum: 0, dlevel: 2 }, { arrival: 'portal' }]);
        if (removePortal) game.u.utotype = (game.u.utotype ?? 0) | UTOTYPE_RMPORTAL;
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        resetGame();
        initRng(44n);
        assert.equal(restoreGame('Portaling', storage), true);

        await finishScheduledLevelChange();

        assert.equal(game.u.uz?.dlevel, 2);
        assert.equal(game.u.ux, 13);
        assert.equal(game.u.uy, 10);
        assert.equal(game.level?.traps.some(trap => trap.ttyp === MAGIC_PORTAL), !removePortal);
    });
}
