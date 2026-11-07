import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName, artifactDamageBonus, artifactToHitBonus, } from '../js/artifact.js';
import { drainObjectEnchantment } from '../js/zap.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BLACK_DRAGON_SCALE_MAIL, RED_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { heroSpecies } from '../js/polyself.js';
import { addInventoryItem } from '../js/invent.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const maximumRoll = (range) => range;
// C artifact.c:spec_applies() checks the defender through
// mondata.c:defended() (artifact.c:1036): a wielded artifact's defn or worn
// dragon scales, never an artifact that merely defends while carried.
// Carrying the Mitre of Holiness still blocks Fire Brand, but through the
// property system, not defended(): artifact.c:723/735
// set_artifact_intrinsic(W_ART) reads the cary field and sets
// EFire_resistance, and the hero branch that follows (artifact.c:1048-1049)
// reads plain Fire_resistance.
void test('a hero merely carrying the Mitre of Holiness still blunts Fire Brand', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const fireBrand = await artifactObject('Fire Brand');
    assert.ok(artifactByName('The Mitre of Holiness'));
    const mitre = await addInventoryItem(await artifactObject('The Mitre of Holiness'));
    assert.ok(game.inventory?.includes(mitre), 'the Mitre is carried, not wielded or worn');
    const defender = { mnum: heroSpecies(game) };
    assert.equal(artifactToHitBonus(fireBrand, defender, maximumRoll, { hero: true, state: game }), 0, 'EFire_resistance from carrying the Mitre already negates the attack');
    assert.equal(artifactDamageBonus(fireBrand, defender, 7, maximumRoll, { hero: true, state: game }), 0);
});
// C zap.c:drain_item() (zap.c:1392) refuses to drain any object for which
// artifact.c:defends(AD_DRLI, o) holds; the dragon-armor half of defends()
// converts dragon scale mail to scales by color, and black dragon armor
// resists level drain (artifact.c:668-670).
void test('black dragon scale mail keeps its enchantment against a life-drain zap', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const blackMail = await uninitializedObject(BLACK_DRAGON_SCALE_MAIL, { spe: 2 });
    const redMail = await uninitializedObject(RED_DRAGON_SCALE_MAIL, { spe: 2 });
    assert.equal(await drainObjectEnchantment(blackMail, { random: () => 99, byHero: true }), false);
    assert.equal(blackMail.spe, 2, 'defends(AD_DRLI, black dragon scale mail) shields the enchantment');
    assert.equal(await drainObjectEnchantment(redMail, { random: () => 99, byHero: true }), true);
    assert.equal(redMail.spe, 1, 'other dragon armor carries no drain defense');
});
//# sourceMappingURL=artifact_defends.test.js.map