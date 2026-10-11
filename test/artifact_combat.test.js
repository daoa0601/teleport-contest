import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName, artifactDamageBonus, artifactToHitBonus, resolveHeroArtifactTouch, } from '../js/artifacts.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, W_ARM, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BLACK_DRAGON_SCALES } from '../js/object_data.js';
import { polymonHero, returnHeroToHumanForm } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { races } from '../js/roles.js';
import { weaponHitBonus } from '../js/weapon_accuracy.js';
import { artifactObject, uninitializedObject } from './support/game-objects.js';
import { freshGame } from './support/game-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const maximumRoll = (range) => range;
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
test.beforeEach(() => freshObjectRoom({ recalculateVision: false }));
void test('Excalibur gets its accuracy and damage against any monster', async () => {
    const excalibur = await artifactObject('Excalibur');
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    const accuracy = artifactToHitBonus(excalibur, jackal, maximumRoll);
    const damage = artifactDamageBonus(excalibur, jackal, 7, maximumRoll);
    assert.equal(accuracy, 5);
    assert.equal(damage, 10);
});
void test('Orcrist doubles damage only against orcs', async () => {
    const orcrist = await artifactObject('Orcrist');
    const orc = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    assert.equal(artifactToHitBonus(orcrist, orc, maximumRoll), 5);
    assert.equal(artifactDamageBonus(orcrist, orc, 7, maximumRoll), 7);
    assert.equal(artifactToHitBonus(orcrist, jackal, maximumRoll), 0);
    assert.equal(artifactDamageBonus(orcrist, jackal, 7, maximumRoll), 0);
});
void test('Grimtooth damages every target but gets accuracy only against elves', async () => {
    const grimtooth = await artifactObject('Grimtooth');
    const elf = await createMonsterAt('elf', 11, 10, TEST_MONSTER_FLAGS);
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    assert.equal(artifactToHitBonus(grimtooth, elf, maximumRoll), 2);
    assert.equal(artifactToHitBonus(grimtooth, jackal, maximumRoll), 0);
    assert.equal(artifactDamageBonus(grimtooth, jackal, 7, maximumRoll), 6);
});
void test('the Sceptre of Might doubles damage against opposing alignments', async () => {
    const sceptre = await artifactObject('The Sceptre of Might');
    const orc = await createMonsterAt('orc', 11, 10, TEST_MONSTER_FLAGS);
    const angel = await createMonsterAt('Angel', 12, 10, TEST_MONSTER_FLAGS);
    assert.equal(artifactToHitBonus(sceptre, orc, maximumRoll), 5);
    assert.equal(artifactDamageBonus(sceptre, orc, 7, maximumRoll), 7);
    assert.equal(artifactToHitBonus(sceptre, angel, maximumRoll), 0);
    assert.equal(artifactDamageBonus(sceptre, angel, 7, maximumRoll), 0);
});
void test('Frost Brand bonuses stop at cold-resistant monsters', async () => {
    const frostBrand = await artifactObject('Frost Brand');
    const jackal = await createMonsterAt('jackal', 11, 10, TEST_MONSTER_FLAGS);
    const winterWolf = await createMonsterAt('winter wolf', 12, 10, TEST_MONSTER_FLAGS);
    assert.equal(artifactToHitBonus(frostBrand, jackal, maximumRoll), 5);
    assert.equal(artifactDamageBonus(frostBrand, jackal, 7, maximumRoll), 7);
    assert.equal(artifactToHitBonus(frostBrand, winterWolf, maximumRoll), 0);
    assert.equal(artifactDamageBonus(frostBrand, winterWolf, 7, maximumRoll), 0);
});
void test('an artifact defense blocks the matching special attack', async () => {
    const frostBrand = await artifactObject('Frost Brand');
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    await equipMonsterObject(jackal, await artifactObject('Frost Brand'), W_WEP);
    assert.equal(artifactToHitBonus(frostBrand, jackal, maximumRoll), 0);
    assert.equal(artifactDamageBonus(frostBrand, jackal, 7, maximumRoll), 0);
});
void test('Stormbringer cannot drain an undead monster', async () => {
    const stormbringer = await artifactObject('Stormbringer');
    const vampire = await createMonsterAt('vampire', 12, 10, TEST_MONSTER_FLAGS);
    assert.equal(artifactToHitBonus(stormbringer, vampire, maximumRoll), 0);
    assert.equal(artifactDamageBonus(stormbringer, vampire, 7, maximumRoll), 0);
});
void test('black dragon scales protect a monster from Stormbringer', async () => {
    const stormbringer = await artifactObject('Stormbringer');
    const scales = await uninitializedObject(BLACK_DRAGON_SCALES);
    const jackal = await createMonsterAt('jackal', 12, 10, TEST_MONSTER_FLAGS);
    await equipMonsterObject(jackal, scales, W_ARM);
    assert.equal(artifactDamageBonus(stormbringer, jackal, 7, maximumRoll), 0);
});
void test('Grimtooth rejects an elf hero', async () => {
    const race = races.find((race) => race.name === 'elf');
    assert.ok(race);
    freshGame({
        race,
        flags: { female: false },
        hero: {
            mtimedone: 0,
            ulycn: -1,
            ualign: { type: -1, record: 10 },
        },
    });
    requirePlayingGame(game);
    initRng(301n);
    const grimtooth = await artifactObject('Grimtooth');
    const touch = resolveHeroArtifactTouch(grimtooth, artifactByName('Grimtooth'));
    assert.equal(touch.badAlignment, true);
});
for (const [raceName, artifactName, maximumBonus] of [
    ['elf', 'Grimtooth', 2],
    ['orc', 'Orcrist', 5],
]) {
    void test(`${artifactName} targets a ${raceName} hero's race only while unpolymorphed`, async () => {
        const race = races.find((race) => race.name === raceName);
        assert.ok(race);
        freshObjectRoom({ role: 'wizard', race });
        requirePlayingGame(game);
        const artifact = await artifactObject(artifactName, { spe: 0 });
        const ordinary = await uninitializedObject(artifact.otyp, { spe: 0 });
        const ordinaryAccuracy = weaponHitBonus(ordinary, game.u);
        const racialBonus = weaponHitBonus(artifact, game.u) - ordinaryAccuracy;
        assert.ok(racialBonus >= 1 && racialBonus <= maximumBonus);
        pushKeys(' '.repeat(20));
        await polymonHero(MONSTER_NAME.indexOf('tiger'));
        assert.equal(weaponHitBonus(artifact, game.u), ordinaryAccuracy, 'the carnivore body does not retain racial vulnerability');
        await returnHeroToHumanForm();
        const restoredBonus = weaponHitBonus(artifact, game.u) - ordinaryAccuracy;
        assert.ok(restoredBonus >= 1 && restoredBonus <= maximumBonus);
    });
}
//# sourceMappingURL=artifact_combat.test.js.map