import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, RUST_TRAP, W_WEP } from '../js/const.js';
import { wearHeroArmor } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { damageObjectWithAcid, erodeObject } from '../js/object_erosion.js';
import { DWARVISH_CLOAK, GAUNTLETS_OF_POWER, LEATHER_GLOVES, OBJECT_NAMES, YELLOW_DRAGON_SCALES, } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addInventoryObject, uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { equipMonsterObject } from './support/monsters.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
for (const armor of [DWARVISH_CLOAK, YELLOW_DRAGON_SCALES]) {
    const kind = armor === DWARVISH_CLOAK ? 'burn' : 'corrosion';
    void test(`inventory protection against ${kind} leaves unseen gloves unobserved`, async () => {
        freshObjectRoom();
        wearHeroArmor(await addInventoryObject(armor));
        const gloves = await addInventoryObject(kind === 'burn' ? LEATHER_GLOVES : GAUNTLETS_OF_POWER, { dknown: false, typeKnown: false, observed: false });
        const messages = [];
        const result = await erodeObject(gloves, kind, {
            random: () => 0,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(result, 'nothing');
        assert.equal(gloves.dknown, false, 'resisted damage must not reveal the gloves');
        assert.equal(gloves.oeroded ?? 0, 0);
        assert.equal(gloves.oeroded2 ?? 0, 0);
        assert.equal(messages.length, 0);
    });
}
for (const firstProtectionFails of [false, true]) {
    const protection = firstProtectionFails ? 'the later corrosion check' : 'the initial acid check';
    void test(`acid damage leaves unseen gloves unobserved when armor passes ${protection}`, async () => {
        freshObjectRoom();
        wearHeroArmor(await addInventoryObject(YELLOW_DRAGON_SCALES));
        const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, {
            dknown: false, typeKnown: false, observed: false,
        });
        const messages = [];
        let protectionRoll = firstProtectionFails ? 99 : 0;
        await damageObjectWithAcid(gloves, {
            random: () => {
                const roll = protectionRoll;
                protectionRoll = 0;
                return roll;
            },
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(gloves.dknown, false, 'resisted damage must not reveal the gloves');
        assert.equal(gloves.oeroded2 ?? 0, 0);
        assert.equal(messages.length, 0);
    });
}
void test('gloves become observed when fire gets past a dwarvish cloak', async () => {
    freshObjectRoom();
    wearHeroArmor(await addInventoryObject(DWARVISH_CLOAK));
    const gloves = await addInventoryObject(LEATHER_GLOVES, {
        dknown: false, typeKnown: false, observed: false,
    });
    const messages = [];
    const result = await erodeObject(gloves, 'burn', {
        random: () => 99,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result, 'damaged');
    assert.equal(gloves.dknown, true);
    assert.equal(gloves.oeroded, 1);
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? '', /^Your .+ smoulders?!$/u);
});
void test('erosion names an unfamiliar monster weapon by its visible appearance', async () => {
    freshObjectRoom();
    const troll = await createMonsterAt('water troll', 11, 10, NO_MINVENT);
    const weapon = await uninitializedObject(OBJECT_NAMES.indexOf('ranseur'), { typeKnown: false });
    await addObjectToMonsterInventory(troll, weapon);
    const messages = [];
    await erodeObject(weapon, 'rust', {
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(weapon.oeroded, 1);
    assert.deepEqual(messages, ["The water troll's hilted polearm rusts!"]);
});
for (const arm of [1, 2]) {
    void test(`a rust trap hitting arm ${arm} names an unfamiliar wielded polearm by appearance`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP, { monster: { species: 'water troll' } });
        const weapon = await uninitializedObject(OBJECT_NAMES.indexOf('ranseur'), { typeKnown: false });
        await equipMonsterObject(monster, weapon, W_WEP);
        const messages = [];
        const event = await beginMonsterRustTrap(monster, trap, game, { random: () => arm });
        await finishMonsterRustTrap(monster, event, game, {
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(weapon.oeroded, 1);
        assert.equal(messages[1], "The water troll's hilted polearm rusts!");
    });
}
//# sourceMappingURL=erosion_appearance.test.js.map