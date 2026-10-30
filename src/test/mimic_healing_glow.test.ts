import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT } from '../js/const.js';
import { newsym } from '../js/display.js';
import { pushKeys } from '../js/input.js';
import { game } from '../js/gstate.js';
import { hitMonsterWithWand } from '../js/immediate_zap.js';
import { SCR_MAGIC_MAPPING, SPE_HEALING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

// C mon.c:mimic_hit_msg() reports a healing hit on an object mimic as
// "The scroll seems a more vivid white than before." — The(simple_typename())
// names the mimicked type alone, so an unidentified scroll appearance keeps
// its bare class noun instead of the "labeled ELBIB YLOH" description.
void test('healing a scroll mimic reports the bare type name', async () => {
    const input = freshTurnRoom();
    pushKeys(' '.repeat(200));
    const messages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
    };
    const mimic = await createMonsterAt('small mimic', 11, 10);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = SCR_MAGIC_MAPPING;
    await newsym(mimic.mx, mimic.my);

    await hitMonsterWithWand(mimic, await knownObject(SPE_HEALING));

    const glow = [...messages, game._pending_message]
        .find(message => /more vivid/.test(message ?? ''));
    assert.ok(glow, `no glow message in ${JSON.stringify(messages)}`);
    assert.match(glow, /^The scroll seems a more vivid \w+ than before\.$/);
    assert.doesNotMatch(glow, /labeled/);
});
