import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { EXPENSIVE_CAMERA } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireScreenRow } from './support/screen.js';
// C uhitm.c flash_hits_mon() ends with display_nhwindow(WIN_MESSAGE, TRUE)
// when the flash produced feedback on an unlit square, and that window's
// dismissal clears the topline instead of leaving the last page visible.
void test('a camera flash on a dark square clears the topline after its pages are dismissed', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    await createMonsterAt('flaming sphere', 11, 10);
    requireGameLevel().requireAt(11, 10).lit = false;
    const camera = await addInventoryObject(EXPENSIVE_CAMERA);
    input.feed(`a${camera.invlet}l  `);
    await rhack(0);
    const dismissed = requireScreenRow(0).map(cell => cell.ch).join('');
    assert.equal(dismissed.trim(), '');
    assert.equal(game._retained_message ?? '', '');
});
//# sourceMappingURL=camera_flash_message_window.test.js.map