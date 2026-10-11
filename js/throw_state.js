// throw_state.js — Shared throwit() direction, slip, and stamina ownership.
// C refs: dothrow.c throwit(); attrib.c exercise().
import { exerciseAttribute } from './attrib.js';
import { A_CON, Is_airlevel } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroIsPolymorphed } from './polyself.js';
import { rn2 } from './rng.js';
import { objectName } from './objnam.js';
import { calcCapacity, objectWeight, SLT_ENCUMBER, } from './weight.js';
// throwit() evaluates this gate before its stamina branch. A real slip
// rewrites the persistent direction even while engulfed, where every result
// still contacts the same monster.
export async function applyThrowSlip({ state = game, object, launcher = false, throwingWeapon = false, publish = plineWithContinuation, }) {
    const u = state.u;
    if (!(object?.cursed || object?.greased)
        || !(u.dx || u.dy) || rn2(7) !== 0)
        return false;
    if (launcher) {
        await publish(`The ${objectName(object, state)} misfires!`);
    }
    else if (object.greased || throwingWeapon) {
        await publish(`The ${objectName(object, state)} slips as you throw it!`);
    }
    else {
        return false;
    }
    u.dx = rn2(3) - 1;
    u.dy = rn2(3) - 1;
    u.dz = 0;
    if (!u.dx && !u.dy)
        u.dz = 1;
    return true;
}
// The object has already left inventory here.  calc_capacity(obj->owt)
// temporarily adds its weight back, reproducing the pre-detachment load.
// While swallowed, changing direction to down does not bypass monster
// contact; it only records the source direction state.
export async function applyLowStaminaThrow({ state = game, object, publish = plineWithContinuation, }) {
    const u = state.u;
    const polymorphed = heroIsPolymorphed(state);
    const currentHp = polymorphed ? (u.mh ?? 1) : (u.uhp ?? 1);
    const currentHpMax = polymorphed
        ? (u.mhmax ?? currentHp) : (u.uhpmax ?? currentHp);
    const thrownWeight = objectWeight(object);
    const threshold = polymorphed ? 5 : 10;
    const activeDirection = !!(u.dx || u.dy || (u.dz ?? 0) < 1);
    if (!activeDirection
        || calcCapacity(state, thrownWeight) <= SLT_ENCUMBER
        || currentHp >= threshold || currentHp === currentHpMax
        || thrownWeight <= currentHp * 2
        || Is_airlevel(u.uz))
        return false;
    await publish(`You have so little stamina, the ${objectName(object, state)} drops from your grasp.`);
    // exercise() ignores physical attributes while polymorphed.
    if (!polymorphed)
        await exerciseAttribute(A_CON, false, state);
    u.dx = u.dy = 0;
    u.dz = 1;
    return true;
}
//# sourceMappingURL=throw_state.js.map