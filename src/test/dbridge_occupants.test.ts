import test from 'node:test';
import assert from 'node:assert/strict';
import { DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, NO_MINVENT, SLP_GAS_TRAP } from '../js/const.js';
import { closeDrawbridge, openDrawbridge } from '../js/dbridge.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { setPropertyTimeout } from '../js/properties.js';
import { switchHeroTerrain } from '../js/terrain_movement.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

function bridgeRoom(open = false) {
    const level = freshGameplayRoom();
    const bridge = level.requireAt(12, 10);
    bridge.typ = open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    level.requireAt(12, 9).typ = open ? DOOR : DBWALL;
    pushKeys(' '.repeat(100));
    return level;
}

void test('a bridge passing through the hero triggers the floor trap before removing it', async () => {
    const level = bridgeRoom();
    game.u.ux = 12;
    game.u.uy = 10;
    game.u.passesWalls = true;
    addTrap(level, SLP_GAS_TRAP, 12, 10);

    await openDrawbridge(12, 10);

    assert.ok((game._helplessTurns ?? 0) > 0, 'The sleep gas affects the hero before the trap is crushed');
    assert.equal(level.traps.length, 0);
});

void test('a lowering drawbridge crushes a worm caught by its tail', async () => {
    const level = bridgeRoom();
    const worm = await createMonsterAt('long worm', 14, 10, NO_MINVENT);
    assert.ok(worm.wormno, 'The worm owns a body slot');
    worm.wormSegments = [{ x: 13, y: 10 }, { x: 12, y: 10 }];

    await openDrawbridge(12, 10);

    assert.notEqual(monsterAtPosition(level, 14, 10), worm);
    assert.ok(worm.mhp <= 0);
});

void test('breathlessness alone cannot save a monster under a rising drawbridge', async () => {
    const level = bridgeRoom(true);
    const golem = await createMonsterAt('iron golem', 12, 10, NO_MINVENT);
    golem.mconf = 1;
    golem.mstun = 1;
    await createMonsterAt('xorn', 12, 9, NO_MINVENT);

    await closeDrawbridge(12, 10);

    assert.notEqual(monsterAtPosition(level, 12, 10), golem);
    assert.ok(golem.mhp <= 0);
});

void test('opening a portcullis restores blocked levitation with terrain status enabled', async () => {
    bridgeRoom();
    game.u.ux = 12;
    game.u.uy = 9;
    game.u.ux0 = 12;
    game.u.uy0 = 10;
    game.u.passesWalls = true;
    game.flags.terrainstatus = true;
    setPropertyTimeout('levitation', 10);
    await switchHeroTerrain();
    assert.equal(game.u.levitating, false, 'The closed portcullis blocks levitation');

    await openDrawbridge(12, 10);

    assert.equal(game.u.levitating, true);
});
