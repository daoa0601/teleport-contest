import test from 'node:test';
import assert from 'node:assert/strict';

import { makePlural } from '../js/object_grammar.js';

test('makePlural retains native monster irregular and compound grammar', () => {
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
