import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, YELLOW_DRAGON_SCALES } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('taking off yellow dragon armor exposes a wielded cockatrice corpse and resolves life saving', async () => {
    freshObjectRoom();
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const scales = await addInventoryObject(YELLOW_DRAGON_SCALES, { known: false });
    resetInputState().feed(`${scales.invlet}                `);
    await rhack('W'.charCodeAt(0));
    for (let turn = 0; turn < 20 && !scales.known; turn++) await moveloop_core();
    const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    await setPrimaryWeapon(corpse);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game._pending_message = '';
    installPagerInput(resetInputState(), {
        expected: /dragon scales|cockatrice|bare hands|stone|You die|But wait|medallion|feel much better/, limit: 12,
    });

    await rhack('T'.charCodeAt(0));
    for (let turn = 0; turn < 20 && scales.worn; turn++) await moveloop_core();

    assert.equal(game.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.uwep, null);
    assert.equal(game.uarm, null);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.inventory.includes(corpse), true);
});
