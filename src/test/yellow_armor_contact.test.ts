import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, YELLOW_DRAGON_SCALES } from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { polymonHero } from '../js/polyself.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';

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

for (const form of [null, 'hobbit', 'hill giant']) {
    const cause = form === null ? 'removing' : 'losing';
    const action = form === null ? 'taking off armor' : `becoming a ${form}`;
    void test(`${action} records ${cause} yellow dragon armor as the petrification cause`, async () => {
        freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
        game.storage = memoryStorage();
        const scales = await addInventoryObject(YELLOW_DRAGON_SCALES, { known: false });
        await putOn(scales);
        const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
        await setPrimaryWeapon(corpse);
        resetInputState().feed('                                                                ');

        if (form === null) {
            await rhack('T'.charCodeAt(0));
            for (let turn = 0; turn < 20 && !game.program_state.gameover && scales.worn; turn++)
                await moveloop_core();
        } else await polymonHero(MONSTER_NAME.indexOf(form));

        assert.equal(game.program_state.gameover, true);
        assert.equal(game._deathKiller, `${cause} yellow dragon scales while wielding a cockatrice corpse`);
        assert.equal(scales.worn, false);
        assert.equal(game.inventory.includes(scales), true, 'Fatal armor loss stops before dropping or destroying the scales');
    });
}

async function putOn(armor: GameObject): Promise<void> {
    game._moveloopStarted = true;
    game.u.umovement = 12;
    resetInputState().feed(`${armor.invlet}                `);
    await rhack('W'.charCodeAt(0));
    for (let turn = 0; turn < 20 && !armor.known; turn++) await moveloop_core();
}
