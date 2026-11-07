import assert from 'node:assert/strict';
import test from 'node:test';
import { finishLivingGame } from '../js/end.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { dodiscovered } from '../js/o_init.js';
import { AMULET_OF_REFLECTION, DIAMOND, RUBY, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
void test('escape lists gems by quantity before amulets', async () => {
    await freshObjectRoom();
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
// C end.c:1503-1507: the escaped/ascended valuables listing calls
// discover_object(otyp, TRUE, TRUE, FALSE), so a listed type is marked
// encountered as well as known. o_init.c:844 prints discoveries without the
// '*' prefix for encountered types.
void test('escaped valuables count as encountered in the discoveries list', async () => {
    await freshObjectRoom();
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -g -c -o';
    const sack = await addInventoryObject(SACK, {
        initialize: false, contents: [], olocked: false, otrapped: false,
    });
    const ruby = await knownObject(RUBY, {
        initialize: false, typeKnown: false, where: 'contained', container: sack,
    });
    sack.contents = [ruby];
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await finishLivingGame('escaped');
    input.beforeRead = null;
    const showing = dodiscovered();
    await input.waitUntilBlocked();
    const text = (game.nhDisplay?.grid ?? [])
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    input.feed(' ');
    await showing;
    assert.doesNotMatch(text, /\* ruby/);
    assert.match(text, /  ruby/);
});
//# sourceMappingURL=escape_valuables.test.js.map