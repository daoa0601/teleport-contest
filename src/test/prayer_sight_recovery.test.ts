import assert from 'node:assert/strict';
import test from 'node:test';
import { POT_HEALING } from '../js/object_data.js';
import { fixPrayerTrouble, Trouble } from '../js/prayer_trouble.js';
import { heroIsBlind, setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('prayer reveals carried objects when it restores sight', async () => {
    await freshObjectRoom();
    setHeroBlindnessTurns(20);
    const potion = await addInventoryObject(POT_HEALING);
    potion.dknown = false;

    await fixPrayerTrouble(Trouble.BLIND);

    assert.equal(heroIsBlind(), false);
    assert.equal(potion.dknown, true, 'restored sight reveals the carried potion appearance');
});
