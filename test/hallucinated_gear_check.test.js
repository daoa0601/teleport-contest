import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { checkMonsterGearNextTurn, initializeMonsterArmor, reassessMonsterArmor } from '../js/monworn.js';
import { SPLINT_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function perceivedMonsterAfterGearCheck(creation) {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 14, 10, MM_NOGRP | NO_MINVENT);
    soldier.mpeaceful = true;
    const armor = await knownObject(SPLINT_MAIL);
    await addObjectToMonsterInventory(soldier, armor);
    await initializeMonsterArmor(soldier);
    game.u.hallucinationTurns = 20;
    initRng(17n);
    if (creation)
        await initializeMonsterArmor(soldier);
    else {
        checkMonsterGearNextTurn(soldier);
        const result = await reassessMonsterArmor(soldier);
        assert.equal(result?.consumed, false);
    }
    newsym(soldier.mx, soldier.my);
    assert.ok(armor.owornmask, 'The existing suit stays worn.');
    const glyph = glyphAt(soldier.mx, soldier.my);
    assert.ok(glyph?.kind === 'monster');
    return glyph.mnum;
}
void test('unchanged armor checks preserve the same perceived identity during creation and later reassessment', async () => {
    // Both native passes inspect the same eligible slots and perceive a name
    // before deciding that each item is already worn or absent.
    const atCreation = await perceivedMonsterAfterGearCheck(true);
    const later = await perceivedMonsterAfterGearCheck(false);
    assert.equal(later, atCreation);
});
//# sourceMappingURL=hallucinated_gear_check.test.js.map