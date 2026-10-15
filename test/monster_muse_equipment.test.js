import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { randomMiscMonsterItem } from '../js/muse.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const base of ['vampire', 'vampire leader', 'Vlad the Impaler']) {
    void test(`random equipment never gives life saving to a living form of ${base}`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        let ordinaryLifeSavers = 0;
        for (let seed = 1; seed <= 200; seed++) {
            monster.cham = -1;
            initRng(BigInt(seed));
            if (randomMiscMonsterItem(monster) === AMULET_OF_LIFE_SAVING)
                ordinaryLifeSavers++;
            monster.cham = MONSTER_NAME.indexOf(base);
            initRng(BigInt(seed));
            assert.notEqual(randomMiscMonsterItem(monster), AMULET_OF_LIFE_SAVING, `${base} must retain its undead life-saving restriction in a living body (seed ${seed})`);
        }
        assert.ok(ordinaryLifeSavers > 0, 'Living monsters must still be eligible for life saving');
    });
}
//# sourceMappingURL=monster_muse_equipment.test.js.map