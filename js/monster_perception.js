// Monster target perception and remembered hero resistances.
// C refs: monmove.c set_apparxy(), hack.c cant_squeeze_thru(),
// mondata.c monstseesu() and monstunseesu().

import { heroIsDisplaced } from './armor.js';
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { clearPath, couldsee } from './vision.js';
import {
    ACCESSIBLE, D_CLOSED, D_LOCKED, G_GENOD, IS_DOOR, M_SEEN_NOTHING, isok,
} from './const.js';

const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_SEE_INVIS = 0x01000000;
const PM_FOG_CLOUD = 106;
const PM_VAMPIRE = 226;
const PM_VAMPIRE_LEADER = 227;
const PM_VLAD_THE_IMPALER = 228;

function recordPerceptionRandom(random, calls, range) {
    const value = random(range);
    if (calls) calls.push({ range, value });
    return value;
}

// Empty-handed vampire shifters are the sound subset of can_fog() needed by
// both apparent-position selection and diagonal squeeze checks.
export function monsterCanFogWithEmptyInventory(monster, state) {
    const vampireShifter = [
        PM_VAMPIRE, PM_VAMPIRE_LEADER, PM_VLAD_THE_IMPALER,
    ].includes(monster?.cham);
    return vampireShifter
        && !((state?.mvitals?.[PM_FOG_CLOUD]?.mvflags ?? 0) & G_GENOD)
        && !(state?.u?.protectionFromShapeChangers
            || state?.u?.protection_from_shape_changers)
        && !(monster?.minvent || monster?.inventory || []).length;
}

export function monsterCanOozeWithEmptyInventory(monster) {
    return !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_AMORPHOUS)
        && !(monster?.minvent || monster?.inventory || []).length;
}

function monsterCanSeeHero(monster, state) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
        || monster.mcansee === 0) return false;
    if (!Number.isFinite(state.u?.ux) || !Number.isFinite(state.u?.uy))
        return false;
    if (state.underwater || state.u?.uinwater) return false;
    if (heroIsInvisible(state)
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS)) {
        return false;
    }
    return clearPath(
        monster.mx, monster.my, state.u?.ux, state.u?.uy,
    );
}

function monstersThatCanSeeHero(state, canSeeHero) {
    if (state.u?.uswallow) return [];
    const seesHero = canSeeHero
        || (monster => monsterCanSeeHero(monster, state));
    return (state.level?.monsters || []).filter(monster =>
        monster && !monster.dead && (monster.mhp ?? 1) > 0
        && seesHero(monster));
}

export function monstersObserveHeroResistance(
    resistance,
    state = game,
    canSeeHero = null,
) {
    if (!resistance || resistance === M_SEEN_NOTHING) return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            | resistance;
    }
    return observers.length;
}

export function monstersForgetHeroResistance(
    resistance,
    state = game,
    canSeeHero = null,
) {
    if (!resistance || resistance === M_SEEN_NOTHING) return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            & ~resistance;
    }
    return observers.length;
}

// makemon() initializes this state once when its requested coordinate was the
// hero's square.  dochug() refreshes it before each movement decision.  Keep
// both owners on this one implementation: displacement makes the RNG and the
// remembered false position observable at either boundary.
export function setMonsterApparentHeroPosition(
    monster, state, random, calls = null,
) {
    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    if (!Number.isFinite(heroX) || !Number.isFinite(heroY)) return;

    const rememberedX = monster.mux;
    const rememberedY = monster.muy;
    if (monster.mtame || monster === state?.u?.ustuck
        || (rememberedX === heroX && rememberedY === heroY)) {
        monster.mux = heroX;
        monster.muy = heroY;
        return;
    }

    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const heroInvisible = !!state?.invisible || !!state?.u?.invisible
        || (state?.u?.invisibleTurns ?? 0) > 0;
    const notSeen = monster.mcansee === 0
        || (heroInvisible && !(flags1 & M1_SEE_INVIS));
    const notThere = heroIsDisplaced(state) && monster.mnum !== 39;
    let displacement = 0;
    if (state?.underwater || state?.u?.uinwater) displacement = 1;
    else if (notSeen) displacement = 1;
    else if (notThere) {
        displacement = Number.isFinite(rememberedX)
            && Number.isFinite(rememberedY)
            && couldsee(rememberedX, rememberedY) ? 2 : 1;
    }

    if (!displacement) {
        monster.mux = heroX;
        monster.muy = heroY;
        return;
    }

    const foundHero = notSeen
        ? recordPerceptionRandom(random, calls, 3) === 0
        : notThere ? recordPerceptionRandom(random, calls, 4) === 0 : false;
    if (foundHero) {
        monster.mux = heroX;
        monster.muy = heroY;
        return;
    }

    const passesWalls = !!(flags1 & M1_WALLWALK);
    for (let attempt = 0; attempt < 200; attempt++) {
        const x = heroX - displacement
            + recordPerceptionRandom(random, calls, 2 * displacement + 1);
        const y = heroY - displacement
            + recordPerceptionRandom(random, calls, 2 * displacement + 1);
        if (!isok(x, y)) continue;
        if (displacement !== 2 && x === monster.mx && y === monster.my)
            continue;
        const location = state?.level?.at?.(x, y);
        const closedDoor = IS_DOOR(location?.typ)
            && !!(location?.doormask & (D_CLOSED | D_LOCKED));
        const accessible = location && ACCESSIBLE(location.typ)
            && !closedDoor;
        const canUseClosedDoor = closedDoor
            && (monsterCanOozeWithEmptyInventory(monster)
                || monsterCanFogWithEmptyInventory(monster, state));
        if ((x !== heroX || y !== heroY)
            && !passesWalls && !accessible && !canUseClosedDoor) continue;
        if (!couldsee(x, y)) continue;
        monster.mux = x;
        monster.muy = y;
        return;
    }
    monster.mux = heroX;
    monster.muy = heroY;
}
