import test from 'node:test';
import assert from 'node:assert/strict';
import { farlookLocationDescription } from '../js/cmd.js';
import { ICE, LAVAPOOL, LAVAWALL, MOAT, POOL, ROOM, WATER } from '../js/const.js';
import { game } from '../js/gstate.js';
import { newsym } from '../js/display.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
for (const remembered of [false, true]) {
    void test(`farlook describes ${remembered ? 'remembered' : 'visible'} lava`, async () => {
        const level = freshObjectRoom();
        const location = level.requireAt(11, 10);
        location.typ = LAVAPOOL;
        newsym(11, 10);
        if (remembered) {
            await makeBlinded(10, { talk: false });
            vision_recalc(0);
        }
        const description = farlookLocationDescription(11, 10);
        assert.equal(description, 'molten lava');
    });
}
void test('a remembered liquid glyph uses the current surface description', async () => {
    const level = freshObjectRoom();
    const location = level.requireAt(11, 10);
    location.typ = LAVAPOOL;
    newsym(11, 10);
    await makeBlinded(10, { talk: false });
    vision_recalc(0);
    location.typ = ROOM;
    assert.equal(farlookLocationDescription(11, 10), 'water');
});
for (const [terrain, description] of [
    [POOL, 'pool of water'], [MOAT, 'moat'], [WATER, 'wall of water'],
    [LAVAWALL, 'wall of lava'], [ICE, 'ice'],
]) {
    void test(`farlook describes ${description}`, () => {
        const level = freshObjectRoom();
        level.requireAt(11, 10).typ = terrain;
        newsym(11, 10);
        assert.equal(farlookLocationDescription(11, 10), description);
    });
}
void test('farlook describes Medusa moat as a shallow sea', () => {
    const level = freshObjectRoom();
    game.medusa_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
    level.requireAt(11, 10).typ = MOAT;
    newsym(11, 10);
    assert.equal(farlookLocationDescription(11, 10), 'shallow sea');
});
void test('farlook hallucinates the liquid in visible lava', () => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 30 } });
    level.requireAt(11, 10).typ = LAVAPOOL;
    newsym(11, 10);
    const descriptions = new Set(Array.from({ length: 20 }, () => farlookLocationDescription(11, 10)));
    assert.ok(descriptions.size > 1, 'hallucination changes the perceived liquid');
    for (const description of descriptions)
        assert.match(description, /^molten /);
});
//# sourceMappingURL=farlook_terrain.test.js.map