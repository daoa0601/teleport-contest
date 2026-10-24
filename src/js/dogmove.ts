import { questMonsterSound } from './role_monsters.js';
import type { Monster } from './monster_types.js';
import type { Hero } from './hero_types.js';
import type { PlayingGameState } from './game_state.js';
import type { AttackTuple, RandomBelow, RollOne } from './monster_action_types.js';
import type {
    PetRangedSelection, PetRangedTarget, PetTargetOptions,
} from './pet_ranged_types.js';
import { monsterAtPosition } from './monster_location.js';
import { distmin, isok } from './hacklib.js';
import {
    MONSTER_ATTACKS,
    MONSTER_FLAGS1,
    MONSTER_LEVEL,
    MONSTER_SYMBOL,
    monsterIsVampireShifter,
} from './monster_data.js';
import { AT_BREA } from './monster_attack_types.js';
import { rn2, rnd } from './rng.js';
import { clearPath } from './vision.js';

const DOG_HUNGRY = 300;
const M1_SEE_INVIS = 0x01000000;
const MS_LEADER = 36;
const MS_GUARDIAN = 38;
const S_VAMPIRE = 48;

// C dogmove.c:pet_ranged_attk(). Selection and hunger precede the shared
// monster attack; only a forced attempt without an admitted target makes noise.
export function selectPetRangedTarget(
    pet: Monster,
    state: PlayingGameState,
    { forced = false, random = rn2, rollOne = rnd }: PetTargetOptions = {},
): PetRangedSelection {
    const hungry = !pet.isminion && state.moves > (pet.edog?.hungrytime ?? 0) + DOG_HUNGRY;
    const target = bestPetRangedTarget(pet, state, { forced, random, rollOne });
    if (!target || (hungry && random(5) !== 0)) {
        return { target: null, makeNoise: forced };
    }
    return { target, makeNoise: false };
}

// C dogmove.c:best_target().
export function bestPetRangedTarget(
    pet: Monster,
    state: PlayingGameState,
    { forced = false, random = rn2, rollOne = rnd }: PetTargetOptions = {},
): PetRangedTarget | null {
    if (pet.mcansee === 0 || pet.mcansee === false) return null;
    let bestTarget: PetRangedTarget | null = null;
    let bestScore = -40000;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const target = findTarget(pet, dx, dy, state);
            if (!target) continue;
            const score = scoreTarget(pet, target, state, random, rollOne);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }
    }
    return !forced && bestScore < 0 ? null : bestTarget;
}

export function monsterBreathAttack(monster: Monster): AttackTuple | null {
    return MONSTER_ATTACKS[monster.mnum]?.find(([attackType]) => attackType === AT_BREA) ?? null;
}

function isHeroTarget(target: PetRangedTarget, state: PlayingGameState): target is Hero {
    return target === state.u;
}

function targetPosition(target: PetRangedTarget, state: PlayingGameState) {
    return isHeroTarget(target, state)
        ? { x: state.u.ux, y: state.u.uy }
        : { x: target.mx, y: target.my };
}

function petSeesInvisible(pet: Monster) {
    return !!((MONSTER_FLAGS1[pet.mnum] ?? 0) & M1_SEE_INVIS);
}

function petCanSee(pet: Monster, x: number, y: number) {
    return clearPath(pet.mx, pet.my, x, y);
}

function findTarget(
    pet: Monster,
    dx: number,
    dy: number,
    state: PlayingGameState,
): PetRangedTarget | null {
    let x = pet.mx;
    let y = pet.my;
    for (let distance = 0; distance < 7; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y) || !petCanSee(pet, x, y)) break;
        if (x === pet.mux && y === pet.muy) return state.u;

        const target = monsterAtPosition(state.level, x, y);
        if (!target) continue;
        if ((!target.minvis || petSeesInvisible(pet)) && !target.mundetected
            && target.mx === x && target.my === y) return target;
    }
    return null;
}

function targetHasFriendBehind(pet: Monster, target: PetRangedTarget, state: PlayingGameState) {
    const targetPos = targetPosition(target, state);
    const dx = Math.sign(targetPos.x - pet.mx);
    const dy = Math.sign(targetPos.y - pet.my);
    let x = targetPos.x;
    let y = targetPos.y;
    let distance = distmin(pet.mx, pet.my, x, y);

    for (; distance <= 15; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y) || !petCanSee(pet, x, y)) return false;
        if (x === pet.mux && y === pet.muy) return true;

        const friend = monsterAtPosition(state.level, x, y);
        if (!friend) continue;
        if (friend.mtame) {
            if (!friend.minvis || petSeesInvisible(pet)) return true;
            continue;
        }
        const sound = questMonsterSound(friend.mnum, state);
        if (sound === MS_LEADER || sound === MS_GUARDIAN) return true;
    }
    return false;
}

function holyAlignment(monster: PetRangedTarget) {
    if (!('mnum' in monster)) return { faithful: false, alignment: null };
    if (monster.isminion) {
        return {
            faithful: true,
            alignment: monster.emin?.min_align ?? monster.mextra?.emin?.min_align,
        };
    }
    if (monster.ispriest) {
        return {
            faithful: true,
            alignment: monster.epri?.shralign ?? monster.mextra?.epri?.shralign,
        };
    }
    return { faithful: false, alignment: null };
}

function onQuestStartLevel(state: PlayingGameState) {
    return state._activeSpecialLevel?.prototype?.endsWith('-strt') || false;
}

// C dogmove.c:score_targ().
function scoreTarget(
    pet: Monster,
    target: PetRangedTarget,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
) {
    let score = 0;
    if (!pet.mconf || random(3) === 0 || onQuestStartLevel(state)) {
        const petFaith = holyAlignment(pet);
        const targetFaith = holyAlignment(target);
        const sound = isHeroTarget(target, state) ? 0 : questMonsterSound(target.mnum, state);
        if (sound === MS_LEADER || sound === MS_GUARDIAN) return -5000;
        if (
            petFaith.faithful &&
            targetFaith.faithful &&
            petFaith.alignment === targetFaith.alignment &&
            !isHeroTarget(target, state) &&
            target.mpeaceful
        )
            return -5000;

        const targetPos = targetPosition(target, state);
        if (distmin(pet.mx, pet.my, targetPos.x, targetPos.y) <= 1) return -3000;
        if (isHeroTarget(target, state) || target.mtame) return -3000;
        if (targetHasFriendBehind(pet, target, state)) return -3000;
        if (!target.mpeaceful) score += 10;
        if ((MONSTER_ATTACKS[target.mnum]?.[0]?.[0] ?? 0) === 0) score -= 1000;

        const petLevel = pet.m_lev ?? MONSTER_LEVEL[pet.mnum] ?? 0;
        const targetLevel = target.m_lev ?? MONSTER_LEVEL[target.mnum] ?? 0;
        const heroLevel = state.u?.ulevel ?? 1;
        if (
            (targetLevel < 2 && petLevel > 5) ||
            (petLevel > 12 &&
                targetLevel < petLevel - 9 &&
                heroLevel > 8 &&
                targetLevel < heroLevel - 7)
        ) {
            score -= 25;
        }

        let attackLevel = petLevel;
        if (monsterIsVampireShifter(pet) && MONSTER_SYMBOL[pet.mnum] !== S_VAMPIRE) {
            attackLevel =
                (pet.cham === undefined ? undefined : MONSTER_LEVEL[pet.cham]) ?? petLevel;
            attackLevel += random(Math.trunc(attackLevel / 2) + 1);
            attackLevel = Math.max(attackLevel, petLevel);
        }
        if (targetLevel > attackLevel + 4) score -= (targetLevel - attackLevel) * 20;
        score += targetLevel * 2 + Math.trunc((target.mhp ?? 0) / 3);
    }

    score += rollOne(5);
    if (pet.mconf && random(3) === 0) score -= 1000;
    return score;
}
