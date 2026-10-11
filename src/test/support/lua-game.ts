import type { TestContext } from 'node:test';
import { game } from '../../js/gstate.js';
import { bindLuaLifecycle, currentLuaLifecycle, LuaLifecycle } from '../../js/lua/lifecycle.js';

export async function startLuaCore(t: TestContext, state = game) {
    const previous = currentLuaLifecycle();
    const lifecycle = new LuaLifecycle();
    bindLuaLifecycle(lifecycle);
    t.after(async () => {
        bindLuaLifecycle(previous);
        await lifecycle.destroy();
    });
    return await lifecycle.startCore(state);
}
