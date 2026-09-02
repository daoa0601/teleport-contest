// A wielded weapon hitting a monster at range.
// C refs: dothrow.c thitmonst() and uhitm.c hmon(HMON_APPLIED).

import { currentAttribute, exerciseAttribute } from './attrib.js';
import { applyArtifactHitToMonster } from './artifact_hit.js';
import { artifactToHitBonus } from './artifacts.js';
import { A_DEX, A_STR } from './const.js';
import {
    canProjectMonster, canSeeMonster, plineWithContinuation,
    randomDisplayMonsterName,
} from './display.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { game } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_SIZE,
    monsterTypeName,
} from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    OBJECT_HIT_BONUS, OBJECT_NAMES, OBJECT_SUBTYPE,
} from './object_data.js';
import { applyProjectileObjectPassive } from './projectile.js';
import { rnd, rn2 } from './rng.js';
import { shopkeeperName } from './shk.js';
import {
    recordWeaponPractice, weaponSkillDamageBonus, weaponSkillHitBonus,
} from './skills.js';
import {
    rollPhysicalWeaponDamage, strengthDamageBonus,
} from './weapon_damage.js';

const M2_DEMON = 0x00000100;
const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const M2_UNDEAD = 0x00000002;

function dexterityHitBonus(state) {
    const dexterity = currentAttribute(A_DEX, state);
    if (dexterity < 4) return -3;
    if (dexterity < 6) return -2;
    if (dexterity < 8) return -1;
    return dexterity >= 14 ? dexterity - 14 : 0;
}

function targetName(monster, state) {
    if (state.u?.hallucinating || (state.u?.hallucinationTurns ?? 0) > 0)
        return randomDisplayMonsterName();
    if (monster.isshk) return shopkeeperName(monster);
    return monster.name || monsterTypeName(monster.mnum, !!monster.female);
}

function targetObject(monster, state) {
    if (!canProjectMonster(monster, monster.mx, monster.my)) return '';
    const name = targetName(monster, state);
    return monster.name || monster.isshk ? name : `the ${name}`;
}

function appliedHitThreshold(monster, weapon, state) {
    const distance = Math.max(
        Math.abs(monster.mx - state.u.ux),
        Math.abs(monster.my - state.u.uy),
    );
    const movement = monster.mmove ?? MONSTER_MOVE[monster.mnum] ?? 0;
    const immobilized = monster.mcanmove === 0
        || monster.mcanmove === false || !movement;
    const skill = Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0);
    const polymorphed = !!(state.u?.mtimedone || state.u?.polymorphed
        || state.u?.upolyd);
    const heroLevel = polymorphed
        ? state.u?.m_lev ?? MONSTER_LEVEL[state.u?.umonnum]
            ?? state.u?.ulevel ?? 1
        : state.u?.ulevel ?? 1;
    const targetFlags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    let threshold = -1
        + (state.u?.uluck ?? state.u?.luck ?? state.Luck ?? 0)
        + findMonsterArmorClass(monster)
        + (state.u?.uhitinc ?? 0)
        + heroLevel
        + dexterityHitBonus(state)
        + Math.max(-4, 3 - distance)
        + (MONSTER_SIZE[monster.mnum] ?? 2) - 2;

    if (monster.msleeping) threshold += 2;
    if (immobilized) {
        threshold += 4;
        if (movement && rn2(10) === 0) {
            monster.mcanmove = 1;
            monster.mfrozen = 0;
        }
    }
    threshold += (weapon.spe ?? weapon.enchantment ?? 0)
        + (weapon.hitbon ?? weapon.oc_hitbon
            ?? OBJECT_HIT_BONUS[weapon.otyp] ?? 0)
        + artifactToHitBonus(weapon, monster)
        + weaponSkillHitBonus(state, skill);
    if (weapon.blessed && (targetFlags & (M2_UNDEAD | M2_DEMON)))
        threshold += 2;

    const targetIsOrc = !!(targetFlags & M2_ORC);
    const heroIsElf = polymorphed
        ? !!((MONSTER_FLAGS2[state.u?.umonnum] ?? 0) & M2_ELF)
        : state.urace?.key === 'elf' || state.urace?.noun === 'elf';
    return threshold + (targetIsOrc && heroIsElf ? 1 : 0);
}

async function rollAppliedDamage(monster, weapon, state, dieRoll) {
    let damage = rollPhysicalWeaponDamage(weapon, monster);
    const trainsSkill = damage > 1;
    const artifactHit = await applyArtifactHitToMonster(
        weapon, monster, damage, {
            state,
            visible: canProjectMonster(monster, monster.mx, monster.my),
            describeTarget: () => targetObject(monster, state) || 'it',
            describeCarrier: () => targetName(monster, state),
            publish: plineWithContinuation,
            dieRoll,
        },
    );
    damage = artifactHit.damage;
    damage += (state.u?.udaminc ?? state.udaminc ?? 0)
        + strengthDamageBonus(currentAttribute(A_STR, state))
        + weaponSkillDamageBonus(
            state, Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0),
        );
    return {
        damage: artifactHit.attackStopped ? 0 : Math.max(1, damage),
        trainsSkill,
        specialMessage: artifactHit.specialMessage,
        attackStopped: artifactHit.attackStopped,
    };
}

function recordWeaponHit(weapon, damage, state) {
    if (!state.u.uconduct) state.u.uconduct = {};
    const firstWeaponHit = !(state.u.uconduct.weaphit || 0);
    state.u.uconduct.weaphit = (state.u.uconduct.weaphit || 0) + 1;
    if (firstWeaponHit && damage > 0) {
        const name = weapon.name || OBJECT_NAMES[weapon.otyp] || 'weapon';
        recordGameLogEvent(
            `hit with a wielded weapon (${name}) for the first time`,
        );
    }
}

async function abusePet(monster, damage, state) {
    if (!(monster.mtame > 0) || damage <= 0) return;
    if (state.u?.aggravateMonster || state.u?.conflict || state.conflict)
        monster.mtame = Math.trunc(monster.mtame / 2);
    else monster.mtame--;
    monster.pet = monster.mtame > 0;
    if (monster.mtame > 0 && !monster.isminion) {
        if (!monster.edog) monster.edog = {};
        monster.edog.abuse = (monster.edog.abuse ?? 0) + 1;
    }

    const yelps = monster.mtame > 0 && rn2(monster.mtame) !== 0;
    if (canProjectMonster(monster, monster.mx, monster.my)) {
        const subject = monster.name || `The ${targetName(monster, state)}`;
        await plineWithContinuation(
            `${subject} ${yelps ? 'yelps' : 'growls'}!`,
        );
    }
    if (monster.mtame > 0 && (monster.mhp ?? 0) > 0) {
        monster.mflee = 1;
        monster.mfleetim = Math.min(
            127,
            (monster.mfleetim ?? 0) + 10 * rnd(damage),
        );
    }
}

export async function hitMonsterWithAppliedWeapon(
    monster, weapon, { state = game } = {},
) {
    await applyCaitiffPenalty(monster, state);
    const threshold = appliedHitThreshold(monster, weapon, state);
    const dieRoll = rnd(20);
    const weaponName = weapon.name || OBJECT_NAMES[weapon.otyp] || 'weapon';

    if (threshold < dieRoll) {
        const namedTarget = targetObject(monster, state);
        await plineWithContinuation(
            `The ${weaponName} misses${namedTarget ? ` ${namedTarget}` : ''}.`,
        );
        if (rn2(3) === 0) await wakeAttackedMonster(monster);
        return false;
    }

    exerciseAttribute(A_DEX, true, state);
    const {
        damage, trainsSkill, specialMessage, attackStopped,
    } = await rollAppliedDamage(
        monster, weapon, state, dieRoll,
    );
    if (attackStopped) {
        await applyProjectileObjectPassive(monster, weapon);
        return true;
    }
    recordWeaponHit(weapon, damage, state);
    if (trainsSkill) {
        recordWeaponPractice(
            state, Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0), 1,
        );
    }

    if (damage === 0) {
        const namedTarget = targetObject(monster, state);
        if (!specialMessage) {
            await plineWithContinuation(
                `The ${weaponName} passes harmlessly through ${
                    namedTarget || 'it'
                }.`,
            );
        }
        await wakeAttackedMonster(monster);
        await applyProjectileObjectPassive(monster, weapon);
        return true;
    }

    const wasTame = (monster.mtame ?? (monster.pet ? 1 : 0)) > 0;
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    await abusePet(monster, damage, state);
    if (monster.mhp > 0) {
        const namedTarget = targetObject(monster, state);
        const punctuation = canSeeMonster(monster, monster.mx, monster.my)
            && damage > 4 ? '!' : '.';
        if (!specialMessage) {
            await plineWithContinuation(
                `The ${weaponName} hits ${namedTarget || 'it'}${punctuation}`,
            );
        }
        await wakeAttackedMonster(monster);
        const fleeRoll = rn2(25);
        if (fleeRoll === 0
            && monster.mhp < Math.trunc((monster.mhpmax ?? monster.mhp) / 2)) {
            if (rn2(3) === 0) rnd(100);
            monster.mflee = 1;
        }
        await applyProjectileObjectPassive(monster, weapon);
        return true;
    }

    const killed = await finishHeroMonsterKill(monster, monster.mx, monster.my, {
        wasTame,
        hallucinating: !!(state.u?.hallucinating
            || (state.u?.hallucinationTurns ?? 0) > 0),
        weaponHit: true,
        nameMonster: () => targetName(monster, state),
    });
    await applyProjectileObjectPassive(monster, weapon);
    return killed;
}
