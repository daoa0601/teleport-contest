import { freshObjectRoom } from './support/object-room.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactByName, artifactExistCount, initializeArtifacts, nameArtifact, } from '../js/artifacts.js';
import { game } from '../js/gstate.js';
import { roles } from '../js/roles.js';
import { freshGame } from './support/game-state.js';
import { uninitializedObject } from './support/game-objects.js';
void test('the disabled Palantir cannot be named as an artifact', () => {
    assert.equal(artifactByName('The Palantir of Westernesse'), null);
});
void test('new-game artifact initialization resets existence and retargets role data', () => {
    const state = freshGame({ role: 'priest' });
    state.initAlignment = { name: 'chaotic', value: -1 };
    state._artifactExists = new Set([1]);
    state._artifactDiscoveries = [1];
    initializeArtifacts(state);
    assert.deepEqual([...state._artifactExists], []);
    assert.deepEqual(state._artifactDiscoveries, []);
    assert.equal(artifactExistCount(state), 0);
    const demonbane = artifactByName('Demonbane', state);
    assert.ok(demonbane);
    assert.deepEqual({ role: demonbane.role, alignment: demonbane.alignment }, { role: 'priest', alignment: -1 });
    const mitre = artifactByName('The Mitre of Holiness', state);
    assert.ok(mitre);
    assert.deepEqual({ role: mitre.role, alignment: mitre.alignment }, { role: 'priest', alignment: -1 });
    assert.equal(artifactByName('Excalibur', state)?.role, null);
});
void test('every role carries a quest-artifact owner into its runtime copy', () => {
    for (const role of roles) {
        const state = freshGame({ role });
        state.initAlignment = { name: 'chaotic', value: -1 };
        initializeArtifacts(state);
        const questArtifact = artifactByName(role.artifactName, state);
        assert.ok(questArtifact, role.key);
        assert.equal(questArtifact.role, role.key, role.key);
        assert.equal(questArtifact.alignment, -1, role.key);
    }
});
void test('Excalibur retains Knight role ownership only for Knights', () => {
    const state = freshGame({ role: 'knight' });
    state.initAlignment = { name: 'lawful', value: 1 };
    initializeArtifacts(state);
    assert.equal(artifactByName('Excalibur', state)?.role, 'knight');
    assert.equal(artifactByName('The Magic Mirror of Merlin', state)?.role, 'knight');
});
void test('naming Grimtooth permanently poisons its dagger', async () => {
    freshObjectRoom();
    initializeArtifacts(game);
    const grimtooth = artifactByName('Grimtooth');
    assert.ok(grimtooth);
    const dagger = await uninitializedObject(grimtooth.baseType);
    nameArtifact(dagger, grimtooth);
    assert.equal(dagger.opoisoned, 1);
});
//# sourceMappingURL=artifact_startup.test.js.map