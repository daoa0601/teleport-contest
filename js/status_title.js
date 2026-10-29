import { Upolyd } from './const.js';
import { monsterTypeName } from './monster_data.js';
import { rankOf } from './quest_pager.js';
export function statusTitle(state) {
    let name = state.plname || state.displayName || 'Hero';
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const role = Upolyd(state.u)
        ? monsterTypeName(state.u.umonnum ?? -1, state.u.mfemale)
            .replace(/(^| )[a-z]/g, letter => letter.toUpperCase())
        : rankOf(state.u.ulevel ?? 1, state);
    if (name.length + 5 + role.length > 30)
        name = name.slice(0, Math.max(16, 30 - 5 - role.length));
    return `${name} the ${role}`;
}
//# sourceMappingURL=status_title.js.map