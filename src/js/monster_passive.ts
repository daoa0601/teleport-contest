// A monster's passive response when the hero or an object strikes it.
// C ref: uhitm.c passive() and passive_obj().

import { heroIsHallucinating } from './senses.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { heroSpecies } from './hero_species.js';
import {
    A_DEX, A_STR, A_WIS,
    M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR,
    Upolyd,
} from './const.js';
import {
    canSeeMonster, plineWithContinuation, randomDisplayMonsterName, shieldeff,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { healMonster } from './mon.js';
import { erodeArmor, erodeObject } from './object_erosion.js';
import {
    MONSTER_ATTACKS, MONSTER_NAME, MONSTER_RESISTS, monsterTypeName,
    requireMonsterData,
} from './monster_data.js';
import { splitMonster } from './monster_clone.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import {
    AD_ACID, AD_COLD, AD_CORR, AD_ELEC, AD_ENCH, AD_FIRE, AD_MAGM,
    AD_PHYS, AD_PLYS, AD_RUST, AD_STON, AD_STUN,
    AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_EXPL,
    AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG,
    AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import { OBJECT_NAMES } from './object_data.js';
import { drainObjectEnchantment } from './object_state.js';
import { hasWornProperty } from './properties.js';
import {
    heroMonsterForm, returnHeroToHumanForm,
} from './polyself.js';
import { heroReflectionSource, heroReflectsRay } from './ray.js';
import { d, rn2 } from './rng.js';
import { contactIsProtected, resolveImmediatePetrification } from './stoning.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Hero } from './hero_types.js';
import type { MonsterAttack } from './data_types.js';
import type { MessagePublisher } from './display.js';
import type { AttackMethod, DamageType } from './monster_attack_types.js';
import type { DeathHandler } from './end.js';
import type { ErosionKind } from './object_erosion.js';

interface PassiveOptions {
    hit?: boolean;
    defenderSurvived?: boolean;
    attackType?: AttackMethod;
    weapon?: GameObject | null;
    weaponWasDestroyed?: boolean;
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollDice?: (count: number, sides: number) => number;
    die?: DeathHandler;
}

interface PassiveContext {
    monster: Monster;
    damageType: DamageType;
    damage: number;
    hit: boolean;
    attackType: AttackMethod;
    weapon: GameObject | null;
    weaponWasDestroyed: boolean;
    state: GameState;
    publish: MessagePublisher;
    random: (limit: number) => number;
    die: DeathHandler;
}

export interface PassiveEffect {
    heroDied: boolean;
    splashed?: boolean;
    appliedDamage?: number;
    resisted?: boolean;
    transformed?: boolean;
    stopped?: boolean;
    reflected?: boolean;
    hallucinatedEscape?: boolean;
}

export interface HeroContactPassiveResult extends PassiveEffect {
    handled: boolean;
    damageType?: DamageType;
    damage?: number;
}

const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_ELEC = 0x10;
const MR_ACID = 0x40;
const MR_STONE = 0x80;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');

export async function applyHeroContactPassive(monster: Monster, {
    hit,
    defenderSurvived = !monster.dead && monster.mhp > 0,
    attackType = AT_WEAP,
    weapon = null,
    weaponWasDestroyed = false,
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    die = finishHeroDeath,
}: PassiveOptions = {}): Promise<HeroContactPassiveResult> {
    const attack = passiveAttack(monster);
    if (!attack) return { handled: false, heroDied: false };

    const damageType = attack[1];
    const damage = passiveDamage(monster.m_lev, attack, rollDice);
    const context: PassiveContext = {
        monster,
        damageType,
        damage,
        hit: !!hit,
        attackType,
        weapon,
        weaponWasDestroyed,
        state,
        publish,
        random,
        die,
    };
    const immediate = await applyImmediatePassive(context);
    if (immediate.heroDied) {
        return {
            handled: damageType !== AD_PHYS,
            damageType,
            damage,
            ...immediate,
        };
    }

    let surviving: Partial<PassiveEffect> = {};
    if (defenderSurvived && !monster.mcan && random(3) !== 0)
        surviving = await applySurvivingMonsterPassive(context);
    return {
        handled: damageType !== AD_PHYS,
        damageType,
        damage,
        ...immediate,
        ...surviving,
    };
}

async function applyImmediatePassive(context: PassiveContext): Promise<PassiveEffect> {
    if (context.damageType === AD_ACID)
        return applyAcidPassive(context);
    if ([AD_FIRE, AD_RUST, AD_CORR].includes(context.damageType))
        return applyEquipmentPassive(context);
    if (context.damageType === AD_STON)
        return applyStonePassive(context);
    if (context.damageType === AD_MAGM)
        return applyMagicMissilePassive(context);
    if (context.damageType === AD_ENCH)
        return applyEnchantmentPassive(context);
    return { heroDied: false };
}

async function applyAcidPassive({
    monster, damage, hit, attackType, weapon, state, publish, random, die,
}: PassiveContext): Promise<PassiveEffect> {
    let appliedDamage = 0;
    let heroDied = false;
    const splashed = hit && random(2) !== 0;

    if (splashed) {
        if (state.u?.blind || state.flags?.verbose === false) {
            await publish('You are splashed!');
        } else {
            await publish(
                `You are splashed by ${possessiveMonsterName(monster)} acid!`,
            );
        }

        if (heroResistsAcid(state)) {
            monstersObserveHeroResistance(M_SEEN_ACID, state);
        } else {
            appliedDamage = damage;
            heroDied = await damageHero(monster, damage, {
                state, publish, die,
            });
            monstersForgetHeroResistance(M_SEEN_ACID, state);
        }

        if (!heroDied && random(30) === 0) {
            await erodeArmor(state.u, 'corrosion', {
                state,
                publish,
                random,
            });
        }
    }

    const object = objectTouchedByAttack(state, attackType, weapon);
    if (!heroDied && hit && object && random(6) === 0) {
        await erodeObject(object, 'corrosion', {
            state,
            publish,
            random,
            verbose: attackType === AT_KICK,
        });
    }

    if (!heroDied) await exerciseAttribute(A_STR, false, state);
    return { splashed, appliedDamage, heroDied };
}

async function applyEquipmentPassive(context: PassiveContext): Promise<PassiveEffect> {
    const {
        monster, hit, attackType, weapon, state,
    } = context;
    if (!hit || monster.mcan || !weapon
        || ![AT_KICK, AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH]
            .includes(attackType)) return { heroDied: false };
    await applyMonsterPassiveToObject(monster, weapon, {
        carried: true,
        attackType,
        state,
    });
    return { heroDied: false };
}

async function applyStonePassive({
    monster, hit, attackType, weapon, weaponWasDestroyed, state, publish, die,
}: PassiveContext): Promise<PassiveEffect> {
    const wornMask = (state.inventory || []).reduce(
        (mask, object) => mask | (object.owornmask ?? 0), 0,
    );
    if (!hit || contactIsProtected(
        attackType, wornMask, !!weapon || weaponWasDestroyed,
    ) || heroResists(state, 'stoneResistance', MR_STONE)) {
        return { heroDied: false };
    }
    const result = await resolveImmediatePetrification({
        state,
        killer: monsterName(monster),
        publish,
        die,
    });
    return { heroDied: result.died, transformed: result.transformed };
}

async function applyMagicMissilePassive({
    monster, damage, state, publish, die,
}: PassiveContext): Promise<PassiveEffect> {
    if (heroResistsMagic(state)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        await publish('A hail of magic missiles narrowly misses you!');
        return { resisted: true, heroDied: false };
    }

    await publish('You are hit by magic missiles appearing from thin air!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    monstersForgetHeroResistance(M_SEEN_MAGR, state);
    return { resisted: false, appliedDamage: damage, heroDied };
}

async function applyEnchantmentPassive({
    monster, hit, attackType, weapon, state,
}: PassiveContext): Promise<PassiveEffect> {
    if (!hit) return { heroDied: false };
    const object = objectTouchedByEnchantment(
        state, attackType, weapon,
    );
    if (!object) return { heroDied: false };
    await applyMonsterPassiveToObject(monster, object, {
        carried: true,
        attackType,
        state,
    });
    return { heroDied: false };
}

async function applySurvivingMonsterPassive(context: PassiveContext): Promise<PassiveEffect> {
    if (context.damageType === AD_PLYS)
        return applyParalysisPassive(context);
    if (context.damageType === AD_COLD)
        return applyColdPassive(context);
    if (context.damageType === AD_STUN)
        return applyStunPassive(context);
    if (context.damageType === AD_FIRE)
        return applyFirePassive(context);
    if (context.damageType === AD_ELEC)
        return applyElectricPassive(context);
    return { heroDied: false };
}

async function applyParalysisPassive({
    monster, damage, state, publish, random,
}: PassiveContext): Promise<PassiveEffect> {
    if (monster.mnum !== PM_FLOATING_EYE) {
        if (heroHasFreeAction(state)) {
            await publish('You momentarily stiffen.');
            return { resisted: true, heroDied: false };
        }
        await publish(
            `You are frozen by ${displayMonsterNameWithArticle(monster, state)}!`,
        );
        freezeHero(state, damage, `frozen by ${monsterName(monster)}`, true);
        await exerciseAttribute(A_DEX, false, state);
        return { stopped: true, heroDied: false };
    }

    if (!canSeeMonster(monster))
        return { heroDied: false };
    if (monster.mcansee !== 0) {
        const owner = possessiveDisplayMonsterName(monster, state);
        if (heroReflectsRay(state)) {
            const source = heroReflectionSource(state);
            await publish(
                `${capitalize(owner)} gaze is reflected by your ${
                    source?.noun || 'body'
                }.`,
            );
            return { reflected: true, heroDied: false };
        }
        if (heroIsHallucinating(state) && random(4) !== 0) {
            const first = random(2) === 0 ? '' : 'rather ';
            const second = random(2) === 0 ? '' : 'rather ';
            const reaction = random(2) === 0 ? 'numb' : 'stupefied';
            await publish(
                `${displayMonsterSubject(monster, state)} looks ${
                    first
                }${second}${reaction}.`,
            );
            return { hallucinatedEscape: true, heroDied: false };
        }
        if (heroHasFreeAction(state)) {
            await publish(`You momentarily stiffen under ${owner} gaze!`);
            return { resisted: true, heroDied: false };
        }

        await publish(`You are frozen by ${owner} gaze!`);
        const duration = currentAttribute(A_WIS, state) > 12
            || random(4) !== 0 ? damage : 127;
        freezeHero(
            state,
            duration,
            `frozen by ${possessiveMonsterName(monster)} gaze`,
            false,
        );
        return { stopped: true, heroDied: false };
    }

    await publish(
        `${displayMonsterSubject(monster, state)} cannot defend itself.`,
    );
    if (random(500) === 0) {
        state.u.uluck = Math.max(-13, (state.u.uluck ?? 0) - 1);
    }
    return { heroDied: false };
}

async function applyColdPassive(context: PassiveContext): Promise<PassiveEffect> {
    const {
        monster, damage, state, publish, random, die,
    } = context;
    if (!monsterNearHero(monster, state)) return { heroDied: false };
    if (heroResists(state, 'coldResistance', MR_COLD)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish('You feel a mild chill.');
        monstersObserveHeroResistance(M_SEEN_COLD, state);
        await applyGolemEffects(AD_COLD, damage, state, publish);
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_COLD, state);
    await publish('You are suddenly very cold!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    if (heroDied) return { appliedDamage: damage, heroDied };

    healMonster(monster, Math.trunc((damage + random(2)) / 2), Math.trunc((damage + 1) / 2));
    if ((monster.mhpmax ?? 0) > ((monster.m_lev ?? 0) + 1) * 8)
        await splitMonster(monster, state);
    return { appliedDamage: damage, heroDied: false };
}

async function applyStunPassive({ damage, state, publish }: PassiveContext): Promise<PassiveEffect> {
    const hero = state.u;
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0 || damage <= 0)
        return { heroDied: false };
    await publish(hero.usteed ? 'You wobble in the saddle.' : 'You stagger...');
    hero.stunnedTurns = damage;
    hero.stunned = true;
    return { heroDied: false };
}

async function applyFirePassive({ monster, damage, state, publish, die }: PassiveContext): Promise<PassiveEffect> {
    if (!monsterNearHero(monster, state)) return { heroDied: false };
    if (heroResists(state, 'fireResistance', MR_FIRE)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish('You feel mildly warm.');
        monstersObserveHeroResistance(M_SEEN_FIRE, state);
        await applyGolemEffects(AD_FIRE, damage, state, publish);
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_FIRE, state);
    await publish('You are suddenly very hot!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    return { appliedDamage: damage, heroDied };
}

async function applyElectricPassive({ monster, damage, state, publish, die }: PassiveContext): Promise<PassiveEffect> {
    if (heroResists(state, 'shockResistance', MR_ELEC)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish('You feel a mild tingle.');
        monstersObserveHeroResistance(M_SEEN_ELEC, state);
        await applyGolemEffects(AD_ELEC, damage, state, publish);
        return { resisted: true, heroDied: false };
    }

    monstersForgetHeroResistance(M_SEEN_ELEC, state);
    await publish('You are jolted with electricity!');
    const heroDied = await damageHero(monster, damage, {
        state, publish, die,
    });
    return { appliedDamage: damage, heroDied };
}

async function damageHero(monster: Monster, amount: number, { state, publish, die }: Pick<PassiveContext, 'state' | 'publish' | 'die'>): Promise<boolean> {
    if (amount <= 0) return false;
    const hero = state.u;
    if (Upolyd(hero)) {
        hero.mh = (hero.mh ?? 1) - amount;
        if (hero.mh > 0) return false;
        if (hero.unchanging || state.unchanging) {
            return die({ killer: 'killed while stuck in creature form' });
        }
        const restored = await returnHeroToHumanForm(state, { publish, die });
        return restored.died;
    }

    hero.uhp = (hero.uhp ?? 1) - amount;
    if (hero.uhp > 0) return false;
    return die({ killer: monsterName(monster) });
}

function heroResists(state: GameState, property: 'acidResistance' | 'coldResistance' | 'fireResistance' | 'shockResistance' | 'stoneResistance', mask: number): boolean {
    const hero = state.u;
    if (hero[property] || hasWornProperty(property, state)) return true;
    const form = heroMonsterForm(state);
    return form != null && ((MONSTER_RESISTS[form] ?? 0) & mask) !== 0;
}

function heroResistsAcid(state: GameState): boolean {
    return heroResists(state, 'acidResistance', MR_ACID);
}

function heroResistsMagic(state: GameState): boolean {
    const hero = state.u;
    if (hero.antimagic
        || hasWornProperty('antimagic', state)) return true;
    const form = heroMonsterForm(state);
    if (form == null) return false;
    const name = MONSTER_NAME[form];
    return name === 'baby gray dragon'
        || (MONSTER_ATTACKS[form] || []).some(
            attack => attack[1] === AD_MAGM,
        );
}

function objectTouchedByAttack(state: GameState, attackType: AttackMethod, weapon: GameObject | null): GameObject | null {
    if (attackType === AT_KICK)
        return weapon || state.uarmf || state.u?.uarmf || null;
    return [AT_WEAP, AT_CLAW, AT_MAGC, AT_TUCH].includes(attackType)
        ? weapon : null;
}

function objectTouchedByEnchantment(state: GameState, attackType: AttackMethod, weapon: GameObject | null): GameObject | null {
    if (attackType === AT_KICK) return weapon;
    if (attackType === AT_BITE || attackType === AT_BUTT
        || (attackType >= AT_STNG && attackType < AT_WEAP)) return null;
    return weapon || state.uwep || state.u?.uwep
        || state.uarmg || state.u?.uarmg || null;
}

function freezeHero(state: GameState, turns: number, reason: string, showRecoveryMessage: boolean): void {
    state._occupation = null;
    endVoluntaryMultiTurn(state);
    state._helplessTurns = Math.max(0, turns);
    state._helplessReason = reason;
    state._helplessDoneMessage = showRecoveryMessage
        ? 'You can move again.' : '';
}

function monsterNearHero(monster: Monster, state: GameState): boolean {
    return Math.max(
        Math.abs((monster.mx ?? 0) - (state.u?.ux ?? 0)),
        Math.abs((monster.my ?? 0) - (state.u?.uy ?? 0)),
    ) <= 1;
}

async function applyGolemEffects(damageType: DamageType, damage: number, state: GameState, publish: MessagePublisher): Promise<void> {
    const form = heroMonsterForm(state);
    const name = form == null ? null : MONSTER_NAME[form];
    let healing = 0;
    if (damageType === AD_ELEC && name === 'flesh golem')
        healing = Math.trunc((damage + 5) / 6);
    else if (damageType === AD_FIRE && name === 'iron golem')
        healing = damage;
    if (healing <= 0 || (state.u.mh ?? 0) >= (state.u.mhmax ?? 0)) return;
    const hp = state.u.mh, maximum = state.u.mhmax;
    if (hp === undefined || maximum === undefined) return;
    state.u.mh = Math.min(maximum, hp + healing);
    await publish('Strangely, you feel better than before.');
    await exerciseAttribute(A_STR, true, state);
}

export function passiveAttack(monster: Pick<Monster, 'mnum'> | null | undefined): MonsterAttack | null {
    if (!monster) return null;
    return (MONSTER_ATTACKS[monster.mnum] || []).find(
        ([attackType]) => attackType === AT_NONE,
    ) || null;
}

export function passiveDamage(level: number, attack: MonsterAttack, rollDice: (count: number, sides: number) => number): number {
    const [, , dice, sides] = attack;
    if (dice > 0) return rollDice(dice, sides);
    if (sides > 0) return rollDice(level + 1, sides);
    return 0;
}

function monsterName(monster: Monster): string {
    return monster.name || monsterTypeName(monster.mnum, !!monster.female);
}

function possessiveMonsterName(monster: Monster): string {
    const name = monster.name || `the ${monsterName(monster)}`;
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}


function displayMonsterName(monster: Monster, state: GameState): string {
    return heroIsHallucinating(state)
        ? randomDisplayMonsterName() : monsterName(monster);
}

function displayMonsterSubject(monster: Monster, state: GameState): string {
    return monster.name || `The ${displayMonsterName(monster, state)}`;
}

function displayMonsterNameWithArticle(monster: Monster, state: GameState): string {
    return monster.name || `the ${displayMonsterName(monster, state)}`;
}

function possessiveDisplayMonsterName(monster: Monster, state: GameState): string {
    const name = displayMonsterNameWithArticle(monster, state);
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function capitalize(text: string): string {
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function isHeroDefender(defender: Hero | Monster, state: GameState): defender is Hero {
    return defender === state.u;
}

// passive_obj() also applies to the hero's current body after a missile hits.
// The caller still owns the object's eventual inventory or floor location.
export async function applyMonsterPassiveToObject(
    defender: Hero | Monster, object: GameObject, {
        carried = object.where === 'inventory', attackType = null, state = game,
        publish = plineWithContinuation, random = rn2,
    }: {
        carried?: boolean; attackType?: AttackMethod | null; state?: GameState;
        publish?: MessagePublisher; random?: typeof rn2;
    } = {},
): Promise<void> {
    const species = isHeroDefender(defender, state) ? heroSpecies(state) : defender.mnum;
    const passive = requireMonsterData(MONSTER_ATTACKS, species)
        .find(([method]) => method === AT_NONE);
    if (!passive) return;
    const type = passive[1];
    if (type === AD_ENCH) {
        if (defender.mcan) return;
        if (!await drainObjectEnchantment(object, { state, random, byHero: true })) return;
        if (carried) state._armorClassDirty = true;
        if (carried && (object.known || object.typeKnown || object.oclass === 3)) {
            const name = object.name || OBJECT_NAMES[object.otyp];
            if (name == null) throw new Error(`unnamed object type ${object.otyp}`);
            const verb = objectIsPlural(object, name) ? 'seem' : 'seems';
            await publish(`Your ${name} ${verb} less effective.`);
        }
        return;
    }

    let kind: ErosionKind;
    if (type === AD_FIRE) {
        if (random(6) !== 0 || defender.mcan
            || (attackType !== AT_KICK
                && MONSTER_NAME[species] === 'steam vortex')) return;
        kind = 'burn';
    } else if (type === AD_RUST || type === AD_CORR) {
        if (defender.mcan) return;
        kind = type === AD_RUST ? 'rust' : 'corrosion';
    } else if (type === AD_ACID) {
        if (random(6) !== 0) return;
        kind = 'corrosion';
    } else {
        return;
    }
    await erodeObject(object, kind, {
        state, publish, random, verbose: attackType === AT_KICK,
        position: isHeroDefender(defender, state)
            ? { x: defender.ux, y: defender.uy }
            : { x: defender.mx, y: defender.my },
    });
}

function objectIsPlural(object: GameObject, name: string): boolean {
    return (object.quan ?? object.quantity ?? 1) !== 1
        || /(?:boots|shoes|gloves|gauntlets|lenses|scales)$/u.test(name);
}
