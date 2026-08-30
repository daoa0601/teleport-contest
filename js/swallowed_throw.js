// swallowed_throw.js — Generic non-consuming projectile contact while engulfed.
// C refs: dothrow.c throw_obj(), throwit(), thitmonst(), swallowit();
// steal.c mpickobj().

import { W_SADDLE } from './const.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { endLampBurn } from './light.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    BOULDER, BRASS_LANTERN, MAGIC_LAMP, OBJECT_MATERIAL,
    OBJECT_NAMES, OBJECT_SUBTYPE, OIL_LAMP,
} from './object_data.js';
import {
    MONSTER_ATTACKS, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from './object_timers.js';
import { rnd } from './rng.js';
import {
    applyProjectileObjectPassive, destroyMulchedProjectile, projectileKind,
    shouldMulchMissile,
} from './projectile.js';
import {
    hitMonsterWithSupportedPotion, maximumSupportedPotionFatalDamage,
    supportedPotionTargetGap,
    SUPPORTED_MONSTER_POTION_TYPES,
} from './potion_hit.js';
import { heroIsBlind } from './senses.js';
import {
    recordWeaponPractice, weaponSkillDamageBonus,
} from './skills.js';
import { objectTypeKnown } from './shk.js';
import {
    maximumPhysicalWeaponDamage, rollPhysicalWeaponDamage,
    strengthDamageBonus,
} from './weapon_damage.js';
import { detachThrownUnit } from './thrown_object.js';
import {
    applyLowStaminaThrow, applyThrowSlip, thrownObjectName,
} from './throw_state.js';

const PM_AIR_ELEMENTAL = 154;
const AT_ENGL = 11;
const AD_DGST = 26;
const POTION_CLASS = 8;
const TIMED_LAMP_TYPES = new Set([BRASS_LANTERN, OIL_LAMP]);
const LAMP_TYPES = new Set([...TIMED_LAMP_TYPES, MAGIC_LAMP]);
const SILVER = 14;
const IRON = 11;
const LAUNCHER_SKILLS = new Set([20, 21, 22]);
const AXE_NAMES = new Set(['axe', 'battle-axe']);
const THROWING_WEAPON_NAMES = new Set([
    'dagger', 'elven dagger', 'orcish dagger', 'silver dagger', 'athame',
    'knife', 'crysknife', 'war hammer', 'aklys',
]);

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function containsUnpaidObject(object) {
    if (!object) return false;
    if (object.unpaid) return true;
    return (object.contents || []).some(containsUnpaidObject);
}

function itemIsEquipped(state, item) {
    return EQUIPMENT_SLOTS.some(slot =>
        state[slot] === item || state.u?.[slot] === item)
        || !!(item.owornmask ?? 0);
}

function projectileIsEquipped(state, item) {
    return EQUIPMENT_SLOTS.filter(slot => slot !== 'uquiver').some(slot =>
        state[slot] === item || state.u?.[slot] === item)
        || !!((item.owornmask ?? 0) && state.uquiver !== item
            && state.u?.uquiver !== item);
}

function activeObjectTimerCount(item) {
    return Math.max(
        item.timed ?? 0,
        Array.isArray(item.objectTimers) ? item.objectTimers.length : 0,
    );
}

function hasEngulfAttack(monster) {
    return MONSTER_ATTACKS[monster?.mnum]?.some(attack =>
        attack[0] === AT_ENGL);
}

function supportedLitLamp(state, item, engulfer) {
    if (!item.lamplit) return true;
    if (!LAMP_TYPES.has(item.otyp) || item.artifact || item.oartifact
        || !hasEngulfAttack(engulfer)) return false;
    const timers = objectTimers(item);
    if (item.otyp === MAGIC_LAMP) return timers.length === 0;
    return timers.length === 1
        && timers[0].kind === OBJECT_TIMER_KIND.BURN_OBJECT
        && Number.isFinite(timers[0].deadline)
        && timers[0].deadline >= (state.moves ?? 0);
}

function monsterHasObjectPassive(monster) {
    return MONSTER_ATTACKS[monster?.mnum]?.some(attack =>
        attack[0] === 0 && (attack[1] || attack[2] || attack[3]));
}

function intendedThrowingWeapon(item) {
    const skill = Math.abs(OBJECT_SUBTYPE[item.otyp] ?? 0);
    return skill === 17 || THROWING_WEAPON_NAMES.has(OBJECT_NAMES[item.otyp]);
}

function swallowedWeaponEligibility(
    state, item, objectClass, selectedQuantity,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer) return null;
    const subtype = OBJECT_SUBTYPE[item.otyp] ?? 0;
    const weaponOrTool = objectClass === 2
        || (objectClass === 6 && subtype !== 0);
    const skill = Math.abs(subtype);
    const material = OBJECT_MATERIAL[item.otyp] ?? 0;
    const skillState = state.u?.weaponSkills?.[skill];

    // This owner deliberately enters hmon()'s ordinary physical survivor
    // path. Ammo/missiles, launchers, special material/target bonuses,
    // poison, artifacts, passives, attitude changes, and engulfer death all
    // retain separate fail-closed continuations.
    if (!weaponOrTool || subtype <= 0 || LAUNCHER_SKILLS.has(skill)
        || (selectedQuantity > 1 && objectClass === 2)
        || !skillState || !Number.isInteger(skillState.skill)
        || material < IRON || material === SILVER
        || AXE_NAMES.has(OBJECT_NAMES[item.otyp])
        || item.blessed || item.opoisoned || item.oartifact || item.artifact
        || item.lamplit || containsUnpaidObject(item)
        || itemIsEquipped(state, item)
        || activeObjectTimerCount(item) > 0
        || engulfer.mpeaceful || engulfer.mtame || engulfer.pet
        || engulfer.wormno || MONSTER_NAME[engulfer.mnum] === 'shade'
        || monsterHasObjectPassive(engulfer)
        || state.u?.polymorphed || state.u?.upolyd
        || state.u?.twoweap || state.twoweap) return null;
    if (selectedQuantity > 1 && activeObjectTimerCount(item) > 0)
        return null;

    const baseMaximum = maximumPhysicalWeaponDamage(item, engulfer);
    if (baseMaximum <= 0) return null;
    const maximumDamage = Math.max(
        1,
        baseMaximum
            + (state.u?.udaminc ?? state.udaminc ?? 0)
            + strengthDamageBonus(currentAttribute(0, state))
            + weaponSkillDamageBonus(state, skill),
    );
    if (!Number.isFinite(engulfer.mhp)) return null;
    return { engulfer, skill, maximumDamage };
}

function swallowedProjectileEligibility(
    state, item, objectClass, selectedQuantity,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    const kind = projectileKind(item);
    if (!engulfer || objectClass !== 2 || !kind
        || selectedQuantity !== 1) return null;

    const subtype = OBJECT_SUBTYPE[item.otyp] ?? 0;
    const wielded = state.uwep ?? state.u?.uwep ?? null;
    const launcher = kind === 'ammunition' && wielded
        && (OBJECT_SUBTYPE[wielded.otyp] ?? 0) === -subtype
        ? wielded : null;
    const skill = launcher
        ? Math.abs(OBJECT_SUBTYPE[launcher.otyp] ?? 0)
        : kind === 'missile' ? Math.abs(subtype) : null;
    const skillState = skill == null ? null : state.u?.weaponSkills?.[skill];
    const material = OBJECT_MATERIAL[item.otyp] ?? 0;
    const itemName = OBJECT_NAMES[item.otyp] ?? '';
    const launcherName = OBJECT_NAMES[launcher?.otyp] ?? '';
    const roleDamage = state.urole?.key === 'samurai'
        && itemName === 'ya' && launcherName === 'yumi'
        ? 1
        : state.urace?.key === 'elf'
            && itemName === 'elven arrow' && launcherName === 'elven bow'
            ? 1 : 0;

    // The first shared projectile continuation owns a single ordinary
    // weapon-class identity. Gem/sling ammo, multishot, poison, target
    // material bonuses, returning boomerangs, and kill handling stay behind
    // the named swallowed-weapon bridge.
    if ((skill != null && (!skillState
            || !Number.isInteger(skillState.skill)))
        || material === SILVER || item.blessed || item.opoisoned
        || item.oartifact || item.artifact || item.lamplit
        || containsUnpaidObject(item) || projectileIsEquipped(state, item)
        || activeObjectTimerCount(item) > 0
        || itemName === 'boomerang'
        || engulfer.mpeaceful || engulfer.mtame || engulfer.pet
        || engulfer.wormno || MONSTER_NAME[engulfer.mnum] === 'shade'
        || state.u?.polymorphed || state.u?.upolyd
        || state.u?.twoweap || state.twoweap) return null;

    const baseMaximum = kind === 'ammunition' && !launcher
        ? 2 : maximumPhysicalWeaponDamage(item, engulfer) + roleDamage;
    const maximumDamage = Math.max(
        1,
        baseMaximum
            + (state.u?.udaminc ?? state.udaminc ?? 0)
            + (launcher ? 0 : strengthDamageBonus(currentAttribute(0, state)))
            + (skill == null ? 0 : weaponSkillDamageBonus(state, skill)),
    );
    if (baseMaximum <= 0 || !Number.isFinite(engulfer.mhp)) return null;
    return {
        engulfer, kind, launcher, skill, roleDamage, maximumDamage,
    };
}

function genericSwallowedEligibility(
    state, item, objectClass, selectedQuantity,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer) return null;

    // Weapon/gem damage, food/taming, effectful potions, balls, boulders,
    // venom,
    // shop objects, worn-state removal, unsupported burning objects, and
    // timed stack splitting own materially different continuations and
    // remain explicit successors.  The supported lamps below reuse the
    // live burn-timer owner after mpickobj() has linked monster ownership.
    if ([2, 7, 8, 12, 13, 15, 17].includes(objectClass)
        || item.otyp === BOULDER
        || item === state.uball || item === state.u?.uball) return null;
    if (objectClass === 6 && (OBJECT_SUBTYPE[item.otyp] ?? 0) !== 0)
        return null; // is_weptool()
    if (itemIsEquipped(state, item)) return null;
    if (!supportedLitLamp(state, item, engulfer)
        || containsUnpaidObject(item)) return null;
    if (selectedQuantity > 1
        && ((item.timed ?? 0) > 0 || (item.objectTimers?.length ?? 0) > 0)) {
        return null;
    }
    return engulfer;
}

function swallowedPotionEligibility(
    state, item, objectClass, selectedQuantity, canFinishKill, finishKill,
) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1) {
        return null;
    }

    // potionhit() can divert into saddle dipping, shop settlement, interactive
    // trycall(), or special identity cleanup. Keep those owners fail-loud
    // before splitobj(), freeinv(), or the mandatory thitmonst() dieroll.
    if (((engulfer.misc_worn_check ?? 0) & W_SADDLE)
        || engulfer.saddle
        || itemIsEquipped(state, item)
        || containsUnpaidObject(item)
        || item.lamplit || item.oartifact || item.artifact
        || activeObjectTimerCount(item) > 0
        || (item.contents?.length ?? 0) > 0
        || (item.dknown !== false && !objectTypeKnown(item, state))) {
        return null;
    }

    if (supportedPotionTargetGap({
        state, potion: item, monster: engulfer,
    })) return null;
    const maximumFatalDamage = maximumSupportedPotionFatalDamage(
        item, engulfer,
    );
    if (maximumFatalDamage > 0 && engulfer.mhp <= maximumFatalDamage
        && (!finishKill || !canFinishKill?.(engulfer))) return null;
    return engulfer;
}

export async function resolveSwallowedProjectileThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    wakeMonster,
    canFinishKill,
    finishKill,
}) {
    const eligible = swallowedProjectileEligibility(
        state, item, objectClass, selectedQuantity,
    );
    if (!eligible) return false;
    const {
        engulfer, kind, launcher, skill, roleDamage, maximumDamage,
    } = eligible;
    // A potential fatal roll must have a complete source continuation before
    // freeinv()/splitobj() detaches the real object or any combat RNG advances.
    if (engulfer.mhp <= maximumDamage
        && (!finishKill || !canFinishKill?.(engulfer))) return false;
    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    await applyThrowSlip({
        state,
        object: thrown,
        launcher: !!launcher,
        throwingWeapon: kind === 'missile',
    });
    await applyLowStaminaThrow({ state, object: thrown });

    rnd(20);
    const unlaunchedAmmo = kind === 'ammunition' && !launcher;
    const physicalDamage = unlaunchedAmmo
        ? rnd(2) : rollPhysicalWeaponDamage(thrown, engulfer) + roleDamage;
    const trains = launcher ? physicalDamage > 0 : physicalDamage > 1;
    if (skill != null && trains) recordWeaponPractice(state, skill, 1);
    const damage = Math.max(
        1,
        physicalDamage
            + (state.u?.udaminc ?? state.udaminc ?? 0)
            + (launcher ? 0 : strengthDamageBonus(currentAttribute(0, state)))
            + (skill == null ? 0 : weaponSkillDamageBonus(state, skill)),
    );
    engulfer.mhp -= damage;

    const monsterName = engulfer.name
        || `the ${monsterTypeName(engulfer.mnum, !!engulfer.female)}`;
    await plineWithContinuation(
        `The ${thrownObjectName(thrown, state)} hits ${monsterName}${
            damage > 4 ? '!' : '.'
        }`,
    );
    if (engulfer.mhp <= 0) {
        // hmon()->xkilled() consumes the killing missile through mpickobj(),
        // then thitmonst() returns past exercise without mulch or passive_obj.
        await finishKill(engulfer, thrown);
        exerciseAttribute(1, true, state);
        state.context.move = 1;
        return true;
    }
    await wakeMonster(engulfer);
    exerciseAttribute(1, true, state);

    if (shouldMulchMissile(thrown)) {
        destroyMulchedProjectile(thrown);
        state.context.move = 1;
        return true;
    }
    await applyProjectileObjectPassive(engulfer, thrown);
    addObjectToMonsterInventory(
        engulfer, thrown, state, { atFront: true },
    );
    state.context.move = 1;
    return true;
}

export async function resolveSwallowedWeaponThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    wakeMonster,
    canFinishKill,
    finishKill,
}) {
    const eligible = swallowedWeaponEligibility(
        state, item, objectClass, selectedQuantity,
    );
    if (!eligible) return false;
    const { engulfer, skill, maximumDamage } = eligible;
    if (engulfer.mhp <= maximumDamage
        && (!finishKill || !canFinishKill?.(engulfer))) return false;
    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    await applyThrowSlip({
        state,
        object: thrown,
        throwingWeapon: intendedThrowingWeapon(thrown),
    });
    await applyLowStaminaThrow({ state, object: thrown });

    rnd(20); // thitmonst() consumes its guaranteed-hit dieroll first
    const physicalDamage = rollPhysicalWeaponDamage(thrown, engulfer);
    if (physicalDamage > 1) recordWeaponPractice(state, skill, 1);
    const damage = Math.max(
        1,
        physicalDamage
            + (state.u?.udaminc ?? state.udaminc ?? 0)
            + strengthDamageBonus(currentAttribute(0, state))
            + weaponSkillDamageBonus(state, skill),
    );
    engulfer.mhp -= damage;

    const monsterName = engulfer.name
        || `the ${monsterTypeName(engulfer.mnum, !!engulfer.female)}`;
    await plineWithContinuation(
        `The ${thrownObjectName(thrown, state)} hits ${monsterName}${
            damage > 4 ? '!' : '.'
        }`,
    );
    if (engulfer.mhp <= 0) {
        await finishKill(engulfer, thrown);
        exerciseAttribute(1, true, state);
        state.context.move = 1;
        return true;
    }
    await wakeMonster(engulfer);
    exerciseAttribute(1, true, state);

    addObjectToMonsterInventory(
        engulfer, thrown, state, { atFront: true },
    );
    state.context.move = 1;
    return true;
}

export async function resolveSwallowedPotionThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    wakeMonster,
    wakeNearby,
    canFinishKill,
    finishKill,
}) {
    const engulfer = swallowedPotionEligibility(
        state, item, objectClass, selectedQuantity, canFinishKill, finishKill,
    );
    if (!engulfer) return false;
    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    // throwit() evaluates its cursed/greased slip draw before thitmonst().
    // Potions only enter the displacement branch when greased, but a cursed
    // ungreased identity still consumes the rn2(7) gate.
    await applyThrowSlip({ state, object: thrown });
    await applyLowStaminaThrow({ state, object: thrown });

    rnd(20);
    await hitMonsterWithSupportedPotion({
        state,
        monster: engulfer,
        potion: thrown,
        wakeMonster,
        wakeNearby,
        finishKill,
        resolveVapor: true,
        distance: 0,
    });
    state.context.move = 1;
    return true;
}

export async function resolveGenericSwallowedThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    wakeMonster,
}) {
    const engulfer = genericSwallowedEligibility(
        state, item, objectClass, selectedQuantity,
    );
    if (!engulfer) return false;

    // freeinv() occurs before throwit() begins slip/contact handling.
    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );
    await applyThrowSlip({ state, object: thrown });
    await applyLowStaminaThrow({ state, object: thrown });

    rnd(20); // thitmonst() consumes dieroll before selecting this class arm
    await wakeMonster(engulfer);
    const monsterName = engulfer.name
        || `the ${monsterTypeName(engulfer.mnum, !!engulfer.female)}`;
    const digests = MONSTER_ATTACKS[engulfer.mnum]?.some(attack =>
        attack[0] === AT_ENGL && attack[1] === AD_DGST);
    const whirly = MONSTER_SYMBOL[engulfer.mnum] === 22
        || engulfer.mnum === PM_AIR_ELEMENTAL;
    const trail = digests ? ' entrails' : whirly ? ' currents' : '';
    const destination = trail
        ? `${possessive(monsterName)}${trail}` : monsterName;
    await plineWithContinuation(
        `The ${thrownObjectName(thrown, state)} vanishes into ${destination}.`,
    );
    const snuffLamp = thrown.lamplit && LAMP_TYPES.has(thrown.otyp)
        && hasEngulfAttack(engulfer);
    if (snuffLamp && !heroIsBlind(state)) {
        await plineWithContinuation(
            `The ${thrownObjectName(thrown, state)} goes out.`,
        );
    }
    addObjectToMonsterInventory(
        engulfer, thrown, state, { atFront: true },
    );
    // steal.c:mpickobj() deliberately waits until add_to_minv() has linked
    // the carrier before snuff_light_source() resolves that mobile light.
    if (snuffLamp) endLampBurn(thrown, state, state.moves ?? 0);
    state.context.move = 1;
    return true;
}
