// C trap.c:mintrap(): the learned-trap avoidance roll and the learning that
// follows when the monster enters anyway. These branches are reached through
// the movement tail in most sessions; this test drives the mintrap entry
// directly with scripted draws.
import { triggerMonsterTrap } from '../js/trap.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DART_TRAP } from '../js/const.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import type { MonsterMovement } from '../js/monster_action_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

function stepMovement(x: number, y: number): MonsterMovement {
    return { oldx: x, oldy: y, x, y, moved: false };
}

void test('a monster which learned the trap type avoids it on a failed 1-in-4 roll', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(DART_TRAP, {
        monster: { species: 'little dog', mtrapped: 0, mtrapseen: 1 << (DART_TRAP - 1) },
    });
    requirePlayingGame(game);
    const movement = stepMovement(monster.mx, monster.my);

    // rn2(4) draws nonzero: the monster declines the known trap.
    const event = await triggerMonsterTrap(
        monster, game, movement, () => 1, () => 1, () => 20, [],
    );

    assert.equal(event?.kind, 'known-trap-avoided');
    assert.equal(movement.trap, event);
    assert.equal(monster.mtrapped, 0);
    assert.equal(trap.once, false);
});

void test('a winning avoidance roll enters the trap and teaches the type', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(DART_TRAP, {
        monster: { species: 'little dog', mtrapped: 0, mtrapseen: 0 },
    });
    requirePlayingGame(game);
    const movement = stepMovement(monster.mx, monster.my);

    const event = await triggerMonsterTrap(
        monster, game, movement, () => 0, () => 1, () => 20, [],
    );

    assert.equal(event?.kind, 'projectile-trap');
    assert.equal(trap.once, true);
    assert.ok(monsterKnowsTrap(monster, trap));
    assert.equal(movement.deferredAfterMonsterTrap, true);
});
