import { createSpecialLevel, createDungeon } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { ALTAR, AM_CHAOTIC, AM_SANCTUM, AM_SHRINE, DB_EAST, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DBWALL, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_ISOPEN, ICE, MOAT, STAIRS, } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { dungeonFeatureSentenceAt, stairwayDescription } from '../js/dungeon_feature.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer } from '../js/object_timers.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
async function look() {
    pushKeys(' '.repeat(20));
    await rhack(':'.charCodeAt(0));
    return game._pending_message;
}
void test('explicit look describes the altar deity, alignment, and high altar', async () => {
    freshObjectRoom({ role: 'wizard' });
    requireFixtureGame(game);
    const altar = game.level.requireAt(10, 10);
    altar.typ = ALTAR;
    altar.flags = AM_CHAOTIC | AM_SHRINE;
    assert.equal(await look(), 'There is an altar to Anhur (chaotic) here.');
    altar.flags = AM_SANCTUM | AM_SHRINE;
    assert.equal(await look(), 'There is a high altar to Moloch (unaligned) here.');
});
void test('looking at melting ice describes its weakening surface', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(10, 10).typ = ICE;
    assert.equal(await look(), 'There is solid ice here.');
    scheduleLevelTimer(10, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 60);
    assert.equal(await look(), 'There is unsteady ice here.');
    game.moves += 50;
    assert.equal(await look(), 'There is slushy ice here.');
});
void test('distant or unseen levitating ice inspection cannot assess melting', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    for (const x of [10, 13]) {
        game.level.requireAt(x, 10).typ = ICE;
        scheduleLevelTimer(x, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 20);
    }
    assert.equal(dungeonFeatureSentenceAt(13, 10), 'There is ice here.');
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is thin ice here.');
    setHeroBlindnessTurns(10);
    game.u.levitationTurns = 10;
    vision_recalc(0);
    assert.equal(cansee(10, 10), false);
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is ice here.');
});
void test('drawbridge features distinguish the span, portcullis, and exposed underlay', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const span = game.level.requireAt(10, 10);
    span.typ = DRAWBRIDGE_DOWN;
    span.drawbridgemask = DB_EAST | DB_MOAT;
    const portcullis = game.level.requireAt(11, 10);
    portcullis.typ = DOOR;
    portcullis.doormask = D_ISOPEN;
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is a lowered drawbridge here.');
    assert.equal(dungeonFeatureSentenceAt(11, 10), 'There is an open drawbridge portcullis here.');
    span.typ = DRAWBRIDGE_UP;
    game.level.requireAt(11, 10).typ = DBWALL;
    assert.equal(dungeonFeatureSentenceAt(11, 10), 'There is a raised drawbridge here.');
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is a pool of water here.');
    span.drawbridgemask = DB_EAST | DB_LAVA;
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is molten lava here.');
    span.drawbridgemask = DB_EAST | DB_ICE;
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is solid ice here.');
    span.drawbridgemask = DB_EAST | DB_FLOOR;
    assert.equal(dungeonFeatureSentenceAt(10, 10), '');
});
void test('the Juiblex moat exception applies to raised bridges, not raw moat squares', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.juiblex_level = createSpecialLevel({ ...game.u.uz });
    const location = game.level.requireAt(10, 10);
    location.typ = DRAWBRIDGE_UP;
    location.drawbridgemask = DB_MOAT;
    assert.equal(dungeonFeatureSentenceAt(10, 10), '');
    location.typ = MOAT;
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is a pool of water here.');
});
void test('traversed ordinary stairs show absolute depth while unknown branch stairs hide their destination', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', depth_start: 1 }),
        createDungeon({ dname: 'The Gnomish Mines', depth_start: 5 }),
    ];
    game.u.uz = { dnum: 1, dlevel: 2 };
    game.level.requireAt(10, 10).typ = STAIRS;
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: false,
        tolev: { dnum: 1, dlevel: 3 }, u_traversed: true, next: null,
    };
    assert.equal(await look(), 'There is a staircase down to level 7 here.');
    game.stairs.tolev = { dnum: 0, dlevel: 4 };
    game.stairs.u_traversed = false;
    assert.equal(await look(), 'There is a staircase down here.');
    game.stairs.u_traversed = true;
    assert.equal(await look(), 'There is a branch staircase down to the Dungeons of Doom here.');
});
void test('stair descriptions support plural stairs while ladders stay singular', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', depth_start: 1 }),
        createDungeon({ dname: 'The Gnomish Mines', depth_start: 5 }),
    ];
    game.u.uz = { dnum: 1, dlevel: 2 };
    const stairs = {
        sx: 10, sy: 10, up: false, isladder: false,
        tolev: { dnum: 1, dlevel: 3 }, u_traversed: false, next: null,
    };
    assert.equal(stairwayDescription(stairs, game, false), 'stairs down');
    stairs.u_traversed = true;
    assert.equal(stairwayDescription(stairs, game, false), 'stairs down to level 7');
    stairs.tolev = { dnum: 0, dlevel: 4 };
    assert.equal(stairwayDescription(stairs, game, false), 'branch stairs down to the Dungeons of Doom');
    stairs.isladder = true;
    assert.equal(stairwayDescription(stairs, game, false), 'branch ladder down to the Dungeons of Doom');
});
void test('the traversed dungeon entrance describes departure or the Amulet destination', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.level.requireAt(10, 10).typ = STAIRS;
    game.earth_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.stairs = {
        sx: 10, sy: 10, up: true, isladder: false,
        tolev: { ...game.earth_level }, u_traversed: true, next: null,
    };
    assert.equal(await look(), 'There is a staircase up out of the dungeon here.');
    game.u.uhave.amulet = true;
    assert.equal(await look(), 'There is a branch staircase up to the Elemental Planes here.');
    game.stairs.tolev.dlevel = 5;
    assert.equal(await look(), 'There is a branch staircase up to the end game here.');
});
void test('traversed Quest and Knox stairs use local levels and ladders keep their noun', () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.dungeons = [createDungeon({ dname: 'The Quest', depth_start: 9 })];
    game.quest_dnum = 0;
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: true,
        tolev: { dnum: 0, dlevel: 3 }, u_traversed: true, next: null,
    };
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is a ladder down to level 3 here.');
    game.quest_dnum = 1;
    game.knox_level = createSpecialLevel({ ...game.stairs.tolev });
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is a ladder down to level 3 here.');
    delete game.knox_level;
    assert.equal(dungeonFeatureSentenceAt(10, 10), 'There is a ladder down to level 11 here.');
});
void test('an underwater look suppresses the surrounding water feature', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(10, 10).typ = MOAT;
    game.u.uinwater = true;
    assert.equal(await look(), 'You see no objects here.');
});
void test('hallucinating over solid ice changes the liquid name without hiding its strength', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(10, 10).typ = ICE;
    game.u.hallucinationTurns = 10;
    assert.match(await look(), /^There is a solid frozen .+ here\.$/);
});
//# sourceMappingURL=floor_features.test.js.map