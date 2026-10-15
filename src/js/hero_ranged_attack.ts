// Hero ranged hit admission. Native dothrow.c:thitmonst() owns accuracy,
// exercise, worm cutting, missile destruction, and object passive effects.
// Damage, messages, and death share uhitm.c:hmon() with melee.
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { artifactToHitBonus } from './artifacts.js';
import { A_DEX, A_STR, P_BOW, Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { hitMonsterWithHeroObject } from './hero_physical_hit.js';
import { reportHeroThrownMiss } from './hero_physical_messages.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { MONSTER_FLAGS2, MONSTER_LEVEL } from './monster_data.js';
import { applyMonsterPassiveToObject } from './monster_passive.js';
import { cutWorm } from './monster_worm.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    BOOMERANG, BOULDER, ELVEN_BOW, GAUNTLETS_OF_FUMBLING,
    GAUNTLETS_OF_POWER, HEAVY_IRON_BALL, OBJECT_SUBTYPE, YUMI,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import { isLauncherAmmunition, isThrowingWeapon, launcherMatchesAmmo } from './object_properties.js';
import { destroyMulchedProjectile, shouldMulchMissile } from './projectile.js';
import { rnd, rn2 } from './rng.js';
import { chargeUnpaidObjectAsDebt } from './shk.js';
import { weaponSkillHitBonus } from './skills.js';
import { offerThrownFood } from './thrown_food.js';
import { hitMonsterWithThrownEggPieOrVenom } from './hero_thrown_egg_pie_venom.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';
import { isAxe } from './weapon_type.js';
import { catchQuestObject } from './quest_leader_catch.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import type { FinishHeroMonsterDeath, HeroMonsterKillOptions, HeroMonsterKillOutcome } from './hero_monster_death.js';
import type { Position } from './map_types.js';
import type { HeroProjectileVolley } from './hero_physical_types.js';

export type RangedAttackMode = 'applied' | 'thrown' | 'kicked';

export type FinishKillWithObject = (
    monster: Monster, object: GameObject, options?: HeroMonsterKillOptions,
) => Promise<HeroMonsterKillOutcome>;

export interface RangedObjectHitOptions {
    state?: GameState;
    guaranteedHit?: boolean;
    finishKillWithObject?: FinishKillWithObject | null;
    checkCaitiff?: boolean;
    target?: Position;
    volley?: HeroProjectileVolley;
}

export type RangedObjectHitResult = { heroDied: true } | {
    heroDied?: false;
    hit: boolean;
    consumed: boolean;
};

const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;

function heroIsPolymorphed(state: PlayingGameState) {
    return Upolyd(state.u);
}

function heroStillHasTheirRace(state: PlayingGameState) {
    if (!heroIsPolymorphed(state)) return true;
    const raceFlag = state.urace?.selfmask;
    return !!raceFlag
        && !!((MONSTER_FLAGS2[state.u?.umonnum] ?? 0) & raceFlag);
}

function bowGlovePenalty(state: PlayingGameState) {
    if (!state.uwep || OBJECT_SUBTYPE[state.uwep.otyp] !== P_BOW) return 0;
    const gloves = state.uarmg || state.u?.uarmg;
    if (gloves?.otyp === GAUNTLETS_OF_POWER) return -2;
    if (gloves?.otyp === GAUNTLETS_OF_FUMBLING) return -3;
    return 0;
}

function bowTrainingHitBonus(state: PlayingGameState, launcher: GameObject) {
    if (OBJECT_SUBTYPE[launcher?.otyp] !== P_BOW
        || !heroStillHasTheirRace(state)) return 0;
    const elf = state.urace.name === 'elf';
    const samurai = state.urole?.key === 'samurai';
    if (!elf && !samurai) return 0;
    const ownBow = (elf && launcher.otyp === ELVEN_BOW)
        || (samurai && launcher.otyp === YUMI);
    return ownBow ? 2 : 1;
}

function dexterityHitBonus(state: PlayingGameState) {
    const dexterity = currentAttribute(A_DEX, state);
    if (dexterity < 4) return -3;
    if (dexterity < 6) return -2;
    if (dexterity < 8) return -1;
    return dexterity >= 14 ? dexterity - 14 : 0;
}

function baseRangedHitThreshold(monster: Monster, weapon: GameObject, state: PlayingGameState) {
    const distance = Math.max(
        Math.abs(monster.mx - state.u.ux),
        Math.abs(monster.my - state.u.uy),
    );
    const polymorphed = heroIsPolymorphed(state);
    const heroLevel = polymorphed
        ? MONSTER_LEVEL[state.u?.umonnum]
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
        : state.urace.name === 'elf';
    return threshold + (targetIsOrc && heroIsElf ? 1 : 0);
}

function throwingHitBonus(monster: Monster, weapon: GameObject, state: PlayingGameState) {
    const skill = Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0);
    if (isLauncherAmmunition(weapon)) {
        const launcher = state.uwep;
        if (!launcher || !launcherMatchesAmmo(weapon, launcher)) return -4;
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

function rangedObjectUsesWeaponHit(object: GameObject) {
    const objectClass = object.oclass ?? objectClassForType(object.otyp);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return objectClass === WEAPON_CLASS || objectClass === GEM_CLASS
        || (objectClass === TOOL_CLASS && skill !== 0);
}

async function hitMonsterWithRangedObject(
    monster: Monster, object: GameObject, state: PlayingGameState, mode: RangedAttackMode, {
        guaranteedHit = false, finishKillWithObject = null, checkCaitiff = true,
        target = { x: monster.mx, y: monster.my }, volley,
    }: Omit<RangedObjectHitOptions, 'state'> = {},
): Promise<RangedObjectHitResult> {
    const applied = mode === 'applied';
    if (applied && checkCaitiff) await applyCaitiffPenalty(monster, state);
    let threshold = baseRangedHitThreshold(monster, object, state);
    if (guaranteedHit) threshold += 1000;
    if (!applied) {
        const caught = await catchQuestObject(monster, object, state);
        if (caught !== null) return { hit: caught, consumed: caught };
    }
    const dieRoll = rnd(20);
    const weaponHit = rangedObjectUsesWeaponHit(object);
    const heavyObject = object.otyp === BOULDER || object.otyp === HEAVY_IRON_BALL;
    const swallowedBall = object.otyp === HEAVY_IRON_BALL
        && !!state.u.uswallow && state.u.ustuck === monster && object === state.uball;
    if (weaponHit) {
        if (mode === 'kicked') threshold -= isLauncherAmmunition(object) ? 5 : 3;
        else if (mode === 'thrown') threshold += throwingHitBonus(monster, object, state);
        else threshold += weaponSkillHitBonus(state, Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0));
    } else if (heavyObject) {
        await exerciseAttribute(A_STR, true, state);
    } else {
        const food = await offerThrownFood(monster, object, state);
        if (food?.heroDied) return food;
        if (food) return { hit: food.handled, consumed: food.handled };
        return missRangedObject(monster, object, state, target, applied, volley);
    }

    if (threshold < dieRoll)
        return missRangedObject(monster, object, state, target, applied, volley);

    if (applied) state.u.uconduct.weaphit = (state.u.uconduct.weaphit ?? 0) + 1;
    // Ball and boulder attempts exercise Strength above. Unlike weapon hits,
    // their successful attempts exercise Dexterity before hmon's effects.
    if (heavyObject) await exerciseAttribute(A_DEX, true, state);
    const chopper = isAxe(object);
    let objectMovedByDeath = false;
    const finishMonsterDeath: FinishHeroMonsterDeath | undefined = finishKillWithObject
        ? async (targetMonster, options) => {
            const death = await finishKillWithObject(targetMonster, object, options);
            objectMovedByDeath = true;
            return death;
        } : undefined;
    const hit = await hitMonsterWithHeroObject(monster, object, {
        mode, dieRoll, target, state,
        ...(volley ? { volley } : {}),
        ...(finishMonsterDeath ? { finishMonsterDeath } : {}),
    });
    if (hit.heroDied) return { heroDied: true };
    if (heavyObject)
        return {
            hit: true,
            consumed: hit.objectConsumed || objectMovedByDeath
                || swallowedBall && !hit.survived && !state.u.uswallow,
        };

    if (hit.survived && monster.wormno)
        await cutWorm(monster, target.x, target.y, chopper, { state });
    if (state.program_state.gameover) return { heroDied: true };
    await exerciseAttribute(A_DEX, true, state);
    if (hit.objectConsumed || objectMovedByDeath)
        return { hit: true, consumed: true };
    if (shouldMulchMissile(object)) {
        await chargeUnpaidObjectAsDebt(object, state);
        destroyMulchedProjectile(object);
        return { hit: true, consumed: true };
    }
    await applyMonsterPassiveToObject(monster, object);
    return { hit: true, consumed: false };
}

async function missRangedObject(
    monster: Monster, object: GameObject, state: PlayingGameState,
    target: Position, applied: boolean, volley?: HeroProjectileVolley,
): Promise<RangedObjectHitResult> {
    await reportHeroThrownMiss(monster, object, {
        state, target, ...(volley ? { volley } : {}),
    });
    if (rn2(3) === 0) {
        if ((await wakeAttackedMonster(monster)).heroDied) return { heroDied: true };
    }
    if (applied && (await wakeAttackedMonster(monster)).heroDied) return { heroDied: true };
    return { hit: false, consumed: false };
}

export async function hitMonsterWithAppliedWeapon(
    monster: Monster, weapon: GameObject,
    { state = game, checkCaitiff = true, target }: Pick<RangedObjectHitOptions, 'state' | 'checkCaitiff' | 'target'> = {},
): Promise<RangedObjectHitResult> {
    requirePlayingGame(state);
    return hitMonsterWithRangedObject(monster, weapon, state, 'applied', { checkCaitiff, ...(target ? { target } : {}) });
}

export async function hitMonsterWithKickedObject(
    monster: Monster, object: GameObject,
    { state = game, target = { x: monster.mx, y: monster.my } }: Pick<RangedObjectHitOptions, 'state' | 'target'> = {},
): Promise<RangedObjectHitResult> {
    requirePlayingGame(state);
    const splash = await hitMonsterWithThrownEggPieOrVenom(monster, object, {
        state, mode: 'kicked', target,
    });
    if (splash) return splash;
    return hitMonsterWithRangedObject(monster, object, state, 'kicked', { target });
}

export function hitMonsterWithThrownObject(
    monster: Monster, object: GameObject,
    { state = game, ...options }: Omit<RangedObjectHitOptions, 'checkCaitiff'> = {},
): Promise<RangedObjectHitResult> {
    requirePlayingGame(state);
    return hitMonsterWithRangedObject(monster, object, state, 'thrown', options);
}

// C do.c:flooreffects() calls hmon(HMON_THROWN, 1), without thitmonst's
// accuracy, Dexterity exercise, missile mulch, or thrown-object passive work.
export async function hitMonsterWithSettlingBoulder(monster: Monster, boulder: GameObject, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<{ heroDied: boolean }> {
    const hit = await hitMonsterWithHeroObject(monster, boulder, {
        state, publish, mode: 'thrown', dieRoll: 1,
    });
    return { heroDied: hit.heroDied };
}
