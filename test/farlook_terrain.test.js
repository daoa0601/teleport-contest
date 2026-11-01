import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { farlookLocationDescription } from '../js/pager.js';
import { HWALL, ICE, LA_DOWN, LA_UP, LAVAPOOL, LAVAWALL, MOAT, POOL, ROOM, STAIRS, WATER, LEVEL_TIMER_KIND } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { flush_screen, newsym, redrawMap } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { scheduleLevelTimer } from '../js/timeout.js';
import { makeBlinded } from '../js/sight_change.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
for (const [terrain, name] of [[HWALL, 'wall'], [ROOM, 'room']]) {
    void test(`farlook describes an unseen ${name} as unexplored`, async () => {
        const level = await freshObjectRoom();
        level.requireAt(30, 10).typ = terrain;
        assert.equal(cansee(30, 10), false);
        assert.equal(level.requireAt(30, 10).seenv, 0);
        await redrawMap();
        assert.equal(await farlookLocationDescription(30, 10), 'unexplored area');
    });
}
for (const [x, y, description] of [[11, 10, 'land'], [11, 11, 'land'], [12, 10, 'unknown']]) {
    void test(`submerged farlook calls hidden terrain at ${x},${y} ${description}`, async () => {
        await freshObjectRoom({ hero: { uinwater: true } });
        await redrawMap();
        assert.equal(await farlookLocationDescription(x, y), description);
    });
}
void test('quick look describes an undiscovered wall through its unexplored glyph', async () => {
    const level = await freshObjectRoom({ flags: { tips: false } });
    level.requireAt(30, 10).typ = HWALL;
    await redrawMap();
    const input = resetInputState();
    input.feed('l'.repeat(20) + '.');
    await rhack(';'.charCodeAt(0));
    await flush_screen(1);
    const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
    assert.ok(description?.endsWith('can be many things (unexplored area)'), description);
    assert.equal(level.requireAt(30, 10).seenv, 0);
});
for (const remembered of [false, true]) {
    void test(`farlook preserves the ${remembered ? 'remembered' : 'visible'} branch-staircase description`, async () => {
        const level = await freshObjectRoom();
        const location = level.requireAt(11, 10);
        location.typ = STAIRS;
        location.ladder = LA_UP;
        game.stairs = { sx: 11, sy: 10, up: true, isladder: false,
            tolev: { dnum: 1, dlevel: 1 }, u_traversed: true, next: null };
        await newsym(11, 10);
        if (remembered) {
            level.requireAt(30, 10).typ = ROOM;
            game.u.ux = 30;
            await vision_recalc(0);
            await newsym(11, 10);
        }
        assert.equal(await farlookLocationDescription(11, 10), 'branch staircase up');
    });
}
for (const remembered of [false, true]) {
    void test(`farlook describes ${remembered ? 'remembered' : 'visible'} lava`, async () => {
        const level = await freshObjectRoom();
        const location = level.requireAt(11, 10);
        location.typ = LAVAPOOL;
        await newsym(11, 10);
        if (remembered) {
            await makeBlinded(10, { talk: false });
            await vision_recalc(0);
        }
        const description = await farlookLocationDescription(11, 10);
        assert.equal(description, 'molten lava');
    });
}
void test('a remembered liquid glyph uses the current surface description', async () => {
    const level = await freshObjectRoom();
    const location = level.requireAt(11, 10);
    location.typ = LAVAPOOL;
    await newsym(11, 10);
    await makeBlinded(10, { talk: false });
    await vision_recalc(0);
    location.typ = ROOM;
    assert.equal(await farlookLocationDescription(11, 10), 'water');
});
for (const remembered of [false, true]) {
    void test(`farlook describes ${remembered ? 'remembered' : 'visible'} blocked Quest stairs and opens them after the leader dies`, async () => {
        const level = await freshObjectRoom();
        game.dungeons = [{
                dname: 'The Quest', num_dunlevs: 5, entry_lev: 1, dunlev_ureached: 1,
                depth_start: 1, flags: { maze_like: false, hellish: false, alignment: null },
                bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
            }];
        game._activeSpecialLevel = {
            prototype: 'Val-strt', file: 'Val-strt.lua', defaultLit: true,
            align: ['law', 'neutral', 'chaos'],
        };
        game.specialLevels = new Map([['x-strt', createSpecialLevel({ dnum: game.u.uz?.dnum ?? 0, dlevel: game.u.uz?.dlevel ?? 1 })]]);
        const location = level.requireAt(11, 10);
        location.typ = STAIRS;
        location.ladder = LA_DOWN;
        level.dnstair = { x: 11, y: 10 };
        await newsym(11, 10);
        if (remembered) {
            await makeBlinded(10, { talk: false });
            await vision_recalc(0);
        }
        assert.equal(await farlookLocationDescription(11, 10), 'blocked staircase down');
        assert.ok(game.quest_status);
        game.quest_status.killed_leader = true;
        assert.equal(await farlookLocationDescription(11, 10), 'staircase down');
    });
}
for (const [terrain, description] of [
    [POOL, 'pool of water'], [MOAT, 'moat'], [WATER, 'wall of water'],
    [LAVAWALL, 'wall of lava'], [ICE, 'solid ice'],
]) {
    void test(`farlook describes ${description}`, async () => {
        const level = await freshObjectRoom();
        level.requireAt(11, 10).typ = terrain;
        await newsym(11, 10);
        assert.equal(await farlookLocationDescription(11, 10), description);
    });
}
void test('farlook describes nearby melting ice by its remaining strength', async () => {
    const level = await freshObjectRoom({ moves: 0 });
    level.requireAt(11, 10).typ = ICE;
    await newsym(11, 10);
    scheduleLevelTimer(11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 1001);
    for (const [elapsed, description] of [
        [0, 'sturdy ice'], [1, 'steady ice'], [900, 'steady ice'],
        [901, 'unsteady ice'], [950, 'unsteady ice'], [951, 'thin ice'],
        [986, 'thin ice'], [987, 'slushy ice'],
    ]) {
        game.moves = elapsed;
        assert.equal(await farlookLocationDescription(11, 10), description);
    }
});
void test('farlook leaves distant or unseen remembered ice strength unknown', async () => {
    const level = await freshObjectRoom();
    for (const x of [11, 13]) {
        level.requireAt(x, 10).typ = ICE;
        await newsym(x, 10);
        scheduleLevelTimer(x, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 20);
    }
    assert.equal(await farlookLocationDescription(13, 10), 'ice');
    game.u.xray_range = 3;
    assert.equal(await farlookLocationDescription(13, 10), 'thin ice');
    await makeBlinded(10, { talk: false });
    await vision_recalc(0);
    assert.equal(await farlookLocationDescription(11, 10), 'ice');
});
void test('farlook describes Medusa moat as a shallow sea', async () => {
    const level = await freshObjectRoom();
    game.medusa_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
    level.requireAt(11, 10).typ = MOAT;
    await newsym(11, 10);
    assert.equal(await farlookLocationDescription(11, 10), 'shallow sea');
});
void test('farlook hallucinates the liquid in visible lava', async () => {
    const level = await freshObjectRoom({ hero: { hallucinationTurns: 30 } });
    level.requireAt(11, 10).typ = LAVAPOOL;
    await newsym(11, 10);
    const descriptions = new Set();
    for (let i = 0; i < 20; i++)
        descriptions.add(await farlookLocationDescription(11, 10));
    assert.ok(descriptions.size > 1, 'hallucination changes the perceived liquid');
    for (const description of descriptions)
        assert.match(description, /^molten /);
});
//# sourceMappingURL=farlook_terrain.test.js.map