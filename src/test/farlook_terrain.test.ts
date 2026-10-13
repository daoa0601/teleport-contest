import test from 'node:test';
import assert from 'node:assert/strict';
import { farlookLocationDescription } from '../js/cmd.js';
import { ICE, LA_DOWN, LAVAPOOL, LAVAWALL, MOAT, POOL, ROOM, STAIRS, WATER } from '../js/const.js';
import { game } from '../js/gstate.js';
import { newsym } from '../js/display.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer } from '../js/object_timers.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';

for (const remembered of [false, true]) {
    void test(`farlook describes ${remembered ? 'remembered' : 'visible'} lava`, async () => {
        const level = freshObjectRoom();
        const location = level.requireAt(11, 10);
        location.typ = LAVAPOOL;
        newsym(11, 10);
        if (remembered) {
            await makeBlinded(10, { talk: false });
            vision_recalc(0);
        }

        const description = farlookLocationDescription(11, 10);

        assert.equal(description, 'molten lava');
    });
}

void test('a remembered liquid glyph uses the current surface description', async () => {
    const level = freshObjectRoom();
    const location = level.requireAt(11, 10);
    location.typ = LAVAPOOL;
    newsym(11, 10);
    await makeBlinded(10, { talk: false });
    vision_recalc(0);
    location.typ = ROOM;

    assert.equal(farlookLocationDescription(11, 10), 'water');
});

for (const remembered of [false, true]) {
    void test(`farlook describes ${remembered ? 'remembered' : 'visible'} blocked Quest stairs and opens them after the leader dies`, async () => {
        const level = freshObjectRoom();
        game.dungeons = [{
            dname: 'The Quest', num_dunlevs: 5, entry_lev: 1, dunlev_ureached: 1,
            depth_start: 1, flags: { maze_like: false, hellish: false, alignment: null },
            bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
        }];
        game._activeSpecialLevel = {
            prototype: 'Val-strt', file: 'Val-strt.lua', defaultLit: true,
            align: ['law', 'neutral', 'chaos'],
        };
        const location = level.requireAt(11, 10);
        location.typ = STAIRS;
        location.ladder = LA_DOWN;
        level.dnstair = { x: 11, y: 10 };
        newsym(11, 10);
        if (remembered) {
            await makeBlinded(10, { talk: false });
            vision_recalc(0);
        }

        assert.equal(farlookLocationDescription(11, 10), 'blocked staircase down');
        assert.ok(game.quest_status);
        game.quest_status.killed_leader = true;
        assert.equal(farlookLocationDescription(11, 10), 'staircase down');
    });
}

for (const [terrain, description] of [
    [POOL, 'pool of water'], [MOAT, 'moat'], [WATER, 'wall of water'],
    [LAVAWALL, 'wall of lava'], [ICE, 'solid ice'],
] as const) {
    void test(`farlook describes ${description}`, () => {
        const level = freshObjectRoom();
        level.requireAt(11, 10).typ = terrain;
        newsym(11, 10);

        assert.equal(farlookLocationDescription(11, 10), description);
    });
}

void test('farlook describes nearby melting ice by its remaining strength', () => {
    const level = freshObjectRoom({ moves: 0 });
    level.requireAt(11, 10).typ = ICE;
    newsym(11, 10);
    scheduleLevelTimer(11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 1001);
    for (const [elapsed, description] of [
        [0, 'sturdy ice'], [1, 'steady ice'], [900, 'steady ice'],
        [901, 'unsteady ice'], [950, 'unsteady ice'], [951, 'thin ice'],
        [986, 'thin ice'], [987, 'slushy ice'],
    ] as const) {
        game.moves = elapsed;
        assert.equal(farlookLocationDescription(11, 10), description);
    }
});

void test('farlook leaves distant or unseen remembered ice strength unknown', async () => {
    const level = freshObjectRoom();
    for (const x of [11, 13]) {
        level.requireAt(x, 10).typ = ICE;
        newsym(x, 10);
        scheduleLevelTimer(x, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 20);
    }

    assert.equal(farlookLocationDescription(13, 10), 'ice');
    game.u.xray_range = 3;
    assert.equal(farlookLocationDescription(13, 10), 'thin ice');
    await makeBlinded(10, { talk: false });
    vision_recalc(0);
    assert.equal(farlookLocationDescription(11, 10), 'ice');
});

void test('farlook describes Medusa moat as a shallow sea', () => {
    const level = freshObjectRoom();
    game.medusa_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
    level.requireAt(11, 10).typ = MOAT;
    newsym(11, 10);

    assert.equal(farlookLocationDescription(11, 10), 'shallow sea');
});

void test('farlook hallucinates the liquid in visible lava', () => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 30 } });
    level.requireAt(11, 10).typ = LAVAPOOL;
    newsym(11, 10);

    const descriptions = new Set(Array.from({ length: 20 }, () =>
        farlookLocationDescription(11, 10)));

    assert.ok(descriptions.size > 1, 'hallucination changes the perceived liquid');
    for (const description of descriptions) assert.match(description, /^molten /);
});
