import test from 'node:test';
import assert from 'node:assert/strict';
import { body_part, mbodypart } from '../js/polyself.js';
import { ARM, BLOOD, FACE, HEAD } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshGame } from './support/game-state.js';
void test('mbodypart ARM preserves native class and special-case ordering', () => {
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
        assert.equal(mbodypart(mnum, ARM), expected, label);
});
void test('hero ARM uses the normal role record or the active polymorph record', () => {
    assert.equal(body_part(ARM, freshGame()), 'arm');
    assert.equal(body_part(ARM, freshGame({ hero: { umonnum: 10, mtimedone: 100 } })), 'wing');
});
void test('face descriptions distinguish a worm segment from an eel jaw', () => {
    const heroForm = (name) => freshGame({ hero: { umonnum: MONSTER_NAME.indexOf(name) } });
    assert.equal(body_part(FACE, heroForm('long worm')), 'clitellum');
    assert.equal(body_part(FACE, heroForm('giant eel')), 'premaxillary');
    assert.equal(body_part(FACE, heroForm('jellyfish')), 'front');
});
void test('eyeballs and light have a body or beam where a human has a face', () => {
    assert.equal(body_part(FACE, freshGame()), 'face');
    assert.equal(body_part(FACE, freshGame({ hero: { umonnum: MONSTER_NAME.indexOf('floating eye') } })), 'body');
    assert.equal(body_part(FACE, freshGame({ hero: { umonnum: MONSTER_NAME.indexOf('yellow light') } })), 'beam');
});
void test('blood descriptions follow the current body substance', () => {
    for (const [form, substance] of [
        ['giant spider', 'hemolymph'], ['lichen', 'juices'],
        ['floating eye', 'life force'], ['yellow light', 'beam'],
    ]) {
        const state = freshGame({ hero: { umonnum: MONSTER_NAME.indexOf(form) } });
        assert.equal(body_part(BLOOD, state), substance, form);
    }
});
void test('light and jellyfish heads follow the class tables, not humanoid names', () => {
    // C mbodypart() sends the whole S_LIGHT class to "beam" for HEAD; the
    // per-part port used to lump lights with spheres ("body"), and the
    // jellyfish missed its jelly-class "cerebral area".
    assert.equal(mbodypart(MONSTER_NAME.indexOf('yellow light'), HEAD), 'beam');
    assert.equal(mbodypart(MONSTER_NAME.indexOf('black light'), HEAD), 'beam');
    assert.equal(mbodypart(MONSTER_NAME.indexOf('jellyfish'), HEAD), 'cerebral area');
    assert.equal(mbodypart(MONSTER_NAME.indexOf('stalker'), HEAD), 'head');
});
//# sourceMappingURL=body_part.test.js.map