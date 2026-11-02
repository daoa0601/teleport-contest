import test from 'node:test';
import assert from 'node:assert/strict';
import { W_RINGR, W_WEP } from '../js/const.js';
import { wearHeroAccessory, wearHeroArmor } from '../js/do_wear.js';
import { game } from '../js/gstate.js';
import { AMULET_OF_LIFE_SAVING, LEATHER_ARMOR, RIN_SHOCK_RESISTANCE } from '../js/object_data.js';
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

// C do_wear.c:Ring_on() makes sure the ring is not wielded right after
// setworn() installs the ring slot: setuwep(0), setuswapwep(0) or
// setuqwep(0) (it cannot use remove_worn_item() because the ring is
// already worn).  Amulet_on() releases through remove_worn_item(amul,
// FALSE) before setworn(amul, W_AMUL).
void test('putting on a wielded ring releases it from the weapon slot', async () => {
    await freshObjectRoom();
    const ring = await addInventoryObject(RIN_SHOCK_RESISTANCE);
    await setPrimaryWeapon(ring);

    await wearHeroAccessory(ring, 'uright');

    assert.equal(game.uwep, null);
    assert.equal((ring.owornmask ?? 0) & W_WEP, 0);
    assert.equal(game.uright, ring);
    assert.equal((ring.owornmask ?? 0) & W_RINGR, W_RINGR);
});

void test('putting on a wielded amulet releases it from the weapon slot', async () => {
    await freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await setPrimaryWeapon(amulet);

    await wearHeroAccessory(amulet, 'uamul');

    assert.equal(game.uwep, null);
    assert.equal((amulet.owornmask ?? 0) & W_WEP, 0);
    assert.equal(game.uamul, amulet);
});
