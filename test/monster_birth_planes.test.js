import test from 'node:test';
import assert from 'node:assert/strict';
import { G_GENOD, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [plane, rejected, allowed] of [
    ['water', 'giant ant', 'water nymph'],
    ['fire', 'giant ant', 'fire ant'],
    ['air', 'giant ant', 'killer bee'],
    ['air', 'lurker above', 'floating eye'],
    ['earth', 'air elemental', 'earth elemental'],
    ['water', 'earth elemental', 'water elemental'],
]) {
    void test(`random creation on the ${plane} plane rejects ${rejected}`, async () => {
        freshObjectRoom({ gameplaySeed: 1n, hero: { ulevel: 30 } });
        game.astral_level = { dnum: 0, dlevel: 1, flags: { town: false }, alignment: null };
        game.sanctum_level = { dnum: 1, dlevel: 1, flags: { town: false }, alignment: null };
        const location = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
        if (plane === 'water')
            game.water_level = location;
        if (plane === 'fire')
            game.fire_level = location;
        if (plane === 'air')
            game.air_level = location;
        if (plane === 'earth')
            game.earth_level = location;
        const rejectedSpecies = MONSTER_NAME.indexOf(rejected);
        const allowedSpecies = MONSTER_NAME.indexOf(allowed);
        game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
            born: 0, died: 0,
            mvflags: species === rejectedSpecies ? 0 : G_GENOD,
        }));
        const rejectedBirth = await makemonAt(null, 12, 10, MM_NOGRP | MM_NOMSG | NO_MINVENT);
        assert.equal(rejectedBirth, null, `${rejected} cannot be randomly generated on this plane`);
        const allowedVital = game.mvitals[allowedSpecies];
        assert.ok(allowedVital);
        allowedVital.mvflags = 0;
        const allowedBirth = await makemonAt(null, 12, 10, MM_NOGRP | MM_NOMSG | NO_MINVENT);
        assert.ok(allowedBirth, `${allowed} can be generated on this plane`);
        assert.equal(allowedBirth.mnum, allowedSpecies);
    });
}
//# sourceMappingURL=monster_birth_planes.test.js.map