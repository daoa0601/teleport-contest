import test from 'node:test';
import assert from 'node:assert/strict';

import { heroArmName, monsterArmName } from '../js/body_parts.js';

test('mbodypart ARM preserves native class and special-case ordering', () => {
    const cases = [
        [0, 'forelimb', 'giant ant default'],
        [12, 'foreleg', 'dog class'],
        [235, 'foreleg', 'owlbear before yeti class'],
        [234, 'arm', 'ape from yeti class'],
        [316, 'tentacle', 'jellyfish before eel class'],
        [321, 'tentacle', 'kraken before eel class'],
        [10, 'wing', 'cockatrice class'],
        [128, 'wing', 'raven special case'],
        [124, 'foreleg', 'ki-rin special case'],
        [81, 'foreleg', 'rothe special case'],
        [118, 'ray', 'light class'],
        [317, 'fin', 'ordinary eel class'],
        [114, 'anterior segment', 'worm class'],
        [96, 'pedipalp', 'spider class'],
        [214, 'vestigial limb', 'slithy form'],
        [28, 'appendage', 'eye class'],
        [6, 'pseudopod', 'blob class'],
        [153, 'region', 'stalker ARM remains elemental anatomy'],
        [154, 'region', 'elemental class'],
        [158, 'mycelium', 'fungus class'],
        [331, 'arm', 'role humanoid'],
    ];

    for (const [mnum, expected, label] of cases)
        assert.equal(monsterArmName(mnum), expected, label);
});

test('hero ARM uses the normal role record or the active polymorph record', () => {
    assert.equal(heroArmName({ u: {}, urole: { mnum: 6 } }), 'arm');
    assert.equal(heroArmName({
        u: { umonnum: 10, mtimedone: 100 },
        urole: { mnum: 6 },
    }), 'wing');
});
