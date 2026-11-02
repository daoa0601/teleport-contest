// muse.js — the MUSE mechanics of muse.c: which items monsters are
// generated with (rnd_offensive_item/rnd_defensive_item/rnd_misc_item),
// which carried item they choose (find_defensive/find_offensive/find_misc)
// and how they use it (use_defensive/use_offensive/use_misc), the shared
// use feedback (precheck/mzapwand/mplayhorn/mreadmsg/mquaffmsg/
// you_aggravate), searches_for_item, and the stoning/sliming self-cures
// (munstone/mon_consume_unstone/cures_stoning/mcould_eat_tin/munslime/
// muse_unslime/cures_sliming).
import { game, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroHasInvoluntaryDelay, setMulti } from './cmd.js';
import { endVoluntaryMultiTurn } from './hack.js';
import { BEAR_TRAP, BOLT_LIM, CORR, D_BROKEN, D_CLOSED, D_LOCKED, DOOR, DRAWBRIDGE_UP, EXPL_FIERY, FIRE_TRAP, G_GONE, HOLE, In_endgame, In_sokoban, IS_AIR, IS_DOOR, IS_DRAWBRIDGE, IS_FURNITURE, IS_OBSTRUCTED, is_hole, is_pit, ismnum, isok, LADDER, MFAST, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP, MM_NOMSG, MON_OFFMAP, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, M_SEEN_SLEEP, NORMAL_SPEED, P_DAGGER, P_KNIFE, PIT, PLNMSG_enum, PLNMSG_UNKNOWN, POLY_TRAP, QBUFSZ, RLOC_MSG, SCORR, SDOOR, SHOPBASE, STAIRS, STRAT_WAITFORU, TELEP_TRAP, TEMPLE, WAND_BACKFIRE_CHANCE, W_ARM, W_ARMF, W_ARMG, W_ARMH, W_WEP, WEB, W_NONDIGGABLE, ZAP_POS, } from './const.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { touchPetrifies } from './stoning.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { CLR_BRIGHT_GREEN, CLR_GREEN } from './terminal.js';
import { MONSTER_ATTACKS, MONSTER_COLOR, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_HAS_WEAPON_ATTACK, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterHasNoHands, monsterHatesLight, monsterHatesSilver, monsterIsAmorphous, monsterIsAnimal, monsterIsBat, monsterIsKop, monsterIsMindless, monsterIsNoncorporeal, monsterIsNonliving, monsterIsSlimeproof, monsterIsUndead, monsterIsUnicorn, monsterIsUnsolid, monsterIsVampireShifter, speciesEatsCorpses, } from './monster_data.js';
import { AD_FIRE, AD_HEAL, AD_RBRE, AT_BREA, AT_EXPL, AT_GAZE } from './monster_attack_types.js';
import { isBimanualObject } from './object_properties.js';
import { AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, AMULET_OF_YENDOR, BAG_OF_HOLDING, BAG_OF_TRICKS, BOULDER, BUGLE, BULLWHIP, CORPSE, EGG, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, GLOB_OF_GREEN_SLIME, HEAVY_IRON_BALL, ICE_BOX, LARGE_BOX, OBJECT_DESCRIPTIONS, OBJECT_DIR, OBJECT_SUBTYPE, PICK_AXE, POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_OIL, POT_PARALYSIS, POT_POLYMORPH, POT_SICKNESS, POT_SLEEPING, POT_SPEED, SCR_CREATE_MONSTER, SCR_EARTH, SCR_FIRE, SCR_TELEPORTATION, TIN, TIN_OPENER, UNICORN_HORN, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_POLYMORPH, WAN_SLEEP, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, } from './object_data.js';
import { objectIsHardHelmet } from './do_wear.js';
import { dragonFormForArmor } from './polyself.js';
import { findNearbyMonsterPosition, monsterTeleportRestricted, reportMonsterTeleportRestriction, } from './teleport_rules.js';
import { monsterName, monsterReflexiveAction } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { monsterObjectPronoun, monsterSubjectPronoun } from './mondata.js';
import { dist2, distmin, depth, ledgerNo } from './hacklib.js';
import { cansee, couldsee, vision_note_blocker_change } from './vision.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, cls, displayColorName, displaySelf, docrt, flashGlyphAt, map_invisible, newsym, randomDisplayMonsterName, shieldeff, show_glyph_cell, transientMonsterGlyph, } from './display.js';
import { plineWithContinuation } from './pline.js';
import { d, rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { objectMaterial } from './o_init.js';
import { heroCanSeeInvisible } from './mcastu.js';
import { monsterAt, monsterAtPosition, monsterHasMapPosition, placeMonsterOnMap, removeMonsterFromMapAt, } from './steed.js';
import { monsterIsScaredAt, makeMonsterFlee, monsterWantsFloorObject } from './monmove.js';
import { finishImmediateMonsterTrap, seeTrap, trapAt, triggerImmediateMonsterTrap } from './trap.js';
import { isContainer, thawObject } from './container.js';
import { isQuantumBox } from './quantum_cat.js';
import { canLetGo, finishInventoryRemoval } from './hero_inventory.js';
import { changeMonsterForm, finishEnvironmentalMonsterDeath, finishMonsterKilled, healMonster, maybeUnhideAt, paralyzeMonster, removeMonsterFromGame, wakeMonster, } from './mon.js';
import { advanceMonsterWormBody } from './worm.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { makemonAt, rndmonstAdj, growMonster } from './makemon.js';
import { learnObjectType, observeObject } from './o_init.js';
import { makePlural, verbForSubject, withIndefiniteArticle } from './objnam.js';
import { dropObjectAtHero } from './hero_drop.js';
import { tryCallObjectType } from './do.js';
import { splitObjectStack } from './mkobj.js';
import { setMonsterPermanentInvisibility } from './worn.js';
import { trapName } from './trap.js';
import { monsterKnowsTrap, monsterLearnsTrap } from './mondata.js';
import { canHeroRiseUp, levelAtDepth, levelIsWizardTower, sameDungeonLevel } from './dungeon.js';
import { heroHandName } from './body_parts.js';
import { placeObjectSynchronously, sweepFloorPile } from './floor_object.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { forgetObjectKnowledge, unlinkObject, addObjectToContainer } from './mkobj.js';
import { destroyObjectFromMonsterInventory } from './monworn.js';
import { addObjectToMonsterInventory } from './steal.js';
import { definiteName, distantObjectName, minimalObjectName, objectCombatName, objectName, objectNameIsPlural, observeDistantObjectForNaming, observeObjectForNaming, pluralizeObjectNoun, } from './objnam.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { isWeldedPrimary, willWeld } from './wield.js';
import { monsterCanCarryObject } from './mon.js';
import { objectWeight } from './weight.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { dropBoulderOnHero, dropBoulderOnMonster } from './falling_boulder.js';
import { inventoryItemDescription } from './invent.js';
import { beginObjectBurn, lightDamage } from './light.js';
import { throwMonsterProjectile, blockingTerrain, monsterLinedUpWithHero, consumeMonsterItem } from './mthrowu.js';
import { castNativeRay, hitMonsterWithRay } from './ray_attack.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { destroyDrawbridge, findDrawbridgeAt } from './dbridge.js';
import { changeDoorByMagic } from './lock.js';
import { loseHeroHp } from './hero_damage.js';
import { hitObjectWithWand } from './immediate_zap.js';
import { revealMonsterAppearance } from './mon.js';
import { findMonsterArmorClass } from './monworn.js';
import { stopHeroOccupation } from './occupation.js';
import { propertyIsActive } from './properties.js';
import { rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { roomsAt } from './room.js';
import { heroHasHalfSpellDamage } from './zap.js';
import { askTeleportDestination, heroControlsTeleport, randomMonsterRelocation, teleportHero } from './teleport.js';
import { turnCarriedObjects, turnHeroWithUndeadMagic } from './undead_turning.js';
import { randomTeleportDepth } from './level_teleport.js';
import { awakenSoldiers } from './music.js';
import { canDigDown, canFallThrough, maketrap } from './mklev.js';
import { shopkeeperInOwnShop, addShopDamage, deleteObject } from './shk.js';
import { isAccessibleAt } from './monmove.js';
import { isIceAt, isLavaAt, isPoolAt } from './dbridge.js';
import { monsterCarriesSpecialObject } from './wizard.js';
import { inHeroSanctuary } from './priest.js';
import { heroSpecies } from './hero_species.js';
import { monsterIsHelpless } from './mondata.js';
import { heroIsUnaware, heroIsUnconscious } from './hero_sleep.js';
import { formatFeltMessage, formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { explode } from './explosion.js';
import { setMonsterMalign } from './makemon.js';
import { monsterWieldedWeapon } from './weapon.js';
import { extendPetHungerDeadline, petFoodNutrition } from './pet_eating.js';
import { impossible } from './diagnostics.js';
import { displayMessageWindow } from './tty_topline.js';
import { monsterHasAcidResistance, monsterHasStoneResistance, monsterLocomotion, monsterPolymorphsWhenStoned, monstersForgetHeroResistance, monstersObserveHeroResistance, sameMonsterRace, speciesCanBlow, } from './mondata.js';
import { migrateMonsterOffLevel } from './dog.js';
import { monsterResistsEffect } from './zap.js';
// ---------------------------------------------------------------------------
// Shared muse.c constants.
// ---------------------------------------------------------------------------
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_NEEDPICK = 0x00000040;
const M1_NOEYES = 0x00001000;
const M1_NOHANDS = 0x00002000;
const M1_NOLIMBS = 0x00006000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_ACID = 0x08000000;
const M2_MERC = 0x00000200;
const M2_ROCKTHROW = 0x08000000;
const M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000;
const M2_COLLECT = 0x40000000;
const M2_MAGIC = 0x80000000;
const S_EYE = 5;
const S_LIGHT = 25;
const S_GHOST = 54;
const WEAPON_CLASS = 2, ARMOR_CLASS = 3, RING_CLASS = 4, AMULET_CLASS = 5;
const TOOL_CLASS = 6, FOOD_CLASS = 7, POTION_CLASS = 8, SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10, WAND_CLASS = 11, GEM_CLASS = 13, ROCK_CLASS = 14, BALL_CLASS = 15;
const GEMSTONE = 20, MINERAL = 21, RAY = 3, IRON = 11, SILVER = 14;
const G_UNIQ = 0x1000;
const PM_PESTILENCE = 312;
const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_KI_RIN = MONSTER_NAME.indexOf('ki-rin');
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
// The near/far hearing threshold mzapwand(), mplayhorn(), mreadmsg() and
// precheck()'s explosion feedback share: BOLT_LIM + 1 when the monster's
// square could be seen, BOLT_LIM - 3 otherwise.
function itemUseIsNearby(monster, state) {
    const range = couldsee(monster.mx, monster.my) ? BOLT_LIM + 1 : BOLT_LIM - 3;
    return (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 <= range * range;
}
// Return null when the selected item can still be used. An exploded wand
// spends no action if its owner survives, but cancels the selected choice.
// C muse.c:precheck().
export async function prepareMonsterItemUse(monster, object, options) {
    const { state, random = rn2, publish = plineWithContinuation } = options;
    if (object.oclass === 8) {
        const appearance = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
        const species = appearance === 'milky' ? 287 : appearance === 'smoky' ? 315 : null;
        if (species !== null && !((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
            && !random(13 + 2 * (state.mvitals?.[species]?.born ?? 0))) {
            const point = findNearbyMonsterPosition(species, monster.mx, monster.my, { state, random });
            if (!point)
                return null;
            const visible = cansee(monster.mx, monster.my);
            await presentMonsterQuaff(monster, object, options);
            await consumeMonsterItem(monster, object, state);
            const occupant = await makemonAt(species, point.x, point.y, MM_NOMSG);
            if (!occupant) {
                if (visible)
                    await publish('The potion turns out to be empty.');
            }
            else if (species === 287) {
                if (visible) {
                    const subject = monsterName(monster, { state });
                    const occupantName = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'ghost';
                    await publish(`As ${subject} opens the bottle, an enormous ${occupantName} emerges!`);
                    await publish(`${monsterName(monster, { state, capitalized: true })} is frightened to death, and unable to move.`);
                }
                paralyzeMonster(monster, 3);
            }
            else {
                if (visible)
                    await publish(`In a cloud of smoke, ${monsterName(occupant, { state, article: 'a' })} emerges!`);
                await publish(`${visible ? monsterName(occupant, { state, capitalized: true }) : 'Something'} speaks.`);
                // Native precheck() verbalizes bottle occupants even for a deaf hero.
                if (random(2)) {
                    await publish('"You freed me!"');
                    occupant.mpeaceful = 1;
                    setMonsterMalign(occupant, state);
                }
                else {
                    await publish('"It is about time."');
                    if (visible)
                        await publish(`${monsterName(occupant, { state, capitalized: true })} vanishes.`);
                    await removeMonsterFromGame(occupant);
                }
            }
            return { nativeResult: 2, heroDied: !!state.program_state.gameover };
        }
    }
    const backfire = await checkMonsterWandBackfire(monster, object, options);
    return backfire.exploded ? { nativeResult: backfire.nativeResult, heroDied: backfire.heroDied } : null;
}
// The cursed-wand half of precheck().  C muse.c:precheck().
export async function checkMonsterWandBackfire(monster, object, { state, publish = plineWithContinuation, random = rn2, rollDice = d, }) {
    if (object.oclass !== WAND_CLASS || !object.cursed || random(WAND_BACKFIRE_CHANCE) !== 0)
        return { exploded: false, nativeResult: 0, heroDied: false, monsterDied: false };
    const damage = rollDice(object.spe + 2, 6);
    if (cansee(monster.mx, monster.my)) {
        const subject = monsterName(monster, { state, capitalized: true });
        await publish(`${subject} zaps ${withIndefiniteArticle(objectCombatName(object, { state }))}, which suddenly explodes!`);
    }
    else {
        const message = formatHeardMessage(`a zap and an explosion ${itemUseIsNearby(monster, state) ? 'nearby' : 'in the distance'}.`, state);
        if (message)
            await publish(message);
    }
    await consumeMonsterItem(monster, object, state);
    monster.mhp -= damage;
    if (monster.mhp > 0)
        return { exploded: true, nativeResult: 0, heroDied: false, monsterDied: false };
    const death = await finishMonsterKilled(monster, state, {
        damageType: AD_RBRE, cause: '', publish, random, rollDice,
    });
    // Native precheck returns 1 after monkilled(), including life saving.
    return {
        exploded: true, nativeResult: 1,
        heroDied: !!death.heroDied, monsterDied: !death.survived,
    };
}
// ---------------------------------------------------------------------------
// C muse.c:mzapwand().
// ---------------------------------------------------------------------------
export async function presentMonsterWandUse(monster, object, { state, self = false, publish = plineWithContinuation, }) {
    if (object.spe < 1) {
        await impossible(`Mon zapping wand with ${object.spe} charges?`, { state });
        return;
    }
    if (!canSeeMonster(monster)) {
        const message = formatHeardMessage(`a ${itemUseIsNearby(monster, state) ? 'nearby' : 'distant'} zap.`, state);
        if (message)
            await publish(message);
        forgetObjectKnowledge(object);
    }
    else if (self) {
        const subject = monsterName(monster, { state, capitalized: true });
        const action = monsterReflexiveAction(monster, subject, 'zap', '', { state });
        observeObjectForNaming(object, { state });
        await publish(`${action} with ${await inventoryItemDescription(object)}!`);
    }
    else {
        const subject = monsterName(monster, { state, capitalized: true });
        await publish(`${subject} zaps ${withIndefiniteArticle(objectCombatName(object, { state }))}!`);
        await stopHeroOccupation(state, publish);
    }
    object.spe--;
}
// ---------------------------------------------------------------------------
// C muse.c:mplayhorn().
// ---------------------------------------------------------------------------
export async function presentMonsterHornUse(monster, object, { state, self = false, publish = plineWithContinuation, }) {
    if (!canSeeMonster(monster)) {
        const message = formatHeardMessage(`a horn being played ${itemUseIsNearby(monster, state) ? 'nearby' : 'in the distance'}.`, state);
        if (message)
            await publish(message);
        forgetObjectKnowledge(object);
    }
    else {
        observeObject(object, state);
        let name = objectCombatName(object, { state });
        if (name.length >= QBUFSZ)
            name = minimalObjectName(object, state);
        const subject = monsterName(monster, { state, capitalized: true });
        if (self) {
            await publish(`${monsterReflexiveAction(monster, subject, 'play', `a ${name} directed at`, { state })}!`);
        }
        else {
            await publish(`${subject} plays ${withIndefiniteArticle(name)} directed at you!`);
        }
        learnObjectType(object.otyp, state);
        if (!self)
            await stopHeroOccupation(state, publish);
    }
    object.spe--;
}
// ---------------------------------------------------------------------------
// C muse.c:mreadmsg().
// ---------------------------------------------------------------------------
export async function presentMonsterScrollRead(monster, object, { state, publish = plineWithContinuation, }) {
    const visible = canSeeMonster(monster);
    if (!visible && heroIsDeaf(state))
        return;
    observeObject(object, state);
    if (visible)
        observeObjectForNaming(object, { state });
    const single = { ...object, quan: 1, quantity: 1 };
    const name = visible ? await inventoryItemDescription(single)
        : withIndefiniteArticle(minimalObjectName(single, state));
    if (visible) {
        await publish(`${monsterName(monster, { state, capitalized: true })} reads ${name}!`);
    }
    else {
        const unique = !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) || monster.isshk;
        const recognize = !heroIsHallucinating(state)
            && (monster.meverseen || sameMonsterRace(heroSpecies(state), monster.mnum) && !unique);
        const sensed = canSenseMonster(monster);
        if (!sensed && couldsee(monster.mx, monster.my)
            && (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 <= 100)
            await map_invisible(monster.mx, monster.my);
        const words = `reading ${name}`.replace('reading a scroll labeled', monster.mconf ? 'attempting to incant' : 'incant');
        const subject = monsterName(monster, {
            state, article: 'a', suppressInvisible: true, suppressSaddle: true,
            suppressIt: !!recognize, augmentIt: !recognize,
        });
        const heard = formatHeardMessage(`${subject} ${words}.`, state);
        if (heard)
            await publish(heard);
        if (sensed)
            await flashReadingMonster(monster, state);
    }
    if (monster.mconf)
        await publish(`Being confused, ${visible
            ? monsterName(monster, { state }) : monsterSubjectPronoun(monster, { state })} mispronounces the magic words...`);
}
// The sensemon() telepathy spark that closes an unseen mreadmsg().
async function flashReadingMonster(monster, state) {
    let count = couldsee(monster.mx, monster.my) ? 8 : 4;
    if (state.flags.sparkle === false)
        count /= 2;
    const row = state.viz_array?.[monster.my];
    const saved = row?.[monster.mx];
    if (!row || saved === undefined)
        throw new Error('A sensed reader needs its visibility cell');
    row[monster.mx] = saved | 3;
    try {
        await flashGlyphAt(monster.mx, monster.my, transientMonsterGlyph(monster), count);
    }
    finally {
        row[monster.mx] = saved;
        await newsym(monster.mx, monster.my);
    }
}
// ---------------------------------------------------------------------------
// C muse.c:mquaffmsg().
// ---------------------------------------------------------------------------
export async function presentMonsterQuaff(monster, object, { state, publish = plineWithContinuation, }) {
    const seen = canSeeMonster(monster);
    if (seen) {
        observeObject(object, state);
        observeObjectForNaming(object, { state });
        const name = await inventoryItemDescription({ ...object, quan: 1, quantity: 1 });
        await publish(`${monsterName(monster, { state, capitalized: true })} drinks ${name}!`);
    }
    else if (!heroIsDeaf(state)) {
        const message = formatHeardMessage('a chugging sound.', state);
        if (message)
            await publish(message);
    }
    return seen;
}
// ---------------------------------------------------------------------------
// C muse.c:m_use_healing(). Blind and peaceful monsters fall back to the
// first healing potion they carry.
// ---------------------------------------------------------------------------
const healingTypes = [
    [POT_FULL_HEALING, 'full-healing'], [POT_EXTRA_HEALING, 'extra-healing'], [POT_HEALING, 'healing'],
];
// C muse.c:m_use_healing().
function healingChoice(monster) {
    const inventory = monster.minvent || monster.inventory || [];
    for (const [type, kind] of healingTypes) {
        const object = inventory.find(item => item.otyp === type);
        if (object)
            return { kind, object };
    }
    return null;
}
// ---------------------------------------------------------------------------
// C muse.c:m_tele(). The shared tail of every defensive teleport: report
// level restriction, amulet disorientation, or relocate.
// ---------------------------------------------------------------------------
async function teleportForEscape(monster, type, seen, options, trap = null) {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    if (await reportMonsterTeleportRestriction(monster, { state, publish })) {
        if (seen && type)
            learnObjectType(type, state);
        monsterLearnsTrap(monster, { ttyp: TELEP_TRAP });
    }
    else if ((hasAmulet(monster) || levelIsWizardTower(state)) && !random(3)) {
        if (seen)
            await publish(`${monsterName(monster, { state, capitalized: true })} seems disoriented for a moment.`);
    }
    else {
        if (seen && type)
            learnObjectType(type, state);
        if (trap) {
            const action = await triggerImmediateMonsterTrap(monster, state, { force: true, random, rollOne, rollDice, publish });
            await finishImmediateMonsterTrap(action, state, { publish, random, rollOne, rollDice });
        }
        else
            await randomMonsterRelocation(monster, { ...options, flags: RLOC_MSG });
    }
}
function teleportNotKnownBlocked(monster, state) {
    return !monsterTeleportRestricted(monster, state) || !monsterKnowsTrap(monster, { ttyp: TELEP_TRAP });
}
function hasAmulet(monster) {
    return (monster.minvent || monster.inventory || []).some(object => object.otyp === AMULET_OF_YENDOR);
}
function atBottom(state) {
    return state.u.uz.dlevel === state.dungeons[state.u.uz.dnum]?.num_dunlevs;
}
function monsterFloats(monster) {
    const symbol = MONSTER_SYMBOL[monster.mnum];
    return symbol === 5 || symbol === 25; // S_EYE, S_LIGHT
}
function stairAt(state, x, y) {
    for (let stair = state.stairs; stair; stair = stair.next)
        if (stair.sx === x && stair.sy === y)
            return stair;
    return null;
}
export function findMonsterDefensiveItem(monster, state, { tryEscape = false, random = rn2, } = {}) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const noHands = !!(flags & M1_NOHANDS);
    const stuck = state.u.ustuck === monster;
    if (flags & (M1_ANIMAL | M1_MINDLESS))
        return null;
    if (!tryEscape && dist2(monster.mx, monster.my, monster.mux ?? state.u.ux, monster.muy ?? state.u.uy) > 25)
        return null;
    if (state.u.uswallow && stuck)
        return null;
    if (tryEscape && state.knox_level?.dnum === state.u.uz.dnum
        && state.knox_level.dlevel === state.u.uz.dlevel
        && dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > 2
        && state.level.monsters.some(other => other !== monster && !other.dead
            && dist2(monster.mx, monster.my, other.mx, other.my) <= 2))
        return null;
    const inventory = monster.minvent || monster.inventory || [];
    const blind = !monster.mcansee;
    if (monster.mconf || monster.mstun || blind) {
        const horn = noHands ? null : inventory.find(object => object.otyp === UNICORN_HORN && !object.cursed) ?? null;
        if (horn || MONSTER_SYMBOL[monster.mnum] === 21 || MONSTER_NAME[monster.mnum] === 'ki-rin')
            return { kind: 'horn', object: horn };
    }
    if (monster.mconf || monster.mstun) {
        const corpse = inventory.find(object => object.otyp === CORPSE && MONSTER_NAME[object.corpsenm ?? -1] === 'lizard');
        if (corpse)
            return { kind: 'lizard', object: corpse };
        const tin = inventory.slice().reverse().find(object => object.otyp === TIN && MONSTER_NAME[object.corpsenm ?? -1] === 'lizard');
        if (tin && monsterCanOpenTin(monster) && random(3))
            return { kind: 'lizard', object: tin };
    }
    const pestilence = MONSTER_NAME[monster.mnum] === 'Pestilence';
    if (blind && !noHands && !pestilence) {
        const healing = healingChoice(monster);
        if (healing)
            return healing;
    }
    const weapon = state.uwep || state.u.uwep;
    if (!monster.mpeaceful && !noHands && weapon?.otyp === CORPSE
        && touchPetrifies(weapon.corpsenm ?? -1) && !monsterHasStoneResistance(monster)
        && !monsterPolymorphsWhenStoned(monster)
        && monsterLinedUpWithHero(monster, state, random)) {
        const wand = inventory.find(object => object.otyp === WAN_UNDEAD_TURNING && object.spe > 0);
        if (wand)
            return { kind: 'undead-turning', object: wand };
    }
    if (!tryEscape) {
        const fraction = state.u.ulevel < 10 ? 5 : state.u.ulevel < 14 ? 4 : 3;
        if (monster.mhp >= monster.mhpmax || monster.mhp >= 10 && monster.mhp * fraction >= monster.mhpmax)
            return null;
        if (monster.mpeaceful)
            return noHands ? null : healingChoice(monster);
    }
    let selected = physicalEscape(monster, state, stuck);
    if (noHands)
        return selected;
    const bugle = inventory.find(object => object.otyp === BUGLE);
    if (bugle && (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MERC
        && state.level.monsters.some(other => other !== monster
            && monsterHasMapPosition(other, state) && isok(other.mx, other.my)
            && Math.abs(other.mx - monster.mx) <= 3 && Math.abs(other.my - monster.my) <= 3
            && (MONSTER_FLAGS2[other.mnum] ?? 0) & M2_MERC
            && MONSTER_NAME[other.mnum] !== 'guard'
            && (other.msleeping || !other.mcanmove)))
        selected = { kind: 'bugle', object: bugle };
    if (selected)
        return selected;
    const cell = state.level.requireAt(monster.mx, monster.my);
    const trap = state.level.traps.find(candidate => candidate.tx === monster.mx && candidate.ty === monster.my);
    const blocksDigging = trap && !is_pit(trap.ttyp) && trap.ttyp !== WEB && trap.ttyp !== BEAR_TRAP;
    for (const object of inventory) {
        if (selected && !random(3))
            break;
        if (selected?.kind === 'digging')
            break;
        if (object.otyp === WAN_DIGGING && object.spe > 0 && !stuck && !blocksDigging
            && !monster.isshk && !monster.isgd && !monster.ispriest && !monsterFloats(monster)
            && !In_sokoban(state.u.uz) && !(cell.wall_info & W_NONDIGGABLE)
            && !atBottom(state) && !In_endgame(state.u.uz)
            && !isIceAt(monster.mx, monster.my, state) && !isPoolAt(monster.mx, monster.my, state)
            && !isLavaAt(monster.mx, monster.my, state)
            && !(MONSTER_NAME[monster.mnum] === 'Vlad the Impaler' && state.dungeons[state.u.uz.dnum]?.dname === "Vlad's Tower"))
            selected = { kind: 'digging', object };
        if (selected?.kind === 'teleport-self' || selected?.kind === 'teleport-ray')
            continue;
        if (object.otyp === WAN_TELEPORTATION && object.spe > 0 && teleportNotKnownBlocked(monster, state))
            selected = { kind: hasAmulet(monster) ? 'teleport-ray' : 'teleport-self', object };
        if (selected?.kind === 'teleport-scroll')
            continue;
        if (object.otyp === SCR_TELEPORTATION && monster.mcansee && !(flags & M1_NOEYES)
            && (!object.cursed || !(monster.isshk && shopkeeperInOwnShop(monster, state)) && !monster.isgd && !monster.ispriest)
            && teleportNotKnownBlocked(monster, state))
            selected = { kind: 'teleport-scroll', object };
        if (!pestilence) {
            if (selected?.kind === 'full-healing')
                continue;
            if (object.otyp === POT_FULL_HEALING)
                selected = { kind: 'full-healing', object };
            if (selected?.kind === 'extra-healing')
                continue;
            if (object.otyp === POT_EXTRA_HEALING)
                selected = { kind: 'extra-healing', object };
            if (selected?.kind === 'create-wand')
                continue;
            if (object.otyp === WAN_CREATE_MONSTER && object.spe > 0)
                selected = { kind: 'create-wand', object };
            if (selected?.kind === 'healing')
                continue;
            if (object.otyp === POT_HEALING)
                selected = { kind: 'healing', object };
        }
        else {
            if (selected?.kind === 'full-healing')
                continue;
            if (object.otyp === POT_SICKNESS)
                selected = { kind: 'full-healing', object };
            if (selected?.kind === 'create-wand')
                continue;
            if (object.otyp === WAN_CREATE_MONSTER && object.spe > 0)
                selected = { kind: 'create-wand', object };
        }
        if (selected?.kind === 'create-scroll')
            continue;
        if (object.otyp === SCR_CREATE_MONSTER)
            selected = { kind: 'create-scroll', object };
    }
    return selected;
}
// The stairs/trap-door/teleport-trap scan inside find_defensive().
function physicalEscape(monster, state, stuck) {
    if (stuck || !MONSTER_MOVE[monster.mnum] || monster.mtrapped)
        return null;
    const floats = monsterFloats(monster);
    const cell = state.level.requireAt(monster.mx, monster.my);
    if (cell.typ === STAIRS || cell.typ === LADDER) {
        const stair = stairAt(state, monster.mx, monster.my);
        return stair && (stair.up || !floats) ? { kind: 'stairs', stair } : null;
    }
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const ignoreBoulders = (MONSTER_SIZE[monster.mnum] ?? 0) === 0
        || !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) || !!(flags & M1_WALLWALK);
    const spots = [{ x: monster.mx, y: monster.my }];
    for (let x = monster.mx - 1; x <= monster.mx + 1; x++)
        for (let y = monster.my - 1; y <= monster.my + 1; y++)
            if (isok(x, y) && (x !== monster.mx || y !== monster.my))
                spots.push({ x, y });
    let selected = null;
    for (const { x, y } of spots) {
        if (x === state.u.ux && y === state.u.uy)
            continue;
        if (MONSTER_NAME[monster.mnum] === 'grid bug' && x !== monster.mx && y !== monster.my)
            continue;
        const occupant = monsterAtPosition(state.level, x, y);
        if (occupant && occupant !== monster)
            continue;
        const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
        if (!trap || !ignoreBoulders && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER)
            || monsterIsScaredAt(monster, state, x, y))
            continue;
        if (is_hole(trap.ttyp) && !floats && !monster.isshk && !monster.isgd && !monster.ispriest
            && canFallThrough(state.u.uz))
            return { kind: 'trap', trap };
        if (trap.ttyp === TELEP_TRAP)
            selected = { kind: 'trap', trap };
    }
    return selected;
}
// ---------------------------------------------------------------------------
// C muse.c:mon_escape()'s m_flee() helper: run away before using an escape
// item, unless already fleeing or the Wizard.
// ---------------------------------------------------------------------------
async function fleeForEscape(monster, options) {
    if (monster.mflee || monster.iswiz)
        return;
    const turns = 33 - Math.trunc(30 * monster.mhp / monster.mhpmax);
    if (turns)
        await makeMonsterFlee(monster, { ...options, turns, announce: false });
}
// ---------------------------------------------------------------------------
// C muse.c:use_defensive(). Consumes the find_defensive() choice.
// ---------------------------------------------------------------------------
export async function useMonsterDefensiveItem(monster, choice, options) {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    const object = 'object' in choice ? choice.object : null;
    if (object) {
        const precheck = await prepareMonsterItemUse(monster, object, options);
        if (precheck)
            return precheck;
    }
    const seen = canSeeMonster(monster);
    const subject = () => monsterName(monster, { state, capitalized: true });
    const spent = () => ({ nativeResult: 2, heroDied: !!state.program_state.gameover });
    switch (choice.kind) {
        case 'horn':
            if (seen)
                await publish(choice.object ? `${subject()} uses a unicorn horn!`
                    : `The tip of ${monsterName(monster, { state })}'s horn glows!`);
            if (!monster.mcansee)
                await cureMonsterBlindness(monster, seen, options);
            else {
                monster.mconf = monster.mstun = 0;
                if (seen)
                    await publish(`${subject()} seems steadier now.`);
            }
            return spent();
        case 'lizard':
            await consumeMonsterStoningCure(monster, choice.object, { state, publish, stoning: false });
            return spent();
        case 'healing':
        case 'extra-healing':
        case 'full-healing': {
            const potion = choice.object;
            await presentMonsterQuaff(monster, potion, options);
            const sign = potion.blessed ? 1 : potion.cursed ? -1 : 0;
            if (choice.kind === 'full-healing') {
                if (potion.otyp === POT_SICKNESS)
                    potion.blessed = false;
                healMonster(monster, monster.mhpmax, potion.blessed ? 8 : 4);
            }
            else
                healMonster(monster, rollDice(6 + 2 * sign, choice.kind === 'healing' ? 4 : 8), choice.kind === 'healing' ? 1 : potion.blessed ? 5 : 2);
            if (!monster.mcansee && (choice.kind === 'healing' ? !potion.cursed : potion.otyp !== POT_SICKNESS))
                await cureMonsterBlindness(monster, seen, options);
            if (seen) {
                await publish(`${subject()} looks ${choice.kind === 'healing' ? 'better' : choice.kind === 'extra-healing' ? 'much better' : 'completely healed'}.`);
                learnObjectType(potion.otyp, state);
            }
            await consumeMonsterItem(monster, potion, state);
            return spent();
        }
        case 'bugle':
            if (seen) {
                observeObjectForNaming(choice.object, { state });
                await publish(`${subject()} plays ${await inventoryItemDescription(choice.object)}!`);
            }
            else if (!heroIsDeaf(state)) {
                const message = formatHeardMessage('a bugle playing reveille!', state);
                if (message)
                    await publish(message);
            }
            await awakenSoldiers((MONSTER_LEVEL[monster.mnum] ?? 0) * 30, monster);
            return spent();
        case 'teleport-self':
            if (monster.isshk && shopkeeperInOwnShop(monster, state) || monster.isgd || monster.ispriest)
                return spent();
            await fleeForEscape(monster, options);
            await presentMonsterWandUse(monster, choice.object, { ...options, self: true });
            await teleportForEscape(monster, choice.object.otyp, seen, options);
            return spent();
        case 'teleport-ray':
        case 'undead-turning':
            await presentMonsterWandUse(monster, choice.object, options);
            state.context.zap_oseen = seen;
            await resolveMonsterImmediateWand(monster, choice.object, options);
            if (choice.kind === 'teleport-ray' && monsterTeleportRestricted(monster, state))
                monsterLearnsTrap(monster, { ttyp: TELEP_TRAP });
            return spent();
        case 'teleport-scroll': {
            if (monster.isshk || monster.isgd || monster.ispriest)
                return spent();
            await fleeForEscape(monster, options);
            const scroll = choice.object.quan > 1 ? splitObjectStack(choice.object, 1, state) : choice.object;
            if (!scroll)
                throw new Error('A monster teleport scroll must retain one readable copy');
            unlinkObject(scroll, state);
            // A previously seen scroll is nameable only if this use produces feedback.
            state._lastPlineKind = PLNMSG_enum;
            const scrollOptions = {
                ...options,
                publish: async (message) => {
                    state._lastPlineKind = PLNMSG_UNKNOWN;
                    await publish(message);
                },
            };
            await presentMonsterScrollRead(monster, scroll, scrollOptions);
            if (scroll.cursed || monster.mconf) {
                const destination = randomTeleportDepth(state, random, rollOne);
                if (hasAmulet(monster) || In_endgame(state.u.uz)) {
                    if (seen)
                        await scrollOptions.publish(`${subject()} seems very disoriented for a moment.`);
                }
                else if (destination === depth(state.u.uz, state.dungeons)) {
                    if (seen)
                        await scrollOptions.publish(`${subject()} shudders for a moment.`);
                }
                else
                    await migrateMonsterOffLevel(monster, state, { dst: levelAtDepth(destination, { state }) });
            }
            else
                await teleportForEscape(monster, scroll.otyp, seen, scrollOptions);
            if (scroll.dknown && state._lastPlineKind !== PLNMSG_enum)
                await tryCallObjectType(scroll, state);
            await deleteObject(scroll, state);
            return spent();
        }
        case 'create-wand':
        case 'create-scroll': {
            let count = 1;
            const confused = choice.kind === 'create-scroll' && !!monster.mconf;
            if (choice.kind === 'create-scroll') {
                if (!random(73))
                    count += rollOne(4);
                if (confused || choice.object.cursed)
                    count += 12;
            }
            const placementSpecies = confused ? 6 : isPoolAt(monster.mx, monster.my, state)
                ? state.u.uinwater ? 319 : 328 : null;
            let known = false;
            let zapped = false;
            if (choice.kind === 'create-scroll')
                await presentMonsterScrollRead(monster, choice.object, options);
            while (count-- > 0) {
                const point = findNearbyMonsterPosition(placementSpecies, monster.mx, monster.my, { state, random });
                if (!point)
                    break;
                if (choice.kind === 'create-wand') {
                    await presentMonsterWandUse(monster, choice.object, options);
                    zapped = true;
                }
                const created = await makemonAt(confused ? 6 : null, point.x, point.y);
                known ||= !!created && canSpotMonster(created);
            }
            if (known && (choice.kind === 'create-scroll' || seen))
                learnObjectType(choice.object.otyp, state);
            if (choice.kind === 'create-scroll') {
                if (!known)
                    await tryCallObjectType(choice.object, state);
                await consumeMonsterItem(monster, choice.object, state);
            }
            else if (!zapped)
                return { nativeResult: 0, heroDied: false };
            return spent();
        }
        case 'digging': {
            await fleeForEscape(monster, options);
            await presentMonsterWandUse(monster, choice.object, options);
            if (seen)
                learnObjectType(WAN_DIGGING, state);
            const { mx: x, my: y } = monster;
            const cell = state.level.requireAt(x, y);
            if (IS_FURNITURE(cell.typ) || IS_DRAWBRIDGE(cell.typ) || findDrawbridgeAt(x, y, state)
                || stairAt(state, x, y)) {
                await publish('The digging ray is ineffective.');
                return spent();
            }
            const hole = canDigDown(state.u.uz) || cell.candig;
            if (!hole && state.level.traps.some(trap => trap.tx === x && trap.ty === y)) {
                if (seen)
                    await publish(`The ${surfaceName(x, y, state)} here is too hard to dig in.`);
                return spent();
            }
            const trap = await maketrap(x, y, hole ? HOLE : PIT);
            if (!trap) {
                // Native use_defensive() reports both an occupied square and a
                // failed pit construction the same way; trap.c:maketrap()
                // rejects air terrain and undestroyable floor traps.
                if (!hole && seen)
                    await publish(`The ${surfaceName(x, y, state)} here is too hard to dig in.`);
                return spent();
            }
            if (hole)
                vision_note_blocker_change(x, y);
            if (hole || cansee(x, y))
                await seeTrap(trap, state);
            if (cansee(x, y)) {
                await publish(`${subject()} has made a ${hole ? 'hole' : 'pit'} in the ${surfaceName(x, y, state)}.`);
                if (hole)
                    await publish(`${subject()} ${(MONSTER_FLAGS1[monster.mnum] ?? 0) & 1 ? 'dives' : 'falls'} through...`);
            }
            else if (hole && !heroIsDeaf(state))
                await publishHeardMessage(`something crash through the ${surfaceName(x, y, state)}.`, publish, state);
            await fillPitWithBoulderAt(x, y, state, { publish });
            if (hole)
                await migrateMonsterOffLevel(monster, state, { dst: { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 } });
            else {
                vision_note_blocker_change(x, y);
                const action = await triggerImmediateMonsterTrap(monster, state, { forceBungle: true, random, rollOne, rollDice });
                await finishImmediateMonsterTrap(action, state, { publish, random, rollOne, rollDice });
                if (action.event?.kind === 'pit-trap' && action.event.killed)
                    return { nativeResult: 1, heroDied: !!state.program_state.gameover };
            }
            return spent();
        }
        case 'stairs': {
            await fleeForEscape(monster, options);
            const stair = choice.stair;
            const branch = stair.tolev.dnum !== state.u.uz.dnum;
            const ladder = stair.isladder && !branch;
            if (ledgerNo(state.u.uz, state) === 1 && (branch || stair.up && !ladder)) {
                if (monsterCarriesSpecialObject(monster, state) || monster.iswiz && (state.context.no_of_wizards ?? 0) < 2)
                    return { nativeResult: 0, heroDied: false };
                if (seen)
                    await publish(`${subject()} escapes the dungeon!`);
                await removeMonsterFromGame(monster);
                return spent();
            }
            let destination = stair.tolev;
            let mode = branch ? MIGR_SSTAIRS
                : ladder ? stair.up ? MIGR_LADDER_DOWN : MIGR_LADDER_UP
                    : stair.up ? MIGR_STAIRS_DOWN : MIGR_STAIRS_UP;
            if (mode === MIGR_STAIRS_DOWN && state.dungeons[state.u.uz.dnum]?.flags.hellish
                && hasAmulet(monster) && !random(4)
                && state.u.uz.dlevel < (state.dungeons[state.u.uz.dnum]?.num_dunlevs ?? 0) - 3) {
                if (seen)
                    await publish(`As ${monsterName(monster, { state })} climbs the stairs, a mysterious force momentarily surrounds ${monsterObjectPronoun(monster, { state })}...`);
                destination = { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 };
                mode = MIGR_RANDOM;
            }
            else if (seen)
                await publish(`${subject()} escapes ${ladder ? `${stair.up ? 'up' : 'down'} the ladder` : `${stair.up ? 'up' : 'down'}stairs`}!`);
            await migrateMonsterOffLevel(monster, state, { dst: destination }, { mode });
            return spent();
        }
        case 'trap': {
            const trap = choice.trap;
            const hole = is_hole(trap.ttyp);
            if (hole && atBottom(state))
                return { nativeResult: 0, heroDied: false };
            await fleeForEscape(monster, options);
            const visible = cansee(monster.mx, monster.my);
            if (visible) {
                const name = subject();
                const verb = verbForSubject(name, monsterLocomotion(monster.mnum, 'jump'));
                await publish(`${name} ${verb} ${hole ? 'into' : 'onto'} a ${trapName(trap.ttyp, { state })}!`);
            }
            const cell = state.level.requireAt(trap.tx, trap.ty);
            if (cell.typ === SCORR) {
                cell.typ = CORR;
                cell.flags = 0;
                vision_note_blocker_change(trap.tx, trap.ty);
            }
            if (visible)
                await seeTrap(trap, state);
            // C remove_monster() empties the old square before redrawing it, even
            // when the monster was already standing on the trap.
            monster.mstate = (monster.mstate ?? 0) | MON_OFFMAP;
            await newsym(monster.mx, monster.my);
            await placeMonsterOnMap(monster, trap.tx, trap.ty);
            if (monster.wormno)
                await advanceMonsterWormBody(monster, { state, random, rollOne, rollDice });
            await maybeUnhideAt(monster.mx, monster.my, state);
            await newsym(monster.mx, monster.my);
            if (hole)
                await migrateMonsterOffLevel(monster, state, { dst: { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 } });
            else
                await teleportForEscape(monster, 0, seen, options, trap);
            return spent();
        }
    }
}
// ---------------------------------------------------------------------------
// C muse.c:rnd_defensive_item().
// ---------------------------------------------------------------------------
function rejectsRandomItem(monster) {
    const mndx = monster.mnum;
    const flags = MONSTER_FLAGS1[mndx] ?? 0;
    const symbol = MONSTER_SYMBOL[mndx];
    return !!(flags & (M1_ANIMAL | M1_MINDLESS))
        || (MONSTER_ATTACKS[mndx] || []).some(attack => attack[0] === AT_EXPL)
        || symbol === S_GHOST || monsterIsKop(mndx);
}
function wornHelmet(monster) {
    const inventory = monster?.minvent || monster?.inventory || [];
    return inventory.find(object => ((object.owornmask ?? 0) & W_ARMH) !== 0
        || object.wornSlot === 'helmet') || null;
}
export function randomDefensiveMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const symbol = MONSTER_SYMBOL[mndx];
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    let teleportTries = 0;
    for (;;) {
        switch (rn2(8 + Number(difficulty > 3) + Number(difficulty > 6)
            + Number(difficulty > 8))) {
            case 6:
            case 9:
                if (monsterTeleportRestricted(monster, game)
                    && ++teleportTries < 2)
                    continue;
                if (!rn2(3))
                    return WAN_TELEPORTATION;
                return SCR_TELEPORTATION;
            case 0:
            case 1:
                return SCR_TELEPORTATION;
            case 8:
            case 10:
                if (!rn2(3))
                    return WAN_CREATE_MONSTER;
                return SCR_CREATE_MONSTER;
            case 2:
                return SCR_CREATE_MONSTER;
            case 3:
                return POT_HEALING;
            case 4:
                return POT_EXTRA_HEALING;
            case 5:
                return mndx === PM_PESTILENCE
                    ? POT_SICKNESS : POT_FULL_HEALING;
            case 7:
                if (game.level?.flags?.sokoban_rules && rn2(4))
                    continue;
                if (symbol === 5 || symbol === 25
                    || monster.isshk || monster.isgd || monster.ispriest)
                    return 0;
                return WAN_DIGGING;
        }
    }
}
// ---------------------------------------------------------------------------
// C muse.c:m_use_undead_turning(): corpses inside carried containers do not
// count.
// ---------------------------------------------------------------------------
function undeadTurningHasCorpse(monster, state) {
    if (state.inventory.some(object => object.otyp === CORPSE))
        return true;
    const endX = state.u.ux + Math.sign((monster.mux ?? 0) - monster.mx) * 3;
    const endY = state.u.uy + Math.sign((monster.muy ?? 0) - monster.my) * 3;
    const dx = endX - monster.mx, dy = endY - monster.my;
    if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM)
        return false;
    let x = monster.mx, y = monster.my;
    do {
        x += Math.sign(dx);
        y += Math.sign(dy);
        if (blockingTerrain(state, x, y))
            return false;
        if ((state.level.objects[x]?.[y] ?? []).some(object => object.otyp === CORPSE))
            return true;
    } while (x !== endX || y !== endY);
    return false;
}
// ---------------------------------------------------------------------------
// C muse.c:hero_behind_chokepoint().
// ---------------------------------------------------------------------------
function heroBehindChokepoint(monster, state) {
    const dx = Math.sign(monster.mx - (monster.mux ?? 0));
    const dy = Math.sign(monster.my - (monster.muy ?? 0));
    const x = (monster.mux ?? 0) + dx, y = (monster.muy ?? 0) + dy;
    // Turning twice in the eight-direction ring rotates by ninety degrees.
    const leftX = x - dy, leftY = y + dx;
    const rightX = x + dy, rightY = y - dx;
    return (!isok(leftX, leftY) || !isAccessibleAt(leftX, leftY, state))
        && (!isok(rightX, rightY) || !isAccessibleAt(rightX, rightY, state));
}
// ---------------------------------------------------------------------------
// C muse.c:mon_has_friends().
// ---------------------------------------------------------------------------
function monsterHasFriends(monster, state) {
    if (monster.mtame || monster.mpeaceful)
        return false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = monster.mx + dx, y = monster.my + dy;
            if (!isok(x, y))
                continue;
            const friend = monsterAtPosition(state.level, x, y);
            if (friend && friend !== monster && !friend.mtame && !friend.mpeaceful)
                return true;
        }
    }
    return false;
}
// ---------------------------------------------------------------------------
// C muse.c:mon_likes_objpile_at().
// ---------------------------------------------------------------------------
function monsterLikesObjectPileAt(monster, x, y, state) {
    if (!isok(x, y))
        return false;
    const pile = state.level.objects[x]?.[y] ?? [];
    for (const object of pile.slice(0, 3))
        if (monsterWantsFloorObject(monster, object, state))
            return true;
    // The native loop counts three examined stacks, even if no fourth exists.
    return pile.length >= 3;
}
// ---------------------------------------------------------------------------
// C muse.c:find_offensive().
// ---------------------------------------------------------------------------
function heroIsNakedAndUnarmed(state) {
    return !(state.uwep || state.u.uwep || state.uarmu || state.u.uarmu
        || state.uarm || state.u.uarm || state.uarmh || state.u.uarmh
        || state.uarms || state.u.uarms || state.uarmg || state.u.uarmg
        || state.uarmc || state.u.uarmc || state.uarmf || state.u.uarmf);
}
function heroStandsOnStairway(state) {
    for (let stair = state.stairs; stair; stair = stair.next)
        if (stair.sx === state.u.ux && stair.sy === state.u.uy)
            return true;
    return false;
}
function sameLevel(left, right) {
    return !!right && left.dnum === right.dnum && left.dlevel === right.dlevel;
}
export function selectMonsterOffensiveItem(monster, state, { random = rn2 } = {}) {
    if (monster.mpeaceful || monsterIsAnimal(monster)
        || monsterIsMindless(monster.mnum) || monsterHasNoHands(monster.mnum)
        || state.u.uswallow || inHeroSanctuary(monster, 0, 0, state))
        return null;
    const attacks = MONSTER_ATTACKS[monster.mnum] ?? [];
    if (attacks.some(([, damage]) => damage === AD_HEAL) && heroIsNakedAndUnarmed(state))
        return null;
    if (!monsterLinedUpWithHero(monster, state, random))
        return null;
    const seen = monster.seen_resistance ?? 0;
    const distance = (monster.mx - (monster.mux ?? 0)) ** 2
        + (monster.my - (monster.muy ?? 0)) ** 2;
    const adjacent = distance < 3 && !(distance === 2 && monster.mnum === PM_GRID_BUG);
    const skipReflected = !!(seen & M_SEEN_REFL) || adjacent;
    const inventory = monster.minvent ?? monster.inventory ?? [];
    const helmet = inventory.find(object => (object.owornmask ?? 0) & W_ARMH);
    let choice = null;
    // Each native nomore() skips the rest of this inventory entry. Keep those
    // boundaries: later objects may replace a choice only before its check.
    for (const object of inventory) {
        const charged = object.spe > 0;
        if (!skipReflected) {
            if (choice?.object.otyp === WAN_DEATH)
                continue;
            if (object.otyp === WAN_DEATH && charged && !(seen & M_SEEN_MAGR))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === WAN_SLEEP)
                continue;
            if (object.otyp === WAN_SLEEP && charged && !heroHasInvoluntaryDelay(state) && !(seen & M_SEEN_SLEEP))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === WAN_FIRE)
                continue;
            if (object.otyp === WAN_FIRE && charged && !(seen & M_SEEN_FIRE))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === FIRE_HORN)
                continue;
            if (object.otyp === FIRE_HORN && charged && speciesCanBlow(monster.mnum) && !(seen & M_SEEN_FIRE))
                choice = { kind: 'horn', object };
            if (choice?.object.otyp === WAN_COLD)
                continue;
            if (object.otyp === WAN_COLD && charged && !(seen & M_SEEN_COLD))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === FROST_HORN)
                continue;
            if (object.otyp === FROST_HORN && charged && speciesCanBlow(monster.mnum) && !(seen & M_SEEN_COLD))
                choice = { kind: 'horn', object };
            if (choice?.object.otyp === WAN_LIGHTNING)
                continue;
            if (object.otyp === WAN_LIGHTNING && charged && !(seen & M_SEEN_ELEC))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === WAN_MAGIC_MISSILE)
                continue;
            if (object.otyp === WAN_MAGIC_MISSILE && charged && !(seen & M_SEEN_MAGR))
                choice = { kind: 'ray-wand', object };
        }
        if (choice?.object.otyp === WAN_UNDEAD_TURNING)
            continue;
        if (object.otyp === WAN_UNDEAD_TURNING && charged && undeadTurningHasCorpse(monster, state))
            choice = { kind: 'immediate-wand', object };
        if (choice?.object.otyp === WAN_STRIKING)
            continue;
        if (object.otyp === WAN_STRIKING && charged && !(seen & M_SEEN_MAGR))
            choice = { kind: 'immediate-wand', object };
        if (choice?.object.otyp === WAN_TELEPORTATION)
            continue;
        if (object.otyp === WAN_TELEPORTATION && charged && !heroControlsTeleport(state)
            && (!monsterTeleportRestricted(monster, state)
                || !((monster.mtrapseen ?? 0) & (1 << (TELEP_TRAP - 1))))
            && (monsterIsScaredAt(monster, state, state.u.ux, state.u.uy)
                || heroBehindChokepoint(monster, state) && monsterHasFriends(monster, state)
                || monsterLikesObjectPileAt(monster, state.u.ux, state.u.uy, state)
                || heroStandsOnStairway(state)))
            choice = { kind: 'immediate-wand', object };
        if (choice?.object.otyp === POT_PARALYSIS)
            continue;
        if (object.otyp === POT_PARALYSIS && !heroHasInvoluntaryDelay(state))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_BLINDNESS)
            continue;
        if (object.otyp === POT_BLINDNESS && !attacks.some(([method]) => method === AT_GAZE))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_CONFUSION)
            continue;
        if (object.otyp === POT_CONFUSION)
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_SLEEPING)
            continue;
        if (object.otyp === POT_SLEEPING && !(seen & M_SEEN_SLEEP))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_ACID)
            continue;
        if (object.otyp === POT_ACID && !(seen & M_SEEN_ACID))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === SCR_EARTH)
            continue;
        if (object.otyp === SCR_EARTH
            && (objectIsHardHelmet(helmet) || monster.mconf || monsterIsAmorphous(monster)
                || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK)
                || monsterIsNoncorporeal(monster) || monsterIsUnsolid(monster) || !random(10))
            && distance <= 2 && monster.mcansee
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
            && !sameLevel(state.u.uz, state.rogue_level)
            && (state.u.uz.dnum !== state.astral_level?.dnum || sameLevel(state.u.uz, state.earth_level)))
            choice = { kind: 'earth-scroll', object };
        if (choice?.object.otyp === EXPENSIVE_CAMERA)
            continue;
        if (object.otyp === EXPENSIVE_CAMERA
            && ((!heroIsBlind(state) && !heroResistsBlindingLight(state))
                || monsterHatesLight({ mnum: heroSpecies(state) }))
            && distance <= 2 && charged && !random(6))
            choice = { kind: 'camera', object };
    }
    return choice;
}
async function hitHeroWithImmediateWand(context) {
    const { state, source, wand, seen, rollOne, rollDice, publish } = context;
    switch (wand.otyp) {
        case WAN_STRIKING: {
            let learned = false;
            if (state.u.antimagic || propertyIsActive('antimagic', state)
                || heroHasArtifactDefense('magic', state)) {
                monstersObserveHeroResistance(M_SEEN_MAGR, state);
                await shieldeff(state.u.ux, state.u.uy, state);
                await publish('Boing!');
                learned = true;
            }
            else if (rollOne(20) < 10 + state.u.uac && source.mwandexp) {
                monstersForgetHeroResistance(M_SEEN_MAGR, state);
                await publish('The wand hits you!');
                const damage = rollDice(2, 12);
                if (await loseHeroHp(heroHasHalfSpellDamage(state) ? Math.ceil(damage / 2) : damage, 'wand', { state, publish }))
                    return;
                learned = true;
            }
            else
                await publish('The wand misses you.');
            await stopHeroOccupation(state);
            endVoluntaryMultiTurn(state);
            if (learned && seen)
                learnObjectType(wand.otyp, state);
            break;
        }
        case WAN_TELEPORTATION:
            await teleportHero({ chooseDestination: askTeleportDestination });
            if (!state.program_state.gameover && seen)
                learnObjectType(wand.otyp, state);
            break;
        case WAN_UNDEAD_TURNING:
            await turnHeroWithUndeadMagic(state, { roll: rollOne });
            if (!state.program_state.gameover && seen)
                learnObjectType(wand.otyp, state);
            break;
    }
}
async function hitMonsterWithImmediateWand(target, context) {
    const { state, wand, seen, rollOne, rollDice, publish } = context;
    let revealInvisible = false;
    if (wand.otyp !== WAN_UNDEAD_TURNING) {
        target.msleeping = 0;
        if (target.m_ap_type)
            await revealMonsterAppearance(target);
    }
    switch (wand.otyp) {
        case WAN_STRIKING: {
            revealInvisible = true;
            let learned = false;
            if (monsterHasMagicResistance(target)) {
                await shieldeff(target.mx, target.my, state);
                await publish('Boing!');
                learned = true;
            }
            else if (rollOne(20) < 10 + findMonsterArmorClass(target)) {
                const damage = rollDice(2, 12);
                await publish(rayHitMessage('wand', target, { state, x: target.mx, y: target.my, damage }));
                await damageMonsterWithWand(target, damage, true, context);
                learned = true;
            }
            else
                await publish(rayMissMessage('wand', target, { state, x: target.mx, y: target.my }));
            if (state.program_state.gameover)
                return;
            if (learned && seen && cansee(target.mx, target.my))
                learnObjectType(wand.otyp, state);
            break;
        }
        case WAN_TELEPORTATION:
            if (target.ispriest && roomsAt(state.level, target.mx, target.my, TEMPLE).length) {
                if (cansee(target.mx, target.my))
                    await publish(`${monsterName(target, { state, capitalized: true })} resists the magic!`);
            }
            else if (!await reportMonsterTeleportRestriction(target, { state, publish })) {
                await randomMonsterRelocation(target, {
                    state, random: context.random, rollOne, flags: RLOC_MSG,
                });
            }
            break;
        case WAN_UNDEAD_TURNING: {
            let wake = await turnCarriedObjects(target.minvent, state) > 0;
            if (monsterIsUndead(target.mnum) || monsterIsVampireShifter(target)) {
                wake = revealInvisible = true;
                state.context.bypasses = true;
                await damageMonsterWithWand(target, rollOne(8), false, context);
            }
            if (state.program_state.gameover)
                return;
            if (wake) {
                if (target.mhp > 0 && !target.dead)
                    await wakeMonster(target);
                if (seen)
                    learnObjectType(wand.otyp, state);
            }
            break;
        }
    }
    if (revealInvisible && target.mhp > 0 && !target.dead
        && cansee(state.bhitpos.x, state.bhitpos.y) && !canSpotMonster(target))
        await map_invisible(state.bhitpos.x, state.bhitpos.y);
}
async function damageMonsterWithWand(target, damage, tell, { state, random, rollDice, publish }) {
    if (monsterResistsEffect(target, 12, random)) {
        if (tell) {
            await shieldeff(target.mx, target.my, state);
            if (cansee(target.mx, target.my))
                await publish(`${monsterName(target, { state, capitalized: true })} resists!`);
        }
        damage = Math.ceil(damage / 2);
    }
    target.mhp -= damage;
    if (target.mhp <= 0)
        await finishMonsterKilled(target, state, { damageType: AD_RBRE, publish, random, rollDice });
}
// ---------------------------------------------------------------------------
// C muse.c:fhito_loc() and mbhit(). Immediate rays complete every contact
// before the item-use owner resumes the monster's turn.
// ---------------------------------------------------------------------------
export async function resolveMonsterImmediateWand(source, wand, { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    if (![WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING].includes(wand.otyp))
        throw new RangeError(`Unsupported monster immediate wand ${wand.otyp}`);
    const context = {
        state, source, wand, random, rollOne, rollDice, publish,
        seen: !!state.context.zap_oseen,
    };
    let range = random(8) + 6;
    const dx = Math.sign((source.mux ?? 0) - source.mx);
    const dy = Math.sign((source.muy ?? 0) - source.my);
    state.bhitpos = { x: source.mx, y: source.my };
    while (range-- > 0) {
        const x = state.bhitpos.x + dx, y = state.bhitpos.y + dy;
        if (!isok(x, y))
            break;
        state.bhitpos = { x, y };
        if (x === state.u.ux && y === state.u.uy) {
            await hitHeroWithImmediateWand(context);
            range -= 3;
        }
        else {
            const target = monsterAtPosition(state.level, x, y);
            if (target) {
                if (cansee(x, y) && !canSpotMonster(target))
                    await map_invisible(x, y);
                await hitMonsterWithImmediateWand(target, context);
                range -= 3;
            }
        }
        if (state.program_state.gameover)
            return { heroDied: true };
        if (await hitFloorObjects(context))
            range--;
        if (state.program_state.gameover)
            return { heroDied: true };
        // Native mbhit retains the terrain type from before door/bridge magic.
        const square = state.level.requireAt(state.bhitpos.x, state.bhitpos.y);
        const terrain = square.typ;
        const bridge = wand.otyp === WAN_STRIKING && terrain !== DRAWBRIDGE_UP
            ? findDrawbridgeAt(x, y, state) : null;
        if (bridge) {
            await destroyDrawbridge(bridge.x, bridge.y, state);
        }
        else if ((IS_DOOR(terrain) || terrain === SDOOR) && wand.otyp === WAN_STRIKING) {
            if (await changeDoorByMagic(wand, state.bhitpos.x, state.bhitpos.y, { state })) {
                if (context.seen)
                    learnObjectType(wand.otyp, state);
                if (square.doormask === D_BROKEN
                    && roomsAt(state.level, state.bhitpos.x, state.bhitpos.y, SHOPBASE).length)
                    addShopDamage(state.bhitpos.x, state.bhitpos.y, 0, state);
            }
        }
        if (state.program_state.gameover)
            return { heroDied: true };
        if (!ZAP_POS(terrain) || IS_DOOR(terrain) && !!(square.doormask & (D_LOCKED | D_CLOSED))) {
            state.bhitpos = { x: state.bhitpos.x - dx, y: state.bhitpos.y - dy };
            break;
        }
    }
    return { heroDied: false };
}
async function hitFloorObjects({ state, wand }) {
    const { x, y } = state.bhitpos;
    let affected = false;
    await sweepFloorPile(x, y, state, async (object) => {
        if (await hitObjectWithWand(object, wand, { state }))
            affected = true;
        return !state.program_state.gameover;
    });
    return affected;
}
// ---------------------------------------------------------------------------
// C muse.c:use_offensive(). Selection belongs to find_offensive(); each
// selected object is still carried until its own effect consumes or throws it.
// ---------------------------------------------------------------------------
export async function useMonsterOffensiveItem(monster, choice, options) {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    requireLiveGame(state);
    const object = choice.object;
    const forceMiss = !monster.mwandexp;
    if (object.oclass !== 8) {
        const backfire = await checkMonsterWandBackfire(monster, object, options);
        if (backfire.exploded)
            return { nativeResult: backfire.nativeResult, heroDied: backfire.heroDied };
    }
    const seen = canSeeMonster(monster);
    switch (choice.kind) {
        case 'ray-wand':
        case 'horn': {
            let rayType;
            let dice;
            if (choice.kind === 'ray-wand') {
                if (object.otyp < WAN_MAGIC_MISSILE || object.otyp > WAN_LIGHTNING)
                    throw new RangeError(`Selected offensive wand ${object.otyp} is not a ray wand`);
                await presentMonsterWandUse(monster, object, options);
                if (seen)
                    learnObjectType(object.otyp, state);
                rayType = object.otyp - WAN_MAGIC_MISSILE;
                dice = object.otyp === WAN_MAGIC_MISSILE ? 2 : 6;
            }
            else {
                if (object.otyp !== FIRE_HORN && object.otyp !== FROST_HORN)
                    throw new RangeError(`Selected offensive horn ${object.otyp} cannot emit a ray`);
                await presentMonsterHornUse(monster, object, options);
                rayType = object.otyp === FROST_HORN ? 2 : 1;
                dice = 6 + random(6);
            }
            const direction = aimedDirection(monster);
            const ray = await castNativeRay(-30 - rayType, dice, direction, {
                state, sourceMonster: monster, sourceObject: object,
                originX: monster.mx, originY: monster.my,
                publish, random, rollOne, rollDice, forceMiss,
            });
            if (!ray.heroDied)
                monster.mwandexp = true;
            return { nativeResult: monster.mhp <= 0 || monster.dead ? 1 : 2, heroDied: ray.heroDied };
        }
        case 'immediate-wand': {
            const previousSeen = state.context.zap_oseen;
            state.context.zap_oseen = seen;
            try {
                await presentMonsterWandUse(monster, object, options);
                const result = await resolveMonsterImmediateWand(monster, object, options);
                if (!result.heroDied && object.otyp === WAN_STRIKING)
                    monster.mwandexp = true;
                return { nativeResult: 2, heroDied: result.heroDied };
            }
            finally {
                if (previousSeen === undefined)
                    delete state.context.zap_oseen;
                else
                    state.context.zap_oseen = previousSeen;
            }
        }
        case 'potion': {
            if (cansee(monster.mx, monster.my)) {
                observeObject(object, state);
                const subject = monsterName(monster, { state, capitalized: true });
                observeObjectForNaming(object, { state });
                const name = await inventoryItemDescription({ ...object, quan: 1, quantity: 1 });
                await publish(`${subject} hurls ${name}!`);
            }
            const target = aimedPosition(monster);
            const shot = await throwMonsterProjectile(monster, object, {
                state, dx: Math.sign(target.x - monster.mx), dy: Math.sign(target.y - monster.my),
                range: distmin(monster.mx, monster.my, target.x, target.y),
                publish, random, rollOne, rollDice,
            });
            return { nativeResult: 2, heroDied: shot.heroDied };
        }
        case 'earth-scroll': return await readMonsterEarthScroll(monster, object, seen, options);
        case 'camera': return await photographHero(monster, object, options);
    }
}
// C muse.c:use_offensive() MUSE_SCR_EARTH.
async function readMonsterEarthScroll(monster, scroll, seen, options) {
    const { state, publish = plineWithContinuation } = options;
    const confused = !!monster.mconf;
    const x = monster.mx, y = monster.my;
    const cursed = !!scroll.cursed, blessed = !!scroll.blessed;
    await presentMonsterScrollRead(monster, scroll, options);
    if (canSpotMonster(monster)) {
        await publish(`The ${ceilingName(x, y, state)} rumbles ${blessed ? 'around' : 'above'} ${monsterName(monster, { state })}!`);
        if (seen)
            learnObjectType(scroll.otyp, state);
    }
    else if (cansee(x, y)) {
        await publish(`The ${ceilingName(x, y, state)} rumbles in the middle of nowhere!`);
        if (monster.minvis)
            await map_invisible(x, y);
        if (seen)
            learnObjectType(scroll.otyp, state);
    }
    // The caster can die under the central boulder. Consume before drops so
    // its death cannot put the used scroll back onto the floor.
    await consumeMonsterItem(monster, scroll, state);
    for (let column = x - 1; column <= x + 1; column++) {
        for (let row = y - 1; row <= y + 1; row++) {
            if (!isok(column, row) || column === state.u.ux && row === state.u.uy)
                continue;
            const location = state.level.at(column, row);
            if (!location || IS_OBSTRUCTED(location.typ) || IS_AIR(location.typ)
                || location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED)))
                continue;
            if (column === x && row === y ? blessed : cursed)
                continue;
            const drop = await dropBoulderOnMonster(column, row, { state, confused, heroCaused: false });
            if (drop.heroDied)
                return { nativeResult: 1, heroDied: true };
        }
    }
    if (distmin(x, y, state.u.ux, state.u.uy) === 1 && !cursed) {
        const drop = await dropBoulderOnHero({ state, confused, helmetProtects: true, heroCaused: false, skipSwallower: true });
        if (drop.heroDied)
            return { nativeResult: 1, heroDied: true };
    }
    return { nativeResult: monster.mhp <= 0 || monster.dead ? 1 : 2, heroDied: false };
}
// C muse.c:use_offensive() MUSE_CAMERA.
async function photographHero(monster, camera, { state, publish = plineWithContinuation, rollOne = rnd }) {
    if (heroIsHallucinating(state))
        await publish('"Say cheese!"');
    else if (!heroIsBlind(state)) {
        const subject = monsterName(monster, { state, capitalized: true });
        const name = withIndefiniteArticle(objectCombatName(camera, { state }));
        await publish(`${subject} takes a picture of you with ${name}!`);
    }
    if (!heroIsBlind(state) && !heroResistsBlindingLight(state)) {
        await publish('You are blinded by the flash of light!');
        await makeBlinded((state.u.blindTurns ?? 0) + rollOne(51), { state, talk: false, publish });
    }
    await lightDamage(camera, true, 5, { state });
    if (!state.program_state.gameover)
        camera.spe--;
    // Native use_offensive returns one here even if the photographer lives.
    return { nativeResult: 1, heroDied: !!state.program_state.gameover };
}
// The sgn(mux - mx)/sgn(muy - my) aim of use_offensive()'s rays and throws.
function aimedDirection(monster) {
    const target = aimedPosition(monster);
    const dx = Math.sign(target.x - monster.mx), dy = Math.sign(target.y - monster.my);
    if (dy < 0)
        return dx < 0 ? 'y' : dx > 0 ? 'u' : 'k';
    if (dy > 0)
        return dx < 0 ? 'b' : dx > 0 ? 'n' : 'j';
    return dx < 0 ? 'h' : dx > 0 ? 'l' : '>';
}
function aimedPosition(monster) {
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('An offensive item user must have its remembered hero position');
    return { x: monster.mux, y: monster.muy };
}
// ---------------------------------------------------------------------------
// C muse.c:rnd_offensive_item().
// ---------------------------------------------------------------------------
export function randomOffensiveMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty > 7 && !rn2(35))
        return WAN_DEATH;
    switch (rn2(9 - Number(difficulty < 4) + 4 * Number(difficulty > 6))) {
        case 0: {
            const flags = MONSTER_FLAGS1[mndx] ?? 0;
            if (objectIsHardHelmet(wornHelmet(monster))
                || (flags & (M1_AMORPHOUS | M1_WALLWALK | M1_UNSOLID))
                || MONSTER_SYMBOL[mndx] === S_GHOST)
                return SCR_EARTH;
            return WAN_STRIKING;
        }
        case 1:
            return WAN_STRIKING;
        case 2:
            return POT_ACID;
        case 3:
            return POT_CONFUSION;
        case 4:
            return POT_BLINDNESS;
        case 5:
            return POT_SLEEPING;
        case 6:
            return POT_PARALYSIS;
        case 7:
        case 8:
            return WAN_MAGIC_MISSILE;
        case 9:
            return WAN_SLEEP;
        case 10:
            return WAN_FIRE;
        case 11:
            return WAN_COLD;
        default:
            return WAN_LIGHTNING;
    }
}
// ---------------------------------------------------------------------------
// C muse.c:find_misc()/use_misc(): the discretionary item a monster takes
// out of its own inventory, and the state half of that use once its leading
// message has been presented.
// ---------------------------------------------------------------------------
async function heroCanReleaseWeapon(object, state) {
    return !!object && await canLetGo(object, '', state);
}
// C muse.c:use_misc() cursed potion of gain level: the drinker rises one
// level when it can leave through the ceiling from its own square.
export function monsterGainLevelRiseDestination(monster, state) {
    if (!canHeroRiseUp(monster.mx, monster.my, { state }))
        return null;
    const destination = levelAtDepth(depth(state.u.uz, state.dungeons) - 1, { state });
    return sameDungeonLevel(destination, state.u.uz) ? null : destination;
}
// C muse.c:find_misc().  JavaScript minvent mirrors the C chain
// head-to-tail.  Scan newest-to-oldest and retain each later viable type,
// exactly matching C's "last viable item wins" loop.
export async function useMonsterMiscItem(monster, state, random, calls) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & (M1_MINDLESS | M1_ANIMAL) ||
        dist2(monster.mx, monster.my, monster.mux ?? state?.u?.ux ?? monster.mx, monster.muy ?? state?.u?.uy ?? monster.my) > 36)
        return null;
    if (state.u.uswallow && state.u.ustuck === monster)
        return null;
    const inventory = monster.minvent || monster.inventory || [];
    const heroWeapon = state?.uwep || state?.u?.uwep || null;
    const heroSwapWeapon = state?.uswapwep || state?.u?.uswapwep || null;
    const apparentX = monster.mux ?? state?.u?.ux ?? monster.mx;
    const apparentY = monster.muy ?? state?.u?.uy ?? monster.my;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const heroSeesInvisible = heroCanSeeInvisible(state);
    const hasGaze = (MONSTER_ATTACKS[monster?.mnum] || []).some(([attackType]) => attackType === AT_GAZE);
    const stuck = state.u.ustuck === monster;
    const weak = (MONSTER_DIFFICULTY[monster.mnum] ?? 0) < 6;
    const naturalForm = (monster.cham ?? -1) < 0;
    if (!stuck && MONSTER_MOVE[monster.mnum] && !monster.mtrapped && naturalForm && weak
        && !inventory.some(object => !!((object.owornmask ?? 0) & W_ARMF)
            && objectMaterial(object.otyp) === IRON)) {
        for (let x = monster.mx - 1; x <= monster.mx + 1; x++) {
            for (let y = monster.my - 1; y <= monster.my + 1; y++) {
                if (!isok(x, y) || x === heroX && y === heroY
                    || MONSTER_NAME[monster.mnum] === 'grid bug' && x !== monster.mx && y !== monster.my
                    || monsterAt(state, x, y, monster))
                    continue;
                const ignoresBoulders = (MONSTER_SIZE[monster.mnum] ?? 0) < 1
                    || !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) || !!(flags & M1_WALLWALK);
                if (!ignoresBoulders && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER)
                    || monsterIsScaredAt(monster, state, x, y))
                    continue;
                const trap = trapAt(state, x, y);
                if (trap?.ttyp === POLY_TRAP)
                    return { kind: 'polymorph-trap', trap, deferredEffect: true };
            }
        }
    }
    if (flags & M1_NOHANDS)
        return null;
    let selected = null;
    for (let index = 0; index < inventory.length; index++) {
        const object = inventory[index];
        if (!object)
            continue;
        // muse.c:find_misc() lets a temple priest use an uncursed gain-level
        // potion, but rejects a cursed one so the resident cannot leave the
        // shrine level. Growth remains deferred across both mquaffmsg()
        // toplines.
        if (object.otyp === POT_GAIN_LEVEL &&
            (!object.cursed || (!monster.isgd && !monster.isshk && !monster.ispriest))) {
            selected = {
                kind: 'potion-gain-level',
                object,
                index,
                deferredEffect: true,
            };
        }
        if (selected?.kind === 'bullwhip-disarm')
            continue;
        if (object.otyp === BULLWHIP &&
            !monster.mpeaceful &&
            heroWeapon) {
            // Source ordering is intentional: rn2(5) precedes the wielded,
            // location, adjacency, and canletgo predicates.
            const attempt = recordRandom(random, calls, 5) === 0;
            if (attempt &&
                object === monster.mw &&
                apparentX === heroX &&
                apparentY === heroY &&
                distmin(monster.mx, monster.my, heroX, heroY) <= 1 &&
                !state?.u?.uswallow &&
                (await heroCanReleaseWeapon(heroWeapon, state) ||
                    (state?.u?.twoweap && await heroCanReleaseWeapon(heroSwapWeapon, state)))) {
                selected = {
                    kind: 'bullwhip-disarm',
                    object,
                    index,
                    heroWeapon,
                    heroSwapWeapon,
                };
            }
        }
        if (selected?.kind === 'wand-invisibility')
            continue;
        if (object.otyp === WAN_MAKE_INVISIBLE && object.spe > 0 && !monster.minvis
            && !monster.invis_blkd && (!monster.mpeaceful || heroSeesInvisible)
            && (!hasGaze || monster.mcan))
            selected = { kind: 'wand-invisibility', object, index, deferredEffect: true };
        if (selected?.kind === 'potion-invisibility')
            continue;
        if (object.otyp === POT_INVISIBILITY &&
            !monster.minvis &&
            !monster.invis_blkd &&
            (!monster.mpeaceful || heroSeesInvisible) &&
            (!hasGaze || monster.mcan)) {
            selected = { kind: 'potion-invisibility', object, index };
        }
        if (selected?.kind === 'wand-speed-monster')
            continue;
        if (object.otyp === WAN_SPEED_MONSTER &&
            (object.spe ?? 0) > 0 &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'wand-speed-monster', object, index };
        }
        if (selected?.kind === 'potion-speed')
            continue;
        if (object.otyp === POT_SPEED &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'potion-speed', object, index };
        }
        if (selected?.kind === 'wand-polymorph')
            continue;
        if (object.otyp === WAN_POLYMORPH && object.spe > 0 && naturalForm && weak)
            selected = { kind: 'wand-polymorph', object, index, deferredEffect: true };
        if (selected?.kind === 'potion-polymorph')
            continue;
        if (object.otyp === POT_POLYMORPH && naturalForm && weak)
            selected = { kind: 'potion-polymorph', object, index, deferredEffect: true };
        if (selected?.kind === 'container')
            continue;
        if (isContainer(object) && object.otyp !== BAG_OF_TRICKS && !recordRandom(random, calls, 5)
            && !isQuantumBox(object) && !selected && object.contents?.length && !object.olocked && !object.otrapped)
            selected = { kind: 'container', object, index, deferredEffect: true };
    }
    if (!selected)
        return null;
    const precheck = await prepareMonsterItemUse(monster, selected.object, { state, random });
    if (precheck)
        return { kind: 'item-result', object: selected.object, index: selected.index, ...precheck };
    if (selected.kind === 'container') {
        const removed = await lootMonsterContainer(monster, selected.object, { state, random });
        return { kind: 'item-result', object: selected.object, index: selected.index, nativeResult: removed ? 2 : 0, heroDied: false };
    }
    if (selected.kind === 'wand-invisibility'
        || selected.kind === 'wand-polymorph' || selected.kind === 'potion-polymorph')
        return selected;
    if (selected.kind === 'potion-gain-level')
        return selected;
    if (selected.kind === 'potion-invisibility') {
        // mquaffmsg() can suspend on an older topline.  allmain applies the
        // state change and consumes the potion only after that await resumes.
        return { ...selected, deferredEffect: true };
    }
    if (selected.kind === 'bullwhip-disarm') {
        // use_misc() chooses the destination before any two-weapon target
        // selection.  Removal itself follows the urgent wrap message.
        const whereTo = recordRandom(random, calls, 4);
        let target = selected.heroWeapon;
        if (!await heroCanReleaseWeapon(target, state) ||
            (state?.u?.twoweap &&
                await heroCanReleaseWeapon(selected.heroSwapWeapon, state) &&
                recordRandom(random, calls, 2))) {
            target = selected.heroSwapWeapon;
        }
        return {
            ...selected,
            target,
            whereTo,
            deferredEffect: true,
        };
    }
    const { object } = selected;
    const wand = object.otyp === WAN_SPEED_MONSTER;
    return {
        ...selected,
        kind: wand ? 'wand-speed-monster' : 'potion-speed',
        deferredEffect: true,
    };
}
// ---------------------------------------------------------------------------
// C muse.c:mloot_container(). Removal precedes the carry check so a carried
// container's contents are not counted twice against the monster's load.
// ---------------------------------------------------------------------------
export async function lootMonsterContainer(monster, container, { state, random = rn2, publish = plineWithContinuation, }) {
    if (!container.contents?.length || container.olocked || isQuantumBox(container)
        || container.otyp === BAG_OF_HOLDING && container.cursed)
        return false;
    const roll = random(10);
    const count = roll < 4 ? 1 : roll < 7 ? 2 : roll < 9 ? 3 : 4;
    const distance = dist2(monster.mx, monster.my, state.u.ux, state.u.uy);
    const visible = canSeeMonster(monster);
    const pronoun = visible ? monsterSubjectPronoun(monster, { state }) : '';
    let name = '';
    let removed = false;
    for (let index = 0; index < count; index++) {
        const contents = container.contents;
        if (!contents?.length || !random(contents.length + 1))
            break;
        const object = contents[random(contents.length)];
        if (!object)
            throw new Error('Monster container selection exceeded its contents');
        container.cknown = false;
        if (!name) {
            if (distance <= 49)
                observeObjectForNaming(container, { state });
            else
                observeDistantObjectForNaming(container, state);
            name = objectName(container, state);
            if (container.quan !== 1)
                name = pluralizeObjectNoun(container, name);
            name = withIndefiniteArticle(name);
        }
        unlinkObject(object, state);
        if (monsterCanCarryObject(monster, object, state, random)) {
            if (visible) {
                const subject = () => monsterName(monster, { state, capitalized: true });
                if (distance > 2)
                    await publish(`${subject()} rummages through ${name}.`, { noRepeat: true });
                else {
                    observeObjectForNaming(object, { state });
                    if (!index)
                        await publish(`${subject()} removes ${await inventoryItemDescription(object)} from ${name}.`);
                    else
                        await publish(`${pronoun.charAt(0).toUpperCase() + pronoun.slice(1)} removes ${await inventoryItemDescription(object)}.`);
                }
            }
            if (container.otyp === ICE_BOX)
                thawObject(object, state);
            await addObjectToMonsterInventory(monster, object, state);
            removed = true;
        }
        else {
            const noMerge = object.nomerge;
            const empty = !container.contents?.length;
            object.nomerge = true;
            await addObjectToContainer(container, object, state);
            if (noMerge === undefined)
                delete object.nomerge;
            else
                object.nomerge = noMerge;
            container.owt = objectWeight(container);
            if (empty)
                break;
        }
    }
    return removed;
}
// ---------------------------------------------------------------------------
// C muse.c:use_misc(MUSE_BULLWHIP). The weapon is detached before the yank
// announcement, then placed only after that message has returned.
// ---------------------------------------------------------------------------
export async function useMonsterBullwhip(monster, target, destination, state) {
    const seen = canSeeMonster(monster);
    const whip = seen ? 'The bullwhip' : 'A whip';
    const weapon = definiteName(objectCombatName(target, { state, includeCorpseSpecies: false }), state);
    const hand = heroHandName(state);
    const hands = isBimanualObject(target) ? makePlural(hand) : hand;
    if (seen)
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} flicks a bullwhip towards your ${hands}!`);
    if (target.otyp === HEAVY_IRON_BALL) {
        await plineWithContinuation(`${whip} fails to wrap around ${weapon}.`);
        return;
    }
    await plineWithContinuation(`${whip} wraps around ${weapon} you're wielding!`, { urgent: true });
    if (isWeldedPrimary(target, state)) {
        // welded() discovers the curse before the native punctuation test.
        target.bknown = true;
        await plineWithContinuation(`${objectNameIsPlural(target, state) ? 'They are' : 'It is'} welded to your ${hands}.`);
        destination = 0;
    }
    if (!destination) {
        await plineWithContinuation('The whip slips free.');
        return;
    }
    if (destination === 3 && monsterHatesSilver(monster) && objectMaterial(target, state) === SILVER)
        destination = 2;
    await removeWornHeroItem(target, state);
    if (state.program_state.gameover)
        return;
    unlinkObject(target, state);
    await finishInventoryRemoval(target, state);
    if (state.program_state.gameover)
        return;
    const subject = monsterName(monster, { state, capitalized: true });
    if (destination === 1) {
        await plineWithContinuation(`${subject} yanks ${weapon} from your ${hands}!`);
        placeObjectSynchronously(target, monster.mx, monster.my, state);
    }
    else if (destination === 2) {
        await plineWithContinuation(`${subject} yanks ${weapon} to the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
        await dropObjectAtHero(target, { state });
    }
    else {
        await plineWithContinuation(`${subject} snatches ${weapon}!`);
        await addObjectToMonsterInventory(monster, target, state);
    }
}
// Complete the state half of a miscellaneous action only after its leading
// tty message has returned.  This preserves use_misc() suspension boundaries.
export async function finishDeferredMonsterMiscItem(action, state = requireInitializedGame()) {
    const monster = action?.monster;
    const misc = action?.movement?.usedMisc;
    if (!monster || !misc?.deferredEffect || misc.effectApplied)
        return misc;
    if (misc.kind === 'polymorph-trap') {
        const trapVisible = cansee(misc.trap.tx, misc.trap.ty);
        if (cansee(monster.mx, monster.my) || trapVisible)
            await seeTrap(misc.trap, state);
        if (canSeeMonster(monster) || trapVisible) {
            const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
            const verb = verbForSubject(subject, monsterLocomotion(monster.mnum, 'jump'));
            await plineWithContinuation(`${subject} deliberately ${verb} onto a ${misc.trap.tseen ? trapName(misc.trap.ttyp, { state }) : 'hidden trap'}!`);
        }
        const oldx = monster.mx, oldy = monster.my;
        // use_misc() removes even a monster already standing on the trap.
        removeMonsterFromMapAt(oldx, oldy, state);
        await newsym(oldx, oldy);
        await placeMonsterOnMap(monster, misc.trap.tx, misc.trap.ty, state);
        await maybeUnhideAt(monster.mx, monster.my, state);
        if (monster.wormno)
            await advanceMonsterWormBody(monster, { state });
        await newsym(monster.mx, monster.my);
        await changeMonsterForm(monster, null, state, { showMessage: true });
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'wand-polymorph' || misc.kind === 'potion-polymorph') {
        const seen = canSeeMonster(monster);
        if (misc.kind === 'wand-polymorph')
            await presentMonsterWandUse(monster, misc.object, { state, self: true });
        else {
            await presentMonsterQuaff(monster, misc.object, { state });
            await consumeMonsterItem(monster, misc.object, state);
            if (seen)
                await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} suddenly mutates!`);
        }
        const armor = (monster.minvent || []).find(object => !!((object.owornmask ?? 0) & W_ARM));
        const target = dragonFormForArmor(armor) ?? rndmonstAdj();
        await changeMonsterForm(monster, target, state, { showMessage: true, polyspot: misc.kind === 'wand-polymorph' });
        if (seen)
            learnObjectType(misc.object.otyp, state);
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'potion-invisibility' || misc.kind === 'wand-invisibility') {
        setMonsterPermanentInvisibility(monster, !misc.object.cursed);
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'potion-gain-level') {
        await consumeMonsterItem(monster, misc.object, state);
        if (misc.object.cursed) {
            if (misc.riseDestination)
                await migrateMonsterOffLevel(monster, state, { dst: misc.riseDestination });
            misc.effectApplied = true;
            return misc;
        }
        misc.growth = growMonster(monster, {
            state,
            rollOne: rnd,
            random: rn2,
            calls: action.calls,
        });
        if (misc.growth.maxIncrease !== undefined)
            misc.increase = misc.growth.maxIncrease;
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'wand-speed-monster' || misc.kind === 'potion-speed') {
        const speed = adjustMonsterSpeed(monster, 1);
        misc.oldSpeed = speed.oldSpeed;
        misc.speedChanged = speed.changed && speed.canDescribe && !state.in_mklev;
        misc.speedMuch = speed.much;
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'bullwhip-disarm') {
        const target = misc.target;
        if (target)
            await useMonsterBullwhip(monster, target, misc.whereTo ?? 0, state);
        misc.effectApplied = true;
    }
    return misc;
}
// ---------------------------------------------------------------------------
// C muse.c:you_aggravate(). The temporary revelation is acknowledged before
// the potion is consumed or another monster can act.
// ---------------------------------------------------------------------------
export async function revealAggravatingMonster(monster, state) {
    const owner = possessiveName(monsterName(monster, { state, article: 'your', suppressIt: true }));
    await plineWithContinuation(`For some reason, ${owner} presence is known to you.`);
    await cls();
    const glyph = transientMonsterGlyph(monster);
    await show_glyph_cell(monster.mx, monster.my, glyph.ch, glyph.color, glyph.decgfx, 0, glyph);
    await displaySelf();
    await plineWithContinuation(formatFeltMessage(`aggravated at ${monsterName(monster, { state, article: 'your', suppressIt: true })}.`, state));
    await displayMessageWindow();
    await docrt();
    if (heroIsUnconscious(state)) {
        setMulti(-1, state);
        state._helplessDoneMessage = 'Aggravated, you are jolted into full consciousness.';
    }
    await newsym(monster.mx, monster.my);
    if (!canSpotMonster(monster))
        await map_invisible(monster.mx, monster.my);
}
// ---------------------------------------------------------------------------
// C muse.c:rnd_misc_item().
// ---------------------------------------------------------------------------
export function randomMiscMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty < 6 && !rn2(30))
        return rn2(6) ? POT_POLYMORPH : WAN_POLYMORPH;
    if (!rn2(40) && !monsterIsNonliving(mndx) && !monsterIsVampireShifter(monster))
        return AMULET_OF_LIFE_SAVING;
    switch (rn2(3)) {
        case 0:
            if (monster.isgd)
                return 0;
            return rn2(6) ? POT_SPEED : WAN_SPEED_MONSTER;
        case 1: {
            const seesInvisible = !!(game.u?.seeInvisible
                || (game.u?.seeInvisibleTurns ?? 0) > 0);
            if (monster.mpeaceful && !seesInvisible)
                return 0;
            return rn2(6) ? POT_INVISIBILITY : WAN_MAKE_INVISIBLE;
        }
        default:
            return POT_GAIN_LEVEL;
    }
}
// ---------------------------------------------------------------------------
// C muse.c:searches_for_item(). Wanting an item is separate from
// can_carry()/can_touch_safely(): callers must still check whether the
// monster can reach, touch, and carry it.
// ---------------------------------------------------------------------------
export function monsterSearchesForItem(monster, object, state) {
    if (object.where === 'floor' && object.ox === monster.mx && object.oy === monster.my
        && monsterIsScaredAt(monster, state, object.ox, object.oy))
        return false;
    if (monsterIsAnimal(monster) || monsterIsMindless(monster.mnum) || monster.mnum === PM_GHOST)
        return false;
    const type = object.otyp;
    const gaze = (MONSTER_ATTACKS[monster.mnum] ?? []).some(attack => attack[0] === AT_GAZE);
    // These two decisions precede the charged-wand check in native code.
    if (type === WAN_MAKE_INVISIBLE || type === POT_INVISIBILITY)
        return !monster.minvis && !monster.invis_blkd && !gaze;
    if (type === WAN_SPEED_MONSTER || type === POT_SPEED)
        return monster.mspeed !== MFAST;
    switch (object.oclass) {
        case WAND_CLASS:
            if (object.spe <= 0)
                return false;
            if (type === WAN_DIGGING)
                return MONSTER_SYMBOL[monster.mnum] !== S_EYE && MONSTER_SYMBOL[monster.mnum] !== S_LIGHT;
            if (type === WAN_POLYMORPH)
                return (MONSTER_DIFFICULTY[monster.mnum] ?? 0) < 6;
            return OBJECT_DIR[type] === RAY || type === WAN_STRIKING || type === WAN_UNDEAD_TURNING
                || type === WAN_TELEPORTATION || type === WAN_CREATE_MONSTER;
        case POTION_CLASS:
            return [POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_POLYMORPH, POT_GAIN_LEVEL,
                POT_PARALYSIS, POT_SLEEPING, POT_ACID, POT_CONFUSION].includes(type)
                || (type === POT_BLINDNESS && !gaze);
        case SCROLL_CLASS:
            return [SCR_TELEPORTATION, SCR_CREATE_MONSTER, SCR_EARTH, SCR_FIRE].includes(type);
        case AMULET_CLASS:
            if (type === AMULET_OF_LIFE_SAVING)
                return !monsterIsNonliving(monster.mnum) && !monsterIsVampireShifter(monster);
            return type === AMULET_OF_REFLECTION || type === AMULET_OF_GUARDING;
        case TOOL_CLASS:
            if (type === PICK_AXE)
                return !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NEEDPICK);
            if (type === UNICORN_HORN)
                return !object.cursed && !monsterIsUnicorn(monster.mnum) && monster.mnum !== PM_KI_RIN;
            if (type === FROST_HORN || type === FIRE_HORN)
                return object.spe > 0 && speciesCanBlow(monster.mnum);
            // Is_container includes the bag of tricks even though it cannot be
            // opened by the hero's ordinary container interaction.
            if (type >= LARGE_BOX && type <= BAG_OF_TRICKS)
                return !object.olocked && !((type === BAG_OF_HOLDING || type === BAG_OF_TRICKS) && object.cursed);
            return type === EXPENSIVE_CAMERA && object.spe > 0;
        case FOOD_CLASS:
            if (type === CORPSE)
                return (!!((monster.misc_worn_check ?? 0) & W_ARMG) && touchPetrifies(object.corpsenm))
                    || (!monsterHasStoneResistance(monster) && curesStoning(monster, object, false));
            if (type === TIN)
                return monsterCanOpenTin(monster) && !monsterHasStoneResistance(monster)
                    && curesStoning(monster, object, true);
            return type === EGG && object.corpsenm !== undefined && ismnum(object.corpsenm)
                && touchPetrifies(object.corpsenm);
        default:
            return false;
    }
}
// ---------------------------------------------------------------------------
// C muse.c:mcureblindness().
// ---------------------------------------------------------------------------
async function cureMonsterBlindness(monster, seen, options) {
    monster.mcansee = 1;
    monster.mblinded = 0;
    if (seen && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES))
        await (options.publish ?? plineWithContinuation)(`${monsterName(monster, { state: options.state, capitalized: true })} can see again.`);
}
// C muse.c:mcould_eat_tin().
export function monsterCanOpenTin(monster) {
    if (monsterIsAnimal(monster))
        return false;
    const inventory = monster.minvent || monster.inventory || [];
    const wielded = monsterWieldedWeapon(monster);
    const opensTin = (object) => object.otyp === TIN_OPENER
        || (object.oclass === 2 && [P_DAGGER, P_KNIFE].includes(OBJECT_SUBTYPE[object.otyp] ?? 0));
    if (wielded && ((wielded.owornmask ?? 0) & W_WEP) && willWeld(wielded))
        return inventory.includes(wielded) && opensTin(wielded);
    return inventory.some(opensTin);
}
// C muse.c:cures_stoning().
function corpseCuresStoning(object) {
    if (object.corpsenm === undefined
        || !Number.isInteger(object.corpsenm) || object.corpsenm < 0)
        return false;
    return object.corpsenm === PM_LIZARD
        || !!((MONSTER_FLAGS1[object.corpsenm] ?? 0) & M1_ACID);
}
export function curesStoning(monster, object, tinCanBeOpened) {
    if (object?.otyp === POT_ACID)
        return true;
    if (object?.otyp === GLOB_OF_GREEN_SLIME)
        return monsterIsSlimeproof(monster);
    if (object?.otyp === CORPSE)
        return corpseCuresStoning(object);
    return object?.otyp === TIN && tinCanBeOpened
        && corpseCuresStoning(object);
}
// C muse.c:mon_consume_unstone()'s m_useup() step.
async function consumeOneCure(monster, object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        await destroyObjectFromMonsterInventory(monster, object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
    monster.hasInventory = true;
}
// The visible quaff/eat or heard drinking/chewing half of
// mon_consume_unstone().
async function describeCure(monster, cure, visible, state, publish) {
    if (visible) {
        const tinned = cure.otyp === TIN;
        const verb = cure.otyp === POT_ACID
            ? 'quaffs' : tinned ? 'opens and eats the contents of' : 'eats';
        const subject = monsterName(monster, { state, capitalized: true });
        const name = await distantObjectName(cure, async (object) => (await inventoryItemDescription({
            ...object, quan: 1, quantity: 1,
        })), state);
        await publish(`${subject} ${verb} ${name}.`);
    }
    else if (!heroIsDeaf(state)) {
        const heard = formatHeardMessage(cure.otyp === POT_ACID ? 'drinking.' : 'chewing.', state);
        if (heard)
            await publish(heard);
    }
}
// C muse.c:munstone(). TRUE if the monster ate something.
export async function useMonsterStoningCure(monster, { byHero = false, publish = plineWithContinuation, rollOne = rnd, state = game, } = {}) {
    if (monsterHasStoneResistance(monster) || monster.meating || monsterIsHelpless(monster)) {
        return { consumed: false, died: false };
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const tinCanBeOpened = monsterCanOpenTin(monster);
    const inventory = monster.minvent || monster.inventory || [];
    const cure = inventory.find(object => curesStoning(monster, object, tinCanBeOpened));
    if (!cure)
        return { consumed: false, died: false };
    return consumeMonsterStoningCure(monster, cure, { byHero, publish, rollOne, state, stoning: true });
}
// C muse.c:mon_consume_unstone().
export async function consumeMonsterStoningCure(monster, cure, { byHero = false, publish = plineWithContinuation, rollOne = rnd, state = game, stoning, }) {
    const visible = canSeeMonster(monster);
    const tinned = cure.otyp === TIN;
    const food = cure.otyp === CORPSE || tinned;
    const acidic = cure.otyp === POT_ACID
        || (food && cure.corpsenm !== undefined
            && !!((MONSTER_FLAGS1[cure.corpsenm] ?? 0) & M1_ACID));
    const lizard = food && cure.corpsenm === PM_LIZARD;
    const nutrition = food ? petFoodNutrition(monster, cure) : 0;
    if (stoning) {
        const speed = adjustMonsterSpeed(monster, -3);
        if (visible && state.flags.verbose && !state.in_mklev && speed.canDescribe) {
            const speedMessage = monsterSpeedMessage(speed, monsterName(monster, { state, capitalized: true }));
            if (speedMessage)
                await publish(speedMessage);
        }
    }
    await describeCure(monster, cure, visible, state, publish);
    await consumeOneCure(monster, cure, state);
    if (acidic && !tinned && !monsterHasAcidResistance(monster)) {
        monster.mhp -= rollOne(15);
        if (visible) {
            await publish(`${monsterName(monster, { state, capitalized: true })} has a very bad case of stomach acid.`);
        }
        if (monster.mhp <= 0) {
            await publish(`${monsterName(monster, { state, capitalized: true })} dies!`);
            const death = byHero
                ? await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
                    showKillMessage: false, recordConduct: false, publish,
                })
                : await finishEnvironmentalMonsterDeath(monster, state, { noCorpse: true, publish });
            return { consumed: true, cure, died: monster.mhp <= 0 || !!monster.dead, heroDied: !!death.heroDied };
        }
    }
    if (stoning && visible) {
        const hallucinating = heroIsHallucinating(state);
        await publish(hallucinating
            ? `What a pity - ${monsterName(monster, { state })} just ruined `
                + 'a future piece of art!'
            : `${monsterName(monster, { state, capitalized: true })} seems limber!`);
    }
    if (lizard && (monster.mconf || monster.mstun)) {
        monster.mconf = 0;
        monster.mstun = 0;
        if (visible && !monsterIsBat(monster.mnum) && monster.mnum !== PM_STALKER)
            await publish(`${monsterName(monster, { state, capitalized: true })} seems steadier now.`);
    }
    if (monster.mtame && !monster.isminion && nutrition > 0) {
        extendPetHungerDeadline(monster, nutrition, state);
    }
    monster.movement = (monster.movement ?? 0) - NORMAL_SPEED;
    monster.mlstmv = state.moves ?? 0;
    return { consumed: true, cure, died: false };
}
// C muse.c:munslime() and muse_unslime(): select the cure, then apply it.
export async function tryMonsterUnslime(monster, { state = game, byHero = false, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    if (monsterIsSlimeproof(monster) || monster.meating || monsterIsHelpless(monster))
        return { cured: false, heroDied: false };
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const cure = selectSlimeCure(monster, state, random);
    if (!cure)
        return { cured: false, heroDied: false };
    const context = { state, byHero, publish, random, rollDice, rollOne };
    let visible = canSeeMonster(monster);
    if (visible) {
        const subject = monsterName(monster, { state, capitalized: true });
        // C muse.c:green_mon() judges green by the display color;
        // hcolor(NH_GREEN) names the color, hallucination included.
        const green = !heroIsHallucinating(state)
            && [CLR_GREEN, CLR_BRIGHT_GREEN].includes(MONSTER_COLOR[monster.mnum] ?? -1);
        await publish(`${subject} starts turning ${green ? 'into ooze' : displayColorName('green', state)}.`);
    }
    adjustMonsterSpeed(monster, -4);
    let damage = 0;
    let cured = true;
    if (cure.kind === 'trap') {
        await triggerCureTrap(monster, cure.trap, visible, context);
    }
    else if (cure.kind === 'breath') {
        if (visible) {
            const name = monsterName(monster, { state, capitalized: true });
            await publish(`${monsterReflexiveAction(monster, name, 'breath', 'fire on', { state })}.`);
        }
        if (random(3) === 0)
            monster.mspec_used = random(10) + 5;
        damage = await hitMonsterWithRay(monster, byHero ? 21 : -21, 1, context);
    }
    else if (cure.object.otyp === SCR_FIRE) {
        await presentMonsterScrollRead(monster, cure.object, context);
        if (monster.mconf) {
            if (cansee(monster.mx, monster.my))
                await publish('Oh, what a pretty fire!');
            if (visible)
                await tryCallObjectType(cure.object, state);
            await consumeMonsterItem(monster, cure.object, state);
            visible = false;
            cured = false;
        }
        else {
            const sign = cure.object.blessed ? 1 : cure.object.cursed ? -1 : 0;
            const blastDamage = Math.trunc((2 * (random(3) + 3 + 2 * sign) + 1) / 3);
            await consumeMonsterItem(monster, cure.object, state);
            const blast = await explode(monster.mx, monster.my, -11, blastDamage, SCROLL_CLASS, byHero ? -EXPL_FIERY : EXPL_FIERY, { state, publish, random, heroCaused: false });
            if (blast.heroDied)
                return { cured, heroDied: true };
        }
    }
    else if (cure.object.otyp === POT_OIL) {
        const oil = splitOilPotion(cure.object, state);
        const wasLit = !!oil.lamplit;
        const sawLighting = visible && !wasLit;
        if (sawLighting) {
            const name = monsterName(monster, { state, capitalized: true });
            await publish(`${name} ignites ${withIndefiniteArticle(minimalObjectName(oil, state))}.`);
        }
        beginObjectBurn(oil, state);
        visible ||= canSeeMonster(monster);
        if (visible) {
            if (!heroIsUnaware(state))
                observeObject(oil, state);
            const subject = sawLighting ? capitalize(monsterSubjectPronoun(monster, { state }))
                : monsterName(monster, { state, capitalized: true });
            await publish(`${subject} quaffs a burning ${minimalObjectName(oil, state)}`);
            learnObjectType(POT_OIL, state);
        }
        // Pinned muse_unslime draws oil damage for feedback without subtracting HP.
        damage = rollDice(3, 4);
        await consumeMonsterItem(monster, oil, state);
    }
    else {
        if (cure.object.otyp === FIRE_HORN)
            await presentMonsterHornUse(monster, cure.object, { ...context, self: true });
        else
            await presentMonsterWandUse(monster, cure.object, { ...context, self: true });
        damage = await hitMonsterWithRay(monster, byHero ? 1 : -1, 2, context);
    }
    if (state.program_state.gameover)
        return { cured, heroDied: true };
    if (damage) {
        if (monster.mhp <= 0) {
            if (byHero) {
                if (visible)
                    await publish(`${monsterName(monster, { state, capitalized: true })} is ${monsterIsNonliving(monster.mnum) ? 'destroyed' : 'killed'} by the fire!`);
                const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
                    showKillMessage: false, recordConduct: false, publish,
                });
                if (death.heroDied)
                    return { cured, heroDied: true };
            }
            else {
                const death = await finishMonsterKilled(monster, state, {
                    damageType: AD_FIRE, cause: 'fire', publish, random, rollDice,
                });
                if (death.heroDied)
                    return { cured, heroDied: true };
            }
        }
        else if (visible) {
            await publish(`${monsterName(monster, { state, capitalized: true })} is burned${damage <= 4 ? '.' : '!'}`);
        }
    }
    if (visible) {
        if (cured && monster.mhp > 0)
            await publish(`${possessiveName(monsterName(monster, { state, capitalized: true }))} slime is burned away!`);
        if (cure.kind === 'item')
            learnObjectType(cure.object.otyp, state);
    }
    monster.movement = (monster.movement ?? 0) - NORMAL_SPEED;
    monster.mlstmv = state.moves;
    return { cured, heroDied: false };
}
// The item, breath, and fire-trap scan of munslime().
function selectSlimeCure(monster, state, random) {
    if (!monster.mcan && !monster.mspec_used
        && MONSTER_ATTACKS[monster.mnum]?.some(([method, damage]) => method === AT_BREA && damage === AD_FIRE))
        return { kind: 'breath' };
    if (monsterIsAnimal(monster) || monsterIsMindless(monster.mnum))
        return null;
    const object = (monster.minvent || monster.inventory || []).find(candidate => itemCuresSliming(monster, candidate));
    if (object)
        return { kind: 'item', object };
    const here = state.level.traps.find(trap => trap.tx === monster.mx && trap.ty === monster.my);
    if (here?.ttyp === FIRE_TRAP)
        return { kind: 'trap', trap: here };
    if (!MONSTER_MOVE[monster.mnum] || monster.mtrapped)
        return null;
    const nearby = [];
    for (let x = monster.mx - 1; x <= monster.mx + 1; x++) {
        for (let y = monster.my - 1; y <= monster.my + 1; y++) {
            if (isok(x, y) && isAccessibleAt(x, y, state)
                && !monsterAtPosition(state.level, x, y)
                && (x !== state.u.ux || y !== state.u.uy))
                nearby.push({ x, y });
        }
    }
    for (let index = 0; index < nearby.length; index++) {
        const picked = index + random(nearby.length - index);
        const point = nearby[picked];
        const previous = nearby[index];
        if (!point || !previous)
            throw new RangeError('Slime-cure trap selection left its candidate range');
        nearby[index] = point;
        nearby[picked] = previous;
        const trap = state.level.traps.find(candidate => candidate.tx === point.x && candidate.ty === point.y);
        if (trap?.ttyp === FIRE_TRAP)
            return { kind: 'trap', trap };
    }
    return null;
}
// C muse.c:cures_sliming().
function itemCuresSliming(monster, object) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (object.otyp === SCR_FIRE)
        return !(flags & (M1_NOEYES | M1_NOHANDS)) && !!monster.mcansee;
    if (object.otyp === POT_OIL)
        return !(flags & M1_NOHANDS);
    return object.spe > 0 && (object.otyp === WAN_FIRE
        || object.otyp === FIRE_HORN && speciesCanBlow(monster.mnum));
}
// The trap branch of muse_unslime().
async function triggerCureTrap(monster, trap, visible, context) {
    const { state, publish, random, rollDice, rollOne } = context;
    const name = visible ? monsterName(monster, { state, capitalized: true }) : '';
    if (monster.mx === trap.tx && monster.my === trap.ty) {
        if (visible)
            await publish(`${name} triggers ${trap.tseen ? 'the' : 'a'} fire trap!`);
    }
    else {
        const oldX = monster.mx, oldY = monster.my;
        await placeMonsterOnMap(monster, trap.tx, trap.ty);
        await newsym(oldX, oldY);
        if (monster.wormno)
            await advanceMonsterWormBody(monster, { state, random, rollDice, rollOne });
        await newsym(monster.mx, monster.my);
        if (visible) {
            const floats = [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[monster.mnum] ?? -1);
            await publish(`${name} ${locomotionThirdPerson(monster)} ${floats ? 'over' : 'onto'} ${trap.tseen ? 'the' : 'a'} fire trap!`);
        }
    }
    const action = await triggerImmediateMonsterTrap(monster, state, { force: true, random, rollDice, rollOne });
    await finishImmediateMonsterTrap(action, state, { publish, random, rollDice, rollOne });
}
// C muse.c:muse_unslime() composes vtense(fakename[0],
// locomotion(mon->data, "move")); this is the conjugated third-person form
// of mondata.c:locomotion() for that one message.
function locomotionThirdPerson(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if ([S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[monster.mnum] ?? -1))
        return 'floats';
    if (flags & M1_FLY)
        return 'flies';
    if (flags & M1_SLITHY)
        return 'slithers';
    if (flags & M1_AMORPHOUS)
        return 'oozes';
    if (!MONSTER_MOVE[monster.mnum])
        return 'wiggles';
    return (flags & M1_NOLIMBS) === M1_NOLIMBS ? 'crawls' : 'moves';
}
// muse_unslime()'s splitobj(obj, 1L) for a stack of carried oil.
function splitOilPotion(oil, state) {
    if (oil.quan <= 1)
        return oil;
    const single = splitObjectStack(oil, 1, state);
    if (!single)
        throw new Error('A slime cure must retain its carried oil stack');
    return single;
}
// C hacklib.c:upstart(), inline for muse_unslime()'s oil pronoun.
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
//# sourceMappingURL=muse.js.map