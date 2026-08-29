import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ARTIFACTS, artifactById, artifactByName, initializeArtifacts,
} from '../js/artifacts.js';
import { roles } from '../js/roles.js';

test('artifact enum excludes the disabled Palantir slot', () => {
    assert.equal(ARTIFACTS.length, 33);
    assert.equal(artifactById(23)?.name, 'The Sceptre of Might');
    assert.equal(artifactById(24)?.name, 'The Staff of Aesculapius');
    assert.equal(artifactById(33)?.name, 'The Eye of the Aethiopica');
    assert.equal(artifactByName('The Palantir of Westernesse'), null);
});

test('new-game artifact initialization resets existence and retargets role data', () => {
    const priest = roles.find(role => role.key === 'priest');
    const state = {
        urole: priest,
        initAlignment: { name: 'chaotic', value: -1 },
        _artifactExists: new Set([1]),
        _artifactExistCount: 7,
        _artifactDiscoveries: [1],
    };

    const runtime = initializeArtifacts(state);

    assert.equal(runtime.size, 33);
    assert.deepEqual([...state._artifactExists], []);
    assert.deepEqual(state._artifactDiscoveries, []);
    assert.equal(state._artifactExistCount, 0);
    assert.equal(state._artifactExistByBase.size, 0);
    assert.deepEqual(
        {
            role: artifactByName('Demonbane', state).role,
            alignment: artifactByName('Demonbane', state).alignment,
        },
        { role: 'priest', alignment: -1 },
    );
    assert.deepEqual(
        {
            role: artifactByName('The Mitre of Holiness', state).role,
            alignment: artifactByName('The Mitre of Holiness', state).alignment,
        },
        { role: 'priest', alignment: -1 },
    );
    assert.equal(artifactByName('Excalibur', state).role, null);
    assert.equal(ARTIFACTS[11].alignment, 1);
});

test('every role carries a quest-artifact owner into its runtime copy', () => {
    for (const role of roles) {
        const state = {
            urole: role,
            initAlignment: { name: 'chaotic', value: -1 },
        };
        initializeArtifacts(state);
        const questArtifact = artifactByName(role.artifactName, state);
        assert.ok(questArtifact, role.key);
        assert.equal(questArtifact.role, role.key, role.key);
        assert.equal(questArtifact.alignment, -1, role.key);
    }
});

test('Excalibur retains Knight role ownership only for Knights', () => {
    const knight = roles.find(role => role.key === 'knight');
    const state = {
        urole: knight,
        initAlignment: { name: 'lawful', value: 1 },
    };
    initializeArtifacts(state);
    assert.equal(artifactByName('Excalibur', state).role, 'knight');
    assert.equal(
        artifactByName('The Magic Mirror of Merlin', state).role,
        'knight',
    );
});
