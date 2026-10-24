// C role.c:role_init() changes the selected quest species for this game.
// Keep the source tables immutable; another Engine can have a different role.
import { game } from './gstate.js';
import { MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_FLAGS3, MONSTER_SOUND, requireMonsterData } from './monster_data.js';
const M2_PEACEFUL = 0x00200000;
const M2_HOSTILE = 0x00100000;
const M2_STALK = 0x01000000;
const M2_NASTY = 0x02000000;
const M3_CLOSE = 0x0080;
const M3_WANTSARTI = 0x0010;
const M3_WAITFORU = 0x0040;
export function questMonsterFlags2(species, state = game) {
    const flags = MONSTER_FLAGS2[species] ?? 0;
    const role = state.urole;
    if (species === role?.neminum)
        return (flags & ~M2_PEACEFUL) | M2_NASTY | M2_STALK | M2_HOSTILE;
    if (species === role?.ldrnum || species === role?.guardnum)
        return flags | M2_PEACEFUL;
    return flags;
}
export function questMonsterFlags3(species, state = game) {
    const flags = MONSTER_FLAGS3[species] ?? 0;
    if (species === state.urole?.neminum)
        return (flags & ~M3_CLOSE) | M3_WANTSARTI | M3_WAITFORU;
    if (species === state.urole?.ldrnum)
        return flags | M3_CLOSE;
    return flags;
}
export function questMonsterAlignment(species, state = game) {
    if (species === state.urole?.ldrnum || species === state.urole?.guardnum) {
        const startingAlignment = state.initAlignment?.value
            ?? state.flags.initalign ?? state.u.ualignbase?.[1] ?? 0;
        return startingAlignment * 3;
    }
    return requireMonsterData(MONSTER_ALIGNMENT, species);
}
export function questMonsterSound(species, state = game) {
    if (species === state.urole?.neminum)
        return 37; // MS_NEMESIS
    if (species === state.urole?.ldrnum)
        return 36; // MS_LEADER
    return MONSTER_SOUND[species] ?? 0;
}
//# sourceMappingURL=role_monsters.js.map