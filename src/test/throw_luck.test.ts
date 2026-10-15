import assert from 'node:assert/strict';
import test from 'node:test';

import { P_BASIC, P_DAGGER } from '../js/const.js';
import { game } from '../js/gstate.js';
import { DAGGER, LUCKSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const carryLuckstone of [false, true]) {
    void test(`a luckstone ${carryLuckstone ? 'improves' : 'is needed to improve'} an otherwise missed throw`, async () => {
        freshObjectRoom({ hero: { ulevel: 1, uluck: 0, uhitinc: 5 } });
        installHeroWeaponSkills({ [P_DAGGER]: P_BASIC });
        if (carryLuckstone) await addInventoryObject(LUCKSTONE);
        const dagger = await addInventoryWeapon(DAGGER);
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 20;
        initRng(4n);

        await throwInventoryObject(dagger, 'l', ' '.repeat(20));

        assert.equal(jackal.mhp < 20, carryLuckstone);
        assert.equal(game.context.move, 1);
    });
}
