import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runClaimedCorpseRevivalTimer } from '../js/corpse_revival.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { CORPSE } from '../js/object_data.js';
import { claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers, } from '../js/object_timers.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
const PM_GIANT_ZOMBIE = 247;
function freshState() {
    freshObjectRoom({
        heroX: 13,
        heroY: 10,
        objectInitializationSeed: 700n,
        recalculateVision: false,
    });
    requirePlayingGame(game);
}
void test('a zombie attacks a nearby giant and the giant rises as a zombie', async () => {
    freshState();
    requirePlayingGame(game);
    const zombie = await createMonsterAt('human zombie', 10, 10);
    zombie.mux = game.u.ux;
    zombie.muy = game.u.uy;
    zombie.movement = 12;
    zombie.mhp = 30;
    zombie.mhpmax = 30;
    zombie.m_lev = 8;
    const giant = await createMonsterAt('giant', 11, 10);
    giant.mux = game.u.ux;
    giant.muy = game.u.uy;
    giant.movement = 12;
    giant.mhp = 8;
    giant.mhpmax = 8;
    giant.m_lev = 6;
    giant.name = 'Bram';
    await takeMonsterTurn(zombie, game, () => 0, (count, sides) => count * sides, () => 1);
    assert.notEqual(monsterAtPosition(game.level, giant.mx, giant.my), giant);
    assert.deepEqual([zombie.mx, zombie.my], [10, 10]);
    const corpse = floorObjectsAt(game.level, 11, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse, 'the giant left a corpse');
    const [timer] = objectTimers(corpse);
    assert.ok(timer, 'the corpse has a revival timer');
    assert.equal(timer.kind, OBJECT_TIMER_KIND.ZOMBIFY_MON);
    game.moves = timer.deadline;
    const event = await runClaimedCorpseRevivalTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event?.monster, 'the corpse timer produced a monster');
    assert.equal(event.monster.mnum, PM_GIANT_ZOMBIE);
    assert.equal(event.monster.name, giant.name);
});
void test('a fatal monster attack makes a shifted vampire rise', async () => {
    freshState();
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 10, 10);
    initializePet(dragon, { state: game });
    dragon.mhp = dragon.mhpmax = 40;
    dragon.movement = 12;
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = await createMonsterAt('wolf', 11, 10);
    wolf.mux = game.u.ux;
    wolf.muy = game.u.uy;
    wolf.movement = 12;
    wolf.mhp = 1;
    wolf.mhpmax = 20;
    wolf.m_lev = 6;
    wolf.cham = vampireLeader;
    await takeMonsterTurn(dragon, game, () => 0, count => count, () => 1);
    assert.equal(wolf.mnum, vampireLeader);
    assert.equal(wolf.mhp > 0, true);
    assert.equal(game.level.monsters.includes(wolf), true);
});
//# sourceMappingURL=monster_aggression.test.js.map