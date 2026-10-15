import assert from 'node:assert/strict';
import test from 'node:test';

import { AIR, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { surfaceName } from '../js/terrain_name.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';

for (const { below, surface } of [
    { below: DB_ICE, surface: 'ice' },
    { below: DB_LAVA, surface: 'lava' },
    { below: DB_MOAT, surface: 'water' },
    { below: DB_FLOOR, surface: 'ground' },
]) {
    void test(`a raised drawbridge exposes a ${surface} writing surface`, () => {
        const level = freshObjectRoom();
        const square = level.requireAt(10, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = below;

        assert.equal(surfaceName(10, 10), surface);
    });
}

for (const { species, surface } of [
    { species: 'purple worm', surface: 'maw' },
    { species: 'trapper', surface: 'husk' },
]) {
    void test(`the surface around a hero engulfed by a ${species} is its ${surface}`, async () => {
        freshObjectRoom();
        const engulfer = await createMonsterAt(species, 11, 10);
        await installSwallowedHero(engulfer);

        assert.equal(surfaceName(10, 10), surface);
        assert.equal(surfaceName(11, 10), 'floor');
    });
}

void test('air on the Plane of Water is an air bubble and its water has no bottom', () => {
    const level = freshObjectRoom({ hero: { uinwater: true } });
    game.water_level = createSpecialLevel({ dnum: 4, dlevel: 1 });
    game.u.uz = { dnum: 4, dlevel: 1 };
    level.requireAt(10, 10).typ = AIR;
    level.requireAt(11, 10).typ = POOL;

    assert.equal(surfaceName(10, 10), 'air bubble');
    assert.equal(surfaceName(11, 10), 'water');
});

void test('hallucinating changes the perceived liquid surface', () => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    level.requireAt(10, 10).typ = POOL;

    const names = Array.from({ length: 20 }, () => surfaceName(10, 10));

    assert.ok(names.some(name => name !== 'water'), 'water can look like another liquid');
});
