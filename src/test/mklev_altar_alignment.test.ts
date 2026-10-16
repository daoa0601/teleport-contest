import assert from 'node:assert/strict';
import test from 'node:test';

import { ALTAR, AM_SHRINE, Amask2align, OROOM } from '../js/const.js';
import { terrain_glyph } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { mapFeatureDescription } from '../js/pager_features.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('ordinary altars retain their generated alignment when placed on Lua-initialized floor', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 12 };
    game.specialLevels?.clear();
    game.branches = [];
    await lua.executeAsync(`
        function pre_themerooms_generate()
            des.level_init({ style = "solidfill", fg = " " })
        end
        themerooms = {{ frequency = 1, contents = function()
            des.room({ lit = 1, filled = 1 })
        end }}
        function post_level_generate() end
    `);
    let altars = 0;
    for (let seed = 1; seed <= 128; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        for (const room of level.rooms.filter(isRoom).filter(room => room.rtype === OROOM)) {
            for (let x = room.lx; x <= room.hx; x++) {
                for (let y = room.ly; y <= room.hy; y++) {
                    const location = level.requireAt(x, y);
                    if (location.typ !== ALTAR) continue;
                    altars++;
                    const alignment = Amask2align(location.flags);
                    const name = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
                    assert.equal(location.flags & AM_SHRINE, 0, 'an ordinary altar is not a shrine');
                    assert.equal(mapFeatureDescription(x, y, terrain_glyph(location, x, y)), `${name} altar`,
                        `the visible altar must describe its generated alignment (seed ${seed})`);
                }
            }
        }
    }
    assert.ok(altars > 0, 'the generated rooms must exercise ordinary altar placement');
});

void test('Lua temple shrines describe their alignment on initialized floor', async t => {
    const lua = await roomBindings(t);
    await lua.executeAsync(`
        function pre_themerooms_generate()
            des.level_init({ style = "solidfill", fg = " " })
        end
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "temple", w = 5, h = 3, lit = 1, filled = 0,
                contents = function() des.altar({ align = "law", type = "shrine" }) end })
        end }}
        function post_level_generate() end
    `);

    await mklev();

    const level = requireGameLevel();
    const altars = level.locations.flat().filter(location => location.typ === ALTAR);
    assert.ok(altars.length > 0, 'the generator must create the temple shrines');
    for (let x = 1; x < level.locations.length; x++) {
        const column = level.locations[x];
        if (!column) continue;
        for (const [y, location] of column.entries()) {
            if (location.typ !== ALTAR) continue;
            assert.ok(location.flags & AM_SHRINE, 'a temple shrine keeps its shrine flag');
            assert.equal(mapFeatureDescription(x, y, terrain_glyph(location, x, y)), 'lawful altar');
        }
    }
});
