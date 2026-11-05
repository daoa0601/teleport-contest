import test from 'node:test';
import assert from 'node:assert/strict';
import { retouchEquipment } from '../js/artifact.js';
import { wearHeroAccessory, wearHeroArmor } from '../js/do_wear.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { LEATHER_GLOVES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
const SILVER = 14;
// The ring class is shuffled each game, so this session's silver ring is
// whichever ring type drew the silver material.
async function silverRingType() {
    assert.ok(game.objectMaterials);
    const type = game.objectMaterials.findIndex((material, otyp) => otyp >= 173 && otyp <= 200 && material === SILVER);
    assert.ok(type >= 173, 'The shuffled ring class must contain a silver ring');
    return type;
}
// C artifact.c:retouch_equipment(): when the touch pass unwears one of the
// hero's rings, still-worn cursed gloves are un-cursed so the ring loss reads
// as a deliberate removal rather than a curse-frozen hand.
void test('a silver ring rejected in retouch unwears and un-curses cursed gloves', async () => {
    await freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    installPolymorphedHero('vampire', { hitPoints: 200, maxHitPoints: 200 });
    const gloves = await addInventoryObject(LEATHER_GLOVES, { cursed: true });
    await wearHeroArmor(gloves);
    const ring = await addInventoryObject(await silverRingType(), { spe: 0 });
    await wearHeroAccessory(ring, 'uleft');
    assert.equal(game.uleft, ring);
    assert.equal(gloves.cursed, true);
    pushKeys(' '.repeat(4));
    const result = await retouchEquipment(0);
    assert.equal(result.died, false);
    assert.equal(game.uleft ?? null, null, 'the silver ring is unworn');
    assert.ok(game.inventory.includes(ring), 'the ring stays in the pack');
    assert.equal(gloves.cursed, false, 'cursed gloves are un-cursed after the ring loss');
    assert.ok(game.uarmg === gloves || game.u.uarmg === gloves, 'the gloves stay worn');
});
//# sourceMappingURL=artifact_retouch_gloves.test.js.map