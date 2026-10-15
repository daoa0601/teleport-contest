import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { loadScoreRecords } from '../js/score_records.js';
import { runExtendedCommand } from './support/commands.js';
import { memoryStorage } from './support/memory-storage.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('a fatal mounting slip records the accident without a killer prefix', async () => {
    freshObjectRoom({
        role: 'knight',
        hero: { ulevel: 30, uhp: 1, uhpmax: 100, urexp: 100 },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    requirePlayingGame(game);
    const pony = await createSaddledSteed('pony', { saddle: { cursed: true } });
    game.plname = 'Rider';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    // The ending has disclosure and score pages after the slip message.
    await runExtendedCommand('ride', `l${' '.repeat(100)}`);
    assert.equal(game.program_state.gameover, true);
    assert.ok(!game.u.usteed);
    assert.ok(pony.mhp > 0);
    assert.equal(loadScoreRecords()[0]?.death, 'slipped while mounting a saddled pony');
});
//# sourceMappingURL=steed_mount_death.test.js.map