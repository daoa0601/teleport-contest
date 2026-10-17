import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DART_TRAP, RUST_TRAP, NO_MINVENT, ROLLING_BOULDER_TRAP, MMOVE_DIED, MMOVE_MOVED } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { beginMonsterMove } from '../js/monmove.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
for (const [species, trapType] of [['air elemental', DART_TRAP], ['wraith', RUST_TRAP]]) {
    void test(`a flying ${species} crosses a floor-triggered trap without setting it off`, async () => {
        freshObjectRoom({ left: 10, right: 12, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 12, 10, NO_MINVENT);
        monster.mpeaceful = 0;
        monster.msleeping = 0;
        const trap = await maketrap(11, 10, trapType);
        assert.ok(trap);
        const hp = monster.mhp;
        await beginMonsterMove(monster, game);
        assert.equal(monster.mx, 11);
        assert.equal(monster.my, 10);
        assert.equal(monster.mhp, hp);
        assert.equal(monsterKnowsTrap(monster, trap), false);
        assert.equal(trap.once, false);
        assert.equal(game.level.objects[11]?.[10]?.length ?? 0, 0);
    });
}
for (const fatal of [true, false]) {
    void test(`a rolling boulder reports ${fatal ? 'death' : 'movement'} when the monster ${fatal ? 'dies' : 'survives'}`, async () => {
        const level = freshObjectRoom({ left: 9, right: 15, top: 10, bottom: 10, heroX: 9 });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
        goblin.mpeaceful = 0;
        goblin.msleeping = 0;
        goblin.mhp = goblin.mhpmax = fatal ? 1 : 100;
        addTrap(level, ROLLING_BOULDER_TRAP, 11, 10, {
            launch: { x: 13, y: 10 }, launch2: { x: 10, y: 10 },
        });
        const boulder = await floorObject(BOULDER, 13, 10);
        installPagerInput(resetInputState(), { expected: /boulder|goblin/i, limit: 8 });
        initRng(1n);
        const action = await beginMonsterMove(goblin, game);
        assert.equal(goblin.mx, 11, 'the goblin reached the trigger');
        assert.ok(goblin.mhp < (fatal ? 1 : 100), 'the boulder hit the goblin');
        assert.equal(monsterAtPosition(level, goblin.mx, goblin.my) === goblin, !fatal);
        assert.equal(action.movement.postMoveStatus, fatal ? MMOVE_DIED : MMOVE_MOVED);
        assert.ok(floorObjectsAt(level, 10, 10).includes(boulder), 'the boulder completed its flight');
    });
}
//# sourceMappingURL=monster_floor_trap_movement.test.js.map