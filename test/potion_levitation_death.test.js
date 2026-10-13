import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_LEVITATION } from '../js/object_data.js';
import { quaff } from '../js/quaff.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('a fatal cursed levitation collision records the native cause without an article', async () => {
    freshObjectRoom({ hero: { uhp: 1, urexp: 100 }, flags: {
            bones: false, disclose: '-i -a -v -c -o', tombstone: false,
        } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    const potion = await addInventoryObject(POT_LEVITATION, { cursed: true });
    resetInputState().feed(potion.invlet + ' '.repeat(100));
    await quaff();
    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by colliding with the ceiling');
});
//# sourceMappingURL=potion_levitation_death.test.js.map