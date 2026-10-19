import { game } from './gstate.js';
// C mon.c:set_ustuck(). A grip change can change the status conditions.
export function setHeroGrip(monster, state = game) {
    state.context.botl = true;
    state.u.ustuck = monster;
    if (!monster) {
        state.u.uswallow = state.uswallow = 0;
        state.u.uswldtim = 0;
    }
}
//# sourceMappingURL=hero_grip.js.map