import { clearBypasses } from '../js/object_bypass.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MFAST, M_AP_OBJECT } from '../js/const.js';
import { newsym } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    hitFloorPileWithWand, hitMonsterWithWand,
    hitObjectWithWand,
} from '../js/immediate_zap.js';
import { cancelObjectMagic } from '../js/object_cancellation.js';
import {
    CHEST, CORPSE, DAGGER, OBJECT_NAMES, POT_FRUIT_JUICE, POT_SICKNESS,
    SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH, WAN_CANCELLATION, WAN_MAKE_INVISIBLE,
    WAN_POLYMORPH, WAN_SLEEP, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_UNDEAD_TURNING,
} from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterStatusLine } from '../js/monster_status.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { probeObjectChain } from '../js/magic_probe.js';
import { chargedWand, floorObject, knownObject, unopenedCatBox } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

function room(options = {}) {
    freshGameplayRoom(options);
    pushKeys(' '.repeat(200));
}

void test('a point speed effect affects only its actual peaceful monster', async () => {
    room();
    const target = await createMonsterAt('jackal', 11, 10);
    const farther = await createMonsterAt('jackal', 12, 10);
    target.mpeaceful = 1;
    const wand = await chargedWand(WAN_SPEED_MONSTER);
    await hitMonsterWithWand(target, wand);
    assert.equal(target.mspeed, MFAST);
    assert.equal(target.mpeaceful, 1);
    assert.equal(farther.mspeed, 0);
});

void test('immediate striking is blocked by innate anti-magic immunity', async () => {
    room();
    const dragon = await createMonsterAt('gray dragon', 11, 10);
    const health = dragon.mhp;
    await hitMonsterWithWand(dragon, await chargedWand(WAN_STRIKING));
    assert.equal(dragon.mhp, health);
});

void test('broken sleep magic leaves the monster in timed sleep after hostility', async () => {
    room();
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mpeaceful = 1;
    await hitMonsterWithWand(jackal, await chargedWand(WAN_SLEEP, { charges: 4 }));
    assert.equal(jackal.mcanmove, 0);
    assert.ok((jackal.mfrozen ?? 0) >= 5 && (jackal.mfrozen ?? 0) <= 60);
    assert.equal(jackal.mpeaceful, 0);
});

void test('make invisible changes the actual monster and retains its position', async () => {
    room();
    const jackal = await createMonsterAt('jackal', 11, 10);
    await hitMonsterWithWand(jackal, await chargedWand(WAN_MAKE_INVISIBLE));
    assert.ok(jackal.minvis);
    assert.equal(jackal.mx, 11);
    assert.equal(jackal.my, 10);
});

void test('cancellation neutralizes every potion in the selected floor pile', async () => {
    room();
    const first = await floorObject(POT_SICKNESS, 11, 10, { blessed: true });
    const elsewhere = await floorObject(POT_SICKNESS, 12, 10, { cursed: true });
    const dagger = await floorObject(DAGGER, 11, 10, { spe: 3, cursed: true });
    await hitFloorPileWithWand(await chargedWand(WAN_CANCELLATION), 11, 10);
    assert.equal(first.otyp, POT_FRUIT_JUICE);
    assert.equal(first.blessed, false);
    assert.equal(dagger.spe, 0);
    assert.equal(dagger.cursed, false);
    assert.equal(elsewhere.otyp, POT_SICKNESS);
    assert.equal(elsewhere.cursed, true);
});

void test('a wand cannot apply its effect to itself', async () => {
    room();
    const wand = await floorObject(WAN_CANCELLATION, 11, 10, { spe: 5, cursed: true });
    assert.equal(await hitObjectWithWand(wand, wand), 0);
    assert.equal(wand.spe, 5);
    assert.equal(wand.cursed, true);
});

void test('bypassed dropped objects wait until the next turn before another polymorph', async () => {
    room();
    requireFixtureGame(game);
    const dagger = await floorObject(DAGGER, 11, 10, { bypass: true });
    game.context.bypasses = true;
    await hitFloorPileWithWand(await chargedWand(WAN_POLYMORPH), 11, 10);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.otyp, DAGGER);
    clearBypasses();
    assert.equal(dagger.bypass, false);
});

void test('opening magic repairs an already open broken box without claiming an effect', async () => {
    room();
    const box = await floorObject(CHEST, 11, 10, { obroken: true, olocked: false });
    const wand = await chargedWand(OBJECT_NAMES.indexOf('opening'));
    assert.equal(await hitObjectWithWand(box, wand), 0);
    assert.equal(box.obroken, false);
});

void test('locking and opening identify a wizard-known box lock', async () => {
    room({ role: 'wizard' });
    const box = await floorObject(CHEST, 11, 10, { obroken: true, olocked: false });
    await hitObjectWithWand(box, await chargedWand(OBJECT_NAMES.indexOf('locking')));
    assert.equal(box.olocked, true);
    assert.equal(box.obroken, false);
    assert.equal(box.lknown, true);
    await hitObjectWithWand(box, await chargedWand(OBJECT_NAMES.indexOf('opening')));
    assert.equal(box.olocked, false);
    assert.equal(box.lknown, true);
});

void test('probing carried boxes learns containment without collapsing Schroedinger state', async () => {
    room();
    const catBox = await unopenedCatBox({ dknown: false, lknown: false });
    assert.ok(catBox.contents !== null && catBox.contents !== undefined);
    const contents = catBox.contents[0];
    assert.ok(contents !== null && contents !== undefined);
    contents.dknown = false;
    probeObjectChain([catBox]);
    assert.equal(catBox.dknown, true);
    assert.equal(catBox.lknown, true);
    assert.equal(catBox.cknown, false);
    assert.equal(contents.dknown, false);
});

void test('a cancellation wand keeps its charges when cancelled but loses its curse', async () => {
    room();
    const wand = await chargedWand(WAN_CANCELLATION, { charges: 4, cursed: true });
    await cancelObjectMagic(wand);
    assert.equal(wand.spe, 4);
    assert.equal(wand.cursed, false);
});

void test('an undead killed by turning leaves a corpse protected from the same magic', async () => {
    room();
    requireFixtureGame(game);
    const zombie = await createMonsterAt('giant zombie', 11, 10);
    zombie.mhp = 1;
    const wand = await chargedWand(WAN_UNDEAD_TURNING);
    await hitMonsterWithWand(zombie, wand);
    await hitFloorPileWithWand(wand, 11, 10);
    assert.ok(!game.level.monsters.includes(zombie) || zombie.mhp <= 0);
    assert.ok(floorObjectsAt(requireGameLevel(game), 11, 10).some(object => object.otyp === CORPSE));
    assert.ok(!game.level.monsters.some(monster => monster.mx === 11 && monster.my === 10 && monster.mhp > 0));
});

void test('extra healing restores a peaceful monster without anger and cures blindness', async () => {
    room();
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mpeaceful = 1;
    jackal.mhp = 1;
    jackal.mcansee = 0;
    jackal.mblinded = 12;
    await hitMonsterWithWand(jackal, await knownObject(SPE_EXTRA_HEALING));
    assert.equal(jackal.mhp, jackal.mhpmax);
    assert.equal(jackal.mpeaceful, 1);
    assert.equal(jackal.mcansee, 1);
    assert.equal(jackal.mblinded, 0);
});

void test('stone to flesh turns a stone golem into a flesh golem', async () => {
    room();
    const golem = await createMonsterAt('stone golem', 11, 10);
    await hitMonsterWithWand(golem, await knownObject(SPE_STONE_TO_FLESH));
    assert.equal(MONSTER_NAME[golem.mnum], 'flesh golem');
});

void test('probing describes a mimic without exposing or changing its disguise', async () => {
    room();
    const mimic = await createMonsterAt('small mimic', 11, 10);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = CHEST;
    newsym(mimic.mx, mimic.my);
    const status = await monsterStatusLine(mimic);
    assert.match(status, /mimicking a chest/);
    assert.equal(mimic.m_ap_type & 3, M_AP_OBJECT);
    assert.equal(mimic.mappearance, CHEST);
});

void test('locking reveals an adjacent chest mimic without making it grab the hero', async () => {
    room();
    requireFixtureGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = CHEST;
    mimic.msleeping = 1;
    newsym(mimic.mx, mimic.my);
    await hitMonsterWithWand(mimic, await chargedWand(OBJECT_NAMES.indexOf('locking')));
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(mimic.msleeping, 1);
    assert.ok(!game.u.ustuck);
});

void test('probing includes a distant visible gas region around a target', async () => {
    room();
    requireFixtureGame(game);
    const jackal = await createMonsterAt('jackal', 17, 10);
    await createHarmlessGasCloudSelection(game, [{ x: 17, y: 10 }], { ttl: 10 });
    assert.match(await monsterStatusLine(jackal), /in a cloud of vapor/);
});

void test('wizard probing reports pet hunger and apport from the actual pet', async () => {
    room();
    requireFixtureGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    initializePet(jackal);
    game.flags.debug = true;
    const status = await monsterStatusLine(jackal);
    assert.ok(jackal.edog !== null && jackal.edog !== undefined);
    assert.ok(status.includes(`hungry ${jackal.edog.hungrytime}`));
    assert.ok(status.includes(`apport ${jackal.edog.apport}`));
});

void test('probing a mounted pony reports the wounded rear leg', async () => {
    room();
    requireFixtureGame(game);
    const pony = await createSaddledSteed();
    game.u.usteed = pony;
    game.u._woundedLegSide = 'left';
    game.u._woundedLegTurns = 20;
    assert.match(await monsterStatusLine(pony), /carrying you, injured rear leg/);
    game.u._woundedLegSide = 'both';
    assert.match(await monsterStatusLine(pony), /injured rear legs/);
});
