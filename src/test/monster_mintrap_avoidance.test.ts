// C trap.c:mintrap(): the learned-trap avoidance roll and the learning that
// follows when the monster enters anyway. These branches are reached through
// the movement tail in most sessions; this test drives the mintrap entry
// directly with scripted draws and checks the world: whether the trap
// springs, whether the monster is caught, and what it learned.
import { triggerMonsterTrap } from '../js/trap.js';
import { monsterKnowsTrap } from '../js/mondata.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DART_TRAP } from '../js/const.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import type { MonsterMovement } from '../js/monster_action_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

function stepMovement(x: number, y: number): MonsterMovement {
    return { oldx: x, oldy: y, x, y, moved: false };
}

void test('a monster which learned the trap type declines to spring it on a failed 1-in-4 roll', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(DART_TRAP, {
        monster: { species: 'little dog', mtrapped: 0, mtrapseen: 1 << (DART_TRAP - 1) },
    });
    requirePlayingGame(game);

    // The avoidance roll draws nonzero, so mintrap returns before any
    // trap effect runs.
    await triggerMonsterTrap(
        monster, game, stepMovement(monster.mx, monster.my), () => 1, () => 1, () => 20, [],
    );

    assert.equal(trap.once, false);
    assert.equal(monster.mtrapped, 0);
    assert.ok(monsterKnowsTrap(monster, trap));
});

void test('an unknown trap springs without any avoidance roll and teaches its type', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(DART_TRAP, {
        monster: { species: 'little dog', mtrapped: 0, mtrapseen: 0 },
    });
    requirePlayingGame(game);

    // C trap.c:3812 gates the avoidance roll on already_seen; a monster
    // which has not learned this trap type gets no roll at all, so even a
    // draw that would decline a known trap still springs the effect.
    await triggerMonsterTrap(
        monster, game, stepMovement(monster.mx, monster.my), () => 1, () => 1, () => 20, [],
    );

    assert.equal(trap.once, true);
    assert.equal(monster.mtrapped, 0);
    assert.ok(monsterKnowsTrap(monster, trap));
});
