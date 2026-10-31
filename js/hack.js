// Hero movement, travel, and terrain effects.
// C refs: hack.c:test_move(), findtravelpath(), lookaround(), domove(), pooleffects().
import { setHeroGrip } from './hero_grip.js';
import { finishHeroHelplessness } from './allmain.js';
import { formatFeltMessage } from './hero_speech.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { BURNING, D_BROKEN, D_CLOSED, D_LOCKED, DISMOUNT_FELL, DISMOUNT_GENERIC, DISSOLVED, DROWNING, DOOR, IS_AIR, IS_OBSTRUCTED, IS_STWALL, IS_WALL, IS_WATERWALL, Is_waterlevel, LAVAPOOL, LAVAWALL, PARANOID_SWIM, POOL, ROOM, STONE, FAINTED, M_SEEN_FIRE, TREE, TT_LAVA, Upolyd, WATER, W_NONDIGGABLE, W_NONPASSWALL, WT_TOOMUCH_DIAGONAL, TIP_SWIM, PLNMSG_BACK_ON_GROUND, DBWALL, def_warnsyms, A_CON, A_DEX, COLNO, ROWNO, SCORR, SDOOR, CORR, ICE, IRONBARS, IS_FURNITURE, M_AP_NOTHING, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, SHOPBASE, Is_airlevel, In_sokoban, isok, ACCESSIBLE, AIR, DIGTYP_UNDIGGABLE, DRAWBRIDGE_UP, } from './const.js';
import { heroIsPunished, placeBallAndChain, unplaceBallAndChain, beginBallAndChainMove, finishBallAndChainMove, } from './ball.js';
import { bot, displayLiquidName, docrt, feel_newsym, newsym, under_water, updateLastSeenTerrain, feel_location, terrain_glyph, glyphAt, canSpotMonster, canSenseMonster, monsterVisible, unmap_invisible, map_object, unmapObject, } from './display.js';
import { pline, plineWithContinuation, pline_dir, set_msg_xy } from './pline.js';
import { heroPassesWalls, heroFormSticks, heroSpecies, heroLikesLava } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { endVoluntaryMultiTurn, nomul } from './command_state.js';
import { resetHeroTrap, setHeroInWater } from './terrain_movement.js';
import { monstersObserveHeroResistance, heroCanOoze } from './monster_perception.js';
import { clearHeroTrap, setHeroTrap, heroCanMoveFromTrap } from './hero_traps.js';
import { monsterName, shopkeeperName } from './monster_name.js';
import { beginHeroLifeSaving, completeHeroLifeSaving, finishHeroDeath, identifyLifeSavingAmulet, } from './end.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { heroIsUnaware } from './hero_sleep.js';
import { resetHeroFaint } from './hunger.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { loseHeroHp } from './hero_damage.js';
import { igniteItems } from './light.js';
import { destroyFireInventory } from './zap.js';
import { releaseAllMonsterLeashes } from './monster_leash.js';
import { splitHeroMonsterForm } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, MONSTER_ATTACKS, requireMonsterData, monsterIsAmorphous, MONSTER_BODY_META, } from './monster_data.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, LOADSTONE, OBJECT_MATERIAL, PICK_AXE, DWARVISH_MATTOCK, WAN_DIGGING, STATUE, } from './object_data.js';
import { ownedObjectAction, simpleObjectNameWithArticle } from './objnam.js';
import { heroFormClings, heroFormFlags, heroHidesOnCeiling, heroIsFlying, heroHasProtectionFromShapeChangers, heroIsPolymorphed, returnHeroToHumanForm, } from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { destroyLavaInventory, markLavaInventoryForDestruction, waterDamageChain } from './trap.js';
import { objectMaterial } from './object_material.js';
import { dismountHero, steedIsGrounded, moveSteedWithHero, ridingPreventsMovement } from './steed.js';
import { heroCanTeleport, heroControlsTeleport, moveHeroByTeleport, safeTeleportDestination, teleportHeroAtWill, } from './teleport.js';
import { goodPosition, heroTeleportRestricted } from './teleport_rules.js';
import { shopkeeperBlockingDoor, shopkeeperBlockingEntry } from './shop_blocking.js';
import { vision_recalc, vision_reset, couldsee } from './vision.js';
import { inventoryWeight, nearCapacity, SLT_ENCUMBER, UNENCUMBERED, OVERLOADED } from './weight.js';
import { destroyWornArmor, heroHasWaterWalking, heroKnowsLavaWalking, heroKnowsWaterWalking, } from './armor.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { isLavaAt, isPoolAt, levelHasCeiling, levelIsWaterLevel as heroIsOnWaterLevel, isPoolOrLavaAt, } from './terrain_properties.js';
import { propertyIsActive, refreshMovementProperties, setPropertyTimeout } from './properties.js';
import { waterbodyName } from './terrain_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { backOnGroundMessage, iceDescriptionAt } from './dungeon_feature.js';
import { heroCouldMoveOntoBoulder, pushBouldersAt } from './boulder_push.js';
import { ingSuffix } from './hacklib.js';
import { heroLocomotion } from './hero_locomotion.js';
import { resetOccupations } from './occupation_reset.js';
import { petRefusesHeroSwap, settlePetHeroDisplacement } from './hero_pet_displacement.js';
import { airTurbulenceStopsHero, waterTurbulenceStopsHero } from './hero_movement_turbulence.js';
import { maybeAdjustHeroBubble } from './elemental.js';
import { announceRunLiquid, announceRunTrap, knownRunTrap, runLiquidIsDangerous, } from './run_hazards.js';
import { leaveMovementCloud, updateHeroRegions } from './regions.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
import { placeHeroOnLevel } from './hero_location.js';
import { hideHeroUnder } from './monster_hiding.js';
import { attackHostileMonster } from './hero_melee.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { beastChoosesHeroDisplacement, settleBeastHeroDisplacement } from './hero_beast_displacement.js';
import { hasDoorAppearance, stumbleOntoMimic } from './mimic.js';
import { monsterAtPosition } from './monster_location.js';
import { makeMonsterFlee } from './monster_flee.js';
import { confirmHeroStep } from './hero_step_confirmation.js';
import { monsterPassesBars } from './monster_movement_traits.js';
import { continueChewingTerrain, heroCanEnterIronBars } from './iron_bars_meal.js';
import { strikeIronBarsWithWeapon } from './projectile_bars.js';
import { fightSeenWebWithForce } from './hero_web_fight.js';
import { wormCrossesBetween } from './monster_worm.js';
import { dopay } from './shop_pay_command.js';
import { AT_EXPL } from './monster_attack_types.js';
import { confusePromptDirection } from './tty_prompts.js';
import { resolveHeroCombatExplosion } from './hero_combat_explosion.js';
import { artifactById } from './artifacts.js';
import { disturbBuriedZombies } from './object_impact.js';
import { checkSlipperyIce } from './fumbling.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { arriveTravel, captureRunmodeDelay, stopRun } from './runmode.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { roomForRoomno, roomsAt } from './room.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { checkHeroLeashes } from './leash_apply.js';
import { isPick } from './weapon_type.js';
import { applyPickAxeDirection } from './pick_axe.js';
import { diggingTarget } from './hero_digging.js';
import { objectTypeKnown, tendedShop } from './shk.js';
import { maybeSmudgeEngravings } from './engrave.js';
import { announceInvocationSquare } from './invocation.js';
// Door opening and teleport input remain in cmd.ts until their owners move.
import { askTeleportDestination, doopen, xyToDirection } from './cmd.js';
// C hack.c:escape_from_sticky_mon(). True means this attempt was spent
// struggling; release clears the grip directly, without unstuck's cooldown.
export async function escapeFromStickyMonster(x, y) {
    const state = game;
    const holder = state.u.ustuck;
    if (!holder || x === holder.mx && y === holder.my)
        return false;
    if (Math.abs(holder.mx - state.u.ux) > 1 || Math.abs(holder.my - state.u.uy) > 1) {
        setHeroGrip(null, state);
        return false;
    }
    const name = () => monsterName(holder, { state, article: 'your' });
    if (heroFormSticks(state)) {
        setHeroGrip(null, state);
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
    setHeroGrip(null, state);
    await plineWithContinuation(`You pull free from ${name()}.`);
    return false;
}
const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_TUNNEL = 0x00000020;
const M1_NEEDPICK = 0x00000040;
const M1_CONCEAL = 0x80;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const S_EEL = 57;
const S_EYE = 5;
const S_VORTEX = 22;
const S_LIGHT = 25;
const PM_GREMLIN = 40;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_WATER_ELEMENTAL = MONSTER_NAME.indexOf('water elemental');
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
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
        state.context.tips = (state.context.tips ?? 0) | (1 << TIP_SWIM);
        return false;
    }
    return liquidWall
        || !!((state.flags?.paranoia_bits ?? 0) & PARANOID_SWIM);
}
export function heroCanPassWallAt(state, x, y) {
    const location = requireGameLevel(state).at(x, y);
    return !!location && heroPassesWalls(state)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
}
export function doorlessDoor(location) {
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
    // C bad_rock() tests the species, even when the hero has temporary
    // wall passing. test_move() applies that property after direction selection.
    const flags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    const mayDig = !((IS_STWALL(location.typ) || location.typ === TREE)
        && ((location.wall_info ?? 0) & W_NONDIGGABLE));
    const cannotTunnel = !(flags & M1_TUNNEL)
        || !!(flags & M1_NEEDPICK) || !mayDig;
    const canPass = !!(flags & M1_WALLWALK)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
    return cannotTunnel && !canPass;
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
// C hack.c:crawl_destination(): goodpos() first, then diagonal limits.
export async function crawlDestinationAllowed(state, x, y, random, publish) {
    const u = state.u;
    if (!goodPosition(x, y, { kind: 'hero' }, { state, random }))
        return false;
    if (x === u.ux || y === u.uy)
        return true;
    if (u.umonnum === PM_GRID_BUG)
        return false;
    if (heroPassesWalls(state))
        return true;
    const location = state.level.at(x, y);
    if (location?.typ === DOOR) {
        if (!doorlessDoor(location))
            return false;
        const keeper = shopkeeperBlockingDoor(x, y, state);
        if (keeper) {
            await publish(`${shopkeeperName(keeper, { state, capitalized: true })}${propertyIsActive('invisible', state) ? ' senses your motion and' : ''} blocks your way!`);
            return false;
        }
    }
    return !(heroBadRock(state, u.ux, y)
        && heroBadRock(state, x, u.uy)
        && heroTightDiagonalReason(state));
}
async function crawlDestination(state, x, y, random, publish) {
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
        if (await crawlDestinationAllowed(state, candidate.x, candidate.y, random, publish))
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
async function burnLavaBoots(state, publish, protectedObject) {
    const boots = state.uarmf || state.u?.uarmf;
    if (!boots || !(boots.in_use || (!boots.oerodeproof && objectMaterial(boots, state) <= 8)))
        return false;
    await publish(`${ownedObjectAction(boots, 'burst', state)} into flame!`);
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
    if (state !== game)
        return false;
    // C done() forces status with the raw HP before it records the death.
    await bot();
    const lifeSaving = beginHeroLifeSaving();
    if (!lifeSaving)
        return false;
    await publish('But wait...');
    identifyLifeSavingAmulet(random);
    await publish(`Your medallion ${heroIsBlind(state) ? 'feels warm' : 'begins to glow'}!`);
    await publish(formatFeltMessage('much better!', state));
    await publish('The medallion crumbles to dust!');
    await completeHeroLifeSaving(lifeSaving);
    return true;
}
async function finishLiquidDeath(options) {
    // The liquid effect has usually announced the death already. done() still
    // owns life saving and the wizard/explore recovery question.
    return await finishHeroDeath({ ...options, deathLineShown: options.deathLineShown ?? true });
}
async function teleportHeroOutOfLiquid({ state, random, rollOne, publish, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
    const destination = safeTeleportDestination(state, random, rollOne);
    if (!destination)
        return null;
    // C trap.c:6936/7021 call safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT):
    // a light hero may drag an adjacent ball, and the verbose materialize
    // line precedes the landing effects (teleport.c:545-547).
    const { arrival } = await moveHeroByTeleport(destination.x, destination.y, state, {
        allowDrag: true,
        finishArrival: async (movement) => {
            if (state.flags?.verbose !== false) {
                await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                    ? 'the same' : 'a different'} location!`);
            }
            return finishLiquidTeleport(movement, {
                state, repaint, resetVision, recalculateVision, applyLandingEffects,
            });
        },
    });
    return arrival;
}
async function finishLavaLifeSaving({ state, publish, random, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, die, }) {
    for (let attempt = 0; attempt < 2; attempt++) {
        state.u.uhp = -1;
        // C trap.c:6922-6934: water elementals, steam vortices, and fog
        // clouds boil away instead of burning to a crisp.
        const boilsAway = [PM_WATER_ELEMENTAL, PM_STEAM_VORTEX, PM_FOG_CLOUD]
            .includes(heroSpecies(state));
        await publish(`You ${boilsAway ? 'boil away' : 'burn to a crisp'}...`, { urgent: true });
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
            state, random, rollOne, publish, repaint, resetVision,
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
        // C trap.c:6957: rescued_from_terrain(BURNING) precedes the
        // suppressed-pickup landing effects.
        await announceTerrainRescue(BURNING, state, options.publish);
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
    // These deaths come through losehp(), which prints "You die..." itself.
    const finishDamageDeath = async (options) => {
        await die({ ...options, deathLineShown: false });
        return !!state.program_state.gameover;
    };
    const hero = state.u;
    const damage = rollDice(6, 6);
    // C lava_effects() maps the liquid by touch before its first message.
    if (state === game)
        await feel_newsym(hero.ux, hero.uy);
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
            await publish(`The ${displayLiquidName('lava', state)} here burns you!`);
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
            await publish(`You fall into the ${waterbodyName(hero.ux, hero.uy, state)}!`);
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
        setHeroTrap(random(4) + 4 + ((random(4) + 12) << 8), TT_LAVA, state);
        await publish(`You sink into the ${waterbodyName(hero.ux, hero.uy, state)}, but it only burns slightly!`);
        monstersObserveHeroResistance(M_SEEN_FIRE, state);
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
// C trap.c:sink_into_lava().
export async function sinkHeroIntoLava({ state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, repaint = newsym, resetVision = vision_reset, recalculateVision = vision_recalc, applyLandingEffects = async () => { }, die = finishLiquidDeath, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (!hero?.utrap || hero.utraptype !== TT_LAVA)
        return null;
    const location = state.level?.at?.(hero.ux, hero.uy);
    if (!location || !isLavaAt(state.u.ux, state.u.uy, state)) {
        clearHeroTrap(state);
        return { escaped: true };
    }
    if (hero.invulnerable || hero.uinvulnerable)
        return { sank: false, died: false };
    if (!heroResistsFire(state))
        hero.uhp = Math.trunc(((hero.uhp ?? 1) + 2) / 3);
    hero.utrap -= 1 << 8;
    if (hero.utrap < 1 << 8) {
        await publish('You sink below the surface and die.', { urgent: true });
        await burnAwayHeroSlime(state, publish);
        // sink_into_lava() leaves HP intact for done()'s initial status redraw.
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
        await resetHeroTrap(true, state);
        const airborne = hero.levitating || hero.levitation
            || hero.flying;
        if (!airborne) {
            const escape = await teleportHeroOutOfLiquid({
                state, random, rollOne, publish, repaint, resetVision,
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
        // C Norep() compares pline.c's previous individual message, not the
        // joined tty top line.
        if (slimeBurns || state._lastPlineMessage !== message) {
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
    // emergency_disrobe() leaves u.uac to moveloop_core()'s find_ac().
    return { escaped: true, dropped };
}
async function wakeHeroForCrawl(state, publish) {
    if (state.u.usleep)
        await finishHeroHelplessness('Suddenly you wake up!', state, publish);
    if (state.u.uhs === FAINTED)
        await resetHeroFaint({ state });
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
    // spoteffects() announces surfacing before it clears the submerged view.
    const from = { x: movement.oldx, y: movement.oldy };
    const to = { x: movement.x, y: movement.y };
    await repaint(movement.oldx, movement.oldy);
    resetVision();
    await recalculateVision(0);
    const landing = await applyLandingEffects({ from, to });
    return { entered: true, moved: true, died: !!landing?.died, from, to };
}
async function leaveWater({ state, location, publish, }) {
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
            message = `You leave the ${displayLiquidName('water', state)}...`;
        }
        else {
            message = backOnGroundMessage(false, state);
        }
    }
    else if (heroIsOnWaterLevel(state)) {
        stillInWater = true;
    }
    else if (u.levitating || u.levitation) {
        message = `You pop out of the ${displayLiquidName('water', state)} like a cork!`;
    }
    else if (u.flying) {
        message = `You fly out of the ${displayLiquidName('water', state)}.`;
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
    // C Underwater is u.uinwater, still set until set_uinwater(0) below.
    const wasUnderwater = !!(u.uinwater || state.underwater) && !heroIsOnWaterLevel(state);
    await setHeroInWater(false, state);
    state.underwater = false;
    // C restores the surface view by redrawing the screen and deferring the
    // vision recalculation to the next flush.
    if (wasUnderwater) {
        await docrt();
        state.vision_full_recalc = 1;
    }
    return true;
}
// entry 'spot-effects' (C hack.c:spoteffects() -> pooleffects()) is the
// default.  entry 'float-down' (C trap.c:float_down() -> drown()/
// lava_effects()) skips the spoteffects-only stages: leaving water, the
// mounted-steed dismount, and the ceiling-hider check, none of which the
// direct drown()/lava_effects() calls perform. Entries 'drown' and 'lava'
// also skip their terrain-entry guards, including being held by a monster.
// Entry 'turn' is moveloop_core()'s pooleffects(FALSE) for a hero who did
// not move: it leaves a submerged swimmer or breather out of drown().
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
    if (entry === 'lava')
        return heroLavaEffects({
            state, location, publish, random, rollDice, rollOne,
            repaint, resetVision, recalculateVision, applyLandingEffects, die,
        });
    if (entry !== 'drown') {
        const leftWater = fromFloatDown ? false : await leaveWater({ state, location, publish });
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
        if (entry === 'turn' && u.uinwater && heroCanLiveUnderwater(state))
            return null;
    }
    // drown() maps the water by touch before any entry message can page.
    if (state === game)
        await feel_newsym(x, y);
    const waterWall = location.typ === WATER;
    let canLiveUnderwater = heroCanLiveUnderwater(state);
    let stayingInPool = false;
    // drown() uses the retained direction, including zero, after relocation.
    if (u.uinwater && isPoolAt(x - (u.dx ?? 0), y - (u.dy ?? 0), state)
        && canLiveUnderwater) {
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
    await waterDamageChain(state.inventory, [], state, { publish });
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
        // C trap.c:5117-5120: the settling ball and chain are re-placed
        // for the underwater position.
        if (heroIsPunished(state)) {
            await unplaceBallAndChain(state);
            await placeBallAndChain(state);
        }
        await recalculateVision(2);
        await setHeroInWater(true, state);
        // drown() clears the whole map on every dive, even after surfacing
        // has restored land outside the previous underwater viewport.
        if (state === game)
            await under_water(1);
        state.vision_full_recalc = 1;
        return { entered: true, moved: false, died: false };
    }
    // C Luck includes the luckstone bonus (u.uluck + u.moreluck).
    const luck = (u.uluck ?? 0) + (u.moreluck ?? 0);
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
                finishArrival: async (movement) => {
                    if (state.flags.verbose !== false)
                        await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                            ? 'the same' : 'a different'} location!`);
                    return finishLiquidTeleport(movement, {
                        state, repaint, resetVision, recalculateVision, applyLandingEffects,
                    });
                },
            });
            if (teleport.died)
                return { entered: true, moved: teleport.moved, died: true };
            if (!isPoolAt(u.ux, u.uy, state))
                return teleport.arrival ?? { entered: true, moved: teleport.moved, died: false };
        }
    }
    // C drown(): a mounted hero dismounts before crawling; landing on dry
    // ground ends the drowning.
    if (u.usteed) {
        const from = { x: u.ux, y: u.uy };
        const dismount = await dismountHero(DISMOUNT_GENERIC, { state, random, announce: publish });
        if (dismount.died || state.program_state?.gameover)
            return { entered: true, dismounted: dismount.dismounted, moved: u.ux !== from.x || u.uy !== from.y, died: true };
        if (!isPoolAt(u.ux, u.uy, state))
            return {
                entered: true, dismounted: dismount.dismounted,
                moved: u.ux !== from.x || u.uy !== from.y, died: false,
                from, to: { x: u.ux, y: u.uy },
            };
    }
    await wakeHeroForCrawl(state, publish);
    // C drown() reads u.ux/u.uy after any teleport or dismount.
    x = u.ux;
    y = u.uy;
    const canMove = !((state._helplessTurns ?? 0) > 0)
        && (!((u.mtimedone ?? 0) > 0) || (MONSTER_MOVE[u.umonnum] ?? 0) > 0);
    const destination = canMove
        ? await crawlDestination(state, x, y, random, publish) : null;
    if (destination) {
        const escape = heroIsOnWaterLevel(state)
            ? { escaped: true, dropped: false }
            : await emergencyDisrobe(state, random);
        if (escape.died)
            return { entered: true, moved: false, died: true };
        await publish(`You try to crawl out of the ${displayLiquidName('water', state)}.`);
        if (escape.dropped)
            await publish('You dump some of your gear to lose weight...');
        if (escape.escaped) {
            await publish('Pheew!  That was close.');
            // C trap.c:5164 relocates through teleds(TELEDS_ALLOW_DRAG),
            // which resets the trap/hold state and drags the ball and chain
            // along, then runs the full destination effects below.
            const { arrival: landing } = await moveHeroByTeleport(destination.x, destination.y, state, {
                allowDrag: true,
                finishArrival: () => applyLandingEffects({
                    from: { x, y },
                    to: { x: u.ux, y: u.uy },
                }),
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
            // C trap.c:5189 -> safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT)
            // -> teleds(): a light hero may drag an adjacent ball, and the
            // rescue relocation still prints the verbose materialize line
            // (teleport.c:545-547).
            const { arrival: escape } = await moveHeroByTeleport(destination.x, destination.y, state, {
                allowDrag: true,
                finishArrival: async (movement) => {
                    if (state.flags?.verbose !== false) {
                        await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                            ? 'the same' : 'a different'} location!`);
                    }
                    return finishLiquidTeleport(movement, {
                        state, repaint, resetVision, recalculateVision, applyLandingEffects,
                    });
                },
            });
            if (!escape.died) {
                await setHeroInWater(false, state);
                state.underwater = false;
                await announceTerrainRescue(DROWNING, state, publish);
            }
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
        await publish(backOnGroundMessage(true, state));
    }
    if (state === game) {
        // C trap.c:5051-5054: mark the message for describe_decor() and
        // adopt the just-disclosed terrain as the previous decor.
        state._lastPlineKind = PLNMSG_BACK_ON_GROUND;
        updateLastSeenTerrain(ux, uy);
        state._prevDecorType = location.lastseentyp ?? location.typ;
    }
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
// C hack.c:test_move() checks cant_squeeze_thru() for a tight diagonal.
async function rejectTightHeroDiagonal(dx, dy) {
    if (!dx || !dy
        || !heroBadRock(game, game.u.ux, game.u.uy + dy)
        || !heroBadRock(game, game.u.ux + dx, game.u.uy))
        return false;
    const reason = heroTightDiagonalReason(game);
    if (!reason)
        return false;
    if (reason === 1)
        await pline('Your body is too large to fit through.');
    else if (reason === 2)
        await pline('You are carrying too much to get through.');
    else
        await pline('You cannot pass that way.');
    game.context.move = 0;
    return true;
}
// C hack.c:test_move() allows can_ooze() through a closed door.
function heroOozesUnderDoor(destination, g = game) {
    return destination?.typ === DOOR
        && !!(destination.doormask & (D_CLOSED | D_LOCKED))
        && !heroPassesWalls(g) && heroCanOoze(g);
}
// C test_move(DO_MOVE): entry precedes tight shoulders; exit follows them.
async function rejectHeroDiagonalDoorEntry(dx, dy, destination) {
    if (!dx || !dy || heroPassesWalls(game))
        return false;
    const entryDoor = heroOozesUnderDoor(destination) ? null : destination;
    const x = game.u.ux + dx, y = game.u.uy + dy;
    const intactEntry = blocksDiagonalDoor(null, entryDoor);
    const doorKeeper = !intactEntry && entryDoor?.typ === DOOR ? shopkeeperBlockingDoor(x, y) : null;
    const entering = intactEntry || !!doorKeeper;
    if (!entering)
        return false;
    if (doorKeeper) {
        const invisible = propertyIsActive('invisible', game);
        await plineWithContinuation(`${shopkeeperName(doorKeeper, { capitalized: true })}${invisible ? ' senses your motion and' : ''} blocks your way!`);
    }
    if (game.flags.mention_walls || game.u.uinwater || game.underwater) {
        await plineWithContinuation("You can't move diagonally into an intact doorway.");
    }
    game.context.move = 0;
    return true;
}
// C hack.c:test_move() checks the origin doorway after tight diagonals.
async function rejectHeroDiagonalDoorExit(dx, dy) {
    const origin = game.level?.at(game.u.ux, game.u.uy);
    if (!dx || !dy || heroPassesWalls(game) || origin?.typ !== DOOR)
        return false;
    const intact = blocksDiagonalDoor(origin, null);
    const keeper = intact ? null : shopkeeperBlockingEntry(game.u.ux + dx, game.u.uy + dy);
    if (!intact && !keeper)
        return false;
    if (keeper) {
        const invisible = propertyIsActive('invisible', game);
        await plineWithContinuation(`${shopkeeperName(keeper, { capitalized: true })}${invisible ? ' senses your motion and' : ''} blocks your way!`);
    }
    if (game.flags.mention_walls)
        await plineWithContinuation("You can't move diagonally out of an intact doorway.");
    game.context.move = 0;
    return true;
}
// C test_move(TEST_MOVE): tests obstacles without performing auto-open,
// boulder pushing, or the hero's eventual movement.
export function heroTestMove(x, y, g = game) {
    return testHeroMove(g.u.ux, g.u.uy, x, y, 'move', g).passes;
}
// C test_move(TEST_MOVE) from an arbitrary origin square. zap.c bhit()
// checks the chain's next step from a thrown iron ball's previous square.
export function heroMoveBlockedBetween(fromX, fromY, x, y, g = game) {
    return !testHeroMove(fromX, fromY, x, y, 'move', g).passes;
}
// Shop doorway checks print even during a path search, so publish them at
// the awaited boundary while the shared movement decision remains pure.
async function testTravelMove(fromX, fromY, x, y, mode, g) {
    const result = testHeroMove(fromX, fromY, x, y, mode, g);
    if (result.blockedBy) {
        const name = shopkeeperName(result.blockedBy, { state: g, capitalized: true });
        const senses = propertyIsActive('invisible', g) ? ' senses your motion and' : '';
        await plineWithContinuation(`${name}${senses} blocks your way!`);
    }
    return result.passes;
}
// C test_move() shares physical checks across TEST_MOVE, TEST_TRAV and
// TEST_TRAP. Travel admits closed doors and checks consecutive boulders;
// the trap mode reports hazards after checking entry, before checking exit.
function testHeroMove(fromX, fromY, x, y, mode, g) {
    if (!isok(x, y))
        return { passes: false };
    const hero = g.u;
    const location = g.level?.at(x, y);
    if (!location)
        return { passes: false };
    const passesWalls = heroPassesWalls(g);
    const formFlags = MONSTER_FLAGS1[heroSpecies(g)] ?? 0;
    const tunnels = !!(formFlags & M1_TUNNEL) && !(formFlags & M1_NEEDPICK);
    const underwater = !!(hero.uinwater || g.underwater);
    let checkDoorEntry = location.typ === DOOR;
    if (IS_OBSTRUCTED(location.typ) || location.typ === IRONBARS) {
        if (!heroCanPassWallAt(g, x, y)) {
            if (underwater)
                return { passes: false };
            if (location.typ === IRONBARS) {
                if (!passesWalls && !monsterPassesBars({ mnum: heroSpecies(g) }))
                    return { passes: false };
            }
            else if (!tunnels)
                return { passes: false };
        }
    }
    else if (closedTravelDoor(x, y, g)) {
        if (passesWalls || heroCanOoze(g))
            checkDoorEntry = false;
        else {
            if (underwater)
                return { passes: false };
            if (tunnels)
                checkDoorEntry = false;
            else if (mode === 'move')
                return { passes: false };
        }
    }
    const dx = x - fromX, dy = y - fromY;
    if (dx && dy) {
        if (!passesWalls && checkDoorEntry) {
            if (blocksDiagonalDoor(null, location))
                return { passes: false };
            const blockedBy = shopkeeperBlockingDoor(x, y, g);
            if (blockedBy)
                return { passes: false, blockedBy };
        }
        if (heroBadRock(g, fromX, y) && heroBadRock(g, x, fromY)) {
            if (heroTightDiagonalReason(g))
                return { passes: false };
        }
        else if (wormCrossesBetween(fromX, fromY, x, y, g))
            return { passes: false };
    }
    // Reverse searches must be able to return to the hero's square.
    if (g.context.run === 8 && (x !== hero.ux || y !== hero.uy)) {
        if (knownRunTrap(x, y, g))
            return { passes: mode === 'trap' };
        if (location.seenv && isPoolOrLavaAt(x, y, g)) {
            const liquidWall = IS_WATERWALL(location.typ) || location.typ === LAVAWALL;
            const inAir = propertyIsActive('levitation', g) || propertyIsActive('flying', g);
            const canWalk = isPoolAt(x, y, g) ? heroKnowsWaterWalking(g)
                : heroKnowsLavaWalking(g) && isLavaAt(hero.ux, hero.uy, g);
            if (liquidWall || !(inAir || canWalk))
                return { passes: mode === 'trap' };
        }
    }
    if (mode === 'trap')
        return { passes: false };
    const origin = g.level?.at(fromX, fromY);
    if (dx && dy && !passesWalls && origin?.typ === DOOR) {
        if (blocksDiagonalDoor(origin, null))
            return { passes: false };
        const blockedBy = shopkeeperBlockingEntry(x, y, g);
        if (blockedBy)
            return { passes: false, blockedBy };
    }
    if (travelBoulderAt(x, y, g) && (!passesWalls || g.level?.flags.sokoban_rules)) {
        if (mode === 'move') {
            if ((g.context.run ?? 0) >= 2 && !heroIsBlind(g)
                && !heroIsHallucinating(g) && !heroCouldMoveOntoBoulder(x, y, g))
                return { passes: false };
        }
        else {
            if (g.level?.flags.sokoban_rules)
                return { passes: false };
            if (travelBoulderAt(fromX, fromY, g) && !passesWalls
                && !heroCouldMoveOntoBoulder(fromX, fromY, g) && !tunnels
                && !g.inventory.some(object => object.otyp === PICK_AXE
                    || object.otyp === DWARVISH_MATTOCK
                    || object.otyp === WAN_DIGGING && !objectTypeKnown(object, g)))
                return { passes: false };
        }
    }
    return { passes: true };
}
function runDist2(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}
// C refs: hack.c findtravelpath(TRAVP_TRAVEL), test_move(TEST_TRAV).
// NetHack searches backwards from the destination, cardinal directions
// first, and uses the predecessor of the hero as the next travel step.  A
// fresh search is intentional: doors, boulders, traps, and monsters can make
// yesterday's route invalid between automatic turns.
export const TRAVEL_DIRECTIONS = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
];
function closedTravelDoor(x, y, g) {
    const location = g.level?.at(x, y);
    return location?.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED));
}
function travelBoulderAt(x, y, g) {
    return !!g.level?.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
}
function travelCellKnown(x, y, g) {
    const location = g.level?.at(x, y);
    return !!location && (!!location.seenv || !heroIsBlind(g) && couldsee(x, y));
}
// hack.c:findtravelpath() uses DISP_ALL so search markers include unseen
// squares. Crawl mode holds frontiers for three delays and guessed goals
// for five; ending the effect restores the map before movement continues.
async function showTravelSearch(positions, warningLevel, g) {
    if (!g.iflags.trav_debug)
        return;
    const symbol = def_warnsyms[warningLevel];
    if (!symbol)
        throw new Error(`Missing travel warning glyph ${warningLevel}`);
    const effect = new TemporaryMapEffect('all', {
        ch: symbol.ch, color: symbol.color, decgfx: false,
        kind: 'warning', glyph: GlyphOffset.warning + warningLevel,
    });
    await effect.start();
    try {
        for (const [x, y] of positions)
            await effect.show(x, y);
        const pauses = g.flags.runmode === 'crawl' ? (warningLevel === 1 ? 3 : 5) : 1;
        for (let pause = 0; pause < pauses; pause++)
            await g.animationFrame?.();
    }
    finally {
        await effect.end();
    }
}
// C findtravelpath(): each radius preserves cardinal-first frontier order.
// Door, boulder and trap delays apply to each edge before TEST_TRAV, in all
// three search modes. The origin starts unmarked, as in C's zeroed matrix.
async function searchTravelPath(startX, startY, goalX, goalY, mode, g) {
    let frontier = [[startX, startY]];
    const distance = new Map();
    const directions = MONSTER_NAME[heroSpecies(g)] === 'grid bug'
        ? TRAVEL_DIRECTIONS.slice(0, 4) : TRAVEL_DIRECTIONS;
    for (let radius = 1; frontier.length; radius++) {
        const next = [];
        for (const [x, y] of frontier) {
            let repeated = false;
            for (const [dx, dy] of directions) {
                const nx = x + dx, ny = y + dy;
                if (!isok(nx, ny) || mode === 'guess' && !couldsee(nx, ny))
                    continue;
                const delayed = !heroPassesWalls(g) && !heroCanOoze(g) && closedTravelDoor(x, y, g)
                    || travelBoulderAt(x, y, g) && !heroCouldMoveOntoBoulder(x, y, g)
                    || await testTravelMove(x, y, nx, ny, 'trap', g);
                if (delayed && (distance.get(y * COLNO + x) ?? 0) > radius - 3) {
                    if (!repeated)
                        next.push([x, y]);
                    repeated = true;
                    continue;
                }
                if (!await testTravelMove(x, y, nx, ny, 'travel', g)
                    || !travelCellKnown(nx, ny, g))
                    continue;
                if (nx === goalX && ny === goalY) {
                    if (mode !== 'guess')
                        return { distance, direction: { dx: x - goalX, dy: y - goalY } };
                }
                else if (!distance.has(ny * COLNO + nx)) {
                    distance.set(ny * COLNO + nx, radius);
                    next.push([nx, ny]);
                }
            }
        }
        await showTravelSearch(next, 1, g);
        frontier = next;
    }
    return { distance, direction: null };
}
// C is_valid_travelpt() searches forward; live travel searches backward so
// its predecessor gives the next step. Guessing is only for live movement.
export async function isValidTravelTarget(targetX, targetY, g = game) {
    if (g.u.ux === targetX && g.u.uy === targetY)
        return true;
    if (glyphAt(targetX, targetY, g)?.glyph === cmapToGlyph(CmapSymbol.stone)
        && !g.level?.at(targetX, targetY)?.seenv)
        return false;
    if (g.context.travel1 && travelDistance(g.u.ux, g.u.uy, targetX, targetY) === 1) {
        requirePlayingGame(g);
        if (await crawlDestinationAllowed(g, targetX, targetY, rn2, plineWithContinuation)) {
            stopRun(g, false);
            if (await testTravelMove(g.u.ux, g.u.uy, targetX, targetY, 'move', g))
                return true;
        }
    }
    const { direction } = await searchTravelPath(g.u.ux, g.u.uy, targetX, targetY, 'valid', g);
    if (direction) {
        g.u.dx = direction.dx;
        g.u.dy = direction.dy;
        if (g._runState?.mode === 8) {
            g._runState.visited ??= new Set();
            g._runState.visited.add(g.u.uy * COLNO + g.u.ux);
        }
    }
    return direction !== null;
}
function travelDistance(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
function travelDistanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}
// C TRAVP_GUESS limits the forward search to couldsee() squares, then scans
// x-major. Ties require both a shorter search radius and smaller dist2().
async function findGuessedTravelDirection(targetX, targetY, g) {
    const originX = g.u.ux, originY = g.u.uy;
    const { distance } = await searchTravelPath(originX, originY, targetX, targetY, 'guess', g);
    let pickX = originX, pickY = originY;
    let bestDistance = travelDistance(targetX, targetY, originX, originY);
    let bestSquared = travelDistanceSquared(targetX, targetY, originX, originY);
    let bestPath = COLNO * ROWNO;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const path = distance.get(y * COLNO + x);
            if (!path || !couldsee(x, y))
                continue;
            const candidateDistance = travelDistance(targetX, targetY, x, y);
            const candidateSquared = travelDistanceSquared(targetX, targetY, x, y);
            if (candidateDistance < bestDistance
                || candidateDistance === bestDistance && path < bestPath && candidateSquared < bestSquared) {
                pickX = x;
                pickY = y;
                bestDistance = candidateDistance;
                bestSquared = candidateSquared;
                bestPath = path;
            }
        }
    }
    if (pickX !== originX || pickY !== originY) {
        await showTravelSearch([[pickX, pickY]], 2, g);
        const { direction } = await searchTravelPath(pickX, pickY, originX, originY, 'travel', g);
        return direction ? { ...direction, checkVisited: true } : null;
    }
    // With no better visible goal, C tests the general direction using
    // TEST_MOVE: an unseen square may be discovered by ordinary movement.
    const dx = Math.sign(targetX - originX), dy = Math.sign(targetY - originY);
    return await testTravelMove(originX, originY, originX + dx, originY + dy, 'move', g)
        ? { dx, dy, checkVisited: false } : null;
}
// C hack.c:findtravelpath() searches backward, then tries TRAVP_GUESS.
export async function findTravelDirection(state = game._runState, g = game) {
    if (!state || state.mode !== 8 || !g.level)
        return null;
    const { targetX, targetY } = state;
    const atTarget = g.u.ux === targetX && g.u.uy === targetY;
    const direct = atTarget ? null
        : (await searchTravelPath(targetX, targetY, g.u.ux, g.u.uy, 'travel', g)).direction;
    const direction = atTarget ? null : direct ? { ...direct, checkVisited: true }
        : await findGuessedTravelDirection(targetX, targetY, g);
    g.u.dx = direction?.dx ?? 0;
    g.u.dy = direction?.dy ?? 0;
    return direction;
}
// C hack.c:findtravelpath() updates repetition before the rest of
// domove_core(), even when it leaves a zero direction after a failed guess.
async function selectTravelStep(state) {
    requirePlayingGame(game);
    const { targetX, targetY } = state;
    const hero = game.u;
    if (game.context.travel1
        && travelDistance(hero.ux, hero.uy, targetX, targetY) === 1
        && await crawlDestinationAllowed(game, targetX, targetY, rn2, plineWithContinuation)) {
        stopRun(game, false);
        if (await testTravelMove(hero.ux, hero.uy, targetX, targetY, 'move', game)) {
            nomul(0);
            game._travelTarget = null;
            return { dx: targetX - hero.ux, dy: targetY - hero.uy };
        }
        game.context.run = 8;
    }
    const direction = await findTravelDirection(state);
    if (!direction) {
        nomul(0);
        return { dx: 0, dy: 0 };
    }
    const visited = state.visited ?? new Set();
    const nextX = hero.ux + direction.dx, nextY = hero.uy + direction.dy;
    // C's general-direction fallback records the origin without testing
    // history. Only a completed backward search checks the chosen next step.
    const returning = direction.checkVisited && visited.has(nextY * COLNO + nextX);
    if (returning || direction.checkVisited && nextX === targetX && nextY === targetY) {
        nomul(0);
        // Keep the running checks for a final path step, unlike the
        // adjacent first-step shortcut above.
        game.context.run = 8;
        if (returning)
            await plineWithContinuation('You stop, unsure which way to go.');
        else
            game._travelTarget = null;
    }
    else {
        visited.add(hero.uy * COLNO + hero.ux);
        state.visited = visited;
    }
    return direction;
}
// C hack.c:lookaround() for travel (context.run == 8): moveloop runs it
// before every automatic travel step.  Travel stops for a grid-bug
// diagonal, a visible monster that is not peaceful-safe, a known trap
// directly ahead of the previous step's direction, or liquid ahead that
// the hero cannot safely cross.  Doors, objects, stairs, and the corridor
// turning of run modes do not stop travel.
async function travelLookaroundStops(g = game) {
    const u = g.u;
    const noDiagonal = MONSTER_NAME[u.umonnum ?? -1] === 'grid bug';
    if (noDiagonal && u.dx && u.dy) {
        await plineWithContinuation('You cannot move diagonally.');
        return true;
    }
    const level = g.level;
    if (heroIsBlind(g) || !g.context.run || !level)
        return false;
    const confused = (u.confusionTurns ?? 0) > 0;
    const stunned = !!(u.stunned || (u.stunnedTurns ?? 0) > 0);
    const hallucinating = heroIsHallucinating(g);
    const frontX = u.ux + (u.dx ?? 0), frontY = u.uy + (u.dy ?? 0);
    // lookaround() checks each square's monster and terrain before moving
    // to the next square, with columns outside rows.
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y) || (x === u.ux && y === u.uy))
                continue;
            if (noDiagonal && x !== u.ux && y !== u.uy)
                continue;
            const monster = monsterAtPosition(level, x, y, g);
            // display.h:_is_safemon(): safe_dog protects a peaceful monster
            // the hero can spot, only while unconfused, unstunned, and sane.
            const safeMonster = monster && (g.flags.safe_dog ?? true)
                && monster.mpeaceful && canSpotMonster(monster)
                && !confused && !hallucinating && !stunned;
            if (monster && M_AP_TYPE(monster) !== M_AP_FURNITURE
                && M_AP_TYPE(monster) !== M_AP_OBJECT
                && monsterVisible(monster, g) && !safeMonster) {
                if (g.flags.mention_walls) {
                    // C lookaround() reports the blocking monster via pline_xy().
                    set_msg_xy(x, y);
                    await plineWithContinuation(`${monsterName(monster, { state: g, article: 'a', capitalized: true })} blocks your path.`);
                }
                return true;
            }
            const location = level.at(x, y);
            if (!location || location.typ === STONE)
                continue;
            if (x === u.ux - (u.dx ?? 0) && y === u.uy - (u.dy ?? 0))
                continue;
            if (x !== frontX || y !== frontY)
                continue;
            const trap = knownRunTrap(x, y, g);
            if (trap) {
                await announceRunTrap(trap, g);
                return true;
            }
            if (runLiquidIsDangerous(x, y, g)) {
                await announceRunLiquid(x, y, g);
                return true;
            }
        }
    }
    return false;
}
// C hack.c:lookaround(). Count nearby corridor choices before deciding
// whether to turn, and stop for visible actors, known traps, or liquid edges.
export async function lookaroundRun(state = game._runState, g = game) {
    if (!state || state.mode === 8 || !g.u || !g.level)
        return false;
    const noDiagonal = MONSTER_NAME[g.u.umonnum ?? -1] === 'grid bug';
    if (noDiagonal && state.dx && state.dy) {
        await plineWithContinuation('You cannot move diagonally.');
        return false;
    }
    if (heroIsBlind(g))
        return true;
    // C lookaround() reads svc.context.run live at every repeated step;
    // a counted walk keeps whatever value an earlier rush or travel left
    // behind, so the checks cannot key off this repeat's own mode.
    const run = g.context.run ?? 0;
    if (run === 0)
        return true;
    const u = g.u;
    let corrct = 0;
    let noturn = false;
    let x0 = 0, y0 = 0, m0 = 1, i0 = 9;
    const targetX = u.ux + state.dx;
    const targetY = u.uy + state.dy;
    const currentTyp = g.level.at(u.ux, u.uy)?.typ;
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO
                || (x === u.ux && y === u.uy))
                continue;
            if (noDiagonal && x !== u.ux && y !== u.uy)
                continue;
            const infront = x === targetX && y === targetY;
            const monster = monsterAtPosition(g.level, x, y, g);
            // hack.c:lookaround() considers an actor interesting only inside
            // its mon_visible() branch.  An invisible monster directly in
            // front must reach domove()/attack_checks(), which remembers the
            // unseen occupant instead of silently ending the run.
            const visibleMonster = monster && M_AP_TYPE(monster) !== M_AP_FURNITURE
                && M_AP_TYPE(monster) !== M_AP_OBJECT
                && monsterVisible(monster, g);
            const safeMonster = monster && (g.flags.safe_dog ?? true)
                && monster.mpeaceful && canSpotMonster(monster) && !g.context.forcefight
                && !(u.confusionTurns ?? 0) && !u.stunned && !(u.stunnedTurns ?? 0)
                && !heroIsHallucinating(g);
            const visibleHostile = visibleMonster && !safeMonster;
            if (visibleMonster && (infront
                || (run !== 1 && visibleHostile))) {
                if (g.flags.mention_walls) {
                    // C lookaround() reports the blocking monster via pline_xy().
                    set_msg_xy(x, y);
                    await plineWithContinuation(`${monsterName(monster, { state: g, article: 'a', capitalized: true })} blocks your path.`);
                }
                return false;
            }
            const loc = g.level.at(x, y);
            if (!loc)
                continue;
            const typ = loc.typ;
            if (typ === STONE)
                continue;
            if (x === u.ux - state.dx && y === u.uy - state.dy)
                continue;
            let corridorLike = false;
            const trap = knownRunTrap(x, y, g);
            if (trap && run !== 1 && infront) {
                await announceRunTrap(trap, g);
                return false;
            }
            if (trap && run === 1) {
                corridorLike = true;
            }
            else if (IS_OBSTRUCTED(typ) || typ === ROOM || IS_AIR(typ)
                || typ === ICE) {
                continue;
            }
            else if (typ === DOOR || hasDoorAppearance(monster)) {
                const closed = hasDoorAppearance(monster) || !!(loc.doormask & (D_CLOSED | D_LOCKED));
                if (closed) {
                    if (x !== u.ux && y !== u.uy)
                        continue;
                    if (run !== 1) {
                        if (g.flags.mention_walls) {
                            // C lookaround() marks the door square via set_msg_xy().
                            set_msg_xy(x, y);
                            await plineWithContinuation('You stop in front of the door.');
                        }
                        return false;
                    }
                    corridorLike = true;
                }
                else if (run === 1) {
                    corridorLike = true;
                }
                else if (run === 8) {
                    continue;
                }
                else if (monster) {
                    continue;
                }
                else if ((x === u.ux - state.dx
                    && y !== u.uy + state.dy)
                    || (y === u.uy - state.dy
                        && x !== u.ux + state.dx)) {
                    continue;
                }
                else {
                    // hack.c:lookaround() treats an open/doorless doorway as
                    // interesting to run/rush modes 2 and 3.  Mode 1 alone
                    // folds it into corridor turning.
                    return false;
                }
            }
            else if (typ === CORR) {
                corridorLike = true;
            }
            else if (isPoolOrLavaAt(x, y, g)) {
                if (infront && runLiquidIsDangerous(x, y, g)) {
                    await announceRunLiquid(x, y, g);
                    return false;
                }
                continue;
            }
            else {
                if (run === 1) {
                    // For run mode 1, stairs, furniture, and other non-room
                    // locations participate in corridor routing (the C
                    // bcorr branch) instead of being interesting stop points.
                    corridorLike = true;
                }
                else if (run === 8) {
                    // hack.c:4012: a leftover travel value rides a counted
                    // walk without travel set, so objects and stairs ahead
                    // are not stop points for it.
                    continue;
                }
                else if (monster) {
                    continue;
                }
                else if ((x === u.ux - state.dx
                    && y !== u.uy + state.dy)
                    || (y === u.uy - state.dy
                        && x !== u.ux + state.dx)) {
                    continue;
                }
                else {
                    return false;
                }
            }
            if (!corridorLike || currentTyp === ROOM)
                continue;
            if (run === 1 || run === 3 || run === 8) {
                const distance = runDist2(x, y, targetX, targetY);
                if (distance > 2)
                    continue;
                if (corrct === 1 && runDist2(x, y, x0, y0) !== 1)
                    noturn = true;
                if (distance < i0) {
                    i0 = distance;
                    x0 = x;
                    y0 = y;
                    m0 = monster ? 1 : 0;
                }
            }
            corrct++;
        }
    }
    if (corrct > 1 && run === 2) {
        if (g.flags.mention_walls)
            await plineWithContinuation('The corridor widens here.');
        return false;
    }
    if ((run === 1 || run === 3 || run === 8) && !noturn && !m0 && i0
        && (corrct === 1 || (corrct === 2 && i0 === 1))) {
        let turn;
        if (i0 === 2) {
            turn = state.dx === y0 - u.uy && state.dy === u.ux - x0
                ? 2 : -2;
        }
        else if (state.dx && state.dy) {
            turn = ((state.dx === state.dy && y0 === u.uy)
                || (state.dx !== state.dy && y0 !== u.uy)) ? -1 : 1;
        }
        else {
            turn = ((x0 - u.ux === y0 - u.uy && !state.dy)
                || (x0 - u.ux !== y0 - u.uy && state.dy)) ? 1 : -1;
        }
        turn += g.lastStrTurn ?? 0;
        if (turn >= -2 && turn <= 2) {
            g.lastStrTurn = turn;
            state.dx = x0 - u.ux;
            state.dy = y0 - u.uy;
            u.dx = state.dx;
            u.dy = state.dy;
        }
    }
    return true;
}
// C allmain.c:moveloop_core() repeats hack.c:lookaround() and domove().
export async function continueRun(g = game) {
    const state = g._runState;
    if (state?.mode === 8) {
        if (await travelLookaroundStops(g)) {
            stopRun(g);
            g.context.move = 0;
            return { attemptedMove: false, tookTime: false };
        }
        await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
        if (g.multi < COLNO && --g.multi === 0)
            stopRun(g);
        const outcome = await domove(g.u.dx ?? 0, g.u.dy ?? 0, false);
        const moved = outcome === 'time';
        if (g.program_state.gameover)
            return { attemptedMove: true, tookTime: false };
        // C domove_core() skips runmode_delay_output() on early returns,
        // including attacks, blocked steps and the final travel pet bump.
        // A refused pet swap reaches the tail after restoring the hero.
        const reachedTail = !!g._domoveReachedTail;
        if (moved && reachedTail)
            await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
        g.context.move = moved ? 1 : 0;
        const arrived = g.u.ux === state.targetX && g.u.uy === state.targetY;
        if (arrived)
            g._travelTarget = null;
        if (!moved && outcome !== 'opened-door')
            stopRun(g);
        // Only findtravelpath()'s own nomul(0)-then-run=8 paths (the
        // adjacent shortcut and the backward-search arrival) keep C's
        // lingering run at 8.  A step that entered the target without
        // one of those -- the general-direction fallback, whose C twin
        // (hack.c:1481-1488) skips nomul(0) -- ends on the next pass at
        // found: (hack.c:1518-1522), where nomul(0) leaves run 0 with
        // the time repaint pending.
        else if (arrived && !g._runState)
            arriveTravel(g);
        else if (arrived)
            stopRun(g);
        // Pathfinding can end travel without entering the target. Keep
        // C's restored run value and let screen flushes own time updates.
        else if (!g._runState && g.context.run === 8)
            arriveTravel(g);
        return { attemptedMove: true, tookTime: moved };
    }
    if (!state || !await lookaroundRun(state, g)) {
        stopRun(g);
        g.context.move = 0;
        return { attemptedMove: false, tookTime: false };
    }
    await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
    if (g.multi < COLNO && --g.multi === 0)
        stopRun(g);
    const outcome = await domove(state.dx, state.dy, false);
    const moved = outcome === 'time';
    if (g.program_state.gameover)
        return { attemptedMove: true, tookTime: false };
    if (moved && g._domoveReachedTail)
        await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
    g.context.move = moved ? 1 : 0;
    if (!moved && outcome !== 'opened-door')
        stopRun(g);
    return { attemptedMove: true, tookTime: moved };
}
// C ref: hack.c:domove_fight_empty(). Forced attacks at the map edge and
// ordinary moves into remembered invisible-monster knowledge converge here.
// Both spend the action without entering terrain movement; only the
// remembered-invisible path is excluded by nopick.
async function fightEmptyDestination(x, y) {
    requirePlayingGame(game);
    const offEdge = !isok(x, y);
    const loc = offEdge ? null : game.level.requireAt(x, y);
    const glyph = offEdge ? null : glyphAt(x, y);
    const forcefight = !!game.context.forcefight;
    const rememberedInvisible = glyph?.kind === 'invisible';
    if (!forcefight
        && (!rememberedInvisible || monsterAtPosition(game.level, x, y)
            || game.context.nopick))
        return false;
    // domove_fight_empty() is still the hero's attack attempt even when no
    // live monster occupies the destination.  The following monster phase
    // observes that command ownership at fatal tty/status boundaries.
    game._heroMeleeThisCommand = true;
    const explosion = heroIsPolymorphed(game)
        ? requireMonsterData(MONSTER_ATTACKS, heroSpecies(game)).find(([type]) => type === AT_EXPL)
        : undefined;
    const surface = loc?.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(loc.drawbridgemask ?? 0) : loc?.typ;
    const closedDoor = loc?.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED));
    const solid = !loc || surface === undefined || !ACCESSIBLE(surface)
        || closedDoor || IS_FURNITURE(loc.typ);
    const underwater = !!(game.underwater || game.u.uinwater);
    let obstacle;
    let target = 'an unknown obstacle';
    if (loc) {
        if (!underwater) {
            const objects = game.level.objects[x]?.[y] ?? [];
            obstacle = objects.find(object => object.otyp === BOULDER);
            if ((glyph?.kind === 'object' && glyph.statueGlyph)
                || (heroIsHallucinating(game) && glyph?.kind === 'monster'))
                obstacle = objects.find(object => object.otyp === STATUE);
            const weapon = game.uwep || game.u.uwep;
            if (forcefight && weapon && diggingTarget(weapon, x, y, game) !== DIGTYP_UNDIGGABLE
                && !rememberedInvisible && glyph?.kind !== 'monster') {
                game.u.dz = 0;
                await applyPickAxeDirection(weapon, {
                    state: game,
                    attackMonster: monster => attackHostileMonster(monster, monster.mx, monster.my),
                    payShopkeeper: dopay,
                });
                return true;
            }
        }
        await unmapObject(x, y);
        if (obstacle)
            await map_object(obstacle, true);
        await newsym(x, y);
        if (obstacle) {
            target = simpleObjectNameWithArticle(obstacle, game);
        }
        else if (underwater && !isPoolAt(x, y, game)) {
            target = Is_waterlevel(game.u.uz) && loc.typ === AIR ? 'an air bubble' : 'nothing';
        }
        else if (solid) {
            if (loc.seenv || IS_STWALL(loc.typ) || loc.typ === SDOOR || loc.typ === SCORR)
                target = `the ${terrain_glyph(loc, x, y).terrainName}`;
        }
        else {
            target = 'thin air';
        }
    }
    const manner = obstacle || solid ? explosion ? 'futilely ' : 'harmlessly ' : '';
    await pline(`You ${manner}${explosion ? 'explode at' : 'attack'} ${target}.`);
    endVoluntaryMultiTurn(game);
    if (explosion) {
        await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, 49, game);
        if ((await resolveHeroCombatExplosion(null, explosion, { state: game })).heroDied)
            return true;
        game.u.mh = -1;
        await returnHeroToHumanForm(game);
    }
    return true;
}
// C hack.c:pooleffects() and trap.c:drown() use the shared destination input
// and spoteffects() entry after an escape from liquid.
export function applyHeroLiquidEffects(publish = plineWithContinuation, { entry = 'spot-effects' } = {}) {
    return heroLiquidEffects({
        publish, entry,
        chooseTeleportDestination: askTeleportDestination,
        applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y,
            newx: to.x, newy: to.y,
            publish, pick,
        }),
    });
}
// C hack.c:spoteffects(TRUE) also applies when expulsion or a body change leaves
// the hero on the same square. It does not count as a movement attempt.
export async function applyHeroLocationEffects(publish = plineWithContinuation, { pick = true } = {}) {
    const { ux: x, uy: y } = game.u;
    return finishDestinationSpotEffects({
        oldx: x, oldy: y, newx: x, newy: y,
        publish, pick,
    });
}
// C hack.c:domove_core() common tail, including a refused pet swap.
// Repositioning and concealment finish before vision and arrival effects.
async function finishHeroMovement({ oldx, oldy, loc, ballChainMove = null, }) {
    const u = game.u;
    // This tail is domove_core()'s epilogue; reaching it (rather than one
    // of the early returns) keeps runmode_delay_output() and the pending
    // time repaint, even when a refused pet swap restored the hero.
    game._domoveReachedTail = true;
    await placeHeroOnLevel(u.ux, u.uy);
    resetOccupations();
    // hack.c:domove_core() ends only a real run upon entering a doorway,
    // obstruction, or furniture square, and never a travel run
    // (context.run == 8).  findtravelpath() restores run to 8 for the
    // arrival step after nomul(0) cleared _runState, so the lingering
    // value — not _runState — is what the native check reads.
    // Applies even when actor displacement, rather than the plain terrain
    // branch, performed the coordinate move.
    const runMode = game.context.run ?? 0;
    if (runMode > 0 && runMode < 8
        && (loc?.typ === DOOR || IS_OBSTRUCTED(loc?.typ ?? STONE)
            || IS_FURNITURE(loc?.typ ?? STONE)))
        nomul(0);
    if (!propertyIsActive('levitation', game) && !propertyIsActive('flying', game)
        && !propertyIsActive('stealth', game)
        && (MONSTER_BODY_META[heroSpecies(game)]?.[0] ?? 0) >= 400)
        disturbBuriedZombies(u.ux, u.uy);
    const species = heroSpecies(game);
    if (((MONSTER_FLAGS1[species] ?? 0) & M1_CONCEAL)
        || MONSTER_SYMBOL[species] === S_EEL || u.dx || u.dy)
        await hideHeroUnder();
    if ((u.dx || u.dy) && (u.m_ap_type === M_AP_OBJECT || u.m_ap_type === M_AP_FURNITURE))
        u.m_ap_type = M_AP_NOTHING;
    await checkHeroLeashes(oldx, oldy);
    if (game.program_state.gameover)
        return true;
    game._domoveSucceeded = oldx !== u.ux || oldy !== u.uy;
    u.umoved = game._domoveSucceeded;
    if (u.umoved) {
        await newsym(oldx, oldy);
        await vision_recalc(1);
        await announceInvocationSquare();
    }
    if (ballChainMove)
        await finishBallAndChainMove(ballChainMove);
    if (u.umoved) {
        const finished = await finishDestinationSpotEffects({
            oldx, oldy, newx: u.ux, newy: u.uy,
        });
        if (finished.died)
            return true;
    }
    // C domove_core(): landing and pickup finish before nomul(-2).
    // A longer trap-induced delay survives, but its completion prose changes.
    if (ballChainMove?.causeDelay)
        await delayAfterDraggingBall();
    return true;
}
// C domove_core() applies the dragging delay even when a pet refuses the swap.
async function delayAfterDraggingBall() {
    nomul(-2);
    game._helplessReason = 'dragging an iron ball';
    game._helplessDoneMessage = '';
    await captureRunmodeDelay(game, true, game.moves || 0, { preservePhysicalTopline: true });
}
export async function domove(dx, dy, explicitAttempt = true) {
    const oldx = game.u.ux, oldy = game.u.uy;
    game._domoveSucceeded = false;
    game._domoveReachedTail = false;
    const moved = await domoveCore(dx, dy);
    if (!game.program_state.gameover) {
        if (explicitAttempt && game._domoveSucceeded) {
            maybeSmudgeEngravings(oldx, oldy, game.u.ux, game.u.uy);
            maybeAdjustHeroBubble();
        }
        game._kickedLoc = null;
        game._movementAttempt = null;
    }
    return moved === 'opened-door' ? moved : moved ? 'time' : 'stopped';
}
// C hack.c:move_out_of_bounds(). A failed step takes no time; a forced
// attack still spends the action against an unknown obstacle.
async function moveOutOfBounds(x, y) {
    if (game.context.forcefight)
        return fightEmptyDestination(x, y);
    if (game.flags.mention_walls) {
        let { dx = 0, dy = 0 } = game.u;
        if (dx && dy) {
            // Keep both directions only when both coordinates hit a limit.
            if (isok(x, game.u.uy))
                dx = 0;
            else if (isok(game.u.ux, y))
                dy = 0;
        }
        const horizontal = dx < 0 ? 'west' : dx > 0 ? 'east' : '';
        const vertical = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
        await pline(`You have already gone as far ${vertical}${horizontal} as possible.`);
    }
    stopRun(game);
    game.context.move = 0;
    return false;
}
// C hack.c:domove_bump_mon(). The m-prefix spends the step before the
// destination monster can choose displacement or receive an attack.
async function bumpIntoMonster(monster, x, y) {
    if (!game.context.nopick || game.context.travel)
        return false;
    const glyph = glyphAt(x, y);
    if (!canSpotMonster(monster)
        && glyph?.kind !== 'invisible' && glyph?.kind !== 'warning')
        return false;
    if (M_AP_TYPE(monster)
        && !(game.u.protectionFromShapeChangers || game.protectionFromShapeChangers)
        && !canSenseMonster(monster)) {
        await stumbleOntoMimic(monster);
    }
    else if (monster.mpeaceful && !heroIsHallucinating(game)) {
        await plineWithContinuation(`Pardon me, ${monsterName(monster, { article: 'none', exact: true })}.`);
    }
    else {
        await plineWithContinuation(`You move right into ${monsterName(monster)}.`);
    }
    return true;
}
// C hack.c:u_rooted(). An immobile form may attack but cannot take a step.
async function rootedHeroCannotMove() {
    if (MONSTER_MOVE[heroSpecies(game)] !== 0)
        return false;
    const inPlace = game.u.levitating || Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz);
    await plineWithContinuation(`You are rooted ${inPlace ? 'in place' : 'to the ground'}.`);
    endVoluntaryMultiTurn(game);
    return true;
}
// C display.h:_is_safemon(). Recheck after movement effects, which can
// change the monster or the hero's ability to recognize it.
export function heroMayDisplaceMonster(monster) {
    const u = game.u;
    return (game.flags.safe_dog ?? true) && !!monster.mpeaceful
        && canSpotMonster(monster) && !(u.confusionTurns ?? 0)
        && !heroIsHallucinating(game) && !u.stunned && !(u.stunnedTurns ?? 0);
}
// C domove_core(): a failed test_move() or swim_move_danger() cancels the
// move and calls nomul(0), which also requests a full status update.
function rejectHeroMove() {
    game.context.move = 0;
    nomul(0, game);
    return false;
}
export async function runSafepetDisplacement(monster) {
    // C uhitm.c:do_attack(): a tame monster normally yields to
    // the hero, and ordinary peacefuls share the same displacement path.
    // Only tame actors flee after refusal.
    const tame = !!(monster.pet || monster.mtame);
    const blocked = heroIsPunished() || rn2(7) === 0
        || (!!monster.wormno && ['baby long worm', 'long worm', 'long worm tail']
            .includes(MONSTER_NAME[monster.mnum] ?? ''))
        || (IS_OBSTRUCTED(requireGameLevel(game).requireAt(game.u.ux, game.u.uy).typ)
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x00000008));
    const inShop = !blocked && roomsAt(game.level, monster.mx, monster.my, SHOPBASE)
        .some(roomno => tendedShop(roomForRoomno(game.level, roomno), game));
    if ((blocked || inShop) && monster.isshk
        && !game.context.travel && !game.context.run) {
        await dopay();
        return 'paid';
    }
    if ((blocked || inShop) && tame) {
        const flight = await makeMonsterFlee(monster, {
            turns: rnd(6), announce: false,
        });
        if (flight.heroDied)
            return 'stopped';
    }
    if (blocked || inShop) {
        // C uhitm.c do_attack(): y_monnam(), capitalized.
        const displayName = monsterName(monster, {
            state: game, article: 'your', capitalized: true,
        });
        await plineWithContinuation(`You stop.  ${displayName} is in the way!`);
        stopRun(game);
        return 'stopped';
    }
    if (monster.mfrozen || monster.msleeping || !monster.mcanmove
        || ((MONSTER_MOVE[monster.mnum] ?? 0) === 0 && rn2(6))) {
        await plineWithContinuation(`${monsterName(monster, { state: game, capitalized: true })} doesn't seem to move!`);
        stopRun(game);
        return 'frozen';
    }
    return 'evaded';
}
// C hack.c:domove_core() owns the movement transaction.
async function domoveCore(dx, dy) {
    requirePlayingGame(game);
    const u = game.u;
    // C cmd.c:set_move_cmd() persists the requested command vector before
    // domove_core() can return early.  Death cleanup and several combat paths
    // deliberately reuse this global direction after the movement attempt.
    u.dx = dx;
    u.dy = dy;
    const travel = game._runState;
    if (game.context.travel && travel?.mode === 8) {
        const direction = await selectTravelStep(travel);
        dx = u.dx = direction.dx;
        dy = u.dy = direction.dy;
        game.context.travel1 = false;
    }
    // C hack.c:domove_core() calls carrying_too_much() before swallowed,
    // turbulence, impairment, destination, actor, or display handling.
    const capacity = nearCapacity(game);
    const polymorphed = heroIsPolymorphed(game);
    const activeHp = polymorphed ? (u?.mh ?? 0) : (u?.uhp ?? 0);
    const activeHpMax = polymorphed ? (u?.mhmax ?? 0) : (u?.uhpmax ?? 0);
    const lacksStamina = capacity > SLT_ENCUMBER
        && activeHp < (polymorphed ? 5 : 10)
        && activeHp !== activeHpMax;
    if (!Is_airlevel(u?.uz)
        && (capacity >= OVERLOADED || lacksStamina)) {
        if (capacity >= OVERLOADED) {
            await pline('You collapse under your load.');
        }
        else {
            await pline("You don't have enough stamina to move.");
            // exercise() suppresses physical attributes while polymorphed.
            if (!polymorphed)
                await exerciseAttribute(A_CON, false);
        }
        // nomul(0) requests a full status update even without an active run.
        endVoluntaryMultiTurn(game);
        // carrying_too_much() returns from domove_core() without clearing
        // context.move, so the failed step still spends the hero action.
        return true;
    }
    // C domove_core(): every direction attacks u.ustuck while swallowed.  It
    // zeroes the requested vector and follows the normal hero-melee owner at
    // the swallower's shared square; terrain and impaired movement are not
    // consulted.
    let swallowerYielded = false;
    if (u?.uswallow && u.ustuck && !u.ustuck.dead) {
        const monster = u.ustuck;
        // C domove_core() zeroes the vector before attacking the swallower.
        u.dx = u.dy = 0;
        dx = dy = 0;
        u.ux0 = u.ux;
        u.uy0 = u.uy;
        u.ux = monster.mx;
        u.uy = monster.my;
        // hack.c:domove_core() runs its shared target-monster block for the
        // swallower as well: a target that is not safe to displace cancels
        // running and count-prefixed repeats with nomul(0) before the
        // m-prefix bump or do_attack(), so a swallowed attack never becomes
        // an automatic multi-step sequence.
        if (game.context.forcefight || !heroMayDisplaceMonster(monster))
            nomul(0, game);
        if (await bumpIntoMonster(monster, monster.mx, monster.my))
            return true;
        const safeMonster = !game.context.forcefight && heroMayDisplaceMonster(monster);
        if (safeMonster && artifactById(game.uwep?.oartifact, game)?.name !== 'Stormbringer') {
            // do_attack() returning FALSE (the swallower yields) continues
            // domove_core() into its ordinary move checks with the zeroed
            // vector.  The destination re-lookup below then finds the
            // co-located swallower and offers the pet swap, exactly like
            // hack.c's second m_at() and domove_swap_with_pet().
            if (await runSafepetDisplacement(monster) !== 'evaded')
                return true;
            swallowerYielded = true;
        }
        else {
            // domove_attackmon_at(): do_attack() runs the attack_checks()
            // reveal sequence for the swallower exactly as for any target.
            const verdict = await prepareAppliedWeaponAttack(monster, game.uwep ?? null, { state: game, struckAt: { x: monster.mx, y: monster.my } });
            if (!verdict.proceed)
                return verdict.spentTime;
            await attackHostileMonster(monster, monster.mx, monster.my, {
                confirmationOverridden: verdict.confirmationOverridden ?? false,
            });
            return true;
        }
    }
    const confused = (u?.confusionTurns || 0) > 0;
    const stunned = !!(u?.stunned || (u?.stunnedTurns || 0) > 0);
    let newx;
    let newy;
    if (swallowerYielded) {
        // C's swallowed branch owns its own prologue (hack.c:2733-2760):
        // air_turbulence(), slippery_ice_fumbling(), impaired_movement(),
        // water_turbulence(), the bounds/trap checks and
        // escape_from_sticky_mon() all live in the non-swallowed else
        // branch, so the yielded hero goes straight to the shared
        // fight/test_move tail on the swallower's square.
        newx = u.ux;
        newy = u.uy;
    }
    else {
        if (await airTurbulenceStopsHero())
            return true;
        checkSlipperyIce();
        // C hack.c:impaired_movement() always checks Confusion before deriving
        // the destination.  A nonzero rn2(5) keeps the requested direction; on
        // impairment, confdir(TRUE) chooses cardinals first and retries only an
        // out-of-bounds square or rock this body cannot traverse.
        if (stunned || (confused && rn2(5) === 0)) {
            let found = false;
            for (let tries = 0; tries <= 50; tries++) {
                confusePromptDirection(u, true);
                dx = u.dx ?? 0;
                dy = u.dy ?? 0;
                const x = u.ux + dx, y = u.uy + dy;
                if (!isok(x, y) || heroBadRock(game, x, y))
                    continue;
                found = true;
                break;
            }
            if (!found) {
                endVoluntaryMultiTurn(game);
                // Native nomul(0) ends repetition without clearing context.move.
                return true;
            }
        }
        // confdir() updates the same persistent vector selected by set_move_cmd().
        u.dx = dx;
        u.dy = dy;
        if (await waterTurbulenceStopsHero())
            return true;
        dx = u.dx;
        dy = u.dy;
        // C stores direction in u.dx/u.dy, so confdir() permanently changes the
        // pending Shift-direction run as well as this one destination.  The next
        // automatic step must retain that impaired direction; it may immediately
        // terminate against terrain which the originally requested line avoided.
        if (game._runState && game._runState.mode !== 8) {
            game._runState.dx = dx;
            game._runState.dy = dy;
        }
        newx = u.ux + dx;
        newy = u.uy + dy;
        if (!isok(newx, newy))
            return moveOutOfBounds(newx, newy);
        if (game.context.run) {
            const trap = knownRunTrap(newx, newy, game);
            const liquid = heroIsBlind(game) && runLiquidIsDangerous(newx, newy, game);
            if (trap || liquid) {
                const stopBeforeStep = game.context.run >= 2;
                if (stopBeforeStep) {
                    if (trap)
                        await announceRunTrap(trap, game);
                    else
                        await announceRunLiquid(newx, newy, game);
                }
                endVoluntaryMultiTurn(game);
                if (stopBeforeStep)
                    return false;
            }
        }
        if (await escapeFromStickyMonster(newx, newy))
            return true;
    }
    const loc = game.level?.at(newx, newy);
    // C domove_core() resolves a destination monster before test_move()
    // applies terrain restrictions.  In particular, the hero can attack
    // diagonally across an intact doorway even though moving through that
    // same doorway would be rejected.
    // The yielded swallower already passed through do_attack()'s safepet
    // block above; C's fall-through only reaches the second m_at() lookup
    // for the pet swap, never the attack again.
    const monster = swallowerYielded ? null
        : game.level ? monsterAtPosition(game.level, newx, newy) : null;
    const hiddenCeilingMonster = monster?.mundetected && !game.context.forcefight
        && !canSenseMonster(monster)
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x80)
        && MONSTER_SYMBOL[monster.mnum] !== 57;
    // C display.h:_is_safemon() requires a spotted peaceful monster and
    // an unimpaired hero. Concealed ceiling monsters still cancel running
    // here, before domove_attackmon_at() leaves their reveal to arrival.
    const safeMonster = !!monster && !game.context.forcefight
        && heroMayDisplaceMonster(monster);
    if (monster) {
        // hack.c checks context.run even when F makes this a single step.
        // It stops only for a visible or sensed actor. Seeing the
        // destination terrain is insufficient when minvis hides its occupant;
        // that case must reach attack_checks() and install the invisible
        // marker instead.
        // hack.c:2764 gates this on !_is_safemon() alone; forcefight is not
        // part of that macro.  An 'F' prefix that survives an intervening
        // unbound key past a later 'G' run prefix therefore bypasses the
        // guard for a visible peaceful pet, and the run step becomes a real
        // attack in do_attack().
        if (game.context.run && !heroMayDisplaceMonster(monster)
            && ((!heroIsBlind(game) && monsterVisible(monster, game)
                && ((M_AP_TYPE(monster) !== M_AP_FURNITURE
                    && M_AP_TYPE(monster) !== M_AP_OBJECT)
                    || heroHasProtectionFromShapeChangers(game)))
                || canSenseMonster(monster))) {
            stopRun(game);
            return false;
        }
        // C assigns u.ux0/u.uy0 after the run-visible-hostile guard but
        // before resolving displacement or attack.  A blocked/attacking
        // attempt therefore still refreshes the retreat reference point.
        u.ux0 = u.ux;
        u.uy0 = u.uy;
        // hack.c:domove_core() calls nomul(0) for every non-safe destination
        // monster after the visible-run guard and origin snapshot, but before
        // do_attack().  An unseen hostile therefore spends this attempted
        // step in attack_checks() while preventing another automatic run
        // step after the intervening monster phase; nomul(0) also requests
        // a full status update.
        if (!safeMonster)
            nomul(0, game);
        if (await bumpIntoMonster(monster, newx, newy))
            return true;
    }
    if (monster && !hiddenCeilingMonster) {
        if (beastChoosesHeroDisplacement(monster, game, newx, newy)) {
            const ballChainMove = await beginBallAndChainMove(newx, newy);
            if (ballChainMove?.blocked) {
                game.context.move = Number(ballChainMove.consumedTurn);
                return ballChainMove.consumedTurn;
            }
            const oldx = u.ux, oldy = u.uy;
            updateHeroRegions(game, newx, newy);
            u.ux = newx;
            u.uy = newy;
            await leaveMovementCloud(game, heroSpecies(game), !!u.mcan, oldx, oldy);
            await settleBeastHeroDisplacement(monster, game);
            if (game.program_state.gameover)
                return true;
            return finishHeroMovement({ oldx, oldy, loc, ballChainMove });
        }
        if (safeMonster && artifactById(game.uwep?.oartifact, game)?.name !== 'Stormbringer') {
            if (await runSafepetDisplacement(monster) !== 'evaded')
                return true;
            // C do_attack() returns FALSE here: a yielding monster takes
            // the same DO_MOVE checks as an unoccupied destination.
        }
        else {
            // attack() runs the whole attack_checks() reveal sequence: the
            // unseen-monster marker, the disguised-mimic stumble, and the
            // hidden-under reveal, each able to consume the move on its own.
            // C gb.bhitpos is the struck square, even for a worm tail.
            const verdict = await prepareAppliedWeaponAttack(monster, game.uwep ?? null, { state: game, struckAt: { x: newx, y: newy } });
            if (!verdict.proceed)
                return verdict.spentTime;
            if (await attackHostileMonster(monster, newx, newy, {
                confirmationOverridden: verdict.confirmationOverridden ?? false,
            }))
                return true;
        }
    }
    // domove_core() snapshots the origin before test_move().  This includes
    // the terminal blocked step of a Shift-run, which is why later monster
    // missile logic can observe the hero as stationary rather than retreating.
    u.ux0 = u.ux;
    u.uy0 = u.uy;
    const weapon = game.uwep || game.u.uwep;
    if (game.context.forcefight && loc?.typ === IRONBARS && weapon) {
        game.bhitpos.x = newx;
        game.bhitpos.y = newy;
        await strikeIronBarsWithWeapon(weapon, newx, newy, game);
        return true;
    }
    if (await fightSeenWebWithForce(newx, newy, game))
        return true;
    if (await fightEmptyDestination(newx, newy))
        return true;
    // hack.c:domove() clears a remembered unseen monster at the destination
    // before trying to move; a displacer-beast swap returned above and skips
    // this, matching the native !displaceu guard.
    await unmap_invisible(newx, newy);
    if ((dx || dy) && await ridingPreventsMovement()) {
        stopRun(game);
        return true;
    }
    if (await rootedHeroCannotMove())
        return true;
    if (heroTestMove(newx, newy) && !await confirmHeroStep(newx, newy))
        return false;
    if (u.utrap) {
        const canMove = await heroCanMoveFromTrap(newx, newy);
        // domove_core() resets trapping again after trapmove() returns;
        // the escape message may already have flushed its status update.
        if (!u.utrap)
            await resetHeroTrap(true);
        if (!canMove)
            return true;
    }
    // C test_move(DO_MOVE) learns obstructed terrain by touch before trying
    // to pass through it, open a door, or reject a diagonal doorway entry.
    if (loc && heroIsBlind(game) && (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR && (!!(loc.doormask & (D_CLOSED | D_LOCKED))
            || !!(dx && dy) && !heroPassesWalls(game)
                && blocksDiagonalDoor(null, loc)))) {
        await feel_location(newx, newy);
    }
    if (!await heroCanEnterIronBars(newx, newy, game))
        return rejectHeroMove();
    const formFlags = MONSTER_FLAGS1[heroSpecies(game)] ?? 0;
    const tunnels = !!(formFlags & M1_TUNNEL) && !(formFlags & M1_NEEDPICK);
    if (loc && (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED)))
        && !heroCanPassWallAt(game, newx, newy) && !heroOozesUnderDoor(loc)) {
        if (u.uinwater || game.underwater) {
            await pline('There is an obstacle there.');
            return rejectHeroMove();
        }
        if (tunnels && await continueChewingTerrain(newx, newy, game))
            return rejectHeroMove();
    }
    const oozingUnderDoor = heroOozesUnderDoor(loc);
    if (oozingUnderDoor)
        await pline('You ooze under the door.');
    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))
        && !heroCanPassWallAt(game, newx, newy) && !oozingUnderDoor) {
        const fumbling = !!(u?.fumbling || (u?.fumblingTurns || 0) > 0);
        const blind = !!(u?.blind || (u?.blindTurns || 0) > 0);
        const dexterity = currentAttribute(A_DEX);
        const autoopenEligible = (game.flags?.autoopen ?? true)
            && !game.context.run
            && !confused
            && !stunned
            && !fumbling;
        // C test_move(DO_MOVE) suppresses auto-open while running, Confused,
        // Stunned, or Fumbling, and also when the option is disabled.  The
        // resulting orthogonal fallback is independently classified: Blind,
        // Stunned, low Dexterity, or Fumbling spends the turn on an "Ouch!"
        // bump, while Confusion by itself only reports a closed door.
        // C test_move() reports the failed ooze for any amorphous form whose
        // inventory cannot fit under the door, before the open-or-bump
        // decision, and for diagonal attempts as well.
        if (monsterIsAmorphous({ mnum: heroSpecies(game) })) {
            await pline("You try to ooze under the door,"
                + " but can't squeeze your possessions through.");
        }
        if (!autoopenEligible) {
            // test_move(DO_MOVE) only reports the closed-door message for an
            // orthogonal attempt.  A diagonal attempt which reaches this
            // fallback is rejected silently before the intact-door check.
            if (!dx || !dy) {
                if (blind || stunned || dexterity < 10 || fumbling) {
                    if (u.usteed) {
                        // C substitutes a riding failure for the bump, with
                        // the same move consumption but no Dexterity exercise.
                        await pline(`You can't lead ${monsterName(u.usteed, { state: game, article: 'your' })} through that closed door.`);
                    }
                    else {
                        await pline('Ouch!  You bump into a door.');
                        await exerciseAttribute(A_DEX, false);
                    }
                    // C sets context.move despite returning false from
                    // test_move(), then nomul(0).  `true` is this port's
                    // scheduler-facing "time elapsed" result; the hero's
                    // coordinates remain unchanged.
                    nomul(0, game);
                    game.context.move = 1;
                    return true;
                }
                await pline('That door is closed.');
            }
            return rejectHeroMove();
        }
        await doopen(newx, newy);
        // test_move() preserves a counted walk after opening, or when an
        // untimed open has queued dokick as the next canned command.
        const queuedKick = game.context.move === 0
            && game._cannedCommands?.[0]?.kind === 'kick';
        const opened = !(loc.doormask & (D_CLOSED | D_LOCKED));
        if (!opened && !queuedKick)
            return rejectHeroMove();
        game.context.move = 0;
        return 'opened-door';
    }
    // C test_move() rejects an obstructed destination before it evaluates
    // tight-diagonal shoulders.  A boulder on ordinary floor is not terrain
    // obstruction, so that case still reaches cant_squeeze_thru() below
    // before moverock().
    if (blocksMove(newx, newy) && !heroCanPassWallAt(game, newx, newy)
        && !oozingUnderDoor) {
        const weapon = game.uwep || game.u.uwep;
        if (loc && IS_OBSTRUCTED(loc.typ) && game.flags?.autodig
            && !game.context.run && !game.context.nopick && weapon && isPick(weapon)
            && !(game.underwater || u.uinwater)) {
            u.dz = 0;
            const result = await applyPickAxeDirection(weapon, {
                state: game,
                attackMonster: (target) => attackHostileMonster(target, target.mx, target.my),
                payShopkeeper: dopay,
            });
            if (result.died)
                return false;
            return rejectHeroMove();
        }
        if (loc?.typ === DBWALL) {
            // C test_move(): the raised drawbridge reports itself before the
            // generic mention_walls fallback and without that option.
            await pline('That drawbridge is up!');
        }
        else if (heroPassesWalls(game) && In_sokoban(game.u.uz)) {
            // C test_move() keys this off In_sokoban(), so the soko
            // restriction stays even after the puzzle is solved and
            // level.flags.sokoban_rules has been cleared.
            await pline('The Sokoban walls resist your ability.');
        }
        else if (game.flags?.mention_walls) {
            // C test_move() names the obstruction from back_to_glyph(), so
            // an undetected secret door reads as a wall, a secret corridor
            // and an unseen square as solid stone, and arboreal stone as a
            // tree; pline_dir() marks the message's direction.
            let obstruction = '';
            if (loc) {
                const name = terrain_glyph(loc, newx, newy).terrainName;
                obstruction = name === 'stone' ? 'solid stone' : withIndefiniteArticle(name);
            }
            if (obstruction)
                await pline_dir(xyToDirection(dx, dy), `It's ${obstruction}.`);
        }
        return rejectHeroMove();
    }
    if (await rejectHeroDiagonalDoorEntry(dx, dy, loc))
        return rejectHeroMove();
    if (await rejectTightHeroDiagonal(dx, dy))
        return rejectHeroMove();
    if (!(dx && dy && heroBadRock(game, u.ux, newy) && heroBadRock(game, newx, u.uy))
        && wormCrossesBetween(u.ux, u.uy, newx, newy, game)) {
        const worm = monsterAtPosition(game.level, u.ux, newy);
        if (!worm)
            throw new Error('A crossing worm must occupy the adjacent square.');
        await pline(`${monsterName(worm, { state: game, article: 'your', capitalized: true })} is in your way.`);
        return rejectHeroMove();
    }
    if (await rejectHeroDiagonalDoorExit(dx, dy))
        return rejectHeroMove();
    const boulder = heroPassesWalls(game) && !game.level.flags.sokoban_rules ? null
        : (game.level.objects[newx]?.[newy] || []).find(object => object.otyp === BOULDER);
    const hallucinating = heroIsHallucinating(game);
    if (boulder && (game.context.run ?? 0) >= 2
        && !game.blind && !hallucinating
        && !heroCouldMoveOntoBoulder(newx, newy)) {
        if (game.flags?.mention_walls)
            // C test_move() reports the boulder through pline_dir().
            await pline_dir(xyToDirection(dx, dy), 'A boulder blocks your path.');
        return rejectHeroMove();
    }
    if (boulder) {
        if (tunnels && !game.level.flags.sokoban_rules) {
            if (await continueChewingTerrain(newx, newy, game))
                return rejectHeroMove();
        }
        else {
            game.context.move = 0;
            const pushed = await pushBouldersAt(newx, newy, dx, dy);
            if (game.program_state.gameover)
                return true;
            if (!pushed) {
                // moverock() spends the move only when the hero learned
                // something; that path sets context.door_opened in C.
                return game.context.move ? true : rejectHeroMove();
            }
        }
    }
    // C hack.c:swim_move_danger().  Known walking equipment and the swim
    // confirmation option decide whether a visible liquid edge stops us.
    // The request-menu (`m`) prefix deliberately accepts that step.
    if (heroShouldAvoidLiquid(newx, newy)) {
        const liquid = waterbodyName(newx, newy);
        const warning = `You avoid ${ingSuffix(heroLocomotion('step'))} into the ${liquid}.`;
        await plineWithContinuation(warning);
        // C handle_tip(TIP_SWIM) is an ordinary pline after the warning.
        const tip = 1 << TIP_SWIM;
        if (game.flags?.tips !== false && !((game.context.tips ?? 0) & tip)) {
            game.context.tips = (game.context.tips ?? 0) | tip;
            await plineWithContinuation("(Tip: use 'm' prefix to step in if you really want to.)");
        }
        return rejectHeroMove();
    }
    // C domove_core(): drag the ball before tentatively moving and swapping.
    const ballChainMove = await beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked) {
        game.context.move = Number(ballChainMove.consumedTurn);
        return ballChainMove.consumedTurn;
    }
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    updateHeroRegions(game, newx, newy);
    const destinationMonster = monsterAtPosition(game.level, newx, newy);
    u.ux = newx;
    u.uy = newy;
    // C hack.c:domove_core() m_postmove_effect(&youmonst) at u.ux0/u.uy0.
    await leaveMovementCloud(game, heroSpecies(game), !!u.mcan, oldx, oldy);
    await moveSteedWithHero();
    if (destinationMonster && heroMayDisplaceMonster(destinationMonster)
        && !hiddenCeilingMonster) {
        const monster = destinationMonster;
        // C drag_ball() can pull the hero back before the swap check.
        // A refused swap still completes ball placement and its delay.
        if (await petRefusesHeroSwap(monster, game)) {
            u.ux = oldx;
            u.uy = oldy;
            if (u.usteed) {
                u.usteed.mx = oldx;
                u.usteed.my = oldy;
            }
            return finishHeroMovement({
                oldx, oldy, loc, ballChainMove,
            });
        }
        await settlePetHeroDisplacement(monster, game);
        if (game.program_state.gameover)
            return true;
    }
    return finishHeroMovement({
        oldx, oldy, loc, ballChainMove,
    });
}
//# sourceMappingURL=hack.js.map