import test from 'node:test';
import assert from 'node:assert/strict';

import {
    breakFloorObject, objectBreaksOnImpact,
} from '../js/object_breakage.js';
import {
    OBJECT_NAMES, POT_WATER,
    WORTHLESS_PIECE_OF_RED_GLASS,
} from '../js/object_data.js';
import { floorObject, looseObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';

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

test('crystal armor cracks three times before the next impact destroys it',
    async () => {
        freshGameplayRoom();
        const armor = floorObject(
            OBJECT_NAMES.indexOf('crystal plate mail'), 11, 10,
        );
        const options = {
            publish: async () => {},
            random: () => 90,
        };

        for (let impact = 0; impact < 3; impact++)
            await breakFloorObject(armor, options);
        assert.equal(armor.where, 'floor');
        assert.equal(armor.oeroded, 3);

        await breakFloorObject(armor, options);
        assert.equal(armor.where, 'gone');
    });
