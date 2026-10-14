// Effects of entering the hero's current square.
// C ref: hack.c pooleffects() and trap.c drown().
import { monsterHasMapPosition } from './monster_location.js';
import { heroIsHallucinating } from './senses.js';
import { BURNING, D_BROKEN, D_CLOSED, D_LOCKED, DISMOUNT_FELL, DISMOUNT_GENERIC, DISSOLVED, DROWNING, DOOR, ICE, IS_AIR, IS_OBSTRUCTED, IS_STWALL, IS_WALL, IS_WATERWALL, Is_waterlevel, LAVAPOOL, LAVAWALL, PARANOID_SWIM, POOL, ROOM, STONE, FAINTED, TREE, TT_LAVA, Upolyd, WATER, W_NONDIGGABLE, W_NONPASSWALL, WT_TOOMUCH_DIAGONAL, } from './const.js';
import { displayLiquidName, feel_newsym, newsym, plineWithContinuation, updateLastSeenTerrain } from './display.js';
import { heroPassesWalls, heroFormSticks } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { setHeroInWater } from './terrain_movement.js';
import { monsterName } from './monster_name.js';
import { beginHeroLifeSaving, completeHeroLifeSaving, finishHeroDeath, identifyLifeSavingAmulet, } from './end.js';
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
import { MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL, } from './monster_data.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, LOADSTONE, OBJECT_MATERIAL, OBJECT_NAMES, } from './object_data.js';
import { heroFormClings, heroFormFlags, heroHidesOnCeiling, heroIsFlying, } from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { destroyLavaInventory, markLavaInventoryForDestruction, waterDamageChain } from './trap.js';
import { objectMaterial } from './object_material.js';
import { dismountHero, steedIsGrounded } from './steed.js';
import { heroCanTeleport, heroControlsTeleport, moveHeroByTeleport, safeTeleportDestination, teleportHeroAtWill, } from './teleport.js';
import { heroTeleportRestricted } from './teleport_rules.js';
import { vision_recalc, vision_reset } from './vision.js';
import { inventoryWeight, nearCapacity, SLT_ENCUMBER, UNENCUMBERED, } from './weight.js';
import { destroyWornArmor, findArmorClass, heroHasWaterWalking, heroKnowsLavaWalking, heroKnowsWaterWalking, } from './armor.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { isLavaAt, isPoolAt, levelHasCeiling, levelIsWaterLevel as heroIsOnWaterLevel } from './terrain_properties.js';
import { refreshMovementProperties, setPropertyTimeout } from './properties.js';
import { surfaceName, waterbodyName } from './terrain_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { iceDescriptionAt } from './dungeon_feature.js';
// C hack.c:escape_from_sticky_mon(). True means this attempt was spent
// struggling; release clears the grip directly, without unstuck's cooldown.
export async function escapeFromStickyMonster(x, y) {
    const state = game;
    const holder = state.u.ustuck;
    if (!holder || x === holder.mx && y === holder.my)
        return false;
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
function heroIsInAir(state) {
    const hero = state.u;
    if (hero.levitating || hero.levitation)
        return true;
    const symbol = (hero.mtimedone ?? 0) > 0 && hero.umonnum !== undefined
        ? MONSTER_SYMBOL[hero.umonnum] : null;
    return heroIsFlying(state)
        || symbol === S_EYE
        || symbol === S_LIGHT
        || (heroFormClings(state) && levelHasCeiling(state));
}
function heroFloorType(state, x, y) {
    const terrain = state.level?.at?.(x, y)?.typ;
    if (terrain !== undefined && IS_WATERWALL(terrain))
        return WATER;
    if (terrain === LAVAWALL)
        return LAVAWALL;
    if (!heroIsInAir(state)) {
        if (isPoolAt(x, y, state))
            return POOL;
        if (isLavaAt(x, y, state))
            return LAVAPOOL;
    }
    return ROOM;
}
export function heroShouldAvoidLiquid(x, y, state = game) {
    const hero = state.u;
    const destination = state.level?.at?.(x, y);
    if (!hero || !destination)
        return false;
    const newFloor = heroFloorType(state, x, y);
    const liquidWall = IS_WATERWALL(newFloor) || newFloor === LAVAWALL;
    if (hero.uinwater && (isPoolAt(x, y, state)
        || IS_WATERWALL(newFloor)))
        return false;
    if (newFloor === heroFloorType(state, hero.ux, hero.uy)
        || hero.stunned || (hero.stunnedTurns ?? 0) > 0
        || hero.confused || (hero.confusionTurns ?? 0) > 0
        || !destination.seenv
        || (!isPoolAt(x, y, state) && !isLavaAt(x, y, state)
            && !liquidWall))
        return false;
    const dangerousPool = isPoolAt(x, y, state)
        && !heroKnowsWaterWalking(state);
    const dangerousLava = isLavaAt(x, y, state)
        && !heroKnowsLavaWalking(state)
        && !isLavaAt(hero.ux, hero.uy, state);
    if (!dangerousPool && !dangerousLava && !liquidWall)
        return false;
    if (state.context?.nopick) {
        state._tipSwimShown = true;
        return false;
    }
    return liquidWall
        || !!((state.flags?.paranoia_bits ?? 0) & PARANOID_SWIM);
}
function squareBlocksHero(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (heroCanPassWallAt(state, x, y))
        return false;
    if (!location || location.typ === STONE
        || IS_OBSTRUCTED(location.typ))
        return true;
    return location.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}
export function heroCanPassWallAt(state, x, y) {
    const location = requireGameLevel(state).at(x, y);
    return !!location && heroPassesWalls(state)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
}
function doorlessDoor(location) {
    return location?.typ === DOOR
        // Rogue doorways have no doors but retain diagonal restrictions.
        && !game.level?.flags.is_rogue_level
        && !((location.doormask || 0) & ~D_BROKEN);
}
export function blocksDiagonalDoor(current, destination) {
    return (destination?.typ === DOOR && !doorlessDoor(destination))
        || (current?.typ === DOOR && !doorlessDoor(current));
}
export function heroBadRock(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return true;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (state.level?.flags?.sokoban_rules
        && pile.some(object => object.otyp === BOULDER))
        return true;
    if (!IS_OBSTRUCTED(location.typ))
        return false;
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
    if (heroPassesWalls(state))
        return 0;
    const mnum = (u.mtimedone ?? 0) > 0 ? u.umonnum ?? null : null;
    const flexible = !!(flags & (M1_AMORPHOUS | M1_SLITHY | M1_UNSOLID))
        || (mnum !== null && MONSTER_SYMBOL[mnum] === S_VORTEX)
        || mnum === PM_AIR_ELEMENTAL;
    if (mnum !== null && (MONSTER_SIZE[mnum] ?? 2) >= 3 && !flexible)
        return 1;
    if (inventoryWeight(state) > WT_TOOMUCH_DIAGONAL)
        return 2;
    if (state.level?.flags?.sokoban_rules)
        return 3;
    return 0;
}
function crawlDestinationAllowed(state, x, y) {
    const u = state.u;
    const location = state.level?.at?.(x, y);
    if (!u || !location || squareBlocksHero(state, x, y)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state))
        return false;
    if (state.level?.monsters?.some(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y))
        return false;
    if (x === u.ux || y === u.uy)
        return true;
    if ((u.mtimedone ?? 0) > 0 && u.umonnum === PM_GRID_BUG)
        return false;
    if (heroPassesWalls(state))
        return true;
    if (location.typ === DOOR && !doorlessDoor(location))
        return false;
    return !(heroBadRock(state, u.ux, y)
        && heroBadRock(state, x, u.uy)
        && heroTightDiagonalReason(state));
}
function crawlDestination(state, x, y, random) {
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
function heroStaysAboveWater(state, location) {
    const u = state.u;
    if (u.levitating || u.levitation || u.flying)
        return true;
    return heroHasWaterWalking(state) && location?.typ !== WATER;
}
function heroCanLiveUnderwater(state) {
    const u = state.u;
    const flags = heroFormFlags(state);
    return !!(u.amphibious || u.swimming || u.breathless || u.magicalBreathing
        || (flags & (M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS)));
}
function heroResistsFire(state) {
    const hero = state.u;
    return !!(hero.fireResistance);
}
function lavaName(location) {
    return location?.typ === LAVAWALL ? 'wall of lava' : 'molten lava';
}
async function burnLavaBoots(state, publish, protectedObject) {
    const boots = state.uarmf || state.u?.uarmf;
    if (!boots || !(boots.in_use || (!boots.oerodeproof && objectMaterial(boots, state) <= 8)))
        return false;
    const name = boots.name || OBJECT_NAMES[boots.otyp] || 'boots';
    await publish(`Your ${name} burst into flame!`);
    // destroyWornArmor() runs the full Boots_off-before-consume sequence; the
    // in_lava_effects counter raised around this whole entry suppresses the
    // nested float_down()/spoteffects() recursion (C trap.c:6863-6867).
    if (boots === protectedObject) {
        await removeWornHeroItem(boots, state);
        return true;
    }
    await destroyWornArmor(boots, state);
    boots.worn = false;
    boots.wornSlot = null;
    boots.owornmask = 0;
    boots.where = 'gone';
    return true;
}
export async function burnAwayHeroSlime(state, publish) {
    if (!clearHeroSliming(state))
        return false;
    await publish('The slime that covers you is burned away!');
    return true;
}
async function reviveHeroFromLiquid(state, publish, random) {
    const lifeSaving = state === game ? beginHeroLifeSaving() : null;
    if (!lifeSaving)
        return false;
    await publish('But wait...');
    identifyLifeSavingAmulet(random);
    await publish('Your medallion begins to glow!');
    await publish('You feel much better!');
    await publish('The medallion crumbles to dust!');
    await completeHeroLifeSaving(lifeSaving);
    return true;
}
async function finishLiquidDeath(options) {
    // The liquid effect has already announced the death. done() still owns
    // life saving and the wizard/explore recovery question.
    return await finishHeroDeath({ ...options, deathLineShown: true });
}
async function teleportHeroOutOfLiquid({ state, random, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
    const destination = safeTeleportDestination(state, random, rollOne);
    if (!destination)
        return null;
    const movement = await moveHeroByTeleport(destination.x, destination.y, state);
    return finishLiquidTeleport(movement, {
        state,
        repaint,
        resetVision,
        recalculateVision,
        applyLandingEffects,
    });
}
async function finishLavaLifeSaving({ state, publish, random, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, die, }) {
    for (let attempt = 0; attempt < 2; attempt++) {
        state.u.uhp = -1;
        await publish('You burn to a crisp...', { urgent: true });
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer: 'molten lava',
                possessionAnswer: 'n',
                deathVerb: 'burned',
                deathType: BURNING,
            });
            if (state.program_state.gameover)
                return { entered: true, moved: false, died: true };
        }
        if (state.program_state?.gameover)
            return { entered: true, moved: false, died: true };
        const escape = await teleportHeroOutOfLiquid({
            state, random, rollOne, repaint, resetVision,
            recalculateVision, applyLandingEffects,
        });
        if (escape)
            return escape;
        await publish("You're still burning.");
    }
    // C lava_effects(): two recoveries without a landing give the hero
    // five turns to find another way out before the lava becomes fatal again.
    if (!heroResistsFire(state))
        setPropertyTimeout('fireResistance', 5, state);
    if (!heroHasWaterWalking(state))
        setPropertyTimeout('waterWalking', 5, state);
    return { entered: true, moved: false, died: false };
}
// C lava_effects() brackets its boots- and inventory-burning stages with
// iflags.in_lava_effects so nested Boots_off()/float_down()/spoteffects()
// calls cannot re-enter it (do_wear.c:LEVITATION_BOOTS skips float_down()
// while the flag is raised).  The JS owner raises the same counter around
// the whole entry.
async function heroLavaEffects(options) {
    const state = options.state || game;
    const from = { x: state.u.ux, y: state.u.uy };
    state.iflags ||= {};
    state.iflags.in_lava_effects = (state.iflags.in_lava_effects || 0) + 1;
    let result = null;
    try {
        result = await finishLavaEffects(options);
    }
    finally {
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
        if (landing?.died)
            return { ...result, died: true };
    }
    return result;
}
async function finishLavaEffects({ state, location, publish, random, rollDice, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, die, }) {
    // Ordinary death returns no value; damage handling needs the final state.
    const finishDamageDeath = async (options) => {
        await die(options);
        return !!state.program_state.gameover;
    };
    const hero = state.u;
    const damage = rollDice(6, 6);
    // C lava_effects() maps the liquid by touch before its first message.
    if (state === game)
        feel_newsym(hero.ux, hero.uy);
    await burnAwayHeroSlime(state, publish);
    if (heroLikesLava(state))
        return { entered: true, moved: false, died: false };
    const fireResistant = heroResistsFire(state);
    const waterWalkingBeforeBootsBurn = heroHasWaterWalking(state);
    const survives = fireResistant
        || (waterWalkingBeforeBootsBurn && damage < (hero.uhp ?? 0));
    const protectedObject = survives ? null : await markLavaInventoryForDestruction(state, random);
    const bootsBurned = await burnLavaBoots(state, publish, protectedObject);
    const waterWalking = heroHasWaterWalking(state);
    if (!fireResistant) {
        if (waterWalking) {
            await publish('The lava here burns you!');
            if (survives) {
                if (await loseHeroHp(damage, 'molten lava', {
                    state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
                }))
                    return { entered: true, moved: false, died: true };
                const items = await destroyFireInventory(damage, {
                    state, publish, random, rollOne, die: finishDamageDeath,
                });
                if (items.heroDied)
                    return { entered: true, moved: false, died: true };
                await igniteItems(state.inventory, { state, publish, random });
                return { entered: true, moved: false, died: false };
            }
        }
        else {
            await publish(`You fall into the ${lavaName(location)}!`);
        }
        const lifeSaver = state.uamul || hero.uamul;
        const willSurvive = lifeSaver?.otyp === AMULET_OF_LIFE_SAVING
            || state.flags?.debug || state.flags?.explore;
        await destroyLavaInventory({
            state,
            publish,
            protectedObject,
            showMessages: !!willSurvive,
            previouslyAnnounced: bootsBurned ? 1 : 0,
        });
        if (state.program_state?.gameover)
            return { entered: true, moved: false, died: true };
        const rescue = await finishLavaLifeSaving({
            state, publish, random, rollOne, repaint, resetVision,
            recalculateVision, applyLandingEffects, die,
        });
        if (rescue.died || rescue.moved)
            return rescue;
        const items = await destroyFireInventory(damage, {
            state, publish, random, rollOne, die: finishDamageDeath,
        });
        if (items.heroDied)
            return { ...rescue, died: true };
        await igniteItems(state.inventory, { state, publish, random });
        return rescue;
    }
    let sank = false;
    if (!waterWalking
        && (!hero.utrap || hero.utraptype !== TT_LAVA)) {
        hero.utrap = random(4) + 4 + ((random(4) + 12) << 8);
        hero.utraptype = TT_LAVA;
        await publish(`You sink into the ${lavaName(location)}, but it only burns slightly!`);
        if (hero.uhp > 1 && await loseHeroHp(1, 'molten lava', {
            state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
        }))
            return { entered: true, moved: false, died: true, sank: true };
        sank = true;
    }
    const items = await destroyFireInventory(damage, {
        state, publish, random, rollOne, die: finishDamageDeath,
    });
    if (items.heroDied)
        return { entered: true, moved: false, died: true, sank };
    await igniteItems(state.inventory, { state, publish, random });
    return { entered: true, moved: false, died: false, sank };
}
export async function sinkHeroIntoLava({ state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, repaint = newsym, resetVision = vision_reset, recalculateVision = vision_recalc, applyLandingEffects = async () => { }, die = finishLiquidDeath, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (!hero?.utrap || hero.utraptype !== TT_LAVA)
        return null;
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
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer: 'molten lava',
                possessionAnswer: 'n',
                deathVerb: 'dissolved',
                deathType: DISSOLVED,
            });
        }
        if (state.program_state.gameover)
            return { sank: true, died: true };
        hero.utrap = 0;
        hero.utraptype = 0;
        refreshMovementProperties(state);
        const airborne = hero.levitating || hero.levitation
            || hero.flying;
        if (!airborne) {
            const escape = await teleportHeroOutOfLiquid({
                state, random, rollOne, repaint, resetVision,
                recalculateVision, applyLandingEffects,
            });
            if (escape)
                return escape;
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
        if (slimeBurns)
            await burnAwayHeroSlime(state, publish);
        hero.utrap += rollOne(4);
    }
    return { sank: true, died: false };
}
function heroDoesNotNeedAir(state) {
    const u = state.u;
    const flags = heroFormFlags(state);
    return !!(u.amphibious || u.breathless || u.magicalBreathing
        || (flags & (M1_AMPHIBIOUS | M1_BREATHLESS)));
}
export function heroCanSwim(state) {
    return !!(state.u?.swimming || (heroFormFlags(state) & M1_SWIM));
}
function equippedObject(state, slot) {
    return state[slot] || state.u?.[slot] || null;
}
function canDropWhileDrowning(object, state) {
    if (!object || object.in_use)
        return false;
    if (object.otyp === LOADSTONE && object.cursed)
        return false;
    for (const slot of [
        'uamul', 'uleft', 'uright', 'ublindf',
        'uarm', 'uarmc', 'uarmg', 'uarmf', 'uarmu',
    ]) {
        if (equippedObject(state, slot) === object)
            return false;
    }
    if (object.cursed && [
        equippedObject(state, 'uarmh'), equippedObject(state, 'uarms'),
    ].includes(object))
        return false;
    const weapon = equippedObject(state, 'uwep');
    if (weapon === object && object.cursed)
        return false;
    return true;
}
function pickEmergencyDrop(state, random) {
    const inventory = state.inventory || [];
    if (!inventory.length)
        return null;
    let remaining = random(inventory.length);
    let candidate = null;
    for (const object of inventory) {
        if (canDropWhileDrowning(object, state))
            candidate = object;
        remaining--;
        if (remaining < 0 && candidate)
            break;
    }
    return candidate;
}
async function dropEmergencyObject(object, state) {
    await removeWornHeroItem(object, state);
    if (state.program_state?.gameover)
        return false;
    await dropInventoryObjectAtHero(object, { state });
    return !state.program_state?.gameover;
}
async function emergencyDisrobe(state, random) {
    const capacityLimit = state.uball || state.u?.uball
        ? UNENCUMBERED : SLT_ENCUMBER;
    let dropped = false;
    while (nearCapacity(state) > capacityLimit) {
        const object = pickEmergencyDrop(state, random);
        if (!object)
            return { escaped: false, dropped };
        if (!await dropEmergencyObject(object, state))
            return { escaped: false, dropped, died: true };
        dropped = true;
    }
    if (dropped)
        findArmorClass(state);
    return { escaped: true, dropped };
}
function heroMovedWithinPool(state, x, y) {
    if (!state.u?.uinwater)
        return false;
    const previousX = Number.isInteger(state.u.ux0) ? state.u.ux0 : x;
    const previousY = Number.isInteger(state.u.uy0) ? state.u.uy0 : y;
    return isPoolAt(previousX, previousY, state);
}
async function wakeHeroForCrawl(state, publish) {
    const u = state.u;
    if (u.uhs === FAINTED)
        await resetHeroFaint({ state });
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
async function applyHeroFormWaterEffect(state, publish, random, rollDice) {
    const u = state.u;
    if (!((u.mtimedone ?? 0) > 0))
        return null;
    if (u.umonnum === PM_GREMLIN && random(3) !== 0) {
        const clone = await splitHeroMonsterForm(state);
        if (clone)
            await publish('You multiply!');
        return clone ? { kind: 'split', clone } : null;
    }
    if (u.umonnum !== PM_IRON_GOLEM)
        return null;
    await publish('You rust!');
    let damage = rollDice(2, 6);
    if (u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    if ((u.mhmax ?? 0) > damage)
        u.mhmax -= damage;
    const died = await loseHeroHp(damage, 'rusting away', {
        state, publish, deathCause: 'killed by rusting away',
    });
    return { kind: 'rust', damage, died };
}
async function finishLiquidTeleport(movement, { state, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
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
function drySurface(location) {
    if (location?.typ === ICE)
        return 'ice';
    if (location?.typ === DOOR)
        return 'a doorway';
    return 'solid ground';
}
async function leaveWater({ state, location, publish, resetVision, recalculateVision, }) {
    const u = state.u;
    if (!u.uinwater)
        return false;
    let message = null;
    let stillInWater = false;
    if (!isPoolAt(u.ux, u.uy, state)) {
        if (heroIsOnWaterLevel(state)) {
            message = 'You pop into an air bubble.';
        }
        else if (isLavaAt(u.ux, u.uy, state)) {
            message = 'You leave the water...';
        }
        else {
            const preposition = u.levitating || u.levitation
                || u.flying ? 'over' : 'on';
            message = `You are back ${preposition} ${drySurface(location)}.`;
        }
    }
    else if (heroIsOnWaterLevel(state)) {
        stillInWater = true;
    }
    else if (u.levitating || u.levitation) {
        message = 'You pop out of the water like a cork!';
    }
    else if (u.flying) {
        message = 'You fly out of the water.';
    }
    else if (heroHasWaterWalking(state)) {
        message = 'You slowly rise above the surface.';
    }
    else {
        stillInWater = true;
    }
    if (stillInWater)
        return false;
    if (message)
        await publish(message);
    const wasUnderwater = !!state.underwater && !heroIsOnWaterLevel(state);
    await setHeroInWater(false, state);
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
export async function heroLiquidEffects(options = {}) {
    const { state = game, publish = plineWithContinuation, random = rn2, recalculateVision = vision_recalc, resetVision = vision_reset, repaint = newsym, rollDice = d, rollOne = rnd, chooseTeleportDestination = null, applyLandingEffects = async () => { }, die = finishLiquidDeath, entry = 'spot-effects', } = options;
    const fromFloatDown = entry === 'float-down';
    if (!state.level)
        return null;
    requirePlayingGame(state);
    const u = state.u;
    let x = u?.ux;
    let y = u?.uy;
    let location = state.level?.at?.(x, y);
    if (!u || !location)
        return null;
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
    // drown() maps the water by touch before any entry message can page.
    if (state === game)
        feel_newsym(x, y);
    const waterWall = location.typ === WATER;
    let canLiveUnderwater = heroCanLiveUnderwater(state);
    let stayingInPool = false;
    if (heroMovedWithinPool(state, x, y) && canLiveUnderwater) {
        if (random(5) !== 0)
            return { entered: true, moved: false, died: false };
        stayingInPool = true;
    }
    if (!u.uinwater) {
        await publish(`You ${waterWall ? 'plunge' : 'fall'} into the ${waterbodyName(x, y, state)}${canLiveUnderwater ? '.' : '!'}`);
        if (!heroCanSwim(state) && !waterWall)
            await publish(heroIsHallucinating(state)
                ? 'You sink like the Titanic.' : 'You sink like a rock.');
    }
    const damageMessages = [];
    await waterDamageChain(state.inventory || [], damageMessages, state);
    for (const message of damageMessages)
        await publish(message);
    const formEffect = await applyHeroFormWaterEffect(state, publish, random, rollDice);
    if (formEffect?.died)
        return { entered: true, moved: false, died: true };
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
        if (heroDoesNotNeedAir(state)) {
            if (state.flags.verbose)
                await publish("But you aren't drowning.");
            if (!heroIsOnWaterLevel(state))
                await publish(heroIsHallucinating(state) ? 'Your keel hits the bottom.' : 'You touch bottom.');
        }
        await setHeroInWater(true, state);
        recalculateVision(1);
        return { entered: true, moved: false, died: false };
    }
    const luck = u.uluck ?? 0;
    if (heroCanTeleport(state) && !heroIsUnaware(state)
        && (heroControlsTeleport(state) || random(3) < luck + 2)) {
        await publish('You attempt a teleport spell.');
        if (heroTeleportRestricted(state)) {
            await publish('The attempted teleport spell fails.');
        }
        else {
            const teleport = await teleportHeroAtWill({
                state, random, rollOne,
                chooseDestination: chooseTeleportDestination,
                publish,
                finishArrival: movement => finishLiquidTeleport(movement, {
                    state, repaint, resetVision, recalculateVision, applyLandingEffects,
                }),
            });
            if (teleport.died)
                return { entered: true, moved: teleport.moved, died: true };
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
        if (escape.died)
            return { entered: true, moved: false, died: true };
        await publish('You try to crawl out of the water.');
        if (escape.dropped)
            await publish('You dump some of your gear to lose weight...');
        if (escape.escaped) {
            await publish('Pheew!  That was close.');
            // C trap.c:5164 relocates through teleds(TELEDS_ALLOW_DRAG),
            // which resets the trap/hold state and drags the ball and chain
            // along, then runs the full destination effects below.
            await moveHeroByTeleport(destination.x, destination.y, state, { allowDrag: true });
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
    await setHeroInWater(true, state);
    await publish('You drown.');
    for (let attempt = 0; attempt < 2; attempt++) {
        const liquid = waterbodyName(u.ux, u.uy, state);
        const killer = liquid === 'water' ? 'deep water' : liquid;
        const description = liquid === 'water' || liquid === 'limitless water'
            ? killer : withIndefiniteArticle(killer);
        u.uhp = 0;
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer,
                deathCause: `drowned in ${description}`,
                deathType: DROWNING,
                possessionAnswer: 'n',
                deathVerb: 'drowned',
            });
        }
        if (state.program_state.gameover)
            return { entered: true, moved: false, died: true };
        const destination = safeTeleportDestination(state, random, rollOne);
        if (destination) {
            const movement = await moveHeroByTeleport(destination.x, destination.y, state);
            if (state.flags?.verbose !== false) {
                await publish('You materialize in a different location!');
            }
            const escape = await finishLiquidTeleport(movement, {
                state,
                repaint,
                resetVision,
                recalculateVision,
                applyLandingEffects,
            });
            if (!escape.died)
                await announceTerrainRescue(DROWNING, state, publish);
            return escape;
        }
        await publish("You're still drowning.");
    }
    await setHeroInWater(false, state);
    state.underwater = false;
    await announceTerrainRescue(DROWNING, state, publish);
    // C drown() returns TRUE after rescue even when no safe landing exists.
    return { entered: true, moved: true, died: false };
}
// C trap.c:rescued_from_terrain()/back_on_ground(TRUE).
export async function announceTerrainRescue(how, state, publish = plineWithContinuation) {
    const { ux, uy } = state.u;
    const location = state.level.requireAt(ux, uy);
    if (how === DROWNING && isPoolAt(ux, uy, state)) {
        const position = heroIsOnWaterLevel(state) || IS_WATERWALL(location.typ)
            ? 'in the midst' : 'on top';
        await publish(`You find yourself ${position} of ${displayLiquidName('water', state)}.`);
    }
    else if (how === DROWNING && IS_AIR(location.typ)) {
        await publish(`You find yourself in ${heroIsOnWaterLevel(state) ? 'an air bubble' : 'mid air'}.`);
    }
    else if (how !== DROWNING && isPoolAt(ux, uy, state)) {
        await publish(`You find yourself ${state.u.uinwater ? 'in' : 'on'} ${displayLiquidName('water', state)}.`);
    }
    else if (how !== DROWNING && isLavaAt(ux, uy, state)) {
        await publish(`You find yourself on top of ${displayLiquidName('molten lava', state)}.`);
    }
    else {
        let surface = surfaceName(ux, uy, state);
        let preposition = state.u.levitating || state.u.levitation || state.u.flying ? 'over' : 'on';
        switch (surface) {
            case 'floor':
            case 'ground':
                surface = 'solid ground';
                break;
            case 'ice':
                surface = iceDescriptionAt(ux, uy, { state });
                break;
            case 'bridge':
            case 'altar':
            case 'headstone':
                surface = withIndefiniteArticle(surface);
                break;
            case 'stairs':
            case 'lava':
            case 'bottom':
                surface = `the ${surface}`;
                break;
            case 'air':
                surface = 'the air';
                preposition = 'in';
                break;
            default:
                surface = withIndefiniteArticle(surface);
                preposition = 'in';
        }
        await publish(`You find yourself ${preposition} ${surface}.`);
    }
    if (state === game)
        updateLastSeenTerrain(ux, uy);
}
// Terrain that blocks ordinary movement. C hack.c.
export function blocksMove(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc)
        return true;
    if (loc.typ === STONE)
        return true;
    if (IS_WALL(loc.typ) || IS_OBSTRUCTED(loc.typ))
        return true;
    if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED)))
        return true;
    return false;
}
//# sourceMappingURL=hack.js.map