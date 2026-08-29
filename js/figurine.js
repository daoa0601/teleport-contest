// figurine.js — Source-owned spontaneous transformation for an ordinary
// hero-inventory figurine carrier. C refs: apply.c:fig_transform() and
// dog.c:make_familiar()/initedog().

import { currentAttribute } from './attrib.js';
import {
    G_EXTINCT, G_GENOD, MM_EDOG, MM_FEMALE, MM_IGNOREWATER, MM_MALE,
    MM_NOMSG, NO_MINVENT,
} from './const.js';
import { newsym } from './display.js';
import { game } from './gstate.js';
import { makemonNear } from './mklev.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_MOVE, MONSTER_SYMBOL,
    monsterTypeName,
} from './monster_data.js';
import { FIGURINE } from './object_data.js';
import { OBJECT_TIMER_KIND } from './object_timers.js';
import { rn2 } from './rng.js';

const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const M2_MINION = 0x00001000;
const M2_SHAPESHIFTER = 0x00004000;
const M2_DOMESTIC = 0x00400000;
const G_UNIQ = 0x1000;
const S_MIMIC = 13;
const PM_BLACK_LIGHT = 119;
const PM_STALKER = 153;

function ordinaryCarriedFigurineGap(figurine, state) {
    if (figurine.where !== 'inventory') return 'non-inventory carrier';
    if (state.u?.uswallow) return 'swallowed placement';
    if (figurine.oextra?.oname || figurine.oname) return 'named familiar';
    const mnum = figurine.corpsenm;
    if (!Number.isInteger(mnum) || mnum < 0) return 'invalid species';
    const vitals = state.mvitals?.[mnum]?.mvflags ?? 0;
    if (vitals & (G_GENOD | G_EXTINCT)) return 'dead or extinct species';
    if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) return 'unique species';
    const flags1 = MONSTER_FLAGS1[mnum] ?? 0;
    const flags2 = MONSTER_FLAGS2[mnum] ?? 0;
    if (flags2 & (M2_MINION | M2_SHAPESHIFTER))
        return 'minion or shapechanger';
    if (MONSTER_SYMBOL[mnum] === S_MIMIC
        || mnum === PM_STALKER || mnum === PM_BLACK_LIGHT)
        return 'suppressed visible form';
    if ((flags1 & (M1_FLY | M1_AMORPHOUS | M1_SLITHY))
        || (flags1 & M1_NOLIMBS) === M1_NOLIMBS
        || !(MONSTER_MOVE[mnum] > 0)) return 'nonstandard locomotion';
    if (MONSTER_HAS_WEAPON_ATTACK[mnum]) return 'immediate pet weapon setup';
    return null;
}

function articleFor(noun) {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function initializeFigurineDog(monster, state, currentTurn) {
    const domestic = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DOMESTIC);
    monster.mtame = Math.max(domestic ? 10 : 5, monster.mtame ?? 0);
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    monster.mleashed = 0;
    monster.meating = 0;
    monster.pet = true;
    monster.edog = {
        parentmid: monster.m_id,
        droptime: 0,
        dropdist: 10000,
        apport: currentAttribute(5, state),
        whistletime: 0,
        hungrytime: currentTurn + 1000,
        ogoal: { x: -1, y: -1 },
        abuse: 0,
        revivals: 0,
        mhpmax_penalty: 0,
        killed_by_u: 0,
    };
    if (!state.u.uconduct) state.u.uconduct = {};
    state.u.uconduct.pets = (state.u.uconduct.pets ?? 0) + 1;
}

function deleteCarriedFigurine(figurine, state) {
    const index = (state.inventory || []).indexOf(figurine);
    if (index >= 0) state.inventory.splice(index, 1);
    figurine.where = 'gone';
    figurine.ox = figurine.oy = 0;
}

export async function runClaimedCarriedFigurineTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.FIG_TRANSFORM)
        return null;
    const figurine = claimed.object;
    if (!figurine || figurine.otyp !== FIGURINE) return null;
    const gap = ordinaryCarriedFigurineGap(figurine, state);
    if (gap) throw new Error(`FIG_TRANSFORM ordinary carried owner excludes ${gap}`);

    const gender = (figurine.spe ?? 0) & 0x03; // CORPSTAT_GENDER
    let flags = MM_EDOG | MM_IGNOREWATER | NO_MINVENT | MM_NOMSG;
    if (gender === 1) flags |= MM_FEMALE;
    else if (gender === 2) flags |= MM_MALE;
    // enexto() receives the hero as its center, but native makemon() receives
    // the chosen adjacent coordinate.  It must not run hero-square birth state.
    const monster = await makemonNear(
        figurine.corpsenm, state.u.ux, state.u.uy, flags, false,
    );
    if (!monster) {
        deleteCarriedFigurine(figurine, state);
        return {
            figurine, monster: null, transformed: false,
            finishPending: false, message: null,
        };
    }

    monster.edog = { parentmid: monster.m_id };
    monster.mtame = 0;
    monster.pet = false;
    const chance = rn2(10);
    const disposition = chance <= 2 ? chance
        : figurine.blessed ? 0 : !figurine.cursed ? 1 : 2;
    if (disposition === 0) {
        initializeFigurineDog(monster, state, currentTurn);
    } else if (disposition === 2) {
        monster.mpeaceful = 0;
    }
    monster.msleeping = 0;
    newsym(monster.mx, monster.my);

    const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    const message = blind
        ? 'You feel something drop from your pack!'
        : `You see ${articleFor(name)} ${name} drop out of your pack!`;
    return {
        figurine, monster, chance, disposition,
        transformed: true, finishPending: true, message,
        overdue: claimed.timer.deadline !== currentTurn,
    };
}

export function finishCarriedFigurineTimer(event, state = game) {
    if (!event?.finishPending || !event.figurine) return event;
    deleteCarriedFigurine(event.figurine, state);
    event.finishPending = false;
    event.finished = true;
    return event;
}
