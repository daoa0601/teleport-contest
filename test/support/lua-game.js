import { game } from '../../js/gstate.js';
import { bindLuaLifecycle, currentLuaLifecycle, LuaLifecycle } from '../../js/lua/lifecycle.js';

export function startLuaCore(t, state = game) {
    const previous = currentLuaLifecycle();
    const lifecycle = new LuaLifecycle();
    bindLuaLifecycle(lifecycle);
    t.after(() => {
        bindLuaLifecycle(previous);
        lifecycle.destroy();
    });
    return lifecycle.startCore(state);
}
