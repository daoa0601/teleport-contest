import assert from 'node:assert/strict';
import { init_dungeons } from '../../js/dungeon.js';
import { GameMap } from '../../js/game.js';
import { game } from '../../js/gstate.js';
import { currentLuaLifecycle } from '../../js/lua/lifecycle.js';
import { mklev } from '../../js/mklev.js';
import { init_objects } from '../../js/o_init.js';
import { initRng } from '../../js/rng.js';
import { freshGame } from './game-state.js';
import { startLuaCore } from './lua-game.js';
export async function roomBindings(t) {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.level = new GameMap();
    game.in_mklev = true;
    return lua;
}
//# sourceMappingURL=themed-room-bindings.js.map