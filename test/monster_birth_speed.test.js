import test from 'node:test';
import assert from 'node:assert/strict';
import { MFAST, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { mcalcmove } from '../js/monster_speed.js';
import { createDungeon } from './support/topology.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const hellish of [false, true]) {
    void test(`a raven keeps its natural movement rate when born ${hellish ? 'in Gehennom' : 'outside Gehennom'}`, async () => {
        freshObjectRoom();
        game.dungeons = [createDungeon({ dname: hellish ? 'Gehennom' : 'The Dungeons of Doom', flags: { hellish } })];
        const raven = await createMonsterAt('raven', 13, 10, NO_MINVENT);
        assert.equal(mcalcmove(raven, false), 20);
        assert.equal(raven.permspeed, 0);
    });
    for (const species of ['bat', 'giant bat', 'vampire bat']) {
        void test(`a ${species} ${hellish ? 'is permanently fast in Gehennom' : 'has normal speed outside Gehennom'}`, async () => {
            freshObjectRoom();
            game.dungeons = [createDungeon({ dname: hellish ? 'Gehennom' : 'The Dungeons of Doom', flags: { hellish } })];
            const bat = await createMonsterAt(species, 13, 10, NO_MINVENT);
            assert.equal(bat.mspeed, hellish ? MFAST : 0);
            assert.equal(bat.permspeed, hellish ? MFAST : 0);
        });
    }
}
//# sourceMappingURL=monster_birth_speed.test.js.map