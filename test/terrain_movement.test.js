import { floorObjectsAt } from './support/level-state.js';
import { addTrap } from './support/level-state.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_CLOSED, PIT, ROOM, STONE, TT_BEARTRAP, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { applyHeroLocationEffects } from '../js/cmd.js';
import { BOULDER } from '../js/object_data.js';
import { grantIntrinsicProperty, refreshMovementProperties } from '../js/properties.js';
import { restoreGame, saveGame } from '../js/save.js';
import { floatHeroUp, resetHeroTrap, switchHeroTerrain } from '../js/terrain_movement.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
for (const property of ['levitation', 'flying']) {
    void test(`${property} stops inside solid terrain and resumes after it opens`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        grantIntrinsicProperty(property, 'outside');
        const location = game.level.requireAt(game.u.ux, game.u.uy);
        location.typ = STONE;
        await switchHeroTerrain();
        assert.equal(game.u[property], false);
        assert.match(game._pending_message, /can't (levitate|fly) in here/);
        location.typ = ROOM;
        await switchHeroTerrain();
        assert.equal(game.u[property], true);
        assert.match(game._pending_message, /start (to float in the air|flying)/);
    });
    void test(`saving inside a closed door preserves suppressed ${property}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.plname = `Terrain-${property}`;
        grantIntrinsicProperty(property, 'outside');
        const location = game.level.requireAt(game.u.ux, game.u.uy);
        location.typ = DOOR;
        location.doormask = D_CLOSED;
        await switchHeroTerrain();
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame(game.plname, storage), true);
        assert.equal(game.u[property], false);
        game.level.requireAt(game.u.ux, game.u.uy).typ = ROOM;
        await switchHeroTerrain();
        assert.equal(game.u[property], true);
    });
}
void test('levitation takes a trapped hero out of a pit and lets a boulder fill it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    addTrap(game.level, PIT, 10, 10, { tseen: true });
    const boulder = await floorObject(BOULDER, 10, 10);
    grantIntrinsicProperty('levitation', 'outside');
    await floatHeroUp();
    assert.equal(game.u.utrap, 0);
    assert.equal(game.level.traps.length, 0);
    assert.ok(game.level.objects[10] != null);
    assert.ok(game.level.objects[10]?.[10] !== undefined && game.level.objects[10]?.[10] !== null);
    assert.ok(!floorObjectsAt(game.level, 10, 10).includes(boulder));
    assert.match(game._pending_message, /float up, out of the pit/);
});
void test('releasing a ground trap resumes flight with feedback', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('flying', 'outside');
    game.u.utrap = 4;
    game.u.utraptype = TT_BEARTRAP;
    refreshMovementProperties();
    assert.equal(game.u.flying, false);
    await resetHeroTrap(true);
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.flying, true);
    assert.match(game._pending_message, /You can fly/);
});
// C spoteffects(): without the terrainstatus option iflags.terrain_typ stays
// MAX_TYPE, so every same-square call reruns switch_terrain() and float_up().
void test('same-terrain spot effects repeat blocked levitation feedback', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_BEARTRAP;
    grantIntrinsicProperty('levitation', 'outside');
    await applyHeroLocationEffects();
    assert.match(game._pending_message, /float up slightly/);
    game._pending_message = '';
    await applyHeroLocationEffects();
    assert.match(game._pending_message, /float up slightly/);
    assert.equal(game.u.utrap, 4);
});
//# sourceMappingURL=terrain_movement.test.js.map