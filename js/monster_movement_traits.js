// Native mon.c:mon_allowflags(), monmove.c:monhaskey(), and
// mondata.c:passes_bars(). Conflict resistance belongs to the moving caller.
import { ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_ROCK, ALLOW_SANCT, ALLOW_SSM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, BUSTDOOR, Is_rogue_level, NOGARLIC, NOTONL, OPENDOOR, UNLOCKDOOR, } from './const.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroSpecies } from './hero_species.js';
import { AD_CORR, AD_RUST } from './monster_attack_types.js';
import { monsterCanBreakBoulder } from './monster_boulder.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterHasNoHands, monsterIsHuman, monsterIsRider, monsterIsUndead, monsterIsUnicorn, monsterIsUnsolid, monsterIsVampireShifter, monsterIsVerySmall, monsterIsWhirly, } from './monster_data.js';
import { CREDIT_CARD, LOCK_PICK, SKELETON_KEY } from './object_data.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_TUNNEL = 0x00000020;
const M1_NEEDPICK = 0x00000040;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_METALLIVORE = 0x80000000;
const M2_MINION = 0x00001000;
const M2_GIANT = 0x00002000;
const M2_ROCKTHROW = 0x08000000;
const S_GHOST = 54;
const MZ_LARGE = 3;
const PM_MINOTAUR = MONSTER_NAME.indexOf('minotaur');
export function monsterMovementBaseFlags(monster, state = game) {
    let flags = monster.mtame
        ? ALLOW_M | ALLOW_TRAPS | ALLOW_SANCT | ALLOW_SSM
        : monster.mpeaceful ? ALLOW_SANCT | ALLOW_SSM : ALLOW_U;
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const kind = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if (monster.isshk)
        flags |= ALLOW_SSM;
    if (monster.ispriest)
        flags |= ALLOW_SSM | ALLOW_SANCT;
    if (body & M1_WALLWALK)
        flags |= ALLOW_ROCK | ALLOW_WALL;
    if (kind & M2_ROCKTHROW || monsterCanBreakBoulder(monster))
        flags |= ALLOW_ROCK;
    if (monsterCanTunnel(monster, state))
        flags |= ALLOW_DIG;
    if (kind & M2_GIANT)
        flags |= BUSTDOOR;
    if (monsterCanOpenDoor(monster))
        flags |= OPENDOOR;
    if (monsterCanUnlockDoor(monster))
        flags |= UNLOCKDOOR;
    if (monsterPassesBars(monster)
        && (monster !== state.u.ustuck || carriedHeroPassesBars(state)))
        flags |= ALLOW_BARS;
    if (kind & M2_MINION || monsterIsRider(monster))
        flags |= ALLOW_SANCT;
    if (monsterIsUnicorn(monster.mnum) && !monsterTeleportRestricted(monster, state))
        flags |= NOTONL;
    if (monsterIsHuman(monster.mnum) || monster.mnum === PM_MINOTAUR)
        flags |= ALLOW_SSM;
    if (monsterIsUndead(monster.mnum) && MONSTER_SYMBOL[monster.mnum] !== S_GHOST
        || monsterIsVampireShifter(monster))
        flags |= NOGARLIC;
    return flags;
}
export function monsterCanOpenDoor(monster) {
    return !monsterHasNoHands(monster.mnum) && !monsterIsVerySmall(monster.mnum);
}
export function monsterCanUnlockDoor(monster) {
    return monsterCanOpenDoor(monster) && monsterHasKey(monster, true)
        || !!monster.iswiz || monsterIsRider(monster);
}
export function monsterHasKey(monster, forUnlocking) {
    return (monster.minvent ?? []).some(object => object.otyp === SKELETON_KEY
        || object.otyp === LOCK_PICK || forUnlocking && object.otyp === CREDIT_CARD);
}
export function monsterCanTunnel(monster, state = game) {
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (!(body & M1_TUNNEL) || Is_rogue_level(state.u.uz, state))
        return false;
    if (!(body & M1_NEEDPICK) || monster.mpeaceful && !heroHasConflict(state))
        return true;
    const { mux: targetX, muy: targetY } = monster;
    if (targetX === undefined || targetY === undefined)
        throw new Error('A tunneling monster needs its perceived hero position.');
    return dist2(monster.mx, monster.my, targetX, targetY) > 8;
}
export function monsterPassesBars(monster) {
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(body & (M1_WALLWALK | M1_AMORPHOUS | M1_UNSOLID | M1_METALLIVORE))
        || monsterIsWhirly(monster)
        || monsterIsVerySmall(monster.mnum) || monsterCorrodesBars(monster)
        || !!(body & M1_SLITHY) && (MONSTER_SIZE[monster.mnum] ?? MZ_LARGE) < MZ_LARGE;
}
export function monsterCorrodesBars(monster) {
    return (MONSTER_ATTACKS[monster.mnum] ?? []).some(([, damage]) => damage === AD_RUST || damage === AD_CORR);
}
function carriedHeroPassesBars(state) {
    const species = heroSpecies(state);
    return monsterIsUnsolid({ mnum: species }) || monsterIsVerySmall(species);
}
//# sourceMappingURL=monster_movement_traits.js.map