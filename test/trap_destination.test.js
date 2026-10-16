import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLE, TRAPDOOR } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
for (const invoked of [false, true]) {
    void test(`a trapdoor ${invoked ? 'can reach the sanctum after' : 'stops at the vibrating-square level before'} invocation`, async () => {
        freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 4 }, uevent: { invoked } } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 5, flags: { hellish: true } })];
        game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
        const trap = await maketrap(12, 10, TRAPDOOR);
        assert.ok(trap);
        assert.deepEqual(trap.dst, { dnum: 0, dlevel: invoked ? 5 : 4 });
    });
}
for (const type of [HOLE, TRAPDOOR]) {
    const name = type === HOLE ? 'holes' : 'trapdoors';
    for (const reachedLocate of [false, true]) {
        void test(`quest ${name} ${reachedLocate ? 'can fall past a previously reached' : 'stop at the unreached'} locate level`, async () => {
            let fellPastLocate = false;
            for (let seed = 1; seed <= 24; seed++) {
                freshObjectRoom({ gameplaySeed: seed });
                requirePlayingGame(game);
                await init_dungeons();
                const locate = game.specialLevels?.get('x-loca');
                assert.ok(locate, 'dungeon initialization must place the quest locate level');
                const quest = game.dungeons?.[locate.dnum];
                assert.ok(quest, 'the locate level must belong to a dungeon');
                game.u.uz = { dnum: locate.dnum, dlevel: locate.dlevel - 1 };
                quest.dunlev_ureached = reachedLocate ? locate.dlevel : locate.dlevel - 1;
                initRng(seed);
                const trap = await maketrap(12, 10, type);
                assert.ok(trap?.dst, `${name} must have a destination, seed ${seed}`);
                assert.equal(trap.dst.dnum, locate.dnum, `falls stay in the quest, seed ${seed}`);
                if (reachedLocate) {
                    assert.ok(trap.dst.dlevel >= locate.dlevel && trap.dst.dlevel <= quest.num_dunlevs, `${name} must fall between locate and the quest bottom, seed ${seed}: ${trap.dst.dlevel}`);
                    fellPastLocate ||= trap.dst.dlevel > locate.dlevel;
                }
                else {
                    assert.equal(trap.dst.dlevel, locate.dlevel, `${name} must stop at unreached locate, seed ${seed}`);
                }
            }
            if (reachedLocate)
                assert.ok(fellPastLocate, `${name} must allow falls past a reached locate level`);
        });
    }
}
//# sourceMappingURL=trap_destination.test.js.map