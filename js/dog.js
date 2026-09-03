// Tame monster state.
// C refs: dog.c tamedog(), newedog(), initedog(), and abuse_dog().

import { currentAttribute } from './attrib.js';
import { A_CHA } from './const.js';
import { newsym } from './display.js';
import { game } from './gstate.js';
import { heroHasConflict } from './hero_conflict.js';
import {
    publishKickedPetYelp, publishMonsterGrowl,
} from './monster_anger.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { MONSTER_FLAGS2, MONSTER_SOUND } from './monster_data.js';
import { RIN_AGGRAVATE_MONSTER } from './object_data.js';
import { rn2, rnd } from './rng.js';

const M2_DOMESTIC = 0x00400000;

function heroAggravatesMonsters(state) {
    const rings = [
        state.uleft, state.uright, state.u?.uleft, state.u?.uright,
    ];
    return !!(state.u?.aggravateMonster || state.u?.aggravate_monster
        || state.aggravateMonster || state.aggravate_monster
        || rings.some(ring => ring?.otyp === RIN_AGGRAVATE_MONSTER)
        || heroHasConflict(state));
}

export async function abusePetAfterHeroHit(
    monster, damage, state = game,
) {
    if (!(monster?.mtame > 0) || damage <= 0) return false;

    monster.mtame = heroAggravatesMonsters(state)
        ? Math.trunc(monster.mtame / 2) : monster.mtame - 1;
    monster.pet = monster.mtame > 0;
    if (monster.mtame > 0 && !monster.isminion) {
        if (!monster.edog) monster.edog = {};
        monster.edog.abuse = (monster.edog.abuse ?? 0) + 1;
    }
    if (!monster.mtame && monster.mleashed)
        releaseMonsterLeash(monster, state);

    if (monster.mx !== 0) {
        if (monster.mtame > 0 && rn2(monster.mtame) !== 0) {
            await publishKickedPetYelp(
                monster, MONSTER_SOUND[monster.mnum] ?? 0,
            );
        } else {
            await publishMonsterGrowl(monster);
        }
        if (!monster.mtame) newsym(monster.mx, monster.my);
    }

    if (monster.mtame > 0 && (monster.mhp ?? 0) > 0) {
        monster.mflee = 1;
        monster.mfleetim = Math.min(
            127,
            (monster.mfleetim ?? 0) + 10 * rnd(damage),
        );
    }
    return true;
}

export function tameMonster(monster, state = game) {
    if (!monster) return false;
    if (monster.mfrozen)
        monster.mfrozen = Math.trunc((monster.mfrozen + 1) / 2);
    monster.msleeping = 0;
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    monster.mflee = 0;
    monster.mfleetim = 0;
    const minimumTameness = (MONSTER_FLAGS2[monster.mnum] & M2_DOMESTIC)
        ? 10 : 5;
    monster.mtame = Math.max(minimumTameness, monster.mtame || 0);
    monster.pet = true;
    monster.mleashed = 0;
    monster.meating = 0;
    delete monster.malign;

    const dog = {
        parentmid: monster.m_id,
        droptime: 0,
        dropdist: 10000,
        apport: currentAttribute(A_CHA, state),
        whistletime: 0,
        hungrytime: (state.moves ?? 0) + 1000,
        ogoal: { x: -1, y: -1 },
        abuse: 0,
        revivals: 0,
        mhpmax_penalty: 0,
        killed_by_u: 0,
    };
    monster.edog = dog;
    monster.mextra = { ...(monster.mextra || {}), edog: dog };
    if (!state.u.uconduct) state.u.uconduct = {};
    state.u.uconduct.pets = (state.u.uconduct.pets || 0) + 1;
    return true;
}

export function makePetWary(
    monster, { wasDead = true, state = game, random = rn2 } = {},
) {
    if (!monster) return;
    monster.meating = 0;
    if (!(monster.mtame > 0)) return;

    const dog = monster.isminion
        ? null : monster.edog || monster.mextra?.edog;
    if (dog?.mhpmax_penalty) {
        monster.mhpmax = (monster.mhpmax ?? 1) + dog.mhpmax_penalty;
        monster.mhp = (monster.mhp ?? 1) + dog.mhpmax_penalty;
        dog.mhpmax_penalty = 0;
    }

    if (dog && (dog.killed_by_u === 1 || (dog.abuse ?? 0) > 2)) {
        monster.mtame = 0;
        monster.mpeaceful = 0;
        if ((dog.abuse ?? 0) >= 0 && (dog.abuse ?? 0) < 10
            && random((dog.abuse ?? 0) + 1) === 0) {
            monster.mpeaceful = 1;
        }
    } else {
        monster.mtame = random(monster.mtame + 1);
        if (!monster.mtame) monster.mpeaceful = random(2);
    }

    monster.pet = monster.mtame > 0;
    if (!monster.mtame) {
        releaseMonsterLeash(monster, state);
        if (state.u?.usteed === monster) state.u.usteed = null;
        if (state.u?.ustuck === monster) {
            state.u.ustuck = null;
            state.u.uswallow = false;
        }
        return {
            tame: false,
            disposition: monster.mpeaceful
                ? 'is no longer tame' : 'has become feral',
        };
    }

    if (dog) {
        dog.revivals = (dog.revivals ?? 0) + 1;
        dog.killed_by_u = 0;
        dog.abuse = 0;
        dog.ogoal = { x: -1, y: -1 };
        const hungerFloor = (state.moves ?? 0) + 500;
        if (wasDead || (dog.hungrytime ?? 0) < hungerFloor)
            dog.hungrytime = hungerFloor;
        if (wasDead) {
            dog.droptime = 0;
            dog.dropdist = 10000;
            dog.whistletime = 0;
            dog.apport = 5;
        }
    }
    return { tame: true };
}
