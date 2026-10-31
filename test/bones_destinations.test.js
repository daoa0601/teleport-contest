import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { HOLE, LA_DOWN, LA_UP, STAIRS } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { maketrap, mklev, mkstairs, } from '../js/mklev.js';
import { saveBonesLevel } from '../js/bones.js';
import { init_objects } from '../js/o_init.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';
import { createRoomLevel, freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
function specialRoom(storage, dlevel) {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel }, uhp: 100, uhpmax: 100 } });
    game.plname = 'Traveler';
    game.storage = storage;
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 12, bonetag: 'D' }),
        createDungeon({ dname: 'The Gnomish Mines', num_dunlevs: 10, bonetag: 'M' }),
    ];
    game.specialLevels = new Map([['town', createSpecialLevel({ dnum: 0, dlevel, bonetag: 'T' })]]);
    init_objects();
}
function cacheDestinations(depths, returnDepth) {
    game._levelCache = new Map();
    for (const dlevel of depths) {
        const level = createRoomLevel();
        const up = dlevel > returnDepth;
        const square = level.requireAt(11, 10);
        square.typ = STAIRS;
        square.ladder = up ? LA_UP : LA_DOWN;
        if (up)
            level.upstair = { x: 11, y: 10 };
        else
            level.dnstair = { x: 11, y: 10 };
        game._levelCache.set(`0:${dlevel}`, {
            level, savedAt: game.moves, heroTrack: [], activeSpecialLevel: null,
            stairs: { sx: 11, sy: 10, up, isladder: false, u_traversed: false,
                tolev: { dnum: 0, dlevel: returnDepth }, next: null },
        });
    }
}
async function restoreSpecialBones(storage) {
    specialRoom(storage, 7);
    resetInputState().feed('yn');
    await mklev();
    assert.equal(game._restoredBones, true, 'the moved special level must load its bones');
    cacheDestinations([5, 6, 8, 9], 7);
    game.flags.verbose = false;
    installPagerInput(resetInputState(), { expected: /stairs|hole|fall|shaft/, limit: 4 });
}
for (const stair of [
    { command: '<', x: 10, destination: 6 },
    { command: '>', x: 12, destination: 8 },
]) {
    void test(`relocated special-level bones use ${stair.command} to reach level ${stair.destination}`, async () => {
        const storage = memoryStorage();
        specialRoom(storage, 6);
        await mkstairs(10, 10, true, null);
        await mkstairs(12, 10, false, null);
        const liveDestinations = () => {
            const depths = [];
            for (let live = game.stairs; live; live = live.next)
                depths.push(live.tolev.dlevel);
            return depths;
        };
        const absoluteDestinations = liveDestinations();
        assert.equal(saveBonesLevel(), true);
        assert.deepEqual(liveDestinations(), absoluteDestinations, 'saving must leave live stairs absolute');
        await restoreSpecialBones(storage);
        game.u.ux = stair.x;
        game.u.uy = 10;
        await rhack(stair.command.charCodeAt(0));
        assert.equal(game.u.uz?.dlevel, stair.destination);
        assert.equal(game.u.ux, 11, 'arrival uses the destination level return stairs');
    });
}
void test('relocated bones shift a fixed hole destination and keep other-dungeon destinations absolute', async () => {
    const storage = memoryStorage();
    specialRoom(storage, 6);
    const hole = await maketrap(14, 10, HOLE);
    const otherDungeon = await maketrap(16, 10, HOLE);
    assert.ok(hole && otherDungeon);
    hole.dst = { dnum: 0, dlevel: 8 };
    otherDungeon.dst = { dnum: 1, dlevel: 4 };
    assert.equal(saveBonesLevel(), true);
    assert.equal(hole.dst.dlevel, 8, 'saving must leave live destinations absolute');
    await restoreSpecialBones(storage);
    const restoredOther = requireGameLevel().traps.find(trap => trap.tx === 16 && trap.ty === 10);
    assert.deepEqual(restoredOther?.dst, { dnum: 1, dlevel: 4 });
    game.u.ux = 14;
    game.u.uy = 10;
    await rhack('>'.charCodeAt(0));
    await finishScheduledLevelChange();
    assert.equal(game.u.uz?.dlevel, 9);
});
void test('whole-game saving and cached level travel retain absolute stair and hole destinations', async () => {
    const storage = memoryStorage();
    specialRoom(storage, 6);
    await mkstairs(12, 10, false, null);
    const hole = await maketrap(14, 10, HOLE);
    assert.ok(hole);
    hole.dst = { dnum: 0, dlevel: 8 };
    cacheDestinations([7, 8], 6);
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame('Traveler', storage), true);
    game.flags.verbose = false;
    installPagerInput(resetInputState(), { expected: /stairs|hole|fall|shaft/, limit: 4 });
    game.u.ux = 12;
    game.u.uy = 10;
    await rhack('>'.charCodeAt(0));
    assert.equal(game.u.uz?.dlevel, 7);
    await rhack('<'.charCodeAt(0));
    assert.equal(game.u.uz?.dlevel, 6);
    game.u.ux = 14;
    game.u.uy = 10;
    await rhack('>'.charCodeAt(0));
    await finishScheduledLevelChange();
    assert.equal(game.u.uz?.dlevel, 8);
});
//# sourceMappingURL=bones_destinations.test.js.map