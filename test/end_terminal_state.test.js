import assert from 'node:assert/strict';
import test from 'node:test';
import { GENOCIDED, PANICKED, TRICKED } from '../js/const.js';
import { finishHeroDeath } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { AMULET_OF_LIFE_SAVING, POT_HEALING } from '../js/object_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
function endingRoom(debug = false) {
    freshObjectRoom({
        hero: { urexp: 100 }, flags: { debug, bones: false, disclose: 'none', tombstone: false },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const screens = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            screens.push(screen);
            assert.ok(screens.length < 15, `Unexpected ending input: ${screen}`);
            return (screen.includes('Die?') ? 'y' : ' ').charCodeAt(0);
        },
    };
    return screens;
}
void test('wizard trickery returns to play without recording a fatal event', async () => {
    const screens = endingRoom(true);
    const hp = game.u.uhp;
    assert.equal(await finishHeroDeath({ killer: 'changed level file', deathType: TRICKED }), false);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.uhp, hp);
    assert.equal(game.u.umortality ?? 0, 0);
    assert.equal(screens.length, 0);
});
void test('panic bypasses life saving and object cleanup', async () => {
    const screens = endingRoom();
    const potion = await addInventoryObject(POT_HEALING, { in_use: true });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const hp = game.u.uhp;
    assert.equal(await finishHeroDeath({ killer: 'internal error', deathType: PANICKED }), true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.inventory.includes(potion), true);
    assert.equal(game.inventory.includes(amulet), true);
    assert.equal(game.u.uhp, hp);
    assert.equal(game.u.umortality ?? 0, 0);
    assert.equal(loadScoreRecords()[0]?.death, 'panic');
    assert.ok(screens.every(screen => !/But wait|You die\.\.\./.test(screen)));
});
void test('genocide without a caller killer uses the unprefixed native death name', async () => {
    endingRoom();
    await finishHeroDeath({ killer: '', deathType: GENOCIDED, deathLineShown: true });
    assert.equal(loadScoreRecords()[0]?.death, 'genocided');
});
//# sourceMappingURL=end_terminal_state.test.js.map