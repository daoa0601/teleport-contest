import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AXE, BOULDER, DWARVISH_MATTOCK, PICK_AXE, ROCK, STATUE, } from '../js/object_data.js';
import { D_BROKEN, D_CLOSED, D_NODOOR, DIGTYP_BOULDER, DIGTYP_DOOR, DIGTYP_ROCK, DIGTYP_STATUE, DIGTYP_TREE, DIGTYP_UNDIGGABLE, DOOR, ROOM, SDOOR, TREE, VWALL, W_NONDIGGABLE, W_WEP, } from '../js/const.js';
import { continueHeroDigging, diggingTarget, mayDig, startHeroDigging, } from '../js/hero_digging.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { copyPersistentState } from '../js/state_schema.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
const DIGGING_PROSE = /You start (?:digging|chipping|hitting|chopping)|You hit the .* with all your might/;
async function wieldTool(otyp, overrides = {}) {
    const weapon = await addInventoryObject(otyp, {
        invlet: 'a',
        spe: 0,
        blessed: false,
        cursed: false,
        wielded: true,
        owornmask: W_WEP,
        ...overrides,
    });
    game.uwep = game.u.uwep = weapon;
    return weapon;
}
function setTerrain(x, y, properties) {
    const location = requireGameLevel(game).requireAt(x, y);
    location.wall_info = properties.wall_info ?? 0;
    location.typ = properties.typ;
    if (properties.doormask !== undefined)
        location.doormask = properties.doormask;
}
async function digUntilDone(tool, x, y, { down = false, seed = 5n } = {}) {
    installPagerInput(resetInputState(), { expected: DIGGING_PROSE, limit: 2 });
    initRng(seed);
    const started = await startHeroDigging(tool, x, y, { down, state: game });
    let continuing = true;
    let ticks = 0;
    while (continuing && ticks < 400) {
        continuing = await continueHeroDigging(game);
        ticks += 1;
    }
    return { started, ticks };
}
void test('diggingTarget classifies pick and axe targets like dig_typ()', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    const axe = await wieldTool(AXE);
    setTerrain(11, 10, { typ: VWALL });
    assert.equal(diggingTarget(pick, 11, 10, game), DIGTYP_ROCK);
    assert.equal(diggingTarget(axe, 11, 10, game), DIGTYP_UNDIGGABLE);
    assert.equal(mayDig(11, 10, game), true);
    setTerrain(11, 10, { typ: VWALL, wall_info: W_NONDIGGABLE });
    assert.equal(mayDig(11, 10, game), false);
    setTerrain(11, 10, { typ: DOOR, doormask: D_CLOSED });
    assert.equal(diggingTarget(pick, 11, 10, game), DIGTYP_DOOR);
    assert.equal(diggingTarget(axe, 11, 10, game), DIGTYP_DOOR);
    setTerrain(11, 10, { typ: TREE });
    assert.equal(diggingTarget(axe, 11, 10, game), DIGTYP_TREE);
    assert.equal(diggingTarget(pick, 11, 10, game), DIGTYP_UNDIGGABLE);
    setTerrain(11, 10, { typ: ROOM });
    await floorObject(BOULDER, 11, 10);
    assert.equal(diggingTarget(pick, 11, 10, game), DIGTYP_BOULDER);
    assert.equal(diggingTarget(axe, 11, 10, game), DIGTYP_UNDIGGABLE);
});
void test('diggingTarget finds a reachable statue for a one-handed pick', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    await floorObject(STATUE, 11, 10, { spe: 0, contents: [] });
    assert.equal(diggingTarget(pick, 11, 10, game), DIGTYP_STATUE);
});
void test('a pick-axe opens a wall into a doorway', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    setTerrain(11, 10, { typ: VWALL });
    initRng(5n);
    await startHeroDigging(pick, 11, 10, { state: game });
    assert.equal(game._pending_message, 'You start digging.');
    const continuing = await continueHeroDigging(game);
    assert.equal(continuing, true);
    assert.equal(game._pending_message, 'You start digging.  You hit the rock with all your might.');
    assert.ok(game.context.digging != null);
    assert.equal(game.context.digging.pos.x, 11);
    assert.ok(game.context.digging != null);
    assert.equal(game.context.digging.pos.y, 10);
    let digging = true;
    installPagerInput(resetInputState(), { expected: DIGGING_PROSE, limit: 2 });
    while (digging)
        digging = await continueHeroDigging(game);
    const cell = game.level.requireAt(11, 10);
    assert.equal(cell.typ, DOOR);
    assert.equal(cell.doormask, D_NODOOR);
    assert.equal(game._pending_message, 'You make an opening in the wall.');
    // C cleanup: the digging context no longer points at this level.
    assert.ok(game.context.digging != null);
    assert.equal(game.context.digging.level.dlevel, -1);
});
void test('a maze wall becomes an open room square', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    game.level.flags.is_maze_lev = true;
    setTerrain(11, 10, { typ: VWALL });
    await digUntilDone(pick, 11, 10);
    const cell = game.level.requireAt(11, 10);
    assert.equal(cell.typ, ROOM);
});
void test('a secret door breaks open as a broken door', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    setTerrain(11, 10, { typ: SDOOR });
    await digUntilDone(pick, 11, 10);
    const cell = game.level.requireAt(11, 10);
    assert.equal(cell.typ, DOOR);
    assert.equal(cell.doormask, D_BROKEN);
    assert.match(game._pending_message, /You break through a secret door!$/);
});
void test('a closed door breaks open with the wielded tool named', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const axe = await wieldTool(AXE);
    setTerrain(11, 10, { typ: DOOR, doormask: D_CLOSED });
    await digUntilDone(axe, 11, 10);
    const cell = game.level.requireAt(11, 10);
    assert.equal(cell.doormask, D_BROKEN);
    assert.match(game._pending_message, /You break through the door with your axe\.$/);
});
void test('a pick-axe shatters a statue into a rock pile', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    setTerrain(11, 10, { typ: ROOM });
    const statue = await floorObject(STATUE, 11, 10, { spe: 0, contents: [] });
    initRng(9n);
    await startHeroDigging(pick, 11, 10, { state: game });
    assert.equal(game._pending_message, 'You start chipping the statue.');
    let digging = true;
    installPagerInput(resetInputState(), { expected: DIGGING_PROSE, limit: 2 });
    while (digging)
        digging = await continueHeroDigging(game);
    // fracture_rock converts the statue object itself into a rock stack.
    assert.equal(statue.otyp, ROCK);
    const rocks = floorObjectsAt(requireGameLevel(game), 11, 10)
        .filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    const rubble = rocks[0];
    assert.ok(rubble);
    assert.ok(rubble.quan >= 7 && rubble.quan <= 66);
    assert.match(game._pending_message, /The statue shatters\.$/);
});
void test('a pick-axe breaks a boulder apart', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    setTerrain(11, 10, { typ: ROOM });
    await floorObject(BOULDER, 11, 10);
    await digUntilDone(pick, 11, 10);
    const pile = floorObjectsAt(requireGameLevel(game), 11, 10);
    assert.equal(pile.some(object => object.otyp === BOULDER), false);
    assert.ok(pile.some(object => object.otyp === ROCK));
    assert.match(game._pending_message, /The boulder falls apart\.$/);
});
void test('a mattock classifies as a pick for target checks', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const mattock = await wieldTool(DWARVISH_MATTOCK);
    setTerrain(11, 10, { typ: VWALL });
    assert.equal(diggingTarget(mattock, 11, 10, game), DIGTYP_ROCK);
});
void test('an axe cannot dig a petrified tree', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const axe = await wieldTool(AXE);
    setTerrain(11, 10, { typ: TREE, wall_info: W_NONDIGGABLE });
    await startHeroDigging(axe, 11, 10, { state: game });
    const continuing = await continueHeroDigging(game);
    assert.equal(continuing, false);
    assert.match(game._pending_message, /This tree seems to be petrified\.$/);
    assert.equal(game.level.requireAt(11, 10).typ, TREE);
});
void test('a clumsy hero drops the pick-axe instead of digging', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    setTerrain(11, 10, { typ: VWALL });
    game.u.fumbling = true;
    initRng(3n);
    await startHeroDigging(pick, 11, 10, { state: game });
    const continuing = await continueHeroDigging(game);
    assert.equal(continuing, false);
    assert.match(game._pending_message, /You fumble and drop your pick-axe\.$/);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);
    assert.equal((game.inventory || []).includes(pick), false);
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).includes(pick));
});
void test('digging progress persists through the save schema', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const pick = await wieldTool(PICK_AXE);
    setTerrain(11, 10, { typ: VWALL });
    await startHeroDigging(pick, 11, 10, { state: game });
    await continueHeroDigging(game);
    const snapshot = copyPersistentState(game);
    const digging = snapshot.context.digging;
    assert.ok(digging != null);
    assert.ok(digging.effort > 0);
    assert.equal(digging.pos.x, 11);
    assert.equal(digging.pos.y, 10);
    assert.equal(digging.down, false);
    // C restores the digging context but never the occupation itself.
    assert.equal('_occupation' in snapshot, false);
    assert.equal('_cannedCommands' in snapshot, false);
});
//# sourceMappingURL=hero_digging.test.js.map