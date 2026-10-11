import { floorObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { createSpecialLevel } from './support/topology.js';
import type { ElementalBubble } from '../js/map_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AIR, ALTAR, AM_SANCTUM, MAGIC_PORTAL, ROOM, WATER,
} from '../js/const.js';
import { moveElementalBubbles } from '../js/elemental.js';
import { requireGameLevel, game } from '../js/gstate.js';
import {
    generateAstralLevel, generateEarthLevel, generateWaterLevel,
} from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER } from '../js/object_data.js';
import { countTerrain, floorObjects } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';

function firstBubbleCell(bubble: ElementalBubble) {
    for (let dy = 0; dy < bubble.height; dy++) {
        for (let dx = 0; dx < bubble.width; dx++) {
            if ((bubble.rows[dy] ?? 0) & (1 << dx))
                return { x: bubble.x + dx, y: bubble.y + dy };
        }
    }
    throw new Error('bubble has no occupied cells');
}

void test('the Astral Plane builds three sanctums and all three Riders', async () => {
    const active = freshSpecialLevel({
        prototype: 'astral', variant: 1, seed: 1913, depth: 1,
    });
    requireFixtureGame(game);
    game.astral_level = createSpecialLevel({ ...game.u.uz });
    game.u.ualign.type = 1;
    game.urole = { ...game.urole, gods: {
        lawful: 'Tyr', neutral: 'Odin', chaotic: 'Loki',
    } };

    await generateAstralLevel(active);

    assert.equal(requireGameLevel(game).flags.noteleport, true);
    assert.equal(requireGameLevel(game).flags.nommap, true);
    assert.equal(countTerrain(game.level, ALTAR), 3);
    const sanctums = [];
    for (let x = 1; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            const loc = requireGameLevel(game).requireAt(x, y);
            if (loc?.typ === ALTAR && (loc.flags & AM_SANCTUM))
                sanctums.push({ x, y });
        }
    }
    assert.equal(sanctums.length, 3);
    const riders = new Set(['Death', 'Pestilence', 'Famine']);
    assert.deepEqual(new Set(requireGameLevel(game).monsters
        .map(monster => MONSTER_NAME[monster.mnum])
        .filter(name => name !== undefined && riders.has(name))), riders);
    assert.ok(requireGameLevel(game).monsters.length >= 69);
});

void test('the Plane of Earth builds its caverns, defenders, and air portal',
    async () => {
        const active = freshSpecialLevel({
            prototype: 'earth', variant: 1, seed: 1901, depth: 5,
        });
        requireFixtureGame(game);
        game.earth_level = createSpecialLevel({ ...game.u.uz });
        game.specialLevels = new Map([
            ['air', createSpecialLevel({ dnum: 0, dlevel: 4 })],
        ]);

        await generateEarthLevel(active);

        assert.equal(requireGameLevel(game).flags.noteleport, true);
        assert.equal(requireGameLevel(game).flags.hardfloor, true);
        assert.ok(countTerrain(game.level, ROOM) > 150);
        assert.equal(requireGameLevel(game).monsters.length, 62);
        assert.equal(floorObjects(game.level).filter(
            object => object.otyp === BOULDER,
        ).length, 1);
        assert.equal(requireGameLevel(game).traps.filter(
            trap => trap.ttyp === MAGIC_PORTAL,
        ).length, 1);

    });

void test('the Plane of Water builds moving air bubbles and its Astral portal',
    async () => {
        const active = freshSpecialLevel({
            prototype: 'water', variant: 1, seed: 1907, depth: 2,
        });
        requireFixtureGame(game);
        game.water_level = createSpecialLevel({ ...game.u.uz });
        game.specialLevels = new Map([
            ['astral', createSpecialLevel({ dnum: 0, dlevel: 1 })],
        ]);

        await generateWaterLevel(active);

        assert.equal(requireGameLevel(game).flags.waterlevel, true);
        assert.equal(requireGameLevel(game).flags.hero_memory, false);
        assert.ok(countTerrain(game.level, WATER) > 1000);
        assert.ok(countTerrain(game.level, AIR) > 20);
        const bubbles = game.level.elementalBubbles;
        assert.ok(bubbles && bubbles.length > 5);
        assert.equal(requireGameLevel(game).monsters.length, 60);
        assert.equal(requireGameLevel(game).traps.filter(
            trap => trap.ttyp === MAGIC_PORTAL,
        ).length, 1);

        const bubble = bubbles[0];
        assert.ok(bubble);
        requireGameLevel(game).elementalBubbles = [bubble];
        requireGameLevel(game).monsters = [];
        bubble.x = 10;
        bubble.y = 5;
        bubble.dx = 1;
        bubble.dy = 0;
        const carriedCell = firstBubbleCell(bubble);
        const portal = game.level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        assert.ok(portal);
        portal.tx = carriedCell.x;
        portal.ty = carriedCell.y;
        const carriedObject = await floorObject(BOULDER, carriedCell.x, carriedCell.y);
        game.u.ux = carriedCell.x;
        game.u.uy = carriedCell.y;
        const oldBubble = { x: bubble.x, y: bubble.y };

        await moveElementalBubbles();

        const dx = bubble.x - oldBubble.x;
        const dy = bubble.y - oldBubble.y;
        assert.deepEqual(
            { x: game.u.ux, y: game.u.uy },
            { x: carriedCell.x + dx, y: carriedCell.y + dy },
        );
        assert.deepEqual(
            { x: portal.tx, y: portal.ty },
            { x: carriedCell.x + dx, y: carriedCell.y + dy },
        );
        assert.deepEqual(
            { x: carriedObject.ox, y: carriedObject.oy },
            { x: carriedCell.x + dx, y: carriedCell.y + dy },
        );
    });
