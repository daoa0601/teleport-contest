import test from 'node:test';
import assert from 'node:assert/strict';
import { bot, flush_screen, plineWithContinuation } from '../js/display.js';
import { WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { SPLINT_MAIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
import { addTrap } from './support/level-state.js';
void test('status recalculates carrying capacity when inventory changes before a turn ends', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u._encumbrance = 'Burdened';
    await addInventoryObject(SPLINT_MAIL, { quan: 3 });
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Stressed/);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Burdened/);
});
void test('an ordinary pickup retains load status until a trap requests a status update', async () => {
    const level = freshObjectRoom();
    await bot();
    await addInventoryObject(SPLINT_MAIL, { quan: 3 });
    await flush_screen(1);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Stressed/);
    await plineWithContinuation('You have trouble lifting a heavy stack of armor from the ground.');
    const trap = addTrap(level, WEB, game.u.ux, game.u.uy);
    const input = resetInputState();
    let pages = 0;
    input.display = {
        async readKey() {
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /--More--/);
            assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Stressed/);
            pages++;
            return 32;
        },
    };
    await triggerHeroTrap(trap);
    assert.equal(pages, 1);
    assert.ok((game.u.utrap ?? 0) > 0);
});
//# sourceMappingURL=status_encumbrance.test.js.map