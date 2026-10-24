import test from 'node:test';
import assert from 'node:assert/strict';
import { ingSuffix } from '../js/hacklib.js';
// C hacklib.c:ing_suffix(). The gerund rules that egg hatch cries never
// reach: consonant doubling, "ie" -> "y", and trailing " on"/" off"/" with"
// particles, which are handled before the stem is transformed.
void test('ing_suffix doubles a consonant after a short vowel', () => {
    assert.equal(ingSuffix('tap'), 'tapping');
    assert.equal(ingSuffix('hop'), 'hopping');
    assert.equal(ingSuffix('sit'), 'sitting');
});
void test('ing_suffix treats w and y as vowels, so no doubling follows them', () => {
    // "growl" ends consonant-vowel(w)-consonant but w is in C's vowel set.
    assert.equal(ingSuffix('growl'), 'growling');
    assert.equal(ingSuffix('slither'), 'slithering', 'an "er" stem never doubles');
});
void test('ing_suffix folds "ie" to "y" and drops a bare trailing "e"', () => {
    assert.equal(ingSuffix('vie'), 'vying');
    assert.equal(ingSuffix('die'), 'dying');
    assert.equal(ingSuffix('grease'), 'greasing');
});
void test('ing_suffix transforms the stem before a trailing particle', () => {
    // "put" doubles its consonant and the particle returns after "ing".
    assert.equal(ingSuffix('put on'), 'putting on');
    assert.equal(ingSuffix('take off'), 'taking off');
    assert.equal(ingSuffix('deal with'), 'dealing with');
});
// timeout.c:1121 renders each cry_sound() word through ing_suffix(); the
// whole set avoids the doubling and "ie" branches.
void test('hatchling cries gerundize without doubling', () => {
    for (const [cry, gerund] of [
        ['hiss', 'hissing'], ['chitter', 'chittering'], ['gurgle', 'gurgling'],
        ['growl', 'growling'], ['chirp', 'chirping'], ['buzz', 'buzzing'],
        ['screech', 'screeching'], ['grunt', 'grunting'], ['mumble', 'mumbling'],
    ]) {
        assert.equal(ingSuffix(cry), gerund);
    }
});
//# sourceMappingURL=ing_suffix.test.js.map