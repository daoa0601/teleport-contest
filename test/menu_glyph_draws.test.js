import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { setHeroGoldAmount } from '../js/sit.js';
import { DAGGER, OBJECT_NAMES } from '../js/object_data.js';
import { initRng, rn2Display } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';
// C shk.c:menu_pick_pay_items() and pickup.c:doloot_core() attach
// obj_to_glyph() metadata to their menu rows. The tty menu shows no glyph
// column, but under Hallucination the metadata construction consumes one
// display-RNG draw per row, which the draws following the menu reveal.
function displayStreamFingerprint() {
    const values = [];
    for (let index = 0; index < 4; index++)
        values.push(rn2Display(400));
    return values.join(',');
}
void test('a hallucinated pay-bill menu spends one object draw per bill entry', async (t) => {
    const afterOneEntry = await hallucinatedStreamAfterPayBill(1, t);
    const afterThreeEntries = await hallucinatedStreamAfterPayBill(3, t);
    assert.notEqual(afterThreeEntries, afterOneEntry, 'Three bill entries must advance the hallucination stream past one entry '
        + `(${afterThreeEntries} vs ${afterOneEntry})`);
});
void test('a hallucinated loot-container menu spends one object draw per container', async (t) => {
    const afterTwoContainers = await hallucinatedStreamAfterLootMenu(['sack', 'chest'], t);
    const afterThreeContainers = await hallucinatedStreamAfterLootMenu(['sack', 'chest', 'large box'], t);
    assert.notEqual(afterThreeContainers, afterTwoContainers, 'Three container rows must advance the hallucination stream past two '
        + `(${afterThreeContainers} vs ${afterTwoContainers})`);
});
async function hallucinatedStreamAfterPayBill(entries, t) {
    await freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    const bill = [];
    for (let index = 0; index < entries; index++) {
        const item = await addInventoryObject(index === 0 ? DAGGER
            : OBJECT_NAMES.indexOf(['knife', 'spear'][index - 1] ?? 'knife'));
        item.unpaid = true;
        bill.push({ bo_id: item.o_id, bquan: 1, price: 4, useup: false });
    }
    await createStaffedShop({ bill });
    setHeroGoldAmount(game, 100);
    initRng(61n);
    planInput(resetInputState(), t, [{ prompt: /Pay for which items\?/, keys: '\x1b' }]);
    await rhack('p'.charCodeAt(0));
    return displayStreamFingerprint();
}
async function hallucinatedStreamAfterLootMenu(containerNames, t) {
    await freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    for (const name of containerNames)
        await floorObject(OBJECT_NAMES.indexOf(name), 10, 10);
    initRng(61n);
    const topline = () => requireGameDisplay(game).grid[0]?.map(cell => cell.ch).join('') ?? '';
    const input = resetInputState();
    pushKeys('loot\n');
    const looting = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(topline(), /Loot which containers\?/);
    input.feed('\x1b');
    await looting;
    return displayStreamFingerprint();
}
//# sourceMappingURL=menu_glyph_draws.test.js.map