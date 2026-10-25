import test from 'node:test';
import assert from 'node:assert/strict';
import { createBonesFromDeath, dropHeroInventoryForBones } from '../js/bones_death.js';
import { BURNING, FOUNTAIN, G_GENOD, GRAVE, HEADSTONE, LEAVESTATUE, NON_PM, PIT, ROOM, W_ARM, W_ARMC, } from '../js/const.js';
import { setHeroRemainsFromDeath, setHeroRemainsFromMonster } from '../js/death_remains.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { maketrap } from '../js/mklev.js';
import { beginObjectBurn } from '../js/light.js';
import { CORPSE, DAGGER, FOOD_RATION, LEATHER_ARMOR, MUMMY_WRAPPING, OIL_LAMP, STATUE, } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { races, roles } from '../js/roles.js';
import { objectWeight } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
const PM_GHOST = 287;
const PM_HUMAN_ARCHEOLOGIST = 331;
const PM_HUMAN_MUMMY = 192;
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
void test('a nearby object-loving monster can inherit a dead hero item', async () => {
    freshPlayableRoom({ seed: 1n });
    requirePlayingGame(game);
    const orc = await createMonsterAt('orc', 11, 10);
    const dagger = await addInventoryObject(DAGGER, {
        worn: true,
        wielded: true,
        owornmask: 1,
    });
    initRng(7n);
    await dropHeroInventoryForBones(10, 10);
    assert.deepEqual(game.inventory, []);
    assert.equal(orc.minvent.includes(dagger), true);
    assert.equal(dagger.where, 'minvent');
    assert.equal(dagger.carrierMid, orc.m_id);
    assert.equal(dagger.worn, false);
    assert.equal(dagger.wielded, false);
    assert.equal(dagger.owornmask, 0);
    assert.equal(requireGameLevel().objects[10]?.[10]?.includes(dagger) ?? false, false);
});
void test('a hero burned in lava leaves dropped gear and a ghost but no body', async () => {
    freshPlayableRoom({
        seed: 31n,
        hero: { uz: { dnum: 0, dlevel: 9 } },
    });
    requirePlayingGame(game);
    init_objects();
    game.storage = memoryStorage();
    game._canMakeBones = true;
    game.plname = 'Ember';
    const dagger = await addInventoryObject(DAGGER);
    setHeroRemainsFromDeath(BURNING);
    assert.equal(await createBonesFromDeath('burned by molten lava', async () => 'y'), true);
    const remains = floorObjectsAt(game.level, 10, 10);
    assert.equal(remains.includes(dagger), true);
    assert.equal(remains.some((object) => object.otyp === CORPSE), false);
    assert.equal(requireGameLevel().monsters.some((monster) => monster.mnum === PM_GHOST), true);
    assert.equal(requireGameLevel().requireAt(10, 10).typ, ROOM);
});
void test('a mummy victim rises with their inventory and intrinsic resistances', async () => {
    freshPlayableRoom({
        seed: 21n,
        role: 'samurai',
        hero: {
            uz: { dnum: 0, dlevel: 8 },
            ulevel: 8,
            uhpmax: 37,
            uluck: -2,
            ualign: { type: 1, record: 10, abuse: 3 },
            uevent: { udemigod: true, uhand_of_elbereth: 1 },
        },
    });
    requirePlayingGame(game);
    init_objects();
    game.storage = memoryStorage();
    game._canMakeBones = true;
    game.plname = 'Kira';
    const role = roles[9];
    const race = races[0];
    assert.ok(role);
    assert.ok(race);
    game.urole = role;
    game.urace = race;
    game.flags.female = true;
    grantIntrinsicProperty('fireResistance', 'experience', game);
    grantIntrinsicProperty('poisonResistance', 'outside', game);
    const armor = await addInventoryObject(LEATHER_ARMOR);
    const dagger = await addInventoryObject(DAGGER);
    assert.equal(setHeroRemainsFromMonster({
        mnum: PM_HUMAN_MUMMY,
        mcan: 0,
    }), PM_HUMAN_MUMMY);
    assert.equal(await createBonesFromDeath('killed by a mummy', async () => 'y'), true);
    const mummy = requireGameLevel().monsters.find((monster) => monster.mnum === PM_HUMAN_MUMMY);
    assert.ok(mummy);
    assert.ok(mummy.minvent);
    const wrapping = mummy.minvent.find((object) => object.otyp === MUMMY_WRAPPING);
    assert.ok(wrapping);
    assert.equal(mummy.name, 'Kira');
    assert.equal(mummy.m_lev, 8);
    assert.equal(mummy.mhp, 37);
    assert.equal(mummy.mhpmax, 37);
    assert.equal(mummy.female, true);
    assert.equal(mummy.msleeping, 1);
    assert.deepEqual(mummy.mextra?.ebones?.oldalign, { type: 1, record: 10, abuse: 3 });
    assert.equal(mummy.minvent.includes(armor), true);
    assert.equal(mummy.minvent.includes(dagger), true);
    assert.equal(armor.owornmask, W_ARM);
    assert.equal(wrapping.owornmask, W_ARMC);
    assert.equal((mummy.mintrinsics ?? 0) & 0x21, 0x21);
    assert.equal(game.inventory.length, 0);
    assert.deepEqual(floorObjectsAt(game.level, 10, 10), []);
});
void test('a stoned hero leaves a named statue containing their inventory', async () => {
    freshPlayableRoom({
        seed: 11n,
        hero: {
            uz: { dnum: 0, dlevel: 7 },
            umonnum: PM_HUMAN_ARCHEOLOGIST,
        },
    });
    requirePlayingGame(game);
    init_objects();
    game.storage = memoryStorage();
    game._canMakeBones = true;
    game.plname = 'Ada';
    game.u.ugrave_arise = LEAVESTATUE;
    const dagger = await addInventoryObject(DAGGER);
    const lamp = await addInventoryObject(OIL_LAMP, { age: 100 });
    beginObjectBurn(lamp, game, game.moves);
    assert.equal(await createBonesFromDeath('petrified by a cockatrice', async () => 'y'), true);
    const remains = floorObjectsAt(game.level, 10, 10);
    const statue = remains.find((object) => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(statue.oname, 'Ada');
    assert.equal(statue.corpsenm, PM_HUMAN_ARCHEOLOGIST);
    assert.ok(statue.contents);
    assert.equal(statue.contents.includes(dagger), true);
    assert.ok(statue.contents);
    assert.equal(statue.contents.includes(lamp), true);
    assert.equal(dagger.where, 'contained');
    assert.equal(dagger.container, statue);
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, 100);
    assert.equal(statue.owt, objectWeight(statue));
    assert.equal(game.inventory.length, 0);
    assert.equal(requireGameLevel().monsters.some((monster) => monster.mnum === PM_GHOST), false);
    assert.equal(requireGameLevel().requireAt(10, 10).typ, ROOM);
});
for (const square of ['room floor', 'existing grave', 'fountain', 'pit']) {
    void test(`a death headstone respects ${square}`, async () => {
        freshPlayableRoom({ seed: 31n, hero: { uz: { dnum: 0, dlevel: 9 } } });
        requirePlayingGame(game);
        init_objects();
        game.storage = memoryStorage();
        game._canMakeBones = true;
        game.plname = 'Ada';
        const location = requireGameLevel().requireAt(10, 10);
        location.typ =
            square === 'existing grave' ? GRAVE : square === 'fountain' ? FOUNTAIN : ROOM;
        location.emptygrave = 0;
        if (square === 'pit')
            await maketrap(10, 10, PIT);
        const previous = makeEngravingAt(10, 10, 'Old writing');
        await createBonesFromDeath('killed by a kobold', async () => 'y');
        if (square === 'fountain' || square === 'pit') {
            assert.equal(location.typ, square === 'fountain' ? FOUNTAIN : ROOM);
            assert.equal(engravingAt(10, 10), previous);
        }
        else {
            assert.equal(location.typ, GRAVE);
            assert.equal(location.emptygrave, square === 'existing grave' ? 0 : 1);
            const engraving = engravingAt(10, 10);
            assert.ok(engraving);
            assert.equal(engraving.engr_type, HEADSTONE);
            assert.equal(engraving.text, 'Ada, killed by a kobold');
        }
    });
}
void test('the killer species decides what rises from the dead hero', async () => {
    freshPlayableRoom({ seed: 41n });
    const human = races[0];
    const elf = races[1];
    assert.ok(human);
    assert.ok(elf);
    const wraith = MONSTER_NAME.indexOf('wraith');
    const vampire = MONSTER_NAME.indexOf('vampire');
    const ghoul = MONSTER_NAME.indexOf('ghoul');
    const zombie = MONSTER_NAME.indexOf('kobold zombie');
    const skeleton = MONSTER_NAME.indexOf('skeleton');
    const lich = MONSTER_NAME.indexOf('lich');
    const mummy = MONSTER_NAME.indexOf('human mummy');
    assert.equal(setHeroRemainsFromMonster({ mnum: wraith, mcan: 0 }), PM_WRAITH, 'a wraith killer raises a wraith');
    assert.equal(setHeroRemainsFromMonster({ mnum: mummy, mcan: 0 }), human.mummynum, 'a mummy killer raises the hero race mummy');
    assert.equal(setHeroRemainsFromMonster({ mnum: zombie, mcan: 0 }), human.zombienum, 'a zombie killer raises the hero race zombie');
    assert.equal(setHeroRemainsFromMonster({ mnum: lich, mcan: 0 }), human.zombienum, 'a lich also converts its victim to a zombie');
    assert.equal(setHeroRemainsFromMonster({ mnum: vampire, mcan: 0 }), vampire, 'a vampire raises a human victim as a vampire');
    assert.equal(setHeroRemainsFromMonster({ mnum: ghoul, mcan: 0 }), ghoul, 'a ghoul killer raises a ghoul');
    assert.equal(setHeroRemainsFromMonster({ mnum: skeleton, mcan: 0 }), NON_PM, 'a skeleton is not a zombie maker');
    assert.equal(setHeroRemainsFromMonster({ mnum: zombie, mcan: 1 }), NON_PM, 'a cancelled zombie maker converts nobody');
    game.urace = elf;
    assert.equal(setHeroRemainsFromMonster({ mnum: vampire, mcan: 0 }), NON_PM, 'a vampire does not raise a non-human victim');
    assert.equal(setHeroRemainsFromMonster({ mnum: mummy, mcan: 0 }), elf.mummynum, 'an elven mummy victim rises as an elf mummy');
    game.mvitals = [];
    game.mvitals[PM_WRAITH] = { born: 0, died: 0, mvflags: G_GENOD };
    assert.equal(setHeroRemainsFromMonster({ mnum: wraith, mcan: 0 }), NON_PM, 'a genocided riser leaves plain remains');
});
void test('a wraith victim rises in their bones as a named wraith with their vigor', async () => {
    freshPlayableRoom({
        seed: 51n,
        hero: {
            uz: { dnum: 0, dlevel: 8 },
            ulevel: 6,
            uhpmax: 41,
            uluck: 1,
        },
    });
    requirePlayingGame(game);
    init_objects();
    game.storage = memoryStorage();
    game._canMakeBones = true;
    game.plname = 'Nine';
    const dagger = await addInventoryObject(DAGGER);
    setHeroRemainsFromMonster({ mnum: MONSTER_NAME.indexOf('wraith'), mcan: 0 });
    assert.equal(await createBonesFromDeath('killed by a wraith', async () => 'y'), true);
    const wraith = requireGameLevel().monsters.find(monster => monster.mnum === PM_WRAITH);
    assert.ok(wraith, 'the bones wraith is missing');
    assert.equal(wraith.name, 'Nine');
    assert.equal(wraith.m_lev, 6);
    assert.equal(wraith.mhp, 41);
    assert.equal(wraith.mhpmax, 41);
    assert.equal(wraith.msleeping, 1);
    assert.equal(wraith.minvent?.includes(dagger), true);
    assert.equal(wraith.minvent?.some(object => object.otyp === MUMMY_WRAPPING), false);
    assert.deepEqual(floorObjectsAt(game.level, 10, 10), []);
});
void test('dropped death gear is cursed unless the native roll spares it', async () => {
    for (const [seed, cursedDagger, cursedRation] of [
        [2n, true, true],
        [11n, false, true],
    ]) {
        freshPlayableRoom({ seed });
        requirePlayingGame(game);
        init_objects();
        game.storage = memoryStorage();
        game._canMakeBones = true;
        const dagger = await addInventoryObject(DAGGER);
        const ration = await addInventoryObject(FOOD_RATION, { blessed: true });
        initRng(seed);
        await dropHeroInventoryForBones(10, 10);
        const remains = floorObjectsAt(game.level, 10, 10);
        assert.equal(remains.includes(dagger), true);
        assert.equal(remains.includes(ration), true);
        assert.equal(game.inventory.length, 0);
        assert.equal(!!dagger.cursed, cursedDagger, `dagger curse on seed ${seed}`);
        assert.equal(!!dagger.blessed, false, `dagger blessing on seed ${seed}`);
        assert.equal(!!ration.cursed, cursedRation, `ration curse on seed ${seed}`);
        assert.equal(!!ration.blessed, !cursedRation, `ration blessing on seed ${seed}`);
    }
});
//# sourceMappingURL=bones_death.test.js.map