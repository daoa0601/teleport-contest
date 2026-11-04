// muse.js — the MUSE mechanics of muse.c: which items monsters are
// generated with (rnd_offensive_item/rnd_defensive_item/rnd_misc_item),
// which carried item they choose (find_defensive/find_offensive/find_misc)
// and how they use it (use_defensive/use_offensive/use_misc), the shared
// use feedback (precheck/mzapwand/mplayhorn/mreadmsg/mquaffmsg/
// you_aggravate), searches_for_item, and the stoning/sliming self-cures
// (munstone/mon_consume_unstone/cures_stoning/mcould_eat_tin/munslime/
// muse_unslime/cures_sliming).
import { WEAPON_CLASS, AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, COIN_CLASS, } from './objclass.js';
import { objectBaseDirection, objectSkill, AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, AMULET_OF_YENDOR, BAG_OF_HOLDING, BAG_OF_TRICKS, BOULDER, BUGLE, BULLWHIP, CORPSE, EGG, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, GLOB_OF_GREEN_SLIME, HEAVY_IRON_BALL, ICE_BOX, LARGE_BOX, OBJECT_DESCRIPTIONS, PICK_AXE, POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_OIL, POT_PARALYSIS, POT_POLYMORPH, POT_SICKNESS, POT_SLEEPING, POT_SPEED, SCR_CREATE_MONSTER, SCR_EARTH, SCR_FIRE, SCR_TELEPORTATION, TIN, TIN_OPENER, UNICORN_HORN, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_POLYMORPH, WAN_SLEEP, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL, } from './object_data.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroHasInvoluntaryDelay, setMulti, isok } from './cmd.js';
import { endVoluntaryMultiTurn, loseHeroHp, roomsAt } from './hack.js';
import { BEAR_TRAP, BOLT_LIM, CORR, D_BROKEN, D_CLOSED, D_LOCKED, DOOR, DRAWBRIDGE_UP, EXPL_FIERY, FIRE_TRAP, G_GONE, HOLE, In_endgame, In_sokoban, IS_AIR, IS_DOOR, IS_DRAWBRIDGE, IS_FURNITURE, IS_OBSTRUCTED, is_hole, is_pit, ismnum, LADDER, MFAST, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP, MM_NOMSG, MON_OFFMAP, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, M_SEEN_SLEEP, NORMAL_SPEED, P_DAGGER, P_KNIFE, PIT, PLNMSG_enum, PLNMSG_UNKNOWN, POLY_TRAP, QBUFSZ, RLOC_MSG, SCORR, SDOOR, SHOPBASE, STAIRS, STRAT_WAITFORU, TELEP_TRAP, TEMPLE, WAND_BACKFIRE_CHANCE, W_ARM, W_ARMF, W_ARMG, W_ARMH, W_WEP, WEB, W_NONDIGGABLE, ZAP_POS, W_AMUL, W_ARMS, } from './const.js';
import { heroHasArtifactDefense, weaponReflects } from './artifacts.js';
import { monsterHasMagicResistance } from './trap.js';
import { touchPetrifies } from './stoning.js';
import { fillPitWithBoulderAt, mintrap, seeTrap, trapAt, trapName, heroIsUnconscious, maketrap } from './trap.js';
import { CLR_BRIGHT_GREEN, CLR_GREEN } from './terminal.js';
import { MONSTER_ATTACKS, MONSTER_COLOR, MONSTER_DIFFICULTY, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, } from './monster_data.js';
import { AD_FIRE, AD_HEAL, AD_RBRE, AT_BREA, AT_EXPL, AT_GAZE } from './monster_attack_types.js';
import { isBimanualObject } from './object_properties.js';
import { objectIsHardHelmet } from './do_wear.js';
import { dragonFormForArmor, heroSpecies } from './polyself.js';
import { enexto, monsterTeleportRestricted, reportMonsterTeleportRestriction } from './teleport.js';
import { displayColorName, monsterName, monsterReflexiveAction, randomDisplayMonsterName, visibleMonsterSubject } from './do_name.js';
import { possessiveName, dist2, distmin, depth, ledgerNo, upstart } from './hacklib.js';
import { monsterObjectPronoun, monsterSubjectPronoun, monsterKnowsTrap, monsterLearnsTrap, monsterIsHelpless, monsterHasAcidResistance, monsterHasStoneResistance, monsterLocomotion, monsterPolymorphsWhenStoned, monstersForgetHeroResistance, monstersObserveHeroResistance, sameMonsterRace, speciesCanBlow, is_mercenary, monsterHasEyes, monsterHasNoHands, monsterHasNoLimbs, monsterHatesLight, monsterHatesSilver, monsterIsAmorphous, monsterIsAnimal, monsterIsBat, monsterIsFlyer, monsterIsKop, monsterIsMindless, monsterIsNoncorporeal, monsterIsNonliving, monsterIsSlimeproof, monsterIsSlithy, monsterIsUndead, monsterIsUnicorn, monsterIsUnsolid, monsterIsVampireShifter, monsterIsVerySmall, monsterPassesWalls, monsterThrowsRocks, needspick, acidic as speciesIsAcidic, } from './mondata.js';
import { cansee, couldsee, vision_note_blocker_change } from './vision.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, cls, displaySelf, docrt, flashGlyphAt, map_invisible, newsym, shieldeff, show_glyph_cell, transientMonsterGlyph } from './display.js';
import { plineWithContinuation } from './pline.js';
import { d, rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { objectMaterial, learnObjectType, observeObject } from './o_init.js';
import { heroCanSeeInvisible } from './mcastu.js';
import { monsterAt, monsterAtPosition, monsterHasMapPosition, placeMonsterOnMap, removeMonsterFromMapAt } from './steed.js';
import { monsterIsScaredAt, makeMonsterFlee, monsterWantsFloorObject, isAccessibleAt } from './monmove.js';
import { thawObject } from './pickup.js';
import { isQuantumBox } from './quantum_cat.js';
import { canLetGo, tryCallObjectType, dropObjectAtHero } from './do.js';
import { finishInventoryRemoval, inventoryItemDescription } from './invent.js';
import { changeMonsterForm, finishEnvironmentalMonsterDeath, finishMonsterKilled, healMonster, maybeUnhideAt, paralyzeMonster, removeMonsterFromGame, wakeMonster, monsterCanCarryObject, revealMonsterAppearance, presentMonsterGrowth } from './mon.js';
import { advanceMonsterWormBody } from './worm.js';
import { adjustMonsterSpeed, monsterSpeedMessage, setMonsterPermanentInvisibility } from './worn.js';
import { makemonAt, rndmonstAdj, growMonster, setMonsterMalign } from './makemon.js';
import { makePlural, verbForSubject, withIndefiniteArticle, definiteName, distantObjectName, minimalObjectName, objectCombatName, objectName, objectNameIsPlural, observeDistantObjectForNaming, observeObjectForNaming, pluralizeObjectNoun } from './objnam.js';
import { splitObjectStack, forgetObjectKnowledge, unlinkObject, addObjectToContainer, objectWeight, isContainer, placeObjectSynchronously, sweepFloorPile } from './mkobj.js';
import { canHeroRiseUp, levelAtDepth, levelIsWizardTower, sameDungeonLevel } from './dungeon.js';
import { heroHandName } from './body_parts.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { destroyObjectFromMonsterInventory, findMonsterArmorClass, wornInSlot } from './monworn.js';
import { addObjectToMonsterInventory } from './steal.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { isWeldedPrimary, willWeld } from './wield.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { dropBoulderOnHero, dropBoulderOnMonster } from './read.js';
import { beginObjectBurn } from './timeout.js';
import { lightDamage } from './light.js';
import { throwMonsterProjectile, blockingTerrain, monsterLinedUpWithHero, consumeMonsterItem } from './mthrowu.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating, heroIsUnaware } from './senses.js';
import { makeBlinded } from './potion.js';
import { destroyDrawbridge, findDrawbridgeAt, isIceAt, isLavaAt, isPoolAt } from './dbridge.js';
import { changeDoorByMagic } from './lock.js';
import { stopHeroOccupation } from './occupation.js';
import { propertyIsActive } from './properties.js';
import { rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { heroHasHalfSpellDamage, monsterResistsEffect, learnWand } from './zap.js';
import { askTeleportDestination, heroControlsTeleport, randomMonsterRelocation, teleportHero } from './teleport.js';
import { randomTeleportDepth } from './level_teleport.js';
import { awakenSoldiers } from './music.js';
import { canDigDown, canFallThrough, stairwayAt } from './mklev.js';
import { shopkeeperInOwnShop, addShopDamage, deleteObject } from './shk.js';
import { monsterCarriesSpecialObject } from './wizard.js';
import { inHeroSanctuary } from './priest.js';
import { formatFeltMessage, formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { explode } from './explosion.js';
import { monsterWieldedWeapon } from './weapon.js';
import { extendPetHungerDeadline, petFoodNutrition } from './pet_eating.js';
import { impossible } from './diagnostics.js';
import { displayMessageWindow } from './tty_topline.js';
import { migrateMonsterOffLevel } from './dog.js';
import { exerciseWisdom } from './attrib.js';
import { recordObjectKnowledge } from './o_init.js';
import { castNativeRay, hitMonsterWithRay } from './zap.js';
import { hitObjectWithWand } from './zap.js';
import { turnCarriedObjects, turnHeroWithUndeadMagic } from './zap.js';
// ---------------------------------------------------------------------------
// Shared muse.c constants.
// ---------------------------------------------------------------------------
const S_EYE = 5;
const S_LIGHT = 25;
const S_GHOST = 54;
const GEMSTONE = 20, MINERAL = 21, RAY = 3, IRON = 11, SILVER = 14;
const G_UNIQ = 0x1000;
const PM_PESTILENCE = 312;
const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_KI_RIN = MONSTER_NAME.indexOf('ki-rin');
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
// C muse.c:precheck().
// Return null when the selected item can still be used. An exploded wand
// spends no action if its owner survives, but cancels the selected choice.
export async function precheck(monster, object, options) {
    const { state, random = rn2, rollDice = d, publish = plineWithContinuation } = options;
    if (object.oclass === POTION_CLASS) {
        const appearance = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
        const species = appearance === 'milky' ? 287 : appearance === 'smoky' ? 315 : null;
        if (species !== null && !((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
            && !random(13 + 2 * (state.mvitals?.[species]?.born ?? 0))) {
            const point = enexto(species, monster.mx, monster.my, { state, random });
            if (!point)
                return null;
            const visible = cansee(monster.mx, monster.my);
            await mquaffmsg(monster, object, options);
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
    if (object.oclass !== WAND_CLASS || !object.cursed || random(WAND_BACKFIRE_CHANCE) !== 0)
        return null;
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
        return { nativeResult: 0, heroDied: false };
    const death = await finishMonsterKilled(monster, state, {
        damageType: AD_RBRE, cause: '', publish, random, rollDice,
    });
    // Native precheck returns 1 after monkilled(), including life saving.
    return {
        nativeResult: 1, heroDied: !!death.heroDied,
    };
}
// C muse.c:mzapwand().
export async function mzapwand(monster, object, { state, self = false, publish = plineWithContinuation, }) {
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
// C muse.c:mplayhorn().
export async function mplayhorn(monster, object, { state, self = false, publish = plineWithContinuation, }) {
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
// C muse.c:mreadmsg().
export async function mreadmsg(monster, object, { state, publish = plineWithContinuation, }) {
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
        if (sensed) {
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
    }
    if (monster.mconf)
        await publish(`Being confused, ${visible
            ? monsterName(monster, { state }) : monsterSubjectPronoun(monster, { state })} mispronounces the magic words...`);
}
// C muse.c:mquaffmsg().
export async function mquaffmsg(monster, object, { state, publish = plineWithContinuation, }) {
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
// C muse.c:m_use_healing().
function m_use_healing(monster) {
    const inventory = monster.minvent || monster.inventory || [];
    const full = inventory.find(object => object.otyp === POT_FULL_HEALING);
    if (full)
        return { kind: 'full-healing', object: full };
    const extra = inventory.find(object => object.otyp === POT_EXTRA_HEALING);
    if (extra)
        return { kind: 'extra-healing', object: extra };
    const healing = inventory.find(object => object.otyp === POT_HEALING);
    return healing ? { kind: 'healing', object: healing } : null;
}
// C muse.c:m_tele().
async function m_tele(monster, type, seen, options, trap = null) {
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
            await mintrap(monster, state, { forcetrap: true, random, rollOne, rollDice, publish });
        }
        else
            await randomMonsterRelocation(monster, { ...options, flags: RLOC_MSG });
    }
}
// Shared noteleport_level()/mon_knows_traps() condition in find_defensive() and find_offensive().
function teleportNotKnownBlocked(monster, state) {
    return !monsterTeleportRestricted(monster, state) || !monsterKnowsTrap(monster, { ttyp: TELEP_TRAP });
}
// mon_has_amulet() inventory predicate, shared by the teleport paths.
function hasAmulet(monster) {
    return (monster.minvent || monster.inventory || []).some(object => object.otyp === AMULET_OF_YENDOR);
}
// Is_botlevel() expression shared by find_defensive() and use_defensive().
function atBottom(state) {
    return state.u.uz.dlevel === state.dungeons[state.u.uz.dnum]?.num_dunlevs;
}
// is_floater() macro: S_EYE or S_LIGHT.
function monsterFloats(monster) {
    const symbol = MONSTER_SYMBOL[monster.mnum];
    return symbol === 5 || symbol === 25; // S_EYE, S_LIGHT
}
// C muse.c:m_next2m().
function m_next2m(monster, state) {
    return state.level.monsters.some(other => other !== monster && !other.dead
        && dist2(monster.mx, monster.my, other.mx, other.my) <= 2);
}
// C muse.c:m_sees_sleepy_soldier().
function m_sees_sleepy_soldier(monster, state) {
    return state.level.monsters.some(other => other !== monster
        && monsterHasMapPosition(other, state) && isok(other.mx, other.my)
        && Math.abs(other.mx - monster.mx) <= 3 && Math.abs(other.my - monster.my) <= 3
        && is_mercenary(other.mnum)
        && MONSTER_NAME[other.mnum] !== 'guard'
        && (other.msleeping || !other.mcanmove));
}
// C muse.c:find_defensive().
export function find_defensive(monster, state, { tryEscape = false, random = rn2, } = {}) {
    const noHands = monsterHasNoHands(monster.mnum);
    const stuck = state.u.ustuck === monster;
    if ((monsterIsAnimal({ mnum: monster.mnum }) || monsterIsMindless(monster.mnum)))
        return null;
    if (!tryEscape && dist2(monster.mx, monster.my, monster.mux ?? state.u.ux, monster.muy ?? state.u.uy) > 25)
        return null;
    if (state.u.uswallow && stuck)
        return null;
    if (tryEscape && state.knox_level?.dnum === state.u.uz.dnum
        && state.knox_level.dlevel === state.u.uz.dlevel
        && dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > 2
        && m_next2m(monster, state))
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
        if (tin && mcould_eat_tin(monster) && random(3))
            return { kind: 'lizard', object: tin };
    }
    const pestilence = MONSTER_NAME[monster.mnum] === 'Pestilence';
    if (blind && !noHands && !pestilence) {
        const healing = m_use_healing(monster);
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
            return noHands ? null : m_use_healing(monster);
    }
    let selected = null;
    if (!stuck && MONSTER_MOVE[monster.mnum] && !monster.mtrapped) {
        const floats = monsterFloats(monster);
        const cell = state.level.requireAt(monster.mx, monster.my);
        if (cell.typ === STAIRS || cell.typ === LADDER) {
            const stair = stairwayAt(state, monster.mx, monster.my);
            if (stair && (stair.up || !floats))
                selected = { kind: 'stairs', stair };
        }
        else {
            const ignoreBoulders = (MONSTER_SIZE[monster.mnum] ?? 0) === 0
                || monsterThrowsRocks(monster.mnum) || monsterPassesWalls(monster.mnum);
            const spots = [{ x: monster.mx, y: monster.my }];
            for (let x = monster.mx - 1; x <= monster.mx + 1; x++)
                for (let y = monster.my - 1; y <= monster.my + 1; y++)
                    if (isok(x, y) && (x !== monster.mx || y !== monster.my))
                        spots.push({ x, y });
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
                    && canFallThrough(state.u.uz)) {
                    selected = { kind: 'trap', trap };
                    break;
                }
                if (trap.ttyp === TELEP_TRAP)
                    selected = { kind: 'trap', trap };
            }
        }
    }
    if (noHands)
        return selected;
    const bugle = inventory.find(object => object.otyp === BUGLE);
    if (bugle && is_mercenary(monster.mnum)
        && m_sees_sleepy_soldier(monster, state))
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
        if (object.otyp === SCR_TELEPORTATION && monster.mcansee && monsterHasEyes(monster.mnum)
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
// muse.c's m_flee(m) macro in use_defensive().
async function m_flee(monster, options) {
    if (monster.mflee || monster.iswiz)
        return;
    const turns = 33 - Math.trunc(30 * monster.mhp / monster.mhpmax);
    if (turns)
        await makeMonsterFlee(monster, { ...options, turns, announce: false });
}
// C muse.c:mon_escape().
async function mon_escape(monster, seen, { state, publish = plineWithContinuation }) {
    if (monsterCarriesSpecialObject(monster, state) || monster.iswiz && (state.context.no_of_wizards ?? 0) < 2)
        return { nativeResult: 0, heroDied: false };
    if (seen)
        await publish(`${monsterName(monster, { state, capitalized: true })} escapes the dungeon!`);
    await removeMonsterFromGame(monster);
    return { nativeResult: 2, heroDied: !!state.program_state.gameover };
}
// C muse.c:reveal_trap().
async function reveal_trap(trap, visible, state) {
    const cell = state.level.requireAt(trap.tx, trap.ty);
    if (cell.typ === SCORR) {
        cell.typ = CORR;
        cell.flags = 0;
        vision_note_blocker_change(trap.tx, trap.ty);
    }
    if (visible)
        await seeTrap(trap, state);
}
// C muse.c:use_defensive().
export async function use_defensive(monster, choice, options) {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    const object = 'object' in choice ? choice.object : null;
    if (object) {
        const result = await precheck(monster, object, options);
        if (result)
            return result;
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
                await mcureblindness(monster, seen, options);
            else {
                monster.mconf = monster.mstun = 0;
                if (seen)
                    await publish(`${subject()} seems steadier now.`);
            }
            return spent();
        case 'lizard':
            await mon_consume_unstone(monster, choice.object, { state, publish, stoning: false });
            return spent();
        case 'healing':
        case 'extra-healing':
        case 'full-healing': {
            const potion = choice.object;
            await mquaffmsg(monster, potion, options);
            const sign = potion.blessed ? 1 : potion.cursed ? -1 : 0;
            if (choice.kind === 'full-healing') {
                if (potion.otyp === POT_SICKNESS)
                    potion.blessed = false;
                healMonster(monster, monster.mhpmax, potion.blessed ? 8 : 4);
            }
            else
                healMonster(monster, rollDice(6 + 2 * sign, choice.kind === 'healing' ? 4 : 8), choice.kind === 'healing' ? 1 : potion.blessed ? 5 : 2);
            if (!monster.mcansee && (choice.kind === 'healing' ? !potion.cursed : potion.otyp !== POT_SICKNESS))
                await mcureblindness(monster, seen, options);
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
            await m_flee(monster, options);
            await mzapwand(monster, choice.object, { ...options, self: true });
            await m_tele(monster, choice.object.otyp, seen, options);
            return spent();
        case 'teleport-ray':
        case 'undead-turning':
            await mzapwand(monster, choice.object, options);
            state.context.zap_oseen = seen;
            await mbhit(monster, choice.object, options);
            if (choice.kind === 'teleport-ray' && monsterTeleportRestricted(monster, state))
                monsterLearnsTrap(monster, { ttyp: TELEP_TRAP });
            return spent();
        case 'teleport-scroll': {
            if (monster.isshk || monster.isgd || monster.ispriest)
                return spent();
            await m_flee(monster, options);
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
            await mreadmsg(monster, scroll, scrollOptions);
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
                await m_tele(monster, scroll.otyp, seen, scrollOptions);
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
                await mreadmsg(monster, choice.object, options);
            while (count-- > 0) {
                const point = enexto(placementSpecies, monster.mx, monster.my, { state, random });
                if (!point)
                    break;
                if (choice.kind === 'create-wand') {
                    await mzapwand(monster, choice.object, options);
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
            await m_flee(monster, options);
            await mzapwand(monster, choice.object, options);
            if (seen)
                learnObjectType(WAN_DIGGING, state);
            const { mx: x, my: y } = monster;
            const cell = state.level.requireAt(x, y);
            if (IS_FURNITURE(cell.typ) || IS_DRAWBRIDGE(cell.typ) || findDrawbridgeAt(x, y, state)
                || stairwayAt(state, x, y)) {
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
                    await publish(`${subject()} ${monsterIsFlyer(monster.mnum) ? 'dives' : 'falls'} through...`);
            }
            else if (hole && !heroIsDeaf(state))
                await publishHeardMessage(`something crash through the ${surfaceName(x, y, state)}.`, publish, state);
            await fillPitWithBoulderAt(x, y, state, { publish });
            if (hole)
                await migrateMonsterOffLevel(monster, state, { dst: { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 } });
            else {
                vision_note_blocker_change(x, y);
                const action = await mintrap(monster, state, { forcebungle: true, random, rollOne, rollDice, publish });
                if (action.event?.kind === 'pit-trap' && action.event.killed)
                    return { nativeResult: 1, heroDied: !!state.program_state.gameover };
            }
            return spent();
        }
        case 'stairs': {
            await m_flee(monster, options);
            const stair = choice.stair;
            const branch = stair.tolev.dnum !== state.u.uz.dnum;
            const ladder = stair.isladder && !branch;
            if (ledgerNo(state.u.uz, state) === 1 && (branch || stair.up && !ladder)) {
                return mon_escape(monster, seen, options);
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
            await m_flee(monster, options);
            const visible = cansee(monster.mx, monster.my);
            if (visible) {
                const name = subject();
                const verb = verbForSubject(name, monsterLocomotion(monster.mnum, 'jump'));
                await publish(`${name} ${verb} ${hole ? 'into' : 'onto'} a ${trapName(trap.ttyp, { state })}!`);
            }
            await reveal_trap(trap, visible, state);
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
                await m_tele(monster, 0, seen, options, trap);
            return spent();
        }
    }
}
// Common creature exclusions in the three native rnd_*_item() functions.
function rejectsRandomItem(monster) {
    const mndx = monster.mnum;
    const symbol = MONSTER_SYMBOL[mndx];
    return (monsterIsAnimal({ mnum: mndx }) || monsterIsMindless(mndx))
        || (MONSTER_ATTACKS[mndx] || []).some(attack => attack[0] === AT_EXPL)
        || symbol === S_GHOST || monsterIsKop(mndx);
}
// which_armor(W_ARMH), including the port's creation-time wornSlot phase.
function wornHelmet(monster) {
    const inventory = monster?.minvent || monster?.inventory || [];
    return inventory.find(object => ((object.owornmask ?? 0) & W_ARMH) !== 0
        || object.wornSlot === 'helmet') || null;
}
// C muse.c:rnd_defensive_item().
export function rnd_defensive_item(monster) {
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
// C muse.c:linedup_chk_corpse().
function linedup_chk_corpse(x, y, state) {
    return (state.level.objects[x]?.[y] ?? []).some(object => object.otyp === CORPSE);
}
// C muse.c:m_use_undead_turning().
function m_use_undead_turning(monster, object, state) {
    if (object.otyp !== WAN_UNDEAD_TURNING || object.spe <= 0)
        return false;
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
        if (linedup_chk_corpse(x, y, state))
            return true;
    } while (x !== endX || y !== endY);
    return false;
}
// C muse.c:hero_behind_chokepoint().
function hero_behind_chokepoint(monster, state) {
    const dx = Math.sign(monster.mx - (monster.mux ?? 0));
    const dy = Math.sign(monster.my - (monster.muy ?? 0));
    const x = (monster.mux ?? 0) + dx, y = (monster.muy ?? 0) + dy;
    // Turning twice in the eight-direction ring rotates by ninety degrees.
    const leftX = x - dy, leftY = y + dx;
    const rightX = x + dy, rightY = y - dx;
    return (!isok(leftX, leftY) || !isAccessibleAt(leftX, leftY, state))
        && (!isok(rightX, rightY) || !isAccessibleAt(rightX, rightY, state));
}
// C muse.c:mon_has_friends().
function mon_has_friends(monster, state) {
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
// C muse.c:mon_likes_objpile_at().
function mon_likes_objpile_at(monster, x, y, state) {
    if (!isok(x, y))
        return false;
    const pile = state.level.objects[x]?.[y] ?? [];
    for (const object of pile.slice(0, 3))
        if (monsterWantsFloorObject(monster, object, state))
            return true;
    // The native loop counts three examined stacks, even if no fourth exists.
    return pile.length >= 3;
}
// C muse.c:find_offensive().
export function find_offensive(monster, state, { random = rn2 } = {}) {
    if (monster.mpeaceful || monsterIsAnimal(monster)
        || monsterIsMindless(monster.mnum) || monsterHasNoHands(monster.mnum)
        || state.u.uswallow || inHeroSanctuary(monster, 0, 0, state))
        return null;
    const attacks = MONSTER_ATTACKS[monster.mnum] ?? [];
    if (attacks.some(([, damage]) => damage === AD_HEAL) && !(state.uwep || state.u.uwep || state.uarmu || state.u.uarmu
        || state.uarm || state.u.uarm || state.uarmh || state.u.uarmh
        || state.uarms || state.u.uarms || state.uarmg || state.u.uarmg
        || state.uarmc || state.u.uarmc || state.uarmf || state.u.uarmf))
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
        if (m_use_undead_turning(monster, object, state))
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
                || hero_behind_chokepoint(monster, state) && mon_has_friends(monster, state)
                || mon_likes_objpile_at(monster, state.u.ux, state.u.uy, state)
                || !!stairwayAt(state, state.u.ux, state.u.uy)))
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
                || monsterPassesWalls(monster.mnum)
                || monsterIsNoncorporeal(monster) || monsterIsUnsolid(monster) || !random(10))
            && distance <= 2 && monster.mcansee
            && monsterHasEyes(monster.mnum)
            && !sameDungeonLevel(state.u.uz, state.rogue_level)
            && (state.u.uz.dnum !== state.astral_level?.dnum || sameDungeonLevel(state.u.uz, state.earth_level)))
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
// C muse.c:mbhitm(). A null target denotes the hero (C's &youmonst).
async function mbhitm(target, context) {
    const { state, source, wand, seen, random, rollOne, rollDice, publish } = context;
    let revealInvisible = false;
    if (target && wand.otyp !== WAN_UNDEAD_TURNING) {
        target.msleeping = 0;
        if (target.m_ap_type)
            await revealMonsterAppearance(target);
    }
    switch (wand.otyp) {
        case WAN_STRIKING: {
            revealInvisible = true;
            let learned = false;
            if (!target) {
                if (state.u.antimagic || propertyIsActive('antimagic', state) || heroHasArtifactDefense('magic', state)) {
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
            }
            else if (monsterHasMagicResistance(target)) {
                await shieldeff(target.mx, target.my, state);
                await publish('Boing!');
                learned = true;
            }
            else if (rollOne(20) < 10 + findMonsterArmorClass(target)) {
                let damage = rollDice(2, 12);
                await publish(rayHitMessage('wand', target, { state, x: target.mx, y: target.my, damage }));
                if (monsterResistsEffect(target, 12, random)) {
                    await shieldeff(target.mx, target.my, state);
                    if (cansee(target.mx, target.my))
                        await publish(`${monsterName(target, { state, capitalized: true })} resists!`);
                    damage = Math.ceil(damage / 2);
                }
                target.mhp -= damage;
                if (target.mhp <= 0)
                    await finishMonsterKilled(target, state, { damageType: AD_RBRE, publish, random, rollDice });
                learned = true;
            }
            else
                await publish(rayMissMessage('wand', target, { state, x: target.mx, y: target.my }));
            if (state.program_state.gameover)
                return;
            if (learned && seen && (!target || cansee(target.mx, target.my)))
                learnObjectType(wand.otyp, state);
            break;
        }
        case WAN_TELEPORTATION:
            if (!target) {
                await teleportHero({ chooseDestination: askTeleportDestination });
                if (!state.program_state.gameover && seen)
                    learnObjectType(wand.otyp, state);
            }
            else if (target.ispriest && roomsAt(state.level, target.mx, target.my, TEMPLE).length) {
                if (cansee(target.mx, target.my))
                    await publish(`${monsterName(target, { state, capitalized: true })} resists the magic!`);
            }
            else if (!await reportMonsterTeleportRestriction(target, { state, publish })) {
                await randomMonsterRelocation(target, { state, random, rollOne, flags: RLOC_MSG });
            }
            break;
        case WAN_UNDEAD_TURNING:
            if (!target) {
                await turnHeroWithUndeadMagic(state, { roll: rollOne });
                if (!state.program_state.gameover && seen)
                    learnObjectType(wand.otyp, state);
            }
            else {
                let wake = await turnCarriedObjects(target.minvent, state) > 0;
                if (monsterIsUndead(target.mnum) || monsterIsVampireShifter(target)) {
                    wake = revealInvisible = true;
                    state.context.bypasses = true;
                    let damage = rollOne(8);
                    if (monsterResistsEffect(target, 12, random))
                        damage = Math.ceil(damage / 2);
                    target.mhp -= damage;
                    if (target.mhp <= 0)
                        await finishMonsterKilled(target, state, { damageType: AD_RBRE, publish, random, rollDice });
                }
                if (state.program_state.gameover)
                    return;
                if (wake) {
                    if (target.mhp > 0 && !target.dead)
                        await wakeMonster(target);
                    if (seen)
                        learnObjectType(wand.otyp, state);
                }
            }
            break;
    }
    if (target && revealInvisible && target.mhp > 0 && !target.dead
        && cansee(state.bhitpos.x, state.bhitpos.y) && !canSpotMonster(target))
        await map_invisible(state.bhitpos.x, state.bhitpos.y);
}
// C muse.c:mbhit().
export async function mbhit(source, wand, { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
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
            await mbhitm(null, context);
            range -= 3;
        }
        else {
            const target = monsterAtPosition(state.level, x, y);
            if (target) {
                if (cansee(x, y) && !canSpotMonster(target))
                    await map_invisible(x, y);
                await mbhitm(target, context);
                range -= 3;
            }
        }
        if (state.program_state.gameover)
            return { heroDied: true };
        if (await fhito_loc(context))
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
// C muse.c:fhito_loc().
async function fhito_loc({ state, wand }) {
    const { x, y } = state.bhitpos;
    let affected = false;
    await sweepFloorPile(x, y, state, async (object) => {
        if (await hitObjectWithWand(object, wand, { state }))
            affected = true;
        return !state.program_state.gameover;
    });
    return affected;
}
// C muse.c:buzz_force_miss().
async function buzz_force_miss(type, dice, direction, options) {
    return castNativeRay(type, dice, direction, { ...options, forceMiss: true });
}
// C muse.c:use_offensive().
export async function use_offensive(monster, choice, options) {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    requireLiveGame(state);
    const object = choice.object;
    const buzzfn = monster.mwandexp ? castNativeRay : buzz_force_miss;
    if (object.oclass !== POTION_CLASS) {
        const result = await precheck(monster, object, options);
        if (result)
            return result;
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
                await mzapwand(monster, object, options);
                if (seen)
                    learnObjectType(object.otyp, state);
                rayType = object.otyp - WAN_MAGIC_MISSILE;
                dice = object.otyp === WAN_MAGIC_MISSILE ? 2 : 6;
            }
            else {
                if (object.otyp !== FIRE_HORN && object.otyp !== FROST_HORN)
                    throw new RangeError(`Selected offensive horn ${object.otyp} cannot emit a ray`);
                await mplayhorn(monster, object, options);
                rayType = object.otyp === FROST_HORN ? 2 : 1;
                dice = 6 + random(6);
            }
            const direction = aimedDirection(monster);
            const ray = await buzzfn(-30 - rayType, dice, direction, {
                state, sourceMonster: monster, sourceObject: object,
                originX: monster.mx, originY: monster.my,
                publish, random, rollOne, rollDice,
            });
            if (!ray.heroDied)
                monster.mwandexp = true;
            return { nativeResult: monster.mhp <= 0 || monster.dead ? 1 : 2, heroDied: ray.heroDied };
        }
        case 'immediate-wand': {
            const previousSeen = state.context.zap_oseen;
            state.context.zap_oseen = seen;
            try {
                await mzapwand(monster, object, options);
                const result = await mbhit(monster, object, options);
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
        case 'earth-scroll': {
            const confused = !!monster.mconf;
            const x = monster.mx, y = monster.my;
            const cursed = !!object.cursed, blessed = !!object.blessed;
            await mreadmsg(monster, object, options);
            if (canSpotMonster(monster)) {
                await publish(`The ${ceilingName(x, y, state)} rumbles ${blessed ? 'around' : 'above'} ${monsterName(monster, { state })}!`);
                if (seen)
                    learnObjectType(object.otyp, state);
            }
            else if (cansee(x, y)) {
                await publish(`The ${ceilingName(x, y, state)} rumbles in the middle of nowhere!`);
                if (monster.minvis)
                    await map_invisible(x, y);
                if (seen)
                    learnObjectType(object.otyp, state);
            }
            // The caster can die under the central boulder. Consume before drops so
            // its death cannot put the used object back onto the floor.
            await consumeMonsterItem(monster, object, state);
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
        case 'camera': {
            if (heroIsHallucinating(state))
                await publish('"Say cheese!"');
            else if (!heroIsBlind(state)) {
                const subject = monsterName(monster, { state, capitalized: true });
                const name = withIndefiniteArticle(objectCombatName(object, { state }));
                await publish(`${subject} takes a picture of you with ${name}!`);
            }
            if (!heroIsBlind(state) && !heroResistsBlindingLight(state)) {
                await publish('You are blinded by the flash of light!');
                await makeBlinded((state.u.blindTurns ?? 0) + rollOne(51), { state, talk: false, publish });
            }
            await lightDamage(object, true, 5, { state });
            if (!state.program_state.gameover)
                object.spe--;
            // Native use_offensive returns one here even if the photographer lives.
            return { nativeResult: 1, heroDied: !!state.program_state.gameover };
        }
        case 'potion': {
            if (cansee(monster.mx, monster.my)) {
                observeObject(object, state);
                const subject = monsterName(monster, { state, capitalized: true });
                observeObjectForNaming(object, { state });
                const name = await inventoryItemDescription({ ...object, quan: 1, quantity: 1 });
                await publish(`${subject} hurls ${name}!`);
            }
            if (monster.mux === undefined || monster.muy === undefined)
                throw new Error('An offensive item user must have its remembered hero position');
            const target = { x: monster.mux, y: monster.muy };
            const shot = await throwMonsterProjectile(monster, object, {
                state, dx: Math.sign(target.x - monster.mx), dy: Math.sign(target.y - monster.my),
                range: distmin(monster.mx, monster.my, target.x, target.y),
                publish, random, rollOne, rollDice,
            });
            return { nativeResult: 2, heroDied: shot.heroDied };
        }
    }
}
// This pure sgn expression is also an equivalence-proof entry point.
// The sgn(mux - mx)/sgn(muy - my) aim of use_offensive()'s rays and throws.
function aimedDirection(monster) {
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('An offensive item user must have its remembered hero position');
    const target = { x: monster.mux, y: monster.muy };
    const dx = Math.sign(target.x - monster.mx), dy = Math.sign(target.y - monster.my);
    if (dy < 0)
        return dx < 0 ? 'y' : dx > 0 ? 'u' : 'k';
    if (dy > 0)
        return dx < 0 ? 'b' : dx > 0 ? 'n' : 'j';
    return dx < 0 ? 'h' : dx > 0 ? 'l' : '>';
}
// C muse.c:rnd_offensive_item().
export function rnd_offensive_item(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty > 7 && !rn2(35))
        return WAN_DEATH;
    switch (rn2(9 - Number(difficulty < 4) + 4 * Number(difficulty > 6))) {
        case 0: {
            if (objectIsHardHelmet(wornHelmet(monster))
                || (monsterIsAmorphous({ mnum: mndx }) || monsterPassesWalls(mndx) || monsterIsUnsolid({ mnum: mndx }))
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
// C muse.c:find_misc().
export async function find_misc(monster, state, random, calls) {
    if ((monsterIsMindless(monster?.mnum) || monsterIsAnimal({ mnum: monster?.mnum })) ||
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
                const ignoresBoulders = monsterIsVerySmall(monster.mnum)
                    || monsterThrowsRocks(monster.mnum) || monsterPassesWalls(monster?.mnum);
                if (!ignoresBoulders && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER)
                    || monsterIsScaredAt(monster, state, x, y))
                    continue;
                const trap = trapAt(state, x, y);
                if (trap?.ttyp === POLY_TRAP)
                    return { kind: 'polymorph-trap', trap };
            }
        }
    }
    if (monsterHasNoHands(monster?.mnum))
        return null;
    let selected = null;
    for (let index = 0; index < inventory.length; index++) {
        const object = inventory[index];
        if (!object)
            continue;
        // muse.c:find_misc() lets a temple priest use an uncursed gain-level
        // potion, but rejects a cursed one so the resident cannot leave the
        // shrine level.
        if (object.otyp === POT_GAIN_LEVEL &&
            (!object.cursed || (!monster.isgd && !monster.isshk && !monster.ispriest))) {
            selected = {
                kind: 'potion-gain-level',
                object,
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
                (await canLetGo(heroWeapon, '', state) ||
                    (state?.u?.twoweap && heroSwapWeapon && await canLetGo(heroSwapWeapon, '', state)))) {
                selected = { kind: 'bullwhip-disarm', object };
            }
        }
        if (selected?.kind === 'wand-invisibility')
            continue;
        if (object.otyp === WAN_MAKE_INVISIBLE && object.spe > 0 && !monster.minvis
            && !monster.invis_blkd && (!monster.mpeaceful || heroSeesInvisible)
            && (!hasGaze || monster.mcan))
            selected = { kind: 'wand-invisibility', object };
        if (selected?.kind === 'potion-invisibility')
            continue;
        if (object.otyp === POT_INVISIBILITY &&
            !monster.minvis &&
            !monster.invis_blkd &&
            (!monster.mpeaceful || heroSeesInvisible) &&
            (!hasGaze || monster.mcan)) {
            selected = { kind: 'potion-invisibility', object };
        }
        if (selected?.kind === 'wand-speed-monster')
            continue;
        if (object.otyp === WAN_SPEED_MONSTER &&
            (object.spe ?? 0) > 0 &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'wand-speed-monster', object };
        }
        if (selected?.kind === 'potion-speed')
            continue;
        if (object.otyp === POT_SPEED &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'potion-speed', object };
        }
        if (selected?.kind === 'wand-polymorph')
            continue;
        if (object.otyp === WAN_POLYMORPH && object.spe > 0 && naturalForm && weak)
            selected = { kind: 'wand-polymorph', object };
        if (selected?.kind === 'potion-polymorph')
            continue;
        if (object.otyp === POT_POLYMORPH && naturalForm && weak)
            selected = { kind: 'potion-polymorph', object };
        if (selected?.kind === 'container')
            continue;
        if (isContainer(object) && object.otyp !== BAG_OF_TRICKS && !recordRandom(random, calls, 5)
            && !isQuantumBox(object) && !selected && object.contents?.length && !object.olocked && !object.otrapped)
            selected = { kind: 'container', object };
    }
    return selected;
}
// C muse.c:mloot_container().
export async function mloot_container(monster, container, { state, random = rn2, publish = plineWithContinuation, }) {
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
// C muse.c:use_misc().
export async function use_misc(monster, choice, state, random = rn2, calls = []) {
    const publish = plineWithContinuation;
    if (choice.kind !== 'polymorph-trap') {
        const result = await precheck(monster, choice.object, { state, random });
        if (result)
            return { ...result, checkOccupation: false };
    }
    const seen = canSeeMonster(monster);
    switch (choice.kind) {
        case 'potion-gain-level': {
            const object = choice.object;
            const sawDrinking = await mquaffmsg(monster, object, { state });
            if (object.cursed) {
                let destination = null;
                if (canHeroRiseUp(monster.mx, monster.my, { state })) {
                    const above = levelAtDepth(depth(state.u.uz, state.dungeons) - 1, { state });
                    if (!sameDungeonLevel(above, state.u.uz))
                        destination = above;
                }
                if (sawDrinking) {
                    await publish(destination
                        ? `${visibleMonsterSubject(monster)} rises up, through the ${ceilingName(monster.mx, monster.my, state)}!`
                        : `${visibleMonsterSubject(monster)} looks uneasy.`);
                    await tryCallObjectType(object, state);
                }
                await consumeMonsterItem(monster, object, state);
                if (destination)
                    await migrateMonsterOffLevel(monster, state, { dst: destination });
            }
            else {
                if (sawDrinking) {
                    await publish(`${visibleMonsterSubject(monster)} seems more experienced.`);
                    learnObjectType(object.otyp, state);
                }
                await consumeMonsterItem(monster, object, state);
                const growth = growMonster(monster, { state, rollOne: rnd, random: rn2, calls });
                await presentMonsterGrowth(monster, growth);
            }
            break;
        }
        case 'wand-invisibility':
        case 'potion-invisibility': {
            const object = choice.object;
            let sawDrinking;
            if (choice.kind === 'wand-invisibility') {
                sawDrinking = canSeeMonster(monster);
                await mzapwand(monster, object, { state, self: true });
            }
            else
                sawDrinking = await mquaffmsg(monster, object, { state });
            const name = monsterName(monster, { state });
            setMonsterPermanentInvisibility(monster, !object.cursed);
            await newsym(monster.mx, monster.my);
            const stillSeen = canSpotMonster(monster);
            if (sawDrinking && monster.minvis) {
                if (stillSeen) {
                    await publish(`${possessiveName(name).replace(/^./, letter => letter.toUpperCase())} body takes on a ${heroIsHallucinating(state) ? 'normal' : 'strange'} transparency.`);
                }
                else {
                    await publish(`Suddenly you cannot see ${name}.`);
                    if (cansee(monster.mx, monster.my))
                        await map_invisible(monster.mx, monster.my);
                }
                learnObjectType(object.otyp, state);
            }
            else if (sawDrinking && !monster.minvis) {
                await publish(`${visibleMonsterSubject(monster)} briefly seems to be transparent.`);
            }
            if (choice.kind === 'potion-invisibility') {
                if (object.cursed)
                    await you_aggravate(monster, state);
                await consumeMonsterItem(monster, object, state);
            }
            break;
        }
        case 'wand-speed-monster':
        case 'potion-speed': {
            const object = choice.object;
            const visible = canSeeMonster(monster);
            if (choice.kind === 'wand-speed-monster')
                await mzapwand(monster, object, { state, self: true });
            else
                await mquaffmsg(monster, object, { state });
            const speed = adjustMonsterSpeed(monster, 1);
            if (visible && speed.changed && speed.canDescribe && !state.in_mklev) {
                await publish(`${visibleMonsterSubject(monster)} is suddenly moving ${speed.much ? 'much ' : ''}faster.`);
                learnWand(object, { state });
            }
            if (choice.kind === 'potion-speed')
                await consumeMonsterItem(monster, object, state);
            break;
        }
        case 'wand-polymorph':
        case 'potion-polymorph': {
            const seen = canSeeMonster(monster);
            if (choice.kind === 'wand-polymorph')
                await mzapwand(monster, choice.object, { state, self: true });
            else {
                await mquaffmsg(monster, choice.object, { state });
                await consumeMonsterItem(monster, choice.object, state);
                if (seen)
                    await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} suddenly mutates!`);
            }
            const target = muse_newcham_mon(monster);
            await changeMonsterForm(monster, target, state, { showMessage: true, polyspot: choice.kind === 'wand-polymorph' });
            if (seen)
                learnObjectType(choice.object.otyp, state);
            break;
        }
        case 'polymorph-trap': {
            const trapVisible = cansee(choice.trap.tx, choice.trap.ty);
            if (cansee(monster.mx, monster.my) || trapVisible)
                await seeTrap(choice.trap, state);
            if (canSeeMonster(monster) || trapVisible) {
                const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
                const verb = verbForSubject(subject, monsterLocomotion(monster.mnum, 'jump'));
                await plineWithContinuation(`${subject} deliberately ${verb} onto a ${choice.trap.tseen ? trapName(choice.trap.ttyp, { state }) : 'hidden trap'}!`);
            }
            const oldx = monster.mx, oldy = monster.my;
            // use_misc() removes even a monster already standing on the trap.
            removeMonsterFromMapAt(oldx, oldy, state);
            await newsym(oldx, oldy);
            await placeMonsterOnMap(monster, choice.trap.tx, choice.trap.ty, state);
            await maybeUnhideAt(monster.mx, monster.my, state);
            if (monster.wormno)
                await advanceMonsterWormBody(monster, { state });
            await newsym(monster.mx, monster.my);
            await changeMonsterForm(monster, null, state, { showMessage: true });
            break;
        }
        case 'container': {
            const removed = await mloot_container(monster, choice.object, { state, random });
            return { nativeResult: removed ? 2 : 0, heroDied: false, checkOccupation: false };
        }
        case 'bullwhip-disarm': {
            let destination = recordRandom(random, calls, 4);
            let target = state.uwep || state.u.uwep || null;
            const secondary = state.uswapwep || state.u.uswapwep || null;
            if (!target || !await canLetGo(target, '', state)
                || state.u.twoweap && secondary && await canLetGo(secondary, '', state) && recordRandom(random, calls, 2))
                target = secondary;
            if (!target)
                break;
            const whip = seen ? 'The bullwhip' : 'A whip';
            const weapon = definiteName(objectCombatName(target, { state, includeCorpseSpecies: false }), state);
            const hand = heroHandName(state);
            const hands = isBimanualObject(target) ? makePlural(hand) : hand;
            if (seen)
                await publish(`${monsterName(monster, { state, capitalized: true })} flicks a bullwhip towards your ${hands}!`);
            if (target.otyp === HEAVY_IRON_BALL) {
                await publish(`${whip} fails to wrap around ${weapon}.`);
                return { nativeResult: 2, heroDied: !!state.program_state.gameover, checkOccupation: true };
            }
            await publish(`${whip} wraps around ${weapon} you're wielding!`, { urgent: true });
            if (isWeldedPrimary(target, state)) {
                // welded() discovers the curse before the native punctuation test.
                target.bknown = true;
                await publish(`${objectNameIsPlural(target, state) ? 'They are' : 'It is'} welded to your ${hands}.`);
                destination = 0;
            }
            if (!destination) {
                await publish('The whip slips free.');
                return { nativeResult: 2, heroDied: !!state.program_state.gameover, checkOccupation: true };
            }
            if (destination === 3 && monsterHatesSilver(monster) && objectMaterial(target, state) === SILVER)
                destination = 2;
            await removeWornHeroItem(target, state);
            if (state.program_state.gameover)
                return { nativeResult: 2, heroDied: !!state.program_state.gameover, checkOccupation: true };
            unlinkObject(target, state);
            await finishInventoryRemoval(target, state);
            if (state.program_state.gameover)
                return { nativeResult: 2, heroDied: !!state.program_state.gameover, checkOccupation: true };
            const subject = monsterName(monster, { state, capitalized: true });
            if (destination === 1) {
                await publish(`${subject} yanks ${weapon} from your ${hands}!`);
                placeObjectSynchronously(target, monster.mx, monster.my, state);
            }
            else if (destination === 2) {
                await publish(`${subject} yanks ${weapon} to the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
                await dropObjectAtHero(target, { state });
            }
            else {
                await publish(`${subject} snatches ${weapon}!`);
                await addObjectToMonsterInventory(monster, target, state);
            }
            break;
        }
    }
    return { nativeResult: 2, heroDied: !!state.program_state.gameover, checkOccupation: true };
}
// C muse.c:muse_newcham_mon().
function muse_newcham_mon(monster) {
    const armor = (monster.minvent || []).find(object => !!((object.owornmask ?? 0) & W_ARM));
    return dragonFormForArmor(armor) ?? rndmonstAdj();
}
// C muse.c:you_aggravate().
export async function you_aggravate(monster, state) {
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
// C muse.c:rnd_misc_item().
export function rnd_misc_item(monster) {
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
// C muse.c:searches_for_item().
export function searches_for_item(monster, object, state) {
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
            return objectBaseDirection(type) === RAY || type === WAN_STRIKING || type === WAN_UNDEAD_TURNING
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
                return needspick(monster.mnum);
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
                    || (!monsterHasStoneResistance(monster) && cures_stoning(monster, object, false));
            if (type === TIN)
                return mcould_eat_tin(monster) && !monsterHasStoneResistance(monster)
                    && cures_stoning(monster, object, true);
            return type === EGG && object.corpsenm !== undefined && ismnum(object.corpsenm)
                && touchPetrifies(object.corpsenm);
        default:
            return false;
    }
}
// C muse.c:mcureblindness().
async function mcureblindness(monster, seen, options) {
    monster.mcansee = 1;
    monster.mblinded = 0;
    if (seen && monsterHasEyes(monster.mnum))
        await (options.publish ?? plineWithContinuation)(`${monsterName(monster, { state: options.state, capitalized: true })} can see again.`);
}
// C muse.c:mcould_eat_tin().
export function mcould_eat_tin(monster) {
    if (monsterIsAnimal(monster))
        return false;
    const inventory = monster.minvent || monster.inventory || [];
    const wielded = monsterWieldedWeapon(monster);
    const opensTin = (object) => object.otyp === TIN_OPENER
        || (object.oclass === WEAPON_CLASS && [P_DAGGER, P_KNIFE].includes(objectSkill(object.otyp)));
    if (wielded && ((wielded.owornmask ?? 0) & W_WEP) && willWeld(wielded))
        return inventory.includes(wielded) && opensTin(wielded);
    return inventory.some(opensTin);
}
// C muse.c:cures_stoning().
export function cures_stoning(monster, object, tinCanBeOpened) {
    if (object.otyp === POT_ACID)
        return true;
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return monsterIsSlimeproof(monster);
    if (object.otyp !== CORPSE && (object.otyp !== TIN || !tinCanBeOpened))
        return false;
    if (object.corpsenm === undefined || !Number.isInteger(object.corpsenm) || object.corpsenm < 0)
        return false;
    return object.corpsenm === PM_LIZARD || speciesIsAcidic(object.corpsenm);
}
// C muse.c:munstone().
export async function munstone(monster, { byHero = false, publish = plineWithContinuation, rollOne = rnd, state = game, } = {}) {
    if (monsterHasStoneResistance(monster) || monster.meating || monsterIsHelpless(monster)) {
        return { consumed: false, died: false };
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const tinCanBeOpened = mcould_eat_tin(monster);
    const inventory = monster.minvent || monster.inventory || [];
    const cure = inventory.find(object => cures_stoning(monster, object, tinCanBeOpened));
    if (!cure)
        return { consumed: false, died: false };
    return mon_consume_unstone(monster, cure, { byHero, publish, rollOne, state, stoning: true });
}
// C muse.c:mon_consume_unstone().
export async function mon_consume_unstone(monster, cure, { byHero = false, publish = plineWithContinuation, rollOne = rnd, state = game, stoning, }) {
    const visible = canSeeMonster(monster);
    const tinned = cure.otyp === TIN;
    const food = cure.otyp === CORPSE || tinned;
    const acidic = cure.otyp === POT_ACID
        || (food && cure.corpsenm !== undefined
            && speciesIsAcidic(cure.corpsenm));
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
    if (visible) {
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
    const quantity = cure.quan ?? cure.quantity ?? 1;
    if (quantity <= 1) {
        await destroyObjectFromMonsterInventory(monster, cure, state);
    }
    else {
        cure.quan = cure.quantity = quantity - 1;
        cure.owt = objectWeight(cure);
        monster.hasInventory = true;
    }
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
// C muse.c:munslime().
export async function munslime(monster, { state = game, byHero = false, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    if (monsterIsSlimeproof(monster) || monster.meating || monsterIsHelpless(monster))
        return { cured: false, heroDied: false };
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const context = { state, byHero, publish, random, rollDice, rollOne };
    if (!monster.mcan && !monster.mspec_used
        && MONSTER_ATTACKS[monster.mnum]?.some(([method, damage]) => method === AT_BREA && damage === AD_FIRE))
        return muse_unslime(monster, { kind: 'breath' }, context);
    if (monsterIsAnimal(monster) || monsterIsMindless(monster.mnum))
        return { cured: false, heroDied: false };
    const object = (monster.minvent || monster.inventory || []).find(candidate => cures_sliming(monster, candidate));
    if (object)
        return muse_unslime(monster, { kind: 'item', object }, context);
    const here = state.level.traps.find(trap => trap.tx === monster.mx && trap.ty === monster.my);
    if (here?.ttyp === FIRE_TRAP)
        return muse_unslime(monster, { kind: 'trap', trap: here }, context);
    if (!MONSTER_MOVE[monster.mnum] || monster.mtrapped)
        return { cured: false, heroDied: false };
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
            return muse_unslime(monster, { kind: 'trap', trap }, context);
    }
    return { cured: false, heroDied: false };
}
// C muse.c:muse_unslime().
async function muse_unslime(monster, cure, context) {
    const { state, byHero, publish, random, rollDice, rollOne } = context;
    let visible = canSeeMonster(monster);
    if (visible) {
        const subject = monsterName(monster, { state, capitalized: true });
        // C muse.c:green_mon() judges green by the display color;
        // hcolor(NH_GREEN) names the color, hallucination included.
        const green = green_mon(monster, state);
        await publish(`${subject} starts turning ${green ? 'into ooze' : displayColorName('green', state)}.`);
    }
    adjustMonsterSpeed(monster, -4);
    let damage = 0;
    let cured = true;
    if (cure.kind === 'trap') {
        const trap = cure.trap;
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
                let motion = 'moves';
                if (floats)
                    motion = 'floats';
                else if (monsterIsFlyer(monster.mnum))
                    motion = 'flies';
                else if (monsterIsSlithy(monster.mnum))
                    motion = 'slithers';
                else if (monsterIsAmorphous({ mnum: monster.mnum }))
                    motion = 'oozes';
                else if (!MONSTER_MOVE[monster.mnum])
                    motion = 'wiggles';
                else if (monsterHasNoLimbs(monster.mnum))
                    motion = 'crawls';
                await publish(`${name} ${motion} ${floats ? 'over' : 'onto'} ${trap.tseen ? 'the' : 'a'} fire trap!`);
            }
        }
        await mintrap(monster, state, { forcetrap: true, random, rollDice, rollOne, publish });
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
        await mreadmsg(monster, cure.object, context);
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
        const oil = cure.object.quan > 1 ? splitObjectStack(cure.object, 1, state) : cure.object;
        if (!oil)
            throw new Error('A slime cure must retain its carried oil stack');
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
            const subject = sawLighting ? upstart(monsterSubjectPronoun(monster, { state }))
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
            await mplayhorn(monster, cure.object, { ...context, self: true });
        else
            await mzapwand(monster, cure.object, { ...context, self: true });
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
// C muse.c:cures_sliming().
function cures_sliming(monster, object) {
    if (object.otyp === SCR_FIRE)
        return monsterHasEyes(monster.mnum) && !!monster.mcansee && !monsterHasNoHands(monster.mnum);
    if (object.otyp === POT_OIL)
        return !monsterHasNoHands(monster.mnum);
    return object.spe > 0 && (object.otyp === WAN_FIRE
        || object.otyp === FIRE_HORN && speciesCanBlow(monster.mnum));
}
// C muse.c:green_mon().
function green_mon(monster, state) {
    return !heroIsHallucinating(state)
        && [CLR_GREEN, CLR_BRIGHT_GREEN].includes(MONSTER_COLOR[monster.mnum] ?? -1);
}
// C muse.c:ureflects().
// Ray and gaze callers use this source in their reflection messages.
// discoverHeroReflectionSource handles shield and amulet discovery.
export function ureflects(state = game) {
    if (state.uarms?.otyp === SHIELD_OF_REFLECTION)
        return { object: state.uarms, noun: 'shield' };
    const weapon = state.uwep || state.u?.uwep;
    if (weaponReflects(weapon, state))
        return { object: weapon, noun: 'weapon' };
    const amulet = state.uamul || state.u?.uamul;
    if (amulet?.otyp === AMULET_OF_REFLECTION)
        return { object: amulet, noun: 'medallion' };
    const armor = state.uskin || state.uarm || state.u?.uarm;
    if (armor && [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL]
        .includes(armor.otyp)) {
        return { object: armor, noun: state.uskin ? 'luster' : 'armor' };
    }
    if (MONSTER_NAME[state.u.umonnum ?? -1] === 'silver dragon')
        return { object: null, noun: 'scales' };
    return null;
}
export function heroReflectsRay(state = game) {
    return !!(state.u?.reflection
        || ureflects(state));
}
// C muse.c:mon_reflects().
export function mon_reflects(monster, state = game) {
    const shield = wornInSlot(monster, W_ARMS);
    if (shield?.otyp === SHIELD_OF_REFLECTION)
        return { noun: 'shield', object: shield };
    const weapon = monsterWieldedWeapon(monster);
    if (weaponReflects(weapon, state)) {
        return { noun: 'weapon', object: weapon };
    }
    const amulet = wornInSlot(monster, W_AMUL);
    if (amulet?.otyp === AMULET_OF_REFLECTION)
        return { noun: 'amulet', object: amulet };
    const suit = wornInSlot(monster, W_ARM);
    if (suit && [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL]
        .includes(suit.otyp)) {
        return { noun: 'armor', object: suit };
    }
    const species = MONSTER_NAME[monster?.mnum];
    if (species === 'silver dragon' || species === 'Chromatic Dragon')
        return { noun: 'scales', object: null };
    return null;
}
export function monsterReflectsRay(monster, state = game) {
    return mon_reflects(monster, state) !== null;
}
export function discoverHeroReflectionSource(source = ureflects(), state = game) {
    const object = source?.object;
    if (!object || ![SHIELD_OF_REFLECTION, AMULET_OF_REFLECTION].includes(object.otyp)
        || state._knownObjectTypes?.has(object.otyp))
        return;
    exerciseWisdom(true, state);
    recordObjectKnowledge(object.otyp, state);
}
//# sourceMappingURL=muse.js.map