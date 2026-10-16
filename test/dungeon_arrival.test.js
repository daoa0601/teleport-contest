import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty, propertyIsActive, setPropertyTerrainBlocked } from '../js/properties.js';
import { freshConnectedLevels } from './support/connected-levels.js';
void test('random arrival keeps a hero who was inside the Wizard tower within its destination boundary', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game._activeSpecialLevel = { prototype: 'wizard2', file: 'wizard2.lua',
        downTeleportExclude: { lx: 9, ly: 9, hx: 11, hy: 11 } };
    const cached = game._levelCache?.get('0:2');
    assert.ok(cached);
    cached.activeSpecialLevel = { prototype: 'wizard3', file: 'wizard3.lua',
        downTeleportExclude: { lx: 13, ly: 10, hx: 13, hy: 10 } };
    destination.downTeleportRegion = { lx: 8, ly: 8, hx: 8, hy: 8 };
    await gotoLevel({ dlevel: 2 });
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.uy, 10);
});
void test('arrival from solid terrain unblocks levitation before finishing the level change', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    setPropertyTerrainBlocked('levitation', true);
    assert.equal(propertyIsActive('levitation'), false);
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    resetInputState().display = { async readKey() { return 32; } };
    await gotoLevel({ dlevel: 2 });
    assert.equal(propertyIsActive('levitation'), true);
});
//# sourceMappingURL=dungeon_arrival.test.js.map