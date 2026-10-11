import { requireScreenCell } from './support/screen.js';
import { memoryStorage } from './support/memory-storage.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CORR, LADDER, LA_DOWN, LA_UP, ROOM, STAIRS } from '../js/const.js';
import { flush_screen, glyphAt, newsym, terrain_glyph } from '../js/display.js';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { CLR_BROWN, CLR_GRAY, CLR_YELLOW } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';

for (const seed of [1, 7, 19]) {
    void test(`leaving a generated entrance reveals its upstairs direction (${seed})`, async () => {
        const engine = await runSegment({
            seed,
            datetime: '20020515210000',
            nethackrc: 'OPTIONS=name:Walker,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!news,!autopickup,pettype:none',
            moves: '', storage: memoryStorage(),
        });
        requirePlayingGame(game);
        const currentLevel = game.level;
        const x = game.u.ux, y = game.u.uy;
        const entrance = currentLevel.requireAt(x, y);
        assert.equal(entrance.typ, STAIRS);
        assert.equal(entrance.ladder, LA_UP);
        const directions = [['h', -1, 0], ['j', 0, 1], ['k', 0, -1], ['l', 1, 0]] as const;
        const step = directions
            .find(([, dx, dy]) => {
                const tx = x + dx, ty = y + dy;
                return [ROOM, CORR].includes(currentLevel.at(tx, ty)?.typ ?? -1)
                    && !currentLevel.monsters.some(monster => monster.mx === tx && monster.my === ty)
                    && !currentLevel.traps.some(trap => trap.tx === tx && trap.ty === ty);
            });
        assert.ok(step, 'the generated entrance has an unoccupied adjacent floor');

        engine.inputGate.feed(`m${step[0]}`);
        await engine.runUntilInputNeeded();

        assert.deepEqual([game.u.ux, game.u.uy], [x + step[1], y + step[2]]);
        const entranceGlyph = glyphAt(x, y);
        assert.ok(entranceGlyph?.kind === 'terrain');
        assert.equal(entranceGlyph.terrainName, 'branch staircase up');
        assert.equal(requireScreenCell(x - 1, y + 1).ch, '<');
    });
}

for (const [type, noun, ordinaryColor] of [
    [STAIRS, 'staircase', CLR_GRAY], [LADDER, 'ladder', CLR_BROWN],
] as const) {
    for (const [direction, flags, symbol] of [['up', LA_UP, '<'], ['down', LA_DOWN, '>']] as const) {
        void test(`${noun} ${direction} uses its terrain direction and known branch appearance`, async () => {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            const location = level.requireAt(11, 10);
            location.typ = type;
            location.ladder = flags;
            // Ordinary-stair coordinates belong to other stairs on this level.
            level.upstair = { x: 14, y: 10 };
            game.stairs = { sx: 11, sy: 10, up: direction === 'up',
                isladder: type === LADDER, tolev: { dnum: 1, dlevel: 1 },
                u_traversed: false, next: null };

            newsym(11, 10);
            await flush_screen(1);
            const ordinary = terrain_glyph(location, 11, 10);
            assert.equal(ordinary.ch, symbol);
            assert.equal(ordinary.color, ordinaryColor);
            assert.equal(ordinary.terrainName, `${noun} ${direction}`);

            game.stairs.u_traversed = true;
            newsym(11, 10);
            await flush_screen(1);
            const branch = terrain_glyph(location, 11, 10);
            assert.equal(branch.ch, symbol);
            assert.equal(branch.color, CLR_YELLOW);
            assert.equal(branch.terrainName, `branch ${noun} ${direction}`);
            assert.equal(requireScreenCell(10, 11).ch, symbol);
        });
    }
}
