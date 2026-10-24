import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { HELMET, LEATHER_GLOVES, POT_BOOZE, POT_HEALING, SPEED_BOOTS, WAN_FIRE } from '../js/object_data.js';
import { recordObjectEncounter, recordObjectKnowledge } from '../js/object_knowledge.js';
import { applyNethackrc } from '../js/options.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const mode of ['c', 'a', '2', '3']) {
    void test(`sortdiscoveries:${mode} alphabetizes discoveries and ignores their encounter markers`, async () => {
        freshObjectRoom();
        applyNethackrc(`OPTIONS=sortdiscoveries:${mode}`);
        recordObjectKnowledge(POT_HEALING);
        recordObjectKnowledge(POT_BOOZE);
        recordObjectEncounter(POT_BOOZE);
        recordObjectKnowledge(WAN_FIRE);
        const input = resetInputState();
        let text = '';
        input.display = {
            async readKey() {
                text += requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                return 32;
            },
        };
        try {
            await rhack('\\'.charCodeAt(0));
            assert.match(text, /Discoveries, alphabetical/);
            assert.ok(text.indexOf('potion of booze') < text.indexOf('potion of healing'));
            assert.equal(/\nPotions /.test(text), mode === 'c' || mode === '2');
            assert.equal(game.context.move, 0);
        }
        finally {
            input.display = null;
        }
    });
}
void test('sortloot discoveries group armor by slot and observe their temporary type views', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=sortdiscoveries:s');
    recordObjectKnowledge(SPEED_BOOTS);
    recordObjectKnowledge(LEATHER_GLOVES);
    recordObjectKnowledge(HELMET);
    const input = resetInputState();
    let text = '';
    input.display = {
        async readKey() {
            text += requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            return 32;
        },
    };
    try {
        await rhack('\\'.charCodeAt(0));
        assert.match(text, /Discoveries, sortloot order/);
        assert.ok(text.indexOf('helmet (') < text.indexOf('pair of leather gloves'));
        assert.ok(text.indexOf('pair of leather gloves') < text.indexOf('pair of speed boots'));
        assert.equal(game._encounteredObjectTypes?.has(HELMET), true);
    }
    finally {
        input.display = null;
    }
});
void test('the menu prefix chooses and retains the discovery sort order', async (t) => {
    freshObjectRoom();
    recordObjectKnowledge(POT_HEALING);
    const input = resetInputState();
    input.feed('\\');
    planInput(input, t, [
        { prompt: /Ordering of discoveries/, keys: 'c' },
        { prompt: /Discoveries, alphabetical within each class/, keys: ' ' },
        { prompt: /Discoveries, alphabetical within each class/, keys: ' ' },
    ]);
    await rhack('m'.charCodeAt(0));
    await rhack('\\'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('the chosen discovery order survives saving and restoring', async () => {
    freshObjectRoom();
    game.plname = 'Discovery sorter';
    applyNethackrc('OPTIONS=sortdiscoveries:c');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    assert.equal(restoreGame('Discovery sorter', storage), true);
    assert.equal(game.flags.discosort, 'c');
});
//# sourceMappingURL=discovery_sort.test.js.map