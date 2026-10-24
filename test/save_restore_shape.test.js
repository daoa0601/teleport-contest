import test from 'node:test';
import assert from 'node:assert/strict';
import { restoregamePreamble } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { flushPendingTopline } from '../js/display.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
// C restore.c:getlev() finishes dorecover() by running restore_cham() for
// every monster on the restored current level. A cancelled shapechanger that
// was saved in a borrowed body returns to that body's natural form across the
// round trip, exactly as it does when its level is re-entered from the cache.
void test('a cancelled shapechanger returns to its natural form across a save and restore', async () => {
    initRng(6102);
    freshObjectRoom({
        role: 'wizard',
        hero: { ualignbase: [0, 0] },
        flags: { female: false, initgend: 0 },
    });
    game.plname = game.displayName = 'Cham';
    const monster = await createMonsterAt('chameleon', 11, 10);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    monster.mcan = 1;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();
    initRng(6102);
    game.nhDisplay = new GameDisplay(null);
    assert.equal(restoreGame('Cham', storage), true);
    const level = game.level;
    assert.ok(level instanceof GameMap, 'Expected the saved level to be restored');
    const restored = level.monsters[0];
    assert.ok(restored, 'Expected the saved monster to be restored');
    assert.equal(restored.mnum, MONSTER_NAME.indexOf('little dog'));
    const input = resetInputState();
    installPagerInput(input, { expected: /welcome back|turns into/, limit: 8 });
    await restoregamePreamble();
    await flushPendingTopline();
    assert.equal(restored.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(restored.cham, -1, 'Cancellation keeps the reverted body from shapechanging again.');
    assert.equal(!!restored.mcan, true, 'Restoration keeps the monster cancelled.');
});
//# sourceMappingURL=save_restore_shape.test.js.map