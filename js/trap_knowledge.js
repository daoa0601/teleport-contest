// C mondata.c:mon_learns_traps() and mons_see_trap().
import { MONSTER_FLAGS1 } from './monster_data.js';
import { dist2 } from './hacklib.js';
import { clearPath } from './vision.js';
const M1_NOEYES = 0x00001000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
export function monsterKnowsTrap(monster, trap) {
    const known = monster.mtrapseen ?? 0;
    if (trap.ttyp === -1)
        return known !== 0;
    if (trap.ttyp === 0)
        return known === 0;
    return (known & (1 << (trap.ttyp - 1))) !== 0;
}
export function monsterLearnsTrap(monster, trap) {
    if (!trap)
        return;
    if (trap.ttyp === -1)
        monster.mtrapseen = -1;
    else if (trap.ttyp === 0)
        monster.mtrapseen = 0;
    else
        monster.mtrapseen = (monster.mtrapseen ?? 0) | (1 << (trap.ttyp - 1));
}
// C mondata.c:mons_see_trap().  Trap knowledge belongs to each observer,
// rather than to the level or monster class.  An unlit trigger teaches only
// adjacent sighted, thinking monsters; a lit trigger can teach observers up
// to seven squares away when clear_path() succeeds.
export function monstersSeeTrap(state, trap) {
    if (!trap)
        return;
    const tile = state?.level?.at?.(trap.tx, trap.ty);
    const maxDistance = tile?.lit ? 49 : 2;
    for (const observer of state?.level?.monsters || []) {
        if (!observer || (observer.mhp ?? 1) <= 0)
            continue;
        const flags = MONSTER_FLAGS1[observer.mnum] ?? 0;
        if ((flags & (M1_ANIMAL | M1_MINDLESS | M1_NOEYES))
            || observer.mcansee === false || observer.mcansee === 0) {
            continue;
        }
        if (dist2(observer.mx, observer.my, trap.tx, trap.ty) > maxDistance)
            continue;
        if (!clearPath(observer.mx, observer.my, trap.tx, trap.ty))
            continue;
        monsterLearnsTrap(observer, trap);
    }
}
//# sourceMappingURL=trap_knowledge.js.map