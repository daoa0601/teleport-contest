import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { EXPENSIVE_CAMERA, WAN_LIGHT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { flashHitsMonster } from '../js/uhitm.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const sourceType of [WAN_LIGHT, EXPENSIVE_CAMERA]) {
    void test(`${sourceType === WAN_LIGHT ? 'a wand of light' : 'a camera'} damages and blinds an awake gremlin`, async () => {
        await freshObjectRoom();
        const gremlin = await createMonsterAt('gremlin', 13, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        gremlin.msleeping = 0;
        gremlin.mhp = gremlin.mhpmax = 30;
        const source = await knownObject(sourceType, { spe: 2 });
        source.ox = 10;
        source.oy = 10;
        installPagerInput(resetInputState(), { expected: /gremlin|flash|light|pain|agony/i, limit: 8 });
        initRng(1n);

        await flashHitsMonster(gremlin, source, { state: game });

        const damage = 30 - gremlin.mhp;
        assert.ok(damage >= (sourceType === WAN_LIGHT ? 3 : 1), `light damage was ${damage}`);
        assert.ok(damage <= (sourceType === WAN_LIGHT ? 12 : 4), `light damage was ${damage}`);
        assert.equal(gremlin.mcansee, 0);
    });
}
