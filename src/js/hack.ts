// Effects of entering the hero's current square.
// C ref: hack.c pooleffects() and trap.c drown().

import { monsterHasMapPosition } from './monster_location.js';
import { heroIsHallucinating } from './senses.js';
import {
    BURNING, D_BROKEN, D_CLOSED, D_LOCKED, DISMOUNT_FELL, DISMOUNT_GENERIC, DISSOLVED,
    DOOR, ICE, IS_OBSTRUCTED, IS_STWALL, IS_WALL, IS_WATERWALL,
    Is_waterlevel, LAVAPOOL, LAVAWALL, PARANOID_SWIM, POOL, ROOM, STONE,
    FAINTED, TREE, TT_LAVA, Upolyd, WATER, W_NONDIGGABLE, W_NONPASSWALL,
    WT_TOOMUCH_DIAGONAL,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { heroPassesWalls, heroFormSticks } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { monsterName } from './monster_name.js';
import {
    beginHeroLifeSaving, completeHeroLifeSaving, finishOrdinaryDeath,
} from './end.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { heroIsUnaware } from './hero_sleep.js';
import { resetHeroFaint } from './hunger.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { heroLikesLava } from './hero_species.js';
import { loseHeroHp } from './hero_damage.js';
import { igniteItems } from './light.js';
import { destroyFireInventory } from './zap.js';
import { releaseAllMonsterLeashes } from './monster_leash.js';
import { splitHeroMonsterForm } from './mklev.js';
import {
    MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, LOADSTONE, OBJECT_MATERIAL,
    OBJECT_NAMES,
} from './object_data.js';
import {
    heroFormClings, heroFormFlags, heroHidesOnCeiling, heroIsFlying,
} from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { destroyLavaInventory, waterDamageChain } from './trap.js';
import { dismountHero, steedIsGrounded } from './steed.js';
import {
    heroCanTeleport, heroControlsTeleport,
    moveHeroByTeleport, safeTeleportDestination, teleportHeroAtWill,
} from './teleport.js';
import { heroTeleportRestricted } from './teleport_rules.js';
import { vision_recalc, vision_reset } from './vision.js';
import {
    inventoryWeight, nearCapacity, SLT_ENCUMBER, UNENCUMBERED,
} from './weight.js';
import {
    destroyWornArmor, findArmorClass, heroHasWaterWalking,
    heroKnowsLavaWalking, heroKnowsWaterWalking,
} from './armor.js';

import { clearHeroSliming, heroIsSliming } from './slime.js';
import { isLavaAt, isPoolAt, levelHasCeiling, levelIsWaterLevel as heroIsOnWaterLevel } from './terrain_properties.js';

import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation, Position } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler, OrdinaryDeathHandler } from './end.js';

type RandomBelow = (limit: number) => number;
type RollDice = (count: number, sides: number) => number;
type Repaint = (x: number, y: number) => void;
type RecalculateVision = (mode: number) => void;
type EquipmentSlot = 'uamul' | 'uleft' | 'uright' | 'ublindf' | 'uarm'
    | 'uarmc' | 'uarmg' | 'uarmf' | 'uarmu' | 'uarmh' | 'uarms' | 'uwep';

export interface LiquidLanding {
    from: Position;
    to: Position;
    pick?: boolean;
}
type LandingEffect = (landing: LiquidLanding) => Promise<{ died?: boolean } | null | void>;

// C hack.c:escape_from_sticky_mon(). True means this attempt was spent
// struggling; release clears the grip directly, without unstuck's cooldown.
export async function escapeFromStickyMonster(x: number, y: number): Promise<boolean> {
    const state = game;
    const holder = state.u.ustuck;
    if (!holder || x === holder.mx && y === holder.my) return false;
    if (Math.abs(holder.mx - state.u.ux) > 1 || Math.abs(holder.my - state.u.uy) > 1) {
        state.u.ustuck = null;
        return false;
    }
    const name = () => monsterName(holder, { state, article: 'your' });
    if (heroFormSticks(state)) {
        state.u.ustuck = null;
        await plineWithContinuation(`You release ${name()}.`);
        return false;
    }
    const frozen = !holder.mcanmove;
    const escape = rn2(frozen ? 8 : 40);
    if (escape === 3 && frozen) {
        holder.mfrozen = 1;
        holder.msleeping = 0;
    }
    if (escape > 2 && (heroHasConflict(state) || holder.mconf || !holder.mtame)) {
        await plineWithContinuation(`You cannot escape from ${name()}!`);
        endVoluntaryMultiTurn(state);
        return true;
    }
    state.u.ustuck = null;
    await plineWithContinuation(`You pull free from ${name()}.`);
    return false;
}
type WaterFormEffect =
    | { kind: 'split'; clone: Monster; died?: never }
    | { kind: 'rust'; damage: number; died: boolean };
export interface EnteredLiquid {
    entered: true;
    moved: boolean;
    died: boolean;
    left?: never;
    from?: Position;
    to?: Position;
    sank?: boolean;
    dismounted?: boolean;
    formEffect?: WaterFormEffect | null;
}
export type LiquidEffectResult = EnteredLiquid | {
    left: true; entered?: never; moved?: never; died?: never;
};
export interface HeroLiquidOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
    recalculateVision?: RecalculateVision;
    resetVision?: () => void;
    repaint?: Repaint;
    rollDice?: RollDice;
    rollOne?: RandomBelow;
    chooseTeleportDestination?: (() => Promise<Position | null>) | null;
    applyLandingEffects?: LandingEffect;
    die?: OrdinaryDeathHandler;
    entry?: 'spot-effects' | 'float-down' | 'drown';
}
interface LiquidTeleportContext {
    state: PlayingGameState;
    repaint: Repaint;
    resetVision: () => void;
    recalculateVision: RecalculateVision;
    applyLandingEffects: LandingEffect;
}
interface LiquidEscapeContext extends LiquidTeleportContext {
    random: RandomBelow;
    rollOne: RandomBelow;
}
interface LavaSurvivalContext extends LiquidEscapeContext {
    publish: MessagePublisher;
    die: OrdinaryDeathHandler;
}
interface LavaContext extends LavaSurvivalContext {
    location: MapLocation;
    rollDice: RollDice;
}
interface LiquidMovement extends Position { oldx: number; oldy: number }
interface EmergencyDisrobe { escaped: boolean; dropped: boolean; died?: boolean }
export type LavaSinkingResult = EnteredLiquid
    | { escaped: true; sank?: never; died?: never }
    | { sank: boolean; died: boolean; escaped?: never };

const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_TUNNEL = 0x00000020;
const M1_NEEDPICK = 0x00000040;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const S_EYE = 5;
const S_VORTEX = 22;
const S_LIGHT = 25;
const PM_GREMLIN = 40;
const PM_GRID_BUG = 112;
const PM_AIR_ELEMENTAL = 154;
const PM_IRON_GOLEM = 259;

function heroIsInAir(state: GameState) {
    const hero = state.u;
    if (hero.levitating || hero.levitation) return true;
    const symbol = (hero.mtimedone ?? 0) > 0 && hero.umonnum !== undefined
        ? MONSTER_SYMBOL[hero.umonnum] : null;
    return heroIsFlying(state)
        || symbol === S_EYE
        || symbol === S_LIGHT
        || (heroFormClings(state) && levelHasCeiling(state));
}

function heroFloorType(state: GameState, x: number, y: number) {
    const terrain = state.level?.at?.(x, y)?.typ;
    if (terrain !== undefined && IS_WATERWALL(terrain)) return WATER;
    if (terrain === LAVAWALL) return LAVAWALL;
    if (!heroIsInAir(state)) {
        if (isPoolAt(x, y, state)) return POOL;
        if (isLavaAt(x, y, state)) return LAVAPOOL;
    }
    return ROOM;
}

export function heroShouldAvoidLiquid(x: number, y: number, state = game) {
    const hero = state.u;
    const destination = state.level?.at?.(x, y);
    if (!hero || !destination) return false;

    const newFloor = heroFloorType(state, x, y);
    const liquidWall = IS_WATERWALL(newFloor) || newFloor === LAVAWALL;
    if (hero.uinwater && (isPoolAt(x, y, state)
        || IS_WATERWALL(newFloor))) return false;
    if (newFloor === heroFloorType(state, hero.ux, hero.uy)
        || hero.stunned || (hero.stunnedTurns ?? 0) > 0
        || hero.confused || (hero.confusionTurns ?? 0) > 0
        || !destination.seenv
        || (!isPoolAt(x, y, state) && !isLavaAt(x, y, state)
            && !liquidWall)) return false;

    const dangerousPool = isPoolAt(x, y, state)
        && !heroKnowsWaterWalking(state);
    const dangerousLava = isLavaAt(x, y, state)
        && !heroKnowsLavaWalking(state)
        && !isLavaAt(hero.ux, hero.uy, state);
    if (!dangerousPool && !dangerousLava && !liquidWall) return false;

    if (state.context?.nopick) {
        state._tipSwimShown = true;
        return false;
    }
    return liquidWall
        || !!((state.flags?.paranoia_bits ?? 0) & PARANOID_SWIM);
}

function squareBlocksHero(state: GameState, x: number, y: number) {
    const location = state.level?.at?.(x, y);
    if (heroCanPassWallAt(state, x, y)) return false;
    if (!location || location.typ === STONE
        || IS_OBSTRUCTED(location.typ)) return true;
    return location.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

export function heroCanPassWallAt(state: GameState, x: number, y: number) {
    const location = requireGameLevel(state).at(x, y);
    return !!location && heroPassesWalls(state)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
}

function doorlessDoor(location: MapLocation | null | undefined) {
    return location?.typ === DOOR
        && !((location.doormask || 0) & ~D_BROKEN);
}

export function blocksDiagonalDoor(current: MapLocation | null | undefined, destination: MapLocation | null | undefined) {
    return (destination?.typ === DOOR && !doorlessDoor(destination))
        || (current?.typ === DOOR && !doorlessDoor(current));
}

export function heroBadRock(state: GameState, x: number, y: number) {
    const location = state.level?.at?.(x, y);
    if (!location) return true;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (state.level?.flags?.sokoban_rules
        && pile.some(object => object.otyp === BOULDER)) return true;
    if (!IS_OBSTRUCTED(location.typ)) return false;

    const flags = heroFormFlags(state);
    const mayDig = !((IS_WALL(location.typ) || location.typ === TREE)
        && ((location.wall_info ?? 0) & W_NONDIGGABLE));
    const cannotTunnel = !(flags & M1_TUNNEL)
        || !!(flags & M1_NEEDPICK) || !mayDig;
    const cannotPass = !heroCanPassWallAt(state, x, y);
    return cannotTunnel && cannotPass;
}

export function heroTightDiagonalReason(state = game) {
    const u = state.u;
    const flags = heroFormFlags(state);
    if (heroPassesWalls(state)) return 0;

    const mnum = (u.mtimedone ?? 0) > 0 ? u.umonnum ?? null : null;
    const flexible = !!(flags & (M1_AMORPHOUS | M1_SLITHY | M1_UNSOLID))
        || (mnum !== null && MONSTER_SYMBOL[mnum] === S_VORTEX)
        || mnum === PM_AIR_ELEMENTAL;
    if (mnum !== null && (MONSTER_SIZE[mnum] ?? 2) >= 3 && !flexible)
        return 1;
    if (inventoryWeight(state) > WT_TOOMUCH_DIAGONAL) return 2;
    if (state.level?.flags?.sokoban_rules) return 3;
    return 0;
}

function crawlDestinationAllowed(state: PlayingGameState, x: number, y: number) {
    const u = state.u;
    const location = state.level?.at?.(x, y);
    if (!u || !location || squareBlocksHero(state, x, y)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state)) return false;
    if (state.level?.monsters?.some(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y)) return false;
    if (x === u.ux || y === u.uy) return true;
    if ((u.mtimedone ?? 0) > 0 && u.umonnum === PM_GRID_BUG) return false;
    if (heroPassesWalls(state)) return true;
    if (location.typ === DOOR && !doorlessDoor(location)) return false;
    return !(heroBadRock(state, u.ux, y)
        && heroBadRock(state, x, u.uy)
        && heroTightDiagonalReason(state));
}

function crawlDestination(state: PlayingGameState, x: number, y: number, random: RandomBelow) {
    const directions = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let remaining = directions.length; remaining > 0; remaining--) {
        const index = random(remaining);
        const selected = directions[index];
        const last = directions[remaining - 1];
        if (selected === undefined || last === undefined)
            throw new RangeError('Crawl direction shuffle received an invalid index.');
        directions[index] = last;
        directions[remaining - 1] = selected;
    }

    for (const direction of directions) {
        const dx = CRAWL_DX[direction];
        const dy = CRAWL_DY[direction];
        if (dx === undefined || dy === undefined)
            throw new RangeError('Unknown crawl direction.');
        const candidate = { x: x + dx, y: y + dy };
        if (crawlDestinationAllowed(state, candidate.x, candidate.y))
            return candidate;
    }
    return null;
}

function heroStaysAboveWater(state: GameState, location: MapLocation | null) {
    const u = state.u;
    if (u.levitating || u.levitation || u.flying) return true;
    return heroHasWaterWalking(state) && location?.typ !== WATER;
}

function heroCanLiveUnderwater(state: GameState) {
    const u = state.u;
    const flags = heroFormFlags(state);
    return !!(u.amphibious || u.swimming || u.breathless
        || (flags & (M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS)));
}

function heroResistsFire(state: GameState) {
    const hero = state.u;
    return !!(hero.fireResistance);
}

function lavaName(location: MapLocation | null) {
    return location?.typ === LAVAWALL ? 'wall of lava' : 'molten lava';
}

async function burnLavaBoots(state: PlayingGameState, publish: MessagePublisher) {
    const boots = state.uarmf || state.u?.uarmf;
    if (!boots || boots.oerodeproof
        || (OBJECT_MATERIAL[boots.otyp] ?? 0) > 8) return false;
    const name = boots.name || OBJECT_NAMES[boots.otyp] || 'boots';
    await publish(`Your ${name} burst into flame!`);
    // destroyWornArmor() runs the full Boots_off-before-consume sequence; the
    // in_lava_effects counter raised around this whole entry suppresses the
    // nested float_down()/spoteffects() recursion (C trap.c:6863-6867).
    await destroyWornArmor(boots, state);
    boots.worn = false;
    boots.wornSlot = null;
    boots.owornmask = 0;
    boots.where = 'gone';
    findArmorClass(state);
    return true;
}

export async function burnAwayHeroSlime(state: GameState, publish: MessagePublisher) {
    if (!clearHeroSliming(state)) return false;
    await publish('The slime that covers you is burned away!');
    return true;
}

async function reviveHeroFromLava(state: PlayingGameState, publish: MessagePublisher, random: RandomBelow) {
    const lifeSaving = state === game ? beginHeroLifeSaving(random) : null;
    if (!lifeSaving) return false;
    await publish('But wait...  Your medallion begins to glow!');
    await publish('You feel much better!');
    await publish('The medallion crumbles to dust!');
    await completeHeroLifeSaving(lifeSaving);
    return true;
}

async function teleportHeroOutOfLiquid({
    state, random, rollOne, repaint, resetVision, recalculateVision,
    applyLandingEffects,
}: LiquidEscapeContext): Promise<EnteredLiquid | null> {
    const destination = safeTeleportDestination(state, random, rollOne);
    if (!destination) return null;
    const movement = await moveHeroByTeleport(destination.x, destination.y, state);
    return finishLiquidTeleport(movement, {
        state,
        repaint,
        resetVision,
        recalculateVision,
        applyLandingEffects,
    });
}

async function finishLavaLifeSaving({
    state, publish, random, rollOne, repaint, resetVision,
    recalculateVision, applyLandingEffects, die,
}: LavaSurvivalContext): Promise<EnteredLiquid> {
    for (let attempt = 0; attempt < 2; attempt++) {
        state.u.uhp = -1;
        await publish('You burn to a crisp...');
        if (!await reviveHeroFromLava(state, publish, random)) {
            await die({
                killer: 'molten lava',
                possessionAnswer: 'n',
                deathVerb: 'burned',
                deathType: BURNING,
            });
            if (state.context) state.context.move = 0;
            return { entered: true, moved: false, died: true };
        }

        if (state.program_state?.gameover)
            return { entered: true, moved: false, died: true };
        const escape = await teleportHeroOutOfLiquid({
            state, random, rollOne, repaint, resetVision,
            recalculateVision, applyLandingEffects,
        });
        if (escape) return escape;
        await publish("You're still burning.");
    }
    return { entered: true, moved: false, died: true };
}

// C lava_effects() brackets its boots- and inventory-burning stages with
// iflags.in_lava_effects so nested Boots_off()/float_down()/spoteffects()
// calls cannot re-enter it (do_wear.c:LEVITATION_BOOTS skips float_down()
// while the flag is raised).  The JS owner raises the same counter around
// the whole entry.
async function heroLavaEffects(options: LavaContext): Promise<EnteredLiquid> {
    const state = options.state || game;
    const from = { x: state.u.ux, y: state.u.uy };
    state.iflags ||= {};
    state.iflags.in_lava_effects = (state.iflags.in_lava_effects || 0) + 1;
    let result = null;
    try {
        result = await finishLavaEffects(options);
    } finally {
        state.iflags.in_lava_effects
            = Math.max(0, state.iflags.in_lava_effects - 1);
    }
    // C trap.c:6942-6961: the life-saving rescue's safe_teleds() runs while
    // the counter still suppresses its spoteffects; after the counter drops,
    // a rescue that relocated the hero gets the explicit spoteffects(FALSE)
    // landing -- full destination effects, but auto-pickup suppressed.
    if (result?.moved && !result?.died && options.applyLandingEffects) {
        const landing = await options.applyLandingEffects({
            from: result.from ?? from,
            to: { x: state.u.ux, y: state.u.uy },
            pick: false,
        });
        if (landing?.died) return { ...result, died: true };
    }
    return result;
}

async function finishLavaEffects({
    state, location, publish, random, rollDice, rollOne,
    repaint, resetVision, recalculateVision, applyLandingEffects, die,
}: LavaContext): Promise<EnteredLiquid> {
    // Ordinary death returns no value; damage handling needs the final state.
    const finishDamageDeath: DeathHandler = async options => {
        await die(options);
        return !!state.program_state.gameover;
    };
    const hero = state.u;
    const damage = rollDice(6, 6);
    await burnAwayHeroSlime(state, publish);
    if (heroLikesLava(state))
        return { entered: true, moved: false, died: false };

    const fireResistant = heroResistsFire(state);
    const waterWalkingBeforeBootsBurn = heroHasWaterWalking(state);
    const survives = fireResistant
        || (waterWalkingBeforeBootsBurn && damage < (hero.uhp ?? 0));
    const bootsBurned = await burnLavaBoots(state, publish);
    const waterWalking = heroHasWaterWalking(state);

    if (!fireResistant) {
        if (waterWalking) {
            await publish('The lava here burns you!');
            if (survives) {
                if (await loseHeroHp(damage, 'molten lava', {
                    state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
                })) return { entered: true, moved: false, died: true };
                const items = await destroyFireInventory(damage, {
                    state, publish, random, rollOne, die: finishDamageDeath,
                });
                if (items.heroDied) return { entered: true, moved: false, died: true };
                await igniteItems(state.inventory, { state, publish, random });
                return { entered: true, moved: false, died: false };
            }
        } else {
            await publish(`You fall into the ${lavaName(location)}!`);
        }

        const lifeSaver = state.uamul || hero.uamul;
        const willSurvive = lifeSaver?.otyp === AMULET_OF_LIFE_SAVING
            || state.flags?.debug || state.flags?.explore;
        await destroyLavaInventory({
            state,
            publish,
            random,
            showMessages: !!willSurvive,
            previouslyAnnounced: bootsBurned ? 1 : 0,
        });
        if (state.program_state?.gameover) return { entered: true, moved: false, died: true };
        return finishLavaLifeSaving({
            state, publish, random, rollOne, repaint, resetVision,
            recalculateVision, applyLandingEffects, die,
        });
    }

    let sank = false;
    if (!waterWalking
        && (!hero.utrap || hero.utraptype !== TT_LAVA)) {
        hero.utrap = random(4) + 4 + ((random(4) + 12) << 8);
        hero.utraptype = TT_LAVA;
        await publish(
            `You sink into the ${lavaName(location)}, but it only burns slightly!`,
        );
        if (hero.uhp > 1 && await loseHeroHp(1, 'molten lava', {
            state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
        })) return { entered: true, moved: false, died: true, sank: true };
        sank = true;
    }

    const items = await destroyFireInventory(damage, {
        state, publish, random, rollOne, die: finishDamageDeath,
    });
    if (items.heroDied) return { entered: true, moved: false, died: true, sank };
    await igniteItems(state.inventory, { state, publish, random });
    return { entered: true, moved: false, died: false, sank };
}

export async function sinkHeroIntoLava({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
    repaint = newsym,
    resetVision = vision_reset,
    recalculateVision = vision_recalc,
    applyLandingEffects = async () => {},
    die = finishOrdinaryDeath,
}: Omit<HeroLiquidOptions, 'rollDice' | 'chooseTeleportDestination' | 'entry'> = {}): Promise<LavaSinkingResult | null> {
    requirePlayingGame(state);
    const hero = state.u;
    if (!hero?.utrap || hero.utraptype !== TT_LAVA) return null;
    const location = state.level?.at?.(hero.ux, hero.uy);
    if (!location || !isLavaAt(state.u.ux, state.u.uy, state)) {
        hero.utrap = 0;
        hero.utraptype = 0;
        return { escaped: true };
    }
    if (hero.invulnerable || hero.uinvulnerable)
        return { sank: false, died: false };

    if (!heroResistsFire(state))
        hero.uhp = Math.trunc(((hero.uhp ?? 1) + 2) / 3);
    hero.utrap -= 1 << 8;
    if (hero.utrap < 1 << 8) {
        await publish('You sink below the surface and die.');
        await burnAwayHeroSlime(state, publish);
        hero.uhp = -1;
        if (!await reviveHeroFromLava(state, publish, random)) {
            await die({
                killer: 'molten lava',
                possessionAnswer: 'n',
                deathVerb: 'dissolved',
                deathType: DISSOLVED,
            });
            if (state.context) state.context.move = 0;
            return { sank: true, died: true };
        }

        if (state.program_state?.gameover) return { sank: true, died: true };
        hero.utrap = 0;
        hero.utraptype = 0;
        const airborne = hero.levitating || hero.levitation
            || hero.flying;
        if (!airborne) {
            const escape = await teleportHeroOutOfLiquid({
                state, random, rollOne, repaint, resetVision,
                recalculateVision, applyLandingEffects,
            });
            if (escape) return escape;
        }
        return { sank: true, died: false };
    }

    if (!hero.umoved) {
        const message = 'You sink deeper into the lava.';
        const slimeBurns = heroIsSliming(state)
            && rollOne(9) >= (hero.slimedTurns ?? 0);
        if (slimeBurns
            || (state._last_message !== message
                && state._pending_message !== message)) {
            await publish(message);
        }
        if (slimeBurns) await burnAwayHeroSlime(state, publish);
        hero.utrap += rollOne(4);
    }
    return { sank: true, died: false };
}

function heroDoesNotNeedAir(state: GameState) {
    const u = state.u;
    const flags = heroFormFlags(state);
    return !!(u.amphibious || u.breathless
        || (flags & (M1_AMPHIBIOUS | M1_BREATHLESS)));
}

export function heroCanSwim(state: GameState) {
    return !!(state.u?.swimming || (heroFormFlags(state) & M1_SWIM));
}

function equippedObject(state: GameState, slot: EquipmentSlot) {
    return state[slot] || state.u?.[slot] || null;
}

function canDropWhileDrowning(object: GameObject | null, state: GameState) {
    if (!object || object.in_use) return false;
    if (object.otyp === LOADSTONE && object.cursed) return false;
    for (const slot of [
        'uamul', 'uleft', 'uright', 'ublindf',
        'uarm', 'uarmc', 'uarmg', 'uarmf', 'uarmu',
    ] as const) {
        if (equippedObject(state, slot) === object) return false;
    }
    if (object.cursed && [
        equippedObject(state, 'uarmh'), equippedObject(state, 'uarms'),
    ].includes(object)) return false;
    const weapon = equippedObject(state, 'uwep');
    if (weapon === object && object.cursed) return false;
    return true;
}

function pickEmergencyDrop(state: GameState, random: RandomBelow) {
    const inventory = state.inventory || [];
    if (!inventory.length) return null;
    let remaining = random(inventory.length);
    let candidate = null;
    for (const object of inventory) {
        if (canDropWhileDrowning(object, state)) candidate = object;
        remaining--;
        if (remaining < 0 && candidate) break;
    }
    return candidate;
}

async function dropEmergencyObject(object: GameObject, state: GameState) {
    await removeWornHeroItem(object, state);
    if (state.program_state?.gameover) return false;
    await dropInventoryObjectAtHero(object, { state });
    return !state.program_state?.gameover;
}

async function emergencyDisrobe(state: GameState, random: RandomBelow): Promise<EmergencyDisrobe> {
    const capacityLimit = state.uball || state.u?.uball
        ? UNENCUMBERED : SLT_ENCUMBER;
    let dropped = false;
    while (nearCapacity(state) > capacityLimit) {
        const object = pickEmergencyDrop(state, random);
        if (!object) return { escaped: false, dropped };
        if (!await dropEmergencyObject(object, state))
            return { escaped: false, dropped, died: true };
        dropped = true;
    }
    if (dropped) findArmorClass(state);
    return { escaped: true, dropped };
}

function heroMovedWithinPool(state: GameState, x: number, y: number) {
    if (!state.u?.uinwater) return false;
    const previousX = Number.isInteger(state.u.ux0) ? state.u.ux0 : x;
    const previousY = Number.isInteger(state.u.uy0) ? state.u.uy0 : y;
    return isPoolAt(previousX, previousY, state);
}

async function wakeHeroForCrawl(state: GameState, publish: MessagePublisher) {
    const u = state.u;
    if (u.uhs === FAINTED) await resetHeroFaint({ state });
    if (u.usleep) {
        u.usleep = 0;
        state._helplessTurns = 0;
        state._helplessReason = null;
        state._helplessDoneMessage = null;
        await publish('Suddenly you wake up!');
        return;
    }
    if (state._helplessReason === 'unconscious from rotten food'
        || state._helplessReason === 'unconscious from drinking') {
        state._helplessTurns = 0;
        state._helplessReason = null;
        state._helplessDoneMessage = null;
    }
}

async function applyHeroFormWaterEffect(state: PlayingGameState, publish: MessagePublisher, random: RandomBelow, rollDice: RollDice): Promise<WaterFormEffect | null> {
    const u = state.u;
    if (!((u.mtimedone ?? 0) > 0)) return null;
    if (u.umonnum === PM_GREMLIN && random(3) !== 0) {
        const clone = await splitHeroMonsterForm(state);
        if (clone) await publish('You multiply!');
        return clone ? { kind: 'split', clone } : null;
    }
    if (u.umonnum !== PM_IRON_GOLEM) return null;

    await publish('You rust!');
    let damage = rollDice(2, 6);
    if (u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    if ((u.mhmax ?? 0) > damage) u.mhmax -= damage;
    const died = await loseHeroHp(damage, 'rusting away', {
        state, publish, deathCause: 'killed by rusting away',
    });
    return { kind: 'rust', damage, died };
}

async function finishLiquidTeleport(
    movement: LiquidMovement,
    {
        state,
        repaint,
        resetVision,
        recalculateVision,
        applyLandingEffects,
    }: LiquidTeleportContext,
): Promise<EnteredLiquid> {
    state.u.uinwater = 0;
    state.underwater = false;
    repaint(movement.oldx, movement.oldy);
    resetVision();
    recalculateVision(0);
    const from = { x: movement.oldx, y: movement.oldy };
    const to = { x: movement.x, y: movement.y };
    const landing = await applyLandingEffects({ from, to });
    return { entered: true, moved: true, died: !!landing?.died, from, to };
}

function drySurface(location: MapLocation | null) {
    if (location?.typ === ICE) return 'ice';
    if (location?.typ === DOOR) return 'a doorway';
    return 'solid ground';
}

async function leaveWater({
    state, location, publish, resetVision, recalculateVision,
}: Pick<LavaContext, 'state' | 'location' | 'publish' | 'resetVision' | 'recalculateVision'>) {
    const u = state.u;
    if (!u.uinwater) return false;

    let message = null;
    let stillInWater = false;
    if (!isPoolAt(u.ux, u.uy, state)) {
        if (heroIsOnWaterLevel(state)) {
            message = 'You pop into an air bubble.';
        } else if (isLavaAt(u.ux, u.uy, state)) {
            message = 'You leave the water...';
        } else {
            const preposition = u.levitating || u.levitation
                || u.flying ? 'over' : 'on';
            message = `You are back ${preposition} ${drySurface(location)}.`;
        }
    } else if (heroIsOnWaterLevel(state)) {
        stillInWater = true;
    } else if (u.levitating || u.levitation) {
        message = 'You pop out of the water like a cork!';
    } else if (u.flying) {
        message = 'You fly out of the water.';
    } else if (heroHasWaterWalking(state)) {
        message = 'You slowly rise above the surface.';
    } else {
        stillInWater = true;
    }

    if (stillInWater) return false;
    if (message) await publish(message);
    const wasUnderwater = !!state.underwater && !heroIsOnWaterLevel(state);
    u.uinwater = 0;
    state.underwater = false;
    if (wasUnderwater) {
        resetVision();
        recalculateVision(0);
    }
    return true;
}

// entry 'spot-effects' (C hack.c:spoteffects() -> pooleffects()) is the
// default.  entry 'float-down' (C trap.c:float_down() -> drown()/
// lava_effects()) skips the spoteffects-only stages: leaving water, the
// mounted-steed dismount, and the ceiling-hider check, none of which the
// direct drown()/lava_effects() calls perform.  Entry 'drown' also skips
// their terrain-entry guards: a submerged hero still drowns while held
// by a monster or wearing water-walking boots (C Amulet_off()).
export async function heroLiquidEffects(options: HeroLiquidOptions = {}): Promise<LiquidEffectResult | null | undefined> {
    const {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        recalculateVision = vision_recalc,
        resetVision = vision_reset,
        repaint = newsym,
        rollDice = d,
        rollOne = rnd,
        chooseTeleportDestination = null,
        applyLandingEffects = async () => {},
        die = finishOrdinaryDeath,
        entry = 'spot-effects',
    } = options;
    const fromFloatDown = entry === 'float-down';
    if (!state.level) return null;
    requirePlayingGame(state);
    const u = state.u;
    let x = u?.ux;
    let y = u?.uy;
    let location = state.level?.at?.(x, y);
    if (!u || !location) return null;
    if (entry !== 'drown') {
        const leftWater = fromFloatDown ? false : await leaveWater({
            state, location, publish, resetVision, recalculateVision,
        });
        const airborne = u.levitating || u.levitation
            || u.flying;
        if ((!isPoolAt(x, y, state) && !isLavaAt(x, y, state))
            || u.ustuck || airborne)
            return leftWater ? { left: true } : null;
        if (!fromFloatDown && u.usteed && !steedIsGrounded(u.usteed, state))
            return null;
        if (!fromFloatDown && heroHidesOnCeiling(state))
            return leftWater ? { left: true } : null;

        if (!fromFloatDown && u.usteed) {
            const from = { x, y };
            // Native pooleffects() lets dismount_steed() apply destination
            // effects and float_down(); this caller only reports the result.
            const dismount = await dismountHero(u.uinwater ? DISMOUNT_FELL : DISMOUNT_GENERIC, {
                state,
                random,
                announce: publish,
            });
            return {
                entered: true, dismounted: dismount.dismounted,
                moved: u.ux !== from.x || u.uy !== from.y
                    || (dismount.dismounted && (!!dismount.movement || !!dismount.location?.moved)),
                died: !!dismount.died || !!state.program_state?.gameover,
                from, to: { x: u.ux, y: u.uy },
            };
        }

        if (isLavaAt(x, y, state)) {
            return heroLavaEffects({
                state, location, publish, random, rollDice, rollOne,
                repaint, resetVision, recalculateVision, applyLandingEffects,
                die,
            });
        }
        if (heroStaysAboveWater(state, location))
            return leftWater ? { left: true } : null;
    }

    const waterWall = location.typ === WATER;
    let canLiveUnderwater = heroCanLiveUnderwater(state);
    let stayingInPool = false;
    if (heroMovedWithinPool(state, x, y) && canLiveUnderwater) {
        if (random(5) !== 0)
            return { entered: true, moved: false, died: false };
        stayingInPool = true;
    }
    if (!u.uinwater) {
        await publish(waterWall
            ? 'You plunge into the wall of water!'
            : 'You fall into the pool of water!');
        if (!heroCanSwim(state) && !waterWall)
            await publish(heroIsHallucinating(state)
                ? 'You sink like the Titanic.' : 'You sink like a rock.');
    }

    const damageMessages: string[] = [];
    await waterDamageChain(state.inventory || [], damageMessages, state);
    for (const message of damageMessages) await publish(message);

    const formEffect = await applyHeroFormWaterEffect(
        state, publish, random, rollDice,
    );
    if (formEffect?.died) return { entered: true, moved: false, died: true };
    canLiveUnderwater = heroCanLiveUnderwater(state);
    if (stayingInPool) {
        return {
            entered: true, moved: false, died: false, formEffect,
        };
    }

    const leashCount = releaseAllMonsterLeashes(state);
    if (leashCount) {
        await publish(leashCount === 1
            ? 'The leash slips loose.' : 'The leashes slip loose.');
    }

    if (canLiveUnderwater) {
        if (heroDoesNotNeedAir(state))
            await publish("But you aren't drowning.");
        u.uinwater = 1;
        recalculateVision(1);
        return { entered: true, moved: false, died: false };
    }

    const luck = u.uluck ?? 0;
    if (heroCanTeleport(state) && !heroIsUnaware(state)
        && (heroControlsTeleport(state) || random(3) < luck + 2)) {
        await publish('You attempt a teleport spell.');
        if (heroTeleportRestricted(state)) {
            await publish('The attempted teleport spell fails.');
        } else {
            const teleport = await teleportHeroAtWill({
                state, random, rollOne,
                chooseDestination: chooseTeleportDestination,
                publish,
                finishArrival: movement => finishLiquidTeleport(movement, {
                    state, repaint, resetVision, recalculateVision, applyLandingEffects,
                }),
            });
            if (teleport.died) return { entered: true, moved: teleport.moved, died: true };
            if (teleport.moved) {
                return teleport.arrival;
            }
        }
    }

    await wakeHeroForCrawl(state, publish);
    const canMove = !((state._helplessTurns ?? 0) > 0)
        && (!((u.mtimedone ?? 0) > 0) || (MONSTER_MOVE[u.umonnum] ?? 0) > 0);
    const destination = canMove
        ? crawlDestination(state, x, y, random) : null;
    if (destination) {
        const escape = heroIsOnWaterLevel(state)
            ? { escaped: true, dropped: false }
            : await emergencyDisrobe(state, random);
        if (escape.died) return { entered: true, moved: false, died: true };
        await publish('You try to crawl out of the water.');
        if (escape.dropped)
            await publish('You dump some of your gear to lose weight...');
        if (escape.escaped) {
            await publish('Pheew!  That was close.');
            // C trap.c:5164 relocates through teleds(TELEDS_ALLOW_DRAG),
            // which resets the trap/hold state and drags the ball and chain
            // along, then runs the full destination effects below.
            await moveHeroByTeleport(destination.x, destination.y, state,
                { allowDrag: true });
            repaint(x, y);
            recalculateVision(1);
            const landing = await applyLandingEffects({
                from: { x, y },
                to: { x: u.ux, y: u.uy },
            });
            return {
                entered: true, moved: true, died: !!landing?.died,
                from: { x, y }, to: { x: u.ux, y: u.uy },
            };
        }
        await publish('But in vain.');
    }

    u.uinwater = 1;
    await publish('You drown.');
    for (let attempt = 0; attempt < 2; attempt++) {
        u.uhp = 0;
        const lifeSaving = state === game ? beginHeroLifeSaving(random) : null;
        if (!lifeSaving) {
            await die({
                killer: 'deep water',
                possessionAnswer: 'n',
                deathVerb: 'drowned',
            });
            if (state.context) state.context.move = 0;
            return { entered: true, moved: false, died: true };
        }

        await publish('But wait...  Your medallion begins to glow!');
        await publish('You feel much better!');
        await publish('The medallion crumbles to dust!');
        await completeHeroLifeSaving(lifeSaving);
        if (state.program_state?.gameover)
            return { entered: true, moved: false, died: true };

        const destination = safeTeleportDestination(state, random, rollOne);
        if (destination) {
            const movement = await moveHeroByTeleport(
                destination.x, destination.y, state,
            );
            if (state.flags?.verbose !== false) {
                await publish('You materialize in a different location!');
            }
            return finishLiquidTeleport(movement, {
                state,
                repaint,
                resetVision,
                recalculateVision,
                applyLandingEffects,
            });
        }
        if (attempt === 0) await publish("You're still drowning.");
    }

    if (state.context) state.context.move = 0;
    return { entered: true, moved: false, died: true };
}

// Terrain that blocks ordinary movement. C hack.c.
export function blocksMove(x: number, y: number) {
    const loc = game.level?.at(x, y);
    if (!loc) return true;
    if (loc.typ === STONE) return true;
    if (IS_WALL(loc.typ) || IS_OBSTRUCTED(loc.typ)) return true;
    if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) return true;
    return false;
}
