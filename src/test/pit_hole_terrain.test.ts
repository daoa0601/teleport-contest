import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CORR, DB_EAST, DB_FLOOR, DB_ICE, DB_UNDER, DOOR, DRAWBRIDGE_UP,
    D_LOCKED, FOUNTAIN, HOLE, HWALL, ICE, PIT, ROOM, SCORR, SDOOR,
    SHOP_HOLE_COST, SPIKED_PIT, STONE, TRAPDOOR, W_NONDIGGABLE,
} from '../js/const.js';
import { addBuriedObject } from '../js/buried_object.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { updateIceObjectTimersAt } from '../js/floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { countLevelFeatures, maketrap } from '../js/mklev.js';
import { DAGGER } from '../js/object_data.js';
import {
    LEVEL_TIMER_KIND, OBJECT_TIMER_KIND, levelTimers, objectTimers,
    scheduleLevelTimer, scheduleObjectTimer,
} from '../js/object_timers.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { corpseObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

for (const [name, levelFlag, expected] of [
    ['ordinary level', null, DOOR],
    ['maze', 'is_maze_lev', ROOM],
    ['cavern', 'is_cavernous_lev', CORR],
] as const) {
    for (const wall of [HWALL, SDOOR]) {
        void test(`${name} pit opens ${wall === HWALL ? 'a wall' : 'a secret door'}`, async () => {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            if (levelFlag !== null) level.flags[levelFlag] = true;
            const location = level.requireAt(12, 10);
            location.typ = wall;
            location.flags = W_NONDIGGABLE;
            location.wall_info = W_NONDIGGABLE;
            location.doormask = D_LOCKED;

            const trap = await maketrap(12, 10, PIT);

            assert.ok(trap != null);
            assert.equal(trap.ttyp, PIT);
            assert.equal(location.typ, expected);
            assert.equal(location.flags, 0);
            assert.equal(location.wall_info, 0);
            assert.equal(location.doormask, 0);
        });
    }
}

for (const terrain of [STONE, SCORR]) {
    void test(`a trapdoor opens ${terrain === STONE ? 'stone' : 'a secret corridor'} into a corridor`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.requireAt(12, 10).typ = terrain;

        const trap = await maketrap(12, 10, TRAPDOOR);

        assert.ok(trap != null);
        assert.equal(trap.ttyp, TRAPDOOR);
        assert.equal(level.requireAt(12, 10).typ, CORR);
    });
}

void test('a plain pit removes furniture that a spiked pit cannot overwrite', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = FOUNTAIN;
    countLevelFeatures();

    const trap = await maketrap(12, 10, SPIKED_PIT);

    assert.equal(trap, null); // Only plain pits and holes may overwrite furniture.
    assert.equal(level.flags.nfountains, 1);
    await maketrap(12, 10, PIT);
    assert.equal(level.requireAt(12, 10).typ, ROOM);
    assert.equal(level.flags.nfountains, 0);
});

void test('a spiked pit opens stone into a corridor', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = STONE;

    const trap = await maketrap(12, 10, SPIKED_PIT);

    assert.ok(trap != null);
    assert.equal(trap.ttyp, SPIKED_PIT);
    assert.equal(level.requireAt(12, 10).typ, CORR);
});

void test('opening a wall exposes the floor behind it after vision updates', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    for (let y = 6; y <= 14; y++) level.requireAt(11, y).typ = HWALL;
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(12, 10), false);

    await maketrap(11, 10, HOLE);
    vision_recalc(0);

    assert.equal(cansee(12, 10), true);
});

void test('creating a pit unearths buried goods and removes their rot timer and engraving', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dagger = await knownObject(DAGGER);
    addBuriedObject(dagger, 12, 10);
    scheduleObjectTimer(dagger, OBJECT_TIMER_KIND.ROT_ORGANIC, game.moves + 50);
    makeEngravingAt(12, 10, 'buried marker');

    await maketrap(12, 10, PIT);

    assert.equal(dagger.where, 'floor');
    assert.ok(floorObjectsAt(requireGameLevel(), 12, 10).includes(dagger));
    assert.equal(requireGameLevel().buriedObjects?.includes(dagger), false);
    assert.equal(objectTimers(dagger).length, 0);
    assert.equal(engravingAt(12, 10), null);
});

for (const monMoving of [false, true]) {
    void test(`a ${monMoving ? 'monster' : 'hero'} pit records shop wall repair before changing terrain`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        await createStaffedShop();
        level.requireAt(12, 10).typ = HWALL;
        game.context.mon_moving = monMoving;

        await maketrap(12, 10, PIT);

        const damage = level.damagelist?.find(record => record.place.x === 12 && record.place.y === 10);
        assert.ok(damage != null);
        assert.equal(damage.typ, HWALL);
        assert.equal(damage.cost, monMoving ? 0 : SHOP_HOLE_COST);
        assert.equal(level.requireAt(12, 10).typ, DOOR);
    });
}

void test('a hole in ordinary shop floor schedules repair without a wall charge', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    await createStaffedShop();

    await maketrap(12, 10, HOLE);

    const damage = level.damagelist?.find(record => record.place.x === 12 && record.place.y === 10);
    assert.ok(damage != null);
    assert.equal(damage.typ, ROOM);
    assert.equal(damage.cost, 0);
});

for (const terrain of [ICE, DRAWBRIDGE_UP]) {
    void test(`a hole thaws corpses beneath ${terrain === ICE ? 'ice' : 'a raised drawbridge'} and stops melting`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const location = level.requireAt(12, 10);
        location.typ = terrain;
        location.drawbridgemask = DB_EAST | DB_ICE;
        const corpse = await corpseObject(0);
        addBuriedObject(corpse, 12, 10);
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves + 100);
        updateIceObjectTimersAt(12, 10, game, { includeBuried: true });
        const frozenTimer = objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE);
        assert.ok(frozenTimer);
        const frozenDeadline = frozenTimer.deadline;
        scheduleLevelTimer(12, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 10);

        const trap = await maketrap(12, 10, HOLE);

        assert.ok(trap != null);
        assert.equal(trap.ttyp, HOLE);
        assert.equal(corpse.where, 'floor');
        assert.equal(corpse.on_ice, false);
        const thawedTimer = objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE);
        assert.ok(thawedTimer);
        assert.ok(thawedTimer.deadline < frozenDeadline);
        assert.equal(levelTimers().length, 0);
        if (terrain === DRAWBRIDGE_UP) {
            assert.equal(location.typ, DRAWBRIDGE_UP);
            assert.ok(location.drawbridgemask != null);
            assert.equal(location.drawbridgemask & DB_UNDER, DB_FLOOR);
            assert.ok(location.drawbridgemask != null);
            assert.equal(location.drawbridgemask & ~DB_UNDER, DB_EAST);
        } else assert.equal(location.typ, ROOM);
    });
}
