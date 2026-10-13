import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { NO_MINVENT, RUST_TRAP, W_ARM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { ROBE, MUMMY_WRAPPING, RING_MAIL, LEATHER_ARMOR, OIL_LAMP, MAGIC_LAMP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { burnArmorByFire, burnHeroArmorByFire } from '../js/trap.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [type, name] of [[ROBE, 'robe'], [MUMMY_WRAPPING, 'wrapping']]) {
    void test(`fire describes a worn ${name} by its simple armor name`, async () => {
        freshObjectRoom();
        const cloak = await addInventoryObject(type);
        await wearHeroArmor(cloak);
        const messages = [];
        await burnHeroArmorByFire(game, text => { messages.push(text); }, [], () => 1);
        assert.equal(messages[0], `Your ${name} smoulders!`);
        assert.equal(cloak.oeroded, 1);
    });
}
for (const role of ['ranger', 'priest']) {
    void test(`a ${role} observes a monster's named suit when fire hits it`, async () => {
        freshObjectRoom({ role });
        const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        const suit = await equipMonsterObject(goblin, await knownObject(LEATHER_ARMOR, {
            oname: 'Patchwork', dknown: false, bknown: false,
        }), W_ARM);
        const messages = [];
        await burnArmorByFire(goblin, game, text => { messages.push(text); }, [], () => 1, { visible: true });
        assert.equal(messages[0], "The goblin's leather armor named Patchwork smoulders!");
        assert.equal(suit.dknown, true);
        assert.equal(suit.bknown, role === 'priest');
        assert.equal(suit.oeroded, 1);
    });
}
void test('a blind priest learns a burned suit\'s beatitude without seeing its name', async () => {
    freshObjectRoom({ role: 'priest' });
    const suit = await addInventoryObject(LEATHER_ARMOR);
    await wearHeroArmor(suit);
    suit.oname = 'Patchwork';
    suit.dknown = false;
    suit.bknown = false;
    setHeroBlindnessTurns(10);
    const messages = [];
    await burnHeroArmorByFire(game, text => { messages.push(text); }, [], () => 1);
    assert.equal(messages[0], 'Your leather armor smoulders!');
    assert.equal(suit.dknown, false);
    assert.equal(suit.bknown, true);
});
void test('a rust trap calls a worn ring mail suit mail', async () => {
    const level = freshObjectRoom();
    const suit = await addInventoryObject(RING_MAIL);
    await wearHeroArmor(suit);
    const trap = addTrap(level, RUST_TRAP, 10, 10);
    pushKeys(' '.repeat(20));
    initRng(2n);
    await triggerHeroTrap(trap);
    assert.match(game._pending_message, /Your mail rusts!/);
    assert.equal(suit.oeroded, 1);
});
void test('a rust trap uses the full name of ring mail wielded in the right hand', async () => {
    const level = freshObjectRoom();
    const suit = await addInventoryObject(RING_MAIL);
    await setPrimaryWeapon(suit);
    const trap = addTrap(level, RUST_TRAP, 10, 10);
    pushKeys(' '.repeat(20));
    initRng(14n);
    await triggerHeroTrap(trap);
    assert.match(game._pending_message, /Your ring mail rusts!/);
    assert.equal(suit.oeroded, 1);
});
for (const [type, label] of [[OIL_LAMP, 'oil lamp'], [MAGIC_LAMP, 'magic lamp']]) {
    void test(`a rust trap silently extinguishes a blind priest's wielded ${label} without revealing its beatitude`, async () => {
        const level = freshObjectRoom({ role: 'priest' });
        const lamp = await addInventoryObject(type, { age: 200, spe: 1 });
        await setPrimaryWeapon(lamp);
        assert.equal(beginObjectBurn(lamp, game, game.moves), true);
        setHeroBlindnessTurns(10);
        lamp.dknown = false;
        lamp.bknown = false;
        const trap = addTrap(level, RUST_TRAP, 10, 10);
        pushKeys(' '.repeat(20));
        initRng(14n);
        await triggerHeroTrap(trap);
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.dknown, false);
        assert.equal(lamp.bknown, false);
        assert.equal(game._pending_message, 'A gush of water hits your right arm!');
    });
}
void test('a rust trap names an unlit wielded lamp and reveals its beatitude to a blind priest', async () => {
    const level = freshObjectRoom({ role: 'priest' });
    const lamp = await addInventoryObject(OIL_LAMP);
    await setPrimaryWeapon(lamp);
    setHeroBlindnessTurns(10);
    lamp.dknown = false;
    lamp.bknown = false;
    const trap = addTrap(level, RUST_TRAP, 10, 10);
    pushKeys(' '.repeat(20));
    initRng(14n);
    await triggerHeroTrap(trap);
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.dknown, false);
    assert.equal(lamp.bknown, true);
});
//# sourceMappingURL=pool_armor_naming.test.js.map