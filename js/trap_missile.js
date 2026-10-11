// Arrows and darts created by floor traps.
// C ref: trap.c t_missile().
import { mksobj } from './mklev.js';
import { objectWeight } from './weight.js';
export async function makeTrapMissile(objectType, trap) {
    const missile = await mksobj(objectType, true, false);
    missile.quan = missile.quantity = 1;
    missile.owt = objectWeight(missile);
    missile.opoisoned = 0;
    missile.ox = trap.tx;
    missile.oy = trap.ty;
    return missile;
}
//# sourceMappingURL=trap_missile.js.map