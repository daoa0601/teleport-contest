import assert from 'node:assert/strict';
import test from 'node:test';
import { closedDoor } from '../js/monmove.js';
import { stairwayAt } from '../js/mklev.js';
import { upstart, ordinalSuffix, possessiveName, dist2, distmin } from '../js/hacklib.js';
import { trapAt } from '../js/trap.js';
import { monsterIsHelpless } from '../js/mondata.js';
import { DART_TRAP, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, CORR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addTrap } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';

// C monmove.c:closed_door(): IS_DOOR(typ) is `typ === DOOR`; a closed or
// locked mask makes the door closed, an open mask does not.
void test('closed_door recognizes only closed or locked doors', async () => {
    const level = await freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    const door = level.requireAt(11, 10);

    door.typ = DOOR;
    door.doormask = D_LOCKED;
    assert.equal(closedDoor(game, 11, 10), true);
    door.doormask = D_CLOSED;
    assert.equal(closedDoor(game, 11, 10), true);
    door.doormask = D_LOCKED | D_CLOSED;
    assert.equal(closedDoor(game, 11, 10), true);
    door.doormask = D_ISOPEN;
    assert.equal(closedDoor(game, 11, 10), false);

    // C stairs.c:stairway_at(): a plain room square holds no stairway.
    assert.equal(stairwayAt(game, 11, 10), null);
    door.typ = CORR;
    assert.equal(closedDoor(game, 11, 10), false);
});

// C stairs.c:stairway_at(): the per-game chain is searched by square.
void test('stairway_at finds the stairway on its own square only', async () => {
    await freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    const stair = {
        sx: 12, sy: 10, up: true, isladder: false,
        tolev: { dnum: 0, dlevel: 7 }, u_traversed: false,
        next: game.stairs,
    };
    game.stairs = stair;

    assert.equal(stairwayAt(game, 12, 10), stair);
    assert.equal(stairwayAt(game, 13, 10), null);
});

// C trap.c:t_at(): the level keeps one trap per square; t_at finds it by
// coordinates and returns nothing for other squares.
void test('t_at finds the trap on its own square only', async () => {
    const level = await freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    const trap = addTrap(level, DART_TRAP, 12, 10);

    assert.equal(trapAt(game, 12, 10), trap);
    assert.equal(trapAt(game, 13, 10), undefined);
});

// C hacklib.c:upstart(), ordin(), s_suffix(), dist2(), distmin(): the shared
// string and distance helpers keep their native contracts for every caller.
void test('shared hacklib helpers keep their native contracts', () => {
    assert.equal(upstart('abc'), 'Abc');
    assert.equal(upstart(''), '');

    assert.equal(ordinalSuffix(1), 'st');
    assert.equal(ordinalSuffix(2), 'nd');
    assert.equal(ordinalSuffix(3), 'rd');
    assert.equal(ordinalSuffix(4), 'th');
    assert.equal(ordinalSuffix(10), 'th');
    assert.equal(ordinalSuffix(11), 'th');
    assert.equal(ordinalSuffix(12), 'th');
    assert.equal(ordinalSuffix(13), 'th');
    assert.equal(ordinalSuffix(21), 'st');
    assert.equal(ordinalSuffix(101), 'st');
    assert.equal(ordinalSuffix(111), 'th');

    assert.equal(possessiveName('it'), 'its');
    assert.equal(possessiveName('you'), 'your');
    assert.equal(possessiveName('Chris'), "Chris'");
    assert.equal(possessiveName('Erinys'), "Erinys'");
    assert.equal(possessiveName('owlbear'), "owlbear's");

    assert.equal(dist2(1, 1, 4, 5), 25);
    assert.equal(distmin(1, 1, 4, 5), 4);
});

// C include/monst.h helpless(): sleeping, paralyzed, or frozen monsters
// cannot act; the shared predicate is what every caller tests.
void test('helpless monsters are sleeping, paralyzed, or frozen', async () => {
    const { monster } = await freshMonsterTrapRoom(DART_TRAP, { monster: {} });
    monster.msleeping = false;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    assert.equal(monsterIsHelpless(monster), false);

    monster.msleeping = true;
    assert.equal(monsterIsHelpless(monster), true);
    monster.msleeping = false;
    monster.mcanmove = 0;
    assert.equal(monsterIsHelpless(monster), true);
    monster.mcanmove = 1;
    monster.mfrozen = 3;
    assert.equal(monsterIsHelpless(monster), true);
});
