import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { BEAR_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { objectName } from '../js/objnam.js';
import { IRON_SHOES, KICKING_BOOTS, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { observeObject } from '../js/object_knowledge.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
for (const type of [IRON_SHOES, KICKING_BOOTS]) {
    void test(`bear protection names a single pair of ${OBJECT_NAMES[type]}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        wearHeroArmor(await addInventoryObject(type));
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        pushKeys(' '.repeat(60));
        initRng(1n);
        await triggerHeroTrap(trap);
        assert.ok(game._pending_message.includes(`Your pair of ${OBJECT_NAMES[type]} protects your leg.`));
        assert.ok(!game._pending_message.includes('pair of pair of'));
    });
}
void test('called shoes use the observed category without formatting changing knowledge', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const shoes = await knownObject(IRON_SHOES, {
        typeKnown: false,
        dknown: false,
        oname: 'Buster',
    });
    assert.ok(game._knownObjectTypes);
    assert.ok(game._objectCallNames);
    game._knownObjectTypes.delete(IRON_SHOES);
    game._objectCallNames[IRON_SHOES] = 'Work';
    assert.equal(objectName(shoes), 'pair of boots called Work');
    assert.equal(shoes.dknown, false);
    observeObject(shoes);
    assert.equal(objectName(shoes), 'pair of shoes called Work named Buster');
});
void test('unobserved shields conceal their type and call name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    for (const [name, noun] of [
        ['elven shield', 'shield'],
        ['shield of reflection', 'smooth shield'],
    ]) {
        const type = OBJECT_NAMES.indexOf(name);
        const shield = await knownObject(type, { dknown: false });
        assert.ok(game._objectCallNames);
        game._objectCallNames[type] = 'Defender';
        assert.equal(objectName(shield), noun);
    }
});
void test('Samurai armor names retain the concrete pair grammar', async () => {
    freshObjectRoom({ role: 'samurai' });
    requirePlayingGame(game);
    const gloves = await knownObject(OBJECT_NAMES.indexOf('leather gloves'));
    assert.equal(objectName(gloves), 'pair of yugake');
});
for (const blind of [false, true]) {
    void test(`bear-trap footwear feedback ${blind ? 'does not reveal unseen boots while blind' : 'observes boots in sight'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        setHeroBlindnessTurns(20);
        const boots = await addInventoryObject(IRON_SHOES, {
            observed: false,
            dknown: false,
            oname: 'Buster',
        });
        wearHeroArmor(boots);
        if (!blind)
            setHeroBlindnessTurns(0);
        assert.equal(boots.dknown, false);
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        pushKeys(' '.repeat(60));
        initRng(1n);
        await triggerHeroTrap(trap);
        assert.equal(boots.dknown, !blind);
        assert.match(game._pending_message, /protects your leg/);
        assert.equal(game._pending_message.includes('named Buster'), !blind);
    });
}
//# sourceMappingURL=armor_naming.test.js.map