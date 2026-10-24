import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPL_FIERY, EXPL_FROSTY } from '../js/const.js';
import { explode } from '../js/explosion.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
const SCROLL_CLASS = 9;
for (const { source, type, objectClass, style, cause } of [
    { source: 'a fire scroll', type: 11, objectClass: SCROLL_CLASS, style: EXPL_FIERY, cause: 'burned by a tower of flame' },
    { source: 'a pyrolisk egg', type: -11, objectClass: 0, style: EXPL_FIERY, cause: 'burned by a fireball' },
    { source: 'a cold explosion', type: -22, objectClass: 0, style: EXPL_FROSTY, cause: 'killed by ball of cold' },
]) {
    void test(`death from ${source} uses the native death reason and killer article`, async () => {
        freshObjectRoom({
            hero: { uhp: 1, uhpmax: 100, urexp: 100 },
            flags: { bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
        });
        game.storage = memoryStorage();
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
        pushKeys(' '.repeat(80));
        const result = await explode(10, 10, type, 20, objectClass, style);
        assert.equal(result.heroDied, true);
        assert.equal(loadScoreRecords()[0]?.death, cause);
    });
}
//# sourceMappingURL=explosion_death_cause.test.js.map