import assert from 'node:assert/strict';
import test from 'node:test';
import { W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_QUIVER, W_SWAPWEP, W_WEP, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AXE, BOOMERANG, CROSSBOW, CROSSBOW_BOLT, DAGGER, DART, DILITHIUM_CRYSTAL, ELVEN_ARROW, ELVEN_BOOTS, FEDORA, FLINT, HAWAIIAN_SHIRT, HELMET, KATANA, LEATHER_ARMOR, LEATHER_GLOVES, LONG_SWORD, OBJECT_NAMES, PICK_AXE, ROBE, ROCK, SMALL_SHIELD, SPE_BLANK_PAPER, SPE_LIGHT, SPE_PROTECTION, TIN_OPENER, TOWEL, TWO_HANDED_SWORD, UNICORN_HORN, } from '../js/object_data.js';
import { currentSpellKnowledge } from '../js/spell_casting_rules.js';
import { useStartingItem } from '../js/starting_equipment.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('starting weapons keep the first primary and alternate instead of replacing them', async () => {
    freshObjectRoom();
    const katana = await addInventoryObject(KATANA, { initialize: false });
    const sword = await addInventoryObject(LONG_SWORD, { initialize: false });
    const axe = await addInventoryObject(AXE, { initialize: false });
    await useStartingItem(katana, game);
    await useStartingItem(sword, game);
    await useStartingItem(axe, game);
    assert.equal(game.uwep, katana);
    assert.equal(game.u.uwep, katana);
    assert.equal(katana.wielded, true);
    assert.equal(katana.owornmask, W_WEP);
    assert.equal(game.uswapwep, sword);
    assert.equal(game.u.uswapwep, sword);
    assert.equal(sword.alternate, true);
    assert.equal(sword.owornmask, W_SWAPWEP);
    assert.equal(axe.owornmask ?? 0, 0);
});
for (const otyp of [CROSSBOW, PICK_AXE, UNICORN_HORN, TIN_OPENER]) {
    void test(`a starting ${OBJECT_NAMES[otyp]} can be the primary weapon`, async () => {
        freshObjectRoom();
        const item = await addInventoryObject(otyp, { initialize: false });
        await useStartingItem(item, game);
        assert.equal(game.uwep, item);
        assert.equal(item.wielded, true);
        assert.equal(item.owornmask, W_WEP);
        assert.equal(game.uswapwep, null);
    });
}
void test('a rogue keeps starting daggers as the alternate weapon after a sword', async () => {
    freshObjectRoom({ role: 'rogue' });
    const sword = await addInventoryObject(LONG_SWORD, { initialize: false });
    const daggers = await addInventoryObject(DAGGER, { initialize: false, quan: 8 });
    await useStartingItem(sword, game);
    await useStartingItem(daggers, game);
    assert.equal(game.uwep, sword);
    assert.equal(game.uswapwep, daggers);
    assert.equal(daggers.owornmask, W_SWAPWEP);
    assert.equal(game.uquiver, null);
});
for (const otyp of [ELVEN_ARROW, CROSSBOW_BOLT, DART, BOOMERANG, FLINT, ROCK]) {
    void test(`a starting ${OBJECT_NAMES[otyp]} goes into the empty quiver`, async () => {
        freshObjectRoom();
        const item = await addInventoryObject(otyp, { initialize: false });
        await useStartingItem(item, game);
        assert.equal(game.uquiver, item);
        assert.equal(game.u.uquiver, item);
        assert.equal(item.ready, true);
        assert.equal(item.owornmask, W_QUIVER);
        assert.equal(game.uwep, null);
        assert.equal(game.uswapwep, null);
    });
}
void test('later starting ammunition leaves the first quiver stack in place', async () => {
    freshObjectRoom();
    const darts = await addInventoryObject(DART, { initialize: false });
    const arrows = await addInventoryObject(ELVEN_ARROW, { initialize: false });
    await useStartingItem(darts, game);
    await useStartingItem(arrows, game);
    assert.equal(game.uquiver, darts);
    assert.equal(arrows.owornmask ?? 0, 0);
    assert.equal(game.uwep, null);
    assert.equal(game.uswapwep, null);
});
void test('ordinary tools and precious gems stay unequipped', async () => {
    freshObjectRoom();
    const towel = await addInventoryObject(TOWEL, { initialize: false });
    const gem = await addInventoryObject(DILITHIUM_CRYSTAL, { initialize: false });
    await useStartingItem(towel, game);
    await useStartingItem(gem, game);
    assert.equal(towel.owornmask ?? 0, 0);
    assert.equal(gem.owornmask ?? 0, 0);
    assert.equal(game.uwep, null);
    assert.equal(game.uswapwep, null);
    assert.equal(game.uquiver, null);
});
const armorCases = [
    { otyp: HELMET, slot: 'uarmh', mask: W_ARMH },
    { otyp: LEATHER_ARMOR, slot: 'uarm', mask: W_ARM },
    { otyp: HAWAIIAN_SHIRT, slot: 'uarmu', mask: W_ARMU },
    { otyp: ROBE, slot: 'uarmc', mask: W_ARMC },
    { otyp: SMALL_SHIELD, slot: 'uarms', mask: W_ARMS },
    { otyp: LEATHER_GLOVES, slot: 'uarmg', mask: W_ARMG },
    { otyp: ELVEN_BOOTS, slot: 'uarmf', mask: W_ARMF },
];
for (const { otyp, slot, mask } of armorCases) {
    void test(`a starting ${OBJECT_NAMES[otyp]} is worn in its armor slot`, async () => {
        freshObjectRoom();
        const item = await addInventoryObject(otyp, { initialize: false });
        await useStartingItem(item, game);
        assert.equal(game[slot], item);
        assert.equal(game.u[slot], item);
        assert.equal(item.worn, true);
        assert.equal(item.owornmask, mask);
    });
}
void test('later starting armor leaves an occupied slot alone', async () => {
    freshObjectRoom();
    const helmet = await addInventoryObject(HELMET, { initialize: false });
    const fedora = await addInventoryObject(FEDORA, { initialize: false });
    await useStartingItem(helmet, game);
    await useStartingItem(fedora, game);
    assert.equal(game.uarmh, helmet);
    assert.equal(fedora.owornmask ?? 0, 0);
});
void test('a starting shield ends two-weapon combat and retains the alternate weapon', async () => {
    freshObjectRoom();
    const sword = await addInventoryObject(LONG_SWORD, { initialize: false });
    const dagger = await addInventoryObject(DAGGER, { initialize: false });
    const shield = await addInventoryObject(SMALL_SHIELD, { initialize: false });
    await useStartingItem(sword, game);
    await useStartingItem(dagger, game);
    game.u.twoweap = true;
    await useStartingItem(shield, game);
    assert.equal(game.uarms, shield);
    assert.equal(game.u.twoweap, false);
    assert.equal(game.uwep, sword);
    assert.equal(game.uswapwep, dagger);
    assert.equal(dagger.owornmask, W_SWAPWEP);
});
void test('a wielded two-handed starting weapon prevents wearing a shield', async () => {
    freshObjectRoom();
    const sword = await addInventoryObject(TWO_HANDED_SWORD, { initialize: false });
    const shield = await addInventoryObject(SMALL_SHIELD, { initialize: false });
    await useStartingItem(sword, game);
    await useStartingItem(shield, game);
    assert.equal(game.uwep, sword);
    assert.equal(shield.owornmask ?? 0, 0);
    assert.equal(game.uarms == null, true);
});
void test('a worn starting shield puts a two-handed weapon in the alternate slot', async () => {
    freshObjectRoom();
    const shield = await addInventoryObject(SMALL_SHIELD, { initialize: false });
    const sword = await addInventoryObject(TWO_HANDED_SWORD, { initialize: false });
    const dagger = await addInventoryObject(DAGGER, { initialize: false });
    await useStartingItem(shield, game);
    await useStartingItem(sword, game);
    await useStartingItem(dagger, game);
    assert.equal(game.uarms, shield);
    assert.equal(game.uwep, dagger);
    assert.equal(game.uswapwep, sword);
    assert.equal(sword.owornmask, W_SWAPWEP);
});
void test('starting spellbooks teach spells from their object types without presentation fields', async () => {
    freshObjectRoom({ moves: 1 });
    requirePlayingGame(game);
    const light = await addInventoryObject(SPE_LIGHT, { initialize: false });
    const protection = await addInventoryObject(SPE_PROTECTION, { initialize: false });
    const blank = await addInventoryObject(SPE_BLANK_PAPER, { initialize: false });
    delete light.spellName;
    delete protection.spellName;
    await useStartingItem(light, game);
    await useStartingItem(blank, game);
    await useStartingItem(protection, game);
    assert.equal(game.spells.length, 2);
    const [lightSpell, protectionSpell] = game.spells;
    assert.ok(lightSpell);
    assert.ok(protectionSpell);
    assert.equal(lightSpell.otyp, SPE_LIGHT);
    assert.equal(lightSpell.level, 1);
    assert.equal(currentSpellKnowledge(lightSpell, game), 20000);
    assert.equal(protectionSpell.otyp, SPE_PROTECTION);
    assert.equal(currentSpellKnowledge(protectionSpell, game), 20000);
    assert.equal(light.spestudied ?? 0, 0);
    assert.equal(game.u.uconduct.literate ?? 0, 0);
    assert.equal(game.moves, 1);
});
//# sourceMappingURL=starting_equipment.test.js.map