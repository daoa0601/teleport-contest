import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName, artifactInfoLines, createRandomArtifact, initializeArtifacts, setArtifactOrigin, uncreateArtifact, } from '../js/artifacts.js';
import { prepareBonesObjectForRestore } from '../js/bones_object.js';
import { grantPrayerFavor } from '../js/divine_gifts.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { readObjectName } from '../js/objnam.js';
import { restoreGame, saveGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { makeWish } from '../js/wish.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
function dumpLine(name) {
    const line = artifactInfoLines().find(row => row.startsWith(`  ${name} `));
    assert.ok(line, `The artifact dump must include ${name}`);
    return line;
}
void test('a wished artifact has a wish origin before the hero learns it exists', async () => {
    freshObjectRoom();
    const result = await readObjectName('Magicbane', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.match(dumpLine('Magicbane'), /\[exists; wish\]$/);
});
void test('accepting an artifact wish preserves its origin and hero knowledge through save and restore', async () => {
    freshObjectRoom({ flags: { debug: true, verbose: false } });
    pushKeys('Magicbane\r');
    await makeWish();
    const storage = memoryStorage();
    game.plname = 'Artifact dump';
    assert.equal(await saveGame(storage), true);
    initializeArtifacts();
    assert.equal(restoreGame('Artifact dump', storage), true);
    assert.match(dumpLine('Magicbane'), /\[exists; hero knows; wish\]$/);
});
void test('an artifact gift replaces its random origin and resets knowledge when its origin changes again', async () => {
    freshObjectRoom();
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane);
    const athame = await mksobj(magicbane.baseType, false, false);
    createRandomArtifact(athame);
    assert.ok(athame.oartifact, 'An athame can become Magicbane');
    setArtifactOrigin(athame, 'gift', { knownOrigin: true });
    assert.match(dumpLine('Magicbane'), /\[exists; hero knows; gift\]$/);
    setArtifactOrigin(athame, 'bones');
    assert.match(dumpLine('Magicbane'), /\[exists; bones\]$/);
});
void test('crowning records the gifted sword in the artifact dump', async () => {
    freshObjectRoom({
        role: 'barbarian', hero: { ualign: { type: 0, record: 20 } },
    });
    pushKeys(' '.repeat(10));
    await grantPrayerFavor(7, 0);
    assert.match(dumpLine('Vorpal Blade'), /\[exists; hero knows; gift\]$/);
});
void test('restoring an artifact from bones replaces its previous wish origin', async () => {
    freshObjectRoom();
    const result = await readObjectName('Magicbane', { wizardWish: true });
    assert.ok(result && !result.noWish);
    initializeArtifacts();
    prepareBonesObjectForRestore(result.object);
    assert.match(dumpLine('Magicbane'), /\[exists; bones\]$/);
});
void test('uncreating an artifact clears its dump flags before a replacement is generated', async () => {
    freshObjectRoom();
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane);
    const athame = await mksobj(magicbane.baseType, false, false);
    createRandomArtifact(athame);
    setArtifactOrigin(athame, 'gift', { knownOrigin: true });
    assert.equal(uncreateArtifact(athame), true);
    assert.match(dumpLine('Magicbane'), /\[\]$/);
    createRandomArtifact(athame);
    assert.match(dumpLine('Magicbane'), /\[exists; random\]$/);
});
void test('starting a new game clears the previous artifact creation flags', async () => {
    freshObjectRoom();
    const result = await readObjectName('Magicbane', { wizardWish: true });
    assert.ok(result && !result.noWish);
    initializeArtifacts();
    assert.match(dumpLine('Magicbane'), /\[\]$/);
});
for (const { description, origins } of [
    { description: 'an unknown artifact id', origins: new Map([[0, 'gift']]) },
    { description: 'an unknown creation origin', origins: new Map([[1, 'rumor']]) },
]) {
    void test(`restoring ${description} in the artifact dump leaves the live game intact`, async () => {
        const level = freshObjectRoom();
        const hero = game.u;
        game.plname = 'Invalid artifact origin';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:invalid artifact origin';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const saved = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
        saved.state._artifactOrigins = origins;
        storage.setItem(key, encodeSavedGraph(saved));
        assert.equal(restoreGame(game.plname, storage), false);
        assert.equal(game.level, level);
        assert.equal(game.u, hero);
    });
}
//# sourceMappingURL=artifact_dump.test.js.map