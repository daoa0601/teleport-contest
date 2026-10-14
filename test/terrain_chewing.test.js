import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { CORR, DOOR, D_CLOSED, D_BROKEN, D_NODOOR, ROOM, STONE, TREE, VWALL, W_NONDIGGABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
for (const terrain of [STONE, TREE, VWALL, DOOR]) {
    void test(`a rock mole chews through terrain ${terrain} before entering it`, async () => {
        const level = freshObjectRoom();
        installPolymorphedHero('rock mole');
        const target = level.requireAt(11, 10);
        target.typ = terrain;
        if (terrain === DOOR)
            target.doormask = D_CLOSED;
        pushKeys(' '.repeat(20));
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, 10);
        assert.equal(game.context.digging?.chew, true);
        const attempts = terrain === STONE || terrain === VWALL ? 4 : 3;
        for (let attempt = 1; attempt < attempts; attempt++)
            await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, 11);
        assert.equal(target.typ, terrain === STONE ? CORR : terrain === TREE ? ROOM : DOOR);
        if (terrain === VWALL)
            assert.equal(target.doormask, D_NODOOR);
        if (terrain === DOOR)
            assert.equal(target.doormask, D_BROKEN);
        assert.equal(game.u.uconduct?.food, 1);
    });
}
void test('a rock mole eats a floor boulder instead of pushing it', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('rock mole');
    const boulder = await floorObject(BOULDER, 11, 10);
    pushKeys(' '.repeat(20));
    for (let attempt = 0; attempt < 3; attempt++)
        await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(boulder.where, 'gone');
    assert.equal(level.objects[12]?.[10]?.includes(boulder) ?? false, false);
    assert.equal(game.u.uconduct?.food, 1);
});
void test('a tunnelling form hurts its teeth on undiggable stone', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('rock mole');
    const target = level.requireAt(11, 10);
    target.typ = STONE;
    target.wall_info |= W_NONDIGGABLE;
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'You hurt your teeth on the hard stone.');
});
//# sourceMappingURL=terrain_chewing.test.js.map