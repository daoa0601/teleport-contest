import test from 'node:test';
import assert from 'node:assert/strict';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { SPLINT_MAIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('status recalculates carrying capacity when inventory changes before a turn ends', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u._encumbrance = 'Burdened';
    await addInventoryObject(SPLINT_MAIL, { quan: 3 });
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Stressed/);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Burdened/);
});
//# sourceMappingURL=status_encumbrance.test.js.map