import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { fullyIdentifyObject, inventoryItemDescription, objectNeedsFullIdentification } from '../js/invent.js';
import { transformMagicLampToOilLamp } from '../js/light.js';
import { mksobj } from '../js/mklev.js';
import { applyMonsterPassiveToObject } from '../js/monster_passive.js';
import { cancelObjectMagic } from '../js/object_cancellation.js';
import { CLUB, LEATHER_ARMOR, MAGIC_LAMP, OIL_LAMP, POT_HEALING, POT_WATER } from '../js/object_data.js';
import { recordObjectCall, recordObjectKnowledge } from '../js/object_knowledge.js';
import { objectName } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('releasing a djinni identifies magic lamps without identifying the resulting oil lamp', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const lamp = await addInventoryObject(MAGIC_LAMP, {
        spe: 1, age: 200, invlet: 'a',
        wielded: true, owornmask: W_WEP,
    });
    fullyIdentifyObject(lamp);
    game.uwep = game.u.uwep = lamp;
    // An ordinary, non-wishing djinni keeps this command self-contained.
    initRng(39n);
    resetInputState().feed('rub\na    ');
    await rhack('#'.charCodeAt(0));
    assert.equal(lamp.otyp, OIL_LAMP);
    assert.equal(lamp.spe, 0);
    assert.ok(lamp.age >= 1000 && lamp.age < 1500, 'the spent lamp receives ordinary oil fuel');
    assert.equal(game.context.move, 1);
    assert.equal(objectTypeKnown({ otyp: MAGIC_LAMP }), true);
    assert.equal(objectTypeKnown({ otyp: OIL_LAMP }), false);
    assert.equal(inventoryItemDescription(lamp), 'an uncursed lamp (wielded)');
    assert.equal(objectNeedsFullIdentification(lamp), true);
    fullyIdentifyObject(lamp);
    assert.equal(inventoryItemDescription(lamp), 'an uncursed oil lamp (wielded)');
    assert.equal(objectNeedsFullIdentification(lamp), false);
});
void test('a failed rub lets a blind hero smell the smoke', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const lamp = await addInventoryObject(MAGIC_LAMP, {
        spe: 0, invlet: 'a', wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = lamp;
    setHeroBlindnessTurns(20);
    resetInputState().feed('rub\na');
    initRng(1n);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, 'You smell smoke.');
    assert.equal(lamp.otyp, MAGIC_LAMP);
    assert.equal(game.context.move, 1);
});
for (const oilKnown of [false, true]) {
    void test(`a converted magic lamp uses the ${oilKnown ? 'known oil type' : 'oil appearance and call name'}`, async () => {
        freshObjectRoom();
        const lamp = await mksobj(MAGIC_LAMP, false, false);
        fullyIdentifyObject(lamp);
        lamp.blessed = true;
        recordObjectCall(MAGIC_LAMP, 'wish giver');
        recordObjectCall(OIL_LAMP, 'refill');
        if (oilKnown)
            recordObjectKnowledge(OIL_LAMP);
        transformMagicLampToOilLamp(lamp, 1200);
        assert.equal(objectName(lamp), oilKnown ? 'oil lamp' : 'lamp called refill');
        assert.equal(inventoryItemDescription(lamp), oilKnown
            ? 'a blessed oil lamp' : 'a blessed lamp called refill');
        const otherMagicLamp = await mksobj(MAGIC_LAMP, false, false);
        otherMagicLamp.dknown = true;
        assert.equal(objectName(otherMagicLamp), 'magic lamp');
    });
}
for (const waterKnown of [false, true]) {
    void test(`cancelling an identified potion uses ${waterKnown ? 'the known water name' : 'the unlearned water appearance'}`, async () => {
        freshObjectRoom();
        const potion = await mksobj(POT_HEALING, false, false);
        fullyIdentifyObject(potion);
        if (waterKnown)
            recordObjectKnowledge(POT_WATER);
        await cancelObjectMagic(potion);
        assert.equal(potion.otyp, POT_WATER);
        assert.equal(objectName(potion), waterKnown ? 'potion of water' : 'clear potion');
        assert.equal(objectTypeKnown({ otyp: POT_WATER }), waterKnown);
        const otherHealingPotion = await mksobj(POT_HEALING, false, false);
        otherHealingPotion.dknown = true;
        assert.equal(objectName(otherHealingPotion), 'potion of healing');
    });
}
for (const type of [CLUB, LEATHER_ARMOR]) {
    void test(`disenchantment of ${type === CLUB ? 'a weapon' : 'armor'} distinguishes type knowledge from enchantment knowledge`, async () => {
        freshObjectRoom();
        const disenchanter = await createMonsterAt('disenchanter', 11, 10, NO_MINVENT);
        const object = await addInventoryObject(type, { spe: 3, known: false });
        const messages = [];
        await applyMonsterPassiveToObject(disenchanter, object, {
            random: limit => limit - 1,
            publish: message => { messages.push(message); },
        });
        assert.equal(object.spe, 2);
        if (type === CLUB)
            assert.equal(messages.length, 0);
        else
            assert.equal(messages[0], 'Your leather armor seems less effective.');
    });
}
//# sourceMappingURL=object_type_knowledge.test.js.map