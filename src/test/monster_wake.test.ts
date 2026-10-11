import test from 'node:test';
import assert from 'node:assert/strict';

import {
    M_AP_F_DKNOWN, M_AP_MONSTER, M_AP_NOTHING, POOL,
} from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { nameToMonster } from '../js/mondata.js';
import { wakeMonster } from '../js/monster_anger.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('waking a monster-disguised mimic does not reveal it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10);
    const appearance = nameToMonster('little dog');
    mimic.m_ap_type = M_AP_MONSTER | M_AP_F_DKNOWN;
    mimic.mappearance = appearance;
    mimic.meating = 3;

    await wakeMonster(mimic);

    assert.equal(mimic.m_ap_type, M_AP_MONSTER | M_AP_F_DKNOWN);
    assert.equal(mimic.mappearance, appearance);
    assert.equal(mimic.meating, 0);
});

void test('waking a disguised Wizard runs the non-mimic appearance cleanup', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const wizard = await createMonsterAt('Wizard of Yendor', 11, 10);
    wizard.m_ap_type = M_AP_MONSTER;
    wizard.mappearance = nameToMonster('little dog');

    await wakeMonster(wizard);

    assert.equal(wizard.m_ap_type, M_AP_NOTHING);
    assert.equal(wizard.mappearance, 0);
});

for (const [forcefight, monMoving] of [[true, false], [false, false], [true, true]] satisfies [boolean, boolean][]) {
    void test(`waking a hidden eel with forcefight=${forcefight} and monster movement=${monMoving}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.level.requireAt(11, 10).typ = POOL;
        const eel = await createMonsterAt('giant eel', 11, 10);
        eel.mundetected = 1;
        game.context.forcefight = forcefight;
        game.context.mon_moving = monMoving;
        assert.equal(canSeeMonster(eel), false);

        await wakeMonster(eel);

        const revealed = forcefight && !monMoving;
        assert.equal(eel.mundetected, revealed ? 0 : 1);
        assert.equal(canSeeMonster(eel), revealed);
    });
}
