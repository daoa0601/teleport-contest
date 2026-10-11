import type { GameMap } from '../js/game.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ARROW_TRAP, DOOR, D_CLOSED, D_TRAPPED, PIT, POOL, ROOM, SDOOR,
    TRAPPED_CHEST, TRAPPED_DOOR,
} from '../js/const.js';
import { addBuriedObject } from '../js/buried_object.js';
import { glyphAt, map_object } from '../js/display.js';
import { game } from '../js/gstate.js';
import { InputGate, bindInputGate, pushKeys } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { APPLE, CHEST, GOLD_PIECE, LARGE_BOX, SACK } from '../js/object_data.js';
import { detectTraps } from '../js/trap_detection.js';
import { addInventoryObject, floorObject, uninitializedObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom, type ObjectRoomOptions } from './support/object-room.js';

function rememberedObject(level: GameMap, x: number, y: number) {
    const glyph = level.requireAt(x, y).remembered_glyph;
    assert.ok(glyph?.kind === 'object', `Expected a remembered object at ${x},${y}`);
    return glyph;
}
function rememberedTrap(level: GameMap, x: number, y: number) {
    const glyph = level.requireAt(x, y).remembered_glyph;
    assert.ok(glyph?.kind === 'trap', `Expected a remembered trap at ${x},${y}`);
    return glyph;
}
function visibleObject(x: number, y: number) {
    const glyph = glyphAt(x, y);
    assert.ok(glyph?.kind === 'object', `Expected a visible object at ${x},${y}`);
    return glyph;
}
function visibleTrap(x: number, y: number) {
    const glyph = glyphAt(x, y);
    assert.ok(glyph?.kind === 'trap', `Expected a visible trap at ${x},${y}`);
    return glyph;
}

function detectionRoom(options: ObjectRoomOptions = {}) {
    return freshObjectRoom({ flags: { tips: false, verbose: true }, ...options });
}

function dismissView() { pushKeys(' .'); }

void test('no traps produce strange feeling without clearing stale object memory or consuming the source', async () => {
    const level = detectionRoom();
    requirePlayingGame(game);
    map_object(await uninitializedObject(GOLD_PIECE, { ox: 30, oy: 10 }), true, false);
    const source = { cursed: true, quantity: 2 };

    const result = await detectTraps(source);

    assert.equal(result.result, 1);
    assert.equal(result.known, false);
    assert.equal(result.strangeFeeling, true);
    assert.match(game._lastPlineMessage, /Your toes stop itching\./);
    assert.equal(rememberedObject(level, 30, 10).otyp, GOLD_PIECE);
    assert.equal(source.quantity, 2);
});

void test('the only floor trap under the hero itches without revealing the trap', async () => {
    detectionRoom();
    requirePlayingGame(game);
    const trap = await maketrap(game.u.ux, game.u.uy, PIT);

    const result = await detectTraps({ cursed: false });

    assert.equal(result.result, 0);
    assert.equal(result.known, false);
    assert.equal(result.strangeFeeling, false);
    assert.ok(trap != null, 'Expected trap to be initialized');
    assert.equal(trap.tseen, false);
    assert.equal(game._lastPlineMessage, 'Your toes itch.');
});

void test('a trapped box nested in carried luggage is observed and its trap becomes known', async () => {
    detectionRoom();
    requirePlayingGame(game);
    const sack = await addInventoryObject(SACK, { observed: false, dknown: false });
    const chest = await uninitializedObject(CHEST, { otrapped: true, tknown: false, dknown: false });
    const apple = await uninitializedObject(APPLE, { dknown: false });
    await addCreatedObjectToContainer(chest, apple);
    await addCreatedObjectToContainer(sack, chest);

    const result = await detectTraps({ cursed: true });

    assert.equal(result.result, 0);
    assert.equal(chest.tknown, true);
    assert.equal(chest.dknown, true);
    assert.equal(chest.otrapped, true);
    assert.equal(apple.dknown, false);
    assert.equal(chest.where, 'contained');
    assert.ok(sack.contents != null, 'Expected sack.contents to be initialized');
    assert.equal(sack.contents.includes(chest), true);
    assert.equal(game._lastPlineMessage, 'Your toes itch.');
});

void test('remote floor traps reveal all floor traps and cover a trapped container on the same square', async () => {
    const level = detectionRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = ROOM;
    const remote = await maketrap(30, 10, ARROW_TRAP);
    const here = await maketrap(game.u.ux, game.u.uy, PIT);
    const chest = await floorObject(CHEST, 30, 10, { otrapped: true, tknown: false });
    dismissView();

    await detectTraps({ cursed: false });

    assert.ok(remote != null, 'Expected remote to be initialized');
    assert.equal(remote.tseen, true);
    assert.ok(here != null, 'Expected here to be initialized');
    assert.equal(here.tseen, true);
    assert.equal(chest.tknown, true);
    assert.equal(level.requireAt(30, 10).remembered_glyph?.kind, 'trap');
    assert.equal(rememberedTrap(level, 30, 10).trapType, ARROW_TRAP);
});

void test('trap detection finds buried containers and chests nested in monster inventories', async () => {
    const level = detectionRoom();
    requirePlayingGame(game);
    const buried = await floorObject(CHEST, 30, 10, { otrapped: true, tknown: false, dknown: false });
    addBuriedObject(buried, 30, 10);
    level.requireAt(32, 10).typ = ROOM;
    const carrier = await createMonsterAt('newt', 32, 10);
    const sack = await uninitializedObject(SACK);
    const box = await uninitializedObject(LARGE_BOX, { otrapped: true, tknown: false, dknown: false });
    await addCreatedObjectToContainer(sack, box);
    await addObjectToMonsterInventory(carrier, sack);
    dismissView();

    await detectTraps(null);

    assert.equal(buried.tknown, true);
    assert.equal(buried.dknown, true);
    assert.equal(buried.where, 'buried');
    assert.equal(box.tknown, true);
    assert.equal(box.dknown, true);
    assert.equal(box.container, sack);
    assert.equal(rememberedTrap(level, 30, 10).trapType, TRAPPED_CHEST);
    assert.equal(rememberedTrap(level, 32, 10).trapType, TRAPPED_CHEST);
});

void test('a ridden steed carries its trapped chest at the hero location', async () => {
    detectionRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const steed = await createSaddledSteed();
    const chest = await uninitializedObject(CHEST, { otrapped: true, tknown: false });
    await addObjectToMonsterInventory(steed, chest);
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, steed);
    pushKeys(' ');

    const result = await detectTraps({ cursed: false });

    assert.equal(result.result, 0);
    assert.equal(chest.tknown, true);
    assert.equal(steed.minvent.includes(chest), true);
    assert.equal(game._lastPlineMessage, 'Your toes itch.');
});

void test('cursed detection shows fake gold while leaving a floor trap concealed', async () => {
    const level = detectionRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = ROOM;
    const trap = await maketrap(30, 10, PIT);
    const chest = await floorObject(CHEST, 32, 10, { otrapped: true, tknown: false, dknown: false });
    const gate = new InputGate();
    bindInputGate(gate);

    const effect = detectTraps({ cursed: true });
    await gate.waitUntilBlocked();

    assert.match(game._pending_message, /You feel very greedy\./);
    assert.equal(visibleObject(30, 10).otyp, GOLD_PIECE);
    assert.equal(visibleObject(32, 10).otyp, GOLD_PIECE);
    assert.ok(trap != null, 'Expected trap to be initialized');
    assert.equal(trap.tseen, false);
    assert.equal(chest.tknown, true);
    assert.equal(chest.dknown, true);
    assert.equal((level.objects[30]?.[10] || []).length, 0);
    gate.feed(' .');
    await effect;
    assert.equal(rememberedObject(level, 30, 10).otyp, GOLD_PIECE);
});

void test('hallucinating trap detection remembers imaginary objects without observing chest appearance', async () => {
    const level = detectionRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = ROOM;
    const trap = await maketrap(30, 10, PIT);
    const chest = await floorObject(CHEST, 32, 10, { otrapped: true, tknown: false, dknown: false });
    dismissView();

    await detectTraps({ cursed: false });

    assert.ok(trap != null, 'Expected trap to be initialized');
    assert.equal(trap.tseen, false);
    assert.equal(chest.tknown, true);
    assert.equal(chest.dknown, false);
    assert.equal(level.requireAt(30, 10).remembered_glyph?.kind, 'object');
    assert.equal(level.requireAt(32, 10).remembered_glyph?.kind, 'object');
    assert.equal((level.objects[30]?.[10] || []).length, 0);
});

void test('trapped doors are revealed but a secret door wall flag is not a trap', async () => {
    const level = detectionRoom();
    requirePlayingGame(game);
    const secretDoorSquare = level.requireAt(30, 10);
    secretDoorSquare.typ = SDOOR;
    secretDoorSquare.doormask = D_TRAPPED;
    level.doors.push({ x: 30, y: 10 });
    level.doorindex = 1;

    assert.equal((await detectTraps({ cursed: false })).result, 1);

    const doorSquare = level.requireAt(32, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_TRAPPED | D_CLOSED;
    level.doors.push({ x: 32, y: 10 });
    level.doorindex = 2;
    pushKeys('  .');
    await detectTraps({ cursed: false });

    assert.equal(rememberedTrap(level, 32, 10).trapType, TRAPPED_DOOR);
    assert.equal(level.requireAt(30, 10).typ, SDOOR);
    assert.notEqual(level.requireAt(30, 10).remembered_glyph?.kind, 'trap');
    assert.equal(level.requireAt(32, 10).doormask, D_TRAPPED | D_CLOSED);
});

void test('trap browsing suspends underwater view until input finishes then restores it', async () => {
    const level = detectionRoom({ hero: { uinwater: 1 } });
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    level.requireAt(30, 10).typ = ROOM;
    await maketrap(30, 10, PIT);
    const gate = new InputGate();
    bindInputGate(gate);

    const effect = detectTraps({ cursed: false });
    await gate.waitUntilBlocked();
    assert.equal(game.u.uinwater, 0);
    assert.equal(visibleTrap(30, 10).trapType, PIT);
    gate.feed(' ');
    await gate.waitUntilBlocked();
    assert.match(game._pending_message, /For instructions/);
    assert.equal(game.u.uinwater, 0);
    gate.feed('.');
    await effect;

    assert.equal(game.u.uinwater, 1);
    assert.equal(glyphAt(30, 10)?.kind, 'unexplored');
    assert.equal(rememberedTrap(level, 30, 10).trapType, PIT);
});

void test('itching messages describe the current body and beginner hallucination uses a normal feeling', async () => {
    detectionRoom({ hero: { umonnum: MONSTER_NAME.indexOf('pony') } });
    requirePlayingGame(game);

    await detectTraps(null);

    assert.equal(game._lastPlineMessage, 'Your rear hoof tips stop itching.');
    detectionRoom({ flags: { beginner: true }, hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);

    await detectTraps(null);

    assert.equal(game._lastPlineMessage, 'You have a normal feeling for a moment, then it passes.');
});
