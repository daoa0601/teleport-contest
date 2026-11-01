import assert from 'node:assert/strict';
import test from 'node:test';
import { P_BASIC, P_FLAIL, P_SKILLED, P_TWO_WEAPON_COMBAT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GRAPPLING_HOOK } from '../js/object_data.js';
import { canBeginTwoWeaponCombat } from '../js/two_weapon.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/wield.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const twoWeapons of [false, true]) {
    void test(`grappling range uses ${twoWeapons ? 'two-weapon' : 'flail'} skill in the active combat mode`, async () => {
        await freshObjectRoom({ role: 'rogue', iflags: { bgcolors: true }, flags: { tips: false, verbose: false } });
        const hook = await addInventoryObject(GRAPPLING_HOOK);
        const dagger = await addInventoryObject(DAGGER);
        await setPrimaryWeapon(hook);
        await setSecondaryWeapon(dagger);
        installHeroWeaponSkills({ [P_FLAIL]: P_BASIC, [P_TWO_WEAPON_COMBAT]: P_SKILLED });
        assert.equal(await canBeginTwoWeaponCombat(game), true);
        setTwoWeaponCombat(twoWeapons);
        const input = resetInputState();
        const action = applyInventoryObject(hook, '$$');
        await input.waitUntilBlocked();

        try {
            // Two columns and one row away is squared distance five:
            // reachable at Skilled, beyond the Basic range of four.
            assert.equal(requireScreenCell(11, 12).ch, twoWeapons ? '$' : '.');
        } finally {
            input.feed('\x1b');
            await action;
        }
    });
}
