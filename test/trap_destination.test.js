import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAPDOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
for (const invoked of [false, true]) {
    void test(`a trapdoor ${invoked ? 'can reach the sanctum after' : 'stops at the vibrating-square level before'} invocation`, async () => {
        freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 4 }, uevent: { invoked } } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 5 })];
        game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
        const trap = await maketrap(12, 10, TRAPDOOR);
        assert.ok(trap);
        assert.deepEqual(trap.dst, { dnum: 0, dlevel: invoked ? 5 : 4 });
    });
}
void test('quest trapdoors stop at the locate level until the hero has reached it', async () => {
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 2 } } });
        requirePlayingGame(game);
        game.quest_dnum = 0;
        game.dungeons = [createDungeon({ dname: 'The Quest', num_dunlevs: 6, dunlev_ureached: 2 })];
        assert.ok(game.urole);
        game.specialLevels = new Map([[`${game.urole.filecode}-loca`, createSpecialLevel({ dnum: 0, dlevel: 3 })]]);
        initRng(seed);
        const trap = await maketrap(12, 10, TRAPDOOR);
        assert.ok(trap);
        assert.deepEqual(trap.dst, { dnum: 0, dlevel: 3 }, `quest cutoff, seed ${seed}`);
    }
});
//# sourceMappingURL=trap_destination.test.js.map