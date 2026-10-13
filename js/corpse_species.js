// Species rules shared by corpse timers and revival.
import { MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
const S_HUMANOID = 8, S_KOBOLD = 11, S_ORC = 15;
const S_GNOME = 33, S_GIANT = 34, S_KOP = 37, S_HUMAN = 53;
const M2_ELF = 0x10, M2_DWARF = 0x20;
const PM_ETTIN = MONSTER_NAME.indexOf('ettin');
const PM_KOBOLD_ZOMBIE = MONSTER_NAME.indexOf('kobold zombie');
const PM_GNOME_ZOMBIE = MONSTER_NAME.indexOf('gnome zombie');
const PM_ORC_ZOMBIE = MONSTER_NAME.indexOf('orc zombie');
const PM_DWARF_ZOMBIE = MONSTER_NAME.indexOf('dwarf zombie');
const PM_ELF_ZOMBIE = MONSTER_NAME.indexOf('elf zombie');
const PM_HUMAN_ZOMBIE = MONSTER_NAME.indexOf('human zombie');
const PM_ETTIN_ZOMBIE = MONSTER_NAME.indexOf('ettin zombie');
const PM_GIANT_ZOMBIE = MONSTER_NAME.indexOf('giant zombie');
export function zombieForm(mnum) {
    // C mon.c:zombie_form() uses the living monster's class and race,
    // so ranked species share the same zombie form as their base species.
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === undefined)
        return null;
    const race = MONSTER_FLAGS2[mnum] ?? 0;
    switch (symbol) {
        case S_KOBOLD: return PM_KOBOLD_ZOMBIE;
        case S_ORC: return PM_ORC_ZOMBIE;
        case S_GIANT: return mnum === PM_ETTIN ? PM_ETTIN_ZOMBIE : PM_GIANT_ZOMBIE;
        case S_HUMAN:
        case S_KOP: return race & M2_ELF ? PM_ELF_ZOMBIE : PM_HUMAN_ZOMBIE;
        case S_HUMANOID: return race & M2_DWARF ? PM_DWARF_ZOMBIE : null;
        case S_GNOME: return PM_GNOME_ZOMBIE;
        default: return null;
    }
}
export function isRider(mnum) {
    return mnum !== undefined && mnum >= 311 && mnum <= 313;
}
export function isReviver(mnum) {
    return isRider(mnum) || mnum !== undefined && MONSTER_SYMBOL[mnum] === 46; // S_TROLL
}
export function isZombieMaker(mnum, cancelled = false) {
    if (cancelled)
        return false;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === 38)
        return true; // S_LICH
    return symbol === 52 && mnum !== 246 && mnum !== 248; // ghoul, skeleton
}
//# sourceMappingURL=corpse_species.js.map