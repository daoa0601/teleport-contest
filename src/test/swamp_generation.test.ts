import assert from 'node:assert/strict';
import test from 'node:test';
import { POOL, SWAMP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { levelStairs } from './support/level-state.js';
import { createDungeon } from './support/topology.js';

void test('ordinary level generation can make swamps with alternating pools and aquatic residents', async () => {
    let swamps = 0;
    for (let seed = 1; seed <= 128 && swamps < 2; seed++) {
        const state = freshGame({ moves: 0, flags: { bones: false }, hero: {
            uz: { dnum: 0, dlevel: 20 }, ulevel: 20,
        } });
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
        initRng(999);
        init_objects();
        initRng(seed);

        await mklev();

        const level = state.level;
        const rooms = level.rooms.filter(isRoom).filter(room => room.rtype === SWAMP);
        if (!rooms.length) continue;
        assert.equal(level.flags.has_swamp, true);
        let pools = 0;
        for (const room of rooms) {
            assert.equal(levelStairs(game).some(stair => stair.sx >= room.lx
                && stair.sx <= room.hx && stair.sy >= room.ly && stair.sy <= room.hy), false);
            for (let x = room.lx; x <= room.hx; x++) {
                for (let y = room.ly; y <= room.hy; y++) {
                    if (level.requireAt(x, y).typ !== POOL) continue;
                    pools++;
                    assert.equal((x + y) % 2, 1);
                    assert.equal(level.traps.some(trap => trap.tx === x && trap.ty === y), false);
                }
            }
        }
        assert.ok(pools > 0, `swamp rooms must contain water (seed ${seed})`);
        assert.ok(level.monsters.some(monster =>
            ['giant eel', 'piranha', 'electric eel'].includes(MONSTER_NAME[monster.mnum] ?? '')
            && level.requireAt(monster.mx, monster.my).typ === POOL),
        `the swamp must have an aquatic resident (seed ${seed})`);
        swamps++;
    }
    assert.ok(swamps > 0, 'deep ordinary levels must be able to generate a swamp');
});
