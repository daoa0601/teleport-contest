import test from 'node:test';
import assert from 'node:assert/strict';

import { makePlural, makeSingular, verbForSubject, withIndefiniteArticle } from '../js/object_grammar.js';

void test('ya remains invariant as a word while other nouns ending in ya pluralize', () => {
    assert.equal(makePlural('ya'), 'ya');
    assert.equal(makePlural('poisoned ya'), 'poisoned ya');
    assert.equal(makePlural('YA named Needle'), 'YA named Needle');
    assert.equal(makePlural('papaya'), 'papayas');
    assert.equal(makePlural('Maya'), 'Mayas');
});

void test('noun inflection preserves suffix letter case and the rest of a compound', () => {
    assert.equal(makePlural('DAGGER called Needle'), 'DAGGERS called Needle');
    assert.equal(makePlural('BOX'), 'BOXES');
    assert.equal(makePlural('ALGA'), 'ALGAE');
    assert.equal(makePlural('GATEAU'), 'GATEAUX');
    assert.equal(makePlural('ChIlD'), 'ChIlDREN');
    assert.equal(makeSingular('ChIlDREN named Scout'), 'ChIlD named Scout');
    assert.equal(makeSingular('RUBIES'), 'RUBY');
});

void test('plural pronouns retain only initial capitalization', () => {
    assert.equal(makePlural('HE'), 'They');
    assert.equal(makePlural('HIM'), 'Them');
    assert.equal(makePlural('HIS'), 'Their');
    assert.equal(makePlural('her'), 'them');
    assert.equal(makePlural('its'), 'their');
});

void test('short fruit names do not trigger longer noun suffix rules', () => {
    assert.equal(makePlural('tex'), 'texes');
    assert.equal(makePlural('codex'), 'codices');
    assert.equal(makePlural('ato'), 'atos');
    assert.equal(makePlural('tomato'), 'tomatoes');
});

void test('makePlural retains native monster irregular and compound grammar', () => {
    const cases = new Map([
        ['water moccasin', 'water moccasins'],
        ['homunculus', 'homunculi'],
        ['ice vortex', 'ice vortices'],
        ['mumak', 'mumakil'],
        ['erinys', 'erinyes'],
        ['djinni', 'djinn'],
        ['lurker above', 'lurkers above'],
        ['Master of Thieves', 'Masters of Thieves'],
        ['human', 'humans'],
        ['watchman', 'watchmen'],
        ['baluchitherium', 'baluchitheria'],
        ['manes', 'manes'],
        ['Nazgul', 'Nazgul'],
        ['Olog-hai', 'Olog-hai'],
        ['arch-lich', 'arch-liches'],
        ['woodchuck', 'woodchucks'],
        ['wumpus', 'wumpuses'],
        ['fox', 'foxes'],
        ['grid bug', 'grid bugs'],
        ['piranha', 'piranha'],
    ]);

    for (const [singular, plural] of cases)
        assert.equal(makePlural(singular), plural, singular);
});


void test('indefinite descriptions use pronunciation, including single letters', () => {
    assert.equal(withIndefiniteArticle('acid blob'), 'an acid blob');
    assert.equal(withIndefiniteArticle('kitten'), 'a kitten');
    assert.equal(withIndefiniteArticle('one-eyed giant'), 'a one-eyed giant');
    assert.equal(withIndefiniteArticle('oneiric creature'), 'an oneiric creature');
    assert.equal(withIndefiniteArticle('unicorn horn'), 'a unicorn horn');
    assert.equal(withIndefiniteArticle('x-ray beam'), 'an x-ray beam');
    assert.equal(withIndefiniteArticle('xorn'), 'a xorn');
    assert.equal(withIndefiniteArticle('F note'), 'an F note');
    assert.equal(withIndefiniteArticle('B'), 'a B');
});

void test('definite descriptions and uncountable terrain do not gain an article', () => {
    assert.equal(withIndefiniteArticle('the Oracle'), 'the Oracle');
    assert.equal(withIndefiniteArticle('molten lava'), 'molten lava');
    assert.equal(withIndefiniteArticle('iron bars'), 'iron bars');
    assert.equal(withIndefiniteArticle('ice'), 'ice');
});


void test('verbs agree with the described noun before a type or given name', () => {
    assert.equal(verbForSubject('gloves of power', 'corrode'), 'corrode');
    assert.equal(verbForSubject('a pair of gloves', 'corrode'), 'corrodes');
    assert.equal(verbForSubject('teeth named Bite', 'are'), 'are');
    assert.equal(verbForSubject('the invisible erinys', 'have'), 'has');
    assert.equal(verbForSubject('you', 'have'), 'have');
});

void test('singular verbs preserve case and irregular endings', () => {
    assert.equal(verbForSubject(null, 'Are'), 'Is');
    assert.equal(verbForSubject(null, 'HAVE'), 'HAS');
    assert.equal(verbForSubject('wand', 'glow'), 'glows');
    assert.equal(verbForSubject('wand', 'go'), 'goes');
    assert.equal(verbForSubject('wand', 'DRY'), 'DRIES');
    assert.equal(verbForSubject('wand', 'flash'), 'flashes');
});
