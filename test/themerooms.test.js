import test from 'node:test';
import assert from 'node:assert/strict';

import { ICE, THEMEROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import {
    levelTimers, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { levelStairs } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildRegularLevel(seed) {
    freshSpecialLevel({
        prototype: 'unused',
        seed,
        depth: 12,
    });
    game._activeSpecialLevel = null;
    game._specialLevelPrototype = null;
    game.dungeons[0] = {
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
        flags: {},
        themeRooms: 'themerms.lua',
    };
    await mklev();
}

test('an irregular themed room joins an ordinary dungeon level', async () => {
    await buildRegularLevel(7);

    const themedRoom = game.level.rooms
        .slice(0, game.level.nroom)
        .find(room => room.rtype === THEMEROOM);

    assert.ok(themedRoom);
    assert.equal(themedRoom.irregular, true);
    assert.equal(levelStairs(game).length, 2);
});

test('a cloud room creates fog clouds inside its gas region', async () => {
    await buildRegularLevel(69);

    const gasRegion = game.level.regions
        .find(region => region.kind === 'gas-cloud');
    const fogClouds = game.level.monsters.filter(
        monster => MONSTER_NAME[monster.mnum] === 'fog cloud',
    );

    assert.ok(gasRegion);
    assert.ok(gasRegion.cells.length > 0);
    assert.ok(fogClouds.length > 0);
    assert.ok(fogClouds.every(monster =>
        gasRegion.cells.some(cell =>
            cell.x === monster.mx && cell.y === monster.my)));
});

test('an ice room schedules melting on its ice squares', async () => {
    await buildRegularLevel(315);

    const timers = levelTimers(game);

    assert.ok(timers.length > 0);
    assert.ok(timers.every(timer =>
        game.level.at(timer.x, timer.y)?.typ === ICE));
});

test('buried zombies wait below ground to rise', async () => {
    await buildRegularLevel(154);

    const corpses = game.level.buriedObjects.filter(
        object => object.otyp === CORPSE,
    );

    assert.ok(corpses.length > 0);
    assert.ok(corpses.every(corpse => {
        const timers = objectTimers(corpse);
        return timers.some(timer =>
            timer.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON)
            && timers.every(timer =>
                timer.kind !== OBJECT_TIMER_KIND.ROT_CORPSE);
    }));
});
