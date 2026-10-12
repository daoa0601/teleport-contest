import test from 'node:test';
import assert from 'node:assert/strict';
import { DART_TRAP, RUST_TRAP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { beginMonsterMove } from '../js/monmove.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
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
//# sourceMappingURL=monster_floor_trap_movement.test.js.map