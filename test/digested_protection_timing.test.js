import test from 'node:test';
import assert from 'node:assert/strict';
import { findArmorClass } from '../js/armor.js';
import { digestAccessory } from '../js/eaten_accessory.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { hasIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { uninitializedObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const meals = [
    { name: 'protection', enchantment: 4, protection: 4 },
    { name: 'amulet of guarding', enchantment: 0, protection: 2 },
];
for (const meal of meals) {
    void test(`digesting ${meal.name} defers its AC benefit until armor is reassessed`, async () => {
        await freshObjectRoom({ flags: { verbose: true, tips: false }, hero: { ublessed: 0 } });
        requirePlayingGame(game);
        installPolymorphedHero('xorn');
        const armorBeforeEating = findArmorClass();
        const accessory = await uninitializedObject(OBJECT_NAMES.indexOf(meal.name), { spe: meal.enchantment });
        installPagerInput(resetInputState(), { expected: /Magic spreads through your body/, limit: 1 });
        initRng(1n);
        await digestAccessory(accessory);
        assert.equal(hasIntrinsicProperty('protection', 'outside'), true);
        assert.equal(game.u.ublessed, meal.protection);
        assert.equal(game.u.uac, armorBeforeEating, 'the monster turn after eating must use the previous armor class');
        assert.equal(findArmorClass(), armorBeforeEating - meal.protection, 'the next armor assessment must include the digested protection');
    });
}
//# sourceMappingURL=digested_protection_timing.test.js.map