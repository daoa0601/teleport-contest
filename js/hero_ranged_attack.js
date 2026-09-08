// A wielded weapon hitting a monster at range.
// C refs: dothrow.c thitmonst() and uhitm.c hmon(HMON_APPLIED).

import { currentAttribute, exerciseAttribute } from './attrib.js';
import { applyArtifactHitToMonster } from './artifact_hit.js';
import { artifactToHitBonus } from './artifacts.js';
import { A_DEX, P_BOW, Upolyd } from './const.js';
import {
    canProjectMonster, canSeeMonster, plineWithContinuation,
    randomDisplayMonsterName,
} from './display.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { game } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { resolveHeroWeaponPoison } from './hero_weapon_poison.js';
import { abusePetAfterHeroHit } from './dog.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_FLAGS2, MONSTER_LEVEL,
    monsterIsShade, monsterTypeName,
} from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    BOOMERANG, ELVEN_ARROW, ELVEN_BOW, GAUNTLETS_OF_FUMBLING,
    GAUNTLETS_OF_POWER, OBJECT_NAMES, OBJECT_SUBTYPE,
    YA, YUMI,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import {
    isLauncherAmmunition, isPoisonableObject, isThrowingWeapon,
    launcherMatchesAmmo,
} from './object_properties.js';
import { applyMonsterPassiveToObject } from './monster_passive.js';
import { destroyMulchedProjectile, shouldMulchMissile } from './projectile.js';
import { rnd, rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { chargeUnpaidObjectAsDebt, shopkeeperName } from './shk.js';
import {
    recordWeaponPractice, weaponSkillDamageBonus, weaponSkillHitBonus,
} from './skills.js';
import {
    heroStrengthDamageBonus, rollPhysicalWeaponDamage,
    shadeBlocksWeaponBaseDamage,
} from './weapon_damage.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';

const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;

function heroIsPolymorphed(state) {
    return Upolyd(state.u);
}

function heroStillHasTheirRace(state) {
    if (!heroIsPolymorphed(state)) return true;
    const raceFlag = state.urace?.selfmask;
    return !!raceFlag
        && !!((MONSTER_FLAGS2[state.u?.umonnum] ?? 0) & raceFlag);
}

function bowGlovePenalty(state) {
    if (OBJECT_SUBTYPE[state.uwep?.otyp] !== P_BOW) return 0;
    const gloves = state.uarmg || state.u?.uarmg;
    if (gloves?.otyp === GAUNTLETS_OF_POWER) return -2;
    if (gloves?.otyp === GAUNTLETS_OF_FUMBLING) return -3;
    return 0;
}

function bowTrainingHitBonus(state, launcher) {
    if (OBJECT_SUBTYPE[launcher?.otyp] !== P_BOW
        || !heroStillHasTheirRace(state)) return 0;
    const elf = state.urace?.key === 'elf' || state.urace?.noun === 'elf';
    const samurai = state.urole?.key === 'samurai';
    if (!elf && !samurai) return 0;
    const ownBow = (elf && launcher.otyp === ELVEN_BOW)
        || (samurai && launcher.otyp === YUMI);
    return ownBow ? 2 : 1;
}

function matchingBowDamageBonus(state, ammunition, launcher) {
    if (state.urole?.key === 'samurai'
        && ammunition.otyp === YA && launcher.otyp === YUMI) return 1;
    const elf = state.urace?.key === 'elf' || state.urace?.noun === 'elf';
    return Number(elf
        && ammunition.otyp === ELVEN_ARROW
        && launcher.otyp === ELVEN_BOW);
}

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

function targetObject(monster, state, known = false) {
    if (!known && !canProjectMonster(monster, monster.mx, monster.my))
        return '';
    const name = targetName(monster, state);
    return monster.name || monster.isshk ? name : `the ${name}`;
}

function baseRangedHitThreshold(monster, weapon, state) {
    const distance = Math.max(
        Math.abs(monster.mx - state.u.ux),
        Math.abs(monster.my - state.u.uy),
    );
    const polymorphed = heroIsPolymorphed(state);
    const heroLevel = polymorphed
        ? state.u?.m_lev ?? MONSTER_LEVEL[state.u?.umonnum]
            ?? state.u?.ulevel ?? 1
        : state.u?.ulevel ?? 1;
    const targetFlags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    const threshold = -1
        + (state.u?.uluck ?? state.u?.luck ?? state.Luck ?? 0)
        + findMonsterArmorClass(monster)
        + (state.u?.uhitinc ?? 0)
        + heroLevel
        + dexterityHitBonus(state)
        + Math.max(-4, 3 - distance)
        + bowGlovePenalty(state)
        + rangedTargetHitBonus(weapon, monster, { state, defenderNotices: true });

    const targetIsOrc = !!(targetFlags & M2_ORC);
    const heroIsElf = polymorphed
        ? !!((MONSTER_FLAGS2[state.u?.umonnum] ?? 0) & M2_ELF)
        : state.urace?.key === 'elf' || state.urace?.noun === 'elf';
    return threshold + (targetIsOrc && heroIsElf ? 1 : 0);
}

function throwingHitBonus(monster, weapon, state) {
    const skill = Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0);
    if (isLauncherAmmunition(weapon)) {
        const launcher = state.uwep;
        if (!launcherMatchesAmmo(weapon, launcher)) return -4;
        const erosion = Math.max(
            launcher.oeroded ?? 0, launcher.oeroded2 ?? 0,
        );
        return launcher.spe - erosion
            + weaponSkillHitBonus(
                state, Math.abs(OBJECT_SUBTYPE[launcher.otyp] ?? 0),
            )
            + artifactToHitBonus(launcher, monster, rnd, { state })
            + bowTrainingHitBonus(state, launcher);
    }

    const bonus = weapon.otyp === BOOMERANG ? 4
        : isThrowingWeapon(weapon) ? 2 : -2;
    return bonus + weaponSkillHitBonus(state, skill);
}

async function rollRangedObjectDamage(
    monster, weapon, state, dieRoll, mode, {
        targetKnown = false,
        targetVisible = null,
    } = {},
) {
    const applied = mode === 'applied';
    const launcher = mode === 'thrown'
        && launcherMatchesAmmo(weapon, state.uwep) ? state.uwep : null;
    const handThrownAmmunition = mode === 'thrown'
        && isLauncherAmmunition(weapon) && !launcher;
    let damage = handThrownAmmunition
        ? rnd(2) : rollPhysicalWeaponDamage(weapon, monster);
    if (handThrownAmmunition
        && shadeBlocksWeaponBaseDamage(weapon, monster)) damage = 0;
    if (damage === 0 && monsterIsShade(monster)) {
        return {
            damage: 0,
            practiceSkill: null,
            specialMessage: false,
            attackStopped: false,
            poison: null,
        };
    }
    const baseDamage = damage;
    let specialMessage = false;
    let attackStopped = false;
    if (!handThrownAmmunition) {
        const artifactHit = await applyArtifactHitToMonster(
            weapon, monster, damage, {
                state,
                visible: targetVisible ?? canProjectMonster(
                    monster, monster.mx, monster.my,
                ),
                describeTarget: () => targetObject(
                    monster, state, targetKnown,
                ) || 'it',
                describeCarrier: () => targetName(monster, state),
                publish: plineWithContinuation,
                dieRoll,
            },
        );
        damage = artifactHit.damage;
        specialMessage = artifactHit.specialMessage;
        attackStopped = artifactHit.attackStopped;
    }

    let practiceSkill = null;
    if (applied) {
        const skill = Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0);
        damage += (state.u?.udaminc ?? state.udaminc ?? 0)
            + heroStrengthDamageBonus(state)
            + weaponSkillDamageBonus(state, skill);
        if (baseDamage > 1) practiceSkill = skill;
    } else if (mode === 'thrown') {
        damage += state.u?.udaminc ?? state.udaminc ?? 0;
        if (launcher) {
            const skill = Math.abs(OBJECT_SUBTYPE[launcher.otyp] ?? 0);
            damage += weaponSkillDamageBonus(state, skill)
                + matchingBowDamageBonus(state, weapon, launcher);
            if (baseDamage > 0) practiceSkill = skill;
        } else {
            damage += heroStrengthDamageBonus(state);
            if (!handThrownAmmunition) {
                const skill = Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0);
                damage += weaponSkillDamageBonus(state, skill);
                if (baseDamage > 1) practiceSkill = skill;
            }
        }
    }
    const poison = attackStopped ? null : await resolveHeroWeaponPoison(
        monster, weapon, {
            state,
            mode,
            dieRoll,
            publish: plineWithContinuation,
        },
    );
    damage += poison?.damage ?? 0;
    return {
        damage: attackStopped ? 0 : Math.max(1, damage),
        practiceSkill,
        specialMessage,
        attackStopped,
        poison,
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

function rangedObjectUsesWeaponHit(object) {
    const objectClass = object.oclass ?? objectClassForType(object.otyp);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return objectClass === WEAPON_CLASS || objectClass === GEM_CLASS
        || (objectClass === TOOL_CLASS && skill !== 0);
}

async function hitMonsterWithRangedObject(
    monster, object, state, mode, {
        guaranteedHit = false,
        finishKillWithObject = null,
    } = {},
) {
    const applied = mode === 'applied';
    const targetKnown = guaranteedHit;
    const targetVisible = guaranteedHit ? !heroIsBlind(state) : null;
    if (applied) await applyCaitiffPenalty(monster, state);
    let threshold = baseRangedHitThreshold(monster, object, state);
    const dieRoll = rnd(20);
    if (applied) {
        const skill = Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0);
        threshold += weaponSkillHitBonus(state, skill);
    } else if (mode === 'thrown') {
        threshold += throwingHitBonus(monster, object, state);
    } else {
        threshold -= isLauncherAmmunition(object) ? 5 : 3;
    }
    const plainName = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const name = object.opoisoned && isPoisonableObject(object)
        ? `poisoned ${plainName}` : plainName;

    if (!guaranteedHit && ((!applied && !rangedObjectUsesWeaponHit(object))
        || threshold < dieRoll)) {
        const namedTarget = targetObject(monster, state, targetKnown);
        await plineWithContinuation(
            `The ${name} misses${namedTarget ? ` ${namedTarget}` : ''}.`,
        );
        if (rn2(3) === 0) await wakeAttackedMonster(monster);
        return { hit: false, consumed: false, result: false };
    }

    if (!applied) await applyCaitiffPenalty(monster, state);
    const {
        damage, practiceSkill, specialMessage, attackStopped, poison,
    } = await rollRangedObjectDamage(
        monster, object, state, dieRoll, mode, {
            targetKnown,
            targetVisible,
        },
    );
    if (attackStopped) {
        exerciseAttribute(A_DEX, true, state);
        await applyMonsterPassiveToObject(monster, object);
        return { hit: true, consumed: false, result: true };
    }
    if (applied) {
        recordWeaponHit(object, damage, state);
    }
    if (practiceSkill !== null)
        recordWeaponPractice(state, practiceSkill, 1);

    if (damage === 0) {
        const namedTarget = targetObject(monster, state, targetKnown);
        if (!specialMessage) {
            await plineWithContinuation(
                `The ${name} passes harmlessly through ${
                    namedTarget || 'it'
                }.`,
            );
        }
        await wakeAttackedMonster(monster);
        exerciseAttribute(A_DEX, true, state);
        await applyMonsterPassiveToObject(monster, object);
        return { hit: true, consumed: false, result: true };
    }

    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    await abusePetAfterHeroHit(monster, damage, state);
    let result = true;
    let objectMovedByDeath = false;
    const killedByDamage = monster.mhp <= 0;
    if (!killedByDamage) {
        const namedTarget = targetObject(monster, state, targetKnown);
        const punctuation = (targetVisible ?? canSeeMonster(
            monster, monster.mx, monster.my,
        ))
            && damage > 4 ? '!' : '.';
        if (!specialMessage) {
            await plineWithContinuation(
                `The ${name} hits ${namedTarget || 'it'}${punctuation}`,
            );
        }
    }
    if (poison?.resisted) {
        await plineWithContinuation(
            `The poison doesn't seem to affect ${
                targetObject(monster, state, targetKnown) || 'it'
            }.`,
        );
    }
    if (poison?.deadly)
        await plineWithContinuation('The poison was deadly...');
    if (poison?.deadly || killedByDamage) {
        if (finishKillWithObject) {
            result = await finishKillWithObject(monster, object);
            objectMovedByDeath = true;
        } else {
            result = await finishHeroMonsterKill(
                monster, monster.mx, monster.my, {
                    hallucinating: !!(state.u?.hallucinating
                        || (state.u?.hallucinationTurns ?? 0) > 0),
                    nameMonster: () => targetName(monster, state),
                    showKillMessage: !poison?.deadly,
                },
            );
        }
    } else {
        await wakeAttackedMonster(monster);
        if (applied) {
            const fleeRoll = rn2(25);
            if (fleeRoll === 0
                && monster.mhp
                    < Math.trunc((monster.mhpmax ?? monster.mhp) / 2)) {
                if (rn2(3) === 0) rnd(100);
                monster.mflee = 1;
            }
        }
    }
    if (poison?.woreOff) {
        await plineWithContinuation(
            `Your ${plainName} is no longer poisoned.`,
        );
    }

    exerciseAttribute(A_DEX, true, state);
    if (objectMovedByDeath)
        return { hit: true, consumed: true, result };
    if (!applied && shouldMulchMissile(object)) {
        await chargeUnpaidObjectAsDebt(object, state);
        destroyMulchedProjectile(object);
        return { hit: true, consumed: true, result };
    }
    await applyMonsterPassiveToObject(monster, object);
    return { hit: true, consumed: false, result };
}

export async function hitMonsterWithAppliedWeapon(
    monster, weapon, { state = game } = {},
) {
    const hit = await hitMonsterWithRangedObject(
        monster, weapon, state, 'applied',
    );
    return hit.result;
}

export function hitMonsterWithKickedObject(
    monster, object, { state = game } = {},
) {
    return hitMonsterWithRangedObject(monster, object, state, 'kicked');
}

export function hitMonsterWithThrownObject(
    monster, object, {
        state = game,
        guaranteedHit = false,
        finishKillWithObject = null,
    } = {},
) {
    return hitMonsterWithRangedObject(monster, object, state, 'thrown', {
        guaranteedHit,
        finishKillWithObject,
    });
}
