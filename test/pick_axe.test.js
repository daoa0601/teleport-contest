import { addTrap } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DUST, IRONBARS, PIT, STONE, TREE, TT_PIT, TT_WEB, WEB, } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { AXE, BATTLE_AXE, BOULDER, DWARVISH_MATTOCK, PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function diggingRoom(otyp = PICK_AXE, { wielded = true } = {}) {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    resetInputState();
    const tool = await addInventoryObject(otyp, { invlet: 'a', spe: 0 });
    if (wielded)
        game.uwep = game.u.uwep = tool;
    return tool;
}
function targetTerrain(typ) {
    requireGameLevel().requireAt(11, 10).typ = typ;
    newsym(11, 10);
}
void test('applying an unwielded pick spends a turn wielding before asking a direction', async () => {
    const pick = await diggingRoom(PICK_AXE, { wielded: false });
    requirePlayingGame(game);
    targetTerrain(STONE);
    await applyInventoryObject(pick);
    assert.equal(game.uwep, pick);
    assert.equal(game.context.move, 1);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, STONE);
    pushKeys(' l'); // Acknowledge wielding before the resumed direction query.
    await rhack(0);
    assert.match(game._pending_message, /You start digging/);
    assert.equal(game.context.move, 1);
});
for (const otyp of [PICK_AXE, DWARVISH_MATTOCK, AXE, BATTLE_AXE]) {
    void test(`applying digging tool ${otyp} can be cancelled without spending a turn`, async () => {
        const tool = await diggingRoom(otyp);
        requirePlayingGame(game);
        await applyInventoryObject(tool, '\x1b');
        assert.equal(game.context.move, 0);
        assert.equal(game.uwep, tool);
    });
}
void test('a pick cannot be swung while the hero is caught in a web', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_WEB;
    await applyInventoryObject(pick);
    assert.match(game._pending_message, /can't dig while entangled in a web/);
    assert.equal(game.context.move, 0);
});
void test('a pick cannot cut down a tree', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    targetTerrain(TREE);
    await applyInventoryObject(pick, 'l');
    assert.match(game._pending_message, /You need an axe to cut down a tree/);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, TREE);
    assert.equal(game.context.move, 1);
});
void test('an axe cannot dig through rock', async () => {
    const axe = await diggingRoom(AXE);
    requirePlayingGame(game);
    targetTerrain(STONE);
    await applyInventoryObject(axe, 'l');
    assert.match(game._pending_message, /You need a pick to dig rock/);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, STONE);
    assert.equal(game.context.move, 1);
});
void test('chopping plain ground scratches its engraving', async () => {
    const axe = await diggingRoom(AXE);
    requirePlayingGame(game);
    makeEngravingAt(10, 10, '?', null, 0, DUST);
    await applyInventoryObject(axe, '>');
    assert.match(game._pending_message, /merely scratches the floor/);
    assert.equal(engravingAt(10, 10), null);
    assert.equal(game.context.move, 1);
});
void test('digging toward the hero hurts without opening a hole', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    const hp = game.u.uhp;
    await applyInventoryObject(pick, '.');
    assert.ok(game.u.uhp < hp);
    assert.equal(requireGameLevel().traps.length, 0);
    assert.equal(game.context.move, 1);
});
void test('a levitating hero cannot get leverage against the ceiling', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    game.u.levitating = true;
    await applyInventoryObject(pick, '<');
    assert.match(game._pending_message, /don't have enough leverage/);
    assert.equal(game.context.move, 1);
});
void test('a pick aimed outside the map clashes and spends a turn', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    game.u.ux = 1;
    await applyInventoryObject(pick, 'h');
    assert.equal(game._pending_message, 'Clash!');
    assert.equal(game.context.move, 1);
});
void test('an applied pick catches in a neighboring web and delays the hero', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    const web = addTrap(requireGameLevel(), WEB, 11, 10);
    await applyInventoryObject(pick, 'l   ');
    assert.equal(web.tseen, true);
    assert.ok((game._helplessTurns ?? 0) >= 2 && (game._helplessTurns ?? 0) <= 4);
    assert.equal(game._helplessDoneMessage, 'You pull free.');
    assert.equal(game.context.move, 1);
});
void test('a one-handed pick cannot reach a boulder in a known pit', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    await floorObject(BOULDER, 11, 10);
    addTrap(requireGameLevel(), PIT, 11, 10, { tseen: true });
    await applyInventoryObject(pick, 'l');
    assert.match(game._pending_message, /can't reach the boulder/);
    assert.equal(game.context.move, 1);
});
void test('a mattock can reach a boulder in a known pit', async () => {
    const pick = await diggingRoom(DWARVISH_MATTOCK);
    requirePlayingGame(game);
    await floorObject(BOULDER, 11, 10);
    addTrap(requireGameLevel(), PIT, 11, 10, { tseen: true });
    await applyInventoryObject(pick, 'l');
    assert.match(game._pending_message, /You start hitting the boulder/);
    assert.equal(game.context.move, 1);
});
void test('digging sideways from a pit joins it to the neighboring pit', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    addTrap(requireGameLevel(), PIT, 10, 10, { tseen: true });
    addTrap(requireGameLevel(), PIT, 11, 10, { tseen: true });
    await applyInventoryObject(pick, 'l');
    assert.match(game._pending_message, /clear some debris from between the pits/);
    const hp = game.u.uhp;
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uhp, hp);
});
void test('hitting iron bars wakes a nearby sleeping monster', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    targetTerrain(IRONBARS);
    const monster = await createMonsterAt('jackal', 12, 10);
    monster.msleeping = 1;
    await applyInventoryObject(pick, 'l   ');
    assert.equal(monster.msleeping, 0);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, IRONBARS);
});
void test('applying a pick at a hostile monster uses melee instead of digging', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 11, 10);
    monster.mhp = monster.mhpmax = 500;
    game.u.uhitinc = 100;
    newsym(11, 10);
    initRng(2n);
    await applyInventoryObject(pick, 'l   ');
    assert.ok(monster.mhp < 500);
    assert.equal(game.context.move, 1);
});
void test('autodig starts work without moving into the rock', async () => {
    await diggingRoom();
    requirePlayingGame(game);
    targetTerrain(STONE);
    game.flags.autodig = true;
    await rhack('l'.charCodeAt(0));
    assert.match(game._pending_message, /You start digging/);
    assert.equal(game.u.ux, 10);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, STONE);
    assert.equal(game.context.move, 0);
});
void test('pick direction input honors a configured movement key', async () => {
    const pick = await diggingRoom();
    requirePlayingGame(game);
    targetTerrain(STONE);
    game.commandBindings.bindKey('x'.charCodeAt(0), 'moveeast');
    await applyInventoryObject(pick, 'x');
    assert.match(game._pending_message, /You start digging/);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=pick_axe.test.js.map