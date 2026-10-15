import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { FIRE_HORN } from '../js/object_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

void test('a fatal self-directed horn records its native cause without an extra article', async () => {
    freshTurnRoom({
        hero: { uhp: 1, uhpmax: 100, urexp: 100 },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    const horn = await addInventoryObject(FIRE_HORN, { spe: 2 });
    pushKeys(`a${horn.invlet}y .${' '.repeat(100)}`);

    await moveloop_core();

    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death,
        `killed by using a magical horn on ${game.flags.female ? 'herself' : 'himself'}`);
});
