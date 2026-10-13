import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT } from '../js/const.js';
import { POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_PARALYSIS, POT_SLEEPING, WAN_MAGIC_MISSILE, WAN_STRIKING } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const offensiveTypes = new Set([POT_ACID, POT_BLINDNESS, POT_CONFUSION,
    POT_PARALYSIS, POT_SLEEPING, WAN_MAGIC_MISSILE, WAN_STRIKING]);
for (const species of ['kobold leader', 'hobbit', 'guard']) {
    void test(`a ${species} can be born with an offensive magic item alongside its ordinary equipment`, async () => {
        let armed = 0;
        for (let seed = 1; seed <= 64; seed++) {
            freshObjectRoom({ gameplaySeed: seed });
            const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | MM_NOWAIT);
            if (monster.minvent.some(object => offensiveTypes.has(object.otyp)))
                armed++;
        }
        assert.ok(armed > 0, `${species} never received an offensive potion or wand across 64 births`);
    });
}
//# sourceMappingURL=monster_birth_offense.test.js.map