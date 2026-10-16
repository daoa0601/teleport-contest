import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, G_GONE, LEPREHALL,
} from '../js/const.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { createDungeon } from './support/topology.js';

async function generateLevel(seed: number, unavailable: readonly string[] = []) {
    const state = freshGame({ moves: 0, flags: { bones: false }, hero: {
        uz: { dnum: 0, dlevel: 20 }, ulevel: 20,
    } });
    state.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30,
        themeRooms: 'themerms.lua' })];
    for (const name of unavailable) {
        const vital = state.mvitals[MONSTER_NAME.indexOf(name)];
        assert.ok(vital, `missing monster vital for ${name}`);
        vital.mvflags |= G_GONE;
    }
    initRng(999);
    init_objects();
    initRng(seed);
    await mklev();
    return state.level.rooms.filter(isRoom);
}

for (const { name, type, seed, species } of [
    { name: 'leprechaun hall', type: LEPREHALL, seed: 15, species: ['leprechaun'] },
    { name: 'beehive', type: BEEHIVE, seed: 67, species: ['killer bee'] },
    { name: 'anthole', type: ANTHOLE, seed: 52, species: ['soldier ant', 'fire ant', 'giant ant'] },
    { name: 'barracks', type: BARRACKS, seed: 17, species: ['soldier'] },
    { name: 'cockatrice nest', type: COCKNEST, seed: 48, species: ['cockatrice'] },
]) {
    void test(`level generation skips a ${name} when its population is unavailable`, async () => {
        const populated = await generateLevel(seed);
        assert.ok(populated.some(room => room.rtype === type), `control level needs a ${name}`);

        const depleted = await generateLevel(seed, species);

        assert.equal(depleted.some(room => room.rtype === type), false,
            `a ${name} requires an available population`);
    });
}
