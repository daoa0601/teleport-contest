import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/do_wear.js';
import { game } from '../js/gstate.js';
import { attributeEnlightenmentLines } from '../js/insight.js';
import { OBJECT_NAMES, SPE_MAGIC_MISSILE } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
const CRYSTAL_PLATE_MAIL = OBJECT_NAMES.indexOf('crystal plate mail');
const PLATE_MAIL = OBJECT_NAMES.indexOf('plate mail');
function spellCastingLines() {
    return attributeEnlightenmentLines()
        .filter(line => line.includes('spell casting'));
}
// C insight.c:1819-1829: the attribute report borrows percent_success()'s
// suit test, is_metallic(uarm), which objclass.h bounds to iron..mithril.
// Crystal plate mail is glass armor: hard (do_wear.c hard_helmet's
// is_crackable) but not metallic, so it must not impair spell casting.
void test('attributes: crystal plate mail does not impair spell casting', async () => {
    freshGameplayRoom({ role: 'wizard' });
    forceLearnSpell(SPE_MAGIC_MISSILE);
    await wearHeroArmor(await addInventoryObject(CRYSTAL_PLATE_MAIL));
    assert.equal(game.uarm?.otyp, CRYSTAL_PLATE_MAIL);
    const lines = spellCastingLines();
    assert.equal(lines.some(line => line.includes('impaired by metallic armor')), false);
});
// The iron suit keeps the impairment line, including the robe mitigation.
void test('attributes: iron plate mail impairs spell casting', async () => {
    freshGameplayRoom({ role: 'wizard' });
    forceLearnSpell(SPE_MAGIC_MISSILE);
    await wearHeroArmor(await addInventoryObject(PLATE_MAIL));
    assert.equal(game.uarm?.otyp, PLATE_MAIL);
    const lines = spellCastingLines();
    assert.equal(lines.some(line => line.includes('impaired by metallic armor')), true);
});
//# sourceMappingURL=enlightenment_metallic_armor.test.js.map