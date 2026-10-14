import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_LAWFUL, D_LOCKED, D_TRAPPED, DOOR, FOUNTAIN, HWALL, PIT } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a wizard terrain wish can make a blessed looted fountain', async () => {
    freshObjectRoom();
    const result = await readObjectName('blessed looted fountain', { wizardWish: true });
    assert.ok(result?.noWish, 'Terrain creation should complete without an inventory object');
    const fountain = requireGameLevel().requireAt(game.u.ux, game.u.uy);
    assert.equal(fountain.typ, FOUNTAIN);
    assert.equal(!!fountain.blessedftn, true);
    assert.equal(fountain.looted, 1);
    assert.equal(requireGameLevel().flags.nfountains, 1);
});
void test('a wizard terrain wish can create a pit at the hero location', async () => {
    freshObjectRoom();
    const result = await readObjectName('pit', { wizardWish: true });
    assert.ok(result?.noWish);
    assert.ok(requireGameLevel().traps.some(trap => trap.tx === game.u.ux
        && trap.ty === game.u.uy && trap.ttyp === PIT));
});
void test('a door wish keeps its wall orientation and requested trap and lock', async () => {
    freshObjectRoom();
    const location = requireGameLevel().requireAt(game.u.ux, game.u.uy);
    location.typ = HWALL;
    location.horizontal = true;
    const result = await readObjectName('trapped locked door', { wizardWish: true });
    assert.ok(result?.noWish);
    assert.equal(location.typ, DOOR);
    assert.equal(location.horizontal, true);
    assert.equal(location.doormask, D_LOCKED | D_TRAPPED);
});
void test('an altar wish honors an explicit alignment', async () => {
    freshObjectRoom();
    const result = await readObjectName('lawful altar', { wizardWish: true });
    assert.ok(result?.noWish);
    const altar = requireGameLevel().requireAt(game.u.ux, game.u.uy);
    assert.equal(altar.typ, ALTAR);
    assert.equal(altar.altarmask, AM_LAWFUL);
});
//# sourceMappingURL=wish_terrain.test.js.map