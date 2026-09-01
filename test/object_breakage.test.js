import test from 'node:test';
import assert from 'node:assert/strict';

import { objectBreaksOnImpact } from '../js/object_breakage.js';
import {
    OBJECT_NAMES, POT_WATER,
    WORTHLESS_PIECE_OF_RED_GLASS,
} from '../js/object_data.js';
import { looseObject } from './support/game-objects.js';

test('ordinary potions break unless their impact resistance succeeds', () => {
    const potion = looseObject(POT_WATER);

    assert.equal(objectBreaksOnImpact(potion, () => 1), true);
    assert.equal(objectBreaksOnImpact(potion, () => 0), false);
});

test('glass armor resists most impacts but glass gems do not shatter', () => {
    const crystalPlateMail = looseObject(
        OBJECT_NAMES.indexOf('crystal plate mail'),
    );
    const glassGem = looseObject(WORTHLESS_PIECE_OF_RED_GLASS);

    assert.equal(objectBreaksOnImpact(crystalPlateMail, () => 89), false);
    assert.equal(objectBreaksOnImpact(crystalPlateMail, () => 90), true);
    assert.equal(objectBreaksOnImpact(glassGem, () => 99), false);
});
