import { isRoom } from '../js/map_types.js';
import type { TestContext } from 'node:test';
import type { Room } from '../js/map_types.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { THEMEROOM } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

async function buildThemedRooms(t: TestContext, fillOption: string) {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();

    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua != null, 'Expected lua to be initialized');
    assert.ok(lua);
    await lua.executeAsync(`
        themerooms = {{ name = "Empty chamber", frequency = 1,
            contents = function()
                des.room({ type = "themed", w = 8, h = 4 ${fillOption} })
            end
        }}
    `);
    game.level = new GameMap();
    // Native ordinary filling always creates a monster when the hero has
    // the Amulet. This makes accidental stocking observable without luck.
    game.u.uhave.amulet = 1;

    await mklev();

    const rooms = game.level.rooms.slice(0, game.level.nroom)
        .filter(isRoom).filter(room => room.rtype === THEMEROOM);
    assert.ok(rooms.length > 0, 'the Lua room definition should build chambers');
    return rooms;
}

function inRoom(room: Room, x: number, y: number) {
    return x >= room.lx && x <= room.hx && y >= room.ly && y <= room.hy;
}

for (const [label, option] of [['omitted', ''], ['disabled', ', filled = 0']] as const) {
    void test(`themed rooms with filling ${label} keep their declared empty interiors`, async t => {
        const rooms = await buildThemedRooms(t, option);
        requirePlayingGame(game);

        for (const room of rooms) {
            assert.equal(game.level.monsters.some(monster =>
                inRoom(room, monster.mx, monster.my)), false);
            for (let x = room.lx; x <= room.hx; x++)
                for (let y = room.ly; y <= room.hy; y++)
                    assert.equal(game.level.objects[x]?.[y]?.length ?? 0, 0,
                        `unexpected object at ${x},${y}`);
        }
    });
}

void test('a themed room can explicitly request ordinary stocking', async t => {
    const rooms = await buildThemedRooms(t, ', filled = 1');
    requirePlayingGame(game);

    for (const room of rooms)
        assert.ok(game.level.monsters.some(monster =>
            inRoom(room, monster.mx, monster.my)), 'each chamber should receive a monster');
});
