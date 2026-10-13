import assert from 'node:assert/strict';
import test from 'node:test';

import { M_AP_FURNITURE, M_AP_OBJECT, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { farlookLocationDescription } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { CHEST } from '../js/object_data.js';
import { MAP_SYMBOLS } from '../js/map_symbols.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('farlook reports an unremembered object disguise as something', async () => {
    const level = freshObjectRoom({ hero: { detectMonsters: true } });
    level.flags.hero_memory = true;
    const mimic = await createMonsterAt('small mimic', 30, 10, MM_NOGRP | NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = CHEST;
    newsym(30, 10);

    assert.equal(await farlookLocationDescription(30, 10), 'small mimic, mimicking something');
});

void test('farlook names a sensed furniture disguise', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    const mimic = await createMonsterAt('small mimic', 11, 10, MM_NOGRP | NO_MINVENT);
    mimic.m_ap_type = M_AP_FURNITURE;
    const stairs = MAP_SYMBOLS.findIndex(symbol => symbol.name === 'staircase down');
    assert.ok(stairs >= 0);
    mimic.mappearance = stairs;
    newsym(11, 10);

    assert.equal(await farlookLocationDescription(11, 10), 'small mimic, mimicking a staircase down');
});
