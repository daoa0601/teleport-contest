import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    mapDetectedMonster, reconstrainMap, unconstrainMap,
} from '../js/magic_map_display.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C pager.c:look_at_monster() keeps ", swallowing you" for an engulfer
// while monster detection browses with u.uswallow cleared and
// iflags.save_uswallow set, so the hero still learns what holds him.
void test('a detected engulfer still says it is swallowing you', async () => {
    freshObjectRoom();
    const engulfer = await createMonsterAt('purple worm', 11, 10, MM_NOGRP | NO_MINVENT);
    engulfer.mx = game.u.ux;
    engulfer.my = game.u.uy;
    game.u.ustuck = engulfer;
    game.u.uswallow = 1;
    const constraints = unconstrainMap();
    try {
        mapDetectedMonster(engulfer, false);

        const description = await farlookLocationDescription(game.u.ux, game.u.uy);

        assert.match(description, /purple worm, swallowing you$/);
    } finally {
        reconstrainMap(constraints);
    }
});
