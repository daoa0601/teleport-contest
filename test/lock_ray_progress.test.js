import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_LOCKED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { continuePicking, pickLock } from '../js/lock_pick.js';
import { CREDIT_CARD } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const ray of ['fire', 'cold', 'lightning', 'disintegration']) {
    void test(`a ${ray} ray destroys the lock currently being picked`, async () => {
        const level = freshObjectRoom({ hero: { acurr: { a: [18, 3, 18, 18, 18, 18] } } });
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        game.u.dx = 1;
        game.u.dy = 0;
        const tool = await addInventoryObject(CREDIT_CARD);
        const input = resetInputState();
        installPagerInput(input, { expected: /unlock|pick|door|stop/i, limit: 10 });
        input.feed('y');
        await pickLock(tool, { target: { x: 11, y: 10 } });
        const attempt = game._occupation;
        assert.ok(attempt?.key === 'pick-lock');
        initRng(1n);
        assert.equal(await continuePicking(attempt), true);
        await applyRayFloorFeatures(ray, 11, 10);
        await pickLock(tool, { target: { x: 11, y: 10 } });
        assert.equal(game._occupation?.key ?? null, null, 'a destroyed lock cannot resume picking');
        assert.match(game._pending_message, ray === 'lightning'
            ? /This door is broken\.$/ : /This doorway has no door\.$/);
    });
}
//# sourceMappingURL=lock_ray_progress.test.js.map