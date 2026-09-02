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
import {
    beginMonsterSpitAttack, monsterDryRattleMessage,
    resolveMonsterSpitFlight,
} from './monster_spit.js';
import {
    continueMonsterWeaponVolley, finishDeferredRangedProjectileHit,
    throwMonsterWeaponAtMonster,
} from './monster_throw.js';
import { makePlural } from './object_grammar.js';
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

function rangedTargetStillPresent(turn, state) {
    if (turn.target === state.u) return (state.u?.uhp ?? 1) > 0;
    return state.level?.monsters?.includes(turn.target)
        && (turn.target?.mhp ?? 0) > 0;
}

export function continueMonsterRangedTurn(
    turn, state, {
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    turn.current = null;
    if (turn.complete
        || (turn.monster?.mhp ?? 1) <= 0
        || !rangedTargetStillPresent(turn, state)) {
        turn.complete = true;
        return null;
    }

    const attacks = MONSTER_ATTACKS[turn.monster.mnum] || [];
    while (turn.nextSlot < attacks.length) {
        const attack = attacks[turn.nextSlot++];
        if (attack[0] === AT_WEAP && turn.target !== state.u) {
            const weaponAttack = throwMonsterWeaponAtMonster(
                turn.monster, turn.target, state, { random, rollOne },
            );
            if (weaponAttack?.readiedWeapon) {
                turn.readiedWeapon = weaponAttack.readiedWeapon;
                continue;
            }
            if (weaponAttack?.madeAttack) {
                turn.usedWeapon = true;
                turn.current = { kind: 'weapon', attack: weaponAttack };
                return turn.current;
            }
        } else if (attack[0] === AT_BREA) {
            const breath = beginBreathAtTarget(
                turn.monster, turn.target, state, random, attack,
            );
            if (breath.launched || breath.cough) {
                turn.current = { kind: 'breath', attack: breath };
                return turn.current;
            }
        } else if (attack[0] === AT_SPIT && turn.target !== state.u) {
            const position = targetPosition(turn.target, state);
            const spit = beginMonsterSpitAttack(
                turn.monster, position.x, position.y,
                { attack, random },
            );
            if (spit?.launched || spit?.dryRattle) {
                turn.current = {
                    kind: 'spit',
                    attack: { target: turn.target, ...spit },
                };
                return turn.current;
            }
        }
    }
    turn.complete = true;
    return null;
}

export function beginMonsterRangedTurn(
    monster, target, state, options = {},
) {
    monster.mlstmv = sourceTurn(state);
    const turn = {
        monster,
        target,
        nextSlot: 0,
        current: null,
        complete: false,
        readiedWeapon: null,
        usedWeapon: false,
    };
    continueMonsterRangedTurn(turn, state, options);
    return turn;
}

export function beginPetRangedTurn(
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
        return {
            monster: pet,
            target,
            current: null,
            complete: true,
            readiedWeapon: null,
            makeNoise: forced,
        };
    }
    return beginMonsterRangedTurn(
        pet, target, state, { random, rollOne },
    );
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

function middleSentenceSubject(monster) {
    const subject = monsterSentenceSubject(monster);
    return subject.startsWith('The ')
        ? `the ${subject.slice(4)}` : subject;
}

async function presentRetaliationWeapons(
    monster, attacks, state, publish, finishMonsterKill, random, rollOne,
) {
    for (const attack of attacks) {
        if (canProjectMonster(monster, monster.mx, monster.my)) {
            const article = /^[aeiou]/i.test(attack.appearance) ? 'an' : 'a';
            const object = attack.volley > 1
                ? `${attack.volley} ${makePlural(attack.appearance)}`
                : `${article} ${attack.appearance}`;
            await publish(`${monsterSentenceSubject(monster)} ${
                attack.launched ? 'shoots' : 'throws'
            } ${object}!`);
        }
        let shot = attack.shots[0];
        while (shot) {
            if (shot.target && canProjectMonster(
                shot.target, shot.target.mx, shot.target.my,
            )) {
                await publish(`The ${shot.appearance} ${
                    shot.hit ? 'hits' : 'misses'
                } ${middleSentenceSubject(shot.target)}.`);
            }
            if ((shot.target.mhp ?? 0) <= 0
                && state.level?.monsters?.includes(shot.target)) {
                if (canProjectMonster(
                    shot.target, shot.target.mx, shot.target.my,
                )) {
                    await publish(
                        `${monsterSentenceSubject(shot.target)} is killed!`,
                    );
                }
                await finishMonsterKill(shot.target, { noCorpse: false });
                shot.targetDied = !state.level?.monsters?.includes(shot.target)
                    || (shot.target.mhp ?? 0) <= 0;
            }
            finishDeferredRangedProjectileHit(shot, state, random);
            if (shot.targetDied && shot.target === attack.aimedAt) return true;
            shot = continueMonsterWeaponVolley(
                attack, state, { random, rollOne },
            );
        }
    }
    return false;
}

async function resolveRetaliationAttack(
    monster, target, turn, state, {
        publish, finishMonsterKill, random, rollDice, rollOne,
    },
) {
    while (turn.current) {
        const { kind, attack } = turn.current;
        if (kind === 'weapon') {
            const targetDied = await presentRetaliationWeapons(
                monster, [attack], state, publish, finishMonsterKill,
                random, rollOne,
            );
            if (targetDied) return turn;
        } else if (kind === 'breath') {
            const message = attack.cough
                ? monsterCoughMessage(monster, state)
                : monsterBreathMessage(monster, attack);
            if (message) await publish(message);
            if (attack.launched) {
                await resolveMonsterBreathAttack(monster, attack, state, {
                    publish,
                    finishMonsterKill,
                    random,
                    rollDice,
                    rollOne,
                    allowRetaliation: false,
                });
            }
        } else if (kind === 'spit') {
            const message = attack.dryRattle
                ? monsterDryRattleMessage(monster, state)
                : canProjectMonster(monster, monster.mx, monster.my)
                    ? `${monsterSentenceSubject(monster)} spits venom!`
                    : null;
            if (message) await publish(message);
            if (attack.launched) {
                resolveMonsterSpitFlight(monster, attack, state, {
                    random, rollOne,
                });
                if ((target.mhp ?? 0) <= 0
                    && state.level?.monsters?.includes(target)) {
                    if (canProjectMonster(target, target.mx, target.my)) {
                        await publish(
                            `${monsterSentenceSubject(target)} is killed!`,
                        );
                    }
                    await finishMonsterKill(target, { noCorpse: false });
                }
            }
        }
        continueMonsterRangedTurn(turn, state, { random, rollOne });
    }
    return turn;
}

export async function resolveRangedRetaliation(
    attacker, target, state, {
        publish,
        finishMonsterKill,
        random = rn2,
        rollDice = d,
        rollOne = rnd,
    } = {},
) {
    const targetAlive = state.level?.monsters?.includes(target)
        && (target.mhp ?? 0) > 0;
    if (!targetAlive || random(4) === 0
        || target.mcansee === 0 || target.mcansee === false
        || ((MONSTER_FLAGS1[target.mnum] ?? 0) & M1_NOEYES)) {
        return null;
    }

    const response = beginMonsterRangedTurn(
        target, attacker, state, { random, rollOne },
    );
    await resolveRetaliationAttack(
        target, attacker, response, state, {
            publish, finishMonsterKill, random, rollDice, rollOne,
        },
    );
    response.actorDied = !state.level?.monsters?.includes(attacker)
        || (attacker.mhp ?? 0) <= 0;
    return response;
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

    if (allowRetaliation) {
        breath.retaliation = await resolveRangedRetaliation(
            monster, breath.target, state, {
                publish, finishMonsterKill, random, rollDice, rollOne,
            },
        );
        breath.actorDied = !!breath.retaliation?.actorDied;
    }
    return breath;
}
