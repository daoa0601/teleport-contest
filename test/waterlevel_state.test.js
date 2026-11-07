import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { POOL } from '../js/const.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { goodPosition } from '../js/teleport.js';
import { createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
// C teleport.c:goodpos(): the water branch rejects a non-swimming flyer over
// a pool when Is_waterlevel(&u.uz) holds, because water on the Plane of Water
// has no surface to fly above. The port's Is_waterlevel() must read the
// supplied state's own branch bookkeeping (state-threaded like every other
// field the caller passes), not only the global game's water_level.
void test('a flyer cannot perch above a pool when the supplied state is the Plane of Water', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    const bat = await createMonsterAt('bat', 12, 10);
    const subject = { kind: 'monster', monster: bat };
    game.level.requireAt(12, 10).typ = POOL;
    // An ordinary level: the pool has a surface, so the flyer may hover there.
    assert.equal(goodPosition(12, 10, subject), true);
    // The same topology read through a state whose bookkeeping marks it as
    // the Plane of Water: no surface, so the flyer is rejected.
    const waterState = { ...game, water_level: createSpecialLevel(game.u.uz) };
    assert.equal(goodPosition(12, 10, subject, { state: waterState }), false);
});
// The hero branch of the same C test (teleport.c:141-144): levitation carries
// the hero over an ordinary pool, but on the Plane of Water it grants no
// surface either.
void test('a levitating hero is not placed over a pool on the Plane of Water', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(12, 10).typ = POOL;
    grantIntrinsicProperty('levitation', 'outside');
    assert.equal(goodPosition(12, 10, { kind: 'hero' }), true);
    const waterState = { ...game, water_level: createSpecialLevel(game.u.uz) };
    assert.equal(goodPosition(12, 10, { kind: 'hero' }, { state: waterState }), false);
});
//# sourceMappingURL=waterlevel_state.test.js.map