import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    M_AP_F_DKNOWN, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, NO_MINVENT,
} from '../js/const.js';
import { threateningMonsterNearby } from '../js/do.js';
import { game } from '../js/gstate.js';
import { nameToMonster } from '../js/mondata.js';
import { MAP_SYMBOLS } from '../js/map_symbols.js';
import { runMonsterAction } from '../js/monmove.js';
import { CHEST, STETHOSCOPE } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { applyInventoryObject, runMonsterAbilityCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const [appearance, label] of [[M_AP_FURNITURE, 'furniture'], [M_AP_OBJECT, 'object']] as const) {
    void test(`a known ${label} disguise does not block safe waiting`, async () => {
        freshPlayableRoom();
        const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
        mimic.mpeaceful = false;
        mimic.m_ap_type = appearance | M_AP_F_DKNOWN;
        mimic.mappearance = appearance === M_AP_OBJECT ? CHEST
            : MAP_SYMBOLS.findIndex(symbol => symbol.name === 'closed door');

        assert.equal(threateningMonsterNearby(), false);
    });

    void test(`a hider with a known ${label} disguise stays disguised during its action`, async () => {
        freshPlayableRoom();
        requireFixtureGame(game);
        const mimic = await createMonsterAt('small mimic', 14, 10, NO_MINVENT);
        mimic.m_ap_type = appearance | M_AP_F_DKNOWN;
        mimic.mappearance = appearance === M_AP_OBJECT ? CHEST
            : MAP_SYMBOLS.findIndex(symbol => symbol.name === 'closed door');
        mimic.mpeaceful = false;

        const result = await runMonsterAction(mimic, game);

        assert.ok(result.movement !== null && result.movement !== undefined);
        assert.equal(result.movement.moved, false);
        assert.equal(mimic.mx, 14);
        assert.equal(mimic.my, 10);
        assert.equal(mimic.m_ap_type, appearance | M_AP_F_DKNOWN);
    });
}

void test('a stethoscope identifies a known object disguise by its object name', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = CHEST;
    const stethoscope = await addInventoryObject(STETHOSCOPE);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await applyInventoryObject(stethoscope, 'l   ');

    assert.match(messages.join('\n'), /That chest is really a small mimic/);
    assert.equal(mimic.m_ap_type, 0);
});

void test('a confusing gaze skips a known object disguise', async () => {
    freshMonsterAbilityRoom('umber hulk', { energy: 30 });
    requireFixtureGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = CHEST;
    mimic.mpeaceful = true;

    await runMonsterAbilityCommand(' '.repeat(8));

    assert.equal(mimic.mpeaceful, true);
    assert.equal(mimic.mconf ?? 0, 0);
    assert.equal(game.u.uen, 15);
    assert.match(game._pending_message, /You gaze at no place in particular/);
});

void test('a confusing gaze can affect a known monster disguise', async () => {
    freshMonsterAbilityRoom('umber hulk', { energy: 30 });
    const mimic = await createMonsterAt('Wizard of Yendor', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_MONSTER | M_AP_F_DKNOWN;
    mimic.mappearance = nameToMonster('jackal');
    mimic.mpeaceful = false;

    await runMonsterAbilityCommand(' '.repeat(8));

    assert.equal(mimic.mconf, 1);
});
