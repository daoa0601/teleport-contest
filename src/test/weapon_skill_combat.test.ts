import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, P_DAGGER, P_EXPERT, P_UNSKILLED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { ensureHeroSkills } from '../js/skills.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function throwDagger(seed: number, dualWielding: boolean): Promise<number> {
    freshObjectRoom({ role: 'rogue', hero: { ulevel: 1 } });
    const target = await createMonsterAt('human zombie', 12, 10, MM_NOGRP | NO_MINVENT);
    target.mpeaceful = false;
    target.msleeping = 0;
    target.mhp = target.mhpmax = 100;
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    const daggerSkill = skills[P_DAGGER];
    const twoWeaponSkill = skills[36];
    assert.ok(daggerSkill && twoWeaponSkill);
    daggerSkill.skill = P_EXPERT;
    twoWeaponSkill.skill = P_UNSKILLED;
    await setPrimaryWeapon(await addInventoryObject(DAGGER, { spe: 1 }));
    await setSecondaryWeapon(await addInventoryObject(DAGGER, { spe: 2 }));
    game.u.twoweap = dualWielding;
    const missile = await addInventoryObject(DAGGER, { spe: 0 });
    installPagerInput(resetInputState(), { expected: /dagger|zombie|hit|miss/, limit: 12 });
    initRng(BigInt(seed));

    await throwInventoryObject(missile, 'l');

    return 100 - target.mhp;
}

void test('throwing a spare dagger uses dagger skill while the held pair remains dual wielded', async () => {
    let hits = 0;
    for (let seed = 1; seed <= 24; seed++) {
        const single = await throwDagger(seed, false);
        const dual = await throwDagger(seed, true);
        assert.equal(dual, single, `The spare dagger's attack changed when dual wielding, seed ${seed}`);
        if (single > 0) hits++;
    }
    assert.ok(hits > 0 && hits < 24, `Expected both hits and misses, received ${hits} hits`);
});
