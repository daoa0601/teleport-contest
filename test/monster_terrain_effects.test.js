import assert from 'node:assert/strict';
import test from 'node:test';
import { restoregamePreamble, runMoveloopCore } from '../js/allmain.js';
import { NO_MINVENT, POOL } from '../js/const.js';
import { reviveCorpseImmediately } from '../js/do.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { changeMonsterForm } from '../js/mon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { restoreGame } from '../js/restore.js';
import { saveGame } from '../js/save.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
async function finishLiquidResponse() {
    const input = resetInputState();
    installPagerInput(input, { expected: /drowns|goblin|welcome back/, limit: 4 });
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 12;
    await finishAtCommandInput(input, () => runMoveloopCore(), /goblin drowns\.|^$/);
}
for (const restoreBeforeTurn of [false, true]) {
    void test(`a monster losing flight drowns before earning a move${restoreBeforeTurn ? ' after restoration' : ''}`, async () => {
        const level = await freshObjectRoom();
        const bat = await createMonsterAt('bat', 12, 10, NO_MINVENT);
        level.requireAt(12, 10).typ = POOL;
        await changeMonsterForm(bat, MONSTER_NAME.indexOf('goblin'));
        bat.movement = 0;
        let target = bat;
        if (restoreBeforeTurn) {
            game.plname = 'Terrain';
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            await freshObjectRoom();
            assert.equal(await restoreGame('Terrain', storage), true);
            await restoregamePreamble();
            requirePlayingGame(game);
            const restored = game.level.monsters.find(monster => monster.m_id === bat.m_id);
            assert.ok(restored);
            target = restored;
        }
        await finishLiquidResponse();
        assert.ok(target.mhp <= 0, 'The new body reacts to water without waiting for a movement ration');
        assert.equal(game.u.uconduct?.killer ?? 0, 0, 'The monster-moving phase owns this liquid death');
    });
}
void test('a corpse revived on a pool reacts before earning a move', async () => {
    const level = await freshObjectRoom();
    const corpse = await floorObject(CORPSE, 12, 10, { corpsenm: MONSTER_NAME.indexOf('goblin') });
    level.requireAt(12, 10).typ = POOL;
    const revival = await reviveCorpseImmediately(corpse, game, { announce: false });
    assert.equal(revival?.kind, 'revived');
    assert.ok(revival?.monster);
    revival.monster.movement = 0;
    await finishLiquidResponse();
    assert.ok(revival.monster.mhp <= 0, 'The revived body reacts to water before its first move');
});
//# sourceMappingURL=monster_terrain_effects.test.js.map