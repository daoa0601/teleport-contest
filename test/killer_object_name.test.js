import { changePreferredFruit } from '../js/fruit.js';
import { createMonsterAt } from './support/monsters.js';
import { saveMonsterTraits } from '../js/monster_traits.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { killerObjectName, objectName } from '../js/objnam.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, BOULDER, CORPSE, DAGGER, DIAMOND, FAKE_AMULET_OF_YENDOR, FIGURINE, FOOD_RATION, GLOB_OF_GRAY_OOZE, HEAVY_IRON_BALL, JADE, LENSES, POT_WATER, SCR_IDENTIFY, SLIME_MOLD, SPE_FORCE_BOLT, STATUE, TIN, TOWEL, WAN_FIRE, } from '../js/object_data.js';
import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC } from '../js/const.js';
import { freshObjectRoom } from './support/object-room.js';
import { artifactObject, knownObject } from './support/game-objects.js';
for (const [type, expected] of [
    [WAN_FIRE, 'a wand of fire'], [SCR_IDENTIFY, 'a scroll of identify'],
    [SPE_FORCE_BOLT, 'a spellbook of force bolt'], [DAGGER, 'a dagger'],
    [JADE, 'a jade stone'], [DIAMOND, 'a diamond'], [LENSES, 'a pair of lenses'],
    [AMULET_OF_YENDOR, 'the Amulet of Yendor'],
    [BELL_OF_OPENING, 'the Bell of Opening'],
    [FAKE_AMULET_OF_YENDOR, 'a cheap plastic imitation of the Amulet of Yendor'],
]) {
    void test(`killer naming identifies ${expected} without exposing that identity during play`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const object = await knownObject(type, { known: false, dknown: false, typeKnown: false,
            bknown: true, blessed: true, rknown: true, greased: true, opoisoned: true,
            oextra: { oname: 'Fake dragon', omonst: saveMonsterTraits(await createMonsterAt(0, 12, 10)) }, oname: 'Fake dragon' });
        assert.ok(game._knownObjectTypes !== null && game._knownObjectTypes !== undefined);
        game._knownObjectTypes.delete(type);
        assert.ok(game._objectCallNames !== null && game._objectCallNames !== undefined);
        game._objectCallNames[type] = 'a fake castle';
        const visibleName = objectName(object);
        const extra = object.oextra;
        assert.equal(killerObjectName(object), expected);
        assert.equal(objectName(object), visibleName);
        assert.equal(object.known, false);
        assert.equal(object.dknown, false);
        assert.equal(object.bknown, true);
        assert.equal(object.blessed, true);
        assert.equal(object.rknown, true);
        assert.equal(object.greased, true);
        assert.equal(object.opoisoned, true);
        assert.equal(object.oextra, extra);
        assert.ok(extra !== null && extra !== undefined);
        assert.equal(extra.oname, 'Fake dragon');
        assert.equal(object.oname, 'Fake dragon');
        assert.equal(game._knownObjectTypes.has(type), false);
        assert.equal(game._objectCallNames[type], 'a fake castle');
    });
}
for (const [blessed, cursed, expected] of [
    [false, false, 'a potion of water'], [true, false, 'a potion of holy water'],
    [false, true, 'a potion of unholy water'],
]) {
    void test(`death text preserves ${expected} beatitude without adding other identification details`, async () => {
        freshObjectRoom();
        const water = await knownObject(POT_WATER, { blessed, cursed, known: false, dknown: false, typeKnown: false });
        assert.equal(killerObjectName(water), expected);
        assert.equal(water.known, false);
        assert.equal(water.blessed, blessed);
        assert.equal(water.cursed, cursed);
    });
}
void test('quantity changes killer grammar to plural without inserting an inventory count', async () => {
    freshObjectRoom();
    const daggers = await knownObject(DAGGER, { quantity: 3 });
    const water = await knownObject(POT_WATER, { quantity: 2, blessed: true });
    assert.equal(killerObjectName(daggers), 'daggers');
    assert.equal(killerObjectName(water), 'potions of holy water');
});
for (const [name, expected] of [
    ['Excalibur', 'Excalibur'], ['The Orb of Detection', 'the Orb of Detection'],
]) {
    void test(`an unknown artifact is named ${expected} directly rather than by its base object or user label`, async () => {
        freshObjectRoom();
        const artifact = await artifactObject(name, { known: false, dknown: false,
            typeKnown: false, quantity: 4, oextra: { oname: 'Bogus' } });
        assert.equal(killerObjectName(artifact), expected);
        assert.equal(artifact.known, false);
        assert.equal(artifact.dknown, false);
        assert.ok(artifact.oextra !== null && artifact.oextra !== undefined);
        assert.equal(artifact.oextra.oname, 'Bogus');
    });
}
for (const [species, quantity, expected] of [
    ['newt', 1, 'a newt corpse'], ['newt', 2, 'newt corpses'],
    ['Medusa', 1, "Medusa's corpse"], ['Medusa', 2, "Medusa's corpses"],
    ['Oracle', 1, "the Oracle's corpse"],
    ['Wizard of Yendor', 1, "the Wizard of Yendor's corpse"],
    ['high cleric', 1, 'a high cleric corpse'],
]) {
    void test(`corpse death text uses ${expected}`, async () => {
        freshObjectRoom();
        const corpse = await knownObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf(species), spe: 0, quantity,
            oname: 'an arch-lich', oextra: { omonst: saveMonsterTraits(await createMonsterAt('vampire', 12, 10)) },
        });
        assert.equal(killerObjectName(corpse), expected);
    });
}
void test('corpse gender and the neutral cleric name come from the object rather than saved revival traits', async () => {
    freshObjectRoom();
    const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('aligned cleric'), spe: 0 });
    assert.equal(killerObjectName(corpse), 'a cleric corpse');
    corpse.spe = CORPSTAT_FEMALE;
    assert.equal(killerObjectName(corpse), 'a priestess corpse');
});
void test('player fruit names cannot impersonate another death cause', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    changePreferredFruit('a trap door');
    const mold = await knownObject(SLIME_MOLD, { spe: 1, oname: 'dragon breath' });
    assert.equal(killerObjectName(mold), 'a deadly slime mold');
    mold.quan = mold.quantity = 5;
    assert.equal(killerObjectName(mold), 'deadly slime molds');
});
void test('identified physical details survive killer naming while inventory annotations do not', async () => {
    freshObjectRoom({ role: 'archeologist' });
    const statue = await knownObject(STATUE, { corpsenm: MONSTER_NAME.indexOf('Medusa'), spe: CORPSTAT_HISTORIC });
    const figurine = await knownObject(FIGURINE, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const ball = await knownObject(HEAVY_IRON_BALL, { owt: 500, spe: 4, oeroded: 2 });
    const towel = await knownObject(TOWEL, { spe: 3 });
    const glob = await knownObject(GLOB_OF_GRAY_OOZE, { globby: true, owt: 400 });
    const boulder = await knownObject(BOULDER, { corpsenm: 1 });
    assert.equal(killerObjectName(statue), 'a historic statue of Medusa');
    assert.equal(killerObjectName(figurine), 'a figurine of a newt');
    assert.equal(killerObjectName(ball), 'a very heavy iron ball');
    assert.equal(killerObjectName(towel), 'a wet towel');
    assert.equal(killerObjectName(glob), 'a large glob of gray ooze');
    assert.equal(killerObjectName(boulder), 'a next boulder');
    assert.equal(boulder.corpsenm, 1);
});
void test('killer naming honors Samurai item names and diluted potions', async () => {
    freshObjectRoom({ role: 'samurai' });
    const ration = await knownObject(FOOD_RATION);
    const water = await knownObject(POT_WATER, { cursed: true, odiluted: true });
    assert.equal(killerObjectName(ration), 'a gunyoki');
    assert.equal(killerObjectName(water), 'a diluted potion of unholy water');
});
void test('known tins retain their real contents and preparation knowledge without inventing a preparation', async () => {
    freshObjectRoom();
    const tin = await knownObject(TIN, { corpsenm: MONSTER_NAME.indexOf('newt'), spe: -4, cknown: false });
    assert.equal(killerObjectName(tin), 'a tin of newt meat');
    tin.cknown = true;
    assert.equal(killerObjectName(tin), 'a tin of french fried newt meat');
    tin.corpsenm = MONSTER_NAME.indexOf('lizard');
    tin.spe = -1;
    assert.equal(killerObjectName(tin), 'a homemade tin of lizard meat');
    tin.spe = 1;
    assert.equal(killerObjectName(tin), 'a tin of spinach');
});
//# sourceMappingURL=killer_object_name.test.js.map