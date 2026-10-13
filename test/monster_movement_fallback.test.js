import assert from 'node:assert/strict';
import test from 'node:test';
import { moveMonsterForHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MMOVE_MOVED, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a unicorn blocked by the hero line can teleport instead of walking', async () => {
    let teleported = 0;
    for (let seed = 1; seed <= 8; seed++) {
        freshObjectRoom({ left: 10, right: 18, top: 10, bottom: 10,
            heroX: 16, heroY: 10 });
        requirePlayingGame(game);
        const unicorn = await createMonsterAt('white unicorn', 10, 10, MM_ANGRY | NO_MINVENT);
        unicorn.msleeping = 0;
        unicorn.movement = 7;
        unicorn.mtrack = [{ x: 9, y: 10 }];
        pushKeys(' '.repeat(100));
        initRng(BigInt(seed));
        const result = await moveMonsterForHeroAttack(unicorn);
        assert.equal(unicorn.my, 10);
        assert.equal(unicorn.movement, 7);
        if (unicorn.mx !== 10) {
            teleported++;
            assert.equal(result.status, MMOVE_MOVED);
            assert.ok(unicorn.mx >= 11 && unicorn.mx <= 18 && unicorn.mx !== 16);
            assert.equal(unicorn.mtrack.length, 0, 'teleportation clears the walking track');
        }
    }
    assert.ok(teleported > 0, 'a blocked unicorn must sometimes teleport to a free square');
});
//# sourceMappingURL=monster_movement_fallback.test.js.map