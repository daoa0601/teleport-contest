import assert from 'node:assert/strict';
import test from 'node:test';
import { punishHero } from '../js/punishment.js';
import { moveObject } from '../js/floor_object.js';
import { rhack } from '../js/cmd.js';
import { DB_DIR, DB_EAST, DB_WEST, DRAWBRIDGE_DOWN, MM_ANGRY, MM_NOTAIL, NO_MINVENT, PIT, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { DAGGER } from '../js/object_data.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer } from '../js/object_timers.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { assertWormBody } from './support/worms.js';
void test('#wizfliplevel reflects the active level and its position-dependent effects', async (t) => {
    // C get_level_extends() expands this room to x=7..15, y=7..13.
    const level = freshObjectRoom({ left: 8, right: 14, top: 8, bottom: 12,
        heroX: 9, heroY: 9, flags: { debug: true } });
    requirePlayingGame(game);
    const blade = await floorObject(DAGGER, 9, 10);
    const monster = await createMonsterAt('newt', 10, 11);
    monster.mgoal = { x: 8, y: 12 };
    level.traps.push({ ttyp: PIT, tx: 8, ty: 9, tseen: true, once: false,
        launch: { x: -1, y: -1 }, conjoined: 1 });
    const bridge = level.requireAt(10, 8);
    bridge.typ = DRAWBRIDGE_DOWN;
    bridge.flags = bridge.drawbridgemask = DB_WEST;
    level.regions.push({ kind: 'gas-cloud', visible: true, damage: 1, ttl: 10,
        cells: [{ x: 8, y: 11 }], monsterIds: [], heroInside: false });
    const timer = scheduleLevelTimer(9, 12, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 20);
    assert.ok(timer);
    game._travelTarget = { x: 8, y: 10 };
    const moves = game.moves;
    const input = resetInputState();
    planInput(input, t, [{ prompt: /Flip 0=randomly, 1=vertically, 2=horizontally, 3=both:/, keys: '2' }]);
    input.feed('wizfliplevel\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.uy, 9);
    assert.equal(game.u.ux0, 13);
    assert.equal(blade.ox, 13);
    assert.ok(level.objects[13]?.[10]?.includes(blade));
    assert.equal(monster.mx, 12);
    assert.deepEqual(monster.mgoal, { x: 14, y: 12 });
    assert.equal(level.traps[0]?.tx, 14);
    assert.equal(level.traps[0]?.conjoined, 1 << 4);
    assert.equal((level.requireAt(12, 8).drawbridgemask ?? 0) & DB_DIR, DB_EAST);
    assert.deepEqual(level.regions[0]?.cells, [{ x: 14, y: 11 }]);
    assert.equal(timer.x, 13);
    assert.deepEqual(game._travelTarget, { x: 14, y: 10 });
    assert.equal(game.moves, moves);
    assert.equal(game.context.move, 0);
});
void test('cancelling #wizfliplevel keeps the hero and map in place', async (t) => {
    const level = freshObjectRoom({ flags: { debug: true } });
    const blade = await floorObject(DAGGER, 9, 10);
    const input = resetInputState();
    planInput(input, t, [{ prompt: /Flip 0=randomly/, keys: '\x1b' }]);
    input.feed('wizfliplevel\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.ok(level.objects[9]?.[10]?.includes(blade));
    assert.equal(game._lastPlineMessage, 'Never mind.');
    assert.equal(game.context.move, 0);
});
for (const [axis, expectedX, expectedY, pitDirections] of [
    ['1', 9, 11, 1 << 6],
    ['3', 13, 11, 1 << 2],
]) {
    void test(`#wizfliplevel option ${axis} reflects the hero and pit directions as C does`, async (t) => {
        const level = freshObjectRoom({ left: 8, right: 14, top: 8, bottom: 12,
            heroX: 9, heroY: 9, flags: { debug: true } });
        level.traps.push({ ttyp: PIT, tx: 8, ty: 9, tseen: true, once: false,
            launch: { x: -1, y: -1 }, conjoined: 1 << 2 });
        const input = resetInputState();
        planInput(input, t, [{ prompt: /Flip 0=randomly/, keys: axis }]);
        input.feed('wizfliplevel\n');
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.ux, expectedX);
        assert.equal(game.u.uy, expectedY);
        assert.equal(level.traps[0]?.conjoined, pitDirections);
    });
}
void test('a flip replaces a punishment pair that straddles the flip boundary', async (t) => {
    const level = freshObjectRoom({ left: 8, right: 14, top: 8, bottom: 12,
        heroX: 8, heroY: 10, flags: { debug: true } });
    await punishHero();
    const ball = game.uball;
    const chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 6, 10);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Flip 0=randomly/, keys: '2' },
    ]);
    input.feed('wizfliplevel\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.ux, 14);
    assert.equal(ball.ox, 14);
    assert.equal(chain.ox, 14);
    assert.ok(level.objects[14]?.[10]?.includes(ball));
    assert.ok(level.objects[14]?.[10]?.includes(chain));
    assert.equal(ball, game.uball);
    assert.equal(chain, game.uchain);
});
for (const axis of [1, 2, 3]) {
    void test(`#wizfliplevel option ${axis} transforms a worm without remapping an overwritten segment`, async (t) => {
        // The room's flip area is x=6..26, y=5..15.
        const level = freshObjectRoom({ left: 7, right: 25, top: 6, bottom: 14,
            flags: { debug: true } });
        const worm = await createMonsterAt('long worm', 18, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
        initializeMonsterWormBody(worm, { segmentCount: 3 });
        assertWormBody(worm);
        const overwritten = worm.wormSegments[0];
        assert.ok(overwritten);
        const vacant = { x: overwritten.x, y: overwritten.y };
        const incoming = await createMonsterAt('goblin', 8, 8, MM_ANGRY | NO_MINVENT);
        await answerPrompts(relocateMonsterTo(incoming, vacant.x, vacant.y), resetInputState(), [
            { prompt: /placing goblin[\s\S]*over .*long worm[\s\S]*--More--/, keys: ' ' },
            { prompt: /Program in disorder![\s\S]*--More--/, keys: ' ' },
        ]);
        await relocateMonsterTo(incoming, 8, 8);
        assert.equal(monsterAtPosition(level, vacant.x, vacant.y), null);
        const squares = [{ x: worm.mx, y: worm.my },
            ...worm.wormSegments.slice(1).map(({ x, y }) => ({ x, y }))];
        const health = worm.mhp;
        const deadline = worm.wormGrowTime;
        const moves = game.moves;
        const input = resetInputState();
        planInput(input, t, [{ prompt: /Flip 0=randomly/, keys: String(axis) }]);
        input.feed('wizfliplevel\n');
        await rhack('#'.charCodeAt(0));
        const flipX = (x) => axis & 2 ? 32 - x : x;
        const flipY = (y) => axis & 1 ? 20 - y : y;
        assert.equal(monsterAtPosition(level, flipX(vacant.x), flipY(vacant.y)), null, 'The vacant segment square stays vacant after its map position is flipped.');
        for (const { x, y } of squares)
            assert.equal(monsterAtPosition(level, flipX(x), flipY(y)), worm);
        assert.equal(worm.wormSegments.length, 3);
        assert.equal(worm.mhp, health);
        assert.equal(worm.wormGrowTime, deadline);
        assert.equal(game.moves, moves);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=wizard_flip_level.test.js.map