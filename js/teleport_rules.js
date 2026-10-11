// teleport_rules.js - teleport restrictions and legal destinations.
// C refs: teleport.c noteleport_level(), goodpos(), goodpos_onscary().
import { game, requireGameLevel } from './gstate.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { monsterName } from './monster_name.js';
import { collectNearbyCoords } from './u_init.js';
import { rn2 } from './rng.js';
import { ACCESSIBLE, ALTAR, D_CLOSED, D_LOCKED, DOOR, IS_STWALL, GP_ALLOW_U, GP_AVOID_MONPOS, GP_CHECKSCARY, MM_IGNORELAVA, MM_IGNOREWATER, WATER, W_NONPASSWALL, isok, } from './const.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_SYMBOL, monsterIsCovetous, } from './monster_data.js';
import { BOULDER, SCR_SCARE_MONSTER } from './object_data.js';
import { hasCompletedEngraving } from './engrave.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { isLavaAt, isPoolAt, levelIsWaterLevel, monsterInAir } from './terrain_properties.js';
import { propertyIsActive } from './properties.js';
import { heroHasWaterWalking } from './armor.js';
import { heroLikesLava } from './hero_species.js';
const M1_AMPHIBIOUS = 0x00000200;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_NOEYES = 0x00001000;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_ROCKTHROW = 0x08000000;
const G_UNIQ = 0x1000;
const S_ANGEL = 27;
const S_DEMON = 56;
const S_EEL = 57;
const S_HUMAN = 53;
const S_VAMPIRE = 48;
const PM_FLOATING_EYE = 28;
const PM_FIRE_ELEMENTAL = 155;
const PM_MINOTAUR = 177;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const PM_SALAMANDER = 329;
function monsterIsDemonRuler(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return MONSTER_SYMBOL[monster?.mnum] === S_DEMON
        && !!(flags & (M2_LORD | M2_PRINCE));
}
function demonCourtBlocksTeleport(monster, state) {
    const inHell = !!state?.dungeons?.[state?.u?.uz?.dnum ?? -1]
        ?.flags?.hellish;
    if (!inHell || monsterIsDemonRuler(monster))
        return false;
    return state?.level?.monsters?.some(candidate => candidate !== monster && (candidate.mhp ?? 1) > 0
        && monsterIsDemonRuler(candidate)) ?? false;
}
export function monsterTeleportRestricted(monster, state = game) {
    if (demonCourtBlocksTeleport(monster, state))
        return true;
    if (state?.level?.flags?.noteleport && !monsterIsCovetous(monster))
        return true;
    const stasisUntil = state?.level?.flags?.stasis_until;
    return typeof stasisUntil === 'number' && Number.isFinite(stasisUntil)
        && stasisUntil >= (state?.moves ?? 1);
}
// Native tele_restrict() adds feedback to the shared level restriction.
export async function reportMonsterTeleportRestriction(monster, { state = game, publish = plineWithContinuation, } = {}) {
    if (!monsterTeleportRestricted(monster, state))
        return false;
    if (canSeeMonster(monster))
        await publish(`A mysterious force prevents ${monsterName(monster, { state })} from teleporting!`);
    return true;
}
export function heroTeleportRestricted(state = game) {
    const currentForm = state?.u?.mtimedone
        ? state.u.umonnum : state?.u?.umonster;
    if (currentForm === undefined)
        throw new Error('Teleportation requires a hero species.');
    return monsterTeleportRestricted({ mnum: currentForm }, state);
}
// C teleport.c:goodpos(). Species subjects represent a zeroed temporary actor.
export function goodPosition(x, y, subject, { state = game, gpflags = 0, random = rn2, } = {}) {
    if (!isok(x, y))
        return false;
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (!location)
        return false;
    const isHero = subject?.kind === 'hero';
    let monster = null;
    if (isHero) {
        const mnum = state.u.umonnum;
        if (mnum === undefined)
            throw new Error('Hero placement requires a species.');
        monster = { mnum, m_id: 1, mcansee: 0 };
        if (state.u.mcham !== undefined)
            monster.cham = state.u.mcham;
    }
    else if (subject?.kind === 'monster') {
        monster = subject.monster;
    }
    else if (subject?.kind === 'species') {
        monster = { mnum: subject.mnum };
    }
    const ignoreWater = !!(gpflags & MM_IGNOREWATER);
    const ignoreLava = !!(gpflags & MM_IGNORELAVA);
    const avoidMonsters = !!(gpflags & GP_AVOID_MONPOS);
    if (!(gpflags & GP_ALLOW_U) && state.u.ux === x && state.u.uy === y
        && !isHero && !(monster === state.u.ustuck && state.u.uswallow)
        && !(state.u.usteed && monster === state.u.usteed))
        return false;
    const occupant = monsterAtPosition(level, x, y);
    if (occupant && avoidMonsters)
        return false;
    const flags1 = monster ? MONSTER_FLAGS1[monster.mnum] ?? 0 : 0;
    const flags2 = monster ? MONSTER_FLAGS2[monster.mnum] ?? 0 : 0;
    const pool = isPoolAt(x, y, state);
    const lava = isLavaAt(x, y, state);
    if (monster) {
        const mnum = monster.mnum;
        if (occupant && (occupant !== monster || ('wormno' in monster && monster.wormno)))
            return false;
        if (pool && !ignoreWater) {
            const surface = !levelIsWaterLevel(state) && location.typ !== WATER;
            if (isHero) {
                return propertyIsActive('swimming', state)
                    || propertyIsActive('magicalBreathing', state)
                    || !!(flags1 & M1_AMPHIBIOUS)
                    || (surface && (propertyIsActive('levitation', state)
                        || propertyIsActive('flying', state) || heroHasWaterWalking(state)));
            }
            return !!(flags1 & M1_SWIM) || (surface && monsterInAir(monster, state));
        }
        else if (MONSTER_SYMBOL[mnum] === S_EEL && random(13) && !ignoreWater) {
            return false;
        }
        else if (lava && !ignoreLava) {
            if (mnum === PM_FLOATING_EYE)
                return false;
            if (isHero) {
                const boots = state.uarmf || state.u.uarmf;
                return propertyIsActive('levitation', state) || propertyIsActive('flying', state)
                    || (!levelIsWaterLevel(state) && propertyIsActive('fireResistance', state)
                        && heroHasWaterWalking(state) && !!boots?.oerodeproof)
                    || heroLikesLava(state);
            }
            return monsterInAir(monster, state)
                || mnum === PM_FIRE_ELEMENTAL || mnum === PM_SALAMANDER;
        }
        if ((flags1 & M1_WALLWALK)
            && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL)))
            return true;
        if ((flags1 & M1_AMORPHOUS) && location.typ === DOOR
            && (location.doormask & (D_CLOSED | D_LOCKED)))
            return true;
        if (gpflags & GP_CHECKSCARY) {
            const scary = monster.m_id
                ? monsterIsScaredAt(monster, state, x, y)
                : monsterTypeScaredFromPosition(mnum, x, y, state);
            if (scary)
                return false;
        }
    }
    const accessible = ACCESSIBLE(location.typ)
        && !(location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)));
    if (!accessible && !(pool && ignoreWater) && !(lava && ignoreLava))
        return false;
    if (!(flags2 & M2_ROCKTHROW) && level.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
        return false;
    if (avoidMonsters && level.exclusionZones?.some(zone => zone.type === 'monster-generation'
        && x >= zone.lx && x <= zone.hx && y >= zone.ly && y <= zone.hy))
        return false;
    return true;
}
// C teleport.c:enexto()/enexto_core(). Search nearby first, then the rest
// of the map. Only ignore scary squares after both searches fail.
export function findNearbyMonsterPosition(mnum, x, y, { state = game, random = rn2, calls = null, } = {}) {
    const species = mnum ?? state.u.umonster;
    if (species === undefined)
        throw new Error('Nearby placement requires a monster species.');
    const subject = { kind: 'species', mnum: species };
    for (const gpflags of [GP_CHECKSCARY, 0]) {
        const nearby = collectNearbyCoords(x, y, 3, random, calls);
        const fits = (point) => goodPosition(point.x, point.y, subject, { state, gpflags, random });
        const close = nearby.find(fits);
        if (close)
            return close;
        const all = collectNearbyCoords(x, y, 0, random, calls);
        const distant = all.slice(nearby.length).find(fits);
        if (distant)
            return distant;
    }
    return null;
}
function monsterTypeScaredFromPosition(mndx, x, y, state) {
    const symbol = MONSTER_SYMBOL[mndx] ?? 0;
    if (symbol === S_HUMAN || symbol === S_ANGEL
        || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(mndx)
        || ((MONSTER_GENO[mndx] ?? 0) & G_UNIQ))
        return false;
    const location = state.level?.at?.(x, y);
    if (location?.typ === ALTAR && symbol === S_VAMPIRE)
        return true;
    if (state.level?.objects?.[x]?.[y]?.some(object => object.otyp === SCR_SCARE_MONSTER))
        return true;
    const inHell = !!state.dungeons?.[state.u?.uz?.dnum ?? -1]?.flags?.hellish;
    const inFinalDungeon = !!state.u?.uz && !!state.astral_level
        && state.u.uz.dnum === state.astral_level.dnum;
    if (inHell || inFinalDungeon || mndx === PM_MINOTAUR
        || ((MONSTER_FLAGS1[mndx] ?? 0) & M1_NOEYES))
        return false;
    return hasCompletedEngraving('Elbereth', x, y, state);
}
//# sourceMappingURL=teleport_rules.js.map