import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_FURNITURE } from '../js/const.js';
import { newsym } from '../js/display.js';
import { pushKeys } from '../js/input.js';
import { hitMonsterWithWand } from '../js/immediate_zap.js';
import { MAP_SYMBOLS } from '../js/map_symbols.js';
import { SPE_STONE_TO_FLESH } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const appearance of ['staircase up', 'staircase down', 'opulent throne']) {
    void test(`stone to flesh reveals a mimic disguised as ${appearance}`, async () => {
        freshTurnRoom();
        pushKeys(' '.repeat(20));
        const mimic = await createMonsterAt('small mimic', 11, 10);
        mimic.m_ap_type = M_AP_FURNITURE;
        mimic.mappearance = MAP_SYMBOLS.findIndex(symbol => symbol.name === appearance);
        assert.ok(mimic.mappearance >= 0, `${appearance} must be a dungeon symbol`);
        mimic.msleeping = 1;
        await newsym(mimic.mx, mimic.my);

        await hitMonsterWithWand(mimic, await knownObject(SPE_STONE_TO_FLESH));

        assert.equal(mimic.m_ap_type, 0, 'the stone disguise must be removed');
        assert.equal(mimic.msleeping, 0, 'the revealed mimic wakes up');
    });
}
