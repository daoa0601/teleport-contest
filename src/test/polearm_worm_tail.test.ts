import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOTAIL, NO_MINVENT, P_BASIC, P_POLEARMS } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a polearm strikes a worm tail in range even when its head is out of range', async () => {
    freshObjectRoom();
    const polearm = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'), { spe: 10 });
    await setPrimaryWeapon(polearm);
    installHeroWeaponSkills({ [P_POLEARMS]: P_BASIC });
    const worm = await createMonsterAt('long worm', 12, 9, NO_MINVENT | MM_NOTAIL);
    initializeMonsterWormBody(worm, { segmentCount: 0 });
    worm.wormSegments = [{ x: 11, y: 8 }, { x: 10, y: 8 }];
    worm.mhp = worm.mhpmax = 100;
    worm.mpeaceful = 0;
    game._travelTipShown = true;
    newsym(10, 8);

    await applyInventoryObject(polearm, '.       ');

    assert.ok(worm.mhp < 100, 'the selected tail belongs to the living worm');
    assert.equal(game.context.move, 1);
});
