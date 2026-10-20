import assert from 'node:assert/strict';
import test from 'node:test';
import { IRONBARS, NO_MINVENT, W_NONDIGGABLE } from '../js/const.js';
import { flush_screen, glyphAt, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { castNativeRay } from '../js/ray_attack.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';

for (const [name, type] of [
    ['monster acid breath', -27],
    ['hero acid breath', 27],
    ['monster lightning wand', -35],
    ['hero lightning wand', 5],
    ['monster lightning spell', -15],
    ['hero lightning spell', 15],
    ['monster lightning breath', -25],
    ['hero lightning breath', 25],
] satisfies [string, number][]) {
    void test(`${name} keeps its beam over bars while the preceding hit is acknowledged`, async () => {
        const level = freshObjectRoom({ right: 22, heroY: 12, flags: { verbose: true } });
        game.symset = 'DECgraphics';
        level.requireAt(11, 10).typ = IRONBARS;
        const target = await createMonsterAt('carnivorous ape', 10, 10, NO_MINVENT);
        target.mhp = target.mhpmax = 1000;
        const input = resetInputState();
        installPagerInput(input, { expected: /iron bars|carnivorous ape|bounces/, limit: 10 });
        let sawBarsDuringFlight = false;
        input.beforeRead = () => {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            if (!/carnivorous ape/.test(message) || /iron bars/.test(message)) return;
            assert.equal(requireScreenCell(8, 11).ch, '─',
                'The earlier beam must remain visible while the ray is still in flight');
            assert.equal(requireScreenCell(10, 11).ch, '─',
                'The ray reaches the bars before their message pages the preceding hit');
            sawBarsDuringFlight = true;
        };
        await plineWithContinuation('You attack.');

        await castNativeRay(type, 1, 'l', {
            originX: 8, originY: 10,
            random: bound => bound === 10 ? 0 : bound - 1,
            rollDice: () => 1, rollOne: () => 1,
        });
        await flush_screen(1);

        assert.equal(sawBarsDuringFlight, true, 'The preceding hit must reach the pager at the bars');
        assert.notEqual(level.requireAt(11, 10).typ, IRONBARS);
        assert.notEqual(requireScreenCell(8, 11).ch, '─', 'The completed ray restores its trail');
    });
}

for (const kind of ['acid', 'lightning'] satisfies ('acid' | 'lightning')[]) {
    void test(`repeated ${kind} contact with indestructible bars announces their resistance once`, async () => {
        const level = freshObjectRoom();
        const bars = level.requireAt(11, 10);
        bars.typ = IRONBARS;
        bars.wall_info = W_NONDIGGABLE;
        resetInputState().beforeRead = () => {
            assert.fail('Repeating the bar message must not open a second pager');
        };

        await applyRayFloorFeatures(kind, 11, 10, game, { random: () => 0 });
        await applyRayFloorFeatures(kind, 11, 10, game, { random: () => 0 });
        await flush_screen(1);

        const action = kind === 'acid' ? 'corrode' : 'melt';
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(),
            `The iron bars ${action} somewhat but remain intact.`);
        assert.equal(bars.typ, IRONBARS);
    });
}

void test('a bouncing breath redraws its trail across the hero, dissolved bars, and the breather', async () => {
    const level = freshObjectRoom({ right: 12 });
    game.symset = 'DECgraphics';
    level.requireAt(11, 10).typ = IRONBARS;
    await createMonsterAt('yellow dragon', 9, 10, NO_MINVENT);
    installPagerInput(resetInputState(), {
        expected: /iron bars|whizzes by you|bounces|yellow dragon/, limit: 10,
    });
    let sawReturn = false;
    game.animationFrame = async () => {
        if (glyphAt(9, 10)?.kind !== 'effect') return;
        assert.equal(requireScreenCell(9, 11).ch, '─', 'The returning ray crosses the hero');
        assert.equal(requireScreenCell(10, 11).ch, '─', 'Dissolved bars now retain a beam');
        sawReturn = true;
    };

    await castNativeRay(-27, 1, 'l', {
        originX: 9, originY: 10, forceMiss: true,
        random: bound => bound - 1,
    });
    await flush_screen(1);

    assert.equal(sawReturn, true, 'The breath must return through its own source square');
    assert.equal(requireScreenCell(8, 11).ch, 'D');
    assert.equal(requireScreenCell(9, 11).ch, '@');
    assert.notEqual(requireScreenCell(10, 11).ch, '─');
});

void test('a lightning ray missing a blind elemental hero tingles in its body part', async () => {
    freshObjectRoom({ right: 22 });
    game.u.umonnum = MONSTER_NAME.indexOf('fire elemental');
    game.u.blindTurns = 20;
    const messages: string[] = [];

    await castNativeRay(-5, 6, 'l', {
        originX: game.u.ux - 3, originY: game.u.uy, forceMiss: true,
        publish: async (message: string) => { messages.push(message); },
    });

    assert.ok(messages.includes('Your region tingles.'), messages.join(' | '));
});
