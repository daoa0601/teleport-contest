import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { CLOAK_OF_PROTECTION, GAUNTLETS_OF_POWER, TWO_HANDED_SWORD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function status() {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}
void test('optional equipment fields describe an unarmed naked humanoid', async () => {
    freshObjectRoom({ flags: { weaponstatus: true, armorstatus: true }, hero: { uhs: 1 } });
    await bot();
    assert.match(status(), /Bare-hnds Naked/);
});
void test('optional equipment fields shorten weapons and show armor slots and protection', async () => {
    freshObjectRoom({ flags: { weaponstatus: true, armorstatus: true }, hero: { uhs: 1 } });
    game.uwep = await addInventoryObject(TWO_HANDED_SWORD);
    wearHeroArmor(await addInventoryObject(GAUNTLETS_OF_POWER));
    wearHeroArmor(await addInventoryObject(CLOAK_OF_PROTECTION));
    await bot();
    assert.match(status(), /2H-Sword GC\+/);
});
//# sourceMappingURL=status_equipment_fields.test.js.map