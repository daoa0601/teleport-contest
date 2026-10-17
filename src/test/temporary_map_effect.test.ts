import assert from 'node:assert/strict';
import test from 'node:test';
import { paintGetposCursor } from '../js/getpos.js';
import { flush_screen, shieldGlyph } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { TemporaryMapEffect } from '../js/temporary_map_effect.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('valid-location marking stops at the native temporary glyph capacity', async () => {
    freshObjectRoom({ left: 1, right: 79, top: 0, bottom: 20 });
    game.symset = 'ASCII';
    const spots: { x: number; y: number }[] = [];
    for (let y = 0; y < 21; y++)
        for (let x = 1; x < 80; x++)
            if (cansee(x, y)) spots.push({ x, y });
    const first = spots[0];
    const beyondCapacity = spots[160];
    assert.ok(first && beyondCapacity, 'the open room must contain more than 160 visible squares');

    await paintGetposCursor({ x: 10, y: 10 }, '', spots.slice(0, 161));

    assert.equal(requireScreenCell(first.x - 1, first.y + 1).ch, '$');
    assert.equal(requireScreenCell(beyondCapacity.x - 1, beyondCapacity.y + 1).ch, '.');
});

for (const style of ['beam', 'all'] satisfies ('beam' | 'all')[]) {
    void test(`a temporary ${style} ${style === 'beam' ? 'hides' : 'shows'} its glyph outside sight`, async () => {
        freshObjectRoom();
        setHeroBlindnessTurns(10);
        vision_recalc(0);
        const effect = new TemporaryMapEffect(style, shieldGlyph('*'));
        await effect.start();

        await effect.show(11, 10);

        assert.equal(requireScreenCell(10, 11).ch === '*', style === 'all');
        await effect.end();
        await flush_screen(1);
        assert.notEqual(requireScreenCell(10, 11).ch, '*');
    });
}

void test('a flash restores its visible old position when the next position is hidden', async () => {
    freshObjectRoom();
    const effect = new TemporaryMapEffect('flash', shieldGlyph('*'));
    await effect.start();
    await effect.show(11, 10);
    assert.equal(requireScreenCell(10, 11).ch, '*');
    setHeroBlindnessTurns(10);
    vision_recalc(0);

    await effect.show(12, 10);
    await flush_screen(1);

    assert.notEqual(requireScreenCell(10, 11).ch, '*');
    assert.notEqual(requireScreenCell(11, 11).ch, '*');
    await effect.end();
});

void test('an always-visible flash restores its last square before showing the next one', async () => {
    freshObjectRoom();
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    const effect = new TemporaryMapEffect('always', shieldGlyph('*'));
    await effect.start();
    await effect.show(11, 10);

    await effect.show(12, 10);

    assert.notEqual(requireScreenCell(10, 11).ch, '*');
    assert.equal(requireScreenCell(11, 11).ch, '*');
    await effect.end();
});

void test('changing a beam glyph affects later squares while retaining earlier squares', async () => {
    freshObjectRoom();
    const effect = new TemporaryMapEffect('beam', shieldGlyph('*'));
    await effect.start();
    await effect.show(11, 10);

    effect.changeGlyph(shieldGlyph('@'));
    await effect.show(12, 10);

    assert.equal(requireScreenCell(10, 11).ch, '*');
    assert.equal(requireScreenCell(11, 11).ch, '@');
    await effect.end();
});

void test('a returning tether restores the far end before moving its object toward the hero', async () => {
    freshObjectRoom();
    const effect = new TemporaryMapEffect('tether', shieldGlyph('*'));
    await effect.start();
    for (const x of [11, 12, 13]) await effect.show(x, 10);
    const returnPositions: number[] = [];
    game.animationFrame = async () => {
        const x = [11, 12, 13].find(column => requireScreenCell(column - 1, 11).ch === '*');
        assert.ok(x);
        returnPositions.push(x);
        for (let beyond = x + 1; beyond <= 13; beyond++)
            assert.equal(requireScreenCell(beyond - 1, 11).ch, '.');
    };

    await effect.end(true);
    await flush_screen(1);

    assert.deepEqual(returnPositions, [12, 11]);
    assert.equal(requireScreenCell(10, 11).ch, '.');
});

void test('ending an inner effect preserves the outer effect at its other saved positions', async () => {
    freshObjectRoom();
    const outer = new TemporaryMapEffect('beam', shieldGlyph('*'));
    await outer.start();
    await outer.show(11, 10);
    const inner = new TemporaryMapEffect('flash', shieldGlyph('@'));
    await inner.start();
    await inner.show(12, 10);

    await inner.end();
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '*');
    assert.equal(requireScreenCell(11, 11).ch, '.');
    await outer.end();
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '.');
});
