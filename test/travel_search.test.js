import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { continueRun, rhack } from '../js/cmd.js';
import { D_CLOSED, DOOR, IRONBARS, LAVAPOOL, POOL, ROOM, STONE, VIBRATING_SQUARE } from '../js/const.js';
import { terrain_glyph } from '../js/display.js';
import { CmapSymbol, cmapToGlyph, GlyphOffset } from '../js/glyph_numbers.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER, ROCK, WATER_WALKING_BOOTS } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { syncBlindness } from '../js/senses.js';
import { couldsee, vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
const flightProperties = ['levitation', 'flying'];
for (const flight of flightProperties) {
    for (const liquid of [POOL, LAVAPOOL]) {
        void test(`travel with ${flight} takes the direct route over ${liquid === POOL ? 'water' : 'lava'}`, async () => {
            const level = freshObjectRoom();
            level.requireAt(12, 10).typ = liquid;
            grantIntrinsicProperty(flight, 'outside');
            game._travelTarget = { x: 14, y: 10 };
            await rhack(31);
            assert.equal(await continueRun(), true);
            assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
            assert.equal(game.context.move, 1);
            assert.equal(game._pending_message, '');
        });
    }
}
void test('travel takes the direct water route with identified water-walking boots', async () => {
    const level = freshObjectRoom();
    level.requireAt(12, 10).typ = POOL;
    wearHeroArmor(await addInventoryObject(WATER_WALKING_BOOTS));
    game._travelTarget = { x: 14, y: 10 };
    await rhack(31);
    assert.equal(await continueRun(), true);
    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, '');
});
void test('travel crosses a known vibrating square on the direct route', async () => {
    const level = freshObjectRoom();
    addTrap(level, VIBRATING_SQUARE, 12, 10, { tseen: true });
    game._travelTarget = { x: 14, y: 10 };
    await rhack(31);
    assert.equal(await continueRun(), true);
    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, '');
});
void test('travel can select a known vibrating square as its destination', async () => {
    const level = freshObjectRoom();
    game.dungeons[0] = createDungeon({ dname: 'Gehennom', num_dunlevs: 9, flags: { hellish: true } });
    addTrap(level, VIBRATING_SQUARE, 12, 10, { tseen: true });
    game._travelTarget = { x: 12, y: 10 };
    await rhack(31);
    assert.equal(await continueRun(), true);
    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, false);
    assert.equal(game._travelTarget, null);
    assert.equal(game._pending_message, 'You feel a strange vibration under your feet.');
});
void test('travel stops repeating after returning to a visited square and retravel starts a new route', async () => {
    const level = freshObjectRoom({ left: 9, right: 14, top: 10, bottom: 10 });
    for (let x = 9; x <= 14; x++) {
        const square = level.requireAt(x, 8);
        square.typ = ROOM;
        square.seenv = 255;
        square.lit = true;
    }
    level.requireAt(9, 9).typ = ROOM;
    level.requireAt(14, 9).typ = ROOM;
    vision_recalc(0);
    game._travelTarget = { x: 14, y: 10 };
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    level.requireAt(12, 10).typ = STONE;
    vision_recalc(0);
    assert.equal(await continueRun(), true);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, 'You stop, unsure which way to go.');
    assert.equal(game.context.move, 1, 'the last step still spends a turn');
    assert.equal(game.context.travel, false);
    assert.equal(game.context.travel1, false);
    assert.equal(game.context.mv, false);
    assert.equal(game.multi, 0);
    assert.deepEqual(game._travelTarget, { x: 14, y: 10 });
    game._pending_message = '';
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [9, 9]);
    assert.equal(game.context.travel, true);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, '');
});
void test('travel in grid-bug form follows cardinal steps', async () => {
    freshObjectRoom({ hero: { mtimedone: 100, umonnum: MONSTER_NAME.indexOf('grid bug'), mh: 20, mhmax: 20 } });
    game._travelTarget = { x: 13, y: 13 };
    await rhack(31);
    assert.equal(Math.abs(game.u.ux - 10) + Math.abs(game.u.uy - 10), 1);
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, true);
});
void test('travel in grid-bug form takes two steps to a diagonally adjacent destination', async () => {
    freshObjectRoom({ hero: { mtimedone: 100, umonnum: MONSTER_NAME.indexOf('grid bug'), mh: 20, mhmax: 20 } });
    game._travelTarget = { x: 11, y: 11 };
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 11]);
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, true);
    assert.equal(await continueRun(), true);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 11]);
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, false);
});
void test('travel admits closed doors on the route and stops at the door', async () => {
    const level = freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    level.requireAt(12, 10).typ = DOOR;
    level.requireAt(12, 10).doormask = D_CLOSED;
    vision_recalc(0);
    game._travelTarget = { x: 14, y: 10 };
    await rhack(31);
    assert.equal(game.u.ux, 11);
    assert.equal(await continueRun(), false);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 0);
    assert.equal(game.context.travel, false);
    assert.equal(game._pending_message, 'That door is closed.');
});
for (const rememberedGlyph of [false, true]) {
    void test(`blind travel avoids unseen terrain with remembered glyph ${rememberedGlyph}`, async () => {
        const level = freshObjectRoom({ hero: { blindTurns: 10 } });
        syncBlindness();
        vision_recalc(0);
        level.requireAt(12, 10).seenv = 0;
        level.requireAt(12, 10).remembered_glyph = rememberedGlyph
            ? terrain_glyph(level.requireAt(12, 10), 12, 10) : null;
        game._travelTarget = { x: 14, y: 10 };
        await rhack(31);
        assert.equal(await continueRun(), true);
        assert.deepEqual([game.u.ux, game.u.uy], [12, 9]);
        assert.equal(game.context.move, 1);
    });
}
void test('travel routes a large hero around a diagonal gap it cannot squeeze through', async () => {
    const level = freshObjectRoom({ hero: {
            mtimedone: 100, umonnum: MONSTER_NAME.indexOf('hill giant'), mh: 40, mhmax: 40,
        } });
    level.requireAt(11, 10).typ = STONE;
    level.requireAt(10, 11).typ = STONE;
    vision_recalc(0);
    game._travelTarget = { x: 13, y: 13 };
    await rhack(31);
    assert.notDeepEqual([game.u.ux, game.u.uy], [10, 10], 'a route around the rocks exists');
    assert.notDeepEqual([game.u.ux, game.u.uy], [11, 11], 'the narrow diagonal is not a travel edge');
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, true);
});
void test('a guessed travel goal uses the boulder delay when choosing between visible routes', async () => {
    const level = freshObjectRoom({ left: 10, right: 14, top: 8, bottom: 10 });
    for (let x = 11; x <= 13; x++)
        level.requireAt(x, 9).typ = IRONBARS;
    await addInventoryObject(ROCK);
    await floorObject(BOULDER, 13, 10);
    vision_recalc(0);
    assert.equal(couldsee(14, 8), true);
    assert.equal(couldsee(14, 9), true);
    game._travelTarget = { x: 20, y: 9 };
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 9]);
    assert.equal(game.context.move, 1);
    assert.equal(game.context.travel, true);
});
for (const stone of [false, true]) {
    void test(`the travel cursor ${stone ? 'rejects unseen stone' : 'can reach an unexplored visible floor'}`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        const square = level.requireAt(12, 10);
        square.seenv = 0;
        square.disp_glyph = stone
            ? { kind: 'terrain', glyph: cmapToGlyph(CmapSymbol.stone), terrainName: 'stone' }
            : { kind: 'unexplored', glyph: GlyphOffset.unexplored };
        const input = resetInputState();
        input.feed('ll');
        const action = rhack('_'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            assert.equal(game._pending_message.includes('(no travel path)'), stone);
            assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
            assert.equal(game.context.move, 0);
        }
        finally {
            input.feed('\x1b');
            await action;
        }
    });
}
//# sourceMappingURL=travel_search.test.js.map