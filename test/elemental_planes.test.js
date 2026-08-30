import test from 'node:test';
import assert from 'node:assert/strict';

import { AIR, MAGIC_PORTAL, ROOM, WATER } from '../js/const.js';
import { moveElementalBubbles } from '../js/elemental.js';
import { game } from '../js/gstate.js';
import {
    generateEarthLevel, generateWaterLevel,
} from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { freshSpecialLevel } from './support/special-level.js';

function terrainCount(typ) {
    let count = 0;
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            if (game.level.at(x, y)?.typ === typ) count++;
    return count;
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

test('the Plane of Earth builds its caverns, defenders, and air portal',
    async () => {
        const active = freshSpecialLevel({
            prototype: 'earth', variant: 1, seed: 1901, depth: 5,
        });
        game.earth_level = { ...game.u.uz };
        game.specialLevels = new Map([
            ['air', { dnum: 0, dlevel: 4 }],
        ]);

        await generateEarthLevel(active);

        assert.equal(game.level.flags.noteleport, true);
        assert.equal(game.level.flags.hardfloor, true);
        assert.ok(terrainCount(ROOM) > 150);
        assert.equal(game.level.monsters.length, 62);
        assert.equal(floorObjects().filter(
            object => object.otyp === BOULDER,
        ).length, 1);
        assert.equal(game.level.traps.filter(
            trap => trap.ttyp === MAGIC_PORTAL,
        ).length, 1);

    });

test('the Plane of Water builds moving air bubbles and its Astral portal',
    async () => {
        const active = freshSpecialLevel({
            prototype: 'water', variant: 1, seed: 1907, depth: 2,
        });
        game.water_level = { ...game.u.uz };
        game.specialLevels = new Map([
            ['astral', { dnum: 0, dlevel: 1 }],
        ]);

        await generateWaterLevel(active);

        assert.equal(game.level.flags.waterlevel, true);
        assert.equal(game.level.flags.hero_memory, false);
        assert.ok(terrainCount(WATER) > 1000);
        assert.ok(terrainCount(AIR) > 20);
        assert.ok(game.level.elementalBubbles.length > 5);
        assert.equal(game.level.monsters.length, 60);
        assert.equal(game.level.traps.filter(
            trap => trap.ttyp === MAGIC_PORTAL,
        ).length, 1);

        const bubble = game.level.elementalBubbles[0];
        game.level.elementalBubbles = [bubble];
        game.level.monsters = [];
        bubble.x = 10;
        bubble.y = 5;
        bubble.dx = 1;
        bubble.dy = 0;
        const carriedCell = { x: bubble.x, y: bubble.y };
        const portal = game.level.traps[0];
        portal.tx = carriedCell.x;
        portal.ty = carriedCell.y;
        const carriedObject = {
            otyp: BOULDER, ox: carriedCell.x, oy: carriedCell.y,
            where: 'floor',
        };
        if (!game.level.objects[carriedCell.x])
            game.level.objects[carriedCell.x] = [];
        game.level.objects[carriedCell.x][carriedCell.y] = [carriedObject];
        game.u.ux = carriedCell.x;
        game.u.uy = carriedCell.y;
        const oldBubble = { x: bubble.x, y: bubble.y };

        moveElementalBubbles();

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
