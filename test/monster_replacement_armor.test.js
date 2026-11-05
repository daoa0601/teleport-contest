import test from 'node:test';
import assert from 'node:assert/strict';
import { I_SPECIAL, NO_MINVENT, W_ARM, W_ARMU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initializeMonsterArmor, removeObjectFromMonsterInventory, wornInSlot } from '../js/worn.js';
import { checkMonsterGearNextTurn, reassessMonsterArmor } from '../js/mon.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { OBJECT_NAMES, SPLINT_MAIL } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const HAWAIIAN_SHIRT = OBJECT_NAMES.indexOf('Hawaiian shirt');
void test('a hostile monster re-equips only once it believes the hero is far away', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    assert.ok(await addObjectToMonsterInventory(soldier, await knownObject(SPLINT_MAIL)));
    assert.ok(await addObjectToMonsterInventory(soldier, await knownObject(SPLINT_MAIL)));
    await initializeMonsterArmor(soldier);
    const worn = wornInSlot(soldier, W_ARM);
    const spare = (soldier.minvent ?? []).find(object => object !== worn);
    assert.ok(worn && spare, 'The soldier carries a worn suit and a spare.');
    assert.ok((soldier.misc_worn_check ?? 0) & W_ARM, 'The best suit is worn at creation.');
    // extract_from_minvent() flags the soldier to re-equip on its next move
    // (worn.c:1411 check_gear_next_turn()).
    await removeObjectFromMonsterInventory(soldier, worn);
    assert.ok((soldier.misc_worn_check ?? 0) & I_SPECIAL, 'Losing worn gear arms the next-move check.');
    // mon.c:1276-1277: hostiles only equip when mpeaceful || mtame
    // || dist2(mx, my, mux, muy) > 3*3; the flag stays set otherwise.
    soldier.mux = soldier.mx;
    soldier.muy = soldier.my;
    const near = await reassessMonsterArmor(soldier);
    assert.equal(near, null);
    assert.ok((soldier.misc_worn_check ?? 0) & I_SPECIAL, 'A nearby hero leaves the flag armed.');
    assert.equal((soldier.misc_worn_check ?? 0) & W_ARM, 0);
    soldier.mux = (soldier.mx ?? 0) + 10;
    const far = await reassessMonsterArmor(soldier);
    assert.equal(far?.change?.slot, 'uarm');
    assert.equal(far?.change?.best, spare);
    // m_dowear_type() spends the donning delay (m_frozen = oc_delay), and
    // movemon's `misc_worn_check != oldworn || !mcanmove` consumes the turn.
    assert.ok((far?.change?.delay ?? 0) > 0);
    assert.equal(soldier.mfrozen, far?.change?.delay);
    assert.ok((soldier.misc_worn_check ?? 0) & W_ARM);
    assert.equal(far?.consumed, true);
    assert.equal((soldier.misc_worn_check ?? 0) & I_SPECIAL, 0, 'The re-equip clears the check flag.');
});
void test('a monster never puts a shirt on under an already worn suit', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const suit = await addObjectToMonsterInventory(soldier, await knownObject(SPLINT_MAIL));
    assert.ok(suit);
    await initializeMonsterArmor(soldier);
    assert.ok((soldier.misc_worn_check ?? 0) & W_ARM);
    const shirt = await addObjectToMonsterInventory(soldier, await knownObject(HAWAIIAN_SHIRT));
    assert.ok(shirt);
    soldier.mux = (soldier.mx ?? 0) + 10;
    checkMonsterGearNextTurn(soldier);
    const underSuit = await reassessMonsterArmor(soldier);
    // m_dowear() skips m_dowear_type(W_ARMU) when misc_worn_check has W_ARM
    // (worn.c:778 "can't put on shirt if already wearing suit").
    assert.equal(underSuit?.change ?? null, null);
    assert.equal(underSuit?.consumed, false);
    assert.equal((soldier.misc_worn_check ?? 0) & W_ARMU, 0);
    // Without the suit the shirt is wearable.
    await removeObjectFromMonsterInventory(soldier, suit);
    const shirtOnly = await reassessMonsterArmor(soldier);
    assert.equal(shirtOnly?.change?.slot, 'uarmu');
    assert.ok((soldier.misc_worn_check ?? 0) & W_ARMU);
});
//# sourceMappingURL=monster_replacement_armor.test.js.map