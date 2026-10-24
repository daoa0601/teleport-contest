import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { inventoryItemDescription } from '../js/invent.js';
import { mksobj } from '../js/mklev.js';
import { OBJECT_NAMES, RING_MAIL, SPLINT_MAIL } from '../js/object_data.js';
import { erodeObject } from '../js/object_erosion.js';
import { addCreatedInventoryItem } from '../js/u_init.js';
import { freshObjectRoom } from './support/object-room.js';
import { completeHeroStartup } from './support/startup.js';
void test('Samurai startup supplies known lacquered armor which resists rust and corrosion', async () => {
    const state = await completeHeroStartup({ role: 'samurai', alignment: 'lawful' });
    const armor = state.inventory.find(object => object.otyp === SPLINT_MAIL);
    assert.ok(armor, 'a Samurai starts with splint mail');
    const rust = await erodeObject(armor, 'rust');
    const corrosion = await erodeObject(armor, 'corrosion');
    assert.equal(state.uarm, armor);
    assert.match(await inventoryItemDescription(armor), /rustproof \+0 splint mail \(being worn\)/);
    assert.equal(rust, 'nothing');
    assert.equal(corrosion, 'nothing');
    assert.equal(armor.oeroded ?? 0, 0);
    assert.equal(armor.oeroded2 ?? 0, 0);
});
for (const { moves, quest, description } of [
    { moves: 0, quest: false, description: 'the first level is generated' },
    { moves: 1, quest: false, description: 'the first move creates armor' },
    { moves: 80, quest: true, description: 'a later quest level creates armor' },
]) {
    void test(`a Samurai receives known lacquered splint mail when ${description}`, async () => {
        freshObjectRoom({ role: 'samurai', moves });
        game.in_mklev = true;
        game.quest_dnum = 1;
        game.u.uz = { dnum: quest ? 1 : 0, dlevel: 1 };
        const armor = await mksobj(SPLINT_MAIL, true, false);
        assert.equal(armor.oerodeproof, true);
        assert.equal(armor.rknown, true);
        assert.equal(armor.oeroded ?? 0, 0);
        assert.equal(armor.oeroded2 ?? 0, 0);
        assert.match(await inventoryItemDescription(armor), /rustproof.*splint mail/);
    });
}
void test('a Samurai does not recognize ordinary later splint mail as lacquered', async () => {
    freshObjectRoom({ role: 'samurai', moves: 80 });
    game.quest_dnum = 1;
    game.u.uz = { dnum: 0, dlevel: 8 };
    const armor = await mksobj(SPLINT_MAIL, true, false);
    assert.equal(Boolean(armor.rknown), false);
    assert.doesNotMatch(await inventoryItemDescription(armor), /rustproof/);
});
void test('acquiring splint mail does not grant a Knight Samurai lacquer', async () => {
    const state = await completeHeroStartup({ role: 'knight', alignment: 'lawful' });
    const armor = await mksobj(SPLINT_MAIL, true, false);
    await addCreatedInventoryItem(armor);
    const messages = [];
    const result = await erodeObject(armor, 'rust', {
        state, luckRandom: () => 1, publish: async (message) => { messages.push(message); },
    });
    assert.equal(result, 'damaged');
    assert.equal(armor.oeroded, 1);
    assert.match(messages.join('\n'), /rusts/);
    assert.doesNotMatch(await inventoryItemDescription(armor), /rustproof/);
});
void test('Samurai lacquer does not apply to other armor or uninitialized objects', async () => {
    freshObjectRoom({ role: 'samurai', moves: 1 });
    const ringMail = await mksobj(RING_MAIL, true, false);
    const uninitializedSplintMail = await mksobj(SPLINT_MAIL, false, false);
    assert.equal(Boolean(ringMail.oerodeproof), false);
    assert.equal(Boolean(uninitializedSplintMail.oerodeproof), false);
    assert.doesNotMatch(await inventoryItemDescription(ringMail), /rustproof/);
    assert.doesNotMatch(await inventoryItemDescription(uninitializedSplintMail), /rustproof/);
});
void test('randomly generated armor retains damage, grease, and proofing as physical state', async () => {
    freshObjectRoom({ role: 'wizard', moves: 80, gameplaySeed: 741n });
    let rusty;
    let corroded;
    let greased;
    let proofed;
    for (let count = 0; count < 20_000 && !(rusty && corroded && greased && proofed); count++) {
        const armor = await mksobj(SPLINT_MAIL, true, false);
        if (armor.oeroded)
            rusty ??= armor;
        if (armor.oeroded2)
            corroded ??= armor;
        if (armor.greased && !armor.oerodeproof)
            greased ??= armor;
        if (armor.oerodeproof && !armor.greased)
            proofed ??= armor;
    }
    assert.ok(rusty, 'the generated armor sample contains visible rust');
    assert.ok(corroded, 'the generated armor sample contains visible corrosion');
    assert.ok(greased, 'the generated armor sample contains a grease coating');
    assert.ok(proofed, 'the generated armor sample contains hidden erosion proofing');
    assert.match(await inventoryItemDescription(rusty), /rusty/);
    assert.match(await inventoryItemDescription(corroded), /corroded/);
    assert.match(await inventoryItemDescription(greased), /greased/);
    assert.doesNotMatch(await inventoryItemDescription(proofed), /rustproof/);
    const rustBeforeGrease = greased.oeroded ?? 0;
    const greaseResult = await erodeObject(greased, 'rust', { random: () => 0 });
    const proofResult = await erodeObject(proofed, 'corrosion');
    assert.equal(greaseResult, 'greased');
    assert.equal(greased.greased, false);
    assert.equal(greased.oeroded ?? 0, rustBeforeGrease);
    assert.equal(proofResult, 'nothing');
    assert.equal(proofed.oeroded2 ?? 0, 0);
    assert.equal(proofed.rknown, true);
    assert.match(await inventoryItemDescription(proofed), /rustproof/);
});
void test('plastic weapons can be generated burnt and can burn further without rotting', async () => {
    freshObjectRoom({ moves: 80, gameplaySeed: 953n });
    const rubberHose = OBJECT_NAMES.indexOf('rubber hose');
    let burned;
    for (let count = 0; count < 2_000 && !burned; count++) {
        const weapon = await mksobj(rubberHose, true, false);
        if (weapon.oeroded && weapon.oeroded < 3 && !weapon.greased)
            burned = weapon;
    }
    assert.ok(burned, 'the generated rubber hoses include one with incomplete fire damage');
    assert.match(await inventoryItemDescription(burned), /burnt/);
    const oldBurnDamage = burned.oeroded ?? 0;
    const fire = await erodeObject(burned, 'burn', { luckRandom: () => 1 });
    const rot = await erodeObject(burned, 'rot');
    assert.equal(fire, 'damaged');
    assert.equal(burned.oeroded, oldBurnDamage + 1);
    assert.equal(rot, 'nothing');
    assert.equal(burned.oeroded2 ?? 0, 0);
});
//# sourceMappingURL=starting_armor_proof.test.js.map