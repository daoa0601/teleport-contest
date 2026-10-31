import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { fightNearbyMonster } from '../js/mhitm.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C mhitm.c:fightm(): a conflicted monster attacks the adjacent monster
// instead of moving, and a defender that was hit (but did not die) may
// spend a movement ration to strike back immediately.
void test('a hit under conflict lets the defender answer and spend its movement', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10, flags: { verbose: false } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    const defender = await createMonsterAt('gnome', 11, 10, NO_MINVENT);
    defender.mhp = 100;
    defender.mhpmax = 100;
    defender.movement = 24;
    const attackerHealth = attacker.mhp;
    pushKeys(' '.repeat(40));
    // Every to-hit and conflict roll takes the lowest value, so the attack
    // hits, the 1-in-4 answer gate opens, and the ration check passes.
    const fight = await fightNearbyMonster(attacker, game, () => 1, () => 1, () => 1, []);
    assert.ok(fight, 'the conflict fight finds the adjacent defender');
    assert.equal(fight.consumed, true, 'a hit replaces the attacker movement');
    assert.equal(defender.movement, 12, 'the answer spends one NORMAL_SPEED ration');
    assert.equal(defender.mlstmv, game.moves, 'the counterattack stamps the defender turn');
    assert.ok(attacker.mhp < attackerHealth, 'the defender strikes back at its attacker');
});
// C mhitm.c:fightm(): a miss reports no attack, so the monster still gets
// its regular movement this turn, and the defender keeps its movement.
void test('a missed conflict attack leaves the monster its movement', async () => {
    await freshObjectRoom({ heroX: 16, heroY: 10, flags: { verbose: false } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    const defender = await createMonsterAt('gnome', 11, 10, NO_MINVENT);
    defender.mhp = 100;
    defender.mhpmax = 100;
    defender.movement = 24;
    pushKeys(' '.repeat(40));
    // The first rnd(20) is the conflict-resist roll, which must pass; every
    // later, larger to-hit die exceeds the armor-class differential, so all
    // attack slots miss.
    let rollIndex = 0;
    const missEverySwing = (sides) => ++rollIndex === 1 ? 1 : sides + 10;
    const fight = await fightNearbyMonster(attacker, game, () => 1, () => 1, missEverySwing, []);
    assert.ok(fight);
    assert.equal(fight.consumed, false, 'a miss does not consume the movement action');
    assert.equal(defender.movement, 24, 'no answer is granted after a miss');
    assert.notEqual(defender.mlstmv, game.moves, 'the defender never acts on a miss');
});
//# sourceMappingURL=mhitm_fightm.test.js.map