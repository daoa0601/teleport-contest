import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { throwMonsterWeaponAtHero } from '../js/monster_throw.js';
import { selectMonsterRangedWeapon } from '../js/monster_weapon.js';
import { DART } from '../js/object_data.js';
import { unlinkObject } from '../js/object_location.js';
import { uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';

void test('a visible single throw observes the remaining stack and keeps an unseen recovered dart separate', async () => {
    freshRangedCombatRoom({ recalculateVision: true });
    const source = await createMonsterAt('kobold lord', 9, 10, NO_MINVENT);
    const darts = await uninitializedObject(DART, {
        quan: 9, dknown: false, known: false, bknown: false, typeKnown: false,
    });
    await addObjectToMonsterInventory(source, darts);
    source.mux = 12;
    source.muy = 10;

    const volley = await throwMonsterWeaponAtHero(source, game, darts, {
        publish: async () => {}, random: bound => bound - 1, rollOne: () => 1,
    });
    const recovered = volley.shots[0]?.weapon;
    assert.ok(recovered);
    assert.equal(volley.shots.length, 1);
    source.minvis = true;
    unlinkObject(recovered);
    await addObjectToMonsterInventory(source, recovered);

    assert.equal(darts.quan, 8);
    assert.equal(recovered.quan, 1);
    assert.equal(source.minvent.length, 2);
    assert.equal(selectMonsterRangedWeapon(source)?.weapon, recovered);
});
