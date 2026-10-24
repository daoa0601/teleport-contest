// Native wand, spell, and breath rays.
// C refs: zap.c ubuzz(), dobuzz(), zhitm(), and zhitu().

import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { healMonster } from './mon.js';
import { adjustSpellDamage } from './spell_damage.js';
import { explode } from './explosion.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { heroFormSticks } from './hero_species.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { finishMonsterEating } from './monster_eating.js';
import { monsterResistsSleep, putMonsterToSleep } from './monster_sleep.js';
import { burnArmorByFire } from './trap.js';
import { igniteItems } from './light.js';
import { payForShopDamage } from './shop_damage.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { monsterHasLineOfSightToHero } from './monster_perception.js';
import {
    EXPL_FIERY, M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE,
    M_SEEN_REFL, STRAT_WAITMASK,
    W_ARM, W_ARMC, W_ARMU, W_ARMS,
} from './const.js';
import { artifactById } from './artifacts.js';
import {
    canSeeMonster, canSenseMonster, newsym, plineWithContinuation, shieldeff,
} from './display.js';
import { game } from './gstate.js';
import { cansee } from './vision.js';
import { rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { finishHeroDeath } from './end.js';
import { finishMonsterKilled } from './monster_death.js';
import { wakeMonster } from './monster_anger.js';
import { monsterName, possessiveName } from './monster_name.js';
import { distantObjectName, objectName } from './objnam.js';
import { heroArmName, heroEyeCount, heroEyeName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { hitHeroWithRay } from './hero_breath.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { erodeArmor, damageObjectWithAcid } from './object_erosion.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import {
    MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsNonliving, monsterIsVampireShifter,
} from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import {
    monsterHasAcidResistance, monsterHasColdResistance, monsterHasDisintegrationResistance,
    monsterHasFireResistance, monsterHasPoisonResistance, monsterHasShockResistance,
    monsterResistanceBits, monsterResistsEffect,
} from './monster_resistance.js';
import {
    AD_ACID, AD_COLD, AD_DISN, AD_DRST, AD_ELEC, AD_FIRE,
    AD_MAGM, AD_RBRE, AD_SLEE,
} from './monster_attack_types.js';
import {
    BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES,
    FIRE_HORN, FROST_HORN, SPE_MAGIC_MISSILE, SPE_FINGER_OF_DEATH,
    WAN_MAGIC_MISSILE, WAN_LIGHTNING,
} from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { flashBurn } from './sight_change.js';
import { monsterResistsBlindingLight } from './blinding_attack.js';
import { realRayName, displayRayName } from './ray_name.js';
import {
    discoverHeroReflectionSource, heroReflectionSource, heroReflectsRay,
    monsterReflectsRay, monsterReflectionSource, rayHitsHero, rayHitsMonster,
    rayMonsterAt, runRay,
} from './ray.js';
import {
    applyRayFloorFeatures, destroyMonsterInventoryByElement,
    INVENTORY_DAMAGE,
} from './zap.js';

import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import type { HeroMonsterKillOptions, HeroMonsterDeathContext } from './hero_monster_death.js';
import type { MonsterAttack } from './data_types.js';
import type { DamageType } from './monster_attack_types.js';
import type { HeroRaySource } from './hero_breath.js';
import type { Position } from './map_types.js';
import type { RayFloorKind, RayFloorResult } from './magic_types.js';
import { rayDamageType } from './magic_types.js';
import { requirePlayingGame } from './gstate.js';

export type RayDirection = 'h' | 'j' | 'k' | 'l' | 'y' | 'u' | 'b' | 'n' | '<' | '>';
export interface NativeRayResult { used: boolean; heroDied: boolean; hits: number; }
export interface NativeRayOptions {
    state?: GameState;
    sourceMonster?: Monster | null;
    sourceObject?: GameObject | null;
    originX?: number;
    originY?: number;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    die?: DeathHandler;
    finishMonsterKill?: (monster: Monster, x: number, y: number, options?: HeroMonsterKillOptions) => unknown;
    sayHit?: boolean;
    sayMiss?: boolean;
    forceMiss?: boolean;
}
interface RayDamageOptions {
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollDice: typeof d;
    rollOne: typeof rnd;
}
interface RayContext extends RayDamageOptions {
    nativeType: number;
    attack: MonsterAttack;
    damageType: DamageType;
    floorNoun: 'bolt' | 'spell' | 'blast';
    name: string;
    sourceObject: GameObject | null;
    source: HeroRaySource;
    sourceMonster: Monster | null;
    displayName: () => string;
    displayDamageType: number;
    die: DeathHandler;
    finishMonsterKill: NonNullable<NativeRayOptions['finishMonsterKill']>;
    sayHit: boolean;
    sayMiss: boolean;
    forceMiss: boolean;
    hits: number;
    shopDamage: boolean;
}
interface MonsterRayHit {
    damage: number;
    resisted?: boolean;
    slept?: boolean;
    sleepEffect?: boolean;
    absorbedDeath?: boolean;
    armorToDisintegrate?: GameObject;
    disintegrated?: boolean;
    noCorpse?: boolean;
    reintegrated?: boolean;
}
interface RayCell extends Position { remainingRange: number; }
interface RayCellResult {
    stop?: boolean;
    result?: NativeRayResult;
    absorbed?: boolean;
    rangeChange?: number;
    reflected?: boolean;
}
interface MonsterRayAftermathOptions {
    state: PlayingGameState;
    displayName: () => string;
    finishMonsterKill: NonNullable<NativeRayOptions['finishMonsterKill']>;
    publish: MessagePublisher;
    random: typeof rn2;
    source?: HeroRaySource;
    deathContext?: HeroMonsterDeathContext | null;
    sayHit?: boolean;
    x: number;
    y: number;
}

// zhitm uses this value to request disintegration from its caller.
const MAGIC_COOKIE = 1000;
const MR_FIRE = 0x01;
const MR_COLD = 0x02;

const DIRECTIONS: Readonly<Record<RayDirection, readonly [number, number]>> = Object.freeze({
    h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
    '<': [0, 0], '>': [0, 0],
});

// Actual source objects retain spell strength and horn death attribution.
export async function zapRayWithObject(object: GameObject, { state = game }: { state?: GameState } = {}): Promise<NativeRayResult> {
    requirePlayingGame(state);
    let nativeType;
    let dice;
    const type = object.otyp;
    if (type >= SPE_MAGIC_MISSILE && type <= SPE_FINGER_OF_DEATH) {
        nativeType = 10 + type - SPE_MAGIC_MISSILE;
        dice = Math.trunc(state.u.ulevel / 2) + 1;
    } else if (type >= WAN_MAGIC_MISSILE && type <= WAN_LIGHTNING) {
        nativeType = type - WAN_MAGIC_MISSILE;
        dice = nativeType === 0 ? 2 : 6;
    } else if (type === FIRE_HORN || type === FROST_HORN) {
        nativeType = type === FIRE_HORN ? 1 : 2;
        dice = 6 + rn2(6);
    } else {
        throw new Error(`Object ${type} does not produce a ray`);
    }
    const { dx = 0, dy = 0, dz = 0 } = state.u;
    const direction = dx || dy
        ? Object.entries(DIRECTIONS).find(([, delta]) => delta[0] === dx && delta[1] === dy)?.[0]
        : dz < 0 ? '<' : '>';
    return castNativeRay(nativeType, dice, direction, { state, sourceObject: object });
}

// The numeric result is native zhitm's applied damage, including MAGIC_COOKIE
// for disintegration. The caller owns death, wake-up, and hit messages.
export async function hitMonsterWithRay(monster: Monster, nativeType: number, dice: number, {
    state = game, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd,
}: Pick<NativeRayOptions, 'state' | 'publish' | 'random' | 'rollDice' | 'rollOne'> = {}): Promise<number> {
    requirePlayingGame(state);
    const hit = await damageRayMonster(monster, nativeType, dice, {
        state, publish, random, rollDice, rollOne,
    });
    return hit.damage;
}

export async function castNativeRay(nativeType: number, dice: number, direction: string | undefined, {
    state = game, sourceMonster = null, sourceObject = null,
    originX = state.u.ux, originY = state.u.uy,
    publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd,
    die = finishHeroDeath, finishMonsterKill = finishHeroMonsterKill,
    sayHit = true, sayMiss = false, forceMiss = false,
}: NativeRayOptions = {}): Promise<NativeRayResult> {
    requirePlayingGame(state);
    if (!isRayDirection(direction)) return { used: false, heroDied: false, hits: 0 };
    const rayType = normalizedRayType(nativeType);
    const damageType = rayDamageType(rayType);
    const kind = rayType < 10 ? 'wand' : rayType < 20 ? 'spell' : 'breath';
    const context: RayContext = {
        state, nativeType, attack: [0, damageType, dice, 6], damageType,
        floorNoun: kind === 'wand' ? 'bolt' : kind === 'spell' ? 'spell' : 'blast',
        name: realRayName(damageType, kind), sourceObject,
        source: `${nativeType < 0 ? 'monster' : 'hero'}-${kind}`, sourceMonster,
        displayName: () => displayRayName(damageType, kind, { state, random }),
        displayDamageType: heroIsHallucinating(state) ? AD_MAGM + random(6) : damageType,
        publish, random, rollDice, rollOne, die, finishMonsterKill,
        sayHit, sayMiss, forceMiss, hits: 0, shopDamage: false,
    };
    if (state.u.uswallow) {
        if (nativeType < 0) return { used: false, heroDied: false, hits: 0 };
        return hitSwallowingMonster(context);
    }
    if (nativeType < 0) newsym(state.u.ux, state.u.uy);
    const savedHitPosition = state.bhitpos;
    try {
        return await traceRay(direction, originX, originY, context);
    } finally {
        state.bhitpos = savedHitPosition;
    }
}

function normalizedRayType(type: number) {
    return type <= -30 ? -type - 30 : Math.abs(type);
}

async function traceRay(direction: RayDirection, originX: number, originY: number, context: RayContext): Promise<NativeRayResult> {
    const { state, random, publish } = context;
    const [dx, dy] = DIRECTIONS[direction];
    const range = 7 + random(7);
    const fireball = context.nativeType === 11;
    let endpoint = { x: originX, y: originY };
    let vanishedAt: { x: number; y: number } | null = null;
    const stopped = await runRay({
        state, direction, range: dx || dy ? range : 1,
        beamType: context.displayDamageType - 1, originX, originY, random,
        canSee: (x, y) => cellIsVisible(state, x, y),
        onCell: async cell => {
            endpoint = cell;
            if (fireball) return { stop: !!rayMonsterAt(cell.x, cell.y, state) };
            return hitRayCell(cell, context);
        },
        stopAtObstacle: fireball,
        onObstacle: ({ previousX, previousY }) => {
            endpoint = { x: previousX, y: previousY };
        },
        onBounce: () => publish(`${raySubject(context.displayName())} bounces!`),
        onVanish: async ({ x, y }) => {
            vanishedAt = { x, y };
            await publish(`${raySubject(context.displayName())} vanishes into the aether!`);
        },
    });
    if (fireball && !state.program_state.gameover) {
        // dobuzz(): a fireball that "vanishes into the aether" on the Plane
        // of Air still detonates, coerced to a wand-style fire blast at the
        // cell it entered before rebounding off the open sky.
        const spot = vanishedAt ?? endpoint;
        const blastType = vanishedAt !== null ? 1 : 11;
        await explode(spot.x, spot.y, blastType, context.rollDice(12, 6), 0,
            EXPL_FIERY, { state, publish, heroCaused: true });
    }
    if (context.shopDamage && !state.program_state.gameover) {
        const verb = context.damageType === AD_FIRE ? 'burn away'
            : context.damageType === AD_COLD ? 'shatter'
                : context.damageType === AD_ACID ? 'damage'
                    : context.damageType === AD_DISN ? 'disintegrate' : 'destroy';
        await payForShopDamage(verb, { state });
    }
    return stopped || { used: true, heroDied: !!state.program_state.gameover, hits: context.hits };
}

async function hitRayCell(
    { x, y, remainingRange }: RayCell, context: RayContext,
): Promise<RayCellResult> {
    const {
        state, attack, damageType, publish, random, rollDice, rollOne,
        finishMonsterKill,
    } = context;
    let floor: RayFloorResult = { absorbed: false, rangeChange: 0 };
    let reflected = false;
    let leavesPoisonCloud = damageType === AD_DRST;
    let rangeChange = 0;

    if (damageType !== AD_DRST) {
        floor = await applyRayFloorFeatures(
            floorKind(damageType, context.nativeType), x, y, state,
            { rayNoun: context.floorNoun, random, publish, heroCaused: context.nativeType >= 0 },
        );
        if (state.program_state.gameover)
            return { stop: true, result: { used: true, heroDied: true, hits: context.hits } };
        rangeChange += floor.rangeChange;
        context.shopDamage ||= !!floor.shopDamage;
    }

    const monster = rayTargetAt(x, y, remainingRange + floor.rangeChange, context);
    if (monster) {
        if (context.nativeType >= 0)
            monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        state.notonhead = monster.mx !== x || monster.my !== y;
        if (!context.forceMiss && rayHitsMonster(monster, random, rollOne, {
            state, spellType: context.nativeType >= 10 && context.nativeType < 20
                ? SPE_MAGIC_MISSILE + context.nativeType % 10 : 0,
        })) {
            context.hits++;
            rangeChange -= 2;
            if (monsterReflectsRay(monster, state)) {
                await showMonsterReflection(monster, context);
                reflected = true;
                if (cansee(monster.mx, monster.my)) leavesPoisonCloud = false;
            } else {
                const hit = await damageRayMonster(monster, context.nativeType, attack[2], {
                    state, publish, random, rollDice, rollOne,
                });
                const aftermath = await finishMonsterRayHit(
                    monster, hit, {
                        state, displayName: context.displayName, finishMonsterKill, publish,
                        random, source: context.source, sayHit: context.sayHit, x, y,
                    },
                );
                if (aftermath.heroDied || hit.reintegrated || hit.absorbedDeath) {
                    return {
                        stop: true,
                        result: {
                            used: true,
                            heroDied: aftermath.heroDied,
                            hits: context.hits,
                        },
                    };
                }
            }
        } else if (context.sayMiss || canSeeMonster(monster)
            && (canSenseMonster(monster)
                || [M_AP_NOTHING, M_AP_MONSTER].includes(M_AP_TYPE(monster)))) {
            await publish(rayMissMessage(context.displayName(), monster, { x, y, state }));
        }
    } else if (x === state.u.ux && y === state.u.uy
        && remainingRange + floor.rangeChange >= 0) {
        const heroHit = await hitHeroOnRay(x, y, context);
        context.hits += heroHit.hit ? 1 : 0;
        rangeChange -= heroHit.hit ? 2 : 0;
        reflected = heroHit.reflected;
        leavesPoisonCloud = leavesPoisonCloud && !reflected;
        if (heroHit.heroDied) {
            return {
                stop: true,
                result: {
                    used: true,
                    heroDied: true,
                    hits: context.hits,
                },
            };
        }
    }

    if (leavesPoisonCloud) {
        floor = await applyRayFloorFeatures('poison', x, y, state, {
            rayNoun: context.floorNoun, random, publish, heroCaused: context.nativeType >= 0,
        });
        context.shopDamage ||= !!floor.shopDamage;
    }

    return { absorbed: damageType !== AD_DRST && floor.absorbed, rangeChange, reflected };
}

async function hitSwallowingMonster(context: RayContext): Promise<NativeRayResult> {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const engulfer = state.u.ustuck;
    if (!engulfer) throw new Error('A swallowed ray requires its engulfing monster.');
    const hit = await damageRayMonster(engulfer, context.nativeType, attack[2], {
        state, publish, random, rollDice, rollOne,
    });
    const monster = state.u.ustuck;
    if (!monster) {
        state.u.uswallow = 0;
    } else {
        const punctuation = hit.damage > 4 ? '!' : '.';
        await publish(`${raySubject(context.displayName())} rips into ${monsterName(monster, { state })}${punctuation}`);
        if (hit.disintegrated) monster.mhp = 0;
        if (monster.mhp <= 0) {
            // The inside hole leaves ordinary remains, unlike an outside
            // disintegration hit. The swallowed branch never wakes its target.
            await context.finishMonsterKill(monster, monster.mx, monster.my, {
                deathContext: { kind: 'swallowed-breath' },
            });
        }
    }
    return { used: true, heroDied: !!state.program_state?.gameover, hits: 1 };
}

function rayTargetAt(x: number, y: number, remainingRange: number, context: RayContext) {
    const { state, random } = context;
    const monster = rayMonsterAt(x, y, state);
    if (monster) return monster;
    if (x !== state.u.ux || y !== state.u.uy || remainingRange < 0) return null;

    endVoluntaryMultiTurn(state);
    const steed = state.u.usteed;
    if (steed && random(3) === 0 && !monsterReflectsRay(steed, state))
        return steed;
    return null;
}

async function showMonsterReflection(monster: Monster, context: RayContext) {
    const { state, publish } = context;
    if (!cansee(monster.mx, monster.my)) return;
    await publish(rayHitMessage(context.displayName(), monster, {
        x: monster.mx, y: monster.my, state,
    }));
    await shieldeff(monster.mx, monster.my, state);
    const reflection = monsterReflectionSource(monster, state);
    if (!reflection) throw new Error('A reflecting monster has no reflection source.');
    await publish(`But it reflects from ${possessiveName(monsterName(monster, { state }))} ${reflection.noun}!`);
    discoverHeroReflectionSource(reflection, state);
}

async function hitHeroOnRay(x: number, y: number, context: RayContext) {
    const { state, damageType, publish, random, rollOne } = context;
    const canSeeHero = (monster: Monster) => monsterHasLineOfSightToHero(monster, state);
    endVoluntaryMultiTurn(state);
    const hit = !context.forceMiss && rayHitsHero(state, random, rollOne);
    let reflected = false;
    let heroDied = false;
    if (hit) {
        await publish(`${raySubject(context.displayName())} hits you!`);
        if (heroReflectsRay(state)) {
            const source = heroReflectionSource(state);
            if (heroIsBlind(state)) {
                await publish('For some reason you are not affected.');
            } else {
                await publish(`But it reflects from your ${source?.noun || 'shield'}!`);
                if (source) discoverHeroReflectionSource(source, state);
            }
            monstersObserveHeroResistance(M_SEEN_REFL, state, canSeeHero);
            await shieldeff(x, y, state);
            reflected = true;
        } else {
            const result = await hitHeroWithRay(context);
            heroDied = !!result.heroDied;
            if (!heroDied) monstersForgetHeroResistance(M_SEEN_REFL, state, canSeeHero);
        }
    } else if (!heroIsBlind(state)) {
        await publish(`${raySubject(context.displayName())} whizzes by you!`);
    } else if (damageType === AD_ELEC) {
        await publish(`Your ${heroArmName(state)} tingles.`);
    }
    if (!heroDied) {
        if (damageType === AD_ELEC) await blindHeroWithLightning(context);
        await stopHeroOccupation(state, publish);
        endVoluntaryMultiTurn(state);
    }
    return { hit, reflected, heroDied };
}

async function damageRayMonster(monster: Monster, nativeType: number, dice: number, {
    state, publish, random, rollDice, rollOne,
}: RayDamageOptions): Promise<MonsterRayHit> {
    const rayType = normalizedRayType(nativeType);
    const damageType = rayDamageType(rayType);
    const spell = nativeType >= 10 && nativeType < 20;
    const inside = nativeType >= 0 && state.u.uswallow && state.u.ustuck === monster;
    const spellDamage = (damage: number) => spell ? adjustSpellDamage(damage, state) : damage;
    const options = { state, publish, random, rollOne, visible: canSeeMonster(monster) };
    let hit: MonsterRayHit = { damage: 0, resisted: false };
    let savingThrow = nativeType >= 0;
    let sourceDamage = 0;

    if (damageType === AD_SLEE) {
        const duration = rollDice(dice, 25);
        if (MONSTER_SYMBOL[monster.mnum] === 13 && !monster.msleeping && !monster.mfrozen)
            revealMonsterAppearance(monster, { includeMonsterDisguise: false });
        const resisted = monsterResistsSleep(monster)
            || monsterResistsEffect(monster, nativeType === 3 ? 12 : state.u.ulevel, random);
        if (resisted) await shieldeff(monster.mx, monster.my, state);
        const slept = !resisted && monster.mcanmove !== 0;
        if (slept) {
            finishMonsterEating(monster, state);
            putMonsterToSleep(monster, duration);
        }
        return { damage: 0, sleepEffect: true, resisted, slept };
    }
    if (damageType === AD_DISN) {
        savingThrow = false;
        if (rayType === 24) {
            hit = await disintegrateMonster(monster, state);
        } else if (MONSTER_NAME[monster.mnum] === 'Death') {
            const maximum = monster.mhpmax;
            healMonster(monster, Math.trunc(maximum * 3 / 2), Math.trunc(maximum / 2));
            monster.mhpmax = Math.min(MAGIC_COOKIE - 1, monster.mhpmax);
            return { damage: 0, absorbedDeath: true };
        } else if (monsterIsNonliving(monster.mnum)
            || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x100)
            || monsterIsVampireShifter(monster) || monsterHasMagicResistance(monster)) {
            hit.resisted = true;
        } else {
            hit.damage = monster.mhp + 1;
        }
    } else if (damageType === AD_ELEC) {
        sourceDamage = spellDamage(rollDice(dice, 6));
        hit.resisted = monsterHasShockResistance(monster);
        hit.damage = hit.resisted ? 0 : sourceDamage;
        if (!inside && dice > 2 && !monsterResistsBlindingLight(monster, state)) {
            monster.mcansee = 0;
            monster.mblinded = Math.min(127, (monster.mblinded ?? 0) + rollOne(50));
        }
        if (random(3) === 0)
            hit.damage += await destroyMonsterInventoryByElement(monster,
                INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options);
    } else {
        hit.resisted = rayResistance(monster, damageType, state);
        if (!hit.resisted) {
            hit.damage = rollDice(dice, 6);
            if ([AD_MAGM, AD_FIRE, AD_COLD].includes(damageType))
                hit.damage = spellDamage(hit.damage);
            sourceDamage = hit.damage;
            if (damageType === AD_FIRE) {
                if (monsterResistanceBits(monster) & MR_COLD) hit.damage += 7;
                if (await burnArmorByFire(monster, state, publish, [], random, { visible: options.visible })
                    && random(3) === 0) {
                    hit.damage += await destroyMonsterInventoryByElement(monster,
                        INVENTORY_DAMAGE.FIRE, sourceDamage, options);
                    await igniteItems(monster.minvent || monster.inventory, {
                        ...options,
                    });
                }
            } else if (damageType === AD_COLD) {
                if (monsterResistanceBits(monster) & MR_FIRE) hit.damage += rollDice(dice, 3);
                if (random(3) === 0)
                    hit.damage += await destroyMonsterInventoryByElement(monster,
                        INVENTORY_DAMAGE.COLD, sourceDamage, options);
            } else if (damageType === AD_ACID) {
                if (random(6) === 0)
                    await damageObjectWithAcid(monsterWieldedWeapon(monster), { state, publish, random });
                if (random(6) === 0)
                    await erodeArmor(monster, 'corrosion', { state, publish, random });
            }
        }
    }
    if (hit.resisted) await shieldeff(monster.mx, monster.my, state);
    // Death and disintegration suppress both the spell bonus and saving throw.
    if (savingThrow && spell && state.urole?.key === 'knight' && state.u.uhave?.questart)
        hit.damage *= 2;
    if (savingThrow && hit.damage > 0 && monsterResistsEffect(monster,
        nativeType < 10 ? 12 : state.u.ulevel, random))
        hit.damage = Math.trunc(hit.damage / 2);
    hit.damage = Math.max(0, hit.damage);
    monster.mhp -= hit.damage;
    if (!inside && rayType === 24 && monsterIsRider(monster)) {
        monster.mhp = monster.mhpmax;
        hit.reintegrated = true;
    }
    if (nativeType >= 0 && damageType === AD_FIRE && ['paper golem', 'straw golem'].includes(MONSTER_NAME[monster.mnum] ?? ''))
        hit.noCorpse = true;
    return hit;
}

function rayResistance(monster: Monster, damageType: DamageType, state: GameState) {
    if (damageType === AD_MAGM) return monsterHasMagicResistance(monster);
    if (damageType === AD_FIRE) return monsterHasFireResistance(monster);
    if (damageType === AD_COLD) return monsterHasColdResistance(monster);
    if (damageType === AD_DRST) return monsterHasPoisonResistance(monster)
        || artifactById(monsterWieldedWeapon(monster)?.oartifact, state)?.defense === 'poison';
    if (damageType === AD_ACID) return monsterHasAcidResistance(monster);
    return false;
}

async function disintegrateMonster(monster: Monster, state: GameState): Promise<MonsterRayHit> {
    if (monsterHasDisintegrationResistance(monster)) {
        return { damage: 0, resisted: true };
    }

    const shield = monsterWornObject(monster, W_ARMS);
    if (shield)
        return { damage: 0, armorToDisintegrate: shield, resisted: false };
    const suit = monsterWornObject(monster, W_ARM);
    if (suit) {
        const cloak = monsterWornObject(monster, W_ARMC);
        if (cloak) await destroyObjectFromMonsterInventory(monster, cloak, state);
        return { damage: 0, armorToDisintegrate: suit, resisted: false };
    }
    for (const mask of [W_ARMC, W_ARMU]) {
        const object = monsterWornObject(monster, mask);
        if (object) await destroyObjectFromMonsterInventory(monster, object, state);
    }
    return { damage: MAGIC_COOKIE, disintegrated: true, noCorpse: true };
}

async function finishMonsterRayHit(
    monster: Monster, hit: MonsterRayHit, {
        state, displayName, finishMonsterKill, publish, random,
        source = 'hero-breath', deathContext = null, sayHit = true, x, y,
    }: MonsterRayAftermathOptions,
): Promise<{ heroDied: boolean }> {
    const visible = canSeeMonster(monster);
    // Native Monnam chooses a fresh hallucinated identity only when a
    // message names the target. Ordinary hit() owns its own name lookup.
    const nameTarget = () => monsterName(monster, { state, capitalized: true });
    if (hit.absorbedDeath) {
        if (visible) {
            await publish(rayHitMessage(displayName(), monster, { x, y, state }));
            await publish(`${nameTarget()} absorbs the deadly ray!`);
            await publish('It seems even stronger than before.');
        }
        return { heroDied: false };
    }
    if (hit.reintegrated) {
        if (visible) {
            await publish(rayHitMessage(displayName(), monster, { x, y, state }));
            await publish(`${nameTarget()} disintegrates.`);
            // zap.c:dobuzz() names one eye for a one-eyed hero form.
            const eye = heroEyeName(state);
            const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
            await publish(`${possessiveName(nameTarget())} body reintegrates before your ${eyes}!`);
            await publish(`${nameTarget()} resurrects!`);
        }
        return { heroDied: false };
    }
    if (hit.armorToDisintegrate) {
        if (visible) {
            const owner = possessiveName(nameTarget());
            const armor = await distantObjectName(hit.armorToDisintegrate, object => objectName(object, state), state);
            await publish(`${owner} ${armor} is disintegrated!`);
        }
        await destroyObjectFromMonsterInventory(monster, hit.armorToDisintegrate, state);
        return wakeMonster(monster, { attacked: source.startsWith('hero-') });
    }
    if ((monster.mhp ?? 0) <= 0) {
        if (hit.disintegrated && visible) {
            await publish(wornMonsterLifeSaver(monster)
                ? rayHitMessage(displayName(), monster, { x, y, damage: hit.damage, state })
                : `${nameTarget()} is disintegrated!`);
        }
        if (hit.disintegrated)
            await destroyDisintegratedMonsterInventory(monster, state, random);
        if (source.startsWith('monster-')) {
            const effect = displayName();
            await finishMonsterKilled(monster, state, {
                damageType: hit.disintegrated ? 'disintegration' : AD_RBRE,
                cause: hit.disintegrated ? null : effect,
                publish, random,
            });
            return { heroDied: !!state.program_state?.gameover };
        }
        await finishMonsterKill(monster, monster.mx, monster.my, {
            // dobuzz() passes XKILL_NOCORPSE only for burned-up golems;
            // species without corpses still roll treasure and corpse_chance().
            noCorpse: !!hit.noCorpse,
            showKillMessage: !hit.disintegrated,
            deathContext,
        });
        return { heroDied: !!state.program_state?.gameover };
    }
    if (sayHit || visible) await publish(rayHitMessage(displayName(), monster, {
        x, y, damage: hit.damage, state,
    }));
    if (hit.slept && state.u.ustuck === monster && !state.u.uswallow && !heroFormSticks(state)) {
        await publish(`${possessiveName(nameTarget())} grip relaxes.`);
        await releaseHeroFromMonster(monster, { state, publish });
    }
    if (!hit.sleepEffect)
        return wakeMonster(monster, { attacked: source.startsWith('hero-') });
    return { heroDied: false };
}

async function destroyDisintegratedMonsterInventory(monster: Monster, state: GameState, random: typeof rn2) {
    const lifeSaver = wornMonsterLifeSaver(monster) ?? null;
    const inventory = [...(monster.minvent || monster.inventory || [])];
    for (const object of inventory) {
        if (objectSurvivesDisintegration(object, lifeSaver, state, random))
            continue;
        await destroyObjectFromMonsterInventory(monster, object, state);
    }
}

function objectSurvivesDisintegration(
    object: GameObject, lifeSaver: GameObject | null, state: GameState, random: typeof rn2,
) {
    if ([BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES]
            .includes(object.otyp)) return true;
    if (objectResistsDestruction(object, 5, 50, random)) return true;
    const artifact = artifactById(object.oartifact, state);
    if (object.questArtifact
        || artifact?.questArtifact || object === lifeSaver) return true;
    return false;
}

function monsterWornObject(monster: Monster, mask: number) {
    const inventory = monster.minvent || monster.inventory || [];
    return inventory.find(object => ((object.owornmask ?? 0) & mask) !== 0)
        || null;
}

function monsterIsRider(monster: Monster) {
    const name = MONSTER_NAME[monster.mnum];
    return name === 'Death' || name === 'Pestilence' || name === 'Famine';
}

async function blindHeroWithLightning({ state, attack, rollDice, publish }: RayContext) {
    // dobuzz rolls the duration even when flashburn resists blindness.
    await flashBurn(rollDice(attack[2], 50), true, { state, publish });
}

function floorKind(damageType: DamageType, nativeType: number): RayFloorKind {
    if (damageType === AD_FIRE) return 'fire';
    if (damageType === AD_COLD) return 'cold';
    if (damageType === AD_DISN) return Math.abs(nativeType) === 24 ? 'disintegration' : 'death';
    if (damageType === AD_ELEC) return 'lightning';
    if (damageType === AD_ACID) return 'acid';
    return 'breath';
}

function cellIsVisible(state: GameState, x: number, y: number) {
    return !state.blind && !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2);
}

function raySubject(value: string) {
    return `The ${value}`;
}

function isRayDirection(value: string | undefined): value is RayDirection {
    return value !== undefined && Object.hasOwn(DIRECTIONS, value);
}
