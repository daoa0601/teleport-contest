import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { level_difficulty } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { RIN_AGGRAVATE_MONSTER } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
for (const [depth, expected] of [[12, 24], [25, 50], [30, 50]]) {
    void test(`a worn aggravation ring raises level difficulty at depth ${depth}`, async () => {
        assert.ok(depth !== undefined && expected !== undefined);
        freshObjectRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'Dungeon', num_dunlevs: 40 })];
        game.u.uz = { dnum: 0, dlevel: depth };
        grantIntrinsicProperty('aggravateMonster', 'outside');
        assert.equal(level_difficulty(), depth, 'intrinsic aggravation does not raise difficulty');
        const ring = await addInventoryObject(RIN_AGGRAVATE_MONSTER);
        await wearHeroAccessory(ring, 'uleft');
        assert.equal(level_difficulty(), expected);
    });
}
void test('the aggravation ring also adjusts Amulet and endgame difficulty', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Dungeon', num_dunlevs: 40, dunlev_ureached: 20 }),
        createDungeon({ dname: 'Planes', depth_start: -5, num_dunlevs: 5 })];
    game.u.uhave = { ...game.u.uhave, amulet: 1 };
    const ring = await addInventoryObject(RIN_AGGRAVATE_MONSTER);
    await wearHeroAccessory(ring, 'uleft');
    assert.equal(level_difficulty(), 40);
    game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.sanctum_level = createSpecialLevel({ dnum: 0, dlevel: 40 });
    game.u.uz = { dnum: 1, dlevel: 5 };
    game.u.ulevel = 20;
    assert.equal(level_difficulty(), 50);
});
//# sourceMappingURL=dungeon_difficulty.test.js.map