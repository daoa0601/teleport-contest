import assert from 'node:assert/strict';
import test from 'node:test';
import { COLNO, LAVAPOOL, ROWNO } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { fumaroles } from '../js/monmove.js';
import { runLevelRegions } from '../js/regions.js';
import { freshObjectRoom } from './support/object-room.js';
void test('natural lava clouds do not blame the hero outside level generation or monster movement', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    level.flags.temperature = 1;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).typ = LAVAPOOL;
    }
    pushKeys(' '.repeat(20));
    await fumaroles(game);
    assert.ok(level.regions.length > 0, 'a hot lava level must produce a cloud');
    for (const cloud of level.regions)
        assert.equal(cloud.heroFault, false);
});
void test('a fumarole leaves damaging gas which hurts a breathing occupant on the next region turn', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n });
    requirePlayingGame(game);
    level.flags.temperature = 1;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).typ = LAVAPOOL;
    }
    pushKeys(' '.repeat(20));
    await fumaroles(game);
    const cloud = level.regions[0];
    assert.ok(cloud, 'the hot lava level must produce a fumarole');
    const cell = cloud.cells[0];
    assert.ok(cell);
    game.u.ux = cell.x;
    game.u.uy = cell.y;
    const hp = game.u.uhp;
    await runLevelRegions(game, { publish: async () => { } });
    assert.ok(game.u.uhp < hp, 'the fumarole must injure a breathing hero');
    assert.ok(cloud.damage >= 5 && cloud.damage <= 14, `fumarole damage ${cloud.damage} must be 5..14`);
    assert.equal(cloud.heroFault, false);
});
for (const deaf of [false, true]) {
    void test(`distant fumaroles ${deaf ? 'stay silent for a deaf hero' : 'announce a whoosh only once'}`, async () => {
        const level = freshObjectRoom({ gameplaySeed: 1n, heroX: 1, heroY: 0,
            hero: { deafTurns: deaf ? 100 : 0 } });
        requirePlayingGame(game);
        level.flags.temperature = 1;
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++)
                level.requireAt(x, y).typ = LAVAPOOL;
        }
        pushKeys(' '.repeat(20));
        await fumaroles(game);
        assert.equal(level.regions.length > 0, true);
        assert.equal(game._pending_message || '', deaf ? '' : 'You hear a whoosh!');
        if (!deaf) {
            await fumaroles(game);
            assert.equal(game._pending_message, 'You hear a whoosh!', 'consecutive identical whooshes are suppressed');
        }
    });
}
void test('a nearby fumarole announces a loud whoosh', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n, heroX: 40, heroY: 10 });
    requirePlayingGame(game);
    level.flags.temperature = 1;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).typ = LAVAPOOL;
    }
    pushKeys(' '.repeat(200));
    for (let attempt = 0; attempt < 100 && game._lastPlineMessage !== 'You hear a loud whoosh!'; attempt++)
        await fumaroles(game);
    assert.equal(game._lastPlineMessage, 'You hear a loud whoosh!');
});
//# sourceMappingURL=fumaroles.test.js.map