import test from 'node:test';
import assert from 'node:assert/strict';

import { AIR, CLOUD } from '../js/const.js';
import { moveElementalBubbles } from '../js/elemental.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { generateWaterLevel } from '../js/mkmaze.js';
import { cansee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshSpecialLevel } from './support/special-level.js';
import { createSpecialLevel } from './support/topology.js';

// mkmaze.c movebubbles() and mv_bubble() keep the vision blocker table in
// step with the drifting clouds through vision.c block_point()/unblock_point()
// (fill_point()/dig_point()), cell by cell.  The Plane of Air resets every
// square to air and then re-fills the clouds each turn, and those incremental
// pointer updates are not equivalent to rebuilding the table from the final
// terrain: sight through a gap the clouds just opened (or closed) follows the
// maintained table, not the rebuilt one.
void test('Plane of Air sight through drifting clouds follows the maintained blocker table',
    async () => {
        const active = freshSpecialLevel({
            prototype: 'water', variant: 1, seed: 1, depth: 2,
        });
        requireFixtureGame(game);
        game.water_level = createSpecialLevel({ ...game.u.uz });
        game.specialLevels = new Map([
            ['astral', createSpecialLevel({ dnum: 0, dlevel: 1 })],
        ]);
        await generateWaterLevel(active);

        // Treat the level as the Plane of Air: the whole plane is air with
        // the listed clouds, and the hero watches from the right edge.
        game.water_level = undefined;
        game.air_level = createSpecialLevel({ ...game.u.uz });
        game.u.ux = 79;
        game.u.uy = 1;
        const level = requireGameLevel(game);
        level.flags.hero_memory = false;
        level.elementalBubbles = [
            { x: 70, y: 3, dx: 0, dy: 0, width: 5, height: 3, rows: [0xe, 0x1f, 0xe], contents: [] },
            { x: 73, y: 6, dx: 0, dy: 0, width: 5, height: 3, rows: [0xe, 0x1f, 0xe], contents: [] },
            { x: 68, y: 10, dx: 0, dy: 0, width: 6, height: 4, rows: [0x1e, 0x3f, 0x3f, 0x1e], contents: [] },
        ];
        game.in_mklev = false;
        vision_reset_new_level();

        await moveElementalBubbles();
        await vision_recalc(0);

        // The turn reset the plane to air and redrew the clouds; the hero
        // still stands on clear air with the own square in sight.
        assert.equal(level.requireAt(79, 1).typ, AIR);
        assert.equal(cansee(79, 1), true);
        assert.equal(level.requireAt(78, 5).typ, AIR);

        // Clouds line the corridor from the hero down the right edge.  The
        // maintained table keeps the diagonal gap at (78,5) visible; a table
        // rebuilt from this terrain would close it.
        assert.equal(cansee(78, 5), true);
        // Behind the next cloud the plane stays hidden, both ways.
        assert.equal(level.requireAt(76, 6).typ, CLOUD);
        assert.equal(cansee(76, 6), false);
    });
