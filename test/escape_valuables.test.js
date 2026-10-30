import assert from 'node:assert/strict';
import test from 'node:test';
import { finishLivingGame } from '../js/end.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_REFLECTION, DIAMOND, RUBY } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
void test('escape lists gems by quantity before amulets', async () => {
    freshObjectRoom();
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -g -c -o';
    await addInventoryObject(AMULET_OF_REFLECTION, { initialize: false });
    await addInventoryObject(RUBY, { initialize: false });
    await addInventoryObject(DIAMOND, { initialize: false, quan: 2 });
    const pages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
        input.feed(' ');
    };
    await finishLivingGame('escaped');
    const summary = pages.find(page => page.includes('2 diamonds')) ?? '';
    assert.match(summary, /2 diamonds.*\n.*1 ruby.*\n.*1 amulet of reflection/);
});
//# sourceMappingURL=escape_valuables.test.js.map