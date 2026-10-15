import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_LOCKED, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { beginHeroEngulf } from '../js/hero_engulf.js';
import { expelHero } from '../js/hero_expulsion.js';
import { resetInputState } from '../js/input.js';
import { continuePicking, pickLock } from '../js/lock_pick.js';
import { AD_DGST, AT_ENGL } from '../js/monster_attack_types.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { CREDIT_CARD } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('engulfing discards lock progress even after the hero is expelled', async () => {
    const level = freshObjectRoom({ hero: { acurr: { a: [18, 3, 18, 18, 18, 18] } } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    game.u.dx = 1;
    game.u.dy = 0;
    const tool = await addInventoryObject(CREDIT_CARD);
    const monster = await createMonsterAt('purple worm', 9, 10, NO_MINVENT);
    const input = resetInputState();
    installPagerInput(input, { expected: /unlock|pick|swallow|stop/i, limit: 10 });
    input.feed('y');
    await pickLock(tool, { target: { x: 11, y: 10 } });
    const attempt = game._occupation;
    assert.ok(attempt?.key === 'pick-lock');
    initRng(1n);
    assert.equal(await continuePicking(attempt), true);
    placeMonsterAt(monster, 10, 10);
    game.u.ustuck = monster;
    const capture = await beginHeroEngulf(monster, {
        kind: 'hero-attack', attackType: AT_ENGL, hit: true,
        damageType: AD_DGST, engulfOldX: 9, engulfOldY: 10,
    });
    assert.equal(capture.captured, true);
    assert.equal((await expelHero(monster, { message: false })).expelled, true);
    input.feed('n');
    assert.equal(await pickLock(tool, { target: { x: 11, y: 10 } }), false, 'a new attempt must ask to unlock the door rather than resume');
    assert.equal(game._occupation, null);
});
//# sourceMappingURL=lock_engulf_progress.test.js.map