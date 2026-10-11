// Native uhitm.c:joust(), hmon_hitmon_jousting(), and hmon_hitmon_splitmon().
import { P_ISRESTRICTED, P_TWO_WEAPON_COMBAT, P_UNSKILLED } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordFirstHeroWeaponHit } from './hero_attack_conduct.js';
import { finishHeroLiquidMonsterDeath, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { consumeInventoryItem } from './invent.js';
import { cloneMonster } from './monster_clone.js';
import { MONSTER_NAME, monsterIsUnsolid } from './monster_data.js';
import { hurtleMonster } from './monster_hurtle.js';
import { monsterName } from './monster_name.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { OBJECT_SUBTYPE } from './object_data.js';
import { isLauncherAmmunition, isMissileObject } from './object_properties.js';
import { objectResistsDestruction } from './object_state.js';
import { ownedObjectName } from './objnam.js';
import { d, rn2, rnl } from './rng.js';
import { ensureHeroSkills } from './skills.js';
import { losePrimaryWeapon, setTwoWeaponCombat } from './weapon_slots.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

const IRON = 11;
const METAL = 12;
const PM_BLACK_PUDDING = MONSTER_NAME.indexOf('black pudding');
const PM_BROWN_PUDDING = MONSTER_NAME.indexOf('brown pudding');

// The contact owner admits only mounted, positive-damage melee lance hits
// against an unheld target. These are the remaining native joust() checks.
export function rollHeroJoust(
    monster: Monster, weapon: GameObject, { state = game }: { state?: GameState } = {},
): -1 | 0 | 1 {
    requirePlayingGame(state);
    const hero = state.u;
    if (hero.fumbling || (hero.fumblingTurns ?? 0) > 0
        || hero.stunned || (hero.stunnedTurns ?? 0) > 0 || hero.utrap) return 0;
    const primary = state.uwep || hero.uwep;
    const secondary = state.uswapwep || hero.uswapwep;
    if (weapon !== primary && (weapon !== secondary || !hero.twoweap)) return 0;
    const skills = ensureHeroSkills(state);
    let rating = skills?.[Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0)]?.skill ?? P_ISRESTRICTED;
    if (hero.twoweap)
        rating = Math.min(rating, skills?.[P_TWO_WEAPON_COMBAT]?.skill ?? P_ISRESTRICTED);
    if (rating === P_ISRESTRICTED) rating = P_UNSKILLED;
    const roll = rn2(5);
    if (roll >= rating) return 0;
    if (roll === 0 && rnl(50) === 49 && !monsterIsUnsolid(monster)
        && !objectResistsDestruction(weapon, 0, 100)) return -1;
    return 1;
}

interface JoustImpactOptions {
    damage: number;
    joust: 1 | -1;
    state?: GameState;
    publish?: MessagePublisher;
}

export interface HeroJoustImpact {
    damage: number;
    alreadyKilled: boolean;
    heroDied: boolean;
    specialMessage: true;
    weapon: GameObject | null;
}

export async function resolveHeroJoust(
    monster: Monster, weapon: GameObject,
    { damage, joust, state = game, publish = plineWithContinuation }: JoustImpactOptions,
): Promise<HeroJoustImpact> {
    requirePlayingGame(state);
    damage += d(2, weapon === (state.uwep || state.u.uwep) ? 10 : 2);
    const punctuation = canSeeMonster(monster) ? damage < 0 ? '?' : damage <= 4 ? '.' : '!' : '.';
    await publish(`You joust ${monsterName(monster, { state })}${punctuation}`);
    if ((state.u.uconduct.weaphit ?? 0) <= 1) recordFirstHeroWeaponHit(weapon, state);

    let survivingWeapon: GameObject | null = weapon;
    if (joust < 0) {
        setTwoWeaponCombat(false, state);
        if (weapon === (state.uwep || state.u.uwep)) await losePrimaryWeapon(state);
        await publish(`${ownedObjectName(weapon, state)} shatters on impact!`);
        await consumeInventoryItem(weapon, state);
        // Even when a stack retains another lance, this impact has none.
        survivingWeapon = null;
    }
    let alreadyKilled = false;
    let heroDied = false;
    if (damage < monster.mhp) {
        const movement = await hurtleMonster(monster, state.u.dx ?? 0, state.u.dy ?? 0, 1, {
            state, announce: publish,
            nameMonster: target => monsterName(target, { state }),
            finishMonsterDeath: (target, options) =>
                finishHeroMonsterKillOutcome(target, target.mx, target.my, { ...options, publish }),
            finishLiquidDeath: (target, options) => finishHeroLiquidMonsterDeath(target, options),
        });
        alreadyKilled = !!monster.dead || monster.mhp <= 0;
        heroDied = !!movement.heroDied || !!state.program_state.gameover;
    }
    return { damage, alreadyKilled, heroDied, specialMessage: true, weapon: survivingWeapon };
}

interface PuddingImpactOptions {
    handToHand: boolean;
    material: number;
    offMap: boolean;
    state?: GameState;
    publish?: MessagePublisher;
}

export async function tryHeroPuddingSplit(
    monster: Monster, weapon: GameObject | null,
    { handToHand, material, offMap, state = game, publish = plineWithContinuation }: PuddingImpactOptions,
): Promise<{ split: boolean; heroDied: boolean }> {
    requirePlayingGame(state);
    if ((monster.mnum !== PM_BLACK_PUDDING && monster.mnum !== PM_BROWN_PUDDING)
        || monster.mhp <= 1 || monster.mcan || offMap || !weapon || !handToHand
        || (weapon !== (state.uwep || state.u.uwep)
            && (!state.u.twoweap || weapon !== (state.uswapwep || state.u.uswapwep)))
        || (material !== IRON && material !== METAL)
        || isLauncherAmmunition(weapon) || isMissileObject(weapon))
        return { split: false, heroDied: false };

    const clone = await cloneMonster(monster, state);
    if (!clone) return { split: false, heroDied: false };
    const withWhat = state.u.twoweap && state.flags.verbose
        ? ` with ${ownedObjectName(weapon, state, { capitalized: false })}` : '';
    await publish(`${monsterName(monster, { state, capitalized: true })} divides as you hit it${withWhat}!`);
    const trap = await triggerImmediateMonsterTrap(clone, state);
    await finishImmediateMonsterTrap(trap, state, { publish });
    return { split: true, heroDied: !!state.program_state.gameover };
}
