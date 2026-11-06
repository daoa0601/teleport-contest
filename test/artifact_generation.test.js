import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactById, artifactByName, artifactExistCount, initializeArtifacts, mk_artifact, nameArtifact, uncreateArtifact, } from '../js/artifact.js';
import { A_NONE } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mksobj, placeCreatedObject } from '../js/mkobj.js';
import { initRng } from '../js/rng.js';
import { saveGame, restoreGame } from '../js/save.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
async function generateArtifactOfType(otyp) {
    for (let attempt = 0; attempt < 300; attempt++) {
        const object = await mksobj(otyp, true, true);
        if (object.artifact)
            return object;
    }
    assert.fail('no artifact was generated in 300 attempts');
}
void test('random artifact generation assigns a real, unique named identity', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane);
    initRng(1n);
    const artifact = await generateArtifactOfType(magicbane.baseType);
    assert.equal(artifact.oartifact, magicbane.id);
    assert.ok(artifact.oextra);
    assert.equal(artifact.oextra.oname, 'Magicbane');
    assert.equal(artifact.quan, 1);
    assert.equal(artifactExistCount(), 1);
    for (let attempt = 0; attempt < 300; attempt++) {
        const ordinary = await mksobj(magicbane.baseType, true, true);
        assert.ok(!ordinary.oartifact && !ordinary.artifact, 'Magicbane cannot be generated twice');
    }
    uncreateArtifact(artifact);
    assert.equal(artifactExistCount(), 0);
    assert.equal((await generateArtifactOfType(magicbane.baseType)).oartifact, magicbane.id);
});
void test('named artifacts also exclude their identity from random generation', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane);
    const named = await mksobj(magicbane.baseType, false, false);
    nameArtifact(named, magicbane);
    initRng(1n);
    for (let attempt = 0; attempt < 300; attempt++) {
        const ordinary = await mksobj(magicbane.baseType, true, true);
        assert.ok(!ordinary.oartifact && !ordinary.artifact, 'existing Magicbane excludes another copy');
    }
    assert.equal(artifactExistCount(), 1);
});
void test('saving preserves generated artifact identity and prevents another copy', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    const storage = memoryStorage();
    game.plname = 'Artifact';
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane);
    initRng(1n);
    const artifact = await generateArtifactOfType(magicbane.baseType);
    placeCreatedObject(artifact, 10, 10);
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Artifact', storage), true);
    const restored = floorObjectsAt(requireGameLevel(), 10, 10)[0];
    assert.ok(restored);
    assert.ok(restored.oextra);
    assert.equal(restored.oartifact, magicbane.id);
    assert.equal(restored.oextra.oname, 'Magicbane');
    assert.equal(artifactExistCount(), 1);
    for (let attempt = 0; attempt < 300; attempt++) {
        const ordinary = await mksobj(magicbane.baseType, true, true);
        assert.ok(!ordinary.oartifact && !ordinary.artifact);
    }
});
for (const [enchantment, adjustEnchantment, expected] of [
    [1, true, 3],
    [9, true, 9],
    [1, false, 1],
]) {
    void test(`random Dragonbane generation adjusts +${enchantment} only when allowed (${adjustEnchantment})`, async () => {
        await freshObjectRoom();
        requirePlayingGame(game);
        initializeArtifacts();
        const dragonbane = artifactByName('Dragonbane');
        assert.ok(dragonbane);
        const sword = await mksobj(dragonbane.baseType, false, false);
        sword.spe = enchantment;
        sword.oeroded = 2;
        sword.oeroded2 = 1;
        const artifact = await mk_artifact({ object: sword, alignment: A_NONE }, 99, adjustEnchantment);
        assert.equal(artifact, sword);
        assert.equal(artifact.oartifact, dragonbane.id);
        assert.equal(artifact.spe, expected);
        assert.equal(artifact.oeroded, 0);
        assert.equal(artifact.oeroded2, 0);
    });
}
void test('random Grimtooth generation supplies its permanent poison', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    const grimtooth = artifactByName('Grimtooth');
    assert.ok(grimtooth);
    const dagger = await mksobj(grimtooth.baseType, false, false);
    await mk_artifact({ object: dagger, alignment: A_NONE }, 99, true);
    assert.equal(dagger.oartifact, grimtooth.id);
    assert.equal(dagger.opoisoned, 1);
});
void test('random generation cannot create a quest artifact from its base armor', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    const mitre = artifactByName('The Mitre of Holiness');
    assert.ok(mitre);
    const helm = await mksobj(mitre.baseType, false, false);
    assert.equal(await mk_artifact({ object: helm, alignment: A_NONE }, 99, true), helm);
    assert.ok(!helm.artifact && !helm.oartifact);
    assert.equal(artifactExistCount(), 0);
});
void test('a divine gift by alignment creates an aligned artifact and none remain once eligible ones exist', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    initRng(7n);
    const alignment = game.u.ualign.type;
    const gift = await mk_artifact({ object: null, alignment }, 99, true);
    assert.ok(gift, 'The first divine gift is always available');
    const artifact = artifactById(gift.oartifact ?? 0);
    assert.ok(artifact, 'A divine gift carries its artifact identity');
    assert.equal(gift.otyp, artifact.baseType);
    assert.ok(artifact.alignment === null || artifact.alignment === alignment, 'A divine gift matches the requested alignment or is unaligned');
    // artifact.c returns NULL once every artifact eligible for the alignment
    // exists: each gift names one more, so the requests exhaust the list.
    let bestowed = 0;
    while (await mk_artifact({ object: null, alignment }, 99, true) !== null) {
        if (++bestowed > 100)
            assert.fail('divine gifts did not exhaust the eligible artifacts');
    }
    assert.ok(bestowed > 0, 'More than one artifact was eligible for the alignment');
});
//# sourceMappingURL=artifact_generation.test.js.map