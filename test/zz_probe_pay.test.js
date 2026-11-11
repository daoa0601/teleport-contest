import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { setHeroGoldAmount } from '../js/sit.js';
import { DAGGER, OBJECT_NAMES, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';
// C shk.c:menu_pick_pay_items() and pickup.c:doloot_core() attach
// obj_to_glyph() metadata to their menu rows. The tty menu shows no glyph
// column, but the metadata construction consumes one display-RNG draw per
// row while hallucinating, which the pile glyphs repainted afterwards
// reveal. Both builders follow container_loot_menu_hallucination.test.
async function repaintHallucinatedPiles() {
    game.tutorial_set_in_config = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /^/, limit: 80 });
    await finishAtCommandInput(input, () => moveloop_core(), /^/);
}
function rememberedRockSpecies(rock) {
    const remembered = game.level?.requireAt(rock.ox, rock.oy).remembered_glyph;
    assert.ok(remembered?.kind === 'object', 'The hallucination refresh must repaint the rock pile');
    return remembered.otyp;
}
void test('a hallucinated pay-bill menu spends one object draw per bill entry', async (t) => {
    const afterOneEntry = await hallucinatedRockAfterPayBill(1, t);
    const afterThreeEntries = await hallucinatedRockAfterPayBill(3, t);
    assert.notEqual(afterThreeEntries, afterOneEntry, 'Three bill entries must advance the hallucination stream past one entry '
        + `(${afterThreeEntries} vs ${afterOneEntry})`);
});
void test('a hallucinated loot-container menu spends one object draw per container', async (t) => {
    const afterTwoContainers = await hallucinatedRockAfterLootMenu(['sack', 'chest'], t);
    const afterThreeContainers = await hallucinatedRockAfterLootMenu(['sack', 'chest', 'large box'], t);
    assert.notEqual(afterThreeContainers, afterTwoContainers, 'Three container rows must advance the hallucination stream past two '
        + `(${afterThreeContainers} vs ${afterTwoContainers})`);
});
async function hallucinatedRockAfterPayBill(entries, t) {
    await freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    const rock = await floorObject(ROCK, 12, 10);
    const bill = [];
    for (let index = 0; index < entries; index++) {
        const item = await addInventoryObject(index === 0 ? DAGGER
            : OBJECT_NAMES.indexOf(['knife', 'spear'][index - 1] ?? 'knife'));
        item.unpaid = true;
        bill.push({ bo_id: item.o_id, bquan: 1, price: 4, useup: false });
    }
    await createStaffedShop({ bill });
    console.error('BILL:', bill.length, JSON.stringify(game.level?.monsters?.flatMap(m => m.eshk?.bill ?? [])?.length));
    setHeroGoldAmount(game, 0);
    console.error('MENUFLAG:', game.flags.menu_style);
    initRng(61n);
    planInput(resetInputState(), t, [{ prompt: /Pay for which items\?/, keys: '\x1b' }]);
    await rhack('p'.charCodeAt(0));
    await repaintHallucinatedPiles();
    return rememberedRockSpecies(rock);
}
async function hallucinatedRockAfterLootMenu(containerNames, t) {
    await freshObjectRoom({ hero: { hallucinationTurns: 99 } });
    for (const name of containerNames)
        await floorObject(OBJECT_NAMES.indexOf(name), 10, 10);
    const rock = await floorObject(ROCK, 12, 10);
    initRng(61n);
    const topline = () => requireGameDisplay(game).grid[0]?.map(cell => cell.ch).join('') ?? '';
    const input = resetInputState();
    pushKeys('loot\n\x1b');
    const looting = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(topline(), /Loot which containers\?/);
    await looting;
    await repaintHallucinatedPiles();
    return rememberedRockSpecies(rock);
}
//# sourceMappingURL=zz_probe_pay.test.js.map