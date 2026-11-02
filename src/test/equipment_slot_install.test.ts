import test from 'node:test';
import assert from 'node:assert/strict';
import { W_RINGR, W_WEP } from '../js/const.js';
import { wearHeroAccessory, wearHeroArmor } from '../js/do_wear.js';
import { game } from '../js/gstate.js';
import { LEATHER_ARMOR, RIN_SHOCK_RESISTANCE } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C worn.c:setworn(): "if (obj && (obj->owornmask & W_ARMOR) != 0L)
// u.uroleplay.nudist = FALSE" — putting on any armor ends the nudist
// conduct, from whatever cause the slot was filled.
void test('wearing armor ends the nudist conduct', async () => {
    await freshObjectRoom();
    const roleplay = game.u.uroleplay ?? {
        pauper: false, nudist: false, reroll: false, numrerolls: 0,
        numbones: 0, blind: false, deaf: false,
    };
    roleplay.nudist = true;
    game.u.uroleplay = roleplay;
    const mail = await addInventoryObject(LEATHER_ARMOR);
    await wearHeroArmor(mail);

    assert.equal(game.u.uroleplay?.nudist, false);
});

// C do_wear.c:accessory_or_armor_on() wears a ring with setworn(obj, mask)
// and does not release weapon slots first (only the armor branch calls
// remove_worn_item()), so a wielded ring stays wielded while also worn;
// setworn() keeps each slot's mask independently on the same object.
void test('putting on a wielded ring keeps it wielded', async () => {
    await freshObjectRoom();
    const ring = await addInventoryObject(RIN_SHOCK_RESISTANCE);
    await setPrimaryWeapon(ring);

    await wearHeroAccessory(ring, 'uright');

    assert.equal(game.uwep, ring);
    assert.equal((ring.owornmask ?? 0) & W_WEP, W_WEP);
    assert.equal(game.uright, ring);
    assert.equal((ring.owornmask ?? 0) & W_RINGR, W_RINGR);
});
