// Native dokick.c:martial() applies to role training, bigfoot, and boots.
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { KICKING_BOOTS } from './object_data.js';
export function heroHasMartialKick(state = game) {
    return state.urole?.key === 'monk' || state.urole?.key === 'samurai'
        || state.u.umonnum === MONSTER_NAME.indexOf('sasquatch')
        || (state.uarmf || state.u.uarmf)?.otyp === KICKING_BOOTS;
}
//# sourceMappingURL=kick_rules.js.map