import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishEnvironmentalMonsterDeath } from '../js/mon.js';
import { monsterAtPosition, placeMonsterAt } from '../js/monster_location.js';
import {
    clearMonsterWormFromMap, initializeMonsterWormBody, removeMonsterWormBody,
} from '../js/monster_worm.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { assertWormBody } from './support/worms.js';
import { migrateMonsterOffLevel, prepareMonsterDeparture } from '../js/dog.js';

async function placedWorm(segmentCount: number) {
    await freshObjectRoom({ left: 7, right: 25, top: 6, bottom: 14, heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10,
        MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    await initializeMonsterWormBody(worm, { segmentCount });
    assertWormBody(worm);
    assert.equal(worm.wormSegments.length, segmentCount);
    const squares = [{ x: worm.mx, y: worm.my },
        ...worm.wormSegments.map(({ x, y }) => ({ x, y }))];
    for (const { x, y } of squares) {
        await newsym(x, y);
        assert.equal(monsterAtPosition(game.level, x, y), worm);
        assert.equal(glyphAt(x, y)?.kind, 'monster');
    }
    return { worm, squares };
}

for (const segmentCount of [0, 3]) {
    for (const removal of ['relocation', 'discard']) {
        void test(`${removal} removes a worm with ${segmentCount} tail segments from the map while retaining its coordinates`, async () => {
            const { worm, squares } = await placedWorm(segmentCount);
            requirePlayingGame(game);
            const head = { x: worm.mx, y: worm.my };

            if (removal === 'relocation') await clearMonsterWormFromMap(worm);
            else await removeMonsterWormBody(worm);

            assert.ok(game.level.monsters.includes(worm), 'Removal keeps the monster in the level chain.');
            assert.deepEqual({ x: worm.mx, y: worm.my }, head);
            for (const { x, y } of squares) {
                assert.equal(monsterAtPosition(game.level, x, y), null, `Removed square ${x},${y} is vacant.`);
                await newsym(x, y);
                assert.notEqual(glyphAt(x, y)?.kind, 'monster', `Redrawing ${x},${y} keeps it vacant.`);
            }
        });
    }

    void test(`discarding an already removed ${segmentCount}-segment worm leaves its replacement mapped`, async () => {
        const { worm, squares } = await placedWorm(segmentCount);
        requirePlayingGame(game);
        await clearMonsterWormFromMap(worm);
        const replacement = await createMonsterAt('goblin', worm.mx, worm.my, MM_ANGRY | NO_MINVENT);

        await removeMonsterWormBody(worm);

        assert.equal(monsterAtPosition(game.level, replacement.mx, replacement.my), replacement);
        await newsym(replacement.mx, replacement.my);
        assert.equal(glyphAt(replacement.mx, replacement.my)?.kind, 'monster');
        for (const { x, y } of squares.slice(1))
            assert.equal(monsterAtPosition(game.level, x, y), null);
    });

    void test(`death clears the head and every tail square of a ${segmentCount}-segment worm`, async () => {
        const { worm, squares } = await placedWorm(segmentCount);
        requirePlayingGame(game);

        worm.mhp = 0;
        await finishEnvironmentalMonsterDeath(worm, game);

        for (const { x, y } of squares) {
            assert.equal(monsterAtPosition(game.level, x, y), null, `Death releases ${x},${y}.`);
            await newsym(x, y);
            assert.notEqual(glyphAt(x, y)?.kind, 'monster');
        }
    });

    void test(`level migration clears a ${segmentCount}-segment worm after departure briefly replaces its head`, async () => {
        const { worm, squares } = await placedWorm(segmentCount);
        requirePlayingGame(game);
        await prepareMonsterDeparture(worm, game);
        assert.equal(monsterAtPosition(game.level, worm.mx, worm.my), worm,
            'mon_leave puts the head back before relmon removes it.');

        await migrateMonsterOffLevel(worm, game, { dst: { dnum: 0, dlevel: 9 } });

        for (const { x, y } of squares) {
            assert.equal(monsterAtPosition(game.level, x, y), null, `Migration releases ${x},${y}.`);
            await newsym(x, y);
            assert.notEqual(glyphAt(x, y)?.kind, 'monster');
        }
    });

    void test(`teleport places a removed ${segmentCount}-segment worm back at its unchanged coordinates`, async () => {
        const { worm, squares } = await placedWorm(segmentCount);
        requirePlayingGame(game);
        await clearMonsterWormFromMap(worm);

        await relocateMonsterTo(worm, worm.mx, worm.my);

        assert.equal(monsterAtPosition(game.level, worm.mx, worm.my), worm);
        assert.equal(glyphAt(worm.mx, worm.my)?.kind, 'monster');
        assert.equal(worm.wormSegments.length, segmentCount);
        for (const { x, y } of squares) {
            const occupied: boolean = monsterAtPosition(game.level, x, y) === worm;
            await newsym(x, y);
            assert.equal(glyphAt(x, y)?.kind === 'monster', occupied);
        }
    });
}

void test('placing a discarded worm head does not restore its discarded tail', async () => {
    const { worm, squares } = await placedWorm(3);
    requirePlayingGame(game);
    await removeMonsterWormBody(worm);

    placeMonsterAt(worm, worm.mx, worm.my);
    await newsym(worm.mx, worm.my);

    assert.equal(monsterAtPosition(game.level, worm.mx, worm.my), worm);
    assert.equal(glyphAt(worm.mx, worm.my)?.kind, 'monster');
    for (const { x, y } of squares.slice(1)) {
        assert.equal(monsterAtPosition(game.level, x, y), null);
        assert.notEqual(glyphAt(x, y)?.kind, 'monster');
    }
});

for (const square of ['head', 'tail']) {
    for (const removal of ['relocation', 'discard']) {
        void test(`${removal} clears a replacement occupant at the worm's ${square} square`, async () => {
            const { worm } = await placedWorm(3);
            requirePlayingGame(game);
            const point = square === 'head' ? { x: worm.mx, y: worm.my } : worm.wormSegments[0];
            assert.ok(point);
            const replacement = await createMonsterAt('goblin', 8, 8, MM_ANGRY | NO_MINVENT);
            await answerPrompts(relocateMonsterTo(replacement, point.x, point.y), resetInputState(), [
                { prompt: /placing goblin[\s\S]*over .*long worm[\s\S]*--More--/, keys: ' ' },
                { prompt: /Program in disorder![\s\S]*--More--/, keys: ' ' },
            ]);
            const { x, y } = point;
            assert.equal(monsterAtPosition(game.level, x, y), replacement);

            if (removal === 'relocation') await clearMonsterWormFromMap(worm);
            else await removeMonsterWormBody(worm);

            assert.equal(monsterAtPosition(game.level, x, y), null,
                'Removing a worm clears its segment squares, including an overwritten map slot.');
            assert.notEqual(glyphAt(x, y)?.kind, 'monster', 'Removal immediately redraws the cleared square.');
            assert.ok(game.level.monsters.includes(replacement));
            assert.deepEqual({ x: replacement.mx, y: replacement.my }, { x, y });
        });
    }
}
