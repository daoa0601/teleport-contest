import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_BLANK_PAPER, SPE_NOVEL } from '../js/object_data.js';
import { objectWeight } from '../js/weight.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('water erases a novel title and leaves an ordinary blank spellbook of the right weight', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const novel = await addInventoryObject(SPE_NOVEL);
    assert.ok(novel.oextra?.oname, 'The novel must have a title before it gets wet.');
    resetInputState();
    await runExtendedCommand('dip', novel.invlet + 'y' + ' '.repeat(20));
    assert.equal(novel.otyp, SPE_BLANK_PAPER);
    assert.equal(novel.novelidx, 0);
    assert.equal(novel.oextra?.oname, undefined);
    assert.equal(novel.owt, objectWeight(novel));
});
//# sourceMappingURL=potion_novel_dip.test.js.map