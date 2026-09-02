// Pet target choice and natural breath or spit attacks.
// C refs: dogmove.c best_target(), score_targ(), and pet_ranged_attk().

import { canProjectMonster } from './display.js';
import { distmin, isok } from './hacklib.js';
import {
    breatheFromMonster, breathRayName, breathWeaponName,
} from './breath_ray.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_NAME,
    MONSTER_SOUND, MONSTER_SYMBOL, monsterIsVampireShifter,
} from './monster_data.js';
import {
    AD_ACID, AD_COLD, AD_DISN, AD_DRST, AD_ELEC, AD_FIRE, AD_MAGM,
    AD_RBRE, AD_SLEE, AT_BREA, AT_SPIT, AT_WEAP,
} from './monster_attack_types.js';
import { rn2, rnd, d } from './rng.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { beginMonsterSpitAttack } from './monster_spit.js';
import { throwMonsterWeaponAtMonster } from './monster_throw.js';
import { clearPath } from './vision.js';

const DOG_HUNGRY = 300;
const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;
const MS_LEADER = 36;
const MS_GUARDIAN = 38;
const S_VAMPIRE = 48;

function monsterAt(state, x, y, ignored) {
    return state.level?.monsters?.find(monster => monster !== ignored
        && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function targetPosition(target, state) {
    return target === state.u
        ? { x: state.u.ux, y: state.u.uy }
        : { x: target.mx, y: target.my };
}

function petSeesInvisible(pet) {
    return !!((MONSTER_FLAGS1[pet.mnum] ?? 0) & M1_SEE_INVIS);
}

function petCanSee(pet, x, y) {
    return clearPath(pet.mx, pet.my, x, y);
}

function findTarget(pet, dx, dy, state) {
    let x = pet.mx;
    let y = pet.my;
    for (let distance = 0; distance < 7; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y) || !petCanSee(pet, x, y)) break;
        if (x === pet.mux && y === pet.muy) return state.u;

        const target = monsterAt(state, x, y, pet);
        if (!target) continue;
        if ((!target.minvis || petSeesInvisible(pet))
            && !target.mundetected) return target;
    }
    return null;
}

function targetHasFriendBehind(pet, target, state) {
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

        const friend = monsterAt(state, x, y, pet);
        if (!friend) continue;
        if (friend.mtame && (!friend.minvis || petSeesInvisible(pet)))
            return true;
        const sound = MONSTER_SOUND[friend.mnum] ?? 0;
        if (sound === MS_LEADER || sound === MS_GUARDIAN) return true;
    }
    return false;
}

function holyAlignment(monster) {
    if (monster.isminion) {
        return {
            faithful: true,
            alignment: monster.emin?.min_align
                ?? monster.mextra?.emin?.min_align,
        };
    }
    if (monster.ispriest) {
        return {
            faithful: true,
            alignment: monster.epri?.shralign
                ?? monster.mextra?.epri?.shralign,
        };
    }
    return { faithful: false, alignment: null };
}

function onQuestStartLevel(state) {
    return state._activeSpecialLevel?.prototype?.endsWith('-strt') || false;
}

function scoreTarget(pet, target, state, random, rollOne) {
    let score = 0;
    if (!pet.mconf || random(3) === 0 || onQuestStartLevel(state)) {
        const petFaith = holyAlignment(pet);
        const targetFaith = holyAlignment(target);
        const sound = target === state.u ? 0 : MONSTER_SOUND[target.mnum] ?? 0;
        if (sound === MS_LEADER || sound === MS_GUARDIAN) return -5000;
        if (petFaith.faithful && targetFaith.faithful
            && petFaith.alignment === targetFaith.alignment
            && target.mpeaceful) return -5000;

        const targetPos = targetPosition(target, state);
        if (distmin(pet.mx, pet.my, targetPos.x, targetPos.y) <= 1)
            return -3000;
        if (target === state.u || target.mtame) return -3000;
        if (targetHasFriendBehind(pet, target, state)) return -3000;
        if (!target.mpeaceful) score += 10;
        if ((MONSTER_ATTACKS[target.mnum]?.[0]?.[0] ?? 0) === 0)
            score -= 1000;

        const petLevel = pet.m_lev ?? MONSTER_LEVEL[pet.mnum] ?? 0;
        const targetLevel = target.m_lev
            ?? MONSTER_LEVEL[target.mnum] ?? 0;
        const heroLevel = state.u?.ulevel ?? 1;
        if ((targetLevel < 2 && petLevel > 5)
            || (petLevel > 12 && targetLevel < petLevel - 9
                && heroLevel > 8 && targetLevel < heroLevel - 7)) {
            score -= 25;
        }

        let attackLevel = petLevel;
        if (monsterIsVampireShifter(pet)
            && MONSTER_SYMBOL[pet.mnum] !== S_VAMPIRE) {
            attackLevel = MONSTER_LEVEL[pet.cham] ?? petLevel;
            attackLevel += random(Math.trunc(attackLevel / 2) + 1);
            attackLevel = Math.max(attackLevel, petLevel);
        }
        if (targetLevel > attackLevel + 4)
            score -= (targetLevel - attackLevel) * 20;
        score += targetLevel * 2 + Math.trunc((target.mhp ?? 0) / 3);
    }

    score += rollOne(5);
    if (pet.mconf && random(3) === 0) score -= 1000;
    return score;
}

export function bestPetRangedTarget(
    pet, state, { forced = false, random = rn2, rollOne = rnd } = {},
) {
    if (!pet || pet.mcansee === 0 || pet.mcansee === false) return null;
    let bestTarget = null;
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

function resolvedBreathAttack(attack, random) {
    if (attack[1] !== AD_RBRE) return attack;
    const damageTypes = [
        AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE,
        AD_DISN, AD_ELEC, AD_DRST, AD_ACID,
    ];
    const damageType = damageTypes[random(damageTypes.length)];
    return [attack[0], damageType, attack[2], attack[3]];
}

function sourceTurn(state) {
    return state._statusTurnOverride ?? state._maintenanceMove
        ?? state.moves ?? 1;
}

export function monsterBreathAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).find(
        ([attackType]) => attackType === AT_BREA,
    ) || null;
}

function beginBreathAtTarget(
    monster, target, state, random,
    declaredAttack = monsterBreathAttack(monster),
) {
    monster.mlstmv = sourceTurn(state);
    if (target === state.u)
        return { target, launched: false, attackedHero: true };
    if (!declaredAttack) return { target, launched: false };

    const attack = resolvedBreathAttack(declaredAttack, random);
    if (monster.mcan) return { target, attack, launched: false, cough: true };
    if ((monster.mspec_used ?? 0) || random(3) === 0)
        return { target, attack, launched: false };
    return { target, attack, launched: true };
}

export function beginPetRangedAttack(
    pet, state, {
        forced = false,
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    const target = bestPetRangedTarget(
        pet, state, { forced, random, rollOne },
    );
    const hungry = !pet.isminion
        && (state.moves ?? 1) > ((pet.edog?.hungrytime ?? 0) + DOG_HUNGRY);
    if (!target || (hungry && random(5) !== 0)) {
        return { target, launched: false, makeNoise: forced };
    }

    pet.mlstmv = sourceTurn(state);
    let readiedWeapon = null;
    for (const attack of MONSTER_ATTACKS[pet.mnum] || []) {
        if (attack[0] === AT_WEAP && target !== state.u) {
            const weaponAttack = throwMonsterWeaponAtMonster(
                pet, target, state, { random, rollOne },
            );
            if (weaponAttack?.readiedWeapon) {
                readiedWeapon = weaponAttack.readiedWeapon;
                continue;
            }
            if (weaponAttack?.madeAttack) {
                return {
                    kind: 'weapon',
                    readiedWeapon,
                    ...weaponAttack,
                };
            }
        } else if (attack[0] === AT_BREA) {
            const breath = beginBreathAtTarget(
                pet, target, state, random, attack,
            );
            if (breath.launched || breath.cough) {
                return {
                    kind: 'breath', readiedWeapon, ...breath,
                };
            }
        } else if (attack[0] === AT_SPIT && target !== state.u) {
            const position = targetPosition(target, state);
            const spit = beginMonsterSpitAttack(
                pet, position.x, position.y,
                { attack, random },
            );
            if (spit?.launched || spit?.dryRattle) {
                return {
                    kind: 'spit', target, readiedWeapon, ...spit,
                };
            }
        }
    }
    return { target, launched: false, readiedWeapon };
}

export function monsterBreathMessage(monster, breath) {
    if (!breath?.launched
        || !canProjectMonster(monster, monster.mx, monster.my)) return null;
    return `${monsterSentenceSubject(monster)} breathes ${
        breathWeaponName(breath.attack[1])
    }!`;
}

export function monsterCoughMessage(monster, state) {
    if (!monster || state.deaf || state.u?.deaf) return null;
    return canProjectMonster(monster, monster.mx, monster.my)
        ? `${monsterSentenceSubject(monster)} coughs.` : 'You hear a cough.';
}

export async function resolveMonsterBreathAttack(
    monster, breath, state, {
        publish,
        finishMonsterKill,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
        allowRetaliation = true,
    } = {},
) {
    if (!breath?.launched) return breath || null;
    const rayName = breathRayName(breath.attack[1]);
    const finishKill = async (target, x, y, death) => {
        if (death.showKillMessage && canProjectMonster(target, x, y)) {
            const targetName = MONSTER_NAME[target.mnum] || 'monster';
            await publish(
                `The ${targetName} is killed by the ${rayName}!`,
            );
        }
        return finishMonsterKill(target, death);
    };
    breath.result = await breatheFromMonster(monster, breath.target, {
        state,
        attack: breath.attack,
        publish,
        finishMonsterKill: finishKill,
        random,
        rollDice,
        rollOne,
    });
    monster.mspec_used = 8 + random(18);
    if (monster.mtame && !monster.isminion
        && (monster.edog?.hungrytime ?? 0) >= 10) {
        monster.edog.hungrytime -= 10;
    }
    breath.finished = true;

    const target = breath.target;
    const targetAlive = state.level?.monsters?.includes(target)
        && (target.mhp ?? 0) > 0;
    if (allowRetaliation && targetAlive && random(4) !== 0
        && target.mcansee !== 0 && target.mcansee !== false
        && !((MONSTER_FLAGS1[target.mnum] ?? 0) & M1_NOEYES)) {
        const response = beginBreathAtTarget(target, monster, state, random);
        breath.retaliation = response;
        const message = response.cough
            ? monsterCoughMessage(target, state)
            : monsterBreathMessage(target, response);
        if (message) await publish(message);
        if (response.launched) {
            await resolveMonsterBreathAttack(target, response, state, {
                publish,
                finishMonsterKill,
                random,
                rollDice,
                rollOne,
                allowRetaliation: false,
            });
        }
        breath.actorDied = !state.level?.monsters?.includes(monster)
            || (monster.mhp ?? 0) <= 0;
    }
    return breath;
}
