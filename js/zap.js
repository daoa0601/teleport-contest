// Ray attacks, terrain changes, and elemental item damage.
// C ref: zap.c dobuzz(), zap_over_floor(), zhitm(), zhitu(), destroy_items(),
// learnwand(), zappable(), zapnodir(), backfire(), dozap(), zap_steed(),
// zap_updown(), weffects(), zap_map(), and bhit()'s ZAPPED_WAND branch.
import { finishBuriedRevival, landFloorObject } from './do.js';
import { RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, } from './objclass.js';
import { objectClassForType, objectMerge, objectMagic, objectCharged, objectDirection, AMULET_OF_YENDOR, BELL_OF_OPENING, CORPSE, CRYSTAL_BALL, MAGIC_LAMP, SPE_NOVEL, OBJECT_NAMES, POT_ACID, POT_FRUIT_JUICE, POT_SICKNESS, POT_WATER, SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, WAN_CANCELLATION, AMULET_OF_UNCHANGING, BOULDER, CHEST, EGG, ENORMOUS_MEATBALL, FIGURINE, LARGE_BOX, LEASH, MAGIC_MARKER, MEATBALL, MEAT_RING, MEAT_STICK, OIL_LAMP, POT_GAIN_ABILITY, POT_OIL, POT_POLYMORPH, ROCK, SPE_POLYMORPH, STATUE, UNICORN_HORN, getObjectClassBounds, WAN_LIGHT, WAN_LIGHTNING, WAN_POLYMORPH, WAN_WISHING, DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, RIN_SHOCK_RESISTANCE, SCR_FIRE, SPE_FIREBALL, WAN_STRIKING, SPE_CURE_SICKNESS, SPE_DETECT_UNSEEN, SPE_DIG, SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT, SPE_HEALING, SPE_LIGHT, SPE_MAGIC_MISSILE, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, WAN_CREATE_MONSTER, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_SECRET_DOOR_DETECTION, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_TELEPORTATION, TIN, BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, SPE_CONE_OF_COLD, SPE_SLEEP, SPE_TURN_UNDEAD, WAN_COLD, WAN_DEATH, WAN_FIRE, WAN_SLEEP, WAN_UNDEAD_TURNING, objectPropertyName, } from './object_data.js';
import { mimicHitMessage } from './mon.js';
import { OBJ_NAME } from './object_data.js';
import { objectMaterial, learnObjectType, observeObject, objectTypeKnown } from './o_init.js';
import { convertSecretDoor, findit, revealSecretDoor, showMapSpot } from './detect.js';
import { monsterAt, monsterHasMapPosition, monsterAtPosition } from './steed.js';
import { chooseInventoryObject, stack_object } from './invent.js';
import { GETOBJ_EXCLUDE, GETOBJ_SUGGEST, PLNMSG_ENVELOPED_IN_GAS, ZAP_POS, ANTI_MAGIC, CORR, DBWALL, D_CLOSED, D_LOCKED, DOOR, DRAWBRIDGE_DOWN, ENGRAVE, ENL_GAMEINPROGRESS, EXPL_MAGICAL, HEADSTONE, HOLE, IS_FURNITURE, Is_airlevel, LEVEL_TELEP, MAGICENLIGHTENMENT, MAGIC_PORTAL, MAGIC_TRAP, POLY_TRAP, SCORR, TELEP_TRAP, TRAPDOOR, TRAP_EXPLODE, VIBRATING_SQUARE, A_CON, A_CHA, W_ARMH, A_WIS, W_ARMG, A_DEX, A_STR, A_INT, W_RING, W_ARMOR, G_GENOD, MAX_OIL_IN_FLASK, MAX_SPELL_STUDY, MM_NOMSG, NO_MINVENT, W_AMUL, W_ART, W_ARTI, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP, COLNO, DB_FLOOR, DB_ICE, DB_UNDER, DRAWBRIDGE_UP, FOUNTAIN, SHOP_BARS_COST, SHOP_DOOR_COST, D_BROKEN, D_NODOOR, HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, IS_WALL, IS_WATERWALL, Is_rogue_level, Is_waterlevel, ismnum, LAVAWALL, PIT, POOL, ROOM, ROWNO, SDOOR, TT_INFLOOR, TT_LAVA, Upolyd, VWALL, WEB, W_NONDIGGABLE, SHOPBASE, BOLT_LIM, LEVEL_TIMER_KIND, OBJECT_TIMER_KIND, HEAD, FACE, FOOT, ARM, EYE, LL_CONDUCT, LL_ARTIFACT, LL_WISH, } from './const.js';
import { isok } from './cmd.js';
import { isIceAt, isLavaAt, isMoatAt, isPoolAt, closeDrawbridge, destroyDrawbridge, findDrawbridgeAt, openDrawbridge, drawbridgeUnderlyingType } from './dbridge.js';
import { heroHasArtifactDefense, heroHasCarriedArtifactFlag, artifactById } from './artifact.js';
import { adjustHeroAlignment, exerciseAttribute, exerciseWisdom, currentAttribute, poisonHero } from './attrib.js';
import { canSeeMonster, consumeHallucinatedMenuObjectGlyph, docrt, glyphAt, newsym, shieldeff, unmap_invisible } from './display.js';
import { formatFeltMessage, pline, plineWithContinuation, publishHeardMessage, recordGameLogEvent, set_msg_dir, impossible, } from './pline.js';
import { waterbodyName } from './pager.js';
import { resetPick, changeDoorByMagic, changeBoxLockByMagic } from './lock.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { monsterHasFireResistance, monsterHasShockResistance, monsterHasSeductionAttack, monsterResistanceBits, carnivorous, monsterDigests, monsterHasEyes, monsterHasNoHands, monsterHasProperName, monsterIsDemon, monsterIsGolem, monsterIsMindless, monsterIsNonliving, monsterIsPlayerMonster, monsterIsRider, monsterIsSwimmer, monsterIsUndead, monsterIsVampireShifter, monsterIsWhirly, monsterYoungerForm, heroResistsStoning, touchPetrifies, eyecount, resistsBlnd } from './mondata.js';
import { setHeroTrap, dotrap, mintrap, objectIsVulnerableToErosion, deleteTrap, trapName, closeHoldingTrap, openFallingTrap, openHoldingTrap, sokobanGuilt, igniteItems, resetUtrap, maketrap, deleteFloorTrap, meltIceTrap, activateStatueTrapAt, animateStatue, } from './trap.js';
import { displayColorName, displayLiquidName, monsterName, randomDisplayMonsterName, monsterTypeName } from './do_name.js';
import { possessiveName, mungSpaces } from './hacklib.js';
import { commandResultCancelled } from './cmd.js';
import { removeHeroAccessory, wearHeroAccessory, objectIsHardHelmet, applyArmorOnEffects, armorSlotFor, wearHeroArmor, isEyewear, wearEyewear } from './do_wear.js';
import { removeWornHeroItem } from './steal.js';
import { rechargeRing, unpunishHero } from './read.js';
import { finishHeroDeath } from './end.js';
import { consumeInventoryItem, inventoryItemDescription, delobj, inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './invent.js';
import { useUpInventoryStack, prepareInventoryAddition, finishInventoryAddition, finishInventoryRemoval, displayBuriedInventory, probedContentsTitle, engulfedHeroMenuSection } from './invent.js';
import { cleanupTransientLight, showTransientLight } from './light.js';
import { lightRoom } from './read.js';
import { buryFloorObjectsAt, formatDraftMessage, zapDigWithObject } from './dig.js';
import { CANDELABRUM_OF_INVOCATION } from './mklev.js';
import { randomEngraving } from './engrave.js';
import { fix_wall_spines } from './mkmaze.js';
import { makePlural, withIndefiniteArticle, objectDescription, definiteName, definiteObjectAction, killerObjectName, objectName, ownedObjectName, observeObjectForNaming, observeDistantObjectForNaming, pluralizeObjectNoun, rndClass, erosionMatters, simpleArmorName } from './objnam.js';
import { objectQuantity, splitObjectStack, mksobj, unblessObjectState, uncurseObjectState, mkobj, set_corpsenm, replaceObject, unlinkObject, objectWeight, updateIceObjectTimersAt, placeCreatedObject, placeObject, isContainer, remove_object, sweepFloorPile, chargeAlteredUnpaidObject, } from './mkobj.js';
import { MONSTER_BODY_META, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_SYMBOL, requireMonsterData, } from './monster_data.js';
import { scheduleLevelTimer, stopLevelTimer, objectsInTimerGraph, objectTimers, scheduleObjectTimer, stopObjectTimer, stopObjectTimers } from './timeout.js';
import { applySupportedPotionVapor } from './potion.js';
import { heroHasNoHands, heroFormHidesUnderObjects, body_part } from './polyself.js';
import { createPoisonGasCloud } from './region.js';
import { dryFountainAt } from './fountain.js';
import { stopHeroOccupation } from './allmain.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { promptDirection } from './cmd.js';
import { cansee, couldsee, vision_note_blocker_change } from './vision.js';
import { chargeUnpaidUsage, addShopDamage, payForShopDamage, addShopObjectToBill, costlySpot, stolenValue, hotPursuitShopkeeper, makeAngryShopkeeper, deleteObjectContents, shopkeeperInOwnShop, containedBuyCost } from './shk.js';
import { hasCarriedProperty, hasIntrinsicProperty, hasTimedProperty, hasWornProperty } from './properties.js';
import { heroDetectsMonsters, heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2 } from './monster_attack_types.js';
import { showInventoryWindow } from './windows.js';
import { useUpFloorObject } from './invent.js';
import { changeMonsterForm, copyPetData, normalizeMonsterShape, wakeMonster, maybeUnhideAt, revealMonsterAppearance, checkMonsterGearNextTurn, } from './mon.js';
import { setMonsterPermanentInvisibility, bypassObjectList, nextUnbypassedObject, bypassObject, adjustMonsterSpeed, monsterSpeedMessage, destroyObjectFromMonsterInventory, findMonsterArmorClass, wornInSlot, removeObjectFromMonsterInventory, removeHeroEquipment, } from './worn.js';
import { redrawMonsterWormSegments } from './worm.js';
import { monsterHasMagicResistance } from './mondata.js';
import { finishHeroMonsterKill, finishHeroLiquidMonsterDeath } from './mon.js';
import { monsterHitPointsPerLevel, createCritters, makemonAt } from './makemon.js';
import { recordMappedOverviewState, ceilingName, surfaceName, In_mines, Invocation_lev } from './dungeon.js';
import { forceDescribeDecor } from './pickup.js';
import { deleteEngravingAt, engravingAt, makeEngravingAt, wipeEngravingAt, relocateEngraving } from './engrave.js';
import { addExperience } from './exper.js';
import { explode } from './explode.js';
import { monsterStatusLine, enlightenment } from './insight.js';
import { gotoLevel } from './do.js';
import { okToQuest, onQuestStart } from './quest.js';
import { askTeleportDestination, heroControlsTeleport, teleportHero } from './teleport.js';
import { bot } from './botl.js';
import { isWeaponTool, isBimanualObject, isPoisonableObject, objectIsMetallic } from './object_properties.js';
import { hatchableEggSpecies, eggSpeciesIsDead } from './mon.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat } from './wield.js';
import { releaseObjectLeash, snuffCandle } from './apply.js';
import { vegetarianCorpse } from './food_traits.js';
import { updateInventoryPresentation } from './invent.js';
import { shopkeeperName } from './shknam.js';
import { roomsAt, loseHeroHp, exceedsActionCapacity } from './hack.js';
import { setArtifactOrigin } from './artifact.js';
import { heroIsPunished } from './ball.js';
import { dropBoulderIntoLiquid } from './do.js';
import { xyToDirection } from './cmd.js';
import { DIED, EXPL_FIERY, GRAVE, IS_ROOM, Luck, MOAT, M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, M_SEEN_SLEEP, NHW_MENU, NON_PM, PICK_ONE, PLNMSG_OBJ_GLOWS, P_BASIC, P_EXPERT, P_SKILLED, STONE, STRAT_WAITMASK, W_ARM, W_ARMC, W_ARMS, W_ARMU } from './const.js';
import { unearthFloorObjectsAt } from './dig.js';
import { canSenseMonster, canSpotMonster, flush_screen, lastDirtyMapCursor, map_invisible, zapdir_to_glyph, TemporaryMapEffect } from './display.js';
import { namelessMonsterName } from './do_name.js';
import { disintegrateWornArmor, findArmorClass, heroHasDrainResistance } from './do_wear.js';
import { finishMonsterEating } from './dogmove.js';
import { attachEggHatchTimer } from './timeout.js';
import { encumber_msg } from './pickup.js';
import { loseHeroExperience } from './exper.js';
import { requireGameLevel } from './gstate.js';
import { applyHeroLocationEffects, burnAwayHeroSlime, nomul } from './hack.js';
import { releaseHeroFromMonster } from './mon.js';
import { setHeroGrip } from './mon.js';
import { holdAnotherObject } from './invent.js';
import { zapHeroInvisible } from './hero_invisibility.js';
import { heroStatusLine } from './insight.js';
import { mergeObjectStacks } from './invent.js';
import { monsterSpellDeathReason } from './mcastu.js';
import { putMonsterToSleep, sleptMonst } from './mhitm.js';
import { heroHasRemovableSpeed, u_slow_down, expelHero, holdingMonsterName, } from './mhitu.js';
import { finishMonsterKilled, finishMonsterLiquidDeath, healMonster, resolveMonsterLiquid, shieldMonster } from './mon.js';
import { monsterHasAcidResistance, monsterHasColdResistance, monsterHasDisintegrationResistance, monsterHasPoisonResistance, monsterResistsSleep, monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage } from './mondata.js';
import { wornMonsterLifeSaver } from './mon.js';
import { closedDoor, makeMonsterFlee, dissolveBars } from './monmove.js';
import { AD_RBRE, AT_BREA } from './monster_attack_types.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { discoverHeroReflectionSource, ureflects, heroReflectsRay, mon_reflects, monsterReflectsRay } from './muse.js';
import { corpseName, distantObjectName, minimalObjectName, readObjectName, singularObjectName } from './objnam.js';
import { applyHeroGolemEffects, heroFormSticks, heroIsUnchanging, heroMonsterForm, heroSpecies, polymonHero, polymorphHero, returnHeroToHumanForm } from './polyself.js';
import { clearHeroSliming, healHero, makeBlinded, makeStunned, speedUpHero } from './potion.js';
import { propertyIsActive } from './properties.js';
import { getLine } from './windows.js';
import { capitalizedDefiniteName } from './objnam.js';
import { liveSpellSkill } from './spell.js';
import { clearHeroPetrification, heroIsPetrifying } from './stoning.js';
import { relocateObjectRandomly } from './teleport.js';
import { putHeroToSleep } from './timeout.js';
import { burnArmorByFire, damageObjectWithAcid, fillPitWithBoulderAt } from './trap.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu } from './wintty.js';
import { flushPendingTopline } from './topl.js';
import { monsterHasLineOfSightToHero, vision_recalc } from './vision.js';
import { monsterWieldedWeapon } from './weapon.js';
import { showTextWindow } from './windows.js';
import { M_AP_FURNITURE, M_AP_OBJECT, W_SADDLE } from './const.js';
import { abusePet } from './dog.js';
import { checkExperienceLevel } from './exper.js';
import { flashHitsMonster } from './uhitm.js';
import { finishHeroMonsterKillOutcome } from './mon.js';
import { m_is_steadfast, erodeArmor } from './uhitm.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { revealMimicIdentity } from './uhitm.js';
import { respondToImmediateMagic, wakeAttackedMonster } from './mon.js';
import { MONSTER_SIZE } from './monster_data.js';
import { hurtleMonster, hitMonsterWithThrownObject } from './dothrow.js';
import { teleportMonsterByHero } from './teleport.js';
import { setMimicAppearance } from './makemon.js';
import { monsterHasDrainResistance } from './mondata.js';
import { objectUsesKnown } from './object_data.js';
import { CORPSTAT_HISTORIC } from './const.js';
import { shopClaimsObject } from './shk.js';
import { breakObjectAtLocation } from './dothrow.js';
import { visionCellBlocksLight } from './vision.js';
import { placeObjectSynchronously } from './mkobj.js';
import { breakFloorObject } from './dothrow.js';
import { verbForSubject } from './objnam.js';
import { rndHallublast } from './mthrowu.js';
import { CLR_WHITE } from './terminal.js';
import { show_glyph_cell } from './display.js';
import { CmapSymbol, cmapToGlyph } from './glyph_numbers.js';
import { seeMonsterCloseup } from './mon.js';
import { SINK, xdir, ydir } from './const.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { CLR_BROWN } from './terminal.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { corpseName as corpseObjectName } from './objnam.js';
import { linkObjectToMonsterInventory, unlinkMonsterObject } from './mkobj.js';
import { setMonsterGivenName } from './do_name.js';
import { IS_POOL, MFAST, MM_NOCOUNTBIRTH, MM_NOTAIL, MM_NOWAIT } from './const.js';
import { isReviver } from './mon.js';
import { makePetWary, tameMonster } from './dog.js';
import { newuhs } from './eat.js';
import { delobjCore } from './invent.js';
import { makemonNear } from './mklev.js';
import { removeMonsterFromGame, restoreMonsterShape } from './mon.js';
import { upstart } from './hacklib.js';
import { objectOwnershipPrefix, restoreShopkeeperResidency, deleteObject } from './shk.js';
import { BAG_OF_HOLDING } from './object_data.js';
import { enexto } from './teleport.js';
import { markQuestLeaderAlive } from './quest.js';
import { bodyGenderFlags, PM_DOPPELGANGER, PM_HUMAN_ZOMBIE, revivalReplacement } from './read.js';
import { isQuantumBox } from './quantum_cat.js';
import { monsterIsEel } from './mondata.js';
import { requireInitializedHero } from './hero_types.js';
const NODIR = 1, IMMEDIATE = 2;
const MAX_ITEMS_DESTROYED = 20;
const RAY_FIRE = 'fire';
const RAY_COLD = 'cold';
const RAY_DISINTEGRATION = 'disintegration';
const RAY_LIGHTNING = 'lightning';
const RAY_ACID = 'acid';
export const INVENTORY_DAMAGE = Object.freeze({
    COLD: 'cold',
    FIRE: 'fire',
    ELECTRIC: 'electric',
});
const POTION_ATTACK_LEVEL = 6;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
// Cancellation applied to a monster.
// C ref: zap.c cancel_monst() and mon.c normal_shape().
const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
// Cancellation changes an actual object, including worn bonuses and timers.
// C ref: zap.c cancel_item() and blank_novel().
const SPE_CANCELLATION = OBJECT_NAMES.indexOf('cancellation');
const POT_SEE_INVISIBLE = OBJECT_NAMES.indexOf('see invisible', 297);
// Object transformations, system shock, and material golems.
// C zap.c:obj_shudders(), do_osshock(), poly_obj(), polyuse(), create_polymon().
const STRANGE_OBJECT = 0;
const WOOD = 8, FLESH = 4, LEATHER = 7, CLOTH = 6, BONE = 9;
const IRON = 11, METAL = 12, COPPER = 13, SILVER = 14, GOLD = 15;
const PLATINUM = 16, MITHRIL = 17, GLASS = 19, GEMSTONE = 20, MINERAL = 21;
const PAPER = 5;
const LARGEST_INT = 32767;
const PM_CROCODILE = MONSTER_NAME.indexOf('crocodile');
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
// C obj.h:Is_box()
const isBox = (object) => object.otyp === CHEST || object.otyp === LARGE_BOX;
const WAN_OPENING = OBJECT_NAMES.indexOf('opening');
const WAN_LOCKING = OBJECT_NAMES.indexOf('locking');
const WAN_PROBING = OBJECT_NAMES.indexOf('probing');
const WAN_NOTHING = OBJECT_NAMES.indexOf('nothing');
const SPE_KNOCK = OBJECT_NAMES.indexOf('knock');
const SPE_WIZARD_LOCK = OBJECT_NAMES.indexOf('wizard lock');
const SPE_DRAIN_LIFE = OBJECT_NAMES.indexOf('drain life');
const CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
const STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');
const FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const DIRECTION_X = Object.freeze({
    h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1,
});
const DIRECTION_Y = Object.freeze({
    h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1,
});
// zhitm uses this value to request disintegration from its caller.
const MAGIC_COOKIE = 1000;
const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const DIRECTIONS = Object.freeze({
    h: [-1, 0], l: [1, 0], j: [0, 1], k: [0, -1],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
    '<': [0, 0], '>': [0, 0],
});
const names = {
    wand: ['magic missile', 'bolt of fire', 'bolt of cold', 'sleep ray',
        'death ray', 'bolt of lightning', '', '', '', ''],
    spell: ['magic missile', 'fireball', 'cone of cold', 'sleep ray',
        'finger of death', 'bolt of lightning', '', '', '', ''],
    breath: ['blast of missiles', 'blast of fire', 'blast of frost',
        'blast of sleep gas', 'blast of disintegration', 'blast of lightning',
        'blast of poison gas', 'blast of acid', '', ''],
};
const S_ZOMBIE = 52;
const G_UNIQ = 0x1000;
const PM_GHOST = 287;
const PM_GREMLIN = 40;
// C zap.c:zaptype().
function normalizedRayType(type) {
    return type <= -30 ? -type - 30 : Math.abs(type);
}
// C zap.c:learnwand().
export function learnWand(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.oclass === SPBOOK_CLASS)
        return; // Spell pseudo-objects do not rediscover books.
    if (objectTypeKnown(object, state))
        observeObject(object, state);
    else {
        if (!heroIsBlind(state))
            observeObject(object, state);
        if (object.dknown)
            learnObjectType(object.otyp, state);
    }
}
// C zap.c:bhitm().
// Direction and range belong to the caller.
export async function hitMonsterWithWand(monster, wand, { state = game, x = monster.mx, y = monster.my, } = {}) {
    requirePlayingGame(state);
    const source = wand.oclass === SPBOOK_CLASS ? 'spell' : 'wand';
    const attackLevel = source === 'wand' ? 12 : state.u.ulevel;
    const onHead = monster.mx === x && monster.my === y;
    state.notonhead = !onHead;
    let wake = true, alreadyWoke = false, reveal = false, learned = false, result = 0;
    const options = { random: rn2, roll: rnd, rollDice: d, finishMonsterKill: finishHeroMonsterKill };
    switch (wand.otyp) {
        case WAN_STRIKING:
        case SPE_FORCE_BOLT: {
            alreadyWoke = true;
            reveal = true;
            learned = cansee(x, y);
            if (monsterHasMagicResistance(monster)) {
                await revealMonsterAppearance(monster, { includeMonsterDisguise: false });
                await shieldeff(monster.mx, monster.my, state);
                await plineWithContinuation('Boing!');
                await wakeAttackedMonster(monster);
            }
            else if (state.u.uswallow || rnd(20) < 10 + findMonsterArmorClass(monster)) {
                await revealMonsterAppearance(monster);
                let damage = d(2, 12);
                if (state.urole.key === 'knight' && state.u.uhave.questart)
                    damage *= 2;
                if (source === 'spell')
                    damage = adjustSpellDamage(damage, state);
                await plineWithContinuation(rayHitMessage(source, monster, {
                    x: monster.mx, y: monster.my, damage, state,
                }));
                if (monsterResistsEffect(monster, attackLevel, rn2)) {
                    damage = Math.ceil(damage / 2);
                    await shieldeff(monster.mx, monster.my, state);
                    if (cansee(monster.mx, monster.my))
                        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} resists!`);
                }
                monster.mhp = (monster.mhp ?? 1) - damage;
                if (monster.mhp <= 0)
                    await finishHeroMonsterKill(monster, monster.mx, monster.my);
                if (monster.mhp > 0 && !monster.dead)
                    await wakeAttackedMonster(monster);
            }
            else {
                if (!monster.m_ap_type) {
                    await plineWithContinuation(rayMissMessage(source, monster, {
                        x: monster.mx, y: monster.my, state,
                    }));
                }
                await wakeAttackedMonster(monster);
                learned = false;
            }
            break;
        }
        case WAN_SLOW_MONSTER:
        case SPE_SLOW_MONSTER:
        case WAN_SPEED_MONSTER:
            learned = await affectMonsterSpeed(monster, wand.otyp === WAN_SPEED_MONSTER ? 'speed' : 'slow', source, state, options);
            alreadyWoke = true;
            break;
        case WAN_UNDEAD_TURNING:
        case SPE_TURN_UNDEAD:
            if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster)) {
                await turnMonsterWithUndeadMagic(monster, source, state, {
                    ...options, wakeMonster: wakeAttackedMonster,
                });
                alreadyWoke = true;
                reveal = true;
            }
            else {
                wake = !!await turnCarriedObjects(monster.minvent || monster.inventory || [], state);
            }
            break;
        case WAN_POLYMORPH:
        case SPE_POLYMORPH:
        case POT_POLYMORPH: {
            const spotted = canSeeMonster(monster);
            const giveMessage = !heroIsHallucinating(state)
                && (spotted || state.u.uswallow && state.u.ustuck === monster);
            const change = await polymorphMonsterFromMagic(monster, {
                state, targetSpotted: spotted,
                attackLevel: wand.otyp === POT_POLYMORPH ? 6 : attackLevel,
                polyspot: wand.otyp !== POT_POLYMORPH,
                publish: plineWithContinuation,
                showShield: target => shieldMonster(target, state),
                finishDeath: (target, death) => finishHeroMonsterKillOutcome(target, target.mx, target.my, death),
            });
            learned = !!(change.systemShock && spotted
                || change.changed && giveMessage && (canSpotMonster(monster) || state.u.ustuck === monster));
            break;
        }
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
            await revealMonsterAppearance(monster);
            await cancelMonster(monster, { state, attackLevel });
            break;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY:
            await revealMonsterAppearance(monster);
            reveal = !await teleportMonsterByHero(monster, { state });
            learned = canSpotMonster(monster);
            break;
        case WAN_MAKE_INVISIBLE:
            learned = await makeMonsterInvisible(monster);
            reveal = learned;
            alreadyWoke = true;
            break;
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK: {
            await revealLockMimic(monster, state);
            const trap = await closeHoldingTrap(monster, { state });
            wake = trap.changed;
            learned = trap.noticed;
            break;
        }
        case WAN_PROBING:
            wake = false;
            reveal = learned = true;
            await probeMonster(monster, { state, onHead, x, y });
            break;
        case WAN_OPENING:
        case SPE_KNOCK: {
            await revealLockMimic(monster, state);
            wake = false;
            if (monster === state.u.ustuck) {
                await releaseHold(state);
                learned = true;
                break;
            }
            const held = await openHoldingTrap(monster, { state });
            learned = held.noticed;
            if (held.changed)
                break;
            const falling = await openFallingTrap(monster, { state, trapdoorOnly: true });
            learned ||= falling.noticed;
            if (falling.changed)
                break;
            if (wand.otyp === SPE_KNOCK) {
                wake = true;
                result = 1;
                if ((MONSTER_SIZE[monster.mnum] ?? 0) < 2 && !m_is_steadfast(monster, state)) {
                    if (canSeeMonster(monster))
                        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} is knocked back!`);
                    await hurtleMonster(monster, monster.mx - state.u.ux, monster.my - state.u.uy, rnd(2), { state });
                }
                else if (canSeeMonster(monster))
                    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} doesn't budge.`);
                if (alive(monster)) {
                    await wakeMonster(monster, { attacked: !monsterIsMindless(monster.mnum) });
                    await abusePet(monster, state);
                }
            }
            else
                await dropSaddle(monster, state);
            break;
        }
        case SPE_HEALING:
        case SPE_EXTRA_HEALING: {
            reveal = true;
            const extra = wand.otyp === SPE_EXTRA_HEALING;
            const amount = d(6, extra ? 8 : 4);
            if (MONSTER_NAME[monster.mnum] === 'Pestilence') {
                await damageMonster(monster, Math.trunc(amount / 2), state.u.ulevel, true, state);
                wake = true;
                break;
            }
            const deficit = monster.mhpmax - monster.mhp;
            healMonster(monster, amount);
            if ((wand.blessed || extra) && !monster.mcansee) {
                monster.mcansee = 1;
                monster.mblinded = 0;
                if (canSeeMonster(monster) && monsterHasEyes(monster.mnum))
                    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} can see again.`);
            }
            if (canSeeMonster(monster)) {
                if (M_AP_TYPE(monster) === M_AP_OBJECT && monster.mappearance === 0) {
                    await setMimicAppearance(monster);
                    await newsym(monster.mx, monster.my);
                }
                else if (M_AP_TYPE(monster) === M_AP_OBJECT) {
                    await mimicHitMessage(monster, state);
                }
                else if (!M_AP_TYPE(monster)) {
                    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} looks${extra ? ' much' : ''} better.`);
                }
            }
            if (monster.mtame && state.urole.key === 'healer' && deficit > 0) {
                addExperience(Math.min(deficit, amount), 0, state);
                await checkExperienceLevel();
            }
            if (monster.mtame || monster.mpeaceful)
                adjustHeroAlignment(state.urole.key === 'healer' ? 1 : Math.sign(state.u.ualign.type), state);
            wake = false;
            break;
        }
        case WAN_LIGHT: {
            const flashed = await flashHitsMonster(monster, wand, { state, onHead });
            learned = reveal = flashed.observed;
            break;
        }
        case WAN_SLEEP:
            reveal = true;
            await sleepMonsterWithMagic(monster, d(1 + wand.spe, 12), state);
            learned = !heroIsBlind(state);
            break;
        case SPE_STONE_TO_FLESH:
            wake = await fleshMonster(monster, state);
            break;
        case SPE_DRAIN_LIFE:
            await revealMonsterAppearance(monster);
            await drainMonster(monster, attackLevel, state);
            break;
        case WAN_NOTHING:
            wake = false;
            break;
        default:
            await impossible(`What an interesting effect (${wand.otyp})`, { state });
            break;
    }
    if (state.program_state?.gameover)
        return result;
    if (wake && alive(monster)) {
        if (!alreadyWoke)
            await wakeAttackedMonster(monster);
        if (!state.program_state?.gameover)
            await respondToImmediateMagic(monster, state);
        if (monster.isshk && !state.u.ushops?.length)
            hotPursuitShopkeeper(monster, state);
    }
    if (reveal && alive(monster) && cansee(x, y) && !canSpotMonster(monster))
        await map_invisible(x, y);
    if (learned)
        learnWand(wand, { state });
    return result;
}
// C display.h:_knowninvisible(): minvis && ((cansee(mx,my)
// && (See_invisible || Detect_monsters)) || (!Blind
// && (HTelepat & ~INTRINSIC) && mdistu(mon) <= BOLT_LIM * BOLT_LIM)).
// prop.h INTRINSIC = FROMOUTSIDE|FROMRACE|FROMEXPER, so HTelepat & ~INTRINSIC
// keeps the polymorphed form's telepathy (polyself.c PROPSET(TELEPAT,
// telepathic(mdat))) and a #wizintrinsic timeout (TIMEOUT bits; timeout.c
// notes TELEPAT only times out that way); worn extrinsic telepathy (ETelepat:
// helm of telepathy, amulet of ESP) and plain gained intrinsics do not
// qualify.
function knownInvisible(monster, state = game) {
    if (!monster.minvis)
        return false;
    const hero = state.u;
    if (cansee(monster.mx, monster.my)
        && (hero.seeInvisible || (hero.seeInvisibleTurns ?? 0) > 0
            || heroDetectsMonsters(state)))
        return true;
    const inRangeTelepathy = hasTimedProperty('telepathy', state)
        || hasIntrinsicProperty('telepathy', 'form', state);
    if (heroIsBlind(state) || !inRangeTelepathy)
        return false;
    const distance = (monster.mx - hero.ux) ** 2 + (monster.my - hero.uy) ** 2;
    return distance <= BOLT_LIM ** 2;
}
// Part of C zap.c:bhitm(): apply monster invisibility and its observable messages.
export async function makeMonsterInvisible(monster) {
    const wasInvisible = !!monster.minvis;
    const wasVisible = canSeeMonster(monster);
    await revealMonsterAppearance(monster);
    const name = monsterName(monster, { capitalized: true });
    setMonsterPermanentInvisibility(monster);
    if (!monster.invis_blkd) {
        await newsym(monster.mx, monster.my);
        if (monster.wormno)
            await redrawMonsterWormSegments(monster);
    }
    let identified = false;
    if (!wasInvisible && knownInvisible(monster)) {
        await plineWithContinuation(`${name} turns transparent!`);
        identified = true;
    }
    else if (wasVisible
        && !canSeeMonster(monster)) {
        await plineWithContinuation(`${name} vanishes!`);
    }
    await wakeMonster(monster, { attacked: true });
    return identified;
}
// Part of C zap.c:bhitm(): apply speed or slowing magic, including whirly engulfers.
export async function affectMonsterSpeed(monster, kind, source, state, options) {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(monster, attackLevel, options.random);
    let observed = false;
    if (!resisted) {
        await revealMonsterAppearance(monster);
        const speed = adjustMonsterSpeed(monster, kind === 'speed' ? 1 : -1);
        checkMonsterGearNextTurn(monster);
        if (speed.changed && speed.canDescribe && canSeeMonster(monster)) {
            const subject = monsterName(monster, { state, capitalized: true });
            const message = monsterSpeedMessage(speed, subject);
            if (message) {
                await plineWithContinuation(message);
                observed = true;
            }
        }
        if (kind === 'slow' && state.u?.uswallow
            && state.u?.ustuck === monster && monsterIsWhirly(monster)) {
            await plineWithContinuation(`You disrupt ${holdingMonsterName(monster, state)}!`);
            await plineWithContinuation('A huge hole opens up...');
            await expelHero(monster, {
                state, random: options.random, rollOne: options.roll,
            });
        }
    }
    await wakeMonster(monster, { attacked: kind === 'slow' });
    return observed;
}
// Part of C zap.c:bhitm(): recognize a long worm already polymorphed during this attack.
function alreadyChangedThisAttack(monster) {
    const corpseSpecies = monster.mcorpsenm;
    const extraCorpseSpecies = monster.mextra?.mcorpsenm;
    return (corpseSpecies !== undefined && Number.isInteger(corpseSpecies) && corpseSpecies >= 0)
        || (extraCorpseSpecies !== undefined && Number.isInteger(extraCorpseSpecies)
            && extraCorpseSpecies >= 0);
}
// Part of C zap.c:bhitm(): mark a newly polymorphed long worm for bypass handling.
function markNewLongWorm(monster, state) {
    if (monster.mnum !== PM_LONG_WORM)
        return;
    if (!monster.mextra)
        monster.mextra = {};
    monster.mextra.mcorpsenm = PM_LONG_WORM;
    state.context.bypasses = true;
}
// Part of C zap.c:bhitm(): resist polymorph, roll system shock, or change the monster's form.
export async function polymorphMonsterFromMagic(monster, { state = game, targetSpotted = false, wakeMonster, publish = plineWithContinuation, showShield, finishDeath, attackLevel = POTION_ATTACK_LEVEL, polyspot = false, } = {}) {
    if (monster.mnum === PM_LONG_WORM
        && alreadyChangedThisAttack(monster)) {
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return { changed: false, alreadyChanged: true, killed: false };
    }
    const magicResistant = monsterHasMagicResistance(monster);
    if (magicResistant)
        await showShield?.(monster);
    const resisted = !magicResistant
        && monsterResistsEffect(monster, attackLevel);
    let systemShock = false;
    let change = null;
    let selfTouch = null;
    if (!magicResistant && !resisted) {
        if (polyspot) {
            bypassObjectList(monster.minvent || monster.inventory || [], true, state);
        }
        const naturalSpecies = monster.cham;
        const naturalShapechanger = naturalSpecies !== undefined
            && Number.isInteger(naturalSpecies) && naturalSpecies >= 0;
        systemShock = !naturalShapechanger && rn2(25) === 0;
        if (systemShock) {
            if (targetSpotted)
                await publish(`${monsterName(monster, { state, capitalized: true })} shudders!`);
            if (!finishDeath)
                throw new Error('polymorph fatality owner unavailable');
            const death = await finishDeath(monster, { noCorpse: true });
            if (death.heroDied)
                return { heroDied: true };
        }
        else {
            const heroInsideTarget = !!state.u.uswallow
                && state.u.ustuck === monster;
            const changeOptions = {
                showMessage: !heroIsHallucinating(state) && (targetSpotted || heroInsideTarget),
                creditHero: true,
                finishDeath: (target, death) => {
                    if (!finishDeath)
                        throw new Error('polymorph self-touch requires a monster death handler');
                    return finishDeath(target, {
                        ...death,
                        showKillMessage: false,
                        recordConduct: false,
                    });
                },
                publish,
                polyspot,
            };
            change = await changeMonsterForm(monster, null, state, changeOptions);
            if (!change && naturalShapechanger)
                change = await changeMonsterForm(monster, naturalSpecies, state, changeOptions);
            if (change?.heroDied)
                return {
                    changed: true, change, heroDied: true,
                    magicResistant, resisted, systemShock, killed: false,
                };
            selfTouch = change?.selfTouch || null;
        }
        if (alive(monster))
            markNewLongWorm(monster, state);
    }
    const killed = !alive(monster);
    if (!killed && (await wakeMonster?.(monster))?.heroDied)
        return { heroDied: true };
    return {
        changed: !!change,
        change,
        selfTouch,
        magicResistant,
        resisted,
        systemShock,
        killed,
    };
}
// Part of C zap.c:bhitm(): revive carried corpses and damage or frighten an undead target.
export async function turnMonsterWithUndeadMagic(monster, source, state, options) {
    const inventory = monster.minvent || monster.inventory || [];
    const revived = await turnCarriedObjects(inventory, state);
    const affected = monsterIsUndead(monster.mnum)
        || monsterIsVampireShifter(monster);
    if (!affected) {
        if (revived)
            await options.wakeMonster(monster);
        return;
    }
    let damage = options.roll(8);
    if (state.urole?.key === 'knight' && state.u?.uhave?.questart)
        damage *= 2;
    if (source === 'spell')
        damage = adjustSpellDamage(damage, state);
    state.context.bypasses = true;
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(monster, attackLevel, options.random);
    if (resisted) {
        damage = Math.ceil(damage / 2);
    }
    monster.mhp -= damage;
    if (monster.mhp <= 0) {
        await options.finishMonsterKill(monster, monster.mx, monster.my);
        if (monster.dead || monster.mhp <= 0)
            return;
    }
    if (!resisted) {
        const flight = await makeMonsterFlee(monster, {
            state, random: options.random, rollOne: options.roll,
        });
        if (flight.heroDied)
            return true;
    }
    await options.wakeMonster(monster);
    return false;
}
// C monst.h:!DEADMONSTER(mon), plus the runtime dead flag for killed but
// not yet unlinked monsters.
function alive(monster) {
    return !monster.dead && monster.mhp > 0;
}
// Part of C zap.c:bhitm(): reveal a mimic posing as a box or door before locking or opening.
async function revealLockMimic(monster, state) {
    if (M_AP_TYPE(monster) === M_AP_OBJECT && [CHEST, LARGE_BOX].includes(monster.mappearance ?? -1)
        || M_AP_TYPE(monster) === M_AP_FURNITURE
            && (monster.mappearance ?? -1) >= 13 && (monster.mappearance ?? -1) <= 16)
        await revealMimicIdentity(monster, { state });
}
// Part of C mhitm.c:sleep_monst(), mhitm.c:slept_monst(): apply resisted magical sleep and release a sleeping holder's grip.
async function sleepMonsterWithMagic(monster, duration, state) {
    if (!monster.msleeping && !monster.mfrozen && [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster)))
        await revealMonsterAppearance(monster);
    if (monsterResistsSleep(monster) || monsterResistsEffect(monster, 12)) {
        await shieldeff(monster.mx, monster.my, state);
        return;
    }
    if (!await putMonsterToSleep(monster, duration))
        return;
    await finishMonsterEating(monster, state);
    // C mhitm.c:slept_monst(): a sleeping grabber releases the hero.
    await sleptMonst(monster, { state });
}
// Part of C zap.c:bhitm(): magical opening drops a target's saddle.
async function dropSaddle(monster, state) {
    const saddle = (monster.minvent || monster.inventory || []).find(object => (object.owornmask ?? 0) & W_SADDLE);
    if (!saddle)
        return;
    if (cansee(monster.mx, monster.my))
        await plineWithContinuation(`${canSpotMonster(monster) ? possessiveName(monsterName(monster, { capitalized: true })) : 'A'} saddle falls to the ${surfaceName(monster.mx, monster.my, state)}.`);
    else if (canSpotMonster(monster))
        await plineWithContinuation(`${possessiveName(monsterName(monster, { capitalized: true }))} saddle falls off.`);
    await removeObjectFromMonsterInventory(monster, saddle, state);
    await landFloorObject(saddle, monster.mx, monster.my, { state });
}
// Part of C zap.c:resist(): halve resisted damage, apply it, and handle a lethal hit.
async function damageMonster(monster, damage, attackLevel, tell, state) {
    const resisted = monsterResistsEffect(monster, attackLevel);
    if (resisted) {
        damage = Math.ceil(damage / 2);
        if (tell) {
            await shieldMonster(monster, state);
        }
    }
    monster.mhp -= damage;
    if (!alive(monster))
        await finishHeroMonsterKill(monster, monster.mx, monster.my);
    return resisted;
}
// Part of C zap.c:bhitm(): drain life and reduce the surviving monster's level and maximum HP.
async function drainMonster(monster, attackLevel, state) {
    let damage = monsterHitPointsPerLevel(monster);
    if (state.urole.key === 'knight' && state.u.uhave?.questart)
        damage *= 2;
    damage = adjustSpellDamage(damage, state);
    if (monsterHasDrainResistance(monster)) {
        await shieldMonster(monster, state);
        return;
    }
    if (await damageMonster(monster, damage, attackLevel, false, state) || !alive(monster))
        return;
    monster.mhp -= damage;
    monster.mhpmax -= damage;
    if (monster.mhp <= 0 || monster.mhpmax <= 0 || monster.m_lev < 1)
        await finishHeroMonsterKill(monster, monster.mx, monster.my);
    else {
        monster.m_lev--;
        if (canSeeMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} suddenly seems weaker!`);
    }
}
// Part of C zap.c:bhitm(): the stone-to-flesh monster branch.
// Also C mkobj.c:stone_object_type(): the mimicked-object type test is inlined here.
// Also C mkobj.c:stone_furniture_type(): the mimicked-furniture type test is inlined here.
// zap.c stone-to-flesh on a monster: mkobj.c stone_object_type and
// stone_furniture_type decide which mimicked shapes revert to a mimic.
async function fleshMonster(monster, state) {
    if (monsterIsGolem(monster.mnum)) {
        const name = monsterName(monster, { capitalized: true });
        let message = 'looks rather fleshy for a moment.';
        if (MONSTER_NAME[monster.mnum] === 'stone golem'
            && await changeMonsterForm(monster, MONSTER_NAME.indexOf('flesh golem'), state))
            message = 'turns to flesh!';
        else if (MONSTER_NAME[monster.mnum] === 'flesh golem')
            message = 'seems fleshier...';
        if (canSeeMonster(monster))
            await plineWithContinuation(`${name} ${message}`);
        return true;
    }
    const stoneObject = M_AP_TYPE(monster) === M_AP_OBJECT
        && [BOULDER, STATUE, FIGURINE].includes(monster.mappearance ?? -1);
    const stoneFurniture = M_AP_TYPE(monster) === M_AP_FURNITURE
        && ['wall', 'staircase up', 'staircase down', 'branch staircase up',
            'branch staircase down', 'altar', 'opulent throne', 'sink']
            .includes(MAP_SYMBOLS[monster.mappearance ?? -1]?.name ?? '');
    if (stoneObject || stoneFurniture) {
        if (cansee(monster.mx, monster.my))
            await revealMimicIdentity(monster, { state, omitWait: true });
        return true;
    }
    return false;
}
// C zap.c:release_hold().
// Magical opening releases either creature's grip,
// or expels the hero with the ordinary landing effects when swallowed.
export async function releaseHold(state = game) {
    requireLiveGame(state);
    const monster = state.u.ustuck;
    if (!monster) {
        await impossible('release_hold when not held?', { state });
        return { died: false };
    }
    if (state.u.uswallow) {
        if (monsterDigests(monster))
            await plineWithContinuation(heroIsBlind(state)
                ? formatFeltMessage('a sudden rush of air!', state)
                : `${monsterName(monster, { state, capitalized: true })} opens its mouth!`);
        return await expelHero(monster, { state });
    }
    if (heroFormSticks(state)) {
        setHeroGrip(null, state);
        await plineWithContinuation(`You release ${monsterName(monster, { state })}.`);
    }
    else {
        await releaseHeroFromMonster(monster, { state });
        const name = monsterName(monster, { state });
        await plineWithContinuation(`You are released ${monsterHasNoHands(monster.mnum)
            ? `by ${name}` : `from ${possessiveName(name)} grasp`}.`);
    }
    return { died: !!state.program_state.gameover };
}
// C zap.c:probe_objchain().
export function probeObjectChain(inventory, { state = game } = {}) {
    for (const object of inventory) {
        observeObject(object, state);
        if (isContainer(object) || object.otyp === STATUE) {
            object.lknown = true;
            if (!isQuantumBox(object))
                object.cknown = true;
        }
        else if (object.otyp === TIN)
            object.known = true;
    }
}
// C zap.c:probe_monster().
export async function probeMonster(monster, { state = game, onHead = true, x = monster.mx, y = monster.my, publish = plineWithContinuation, } = {}) {
    await publish(await monsterStatusLine(monster, { state, x, y }));
    if (!onHead)
        return;
    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.length) {
        const carryingHero = state.u.uswallow && state.u.ustuck === monster;
        // zap.c:probe_monster() formats the name with noit_Monnam():
        // ARTICLE_YOUR plus SUPPRESS_IT, so a tame carrier reads "Your
        // kitten" and hostiles fall back to "The".
        await publish(`${monsterName(monster, { state, capitalized: true, article: 'your', suppressIt: true })} is not carrying anything${carryingHero ? ' besides you' : ''}.`);
        return;
    }
    probeObjectChain(inventory, { state });
    // invent.c:display_minventory() titles the menu with
    // s_suffix(noit_Monnam(mon)) — ARTICLE_YOUR plus SUPPRESS_IT, matching
    // the empty-carrier message above — and shows the monster's whole
    // inventory through query_objlist() with INVORDER_SORT: entries group
    // by class in inv_order under class headings, the tty layer generates
    // the selector letters, and only a leading gold stack keeps its own
    // '$' selector (pickup.c:1129-1139). display_minventory(MINV_ALL)
    // adds INCLUDE_HERO when engulfing_u(mon) holds, so the menu closes
    // with the engulfer's fake hero row (pickup.c:1146-1164).
    const name = monsterName(monster, { state, capitalized: true, article: 'your', suppressIt: true });
    const engulfer = state.u.uswallow && state.u.ustuck === monster ? monster : null;
    await showProbedObjectInventory(inventory, `${possessiveName(name)} possessions:`, { state, engulfer });
}
// Part of C pickup.c:query_objlist(): display a probed inventory with class headings and optional engulfed-hero row.
// C query_objlist: PICK_NONE still gives each object a menu identifier,
// so tty assigns letters. INVORDER_SORT adds headings even for one item.
// An engulfer's list closes with the INCLUDE_HERO fake hero
// row (pickup.c:1146-1164).
export async function showProbedObjectInventory(objects, title, { state = game, groupByClass = true, engulfer = null, } = {}) {
    const sorted = sortObjects(objects, { mode: lootSortMode({ state }), state });
    const sections = [];
    const classes = groupByClass ? inventoryClassOrder(state) : [null];
    let first = true;
    for (const oclass of classes) {
        const members = oclass === null ? sorted
            : sorted.filter(object => (object.oclass || objectClassForType(object.otyp)) === oclass);
        if (!members.length)
            continue;
        const items = [];
        for (const object of members) {
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({
                ...(first && objectClassForType(object.otyp) === COIN_CLASS ? { key: '$' } : {}),
                text: await inventoryItemDescription(object), value: object,
            });
            first = false;
        }
        sections.push({ heading: oclass === null ? null : objectClassHeading(oclass), items });
    }
    if (engulfer)
        sections.push(engulfedHeroMenuSection(engulfer));
    await showInventoryWindow(sections, { title });
}
// C zap.c:get_obj_location().
// Free and migrating objects have no current
// location even when their coordinate fields still contain an old square.
export function getObjectLocation(object, state = game, { contained = false, buried = false } = {}) {
    switch (object.where) {
        case 'free':
        case 'gone':
        case 'migrating':
        case 'onbill':
            return null;
        case 'inventory':
            return { x: state.u.ux, y: state.u.uy };
        case 'floor':
            return { x: object.ox, y: object.oy };
        case 'minvent': {
            const carrier = object.ocarry;
            if (!carrier)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            if (carrier.mx)
                return { x: carrier.mx, y: carrier.my };
            break;
        }
        case 'buried':
            if (buried)
                return { x: object.ox, y: object.oy };
            break;
        case 'contained':
            if (contained) {
                const container = object.container ||
                    objectsInTimerGraph(state).find((candidate) => candidate.contents?.includes(object));
                if (container)
                    return getObjectLocation(container, state, { contained, buried });
            }
            break;
    }
    return null;
}
// C zap.c:get_container_location().
function getContainerLocation(corpse, state) {
    const directContainer = parentContainer(corpse, state);
    if (!directContainer)
        return null;
    let outer = directContainer;
    let nesting = 0;
    const seen = new Set();
    while (outer?.where === 'contained' && !seen.has(outer)) {
        seen.add(outer);
        const parent = parentContainer(outer, state);
        if (!parent)
            return null;
        outer = parent;
        nesting++;
    }
    if (outer.where === 'buried')
        return null;
    const location = objectLocation(outer, state);
    return location ? { ...location, directContainer, nesting, outer } : null;
}
// Part of C zap.c:revive(): resolve a corpse's container (obj->ocontainer,
// or the timer object graph the runtime keeps instead of nested chains).
function parentContainer(object, state) {
    if (object?.container)
        return object.container;
    return objectsInTimerGraph(state).find(candidate => candidate !== object && candidate.contents?.includes(object));
}
// Part of C zap.c:revive(): resolve a corpse's carrier (obj->ocarry, or the
// runtime ownership aliases).
function carryingMonster(object, state) {
    if (object?.ocarry)
        return object.ocarry;
    return (state.level?.monsters || []).find(monster => monster.m_id === object?.carrierMid
        || (monster.minvent || monster.inventory || []).includes(object));
}
// Part of C zap.c:revive(): locate a corpse in hero inventory, on the floor, buried, or carried by a monster.
function objectLocation(object, state) {
    if (object?.where === 'inventory') {
        return { x: state.u?.ux, y: state.u?.uy, monsterCarrier: null };
    }
    if (object?.where === 'floor' || object?.where === 'buried') {
        return { x: object.ox, y: object.oy, monsterCarrier: null };
    }
    if (object?.where === 'minvent') {
        const monsterCarrier = carryingMonster(object, state);
        if (monsterCarrier?.mx) {
            return {
                x: monsterCarrier.mx, y: monsterCarrier.my,
                monsterCarrier,
            };
        }
    }
    return null;
}
// C zap.c:zombie_can_dig().
export function zombieCanDig(x, y, state) {
    if (state.level?.traps?.some(trap => trap.tx === x && trap.ty === y))
        return false;
    const location = state.level?.at(x, y);
    return !!location && [ROOM, CORR, GRAVE].includes(location.typ);
}
// C zap.c:revive().
export async function revive(corpse, state, { byHero = false } = {}) {
    requireCorpseSpecies(corpse);
    const originalWhere = corpse.where;
    const occupation = state._occupation;
    if (occupation?.key === 'eat-food' && state.context.victual?.piece === corpse) {
        state.context.victual = null;
        if (!corpse.oeaten)
            corpse.oeaten = 1;
        // Revival retains the body until makemon has used it, even on the last bite.
        await stopHeroOccupation(state, plineWithContinuation, { finishMeal: false });
        await newuhs(false, { state });
    }
    const digsOut = originalWhere === 'buried'
        && (isReviver(corpse.corpsenm)
            || MONSTER_SYMBOL[corpse.corpsenm] === S_ZOMBIE);
    const location = corpse.where === 'contained' ? getContainerLocation(corpse, state)
        : corpse.where === 'buried' && !digsOut ? null : objectLocation(corpse, state);
    const messages = [];
    if (!location?.x
        || (originalWhere === 'contained' && isContainerLocation(location)
            && (location.directContainer.olocked || location.nesting > 2
                || location.directContainer.otyp === STATUE
                || location.directContainer.otyp === BAG_OF_HOLDING && rn2(40) !== 0))
        || (digsOut && !zombieCanDig(location.x, location.y, state))) {
        return { monster: null, messages, originalWhere, location };
    }
    corpse.ox = location.x;
    corpse.oy = location.y;
    const originalMnum = corpse.corpsenm;
    const savedTraits = corpse.oextra?.omonst;
    let x = location.x, y = location.y;
    const occupant = monsterAtPosition(requireGameLevel(state), x, y);
    if (occupant) {
        const nearby = enexto(originalMnum, x, y);
        if (nearby)
            ({ x, y } = nearby);
    }
    const targetLocation = state.level?.at?.(x, y);
    if (corpse.norevive
        || (monsterIsEel(originalMnum)
            && (!targetLocation || !IS_POOL(targetLocation.typ)))) {
        if (cansee(x, y))
            messages.push(`${upstart(corpseObjectName(corpse, { definite: true }))} twitches feebly.`);
        return { monster: null, messages, originalWhere, location };
    }
    const replacement = revivalReplacement(originalMnum, corpse);
    const useSavedTraits = savedTraits && replacement == null;
    const targetMnum = replacement ?? savedTraits?.mnum ?? originalMnum;
    let flags = NO_MINVENT | MM_NOWAIT | MM_NOMSG;
    if (replacement == null)
        flags |= MM_NOCOUNTBIRTH;
    if (useSavedTraits)
        flags |= MM_NOTAIL;
    else
        flags |= bodyGenderFlags(corpse);
    const heroAt = state.u?.ux === x && state.u?.uy === y;
    const monster = heroAt
        ? await makemonNear(targetMnum, x, y, flags, heroAt)
        : await makemonAt(targetMnum, x, y, flags);
    if (!monster)
        return { monster: null, messages, originalWhere, location };
    if (replacement != null) {
        if (corpse.oextra) {
            delete corpse.oextra.omid;
            delete corpse.oextra.omonst;
        }
        delete corpse.omid;
    }
    if (useSavedTraits) {
        restoreMonsterTraits(monster, savedTraits);
        restoreShopkeeperResidency(monster, state);
        markQuestLeaderAlive(monster, state);
        await newsym(monster.mx, monster.my);
        await restoreMonsterShape(monster, state);
        if (monster.mtame && !monster.isminion)
            await makePetWary(monster, { wasDead: true, state });
    }
    else if (replacement === PM_DOPPELGANGER) {
        if (monster.cham === PM_DOPPELGANGER)
            await changeMonsterForm(monster, originalMnum);
    }
    else if (replacement === PM_HUMAN_ZOMBIE) {
        monster.mhp = monster.mhpmax = 100;
        monster.permspeed = MFAST;
        monster.mspeed = MFAST;
    }
    if (monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
    }
    await revealMonsterAppearance(monster);
    const oneOf = objectQuantity(corpse) > 1;
    const body = oneOf ? splitObjectStack(corpse, 1, state) : corpse;
    if (!body)
        throw new Error('A revived corpse could not be separated from its stack');
    requireCorpseSpecies(body);
    if (byHero) {
        const corpse = body;
        const { ox: x, oy: y } = corpse;
        const keeper = costlySpot(x, y, state)?.resident;
        const charge = keeper && (corpse.where === 'inventory' ? corpse.unpaid : !corpse.no_charge);
        if (cansee(x, y)) {
            const owner = objectOwnershipPrefix(corpse, state, { capitalized: false });
            const nameBody = oneOf ? { ...corpse, quan: 2, quantity: 2 } : corpse;
            const name = `${oneOf ? 'one of ' : ''}${owner}${corpseObjectName(nameBody, { omitPrefix: true })}`;
            await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} glows iridescently.`);
            state._lastPlineKind = PLNMSG_OBJ_GLOWS;
        }
        else if (charge) {
            await plineWithContinuation('A corpse is resuscitated.');
        }
        if (charge && keeper !== monster)
            await stolenValue(corpse, x, y, keeper.mpeaceful, { silent: false, state });
    }
    {
        const corpse = body;
        const ghostId = corpse.oextra?.omid ?? corpse.omid;
        if (ghostId) {
            const ghost = (state.level?.monsters || []).find(candidate => candidate.mhp > 0 && candidate.m_id === ghostId && candidate.mnum === PM_GHOST);
            if (ghost) {
                if (canSeeMonster(ghost))
                    await plineWithContinuation(`${monsterName(ghost, { state, capitalized: true })} is suddenly drawn into its former body!`);
                for (;;) {
                    const object = (ghost.minvent || ghost.inventory)?.[0];
                    if (!object)
                        break;
                    unlinkMonsterObject(ghost, object);
                    await linkObjectToMonsterInventory(monster, object, { state });
                }
                if (ghost.mtame && !monster.mtame) {
                    if (await tameMonster(monster, null, { state }))
                        monster.mtame = ghost.mtame;
                }
                monster.mconf = 1;
                await removeMonsterFromGame(ghost);
            }
            if (corpse.oextra)
                delete corpse.oextra.omid;
            delete corpse.omid;
        }
    }
    {
        const corpse = body;
        const name = corpse.oextra?.oname || corpse.oname;
        if (name && !((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)) {
            setMonsterGivenName(monster, name);
        }
        if ((corpse.oeaten ?? 0) > 0) {
            const nutrition = MONSTER_BODY_META[corpse.corpsenm]?.[1] ?? 0;
            const remaining = Math.min(corpse.oeaten ?? 0, nutrition);
            monster.mhp = Math.max(1, nutrition ? Math.trunc(monster.mhp * remaining / nutrition) : 1);
        }
    }
    monster.mrevived = 1;
    {
        const corpse = body;
        if (corpse.where === 'floor') {
            await delobjCore(corpse, true, state);
        }
        else if (corpse.where === 'inventory') {
            await useUpInventoryStack(corpse, state);
        }
        else if (corpse.where === 'minvent') {
            const carrier = location.monsterCarrier || carryingMonster(corpse, state);
            if (!carrier)
                throw new Error('A reviving monster-carried corpse has no carrier');
            await destroyObjectFromMonsterInventory(carrier, corpse, state);
        }
        else {
            await deleteObject(corpse, state);
        }
    }
    return {
        kind: 'revived', corpse: body, monster, trap: null,
        buried: digsOut, originalWhere, location, messages,
    };
}
// Part of C zap.c:montraits(): the validated trait-field copy, without inventory or body ownership.
// Monster state restored from a corpse or statue by the native montraits path.
// Both arguments have the same trait contract; the target's type determines
// which values the saved record may supply. Inventory/body ownership is restored
// separately below, and only the saved record's own fields are copied.
function copyRestoredTraits(monster, saved) {
    for (const key in saved) {
        if (Object.hasOwn(saved, key))
            monster[key] = saved[key];
    }
}
// Part of C zap.c:montraits(): restore saved traits while retaining the new body's identity, position, inventory, and worm state.
export function restoreMonsterTraits(monster, saved, { rollOne = rnd, randomBelow = rn2, } = {}) {
    if (!monster || !saved)
        return monster;
    const created = {
        m_id: monster.m_id,
        mx: monster.mx,
        my: monster.my,
        mux: monster.mux,
        muy: monster.muy,
        minvent: monster.minvent || [],
        wormno: monster.wormno,
        wormSegments: monster.wormSegments,
        wormHead: monster.wormHead,
        wormGrowTime: monster.wormGrowTime,
        misc_worn_check: monster.misc_worn_check,
        weaponCheck: monster.weaponCheck,
        mtrapseen: monster.mtrapseen,
        mflee: monster.mflee,
        mfleetim: monster.mfleetim,
        mburied: monster.mburied,
        mlstmv: monster.mlstmv,
        mundetected: monster.mundetected,
        m_ap_type: monster.m_ap_type,
        m_lev: monster.m_lev ?? 0,
        mhpmax: monster.mhpmax ?? 1,
    };
    let restoredLevel = saved.m_lev ?? created.m_lev;
    const speciesLevel = MONSTER_LEVEL[saved.mnum] ?? 0;
    if (created.m_lev < speciesLevel) {
        const targetLevel = rollOne(speciesLevel + 1);
        if (targetLevel > created.m_lev) {
            while (created.m_lev < targetLevel) {
                created.m_lev++;
                created.mhpmax += monsterHitPointsPerLevel({ mnum: saved.mnum, m_lev: created.m_lev }, { rollOne, randomBelow });
            }
            restoredLevel = created.m_lev;
        }
    }
    copyRestoredTraits(monster, saved);
    monster.m_id = created.m_id;
    monster.mx = created.mx;
    monster.my = created.my;
    if (created.mux === undefined)
        delete monster.mux;
    else
        monster.mux = created.mux;
    if (created.muy === undefined)
        delete monster.muy;
    else
        monster.muy = created.muy;
    monster.minvent = created.minvent;
    monster.inventory = monster.minvent;
    monster.hasInventory = monster.minvent.length > 0;
    monster.mw = null;
    if (created.wormno === undefined)
        delete monster.wormno;
    else
        monster.wormno = created.wormno;
    if (created.wormSegments === undefined)
        delete monster.wormSegments;
    else
        monster.wormSegments = created.wormSegments;
    if (created.wormHead === undefined)
        delete monster.wormHead;
    else
        monster.wormHead = created.wormHead;
    if (created.wormGrowTime === undefined)
        delete monster.wormGrowTime;
    else
        monster.wormGrowTime = created.wormGrowTime;
    monster.misc_worn_check = created.misc_worn_check ?? 0;
    monster.weaponCheck = created.weaponCheck ?? 0;
    monster.mtrapseen = created.mtrapseen ?? 0;
    monster.mflee = created.mflee ?? 0;
    monster.mfleetim = created.mfleetim ?? 0;
    monster.mburied = created.mburied ?? 0;
    monster.mlstmv = created.mlstmv ?? 0;
    monster.mundetected = created.mundetected ?? 0;
    monster.m_ap_type = created.m_ap_type ?? 0;
    monster.m_lev = restoredLevel;
    monster.mhpmax = Math.max(created.mhpmax, saved.mhpmax ?? 1);
    monster.mhp = monster.mhpmax;
    monster.dead = false;
    monster.mrevived = 1;
    monster.mavenge = 0;
    monster.meating = 0;
    monster.mleashed = 0;
    monster.mtrapped = 0;
    monster.msleeping = 0;
    monster.mfrozen = 0;
    monster.mcanmove = 1;
    if (!monsterHasSeductionAttack(monster.mnum))
        monster.mcan = 0;
    monster.mcansee = 1;
    monster.mblinded = 0;
    monster.mstun = 0;
    monster.mconf = 0;
    if (monster.edog) {
        monster.edog = copyPetData(monster.edog);
        monster.mextra = { ...(monster.mextra || {}), edog: monster.edog };
    }
    return monster;
}
// Port only: require a corpse's monster species before revival.
export function requireCorpseSpecies(corpse) {
    if (typeof corpse.corpsenm !== 'number')
        throw new TypeError('Corpse revival requires a monster species.');
}
// Port only: narrow a revival location to one with a direct container.
export function isContainerLocation(location) {
    return 'directContainer' in location;
}
// C zap.c:revive_egg().
function reviveEgg(egg, state) {
    const mnum = egg?.corpsenm;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0)
        return;
    const younger = monsterYoungerForm(mnum);
    if ([mnum, younger].filter(Number.isInteger).every(species => !((state.mvitals?.[species]?.mvflags ?? 0) & G_GENOD)))
        attachEggHatchTimer(egg);
}
// C zap.c:unturn_dead().
export async function turnCarriedObjects(inventory, state = game) {
    requirePlayingGame(state);
    let revived = 0;
    const heroInventory = inventory === state.inventory;
    for (const object of [...(inventory || [])]) {
        if (object.otyp === EGG) {
            reviveEgg(object, state);
            continue;
        }
        if (object.otyp !== CORPSE)
            continue;
        const carrier = object.ocarry || state.level.monsters.find(monster => (monster.minvent || monster.inventory || []).includes(object));
        const visible = heroInventory || carrier && canSeeMonster(carrier);
        const plural = (object.quan ?? object.quantity ?? 1) > 1;
        const corpse = visible ? `${plural ? 'One of ' : ''}${ownedObjectName(object, state, { capitalized: !plural })}` : '';
        const species = object.corpsenm;
        const event = await reviveCorpseByMagic(object, state, { byHero: !state.context.mon_moving });
        if (event?.kind !== 'revived')
            continue;
        revived++;
        for (const message of event.messages || [])
            await plineWithContinuation(message);
        if (visible) {
            const alive = !monsterIsNonliving(event.monster.mnum);
            const different = species !== event.monster.mnum;
            const form = different ? ` as ${withIndefiniteArticle(monsterTypeName(event.monster.mnum, event.monster.female))}` : '';
            const subject = state._lastPlineKind === PLNMSG_OBJ_GLOWS ? 'It' : corpse;
            await plineWithContinuation(`${subject} suddenly ${alive ? 'comes alive' : 'reanimates'}${form}!`);
        }
        else if (canSeeMonster(event.monster)) {
            await plineWithContinuation(`${monsterName(event.monster, { state, article: 'a', capitalized: true })} suddenly appears!`);
        }
    }
    if (heroInventory && revived)
        await encumber_msg(state);
    return revived;
}
// Part of C zap.c:bhito(): temporarily clear norevive for magical revival and restore it on failure.
export async function reviveCorpseByMagic(corpse, state = game, { byHero = true } = {}) {
    if (!corpse)
        return null;
    const noRevive = corpse.norevive;
    corpse.norevive = false;
    const event = await revive(corpse, state, { byHero });
    await finishBuriedRevival(event, state);
    if (event.kind !== 'revived') {
        if (noRevive === undefined)
            delete corpse.norevive;
        else
            corpse.norevive = noRevive;
        for (const message of event.messages)
            await plineWithContinuation(message);
    }
    return event;
}
// C zap.c:unturn_you().
export async function turnHeroWithUndeadMagic(state = game, { roll = rnd } = {}) {
    requirePlayingGame(state);
    await turnCarriedObjects(state.inventory, state);
    if (monsterIsUndead(state.u?.umonnum)) {
        const alreadyStunned = (state.u?.stunnedTurns ?? 0) > 0;
        await plineWithContinuation(formatFeltMessage(`frightened and ${alreadyStunned ? 'even more ' : ''}stunned.`, state));
        await makeStunned((state.u.stunnedTurns ?? 0) + roll(30), { state, talk: false });
    }
    else {
        await plineWithContinuation('You shudder in dread.');
    }
}
// C zap.c:cancel_item().
export async function cancelObjectMagic(object, { state = game } = {}) {
    const originalType = object.otyp;
    const objectClass = object.oclass ?? objectClassForType(originalType);
    removeWornBonuses(object, state);
    const enchanted = !!object.spe
        && ([WEAPON_CLASS, ARMOR_CLASS].includes(objectClass) || isWeaponTool(object));
    if (objectMagic(originalType) || enchanted
        || originalType === POT_ACID || originalType === POT_SICKNESS
        || (originalType === POT_WATER && (object.blessed || object.cursed))
        || originalType === SPE_NOVEL) {
        const cancelledCharges = objectClass === WAND_CLASS || originalType === CRYSTAL_BALL ? -1 : 0;
        if (object.spe !== cancelledCharges
            && ![WAN_CANCELLATION, MAGIC_LAMP, CANDELABRUM_OF_INVOCATION].includes(originalType)) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.spe = cancelledCharges;
            if ('enchantment' in object)
                object.enchantment = cancelledCharges;
        }
        if (objectClass === SCROLL_CLASS) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.otyp = SCR_BLANK_PAPER;
            object.spe = 0;
        }
        else if (objectClass === SPBOOK_CLASS
            && originalType !== SPE_CANCELLATION && originalType !== SPE_BOOK_OF_THE_DEAD) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.otyp = SPE_BLANK_PAPER;
            if (originalType === SPE_NOVEL)
                blankNovel(object);
        }
        else if (objectClass === POTION_CLASS) {
            await chargeAlteredUnpaidObject(object, originalType !== POT_WATER ? 'cancel'
                : object.cursed ? 'uncurse' : 'unbless', state);
            if (originalType === POT_SICKNESS || originalType === POT_SEE_INVISIBLE)
                object.otyp = POT_FRUIT_JUICE;
            else {
                object.otyp = POT_WATER;
                object.odiluted = 0;
            }
        }
    }
    if (object.otyp === CORPSE && object.timed
        && !monsterIsRider({ mnum: object.corpsenm ?? -1 })) {
        const revival = objectTimers(object).find(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON);
        if (revival) {
            stopObjectTimer(object, OBJECT_TIMER_KIND.REVIVE_MON);
            // C starts a new relative timeout using peek_timer's absolute value.
            scheduleObjectTimer(object, OBJECT_TIMER_KIND.ROT_CORPSE, (state.moves ?? 1) + revival.deadline, state);
        }
    }
    unblessObjectState(object);
    uncurseObjectState(object);
}
// Part of C zap.c:cancel_item(): remove a carried item's worn enchantment bonuses.
function removeWornBonuses(object, state) {
    if (object.where !== 'inventory')
        return;
    const name = OBJ_NAME(object.otyp);
    const worn = object.owornmask ?? 0;
    const amount = object.spe ?? 0;
    const attributes = new Map([
        ['gain strength', [A_STR, W_RING]], ['gain constitution', [A_CON, W_RING]],
        ['adornment', [A_CHA, W_RING]], ['gauntlets of dexterity', [A_DEX, W_ARMG]],
        ['helm of brilliance', [A_INT, W_ARMH]],
    ]);
    const bonus = name ? attributes.get(name) : undefined;
    if (bonus && (worn & bonus[1])) {
        state.context.botl = true;
        state.u.abon ||= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[bonus[0]] = (state.u.abon.a[bonus[0]] ?? 0) - amount;
        if (name === 'helm of brilliance')
            state.u.abon.a[A_WIS] = (state.u.abon.a[A_WIS] ?? 0) - amount;
    }
    if ((worn & W_ARMOR) || (name === 'protection' && (worn & W_RING)))
        state.context.botl = true;
    if (!(worn & W_RING))
        return;
    if (name === 'increase accuracy')
        state.u.uhitinc = (state.u.uhitinc ?? 0) - amount;
    if (name === 'increase damage')
        state.u.udaminc = (state.u.udaminc ?? 0) - amount;
}
// C zap.c:blank_novel().
export function blankNovel(object) {
    if (object.otyp !== SPE_BLANK_PAPER)
        throw new TypeError('A blanked novel must be a blank spellbook.');
    object.novelidx = 0;
    object.corpsenm = 0;
    delete object.oname;
    delete object.name;
    if (object.oextra)
        delete object.oextra.oname;
    for (let current = object; current; current = current.container)
        current.owt = objectWeight(current);
}
// C zap.c:drain_item().
// Billing precedes the loss of a charge.
export async function drainObjectEnchantment(object, { random = rn2, byHero = false, state = game, } = {}) {
    if (!object || !(object.spe > 0))
        return false;
    const weaponTool = isWeaponTool(object);
    if (!objectCharged(object.otyp)
        && ![WEAPON_CLASS, ARMOR_CLASS].includes(object.oclass) && !weaponTool)
        return false;
    const artifact = artifactById(object.oartifact);
    if (artifact?.defense === 'life-drain' || artifact?.carriedDefense === 'life-drain'
        || objectResistsDestruction(object, 10, 90, random))
        return false;
    if (byHero)
        await chargeAlteredUnpaidObject(object, 'drain', state);
    object.spe--;
    object.enchantment = object.spe;
    if (object.oclass === ARMOR_CLASS && state.inventory.includes(object)
        && object.owornmask)
        state._armorClassDirty = true;
    drainWornBonuses(object, state);
    if (state.context.botl) {
        requireLiveGame(state);
        await bot();
    }
    return true;
}
// Part of C zap.c:drain_item(): subtract one point of a worn item's enchantment bonuses.
function drainWornBonuses(object, state) {
    const name = OBJ_NAME(object.otyp);
    const worn = object.owornmask ?? 0;
    const ring = object === (state.uleft || state.u.uleft)
        || object === (state.uright || state.u.uright);
    const attributes = [];
    if (ring && (worn & W_RING)) {
        if (name === 'gain strength')
            attributes.push(A_STR);
        else if (name === 'gain constitution')
            attributes.push(A_CON);
        else if (name === 'adornment')
            attributes.push(A_CHA);
        else if (name === 'increase accuracy')
            state.u.uhitinc = (state.u.uhitinc ?? 0) - 1;
        else if (name === 'increase damage')
            state.u.udaminc = (state.u.udaminc ?? 0) - 1;
    }
    if (ring && name === 'protection') {
        state._armorClassDirty = true;
        state.context.botl = true;
    }
    if (name === 'helm of brilliance' && (worn & W_ARMH)
        && object === (state.uarmh || state.u.uarmh))
        attributes.push(A_INT, A_WIS);
    if (name === 'gauntlets of dexterity' && (worn & W_ARMG)
        && object === (state.uarmg || state.u.uarmg))
        attributes.push(A_DEX);
    if (!attributes.length)
        return;
    state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
    for (const attribute of attributes)
        state.u.abon.a[attribute]--;
    state.context.botl = true;
}
// C zap.c:obj_resists().
export function objectResistsDestruction(object, ordinaryChance, artifactChance, random = rn2) {
    if (!object)
        return false;
    if (object.otyp === AMULET_OF_YENDOR
        || object.otyp === SPE_BOOK_OF_THE_DEAD
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === BELL_OF_OPENING
        || (object.otyp === CORPSE
            && object.corpsenm !== undefined
            && object.corpsenm >= PM_DEATH
            && object.corpsenm <= PM_FAMINE))
        return true;
    return random(100) < (object.oartifact || object.artifact
        ? artifactChance : ordinaryChance);
}
// C zap.c:obj_shudders().
export function obj_shudders(object, { state = game } = {}) {
    if (state.context.bypasses && object.bypass)
        return false;
    let odds = object.oclass === WAND_CLASS || object.cursed ? 3
        : object.blessed ? 12 : 8;
    if (objectQuantity(object) > 4)
        odds = Math.trunc(odds / 2);
    return !rn2(odds);
}
// C zap.c:polyuse().
async function polyUse(objects, kind, minimumWeight, state) {
    let remaining = minimumWeight;
    for (const object of objects) {
        if (remaining <= 0)
            break;
        if ((state.context.bypasses && object.bypass)
            || object === (state.uball || state.u.uball)
            || object === (state.uchain || state.u.uchain)
            || objectResistsDestruction(object, 0, 0))
            continue;
        if ((objectMaterial(object, state) === kind) !== (rn2(remaining + 1) !== 0))
            continue;
        await billDestroyedMaterial(object, state);
        remaining -= objectQuantity(object) < LARGEST_INT ? objectQuantity(object) : remaining;
        await delobj(object, state);
    }
}
// Part of C zap.c:polyuse(): bill or charge for destroyed shop material.
async function billDestroyedMaterial(object, state) {
    if (!costlySpot(object.ox, object.oy, state))
        return;
    if (state.u.ushops?.length)
        await addShopObjectToBill(object, state, { ininv: false });
    else
        await stolenValue(object, object.ox, object.oy, false, { silent: false, state });
}
// C zap.c:create_polymon().
export async function createPolymorphMonsterFromPile(x, y, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const kind = state.context.poly_zapped ?? -1;
    if (kind < 0)
        return null;
    const pile = state.level.objects[x]?.[y] || [];
    let start = 0;
    if (state.context.bypasses)
        while (pile[start]?.bypass)
            start++;
    const first = pile[start];
    if (!first || (start === pile.length - 1 && objectQuantity(first) === 1))
        return null;
    let name, material;
    switch (kind) {
        case IRON:
        case METAL:
        case MITHRIL:
            name = 'iron golem';
            material = 'metal ';
            break;
        case COPPER:
        case SILVER:
        case PLATINUM:
        case GEMSTONE:
        case MINERAL:
            name = rn2(2) ? 'stone golem' : 'clay golem';
            material = 'lithic ';
            break;
        case 0:
        case FLESH:
            name = 'flesh golem';
            material = 'organic ';
            break;
        case WOOD:
            name = 'wood golem';
            material = 'wood ';
            break;
        case LEATHER:
            name = 'leather golem';
            material = 'leather ';
            break;
        case CLOTH:
            name = 'rope golem';
            material = 'cloth ';
            break;
        case BONE:
            name = 'skeleton';
            material = 'bony ';
            break;
        case GOLD:
            name = 'gold golem';
            material = 'gold ';
            break;
        case GLASS:
            name = 'glass golem';
            material = 'glassy ';
            break;
        case PAPER:
            name = 'paper golem';
            material = 'paper ';
            break;
        default:
            name = 'straw golem';
            material = '';
    }
    const species = MONSTER_NAME.indexOf(name);
    const genocided = (state.mvitals?.[species]?.mvflags || 0) & G_GENOD;
    const monster = await makemonAt(genocided ? null : species, x, y, MM_NOMSG);
    await polyUse(pile.slice(start), kind, requireMonsterData(MONSTER_BODY_META, species)[0], state);
    if (monster && cansee(monster.mx, monster.my))
        await plineWithContinuation(`Some ${material}objects meld, and ${monsterName(monster, { article: 'a', state })} arises from the pile!`);
    return monster;
}
// C zap.c:do_osshock().
export async function do_osshock(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    state.context.obj_zapped = true;
    if ((state.context.poly_zapped ?? -1) < 0) {
        const luck = Luck(state.u);
        for (let remaining = objectQuantity(object); remaining > 0; remaining--) {
            if (!rn2(luck + 45)) {
                state.context.poly_zapped = objectMaterial(object, state);
                break;
            }
        }
    }
    const quantity = objectQuantity(object);
    if (quantity > 1) {
        const split = splitObjectStack(object, rnd(quantity > LARGEST_INT ? 30000 : quantity - 1), state);
        if (!split)
            throw new Error(`System shock could not split object ${object.o_id}`);
        object = split;
    }
    await billDestroyedMaterial(object, state);
    await delobj(object, state);
}
// C zap.c:obj_unpolyable().
export function obj_unpolyable(object, { state = game } = {}) {
    return [WAN_POLYMORPH, SPE_POLYMORPH, POT_POLYMORPH, AMULET_OF_UNCHANGING]
        .includes(object.otyp) || object === (state.uball || state.u.uball)
        || object === state.uskin || objectResistsDestruction(object, 5, 95);
}
// C zap.c:poly_obj().
export async function poly_obj(object, id = STRANGE_OBJECT, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.otyp === BOULDER)
        sokobanGuilt(state);
    const where = object.where;
    let replacement = await createReplacement(object, id, state);
    finishReplacementType(object, replacement, id, state);
    replacement.owt = objectWeight(replacement);
    const location = getObjectLocation(object, state, { contained: true, buried: true });
    const oldWornMask = (object.owornmask || 0) & ~(W_ART | W_ARTI);
    if (where === 'inventory')
        updateInventoryPresentation(replacement);
    replaceObject(object, replacement, state);
    if (where === 'inventory') {
        await finishInventoryRemoval(object, state);
        if (state.program_state.gameover)
            return replacement;
        await prepareInventoryAddition(replacement, state);
        await finishInventoryAddition(replacement, state);
        if (oldWornMask) {
            const twoHanded = isBimanualObject(object);
            const twoWeapons = !!state.u.twoweap;
            const oldArmorSlot = armorSlotFor(object.otyp);
            await removeWornHeroItem(object, state);
            if (!state.program_state.gameover) {
                if (oldWornMask & W_WEP) {
                    if (twoHanded || !isBimanualObject(replacement) || !state.uarms)
                        await setPrimaryWeapon(replacement, state);
                    if (twoWeapons && state.uwep && !isBimanualObject(state.uwep))
                        setTwoWeaponCombat(true, state);
                }
                else if (oldWornMask & W_SWAPWEP) {
                    if (twoHanded || !isBimanualObject(replacement))
                        await setSecondaryWeapon(replacement, state);
                    if (twoWeapons && state.uswapwep)
                        setTwoWeaponCombat(true, state);
                }
                else if (oldWornMask & W_QUIVER) {
                    await setQuiverObject(replacement, state);
                }
                else if (oldArmorSlot && oldArmorSlot === armorSlotFor(replacement.otyp)) {
                    await wearHeroArmor(replacement, state);
                    await applyArmorOnEffects(replacement, state);
                    replacement = state[oldArmorSlot] ?? null;
                }
                else if ((oldWornMask & (W_RINGL | W_RINGR))
                    && (replacement.oclass === RING_CLASS || replacement.otyp === MEAT_RING)) {
                    const slot = oldWornMask & W_RINGL ? 'uleft' : 'uright';
                    await wearHeroAccessory(replacement, slot, state);
                    replacement = state[slot] ?? null;
                }
                else if ((oldWornMask & W_AMUL) && replacement.oclass === AMULET_CLASS) {
                    await wearHeroAccessory(replacement, 'uamul', state);
                    replacement = state.uamul ?? null;
                }
                else if ((oldWornMask & W_TOOL) && isEyewear(replacement)) {
                    await wearEyewear(replacement, { checkHead: false });
                    replacement = state.ublindf ?? null;
                }
            }
        }
        if (state.program_state.gameover)
            return replacement;
    }
    else if (where === 'floor') {
        if (!location)
            throw new Error(`Floor object ${object.o_id} has no location`);
        if (object.otyp !== BOULDER && replacement.otyp === BOULDER
            && (isPoolAt(location.x, location.y, state) || isLavaAt(location.x, location.y, state)))
            await fractureRock(replacement, location.x, location.y, { state, publish: plineWithContinuation });
        if (object.otyp === BOULDER || replacement.otyp === BOULDER)
            vision_note_blocker_change(location.x, location.y);
    }
    await angerObjectOwner(object, replacement, location, state);
    await delobj(object, state);
    return replacement;
}
// Part of C zap.c:poly_obj(): create the replacement and transfer quantity, charges, blessing, erosion, and leash state.
async function createReplacement(object, id, state) {
    let replacement;
    if (id === STRANGE_OBJECT) {
        const magic = object.otyp === UNICORN_HORN && object.degraded_horn
            ? 0 : objectMagic(object.otyp);
        replacement = await mkobj(object.oclass, false);
        for (let attempt = 1; attempt < 3 && objectMagic(replacement.otyp) !== magic; attempt++) {
            await delobj(replacement, state);
            replacement = await mkobj(object.oclass, false);
        }
    }
    else {
        replacement = await mksobj(id, false, false);
        if ([CORPSE, STATUE, FIGURINE].includes(object.otyp)
            && [CORPSE, STATUE, FIGURINE].includes(id))
            set_corpsenm(replacement, representedSpecies(object));
    }
    replacement.quan = replacement.quantity = objectQuantity(object);
    if (object.no_charge === undefined)
        delete replacement.no_charge;
    else
        replacement.no_charge = object.no_charge;
    if (object.where === 'inventory') {
        if (object.invlet === undefined)
            delete replacement.invlet;
        else
            replacement.invlet = object.invlet;
    }
    if (object.otyp === EGG && object.spe)
        makeHeroLaidEgg(replacement, state);
    if ([WAND_CLASS, WEAPON_CLASS, ARMOR_CLASS].includes(replacement.oclass))
        replacement.spe = object.spe;
    replacement.recharged = object.recharged || 0;
    replacement.cursed = !!object.cursed;
    replacement.blessed = !!object.blessed;
    copyErosion(object, replacement, state);
    if (object.otrapped && isBox(replacement))
        replacement.otrapped = true;
    if (object.opoisoned && isPoisonableObject(replacement))
        replacement.opoisoned = true;
    if (id === STRANGE_OBJECT && object.otyp === CORPSE && object.corpsenm === PM_CROCODILE) {
        replacement.otyp = LOW_BOOTS;
        replacement.oclass = ARMOR_CLASS;
        replacement.spe = replacement.oeroded = 0;
        replacement.oerodeproof = true;
        replacement.quan = replacement.quantity = 1;
        replacement.cursed = false;
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (replacement.otyp === LEASH) {
            replacement.leashmon = object.leashmon;
            object.leashmon = 0;
        }
        else
            releaseObjectLeash(object, state);
    }
    await deleteObjectContents(replacement, state);
    return replacement;
}
// Part of C zap.c:poly_obj(): preserve a hero-laid egg and choose a viable hatchling.
function makeHeroLaidEgg(object, state) {
    if (object.otyp === EGG)
        stopObjectTimers(object, state);
    object.otyp = EGG;
    object.corpsenm = -1;
    object.spe = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
        const species = hatchableEggSpecies(rn2(MONSTER_NAME.length));
        if (species >= 0 && !eggSpeciesIsDead(species, state)) {
            object.spe = 1;
            set_corpsenm(object, species);
            return;
        }
    }
}
// Part of C zap.c:poly_obj(): copy erosion only when the replacement material is vulnerable.
function copyErosion(source, target, state) {
    if (!erosionMatters(target))
        return;
    const primary = ['burn', 'rust', 'crack'].some(kind => objectIsVulnerableToErosion(target, kind, state));
    const secondary = ['corrosion', 'rot'].some(kind => objectIsVulnerableToErosion(target, kind, state));
    if (primary)
        target.oeroded = source.oeroded || 0;
    if (secondary)
        target.oeroded2 = source.oeroded2 || 0;
    if (primary || secondary)
        target.oerodeproof = !!source.oerodeproof;
}
// Part of C zap.c:poly_obj(): adjust replacement stacks and class-specific charges or type restrictions.
// Also C mkobj.c:fixup_oil(): the potion-age and dilution adjustment is inlined here.
function finishReplacementType(source, target, id, state) {
    if (target.quan > 1 && (!objectMerge(target.otyp)
        || (id === STRANGE_OBJECT && target.quan > rn2(1000))))
        target.quan = target.quantity = 1;
    switch (target.oclass) {
        case TOOL_CLASS:
            if (target.otyp === MAGIC_LAMP) {
                target.otyp = OIL_LAMP;
                target.age = 1500;
            }
            else if (target.otyp === MAGIC_MARKER)
                target.recharged = 1;
            break;
        case WAND_CLASS:
            while ([WAN_WISHING, WAN_POLYMORPH].includes(target.otyp))
                target.otyp = rndClass(WAN_LIGHT, WAN_LIGHTNING);
            if (target.recharged < rn2(7))
                target.recharged++;
            break;
        case POTION_CLASS:
            while (target.otyp === POT_POLYMORPH)
                target.otyp = rndClass(POT_GAIN_ABILITY, POT_WATER);
            if (target.otyp === POT_OIL)
                target.age = source.otyp === POT_OIL ? source.age : MAX_OIL_IN_FLASK;
            else if (source.otyp === POT_OIL) {
                if (target.age === source.age)
                    target.age = state.moves;
                if (source.age < MAX_OIL_IN_FLASK)
                    target.odiluted = true;
            }
            break;
        case SPBOOK_CLASS:
            while (target.otyp === SPE_POLYMORPH)
                target.otyp = rndClass(getObjectClassBounds(SPBOOK_CLASS).first, SPE_BLANK_PAPER);
            if (![SPE_BLANK_PAPER, SPE_NOVEL].includes(target.otyp)) {
                target.spestudied = (source.spestudied || 0) + 1;
                if (target.spestudied > MAX_SPELL_STUDY) {
                    target.otyp = SPE_BLANK_PAPER;
                    target.spestudied = rn2(target.spestudied);
                }
            }
            break;
        case GEM_CLASS:
            if (target.quan > rnd(4) && objectMaterial(source, state) === MINERAL
                && objectMaterial(target, state) !== MINERAL) {
                target.otyp = ROCK;
                target.quan = target.quantity = Math.trunc(target.quan / 2);
            }
            break;
    }
}
// Part of C zap.c:poly_obj(): anger a shopkeeper whose merchandise was transformed.
async function angerObjectOwner(old, replacement, location, state) {
    const shopRelevant = old.unpaid || (replacement && replacement.where !== 'inventory');
    if (!location || !shopRelevant)
        return;
    const { x, y } = location;
    const keeper = costlySpot(x, y, state)?.resident;
    if (!keeper || !shopkeeperInOwnShop(keeper, state)
        || (old.no_charge && !containedBuyCost(old, keeper, { unpaidOnly: false, state })))
        return;
    if (keeper.mpeaceful && state.u.ushops?.length
        && roomsAt(state.level, state.u.ux, state.u.uy, 0)[0]
            === roomsAt(state.level, keeper.mx, keeper.my, 0)[0]
        && !costlySpot(state.u.ux, state.u.uy, state)) {
        await makeAngryShopkeeper(keeper, state);
    }
    else {
        await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${keeper.mpeaceful ? 'gets angry' : 'is furious'}!`, { noRepeat: !keeper.mpeaceful });
        if (keeper.mpeaceful)
            hotPursuitShopkeeper(keeper, state);
    }
}
// Port only: require the monster species represented by a corpse, statue, or figurine.
function representedSpecies(object) {
    if (object.corpsenm === undefined)
        throw new Error(`Object ${object.o_id} has no represented monster species`);
    return object.corpsenm;
}
// C zap.c:stone_to_flesh_obj().
// Animation uses the same owners as traps.
export async function stone_to_flesh_obj(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (![MINERAL, GEMSTONE].includes(objectMaterial(object, state))
        || objectResistsDestruction(object, 2, 98))
        return 0;
    const { x = 0, y = 0 } = getObjectLocation(object, state) || {};
    let affected = 1, smell = false;
    if (object.oclass === ROCK_CLASS || object.oclass === TOOL_CLASS) {
        if (object.otyp === BOULDER) {
            await poly_obj(object, ENORMOUS_MEATBALL, { state });
            smell = true;
        }
        else if (object.otyp === STATUE || object.otyp === FIGURINE) {
            const species = representedSpecies(object);
            const golem = monsterIsGolem(species);
            if (!golem && vegetarianCorpse(species)) {
                await poly_obj(object, MEATBALL, { state });
                smell = true;
            }
            else
                affected = await animateStoneObject(object, x, y, golem, state);
        }
        else
            affected = 0;
    }
    else {
        const type = object.oclass === RING_CLASS ? MEAT_RING
            : object.oclass === WAND_CLASS ? MEAT_STICK
                : object.oclass === GEM_CLASS ? MEATBALL : null;
        if (type !== null) {
            await poly_obj(object, type, { state });
            smell = true;
        }
        else
            affected = 0;
    }
    if (smell) {
        const vegetarian = state.urole.key === 'monk' || !state.u.uconduct?.unvegetarian
            || !carnivorous(state.u.umonnum);
        await plineWithContinuation(vegetarian
            ? 'You smell the odor of meat.' : 'You smell a delicious smell.', { noRepeat: true });
    }
    await newsym(x, y);
    return affected;
}
// Part of C zap.c:stone_to_flesh_obj(): animate a statue or figurine, or fall back to a corpse.
async function animateStoneObject(object, x, y, golem, state) {
    let species = representedSpecies(object);
    let monster;
    const flesh = golem && species !== PM_FLESH_GOLEM;
    if (object.otyp === STATUE) {
        ({ monster } = await animateStatue(object, x, y, { state, magic: true }));
    }
    else {
        if (flesh)
            species = PM_FLESH_GOLEM;
        monster = await makemonAt(species, x, y, NO_MINVENT | MM_NOMSG);
        if (monster) {
            const keeper = costlySpot(x, y, state)?.resident;
            if (keeper && (object.where === 'inventory' ? object.unpaid : !object.no_charge))
                await stolenValue(object, x, y, !!keeper.mpeaceful, { silent: false, state });
            stopObjectTimers(object, state);
            if (object.where === 'inventory')
                await consumeInventoryItem(object);
            else
                await delobj(object, state);
            if (cansee(monster.mx, monster.my))
                await plineWithContinuation(`The figurine ${flesh ? 'turns to flesh and ' : ''}animates!`);
        }
    }
    if (monster) {
        if (monsterIsGolem(monster.mnum) && monster.mnum !== PM_FLESH_GOLEM)
            await changeMonsterForm(monster, PM_FLESH_GOLEM);
        return 1;
    }
    if (requireMonsterData(MONSTER_GENO, species) & (0x0010 | 0x1000))
        return 0;
    for (;;) {
        const content = object.contents?.[0];
        if (!content)
            break;
        bypassObject(content, state);
        unlinkObject(content, state);
        await placeObject(content, x, y, state);
    }
    await poly_obj(object, CORPSE, { state });
    return 1;
}
// C zap.c:bhito().
export async function hitObjectWithWand(object, wand, { state = game } = {}) {
    requirePlayingGame(state);
    if (object === wand)
        return 0;
    if (object.bypass) {
        if (state.context?.bypasses)
            return 0;
        object.bypass = false;
    }
    if (object.where !== 'floor' && wand.otyp !== SPE_STONE_TO_FLESH)
        throw new Error('Immediate object magic requires a floor object or stone to flesh');
    if (object === state.uball || object === state.u.uball)
        return 0;
    if (object === state.uchain || object === state.u.uchain) {
        if (![WAN_OPENING, SPE_KNOCK].includes(wand.otyp))
            return 0;
        await unpunishHero(state);
        learnWand(wand, { state });
        return 1;
    }
    let affected = 1, learned = false;
    switch (wand.otyp) {
        case WAN_POLYMORPH:
        case SPE_POLYMORPH: {
            const result = await polymorphFloorObject(object, { state });
            affected = Number(result.affected);
            learned = result.learned;
            break;
        }
        case WAN_PROBING:
            learned = await probeObject(object, { state });
            affected = Number(learned);
            break;
        case WAN_STRIKING:
        case SPE_FORCE_BOLT: {
            const x = object.ox, y = object.oy;
            learned = cansee(x, y) || !heroIsDeaf(state);
            if (object.otyp === BOULDER) {
                if (cansee(x, y))
                    await plineWithContinuation('The boulder falls apart.');
                else
                    await publishHeardMessage('a crumbling sound.', plineWithContinuation, state);
                await fractureRock(object, x, y, { state });
            }
            else if (object.otyp === STATUE) {
                if (await breakStatue(object, x, y, { state })) {
                    if (cansee(x, y)) {
                        const subject = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'statue';
                        await plineWithContinuation(`The ${subject} shatters.`);
                    }
                    else
                        await publishHeardMessage('a crumbling sound.', plineWithContinuation, state);
                }
            }
            else {
                const result = await breakFloorObject(object, {
                    state, random: rn2, rollDice: d,
                    heroCaused: !state.context?.mon_moving,
                });
                learned &&= result.destroyed;
                if (result.destroyed)
                    await newsym(x, y);
                affected = 0;
            }
            break;
        }
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
            await cancelObjectMagic(object, { state });
            await newsym(object.ox, object.oy);
            break;
        case SPE_DRAIN_LIFE:
            await drainObjectEnchantment(object, { state, byHero: true });
            break;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY: {
            const x = object.ox, y = object.oy;
            await relocateObjectRandomly(object, { state });
            await maybeUnhideAt(x, y, state);
            break;
        }
        case WAN_MAKE_INVISIBLE:
            break;
        case WAN_UNDEAD_TURNING:
        case SPE_TURN_UNDEAD:
            if (object.otyp === CORPSE) {
                const result = await reviveFloorCorpse(object, state);
                affected = Number(result.affected);
                learned = result.learned;
            }
            else
                affected = Number(await turnObjectWithUndeadMagic(object, state));
            break;
        case WAN_OPENING:
        case SPE_KNOCK:
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK:
            learned = [CHEST, LARGE_BOX].includes(object.otyp)
                && await changeBoxLockByMagic(object, wand, { state });
            affected = Number(learned);
            break;
        case WAN_SLOW_MONSTER:
        case SPE_SLOW_MONSTER:
        case WAN_SPEED_MONSTER:
        case WAN_NOTHING:
        case SPE_HEALING:
        case SPE_EXTRA_HEALING:
            affected = 0;
            break;
        case SPE_STONE_TO_FLESH:
            affected = await stone_to_flesh_obj(object, { state });
            break;
        default:
            throw new Error(`No immediate object effect for ${OBJ_NAME(wand.otyp) || wand.otyp}`);
    }
    if (learned)
        learnWand(wand, { state });
    return affected;
}
// Part of C zap.c:bhito(): reveal object and container information with probing magic.
export async function probeObject(object, { state = game } = {}) {
    let learned = !object.dknown;
    observeObject(object, state);
    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = object.lknown = true;
        const name = definiteName(objectName(object, state), state);
        if ([CHEST, LARGE_BOX].includes(object.otyp) && !object.tknown) {
            if (object.otrapped)
                await plineWithContinuation(`${definiteObjectAction(object, 'are', state)} trapped!`);
            object.tknown = true;
        }
        if (!object.contents?.length)
            await plineWithContinuation(`${definiteObjectAction(object, 'are', state)} empty.`);
        else if (isQuantumBox(object)) {
            const cat = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'cat';
            await plineWithContinuation(`You aren't sure whether ${name} has ${withIndefiniteArticle(cat)} or its corpse inside.`);
            object.cknown = false;
        }
        else {
            for (const content of object.contents)
                observeObject(content, state);
            await showProbedObjectInventory(object.contents, `Contents of ${await probedContentsTitle(object, state)}:`, { state });
        }
        learned = true;
    }
    else if (object.otyp === TIN) {
        learned ||= !object.known || !object.cknown;
        object.known = object.cknown = true;
    }
    else if (object.otyp === EGG) {
        learned ||= !object.known && (object.corpsenm ?? -1) >= 0;
        object.known = true;
    }
    return learned;
}
// Part of C zap.c:bhito(): polymorph a floor object or destroy it through system shock.
export async function polymorphFloorObject(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (obj_unpolyable(object, { state }))
        return { affected: false, learned: false };
    const conduct = state.u.uconduct ??= {};
    if (!conduct.polypiles)
        recordGameLogEvent(`polymorphed ${state.flags.female ? 'her' : 'his'} first object`, { state, flags: LL_CONDUCT });
    conduct.polypiles = (conduct.polypiles || 0) + 1;
    if (isBox(object))
        await changeBoxLockByMagic(object, { otyp: WAN_POLYMORPH }, { state });
    if (obj_shudders(object, { state })) {
        const cover = state.level.objects[state.u.ux]?.[state.u.uy]?.[0] === object
            && state.u.uundetected && heroFormHidesUnderObjects(state);
        const learned = cansee(object.ox, object.oy);
        await do_osshock(object, { state });
        if (cover)
            await maybeUnhideAt(state.u.ux, state.u.uy, state);
        return { affected: true, learned };
    }
    const replacement = await poly_obj(object, STRANGE_OBJECT, { state });
    if (!replacement)
        throw new Error(`Floor polymorph lost replacement for object ${object.o_id}`);
    await newsym(replacement.ox, replacement.oy);
    return { affected: true, learned: false };
}
// Part of C zap.c:bhito(): revive eggs or corpses hit by undead-turning magic.
export async function turnObjectWithUndeadMagic(object, state = game) {
    if (object.otyp === EGG) {
        reviveEgg(object, state);
        return true;
    }
    if (object.otyp !== CORPSE) {
        // NetHack counts another floor object as a beam hit even though
        // undead turning leaves that object unchanged.
        return true;
    }
    const event = await reviveCorpseByMagic(object, state);
    if (event?.kind !== 'revived')
        return false;
    for (const message of event.messages || [])
        await plineWithContinuation(message);
    const x = event?.location?.x ?? event?.monster?.mx;
    const y = event?.location?.y ?? event?.monster?.my;
    if (event?.monster && cansee(x, y)) {
        const name = namelessMonsterName(event.monster, { state, article: 'the' });
        await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} is resurrected!`);
    }
    return true;
}
// Part of C zap.c:bhito(): report a revived floor corpse and identify observable undead-turning magic.
async function reviveFloorCorpse(object, state) {
    const x = object.ox, y = object.oy, species = object.corpsenm ?? -1;
    const corpseName = singularObjectName(object, state);
    const event = await reviveCorpseByMagic(object, state);
    if (event?.kind !== 'revived')
        return { affected: false, learned: false };
    for (const message of event.messages || [])
        await plineWithContinuation(message);
    const monster = event.monster;
    let learned = false;
    if (cansee(x, y)) {
        if (canSpotMonster(monster)) {
            const name = namelessMonsterName(monster, { state, article: 'the' });
            await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} is resurrected!`);
            learned = !state.context?.mon_moving || !!state.context.zap_oseen;
        }
        else {
            const name = monsterHasProperName(species)
                ? corpseName : capitalizedDefiniteName(corpseName, state);
            await plineWithContinuation(`${name} disappears.`);
        }
    }
    else {
        if (state.urole.key === 'healer' && !heroIsDeaf(state) && !monsterIsNonliving(species)) {
            const corpse = monsterHasProperName(species)
                ? corpseName : withIndefiniteArticle(corpseName);
            await publishHeardMessage(`${heroIsHallucinating(state) ? 'a defibrillator' : `${corpse} reviving`}.`, pline, state);
            learned = !state.context?.mon_moving || !!state.context.zap_oseen;
        }
        if (canSpotMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} appears.`);
    }
    if (learned)
        await exerciseAttribute(A_WIS, true, state);
    return { affected: true, learned };
}
// C zap.c:bhitpile().
// A wand or spell striking the floor pile at <x,y>.
// Also C mkobj.c:recreate_pile_at(): inlined here (boulders restack to the
// top after polymorph may have left one buried).
export async function hitFloorPileWithWand(wand, x, y, { state = game, direction = 0 } = {}) {
    requirePlayingGame(state);
    const column = state.level.objects[x];
    const original = column?.[y] || [];
    if (!column || !original.length)
        return 0;
    const hiding = direction !== 0 && state.u.uundetected && heroFormHidesUnderObjects(state);
    let first = true;
    if ([WAN_STRIKING, SPE_FORCE_BOLT].includes(wand.otyp)) {
        const top = original[0];
        if (await activateStatueTrapAt(x, y, { state, shatter: true }))
            learnWand(wand, { state });
        if (column[y]?.[0] !== top)
            first = false;
    }
    state.context.poly_zapped = -1;
    let affected = 0;
    await sweepFloorPile(x, y, state, async (object) => {
        if (hiding) {
            if (first) {
                first = false;
                if (direction > 0)
                    return true;
            }
            else if (direction < 0)
                return true;
        }
        affected += await hitObjectWithWand(object, wand, { state });
        return !state.program_state.gameover;
    });
    if (state.program_state.gameover)
        return affected;
    if (state.context.poly_zapped >= 0)
        await createPolymorphMonsterFromPile(x, y, { state });
    const pile = column[y] || [];
    // Recreate the native pile order only if polymorph left a boulder below
    // another object. Both groups retain their existing internal order.
    if (pile.some((object, index) => object.otyp === BOULDER
        && pile.slice(0, index).some(earlier => earlier.otyp !== BOULDER))) {
        column[y] = [
            ...pile.filter(object => object.otyp === BOULDER),
            ...pile.filter(object => object.otyp !== BOULDER),
        ];
    }
    if (hiding)
        await maybeUnhideAt(x, y, state);
    await fillPitWithBoulderAt(x, y, state);
    return affected;
}
// C zap.c:zappable().
// It removes a charge from the wand when one is left.
export async function zappable(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (wand.spe < 0 || (wand.spe === 0 && rn2(121) !== 0))
        return false;
    if (wand.spe === 0)
        await plineWithContinuation('You wrest one last charge from the worn-out wand.');
    wand.spe--;
    return true;
}
// C zap.c:do_enlightenment_effect().
export async function doEnlightenmentEffect() {
    await pline(formatFeltMessage('self-knowledgeable...'));
    // zap.c displays WIN_MESSAGE before opening the enlightenment menu.
    await flushPendingTopline();
    await enlightenment(MAGICENLIGHTENMENT, ENL_GAMEINPROGRESS);
    await pline('The feeling subsides.');
    await exerciseAttribute(A_WIS, true);
}
// C zap.c:zapnodir().
//, also the engrave command's no-direction wand effects.
export async function zapWithoutDirection(source, state) {
    let known = false;
    switch (source.otyp) {
        case WAN_LIGHT:
        case SPE_LIGHT:
            known = source.dknown && !heroIsBlind(state);
            await lightRoom(true, { finishMonsterKill: finishHeroMonsterKill });
            if (state.program_state.gameover)
                return;
            await lightDamage(source, true, 5, { state });
            break;
        case WAN_SECRET_DOOR_DETECTION:
        case SPE_DETECT_UNSEEN:
            known = !!source.dknown;
            await findit();
            break;
        case WAN_STASIS:
            state.level.flags.stasis_until = Math.max(state.level.flags.stasis_until || 0, state.moves + rn2(21) + 10);
            break;
        case WAN_CREATE_MONSTER:
            if (await createCritters(rn2(23) ? 1 : rn2(7) + 2))
                known = !!source.dknown;
            break;
        case WAN_WISHING:
            // zapnodir(): zap.c:2576 tests Luck, which includes a carried luckstone's bonus.
            if (Luck(state.u) + rn2(5) < 0)
                await plineWithContinuation('Unfortunately, nothing happens.');
            else {
                known = !!source.dknown;
                await makeWish();
            }
            break;
        case WAN_ENLIGHTENMENT:
            known = !!source.dknown;
            await doEnlightenmentEffect();
            break;
    }
    if (known && !state.program_state.gameover) {
        if (!objectTypeKnown(source, state))
            addExperience(0, 10, state);
        learnWand(source, { state });
    }
}
// C zap.c:backfire().
// Native backfire differs from a failed recharge: every
// wand uses d6 here.
export async function backfireWand(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    wand.in_use = true;
    await plineWithContinuation(`${definiteObjectAction(wand, null, state)} suddenly explodes!`);
    const damage = d(wand.spe + 2, 6);
    const injury = state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage;
    if (await loseHeroHp(injury, 'exploding wand', {
        state, deathCause: 'killed by an exploding wand',
    }))
        return;
    await useUpInventoryStack(wand, state);
}
// C zap.c:zap_ok().
function zapOk(object) {
    return object?.oclass === WAND_CLASS ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE;
}
// C zap.c:dozap().
// Selection and charges surround the shared effect transaction.
export async function dozap() {
    requirePlayingGame(game);
    if (heroHasNoHands(game)) {
        await plineWithContinuation("You aren't able to zap anything in your current form.");
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    let wand = await chooseInventoryObject('zap', zapOk);
    if (!wand) {
        // zap.c:dozap() returns ECMD_CANCEL when getobj() yields nothing;
        // the rhack seam clears the repeat queue so a later ^A has nothing
        // to redo.
        commandResultCancelled();
        return;
    }
    await chargeUnpaidUsage(wand);
    const needsDirection = objectDirection(wand.otyp, game) !== 1;
    if (!await zappable(wand)) {
        await plineWithContinuation('Nothing happens.');
    }
    else if (wand.cursed && rn2(100) === 0) {
        await backfireWand(wand);
        if (game.program_state.gameover)
            return;
        await exerciseAttribute(A_STR, false);
        game.context.move = 1;
        return;
    }
    else if (needsDirection && !await promptDirection()) {
        if (!heroIsBlind()) {
            await plineWithContinuation(`${definiteObjectAction(wand, null)} glows and fades.`);
        }
    }
    else if (needsDirection && !game.u.dx && !game.u.dy && !game.u.dz) {
        const effect = await zapHeroWithObject(wand);
        if (effect.heroDied)
            return;
        if (effect.damage) {
            const damage = game.u.halfPhysicalDamage ? Math.ceil(effect.damage / 2) : effect.damage;
            const cause = `zapped ${game.flags.female ? 'herself' : 'himself'} with ${killerObjectName(wand)}`;
            if (await loseHeroHp(damage, cause, { deathCause: cause }))
                return;
        }
    }
    else {
        game._currentWand = wand;
        await applyWandEffect(wand);
        wand = game._currentWand;
        game._currentWand = null;
    }
    if (game.program_state.gameover)
        return;
    await finishWandUse(wand);
    game.context.move = 1;
}
// Part of C zap.c:dozap(): turn an exhausted, wrested wand to dust.
async function finishWandUse(wand) {
    if (!wand || wand.spe >= 0)
        return;
    await plineWithContinuation(`${definiteObjectAction(wand, 'turn')} to dust.`);
    await useUpInventoryStack(wand);
}
// C zap.c:boxlock_invent().
//: (un)lock every carried box with the zapped
// wand's magic, then refresh the inventory display.
async function affectCarriedBoxes(source, state) {
    for (const object of [...state.inventory]) {
        if (object.otyp === CHEST || object.otyp === LARGE_BOX)
            await changeBoxLockByMagic(object, source, { state });
        if (state.program_state.gameover)
            return;
    }
}
// C zap.c:zapyourself().
export async function zapHeroWithObject(object, { ordinary = true, state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    let learn = false, damage = 0;
    switch (object.otyp) {
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            learn = true;
            if (propertyIsActive('antimagic', state)) {
                await shieldeff(hero.ux, hero.uy);
                await plineWithContinuation('Boing!');
                monstersObserveHeroResistance(M_SEEN_MAGR, state);
            }
            else {
                if (ordinary)
                    await plineWithContinuation('You bash yourself!');
                damage = ordinary ? d(2, 12) : d(1 + object.spe, 6);
                await exerciseAttribute(A_STR, false, state);
                monstersForgetHeroResistance(M_SEEN_MAGR, state);
            }
            break;
        case WAN_LIGHTNING:
            learn = true;
            damage = await elementalSelfZap('electric', AD_ELEC, M_SEEN_ELEC, 'shockResistance', state);
            if (!state.program_state.gameover)
                await flashBurn(rnd(100), true, { state });
            break;
        case WAN_FIRE:
        case FIRE_HORN:
            learn = true;
            damage = await elementalSelfZap('fire', AD_FIRE, M_SEEN_FIRE, 'fireResistance', state);
            break;
        case WAN_COLD:
        case SPE_CONE_OF_COLD:
        case FROST_HORN:
            learn = true;
            damage = await elementalSelfZap('cold', AD_COLD, M_SEEN_COLD, 'coldResistance', state);
            break;
        case SPE_FIREBALL:
            await plineWithContinuation('You explode a fireball on top of yourself!');
            await explode(hero.ux, hero.uy, 11, d(6, 6), WAND_CLASS, EXPL_FIERY, { state });
            break;
        case WAN_MAGIC_MISSILE:
        case SPE_MAGIC_MISSILE:
            learn = true;
            if (propertyIsActive('antimagic', state)) {
                await shieldeff(hero.ux, hero.uy);
                await plineWithContinuation('The missiles bounce!');
                monstersObserveHeroResistance(M_SEEN_MAGR, state);
            }
            else {
                damage = d(4, 6);
                await plineWithContinuation("Idiot!  You've shot yourself!");
                monstersForgetHeroResistance(M_SEEN_MAGR, state);
            }
            break;
        case WAN_POLYMORPH:
        case SPE_POLYMORPH:
            if (!heroIsUnchanging(state)) {
                learn = true;
                await polymorphHero();
            }
            break;
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
            await cancelHeroMagic(state);
            break;
        case SPE_DRAIN_LIFE:
            if (!heroHasDrainResistance(state))
                await loseHeroExperience('life drainage', { state });
            break;
        case WAN_MAKE_INVISIBLE:
            learn = await zapHeroInvisible(state);
            break;
        case WAN_SPEED_MONSTER:
            await speedUpHero(rn1(25, 50), state);
            learn = true;
            break;
        case WAN_SLEEP:
        case SPE_SLEEP:
            learn = true;
            if (hero.sleepResistance) {
                await shieldeff(hero.ux, hero.uy);
                await plineWithContinuation("You don't feel sleepy!");
                monstersObserveHeroResistance(M_SEEN_SLEEP, state);
            }
            else {
                await plineWithContinuation(ordinary ? 'The sleep ray hits you!' : 'You fall asleep!');
                monstersForgetHeroResistance(M_SEEN_SLEEP, state);
                await putHeroToSleep(rnd(50), { state });
            }
            break;
        case WAN_SLOW_MONSTER:
        case SPE_SLOW_MONSTER:
            if (heroHasRemovableSpeed(state)) {
                await u_slow_down(state);
                learn = true;
            }
            break;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY: {
            const x = hero.ux, y = hero.uy;
            await teleportHero({ chooseDestination: askTeleportDestination });
            learn = (heroControlsTeleport(state) && !(hero.stunned || (hero.stunnedTurns ?? 0) > 0))
                || !couldsee(x, y) || (hero.ux - x) ** 2 + (hero.uy - y) ** 2 >= 16;
            break;
        }
        case WAN_DEATH:
        case SPE_FINGER_OF_DEATH:
            if (monsterIsNonliving(heroSpecies(state)) || (monsterIsDemon(heroSpecies(state)))) {
                await plineWithContinuation(object.otyp === WAN_DEATH
                    ? 'The wand shoots an apparently harmless beam at you.' : 'You seem no deader than before.');
                break;
            }
            learn = true;
            await plineWithContinuation('You irradiate yourself with pure energy!', { urgent: true });
            await plineWithContinuation('You die.', { urgent: true });
            await finishHeroDeath({ killer: 'death ray', deathType: DIED,
                deathCause: `shot ${state.flags.female ? 'herself' : 'himself'} with a death ray`,
                deathLineShown: true });
            break;
        case WAN_UNDEAD_TURNING:
        case SPE_TURN_UNDEAD:
            learn = true;
            await turnHeroWithUndeadMagic(state);
            break;
        case SPE_HEALING:
        case SPE_EXTRA_HEALING: {
            const extra = object.otyp === SPE_EXTRA_HEALING;
            await healHero(d(6, extra ? 8 : 4), 0, { state, cureBlindness: object.blessed || extra });
            await plineWithContinuation(formatFeltMessage(`${extra ? 'much ' : ''}better.`, state));
            break;
        }
        case WAN_LIGHT:
        case EXPENSIVE_CAMERA: {
            const amount = object.otyp === WAN_LIGHT ? d(object.spe, 25) : 5;
            const light = await lightDamage(object, ordinary, amount || 5, { state });
            if (!state.program_state.gameover)
                learn = await flashBurn(light + rnd(25), false, { state });
            break;
        }
        case WAN_OPENING:
        case SPE_KNOCK: {
            if (hero.ustuck) {
                await releaseHold(state);
                learn = true;
            }
            if (state.program_state.gameover)
                break;
            if (heroIsPunished(state)) {
                await unpunishHero(state);
                learn = true;
            }
            const opening = hero.utrap ? await openHoldingTrap(hero, { state }) : null;
            learn ||= !!opening?.noticed;
            if (!opening?.changed && !state.program_state.gameover) {
                await affectCarriedBoxes(object, state);
                const falling = await openFallingTrap(hero, { state, trapdoorOnly: true });
                learn ||= falling.noticed;
            }
            break;
        }
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK: {
            const closing = !hero.utrap ? await closeHoldingTrap(hero, { state }) : null;
            learn = !!closing?.noticed;
            if (!closing?.changed && !state.program_state.gameover)
                await affectCarriedBoxes(object, state);
            break;
        }
        case WAN_PROBING:
            probeObjectChain(state.inventory, { state });
            learn = true;
            await plineWithContinuation(heroStatusLine(state));
            break;
        case SPE_STONE_TO_FLESH:
            await restoreFlesh(object, state);
            break;
        case WAN_DIGGING:
        case SPE_DIG:
        case SPE_DETECT_UNSEEN:
        case WAN_NOTHING:
            break;
        default:
            await impossible(`zapyourself: object ${object.otyp} used?`, { state });
    }
    const heroDied = !!state.program_state.gameover;
    if (learn && !heroDied)
        learnWand(object, { state });
    return { damage: heroDied ? 0 : damage, heroDied };
}
// Part of C zap.c:zapyourself(): apply fire, cold, or lightning self-damage and inventory effects.
async function elementalSelfZap(kind, damageType, memory, resistance, state) {
    const hero = state.u;
    const damage = d(12, 6);
    // C zap.c:zapyourself() reads the plain Shock_resistance /
    // Fire_resistance / Cold_resistance macros (zap.c:2733, 2756, 2777).
    const resisted = propertyIsActive(resistance, state);
    if (resisted) {
        await shieldeff(hero.ux, hero.uy);
        await plineWithContinuation(kind === 'electric' ? 'You zap yourself, but seem unharmed.'
            : formatFeltMessage(kind === 'fire' ? 'rather warm.' : 'a little chill.', state));
        monstersObserveHeroResistance(memory, state);
        await applyHeroGolemEffects(damageType, damage, { state });
    }
    else {
        await plineWithContinuation(kind === 'electric' ? 'You shock yourself!'
            : kind === 'fire' ? "You've set yourself afire!" : 'You imitate a popsicle!');
        if (kind === 'electric')
            await exerciseAttribute(A_CON, false, state);
        monstersForgetHeroResistance(memory, state);
    }
    if (kind === 'fire') {
        await burnAwayHeroSlime(state, pline);
        await burnArmorByFire(state.u, state, pline);
        if (state.program_state.gameover)
            return 0;
    }
    const items = await destroyInventoryByElement(kind, damage, { state, publish: pline });
    if (items.heroDied)
        return 0;
    if (kind === 'fire')
        await igniteItems(state.inventory, { state, publish: pline });
    return resisted ? 0 : damage;
}
// Part of C zap.c:cancel_monst(): cancel the hero's inventory and polymorphed form.
export async function cancelHeroMagic(state = game) {
    requirePlayingGame(state);
    for (const object of [...state.inventory]) {
        await cancelObjectMagic(object, { state });
        if (state.program_state.gameover)
            return;
    }
    findArmorClass(state);
    if (!Upolyd(state.u))
        return;
    if (state.u.umonnum === CLAY_GOLEM) {
        await plineWithContinuation(heroIsBlind(state)
            ? formatFeltMessage(`${heroIsHallucinating(state) ? 'dark' : 'light'} headed.`, state)
            : 'Some writing vanishes from your head!');
        state.u.mh = 0;
    }
    if (heroIsUnchanging(state) && state.u.mh > 0)
        await plineWithContinuation('Your amulet grows hot for a moment, then cools.');
    else
        await returnHeroToHumanForm(state);
}
// Part of C zap.c:zapyourself(): restore flesh to the hero and carried objects, then merge transformed stacks.
async function restoreFlesh(source, state) {
    if (state.u.umonnum === STONE_GOLEM)
        await polymonHero(FLESH_GOLEM);
    if (state.program_state.gameover)
        return;
    if (heroIsPetrifying(state)) {
        clearHeroPetrification(state);
        await plineWithContinuation(heroIsHallucinating(state)
            ? `What a pity--you just ruined a future piece of ${currentAttribute(A_CHA, state) > 15 ? 'fine ' : ''}art!`
            : 'You feel limber!');
    }
    for (const object of [...state.inventory]) {
        await hitObjectWithWand(object, source, { state });
        if (state.program_state.gameover)
            return;
    }
    // A transformed stack can merge with one checked earlier in the chain.
    // Restart after each merge, keeping every worn identity separate.
    let merged;
    do {
        merged = false;
        for (let i = 0; i < state.inventory.length && !merged; i++) {
            const first = state.inventory[i];
            if (!first)
                throw new Error(`Inventory object ${i} disappeared during flesh restoration`);
            if (first.owornmask)
                continue;
            for (const next of state.inventory.slice(i + 1)) {
                if (await mergeObjectStacks(first, next, state)) {
                    merged = true;
                    break;
                }
            }
        }
    } while (merged);
}
// C zap.c:lightdamage().
// Return pseudo-damage before physical protection.
export async function lightDamage(source, ordinary, amount, { state = game } = {}) {
    if (!amount || heroSpecies(state) !== PM_GREMLIN)
        return amount;
    requireInitializedHero(state.u);
    let damage = rnd(amount);
    if (damage > 10)
        damage = 10 + rnd(damage - 10);
    damage = Math.min(damage, 20);
    await plineWithContinuation(`Ow, that light hurts${damage > 2 || state.u.mh <= 5 ? '!' : '.'}`);
    if (source.oclass === SCROLL_CLASS || source.oclass === SPBOOK_CLASS)
        ordinary = false;
    const artifact = artifactById(source.oartifact, state);
    const name = source.oclass === SPBOOK_CLASS ? 'spell of light'
        : artifact ? artifact.name : withIndefiniteArticle(minimalObjectName(source, state));
    const reason = `${ordinary ? 'zapped' : 'blasted'} ${state.flags.female ? 'herself' : 'himself'} with ${name}`;
    const physical = state.u.halfPhysicalDamage
        ? Math.trunc((damage + 1) / 2) : damage;
    await loseHeroHp(physical, reason, { state, deathCause: reason });
    return damage;
}
// C zap.c:flashburn().
// The duration is rolled by the caller even when resisted.
export async function flashBurn(duration, viaLightning = false, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (!resistsBlnd({ youmonst: true }, state)) {
        await publish('You are blinded by the flash!');
        await makeBlinded(duration, { state, talk: false, publish });
        if (!heroIsBlind(state))
            await publish('Your vision clears.');
        return true;
    }
    if (!viaLightning && heroHasArtifactDefense('blindness', state)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        return true;
    }
    return false;
}
// C zap.c:zap_steed().
// Zapping downwards while riding applies the wand to
// the steed first.
async function zapSteed(source, state) {
    const steed = state.u.usteed;
    if (!steed)
        return false;
    state.bhitpos = { x: steed.mx, y: steed.my };
    state.notonhead = false;
    switch (source.otyp) {
        case WAN_PROBING:
            await probeMonster(steed, { state });
            learnWand(source, { state });
            return true;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY: {
            const { ux: x, uy: y } = state.u;
            await teleportHero({ chooseDestination: askTeleportDestination });
            if ((heroControlsTeleport(state) && !(state.u.stunned || (state.u.stunnedTurns ?? 0) > 0))
                || !couldsee(x, y) || (state.u.ux - x) ** 2 + (state.u.uy - y) ** 2 >= 16)
                learnWand(source, { state });
            return true;
        }
        case SPE_CURE_SICKNESS:
        case WAN_MAKE_INVISIBLE:
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
        case WAN_POLYMORPH:
        case SPE_POLYMORPH:
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
        case WAN_SLOW_MONSTER:
        case SPE_SLOW_MONSTER:
        case WAN_SPEED_MONSTER:
        case SPE_HEALING:
        case SPE_EXTRA_HEALING:
        case SPE_DRAIN_LIFE:
        case WAN_OPENING:
        case SPE_KNOCK:
            await hitMonsterWithWand(steed, source, { state });
            return true;
        default:
            return false;
    }
}
// C zap.c:cancel_monst().
export async function cancelMonster(monster, { state = game, attackLevel, random = rn2, allowKill = true, publish = plineWithContinuation, finishMonsterKill = finishHeroMonsterKill, }) {
    if (monsterResistsEffect(monster, attackLevel, random)) {
        return { cancelled: false, resisted: true, killed: false };
    }
    monster.mcan = 1;
    const shape = await normalizeMonsterShape(monster, state, publish);
    if (shape.heroDied)
        return {
            cancelled: true, resisted: false, heroDied: true, changedShape: shape.changed,
        };
    const changedShape = shape.changed;
    const clayGolem = monster.mnum === PM_CLAY_GOLEM;
    if (clayGolem && canSeeMonster(monster)) {
        await publish(`Some writing vanishes from ${possessiveName(monsterName(monster, { state }))} head!`);
    }
    let killed = false;
    if (clayGolem && allowKill) {
        killed = await finishMonsterKill(monster, monster.mx, monster.my);
    }
    return {
        cancelled: true,
        resisted: false,
        killed,
        clayGolem,
        changedShape,
    };
}
// C zap.c:zap_updown().
// Vertical zaps only reach the hero's own square.
async function zapVertically(source, state) {
    const { ux: x, uy: y, dz = 0 } = state.u;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    let disclose = false;
    switch (source.otyp) {
        case WAN_PROBING:
            await probeVertically(source, x, y, state);
            return true;
        case WAN_OPENING:
        case SPE_KNOCK: {
            const bridge = findDrawbridgeAt(x, y, state);
            if (state.level.requireAt(x, y).typ === DBWALL && bridge) {
                await openDrawbridge(bridge.x, bridge.y, state);
                disclose = true;
            }
            else if (dz > 0 && onQuestStart(state) && !okToQuest(state)) {
                let stairs = state.stairs;
                while (stairs && (stairs.isladder || stairs.up || stairs.tolev.dnum !== state.u.uz.dnum))
                    stairs = stairs.next;
                if (stairs?.sx === x && stairs.sy === y) {
                    await plineWithContinuation('The stairs seem to ripple momentarily.');
                    disclose = true;
                }
            }
            if (state.program_state.gameover)
                return disclose;
            if (dz > 0) {
                const effect = state.u.utrap ? await openHoldingTrap(state.u, { state })
                    : await openFallingTrap(state.u, { state });
                disclose ||= effect.noticed;
            }
            break;
        }
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK:
            disclose = await strikeOrLockVertically(source, x, y, trap, state);
            break;
        case SPE_STONE_TO_FLESH:
            await fleshOnTerrain(x, y, state);
            break;
    }
    if (state.program_state.gameover)
        return disclose;
    if (dz > 0) {
        await hitFloorPileWithWand(source, x, y, { state, direction: dz });
        if (!state.program_state.gameover)
            await zapMapAt(x, y, source, { state });
    }
    else if (state.u.uundetected && heroFormHidesUnderObjects(state)) {
        const object = state.level.objects[state.u.ux]?.[state.u.uy]?.[0];
        if (object && await hitObjectWithWand(object, source, { state })) {
            await maybeUnhideAt(state.u.ux, state.u.uy, state);
            disclose = true;
        }
    }
    return disclose;
}
// Part of C zap.c:zap_updown(): affect drawbridges, falling rocks, and floor holes with striking or locking.
async function strikeOrLockVertically(source, x, y, trap, state) {
    const striking = [WAN_STRIKING, SPE_FORCE_BOLT].includes(source.otyp);
    const { dz = 0 } = state.u, location = state.level.at(x, y);
    if (!location)
        throw new Error(`No map location at ${x},${y}`);
    const bridge = findDrawbridgeAt(x, y, state);
    if (bridge && (location.typ === DRAWBRIDGE_DOWN ? dz > 0 : location.typ === DOOR)) {
        if (striking)
            await destroyDrawbridge(bridge.x, bridge.y, state);
        else
            await closeDrawbridge(bridge.x, bridge.y, state);
        return true;
    }
    if (striking && dz < 0 && rn2(3) && !Is_airlevel(state.u.uz)
        && !Is_waterlevel(state.u.uz) && !(state.underwater || state.u.uinwater) && !onQuestStart(state)) {
        await plineWithContinuation(`A rock is dislodged from the ${ceilingName(x, y, state)} and falls on your ${body_part(HEAD, state)}.`);
        let damage = rnd(objectIsHardHelmet(state.uarmh || state.u.uarmh) ? 2 : 6);
        if (state.u.halfPhysicalDamage)
            damage = Math.ceil(damage / 2);
        if (await loseHeroHp(damage, 'falling rock', { state }))
            return false;
        const rock = await mksobj(ROCK, false, false);
        await placeCreatedObject(rock, x, y, state);
        observeObjectForNaming(rock, { state });
        await stack_object(rock, state);
        await newsym(x, y);
        return false;
    }
    if (dz <= 0 || !trap)
        return false;
    if (!striking) {
        const effect = await closeHoldingTrap(state.u, { state });
        if (effect.changed)
            return effect.noticed;
    }
    if (striking && trap.ttyp === TRAPDOOR) {
        const known = !!trap.tseen;
        await plineWithContinuation(heroIsBlind(state) && !known ? 'Something beneath you shatters.'
            : !known ? "There's a trapdoor beneath you; it shatters." : 'The trapdoor beneath you shatters.');
        trap.ttyp = HOLE;
        trap.tseen = 1;
        await newsym(x, y);
        await dotrap(trap, { gotoLevel });
        return known;
    }
    if (!striking && trap.ttyp === HOLE) {
        trap.ttyp = TRAPDOOR;
        if (heroIsBlind(state) || !trap.tseen)
            await plineWithContinuation(`Some ${isIceAt(x, y, state) ? 'frost' : 'dust'} swirls beneath you.`);
        else {
            trap.tseen = 1;
            await newsym(x, y);
            await plineWithContinuation('A trapdoor appears beneath you.');
            return true;
        }
    }
    return false;
}
// Part of C zap.c:zap_updown(): describe stone-to-flesh magic directed at the ceiling or floor.
async function fleshOnTerrain(x, y, state) {
    const { dz = 0 } = state.u;
    if (Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz) || state.underwater || state.u.uinwater
        || (onQuestStart(state) && dz < 0))
        await plineWithContinuation('Nothing happens.');
    else if (dz < 0)
        await plineWithContinuation(`Blood drips on your ${body_part(FACE, state)}.`);
    else if (!state.level.objects[x]?.[y]?.length && engravingAt(x, y)?.engr_type !== ENGRAVE) {
        if (isPoolAt(x, y, state) || isIceAt(x, y, state))
            await plineWithContinuation('Nothing happens.');
        else
            await plineWithContinuation(`Blood ${isLavaAt(x, y, state) ? 'boils' : 'pools'} ${state.u.levitating ? 'beneath' : 'at'} your ${makePlural(body_part(FOOT, state))}.`);
    }
}
// Part of C zap.c:zap_updown(): probe the ceiling, floor pile, terrain, and buried inventory.
async function probeVertically(source, x, y, state) {
    let found = 0;
    if ((state.u.dz ?? 0) < 0)
        await plineWithContinuation(`You probe towards the ${ceilingName(x, y, state)}.`);
    else {
        recordMappedOverviewState();
        const location = state.level.at(x, y);
        if (!location)
            throw new Error(`No map location at ${x},${y}`);
        const remembered = location.lastseentyp;
        found += await hitFloorPileWithWand(source, x, y, { state, direction: state.u.dz ?? 0 });
        const surface = location.typ === DRAWBRIDGE_UP
            ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
        await zapMapAt(x, y, source, { state });
        const furniture = surface === ICE || IS_FURNITURE(surface);
        if (furniture && remembered !== location.lastseentyp)
            found++;
        await plineWithContinuation(`You probe beneath ${furniture ? 'it' : `the ${surfaceName(x, y, state)}`}.`);
        found += await displayBuriedInventory(x, y, state);
    }
    if (!found)
        await plineWithContinuation('Your probe reveals nothing.');
}
// C zap.c:zapsetup().
//: clear obj_zapped before a wand effect runs.
export function beginImmediateZap(state = game) {
    state.context.obj_zapped = false;
}
// C zap.c:zapwrapup().
//: report the poly-shock shudder once the effect is
// done, then clear obj_zapped again.
export async function finishImmediateZap(state = game) {
    if (state.context?.obj_zapped)
        await plineWithContinuation(formatFeltMessage('shuddering vibrations.', state));
    state.context.obj_zapped = false;
}
// C zap.c:weffects().
// Zapping and spell casting share the effect dispatch;
// callers own charge use and direction input.
export async function applyWandEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u, type = source.otyp, direction = objectDirection(type, state);
    const unknown = !objectTypeKnown(source, state);
    let disclose = false;
    exerciseWisdom(true, state);
    if (hero.usteed && direction !== NODIR && !hero.dx && !hero.dy
        && (hero.dz ?? 0) > 0 && await zapSteed(source, state)) {
        disclose = true;
    }
    else if (direction === IMMEDIATE) {
        beginImmediateZap(state);
        if (hero.uswallow) {
            if (!hero.ustuck)
                throw new Error('A swallowed hero must have an engulfing monster.');
            await hitMonsterWithWand(hero.ustuck, source, { state });
        }
        else if (hero.dz)
            disclose = await zapVertically(source, state);
        else
            await bhit(source, rn2(8) + 6, state);
        if (!state.program_state.gameover)
            await finishImmediateZap(state);
    }
    else if (direction === NODIR) {
        await zapWithoutDirection(source, state);
    }
    else {
        if (type === WAN_DIGGING || type === SPE_DIG)
            await zapDigWithObject(source, { state });
        else if ((type >= SPE_MAGIC_MISSILE && type <= SPE_FINGER_OF_DEATH)
            || (type >= WAN_MAGIC_MISSILE && type <= WAN_LIGHTNING)) {
            await zapRayWithObject(source, { state });
        }
        else
            await impossible('weffects: unexpected spell or wand');
        disclose = true;
    }
    if (disclose && !state.program_state.gameover) {
        learnWand(source, { state });
        if (unknown)
            addExperience(0, 10, state);
    }
}
// Part of C zap.c:weffects(), music.c:do_improvisation(): choose ray type and strength for a spell, wand, or horn.
// Actual source objects retain spell strength and horn death attribution.
export async function zapRayWithObject(object, { state = game } = {}) {
    requirePlayingGame(state);
    let nativeType;
    let dice;
    const type = object.otyp;
    if (type >= SPE_MAGIC_MISSILE && type <= SPE_FINGER_OF_DEATH) {
        nativeType = 10 + type - SPE_MAGIC_MISSILE;
        dice = Math.trunc(state.u.ulevel / 2) + 1;
    }
    else if (type >= WAN_MAGIC_MISSILE && type <= WAN_LIGHTNING) {
        nativeType = type - WAN_MAGIC_MISSILE;
        dice = nativeType === 0 ? 2 : 6;
    }
    else if (type === FIRE_HORN || type === FROST_HORN) {
        nativeType = type === FIRE_HORN ? 1 : 2;
        dice = 6 + rn2(6);
    }
    else {
        throw new Error(`Object ${type} does not produce a ray`);
    }
    const { dx = 0, dy = 0, dz = 0 } = state.u;
    const direction = dx || dy
        ? Object.entries(DIRECTIONS).find(([, delta]) => delta[0] === dx && delta[1] === dy)?.[0]
        : dz < 0 ? '<' : '>';
    return ubuzz(nativeType, dice, direction, { state, sourceObject: object });
}
// C zap.c:spell_damage_bonus().
export function adjustSpellDamage(damage, state = game) {
    const intelligence = currentAttribute(A_INT, state) ?? 10;
    const level = state.u?.ulevel ?? 1;
    if (intelligence <= 9)
        return damage > 1 ? Math.max(1, damage - 3) : damage;
    if (intelligence <= 13 || level < 5)
        return damage;
    if (intelligence <= 18)
        return damage + 1;
    if (intelligence <= 24 || level < 14)
        return damage + 2;
    return damage + 3;
}
// C zap.c:spell_hit_bonus().
function spellHitBonus(spellType, state) {
    const skill = liveSpellSkill(spellType, state);
    let bonus = skill === P_EXPERT ? 3 : skill === P_SKILLED ? 2 : skill === P_BASIC ? 0 : -4;
    const dexterity = currentAttribute(A_DEX, state);
    bonus += dexterity < 4 ? -3 : dexterity < 6 ? -2 : dexterity < 8 ? -1
        : dexterity < 14 ? 0 : dexterity - 14;
    return bonus;
}
// C zap.c:exclam().
export function exclam(force) {
    return force < 0 ? '?' : force <= 4 ? '.' : '!';
}
// C zap.c:hit().
export function rayHitMessage(effect, monster, { x, y, damage = 0, ending, state = game }) {
    const inside = state.u.uswallow && state.u.ustuck === monster;
    const named = state.flags.verbose
        && (cansee(x, y) || canSpotMonster(monster) || inside);
    const target = named ? monsterName(monster, { state }) : 'it';
    const punctuation = ending ?? exclam(damage);
    return `${capitalizedDefiniteName(effect, state)} ${verbForSubject(effect, 'hit')} ${target}${punctuation}`;
}
// C zap.c:miss().
export function rayMissMessage(effect, monster, { x, y, state = game }) {
    const named = state.flags.verbose && (cansee(x, y) || canSpotMonster(monster));
    const target = named ? monsterName(monster, { state }) : 'it';
    return `${capitalizedDefiniteName(effect, state)} ${verbForSubject(effect, 'miss')} ${target}.`;
}
// C zap.c:skiprange().
export function rockSkipRange(range) {
    const quarter = Math.trunc(range / 4);
    const start = range - (quarter > 0 ? rnd(quarter) : 0);
    const end = start - Math.trunc(start / 4) * rnd(3);
    return { start, end: end >= start ? start - 1 : end };
}
// C zap.c:maybe_explode_trap().
//: cancellation striking a magic trap.
async function cancelMagicTrap(x, y, source, state) {
    if (![WAN_CANCELLATION, SPE_CANCELLATION].includes(source.otyp))
        return false;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap)
        return false;
    if ([MAGIC_PORTAL, VIBRATING_SQUARE].includes(trap.ttyp)) {
        await shieldeff(x, y);
        if (!cansee(x, y))
            return false;
        trap.tseen = 1;
        await newsym(x, y);
        return true;
    }
    if (![TELEP_TRAP, LEVEL_TELEP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP].includes(trap.ttyp))
        return false;
    const visible = cansee(x, y);
    await explode(x, y, -WAN_CANCELLATION, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL, { state });
    deleteTrap(trap, state);
    await newsym(x, y);
    return visible;
}
// C zap.c:zap_map().
// Terrain is affected before occupants and floor piles.
export async function zapMapAt(x, y, source, { state = game } = {}) {
    requirePlayingGame(state);
    let learned = await cancelMagicTrap(x, y, source, state);
    if (state.program_state.gameover)
        return;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if ((state.u.dz ?? 0) > 0)
        await zapEngraving(x, y, source, state);
    else if (!state.u.dz)
        learned = await zapDrawbridge(x, y, source, state) || learned;
    if (state.program_state.gameover)
        return;
    if (source.otyp === WAN_PROBING)
        learned = await probeTerrain(x, y, trap, learned, state);
    if (learned)
        learnWand(source, { state });
}
// Part of C zap.c:zap_map(): transform, erase, relocate, or soften an engraving.
async function zapEngraving(x, y, source, state) {
    const engraving = engravingAt(x, y, state.level);
    if (!engraving || engraving.engr_type === HEADSTONE)
        return;
    switch (source.otyp) {
        case WAN_POLYMORPH:
        case SPE_POLYMORPH: {
            deleteEngravingAt(x, y, state.level);
            const { text, pristine } = randomEngraving();
            makeEngravingAt(x, y, text, pristine, state.moves, 0);
            break;
        }
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
        case WAN_MAKE_INVISIBLE:
            deleteEngravingAt(x, y, state.level);
            break;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY:
            await relocateEngraving(engraving, state);
            break;
        case SPE_STONE_TO_FLESH:
            if (engraving.engr_type !== ENGRAVE)
                break;
            await plineWithContinuation(heroIsHallucinating(state)
                ? 'The floor runs like butter!' : 'The edges on the floor get smoother.');
            wipeEngravingAt(x, y, d(2, 4), true, state.level);
            break;
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            wipeEngravingAt(x, y, d(2, 4), true, state.level);
            break;
    }
}
// Part of C zap.c:zap_map(): open, close, or destroy a horizontal drawbridge target.
async function zapDrawbridge(x, y, source, state) {
    const originalType = state.level.requireAt(x, y).typ;
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge)
        return false;
    switch (source.otyp) {
        case WAN_OPENING:
        case SPE_KNOCK:
            if (originalType === DBWALL) {
                const visible = cansee(x, y) || cansee(bridge.x, bridge.y);
                await openDrawbridge(bridge.x, bridge.y, state);
                return visible;
            }
            break;
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK: {
            const observed = (cansee(x, y) || cansee(bridge.x, bridge.y))
                && bridge.location.typ === DRAWBRIDGE_DOWN;
            await closeDrawbridge(bridge.x, bridge.y, state);
            return observed;
        }
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            if (originalType !== DRAWBRIDGE_UP) {
                await destroyDrawbridge(bridge.x, bridge.y, state);
                return true;
            }
            break;
    }
    return false;
}
// Port only: compare the port's structured glyph values for probing feedback.
function sameGlyph(left, right) {
    if (left === right)
        return true;
    if (!left || !right || left.kind !== right.kind)
        return false;
    switch (left.kind) {
        case 'terrain': return right.kind === 'terrain' && left.terrainName === right.terrainName;
        case 'object': return right.kind === 'object' && left.otyp === right.otyp;
        case 'monster': return right.kind === 'monster' && left.mnum === right.mnum;
        case 'trap': return right.kind === 'trap' && left.trapType === right.trapType;
        case 'effect':
        case 'engraving':
        case 'invisible':
        case 'nothing':
        case 'unexplored':
        case 'warning':
            return glyphCharacter(left) === glyphCharacter(right);
    }
}
// Part of C zap.c:zap_map(): reveal terrain, secret doors, corridors, and traps with probing.
async function probeTerrain(x, y, trap, learned, state) {
    const location = state.level.requireAt(x, y);
    const oldType = location.lastseentyp, oldGlyph = glyphAt(x, y, state);
    await showMapSpot(x, y, { state });
    learned ||= oldType !== location.lastseentyp || !sameGlyph(oldGlyph, glyphAt(x, y, state));
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    if (surface === SDOOR) {
        revealSecretDoor(x, y);
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        if (cansee(x, y)) {
            await plineWithContinuation('Probing reveals a secret door.');
            learned = true;
        }
        else if (Is_rogue_level(state.u.uz))
            await plineWithContinuation(formatDraftMessage(false, state));
    }
    else if (surface === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        await plineWithContinuation('Probing exposes a secret corridor.');
        learned = true;
    }
    else if ((surface === ICE || IS_FURNITURE(surface)) && (state.u.dz ?? 0) > 0) {
        await forceDescribeDecor({ state, probing: true });
        learned = true;
    }
    if (trap) {
        const seen = trap.tseen, hallucinating = heroIsHallucinating(state);
        trap.tseen = 1;
        await newsym(x, y);
        if (!seen || hallucinating) {
            const name = trapName(trap.ttyp, { state });
            const definite = hallucinating ? !rn2(4)
                : trap.ttyp === VIBRATING_SQUARE && Invocation_lev(state.u.uz, state);
            await plineWithContinuation(`You find ${definite ? `the ${name}!` : `${withIndefiniteArticle(name)}.`}`);
            learned = !hallucinating;
        }
    }
    return learned;
}
// Port only: read the character from a structured glyph when present.
function glyphCharacter(glyph) {
    return glyph && 'ch' in glyph && typeof glyph.ch === 'string' ? glyph.ch : undefined;
}
// C zap.c:bhit().
//, ZAPPED_WAND branch: a beam-limited walk over the map,
// monsters, floor piles, and doors.
async function bhit(source, range, state, flashDirection) {
    if (flashDirection) {
        const object = source;
        const dx = flashDirection.x, dy = flashDirection.y;
        object.ox = state.u.ux;
        object.oy = state.u.uy;
        const cells = [];
        let heroDied = false;
        let x = state.u.ux, y = state.u.uy;
        try {
            for (let range = 0; range < COLNO; range++) {
                x += dx;
                y += dy;
                if (!isok(x, y))
                    break;
                if (!heroIsBlind(state))
                    await showTransientLight(null, x, y, state);
                const monster = monsterAtPosition(state.level, x, y);
                if (monster && M_AP_TYPE(monster) !== M_AP_OBJECT) {
                    object.ox = state.u.ux;
                    object.oy = state.u.uy;
                    const onHead = x === monster.mx && y === monster.my;
                    if (!monster.minvis) {
                        for (const cell of cells)
                            await newsym(cell.x, cell.y);
                        heroDied = (await flashHitsMonster(monster, object, { state, onHead })).heroDied;
                        if (!heroDied && object.otyp === EXPENSIVE_CAMERA)
                            await seeMonsterCloseup(monster, { state, photo: true, onHead });
                        break;
                    }
                    heroDied = (await flashHitsMonster(monster, object, { state, onHead })).heroDied;
                    if (heroDied)
                        break;
                }
                if (!rayPositionIsOpen(x, y, state))
                    break;
                if (cansee(x, y)) {
                    if (!monster)
                        await unmap_invisible(x, y);
                    cells.push({ x, y });
                    await show_glyph_cell(x, y, '!', CLR_WHITE, false, 0, { kind: 'effect', glyph: cmapToGlyph(CmapSymbol.flashbeam) });
                    await flush_screen(0);
                    await state.animationFrame?.();
                }
            }
        }
        finally {
            for (const cell of cells)
                await newsym(cell.x, cell.y);
            await cleanupTransientLight(state);
        }
        return heroDied;
    }
    const { dx = 0, dy = 0, ux, uy } = state.u;
    state.bhitpos = { x: ux, y: uy };
    let shopDoor = false;
    while (range-- > 0) {
        const x = state.bhitpos.x += dx, y = state.bhitpos.y += dy;
        if (!isok(x, y)) {
            state.bhitpos.x -= dx;
            state.bhitpos.y -= dy;
            break;
        }
        await zapMapAt(x, y, source, { state });
        if (state.program_state.gameover)
            return false;
        const location = state.level.at(x, y);
        if (!location)
            throw new Error(`No map location at ${x},${y}`);
        const type = location.typ;
        const monster = monsterAtPosition(state.level, x, y);
        if (monster) {
            state.notonhead = x !== monster.mx || y !== monster.my;
            if (await hitMonsterWithWand(monster, source, { state, x, y }))
                return false;
            range -= 3;
        }
        else if (source.otyp === WAN_PROBING && location.remembered_glyph?.kind === 'invisible') {
            await unmap_invisible(x, y);
        }
        if (state.program_state.gameover)
            return false;
        if (await hitFloorPileWithWand(source, x, y, { state }))
            range--;
        if (state.program_state.gameover)
            return false;
        if ((type === DOOR || type === SDOOR)
            && [WAN_OPENING, WAN_LOCKING, WAN_STRIKING, SPE_KNOCK, SPE_WIZARD_LOCK, SPE_FORCE_BOLT].includes(source.otyp)
            && await changeDoorByMagic(source, x, y, { state })) {
            if (cansee(x, y) || (source.otyp === WAN_STRIKING && !heroIsDeaf(state)))
                learnWand(source, { state });
            if (location.doormask === D_BROKEN && roomsAt(state.level, x, y, SHOPBASE).length) {
                shopDoor = true;
                addShopDamage(x, y, SHOP_DOOR_COST, state);
            }
        }
        if (!ZAP_POS(type) || (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))) {
            state.bhitpos.x -= dx;
            state.bhitpos.y -= dy;
            break;
        }
    }
    if (shopDoor)
        await payForShopDamage('destroy', { state });
    return false;
}
// C display.h isok() for ray cells: column 0 is the map border, so rays
// run from x >= 1.
export function rayPositionIsValid(x, y) {
    return x >= 1 && x < COLNO && y >= 0 && y < ROWNO;
}
// Part of C zap.c:dobuzz(), zap.c:bhit(): test traversable zap terrain and closed doors.
export function rayPositionIsOpen(x, y, state = game) {
    if (!rayPositionIsValid(x, y))
        return false;
    const location = state.level?.at(x, y);
    return !!location && ZAP_POS(location.typ) && !closedDoor(state, x, y);
}
// C zap.c:boomhit().
export async function flyBoomerang(object, dx, dy, state, volley) {
    requirePlayingGame(state);
    let direction = xdir.findIndex((x, index) => x === dx && ydir[index] === dy);
    if (direction < 0 || direction >= 8)
        throw new Error(`A boomerang needs a horizontal direction, received (${dx}, ${dy}).`);
    const flight = {
        x: state.u.ux, y: state.u.uy, path: [], contact: null,
        stoppedBy: 'range', destroyed: false, migrated: false,
        caught: false, consumed: false, heroDied: false, stopVolley: false,
    };
    let hitsLeft = Math.max(1, object.spe + 1);
    let previous = null;
    let curveLeft = state.u.rightHanded;
    await flush_screen(0);
    try {
        for (let step = 0; step < 10; step++) {
            curveLeft = !curveLeft;
            const stepX = xdir[direction] ?? 0;
            const stepY = ydir[direction] ?? 0;
            const x = flight.x + stepX, y = flight.y + stepY;
            if (!isok(x, y)) {
                flight.stoppedBy = 'edge';
                break;
            }
            flight.x = x;
            flight.y = y;
            const monster = monsterAtPosition(state.level, x, y);
            if (monster) {
                const response = await respondToImmediateMagic(monster, state);
                if (response?.heroDied) {
                    flight.heroDied = true;
                    break;
                }
                if (hitsLeft-- < 0) {
                    flight.contact = monster;
                    flight.stoppedBy = 'monster';
                    break;
                }
                await snuffCandle(object, state);
                const hit = await hitMonsterWithThrownObject(monster, object, {
                    state, target: { x, y }, ...(volley ? { volley } : {}),
                });
                if (hit.heroDied) {
                    flight.heroDied = true;
                    break;
                }
                if (hit.consumed) {
                    flight.consumed = true;
                    break;
                }
            }
            const location = state.level.requireAt(x, y);
            if (!ZAP_POS(location.typ) || location.typ === DOOR
                && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED))) {
                flight.x -= stepX;
                flight.y -= stepY;
                flight.stoppedBy = 'terrain';
                break;
            }
            if (x === state.u.ux && y === state.u.uy) {
                if (state.u.fumbling || propertyIsActive('fumbling', state)
                    || rn2(20) >= currentAttribute(A_DEX, state)) {
                    const damage = rollPhysicalWeaponDamageAgainstHero(object, state);
                    const hit = await hitHeroWithObject(object, state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 10 + object.spe, { state, name: 'boomerang' });
                    flight.heroDied = hit.died;
                    flight.stopVolley = true;
                    if (!hit.died && volley && volley.index < volley.count) {
                        const index = volley.index;
                        const suffix = index % 100 >= 11 && index % 100 <= 13 ? 'th'
                            : index % 10 === 1 ? 'st' : index % 10 === 2 ? 'nd'
                                : index % 10 === 3 ? 'rd' : 'th';
                        await plineWithContinuation(`You stop throwing after the ${index}${suffix} toss.`);
                    }
                }
                else {
                    if (previous)
                        await newsym(previous.x, previous.y);
                    previous = null;
                    await plineWithContinuation('You skillfully catch the boomerang.');
                    flight.caught = true;
                }
                break;
            }
            flight.path.push({ x, y });
            if (previous)
                await newsym(previous.x, previous.y);
            previous = cansee(x, y) ? { x, y } : null;
            if (previous)
                await show_glyph_cell(x, y, curveLeft ? ')' : '(', CLR_BROWN, false, 0, {
                    kind: 'effect', glyph: cmapToGlyph(curveLeft ? CmapSymbol.boomleft : CmapSymbol.boomright),
                });
            const cursor = lastDirtyMapCursor();
            await flush_screen(1);
            if (cursor)
                state.nhDisplay?.setCursor(...cursor);
            await state.animationFrame?.();
            if (location.typ === SINK) {
                if (!heroIsDeaf(state))
                    await plineWithContinuation('Klonk!');
                await wakeMonstersNearWithMessages(x, y, 20, state);
                flight.stoppedBy = 'sink';
                break;
            }
            if (step % 5 !== 0)
                direction = (direction + (state.u.rightHanded ? 7 : 1)) % 8;
        }
    }
    finally {
        if (previous)
            await newsym(previous.x, previous.y);
    }
    return flight;
}
// C zap.c:zhitm().
async function damageRayMonster(monster, nativeType, dice, { state, publish, random, rollDice, rollOne, }) {
    const rayType = normalizedRayType(nativeType);
    const damageType = rayDamageType(rayType);
    const spell = nativeType >= 10 && nativeType < 20;
    const inside = nativeType >= 0 && state.u.uswallow && state.u.ustuck === monster;
    const spellDamage = (damage) => spell ? adjustSpellDamage(damage, state) : damage;
    const options = { state, publish, random, rollOne, visible: canSeeMonster(monster) };
    let hit = { damage: 0, resisted: false };
    let savingThrow = nativeType >= 0;
    let sourceDamage = 0;
    if (damageType === AD_SLEE) {
        const duration = rollDice(dice, 25);
        if (MONSTER_SYMBOL[monster.mnum] === 13 && !monster.msleeping && !monster.mfrozen)
            await revealMonsterAppearance(monster, { includeMonsterDisguise: false });
        const resisted = monsterResistsSleep(monster)
            || monsterResistsEffect(monster, nativeType === 3 ? 12 : state.u.ulevel, random);
        if (resisted)
            await shieldeff(monster.mx, monster.my, state);
        const slept = !resisted && monster.mcanmove !== 0;
        if (slept) {
            await finishMonsterEating(monster, state);
            await putMonsterToSleep(monster, duration);
        }
        return { damage: 0, sleepEffect: true, resisted, slept };
    }
    if (damageType === AD_DISN) {
        savingThrow = false;
        if (rayType === 24) {
            hit = await disintegrateMonster(monster, state);
        }
        else if (MONSTER_NAME[monster.mnum] === 'Death') {
            const maximum = monster.mhpmax;
            healMonster(monster, Math.trunc(maximum * 3 / 2), Math.trunc(maximum / 2));
            monster.mhpmax = Math.min(MAGIC_COOKIE - 1, monster.mhpmax);
            return { damage: 0, absorbedDeath: true };
        }
        else if (monsterIsNonliving(monster.mnum)
            || (monsterIsDemon(monster.mnum))
            || monsterIsVampireShifter(monster) || monsterHasMagicResistance(monster)) {
            hit.resisted = true;
        }
        else {
            hit.damage = monster.mhp + 1;
        }
    }
    else if (damageType === AD_ELEC) {
        sourceDamage = spellDamage(rollDice(dice, 6));
        hit.resisted = monsterHasShockResistance(monster);
        hit.damage = hit.resisted ? 0 : sourceDamage;
        if (!inside && dice > 2 && !resistsBlnd({ monster }, state)) {
            monster.mcansee = 0;
            monster.mblinded = Math.min(127, (monster.mblinded ?? 0) + rollOne(50));
        }
        if (random(3) === 0)
            hit.damage += await destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options);
    }
    else {
        hit.resisted = rayResistance(monster, damageType, state);
        if (!hit.resisted) {
            hit.damage = rollDice(dice, 6);
            if ([AD_MAGM, AD_FIRE, AD_COLD].includes(damageType))
                hit.damage = spellDamage(hit.damage);
            sourceDamage = hit.damage;
            if (damageType === AD_FIRE) {
                if (monsterResistanceBits(monster) & MR_COLD)
                    hit.damage += 7;
                if (await burnArmorByFire(monster, state, publish, [], random, { visible: options.visible })
                    && random(3) === 0) {
                    hit.damage += await destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.FIRE, sourceDamage, options);
                    await igniteItems(monster.minvent || monster.inventory, {
                        ...options,
                    });
                }
            }
            else if (damageType === AD_COLD) {
                if (monsterResistanceBits(monster) & MR_FIRE)
                    hit.damage += rollDice(dice, 3);
                if (random(3) === 0)
                    hit.damage += await destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.COLD, sourceDamage, options);
            }
            else if (damageType === AD_ACID) {
                if (random(6) === 0)
                    await damageObjectWithAcid(monsterWieldedWeapon(monster), { state, publish, random });
                if (random(6) === 0)
                    await erodeArmor(monster, 'corrosion', { state, publish, random });
            }
        }
    }
    if (hit.resisted)
        await shieldeff(monster.mx, monster.my, state);
    // Death and disintegration suppress both the spell bonus and saving throw.
    if (savingThrow && spell && state.urole?.key === 'knight' && state.u.uhave?.questart)
        hit.damage *= 2;
    if (savingThrow && hit.damage > 0 && monsterResistsEffect(monster, nativeType < 10 ? 12 : state.u.ulevel, random))
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
// Part of C zap.c:maybe_destroy_item(): describe how many items burn, shatter, or explode.
function destructionMessage(object, damageType, count, quantity, state = game) {
    const one = count === 1;
    const prefix = one ? (quantity === 1 ? '' : 'One of ')
        : count < quantity ? 'Some of ' : quantity === 2 ? 'Both of ' : 'All of ';
    // C destroy_items() uses yname()/Yname2(), whose mon_owns() names a pet as "your".
    const name = ownedObjectName(object, state, { capitalized: !prefix });
    if (damageType === INVENTORY_DAMAGE.COLD) {
        return `${prefix}${name} ${one ? 'freezes and shatters' : 'freeze and shatter'}!`;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        const wand = object.oclass === WAND_CLASS;
        return `${prefix}${name} ${wand
            ? 'breaks apart and explodes'
            : 'turns to dust and vanishes'}!`;
    }
    if (object.oclass === POTION_CLASS || object.otyp === GLOB_OF_GREEN_SLIME) {
        const verb = object.otyp === POT_OIL
            ? one ? 'ignites and explodes' : 'ignite and explode'
            : one ? 'boils and explodes' : 'boil and explode';
        return `${prefix}${name} ${verb}!`;
    }
    const verb = one ? 'catches fire and burns' : 'catch fire and burn';
    return `${prefix}${name} ${verb}!`;
}
// Part of C zap.c:maybe_destroy_item(): choose damage from a destroyed item stack.
function itemDamage(object, damageType, rollOne) {
    if (damageType === INVENTORY_DAMAGE.COLD)
        return rollOne(4);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return object.oclass === WAND_CLASS ? rollOne(10) : 0;
    if (object.oclass === POTION_CLASS)
        return rollOne(6);
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return Math.trunc(((object.owt ?? 1) + 19) / 20);
    return 1;
}
// Part of C zap.c:destroy_items(): derive the maximum affected stack count from incoming damage.
function destructionLimit(sourceDamage, random) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5))
        limit++;
    return Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
}
// Part of C zap.c:destroy_items(): choose eligible inventory stacks while maintaining bypass state.
function chooseStacks(objects, damageType, limit, random, state) {
    const chosen = Array.from({ length: limit }, () => null);
    let eligible = 0;
    // Even a non-elemental blast traverses inventory and activates bypasses.
    bypassObjectList(objects, false, state);
    let object;
    while ((object = nextUnbypassedObject(objects, state))) {
        if (!destroyable(object, damageType))
            continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit)
            chosen[index] = object;
    }
    return chosen.slice(0, Math.min(eligible, limit)).filter((object) => object !== null);
}
// Part of C zap.c:maybe_destroy_item(): consume destroyed items from a monster's stack.
async function removeMonsterQuantity(monster, object, count, state, publish) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        object.owt = objectWeight(object);
        return;
    }
    await destroyObjectFromMonsterInventory(monster, object, state, { publish });
}
// Part of C zap.c:destroy_items(): the monster-carried inventory branch, including per-item destruction effects.
export async function destroyMonsterInventoryByElement(monster, damageType, sourceDamage, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, visible = false, } = {}) {
    const limit = destructionLimit(sourceDamage, random);
    if (!limit)
        return 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const chosen = chooseStacks(inventory, damageType, limit, random, state);
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(inventory, false, state);
        return 0;
    }
    let damage = 0;
    for (const object of chosen) {
        if (!inventory.includes(object))
            continue;
        if (damageType === INVENTORY_DAMAGE.FIRE
            && object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (visible) {
                observeDistantObjectForNaming(object, state);
                await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
            }
            continue;
        }
        // Native does not recharge a monster's charged ring, but that outcome
        // still spares the ring and skips its destruction roll.
        if (damageType === INVENTORY_DAMAGE.ELECTRIC
            && object.oclass === RING_CLASS
            && objectCharged(object.otyp) && random(3) !== 0)
            continue;
        const resistsItemDamage = damageType === INVENTORY_DAMAGE.ELECTRIC
            ? object.oclass !== RING_CLASS && monsterHasShockResistance(monster)
            : damageType === INVENTORY_DAMAGE.FIRE
                && object.oclass !== POTION_CLASS
                && object.otyp !== GLOB_OF_GREEN_SLIME
                && monsterHasFireResistance(monster);
        const stackDamage = itemDamage(object, damageType, rollOne);
        const total = object.quan ?? object.quantity ?? 1;
        const quantity = Math.max(0, total - Number(!!object.in_use));
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0)
                destroyed++;
        }
        if (!destroyed)
            continue;
        if (visible) {
            observeObjectForNaming(object, { state });
            await publish(destructionMessage(object, damageType, destroyed, quantity, state));
        }
        await removeMonsterQuantity(monster, object, destroyed, state, publish);
        if (!resistsItemDamage)
            damage += stackDamage;
    }
    bypassObjectList(monster.minvent ?? monster.inventory ?? [], false, state);
    return damage;
}
// Part of C zap.c:zhitm(), zap.c:zhitu(), zap.c:dobuzz(), zap.c:zap_over_floor(): decode the ray's elemental effect from its type.
// Native ray types encode the source in the tens digit and the effect in
// units: zap.c decodes the attack type as zaptype modulo 10 (zap.c:4245,
// 4788, 5154).
export function rayDamageType(type) {
    const effects = [AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE,
        AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2];
    const damage = effects[Math.abs(type) % 10];
    if (damage === undefined)
        throw new RangeError(`Invalid native ray type ${type}`);
    return damage;
}
// Part of C zap.c:zhitm(): select the target monster's resistance for the ray element.
function rayResistance(monster, damageType, state) {
    if (damageType === AD_MAGM)
        return monsterHasMagicResistance(monster);
    if (damageType === AD_FIRE)
        return monsterHasFireResistance(monster);
    if (damageType === AD_COLD)
        return monsterHasColdResistance(monster);
    if (damageType === AD_DRST)
        return monsterHasPoisonResistance(monster)
            || artifactById(monsterWieldedWeapon(monster)?.oartifact, state)?.defense === 'poison';
    if (damageType === AD_ACID)
        return monsterHasAcidResistance(monster);
    return false;
}
// C zap.c:zhitu().
//: the per-element ray switch for the hero; the damage
// tail is applyRayDamage() with losehp().
export async function hitHeroWithRay({ state = game, attack = heroBreathAttack(state), publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, die = finishHeroDeath, source = 'hero-breath', sourceMonster = null, name = null, nativeType = null, sourceObject = null, } = {}) {
    if (!attack)
        return { hit: false, damage: 0, heroDied: false };
    requirePlayingGame(state);
    const damageType = effectiveBreathDamage(attack[1]);
    const context = {
        state, attack, damageType, publish, random, rollDice, rollOne, die,
        source, sourceMonster, sourceObject, nativeType, name,
    };
    if (damageType === AD_MAGM) {
        const { state, attack, publish, rollDice } = context;
        if (propertyIsActive('antimagic', state)) {
            await shieldeff(state.u.ux, state.u.uy, state);
            await publish('The missiles bounce off!');
            noteRayResistance(context, true);
            return { hit: true, damageType, ...(await (applyRayDamage(context, 0, 'blast of missiles', true))) };
        }
        const damage = rollDice(attack[2], 6);
        await exerciseAttribute(A_STR, false, state);
        noteRayResistance(context, false);
        return { hit: true, damageType, ...(await (applyRayDamage(context, damage, 'blast of missiles'))) };
    }
    else if (damageType === AD_FIRE) {
        const { state, attack, publish, random, rollDice, rollOne } = context;
        const sourceDamage = rollDice(attack[2], 6);
        const resisted = propertyIsActive('fireResistance', state);
        if (resisted) {
            await shieldeff(state.u.ux, state.u.uy, state);
            await publish("You don't feel hot!");
            noteRayResistance(context, true);
            await applyHeroGolemEffects(AD_FIRE, sourceDamage, { state, publish });
        }
        if (!resisted)
            noteRayResistance(context, false);
        if (clearHeroSliming(state))
            await publish('The slime that covers you is burned away!');
        const bodyHit = await burnArmorByFire(state.u, state, publish, [], random);
        if (bodyHit && random(3) === 0) {
            const items = await destroyFireInventory(sourceDamage, {
                state, publish, random, rollOne, die: context.die,
            });
            if (items.heroDied)
                return { hit: true, damageType, ...(await ({ resisted, heroDied: true })) };
        }
        if (bodyHit && random(3) === 0) {
            await igniteItems(state.inventory, {
                state, publish, random,
            });
        }
        return { hit: true, damageType, ...(await (applyRayDamage(context, resisted ? 0 : sourceDamage, 'blast of fire', resisted))) };
    }
    else if (damageType === AD_COLD) {
        const { state, attack, publish, random, rollDice, rollOne } = context;
        const sourceDamage = rollDice(attack[2], 6);
        const resisted = propertyIsActive('coldResistance', state);
        if (resisted) {
            await shieldeff(state.u.ux, state.u.uy, state);
            await publish("You don't feel cold.");
            noteRayResistance(context, true);
            await applyHeroGolemEffects(AD_COLD, sourceDamage, { state, publish });
        }
        else {
            noteRayResistance(context, false);
        }
        if (random(3) === 0) {
            const items = await destroyColdInventory(sourceDamage, {
                state, publish, random, rollOne, die: context.die,
            });
            if (items.heroDied)
                return { hit: true, damageType, ...(await ({ resisted, heroDied: true })) };
        }
        return { hit: true, damageType, ...(await (applyRayDamage(context, resisted ? 0 : sourceDamage, 'blast of frost', resisted))) };
    }
    else if (damageType === AD_SLEE) {
        const { state, attack, publish, rollDice } = context;
        const resisted = propertyIsActive('sleepResistance', state);
        if (resisted) {
            await shieldeff(state.u.ux, state.u.uy, state);
            await publish("You don't feel sleepy.");
            noteRayResistance(context, true);
        }
        else {
            noteRayResistance(context, false);
            await putHeroToSleep(rollDice(attack[2], 25), { state, publish });
        }
        return { hit: true, damageType, ...(await ({ resisted, damage: 0, heroDied: false })) };
    }
    else if (damageType === AD_DISN) {
        const { state, publish, random, die } = context;
        if (context.nativeType != null ? Math.abs(context.nativeType) !== 24
            : !context.source.endsWith('breath')) {
            const form = state.u.umonnum;
            if (monsterIsNonliving(form) || (monsterIsDemon(form))) {
                await shieldeff(state.u.ux, state.u.uy, state);
                await publish('You seem unaffected.');
                return { hit: true, damageType, ...(await ({ resisted: true, damage: 0, heroDied: false })) };
            }
            if (propertyIsActive('antimagic', state)) {
                await shieldeff(state.u.ux, state.u.uy, state);
                noteRayResistance(context, true);
                await publish("You aren't affected.");
                return { hit: true, damageType, ...(await ({ resisted: true, damage: 0, heroDied: false })) };
            }
            noteRayResistance(context, false);
            state.u.ugrave_arise = NON_PM;
            // C zhitu() calls done() directly, without an ordinary HP-death line.
            const heroDied = await die({ killer: context.name || 'finger of death', deathLineShown: true });
            return { hit: true, damageType, ...(await ({ resisted: false, damage: 0, heroDied })) };
        }
        // Native rolls inventory protection before checking the hero's resistance.
        const protectedItems = hasWornProperty('disintegrationResistance', state)
            && random(100) < 99;
        if (state.u.disintegrationResistance) {
            await publish('You are not disintegrated.');
            noteRayResistance(context, true);
            return { hit: true, damageType, ...(await ({ resisted: true, damage: 0, heroDied: false })) };
        }
        if (protectedItems) {
            return { hit: true, damageType, ...(await ({ resisted: true, damage: 0, heroDied: false })) };
        }
        noteRayResistance(context, false);
        const shield = wornObject(state, 'uarms');
        if (shield) {
            await disintegrateWornArmor(shield, { state, publish });
            return { hit: true, damageType, ...(await ({ resisted: false, damage: 0, heroDied: false })) };
        }
        const suit = wornObject(state, 'uarm');
        if (suit) {
            const cloak = wornObject(state, 'uarmc');
            if (cloak) {
                await disintegrateWornArmor(cloak, { state, publish });
            }
            await disintegrateWornArmor(suit, { state, publish });
            return { hit: true, damageType, ...(await ({ resisted: false, damage: 0, heroDied: false })) };
        }
        const cloak = wornObject(state, 'uarmc');
        if (cloak) {
            await disintegrateWornArmor(cloak, { state, publish });
        }
        const shirt = wornObject(state, 'uarmu');
        if (shirt) {
            await disintegrateWornArmor(shirt, { state, publish });
        }
        state.u.ugrave_arise = context.nativeType === -24 ? -3 : NON_PM;
        monstersForgetHeroResistance(M_SEEN_MAGR, state, monster => monsterHasLineOfSightToHero(monster, state));
        // zhitu() calls done(DIED) directly; only losehp() prints "You die...".
        const heroDied = await die({ killer: context.name || 'blast of disintegration', deathLineShown: true });
        return { hit: true, damageType, ...(await ({ resisted: false, damage: 0, heroDied })) };
    }
    else if (damageType === AD_ELEC) {
        const { state, attack, publish, random, rollDice, rollOne } = context;
        const sourceDamage = rollDice(attack[2], 6);
        const resisted = propertyIsActive('shockResistance', state);
        if (resisted) {
            await shieldeff(state.u.ux, state.u.uy, state);
            await publish("You aren't affected.");
            noteRayResistance(context, true);
            await applyHeroGolemEffects(AD_ELEC, sourceDamage, { state, publish });
        }
        else {
            await exerciseAttribute(A_CON, false, state);
            noteRayResistance(context, false);
        }
        if (random(3) === 0) {
            const items = await destroyElectricInventory(sourceDamage, {
                state, publish, random, rollOne, die: context.die,
            });
            if (items.heroDied)
                return { hit: true, damageType, ...(await ({ resisted, heroDied: true })) };
        }
        return { hit: true, damageType, ...(await (applyRayDamage(context, resisted ? 0 : sourceDamage, 'blast of lightning', resisted))) };
    }
    else if (damageType === AD_DRST) {
        const { state, random, rollDice, publish, die } = context;
        const poison = await poisonHero({
            reason: 'blast',
            killer: 'poisoned blast',
            attribute: A_DEX,
            fatal: 15,
            state,
            random,
            rollDice,
            publish,
            die,
        });
        return { hit: true, damageType, ...(await ({
                resisted: !!poison.resisted,
                damage: poison.damage ?? 0,
                heroDied: poison.died,
            })) };
    }
    else if (damageType === AD_ACID) {
        const { state, attack, publish, random, rollDice } = context;
        const resisted = propertyIsActive('acidResistance', state);
        let damage = 0;
        if (resisted) {
            await publish(`The ${displayLiquidName('acid', state)} doesn't hurt.`);
            noteRayResistance(context, true);
        }
        else {
            await publish(`The ${displayLiquidName('acid', state)} burns!`);
            damage = rollDice(attack[2], 6);
            await exerciseAttribute(A_STR, false, state);
            noteRayResistance(context, false);
        }
        const hero = state.u;
        const twoWeapons = !!hero.twoweap;
        if (random(twoWeapons ? 3 : 6) === 0) {
            await damageObjectWithAcid(state.uwep || hero.uwep, { state, publish, random });
        }
        if (twoWeapons && random(3) === 0) {
            await damageObjectWithAcid(state.uswapwep || hero.uswapwep, { state, publish, random });
        }
        if (random(6) === 0)
            await erodeArmor(state.u, 'corrosion', { state, publish, random });
        return { hit: true, damageType, ...(await (applyRayDamage(context, damage, 'blast of acid', resisted))) };
    }
    else {
        return { hit: true, damageType, ...(await applyRayDamage(context, 0, '')) };
    }
}
// C zap.c:destroy_items(&gy.youmonst, AD_FIRE, dmg) as the fire-effect
// callers use it.
export function destroyFireInventory(sourceDamage, options = {}) {
    return destroyInventoryByElement(INVENTORY_DAMAGE.FIRE, sourceDamage, options);
}
// C zap.c:destroy_items(&gy.youmonst, AD_COLD, dmg).
export function destroyColdInventory(sourceDamage, options = {}) {
    return destroyInventoryByElement(INVENTORY_DAMAGE.COLD, sourceDamage, options);
}
// C zap.c:destroy_items(&gy.youmonst, AD_ELEC, dmg).
export function destroyElectricInventory(sourceDamage, options = {}) {
    return destroyInventoryByElement(INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options);
}
// C youprop.h:Half_spell_damage, including carried artifact extrinsics.
// zap.c:4584-4586 halves wand and spell damage through this property.
export function heroHasHalfSpellDamage(state = game) {
    return !!(state.u?.halfSpellDamage
        || (state.u?.halfSpellDamageTurns ?? 0) > 0
        || heroHasCarriedArtifactFlag('SPFX_HSPDAM', state));
}
// C attacktype_fordmg(youmonst.data, AT_BREA, ...) as polyself.c polymon()
// picks the hero form's breath attack.
export function heroBreathAttack(state = game, damageType = null) {
    const form = heroMonsterForm(state);
    if (form == null)
        return null;
    return (MONSTER_ATTACKS[form] || []).find(([attackType, attackDamage]) => attackType === AT_BREA
        && (damageType == null || attackDamage === damageType)) || null;
}
// Part of C zap.c:zhitu(): let watching monsters learn or forget the hero's resistance.
function noteRayResistance(context, resisted) {
    const observe = resisted ? monstersObserveHeroResistance : monstersForgetHeroResistance;
    const damageType = !context.source.endsWith('breath') && context.damageType === AD_DISN
        ? AD_MAGM : context.damageType;
    observe(seenResistanceForDamage(damageType), context.state, (monster) => monsterHasLineOfSightToHero(monster, context.state));
}
// Part of C zap.c:zhitu(): apply half spell damage and construct the ray's death attribution.
async function applyRayDamage(context, damage, name, resisted = false) {
    const { state, publish, die, source, sourceMonster } = context;
    const breath = source.endsWith('breath');
    if (!breath && heroHasHalfSpellDamage(state))
        damage = Math.trunc((damage + 1) / 2);
    const rayName = context.name || name;
    const verb = breath ? 'exhaled' : source.endsWith('spell') ? 'cast'
        : context.sourceObject?.oclass === TOOL_CLASS ? 'played' : 'zapped';
    const reflexive = state.flags?.female ? 'herself' : 'himself';
    const killer = sourceMonster
        ? monsterSpellDeathReason(sourceMonster, rayName).replace('inflicted', verb)
        : source.startsWith('monster-') ? rayName : `${rayName} ${verb} by ${reflexive}`;
    const heroDied = await loseHeroHp(damage, killer, { state, publish, die });
    return { resisted, damage, heroDied };
}
// Part of C hack.h:BZ_OFS_AD(): map random dragon breath to its effective fire element.
export function effectiveBreathDamage(damageType) {
    // BZ_OFS_AD(AD_RBRE) maps the Chromatic Dragon's hero breath to fire.
    return damageType === AD_RBRE ? AD_FIRE : damageType;
}
// C zap.c's disintegration branch reads the hero's uarmc/uarmu globals
// directly (zap.c:4482-4483); the runtime keeps dual slot aliases.
function wornObject(state, slot) {
    return state[slot] || state.u?.[slot] || null;
}
// C zap.c:burn_floor_objects().
export async function burnFloorObjectsAt(x, y, { state = game, giveFeedback = false, heroCaused = false, publish = plineWithContinuation, random = rn2, visible = cansee(x, y), repaint = newsym, } = {}) {
    const pile = state.level?.objects?.[x]?.[y] || [];
    let burned = 0;
    for (const object of [...pile]) {
        if (!floorObjectBurns(object)
            || object.otyp === SCR_FIRE
            || object.otyp === SPE_FIREBALL
            || objectResistsDestruction(object, 2, 100, random))
            continue;
        const quantity = object.quan ?? object.quantity ?? 1;
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0)
                destroyed++;
        }
        if (!destroyed)
            continue;
        const feedback = giveFeedback ? floorBurnMessage(object, destroyed, state) : null;
        await removeBurnedFloorQuantity(object, destroyed, state, heroCaused, publish);
        burned += destroyed;
        if (feedback)
            await publish(feedback);
    }
    await igniteItems(pile, {
        state,
        publish,
        random,
        visible,
    });
    if (burned && couldsee(x, y))
        await repaint(x, y);
    return burned;
}
// Part of C zap.c:burn_floor_objects(): select scrolls, books, and green slime globs.
function floorObjectBurns(object) {
    return object?.otyp === GLOB_OF_GREEN_SLIME
        || object?.oclass === SCROLL_CLASS
        || object?.oclass === SPBOOK_CLASS;
}
// Part of C zap.c:burn_floor_objects(): consume burned floor items with hero-caused billing when applicable.
async function removeBurnedFloorQuantity(object, count, state, heroCaused, publish) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (!heroCaused && count < quantity) {
        object.quan = quantity - count;
        object.quantity = object.quan;
        object.owt = objectWeight(object);
        return;
    }
    if (heroCaused)
        await useUpFloorObject(object, count, { state, publish });
    else
        await delobj(object, state);
}
// Part of C zap.c:burn_floor_objects(): describe burned objects with local or distant naming.
function floorBurnMessage(object, destroyed, state) {
    if (object.ox === state.u.ux && object.oy === state.u.uy)
        observeObjectForNaming(object, { state });
    else
        observeDistantObjectForNaming(object, state);
    const name = objectName({ ...object, quan: 1, quantity: 1 }, state);
    if (destroyed > 1)
        return `${destroyed} ${pluralizeObjectNoun(object, name)} burn.`;
    const subject = withIndefiniteArticle(name);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} burns.`;
}
// C zap.c:bounce_dir().
export function rayBounceDirection(x, y, dx, dy, bounceback, state = game, random = rn2) {
    if (!dx || !dy || (bounceback > 0 && random(bounceback) === 0))
        return { dx: -dx, dy: -dy };
    const previousX = x - dx;
    const previousY = y - dy;
    let bounce = 0;
    const vertical = state.level?.at(x, previousY);
    const verticalAhead = state.level?.at(x + dx, previousY);
    if (vertical && rayPositionIsOpen(x, previousY, state)
        && (IS_ROOM(vertical.typ)
            || rayPositionIsValid(x + dx, previousY)
                && !!verticalAhead && ZAP_POS(verticalAhead.typ))) {
        bounce = 1;
    }
    const horizontal = state.level?.at(previousX, y);
    const horizontalAhead = state.level?.at(previousX, y + dy);
    if (horizontal && rayPositionIsOpen(previousX, y, state)
        && (IS_ROOM(horizontal.typ)
            || rayPositionIsValid(previousX, y + dy)
                && !!horizontalAhead && ZAP_POS(horizontalAhead.typ))
        && (!bounce || random(2))) {
        bounce = 2;
    }
    if (bounce === 2)
        return { dx: -dx, dy };
    if (bounce === 1)
        return { dx, dy: -dy };
    return { dx: -dx, dy: -dy };
}
// C zap.c:zap_hit().
function zapHit(armorClass, spellType, state, random, rollOne) {
    const chance = random(20);
    const bonus = spellType ? spellHitBonus(spellType, state) : 0;
    if (!chance)
        return rollOne(10) < armorClass + bonus;
    const effectiveArmorClass = armorClass >= 0 ? armorClass : -rollOne(-armorClass);
    return 3 - chance < effectiveArmorClass + bonus;
}
// C zap.c:disintegrate_mon().
// The ray destroys armor, then the monster.
async function disintegrateMonster(monster, state) {
    if (monsterHasDisintegrationResistance(monster)) {
        return { damage: 0, resisted: true };
    }
    const shield = wornInSlot(monster, W_ARMS);
    if (shield)
        return { damage: 0, armorToDisintegrate: shield, resisted: false };
    const suit = wornInSlot(monster, W_ARM);
    if (suit) {
        const cloak = wornInSlot(monster, W_ARMC);
        if (cloak)
            await destroyObjectFromMonsterInventory(monster, cloak, state);
        return { damage: 0, armorToDisintegrate: suit, resisted: false };
    }
    for (const mask of [W_ARMC, W_ARMU]) {
        const object = wornInSlot(monster, mask);
        if (object)
            await destroyObjectFromMonsterInventory(monster, object, state);
    }
    return { damage: MAGIC_COOKIE, disintegrated: true, noCorpse: true };
}
// C zap.c:ubuzz().
export function ubuzz(type, dice, direction, options = {}) {
    return dobuzz(type, dice, direction, options);
}
// C zap.c:buzz().
export function buzz(type, dice, direction, options = {}) {
    return dobuzz(type, dice, direction, options);
}
// C zap.c:dobuzz().
export async function dobuzz(nativeType, dice, direction, { state = game, sourceMonster = null, sourceObject = null, originX = state.u.ux, originY = state.u.uy, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, die = finishHeroDeath, finishMonsterKill = finishHeroMonsterKill, sayHit = true, sayMiss = false, forceMiss = false, } = {}) {
    requirePlayingGame(state);
    if (!isRayDirection(direction))
        return { used: false, heroDied: false, hits: 0 };
    const rayType = normalizedRayType(nativeType);
    const damageType = rayDamageType(rayType);
    const kind = rayType < 10 ? 'wand' : rayType < 20 ? 'spell' : 'breath';
    const context = {
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
        if (nativeType < 0)
            return { used: false, heroDied: false, hits: 0 };
        return hitSwallowingMonster(context);
    }
    if (nativeType < 0)
        await newsym(state.u.ux, state.u.uy);
    const savedHitPosition = state.bhitpos;
    try {
        const { state, random, publish } = context;
        const [dx, dy] = DIRECTIONS[direction];
        const range = 7 + random(7);
        const fireball = context.nativeType === 11;
        let endpoint = { x: originX, y: originY };
        let vanishedAt = null;
        const stopped = await runRay({
            state, direction, range: dx || dy ? range : 1,
            beamType: context.displayDamageType - 1, originX, originY, random,
            canSee: (x, y) => cellIsVisible(state, x, y),
            onCell: async (cell) => {
                endpoint = cell;
                if (fireball)
                    return { stop: !!rayMonsterAt(cell.x, cell.y, state) };
                return hitRayCell(cell, context);
            },
            stopAtObstacle: fireball,
            onObstacle: ({ previousX, previousY }) => {
                endpoint = { x: previousX, y: previousY };
            },
            onBounce: () => publish(`The ${context.displayName()} bounces!`),
            onVanish: async ({ x, y }) => {
                vanishedAt = { x, y };
                await publish(`The ${context.displayName()} vanishes into the aether!`);
            },
        });
        if (fireball && !state.program_state.gameover) {
            // dobuzz(): a fireball that "vanishes into the aether" on the Plane
            // of Air still detonates, coerced to a wand-style fire blast at the
            // cell it entered before rebounding off the open sky.
            const spot = vanishedAt ?? endpoint;
            const blastType = vanishedAt !== null ? 1 : 11;
            await explode(spot.x, spot.y, blastType, context.rollDice(12, 6), RANDOM_CLASS, EXPL_FIERY, { state, publish, heroCaused: true });
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
    finally {
        state.bhitpos = savedHitPosition;
    }
}
// C rm.h:m_at(): the ray target lookup, guarded for states without a level.
export function rayMonsterAt(x, y, state = game) {
    return state.level ? monsterAtPosition(state.level, x, y) : null;
}
// Part of C zap.c:dobuzz(): test a ray against the target monster's armor class.
export function rayHitsMonster(monster, random = rn2, rollOne = rnd, { state = game, spellType = 0, } = {}) {
    return zapHit(findMonsterArmorClass(monster), spellType, state, random, rollOne);
}
// Part of C zap.c:dobuzz(): test a ray against the hero's armor class.
export function rayHitsHero(state = game, random = rn2, rollOne = rnd) {
    const armorClass = typeof state.u.uac === 'number' && Number.isFinite(state.u.uac) ? state.u.uac : 10;
    return zapHit(armorClass, 0, state, random, rollOne);
}
// Part of C zap.c:dobuzz(): traverse, display, reflect, and bounce a ray across the map.
export async function runRay({ state = game, direction, range, beamType, originX = state.u.ux, originY = state.u.uy, random = rn2, canSee = (x, y) => cansee(x, y), onCell, stopAtObstacle = false, onObstacle = null, onBounce = async () => undefined, onVanish = async () => undefined, }) {
    let dx = DIRECTION_X[direction] || 0;
    let dy = DIRECTION_Y[direction] || 0;
    let x = originX;
    let y = originY;
    const beamCells = new TemporaryMapEffect('beam', zapdir_to_glyph(dx, dy, beamType));
    await beamCells.start();
    let heroDied = false;
    try {
        while (range-- > 0) {
            const previousX = x;
            const previousY = y;
            x += dx;
            y += dy;
            const valid = isok(x, y);
            const location = valid ? state.level?.at(x, y) : null;
            let cell = {};
            if (valid && location?.typ !== STONE) {
                if (canSee(x, y)) {
                    const monster = rayMonsterAt(x, y, state);
                    if (monster && !canSpotMonster(monster))
                        await map_invisible(x, y);
                    else if (!monster)
                        await unmap_invisible(x, y);
                }
                if (canSee(x, y)
                    && (rayPositionIsOpen(x, y, state)
                        || (rayPositionIsValid(previousX, previousY)
                            && canSee(previousX, previousY)))) {
                    await paintRayCell(beamCells, x, y, dx, dy, beamType);
                    await captureRayTraversalFrame(state);
                }
                state.bhitpos = { x, y };
                cell = await onCell({
                    x, y, dx, dy, location: location ?? null, remainingRange: range,
                }) || {};
                range += cell.rangeChange || 0;
                if (cell.reflected) {
                    dx = -dx;
                    dy = -dy;
                }
                if (cell.stop) {
                    heroDied = !!cell.result?.heroDied;
                    return cell.result;
                }
            }
            if (!rayPositionIsOpen(x, y, state)) {
                if (cell.absorbed)
                    break;
                range--;
                if ((range > 0 && rayPositionIsValid(previousX, previousY) && canSee(previousX, previousY)
                    || stopAtObstacle) && Is_airlevel(state.u?.uz)) {
                    await onVanish({ x, y, previousX, previousY });
                    break;
                }
                if (stopAtObstacle) {
                    await onObstacle?.({ x, y, previousX, previousY });
                    break;
                }
                if (range > 0 && rayPositionIsValid(previousX, previousY)
                    && canSee(previousX, previousY)) {
                    await onBounce({ x, y, previousX, previousY });
                }
                const bounceback = rayBouncebackChance(valid, location, state);
                ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback, state, random));
            }
        }
    }
    finally {
        if (!heroDied && !state.program_state?.gameover)
            await beamCells.clear();
    }
    return undefined;
}
// Port only: flush a ray animation frame and preserve its display cursor.
export async function captureRayTraversalFrame(state = game) {
    const frameCursor = lastDirtyMapCursor();
    const messageCursor = state._pending_message
        ? [state._pending_message.length, 0] : null;
    await flush_screen(1);
    if (frameCursor)
        state.nhDisplay?.setCursor(...frameCursor);
    else if (messageCursor)
        state.nhDisplay?.setCursor(...messageCursor);
    await state.animationFrame?.();
}
// Part of C zap.c:dobuzz(): update the temporary beam glyph for the current direction and position.
export async function paintRayCell(effect, x, y, dx, dy, beamType) {
    const glyph = zapdir_to_glyph(dx, dy, beamType);
    effect.changeGlyph(glyph);
    await effect.draw(x, y);
}
// Part of C zap.c:dobuzz(): choose the bounceback chance for stone, mine walls, or other terrain.
function rayBouncebackChance(valid, location, state) {
    if (!valid || location?.typ === STONE)
        return 10;
    if (In_mines(state.u?.uz) && IS_WALL(location?.typ ?? STONE))
        return 20;
    return 75;
}
// Part of C zap.c:dobuzz(): apply floor effects and dispatch monster or hero hits at one ray square.
async function hitRayCell({ x, y, dx, dy, remainingRange }, context) {
    const { state, attack, damageType, publish, random, rollDice, rollOne, finishMonsterKill, } = context;
    let floor = { absorbed: false, rangeChange: 0 };
    let reflected = false;
    let leavesPoisonCloud = damageType === AD_DRST;
    let rangeChange = 0;
    if (damageType !== AD_DRST) {
        floor = await applyRayFloorFeatures(floorKind(damageType, context.nativeType), x, y, state, { rayNoun: context.floorNoun, random, publish, heroCaused: context.nativeType >= 0 });
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
                if (cansee(monster.mx, monster.my))
                    leavesPoisonCloud = false;
            }
            else {
                const hit = await damageRayMonster(monster, context.nativeType, attack[2], {
                    state, publish, random, rollDice, rollOne,
                });
                const aftermath = await finishMonsterRayHit(monster, hit, {
                    state, displayName: context.displayName, finishMonsterKill, publish,
                    random, source: context.source, sayHit: context.sayHit, x, y,
                });
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
        }
        else if (context.sayMiss || canSeeMonster(monster)
            && (canSenseMonster(monster)
                || [M_AP_NOTHING, M_AP_MONSTER].includes(M_AP_TYPE(monster)))) {
            await publish(rayMissMessage(context.displayName(), monster, { x, y, state }));
        }
    }
    else if (x === state.u.ux && y === state.u.uy
        && remainingRange + floor.rangeChange >= 0) {
        const heroHit = await hitHeroOnRay(x, y, dx, dy, context);
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
// Part of C zap.c:dobuzz(): apply a hero ray inside an engulfer.
async function hitSwallowingMonster(context) {
    const { state, attack, publish, random, rollDice, rollOne } = context;
    const engulfer = state.u.ustuck;
    if (!engulfer)
        throw new Error('A swallowed ray requires its engulfing monster.');
    const hit = await damageRayMonster(engulfer, context.nativeType, attack[2], {
        state, publish, random, rollDice, rollOne,
    });
    const monster = state.u.ustuck;
    if (!monster) {
        state.u.uswallow = 0;
    }
    else {
        const punctuation = hit.damage > 4 ? '!' : '.';
        await publish(`The ${context.displayName()} rips into ${monsterName(monster, { state })}${punctuation}`);
        if (hit.disintegrated)
            monster.mhp = 0;
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
// Part of C zap.c:dobuzz(): select a monster or occasionally the hero's steed at the ray square.
function rayTargetAt(x, y, remainingRange, context) {
    const { state, random } = context;
    const monster = rayMonsterAt(x, y, state);
    if (monster)
        return monster;
    if (x !== state.u.ux || y !== state.u.uy || remainingRange < 0)
        return null;
    nomul(0, state);
    const steed = state.u.usteed;
    if (steed && random(3) === 0 && !monsterReflectsRay(steed, state))
        return steed;
    return null;
}
// Part of C zap.c:dobuzz(): describe a visible monster reflecting the ray.
async function showMonsterReflection(monster, context) {
    const { state, publish } = context;
    if (!cansee(monster.mx, monster.my))
        return;
    await publish(rayHitMessage(context.displayName(), monster, {
        x: monster.mx, y: monster.my, state,
    }));
    await shieldeff(monster.mx, monster.my, state);
    const reflection = mon_reflects(monster, state);
    if (!reflection)
        throw new Error('A reflecting monster has no reflection source.');
    await publish(`But it reflects from ${possessiveName(monsterName(monster, { state }))} ${reflection.noun}!`);
    discoverHeroReflectionSource(reflection, state);
}
// Part of C zap.c:dobuzz(): resolve the hero's hit, reflection, near miss, and occupation interruption.
async function hitHeroOnRay(x, y, rayDx, rayDy, context) {
    const { state, damageType, publish, random, rollOne } = context;
    const canSeeHero = (monster) => monsterHasLineOfSightToHero(monster, state);
    nomul(0, state);
    const hit = !context.forceMiss && rayHitsHero(state, random, rollOne);
    let reflected = false;
    let heroDied = false;
    if (hit) {
        // C zap.c:dobuzz() anchors the hit line with pline_dir(xytodir(-dx,-dy)),
        // naming the square the ray arrived from for accessiblemsg prefixes.
        set_msg_dir(xyToDirection(-rayDx, -rayDy));
        await publish(`The ${context.displayName()} hits you!`);
        if (state.iflags.messageLocation)
            delete state.iflags.messageLocation;
        if (heroReflectsRay(state)) {
            const source = ureflects(state);
            if (heroIsBlind(state)) {
                await publish('For some reason you are not affected.');
            }
            else {
                await publish(`But it reflects from your ${source?.noun || 'shield'}!`);
                if (source)
                    discoverHeroReflectionSource(source, state);
            }
            monstersObserveHeroResistance(M_SEEN_REFL, state, canSeeHero);
            await shieldeff(x, y, state);
            reflected = true;
        }
        else {
            const result = await hitHeroWithRay(context);
            heroDied = !!result.heroDied;
            if (!heroDied)
                monstersForgetHeroResistance(M_SEEN_REFL, state, canSeeHero);
        }
    }
    else if (!heroIsBlind(state)) {
        await publish(`The ${context.displayName()} whizzes by you!`);
    }
    else if (damageType === AD_ELEC) {
        await publish(`Your ${body_part(ARM, state)} tingles.`);
    }
    if (!heroDied) {
        if (damageType === AD_ELEC)
            await blindHeroWithLightning(context);
        await stopHeroOccupation(state, publish);
        nomul(0, state);
    }
    return { hit, reflected, heroDied };
}
// Part of C zap.c:dobuzz(): resolve hit messages, rider recovery, disintegration, death, and waking.
async function finishMonsterRayHit(monster, hit, { state, displayName, finishMonsterKill, publish, random, source = 'hero-breath', deathContext = null, sayHit = true, x, y, }) {
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
            const eye = body_part(EYE, state);
            const eyes = eyecount(heroSpecies(state)) === 1 ? eye : makePlural(eye);
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
        if (hit.disintegrated) {
            // zap.c evaluates disintegrate_mon()'s flash_str() argument
            // before the call, so a hallucinating hero draws one
            // hallucinated blast name here even when the monster is
            // unseen or its death message never names the ray.
            const blastName = displayName();
            if (visible) {
                await publish(wornMonsterLifeSaver(monster)
                    ? rayHitMessage(blastName, monster, { x, y, damage: hit.damage, state })
                    : `${nameTarget()} is disintegrated!`);
            }
            await destroyDisintegratedMonsterInventory(monster, state, random);
            if (source.startsWith('monster-')) {
                // disintegrate_mon() finishes with monkilled(mon, NULL, ...).
                await finishMonsterKilled(monster, state, {
                    damageType: 'disintegration', cause: null, publish, random,
                });
                return { heroDied: !!state.program_state?.gameover };
            }
            await finishMonsterKill(monster, monster.mx, monster.my, {
                // disintegrate_mon() always passes XKILL_NOMSG|XKILL_NOCORPSE.
                noCorpse: true,
                showKillMessage: false,
                deathContext,
            });
            return { heroDied: !!state.program_state?.gameover };
        }
        if (source.startsWith('monster-')) {
            // zap.c's DEADMONSTER branch passes flash_str() to monkilled();
            // the argument is evaluated even when the message is suppressed.
            const effect = displayName();
            await finishMonsterKilled(monster, state, {
                damageType: AD_RBRE, cause: effect, publish, random,
            });
            return { heroDied: !!state.program_state?.gameover };
        }
        await finishMonsterKill(monster, monster.mx, monster.my, {
            // dobuzz() passes XKILL_NOCORPSE only for burned-up golems;
            // species without corpses still roll treasure and corpse_chance().
            noCorpse: !!hit.noCorpse,
            showKillMessage: true,
            deathContext,
        });
        return { heroDied: !!state.program_state?.gameover };
    }
    if (sayHit || visible)
        await publish(rayHitMessage(displayName(), monster, {
            x, y, damage: hit.damage, state,
        }));
    if (hit.slept)
        await sleptMonst(monster, { state, publish });
    if (!hit.sleepEffect)
        return wakeMonster(monster, { attacked: source.startsWith('hero-') });
    return { heroDied: false };
}
// Part of C zap.c:disintegrate_mon(): discard inventory that does not survive disintegration.
async function destroyDisintegratedMonsterInventory(monster, state, random) {
    const lifeSaver = wornMonsterLifeSaver(monster) ?? null;
    const inventory = [...(monster.minvent || monster.inventory || [])];
    for (const object of inventory) {
        if (objectSurvivesDisintegration(object, lifeSaver, state, random))
            continue;
        await destroyObjectFromMonsterInventory(monster, object, state);
    }
}
// Part of C zap.c:disintegrate_mon(): test item resistance, quest artifacts, and the worn life-saving amulet.
function objectSurvivesDisintegration(object, lifeSaver, state, random) {
    if ([BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES]
        .includes(object.otyp))
        return true;
    if (objectResistsDestruction(object, 5, 50, random))
        return true;
    const artifact = artifactById(object.oartifact, state);
    if (object.questArtifact
        || artifact?.questArtifact || object === lifeSaver)
        return true;
    return false;
}
// Part of C zap.c:dobuzz(): roll the lightning flash duration before testing blindness resistance.
async function blindHeroWithLightning({ state, attack, rollDice, publish }) {
    // dobuzz rolls the duration even when flashburn resists blindness.
    await flashBurn(rollDice(attack[2], 50), true, { state, publish });
}
// Part of C zap.c:zap_over_floor(): distinguish elemental floor effects and death from disintegration.
function floorKind(damageType, nativeType) {
    if (damageType === AD_FIRE)
        return 'fire';
    if (damageType === AD_COLD)
        return 'cold';
    if (damageType === AD_DISN)
        return Math.abs(nativeType) === 24 ? 'disintegration' : 'death';
    if (damageType === AD_ELEC)
        return 'lightning';
    if (damageType === AD_ACID)
        return 'acid';
    return 'breath';
}
// Part of C zap.c:zap_over_floor(): the cansee(x, y) gate, read from the
// state's vision buffer and blind alias.
function cellIsVisible(state, x, y) {
    return !state.blind && !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2);
}
// Port only: narrow a direction string to a supported ray direction.
function isRayDirection(value) {
    return value !== undefined && Object.hasOwn(DIRECTIONS, value);
}
// Part of C zap.c:flash_str(): select the ordinary ray name from its source and damage type.
export function realRayName(damageType, kind) {
    const name = names[kind][damageType - 1];
    if (name === undefined)
        throw new RangeError(`Invalid ${kind} damage type ${damageType}`);
    return name;
}
// C zap.c:melt_ice().
export async function meltIce(x, y, { announce = plineWithContinuation, message = 'The ice crackles and melts.', } = {}) {
    const level = requireGameLevel(game);
    const location = level.at(x, y);
    if (!location)
        throw new RangeError(`Cannot melt ice outside the map: ${x},${y}`);
    if (location.typ === DRAWBRIDGE_UP || location.typ === DRAWBRIDGE_DOWN) {
        // A lowered bridge hides its ice, but its existing timer still expires.
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_ICE;
    }
    else {
        if (location.typ !== ICE)
            throw new Error(`cannot melt non-ice position ${x},${y}`);
        location.typ = location.icedpool === ICED_POOL ? POOL : MOAT;
        location.flags = 0;
        location.icedpool = 0;
    }
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game);
    await meltIceTrap(x, y);
    if (game.program_state.gameover)
        return;
    updateIceObjectTimersAt(x, y, game);
    await unearthFloorObjectsAt(x, y, game);
    if (game.program_state.gameover)
        return;
    if (game.underwater)
        await vision_recalc(1);
    await newsym(x, y);
    if (cansee(x, y) || game.u.ux === x && game.u.uy === y)
        await announce(message || 'The ice crackles and melts.', { noRepeat: true });
    let boulder = floorBoulderAt(x, y);
    if (boulder) {
        if (cansee(x, y)) {
            const subject = withIndefiniteArticle(objectName(boulder));
            await announce(`${subject.charAt(0).toUpperCase()}${subject.slice(1)} settles...`);
        }
        do {
            remove_object(boulder, game);
            if (!await dropBoulderIntoLiquid(boulder, x, y, game, { publish: announce }))
                await impossible('melt_ice: no pool?');
            if (game.program_state.gameover)
                return;
        } while (isPoolAt(x, y) && (boulder = floorBoulderAt(x, y)));
        await newsym(x, y);
    }
    if (game.u.ux === x && game.u.uy === y) {
        await applyHeroLocationEffects(announce, { pick: true });
    }
    else if (isPoolAt(x, y)) {
        const monster = monsterAtPosition(requireGameLevel(game), x, y);
        if (monster) {
            await resolveMonsterLiquid(monster, game, {
                announce, finishDeath: game.context.mon_moving
                    ? finishMonsterLiquidDeath : finishHeroLiquidMonsterDeath,
                monsterMoving: !!game.context.mon_moving,
            });
        }
    }
}
// Part of C zap.c:melt_ice(): find a boulder above the thawing square.
function floorBoulderAt(x, y) {
    return requireGameLevel(game).objects[x]?.[y]?.find(object => object.otyp === BOULDER);
}
// C zap.c:start_melt_ice_timeout().
export function startMeltIceTimer(x, y, minimumTime = 0, state = game, random = rn2) {
    let delay = Math.max(minimumTime, 49);
    while (++delay <= 2000) {
        if (random(2000 - delay + 50) === 0)
            break;
    }
    if (delay > 2000)
        return null;
    return scheduleLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, (state.moves ?? 0) + delay, state);
}
// C zap.c:zap_over_floor().
// for ray and wand spots; mcastu.c reaches it
// through mon_spell_hits_spot() for monster fire and lightning spells.
export async function applyRayFloorFeatures(kind, x, y, state = game, { rayNoun = 'bolt', random = rn2, heroCaused = true, explodingWand = 0, heroBurnsObjects = heroCaused, publish = plineWithContinuation } = {}) {
    const location = state.level?.at(x, y);
    if (!location)
        return { absorbed: false, rangeChange: 0 };
    const visible = cansee(x, y);
    let rangeChange = 0;
    let shopDamage = false;
    const yourRay = heroCaused && !explodingWand;
    const wandType = [POT_OIL, SCR_FIRE].includes(explodingWand) ? 0 : explodingWand;
    if (kind === RAY_FIRE) {
        const web = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y && candidate.ttyp === WEB);
        if (web) {
            // zap_over_floor(): a burning web is too flimsy to notice
            // unseen, and the burst message precedes delfloortrap().
            if (visible)
                await publish('A web bursts into flames!');
            // delfloortrap() releases a trapped hero through
            // reset_utrap(TRUE), which may report flight.
            await deleteFloorTrap(web, state);
            // C zap.c:5170-5171: an unseen square is not refreshed after
            // the web burns; the burst message and newsym() share the
            // see_it gate, so a sensed monster there keeps its drawn
            // appearance (no fresh hallucinated glyph from the display RNG).
            if (visible)
                await newsym(x, y);
        }
    }
    if (kind === RAY_FIRE && isIceAt(x, y, state)) {
        await meltIce(x, y);
    }
    else if (kind === RAY_FIRE) {
        rangeChange += await evaporatePoolAt(x, y, state, publish, heroCaused);
    }
    if (state.program_state.gameover)
        return { absorbed: false, rangeChange };
    if (kind === RAY_FIRE && location.typ === FOUNTAIN) {
        await createPoisonGasCloud(state, x, y, rnd(3), 0, random, publish);
        if (visible)
            await publish('Steam billows from the fountain.');
        rangeChange--;
        await dryFountainAt(x, y, { causedByHero: heroBurnsObjects, state, publish, random });
    }
    else if (kind === RAY_COLD) {
        rangeChange += await freezeLiquidAt(x, y, state, publish);
    }
    else if (kind === 'poison' && ZAP_POS(location.typ)) {
        await createPoisonGasCloud(state, x, y, 1, 8, random, publish);
    }
    const damagesBars = location.typ === IRONBARS
        && (kind === RAY_ACID || (kind === RAY_LIGHTNING && random(10) === 0));
    if (damagesBars) {
        const action = kind === RAY_ACID ? 'corrode' : 'melt';
        if ((location.wall_info ?? 0) & W_NONDIGGABLE) {
            if (visible) {
                await publish(`The iron bars ${action} somewhat but remain intact.`, { noRepeat: true });
            }
        }
        else {
            rangeChange -= 3;
            // The message can pause at --More-- with the beam over intact bars.
            if (visible) {
                await publish(`The iron bars ${action}${kind === RAY_ACID ? ' away' : ''}.`, { noRepeat: true });
            }
            await dissolveBars(x, y, state);
            if (roomsAt(state.level, x, y, SHOPBASE).length) {
                addShopDamage(x, y, heroCaused ? SHOP_BARS_COST : 0, state);
                shopDamage ||= heroCaused;
            }
        }
    }
    if (location.typ === SDOOR) {
        convertSecretDoor(location, state);
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        if (visible) {
            await publish(`${yourRay ? 'Your' : 'The'} ${rayNoun} reveals a secret door.`);
        }
        else if (Is_rogue_level(state.u.uz)) {
            await publish(formatDraftMessage(false, state, random));
        }
    }
    let absorbed = false;
    if (closedDoor(state, x, y)) {
        absorbed = true;
        if (kind === RAY_FIRE || kind === RAY_COLD
            || kind === RAY_DISINTEGRATION || kind === RAY_LIGHTNING
            || wandType === WAN_STRIKING) {
            if (roomsAt(state.level, x, y, SHOPBASE).length) {
                addShopDamage(x, y, heroCaused ? SHOP_DOOR_COST : 0, state);
                shopDamage ||= heroCaused;
            }
            location.doormask = kind === RAY_LIGHTNING || wandType === WAN_STRIKING
                ? D_BROKEN : D_NODOOR;
            vision_note_blocker_change(x, y);
            if (visible) {
                await publish(wandType === WAN_STRIKING ? 'The door crashes open!' : destroyedDoorMessage(kind));
                await newsym(x, y);
            }
            else if (wandType === WAN_STRIKING) {
                await publish('You feel a burst of cool air.');
            }
            else if (kind === RAY_FIRE) {
                await publish('You smell smoke.');
            }
            else if (kind === RAY_COLD) {
                await publishHeardMessage('a deep cracking sound.', publish, state);
            }
            else {
                await publishHeardMessage(kind === RAY_DISINTEGRATION ? 'crashing wood.' : 'crackling.', publish, state);
            }
            const occupation = state._occupation;
            if (occupation?.key === 'pick-lock' && occupation.door === location) {
                await stopHeroOccupation(state, publish);
                resetPick(state);
            }
        }
        else if (visible) {
            await publish(wandType ? 'The door remains intact.'
                : `The door absorbs ${yourRay ? 'your' : 'the'} ${rayNoun}!`);
        }
        else {
            await publish(formatFeltMessage('vibrations.', state));
        }
    }
    if (absorbed)
        rangeChange = -1000;
    if (kind === RAY_FIRE) {
        const burned = await burnFloorObjectsAt(x, y, { state, publish, random, heroCaused: heroBurnsObjects });
        if (burned && couldsee(x, y)) {
            const blind = !!state.blind
                || (state.u?.blindTurns ?? 0) > 0;
            await publish(blind
                ? 'You smell a whiff of smoke.'
                : 'You see a puff of smoke.');
        }
    }
    return { absorbed, rangeChange, shopDamage };
}
// Part of C zap.c:zap_over_floor(): restart an existing ice-melt timer after a cold hit.
function firmExistingIce(x, y, state = game) {
    const timer = state.level?.levelTimers?.find(candidate => candidate.x === x && candidate.y === y
        && candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    if (!timer)
        return;
    const remaining = Math.max(0, timer.deadline - (state.moves ?? 0));
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    startMeltIceTimer(x, y, remaining, state);
}
// C rm.h:m_at() via steed.ts:monsterAt(): the liquid-effect square's living
// occupant.
// Part of C zap.c:zap_over_floor(): reveal a hidden swimmer when water freezes or evaporates.
async function revealStrandedSwimmer(x, y, state = game) {
    const monster = monsterAt(state, x, y);
    if (!monster || !monster.mundetected
        || !(monsterIsSwimmer(monster.mnum)))
        return;
    monster.mundetected = 0;
    await newsym(x, y);
}
// Part of C zap.c:zap_over_floor(): freeze water or solidify lava, updating occupants and ice timers.
async function freezeLiquidAt(x, y, state, publish) {
    const location = state.level?.at(x, y);
    if (!location)
        return 0;
    if (isIceAt(x, y, state)) {
        firmExistingIce(x, y, state);
        return 0;
    }
    const lavaWall = location.typ === LAVAWALL;
    const lava = isLavaAt(x, y, state);
    if (!isPoolAt(x, y, state) && !lava)
        return 0;
    const visible = cansee(x, y);
    const temperature = state.level?.flags?.temperature || 0;
    const briefFreeze = IS_WATERWALL(location.typ)
        || (lavaWall && rn2(Math.max(2, 5 + temperature * 10)) !== 0);
    if (briefFreeze) {
        if (visible) {
            await publish(`The ${displayLiquidName(lavaWall ? 'lava' : 'water', state)} freezes for a moment.`);
        }
        else {
            await publishHeardMessage('a soft crackling.', publish, state);
        }
        return -1000;
    }
    const waterbody = waterbodyName(x, y, state);
    const wasMoat = isMoatAt(x, y, state);
    if (location.typ === DRAWBRIDGE_UP) {
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_UNDER;
        location.drawbridgemask |= lava ? DB_FLOOR : DB_ICE;
    }
    else {
        location.icedpool = lava ? 0
            : location.typ === POOL ? ICED_POOL : ICED_MOAT;
        if (lavaWall) {
            const north = state.level?.at(x, y - 1);
            const south = state.level?.at(x, y + 1);
            location.typ = !!north && IS_WALL(north.typ) || !!south && IS_WALL(south.typ)
                ? VWALL : HWALL;
            fix_wall_spines(Math.max(0, x - 1), Math.max(0, y - 1), Math.min(COLNO - 1, x + 1), Math.min(ROWNO - 1, y + 1));
        }
        else {
            location.typ = lava ? ROOM : ICE;
        }
    }
    await buryFloorObjectsAt(x, y, state, { publish });
    if (visible) {
        const message = lava
            ? `The ${displayLiquidName('lava', state)} cools and solidifies.`
            : wasMoat ? `The ${waterbody} is bridged with ice!`
                : `The ${displayLiquidName('water', state)} freezes.`;
        await publish(message, { noRepeat: true });
        await newsym(x, y);
    }
    else if (!lava) {
        await publishHeardMessage('a crackling sound.', publish, state);
    }
    if (state.u?.ux === x && state.u?.uy === y) {
        if (state.u.uinwater) {
            state.u.uinwater = 0;
            state.u.uundetected = 0;
            await docrt();
            state.vision_full_recalc = 1;
        }
        else if (state.u.utrap && state.u.utraptype === TT_LAVA) {
            if (state.u.passesWalls) {
                await publish('You pass through the now-solid rock.');
                await resetUtrap(true, state);
            }
            else {
                setHeroTrap(rn1(50, 20), TT_INFLOOR, state);
                await publish('You are firmly stuck in the cooling rock.');
            }
        }
    }
    else {
        await revealStrandedSwimmer(x, y, state);
    }
    if (!lava) {
        startMeltIceTimer(x, y, 0, state);
        updateIceObjectTimersAt(x, y, state, { includeBuried: true });
    }
    // Cooling changes the surface without changing its vision blocking.
    // A visibility reset here would erase an active ray at the hero.
    return -3;
}
// Part of C zap.c:zap_over_floor(): create steam, evaporate pools, and resolve newly exposed pits.
async function evaporatePoolAt(x, y, state, publish, heroCaused) {
    const location = state.level?.at(x, y);
    if (!location || !isPoolAt(x, y, state))
        return 0;
    const visible = cansee(x, y);
    const deaf = !!(state.u?.deaf || state.deaf);
    const waterLevel = Is_waterlevel(state.u?.uz);
    let enveloped = false;
    if (!waterLevel) {
        await createPoisonGasCloud(state, x, y, rnd(5), 0, rn2, publish);
        enveloped = state._lastPlineKind === PLNMSG_ENVELOPED_IN_GAS;
    }
    let message = !deaf ? 'You hear hissing gas.'
        : heroCaused ? 'That seemed remarkably uneventful.' : null;
    let rangeChange = 0;
    let pit = null;
    if (location.typ === POOL) {
        rangeChange = -3;
        location.typ = ROOM;
        location.flags = 0;
        pit = await maketrap(x, y, PIT);
        if (visible)
            message = 'The water evaporates.';
    }
    else if (waterLevel) {
        message = visible || !deaf ? 'Some water boils.' : null;
    }
    else if (visible) {
        message = 'Some water evaporates.';
    }
    if (message && !enveloped)
        await publish(message, { noRepeat: true });
    if (location.typ === ROOM) {
        await revealStrandedSwimmer(x, y, state);
        await newsym(x, y);
        const monster = monsterAt(state, x, y);
        if (pit && state.u.ux === x && state.u.uy === y)
            await dotrap(pit);
        else if (pit && monster) {
            requirePlayingGame(state);
            await mintrap(monster, state, { publish });
        }
    }
    return rangeChange;
}
// Part of C zap.c:zap_over_floor(): choose the visible elemental door-destruction message.
function destroyedDoorMessage(kind) {
    if (kind === RAY_FIRE)
        return 'The door is consumed in flames!';
    if (kind === RAY_COLD)
        return 'The door freezes and shatters!';
    if (kind === RAY_DISINTEGRATION)
        return 'The door disintegrates!';
    return 'The door splinters!';
}
// C zap.c:fracture_rock().
export async function fractureRock(object, x, y, { state = game, random = rn2, publish = pline } = {}) {
    // "no texts here!" beyond the shop-billing
    // message.  Callers own any "shatters"/"falls apart" prose.
    const byYou = !state.context?.mon_moving;
    const location = getObjectLocation(object, state);
    if (byYou && location) {
        const spot = costlySpot(location.x, location.y, state);
        if (spot && shopClaimsObject(object, spot.resident, false, state)) {
            await publish(`You fracture ${shopkeeperName(spot.resident)}'s ${objectName(object, state)}.`);
            await breakObjectAtLocation(object, {
                x: location.x, y: location.y, state, publish,
                heroCaused: true, showBreakMessage: false,
            });
        }
    }
    if (byYou && object.otyp === BOULDER)
        sokobanGuilt(state);
    object.otyp = ROCK;
    object.oclass = GEM_CLASS;
    object.quan = object.quantity = 7 + random(60);
    object.dknown = object.bknown = object.rknown = false;
    object.known = !objectUsesKnown(ROCK);
    delete object.oextra;
    delete object.oname;
    delete object.name;
    delete object.plural;
    delete object.corpsenm;
    object.owt = objectWeight(object);
    if (object.where === 'floor') {
        // obj_extract_self() + place_object() move the rock stack back on
        // top of the pile, then the open square gets an immediate unblock.
        // A rock stack has no nested contents, so the synchronous placement
        // preserves the raw C extract+place shape (no movobj unhide pass).
        remove_object(object, state);
        placeObjectSynchronously(object, x, y, state);
        const level = state.level;
        if (!level)
            throw new Error('Floor fracture requires a level.');
        if (!visionCellBlocksLight(level, x, y)) {
            vision_note_blocker_change(x, y);
            await vision_recalc(0);
        }
        if (cansee(x, y))
            await newsym(x, y);
    }
}
// C zap.c:break_statue().
export async function breakStatue(statue, x, y, { state = game, random = rn2, publish = pline } = {}) {
    const byYou = !state.context?.mon_moving;
    // A statue trap animates the statue instead of letting it break.
    const monster = await activateStatueTrapAt(x, y, { state, shatter: true });
    if (monster)
        return false;
    for (const object of statue.contents || []) {
        object.where = 'free';
        await placeObject(object, x, y, state);
    }
    statue.contents = [];
    if (byYou && state.urole?.key === 'archeologist' && (statue.spe ?? 0) & CORPSTAT_HISTORIC) {
        await publish(formatFeltMessage('guilty about damaging such a historic statue.', state));
        adjustHeroAlignment(-1, state);
    }
    statue.spe = 0;
    await fractureRock(statue, x, y, { state, random, publish });
    return true;
}
// C zap.c:destroyable().
function destroyable(object, damageType) {
    if (!object || object.artifact || object.oartifact)
        return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1)
        return false;
    const itemClass = object.oclass;
    if (damageType === INVENTORY_DAMAGE.FIRE) {
        if ([SCR_FIRE, SPE_FIREBALL].includes(object.otyp))
            return false;
        return object.otyp === GLOB_OF_GREEN_SLIME
            || [POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS]
                .includes(itemClass);
    }
    if (damageType === INVENTORY_DAMAGE.COLD)
        return itemClass === POTION_CLASS && object.otyp !== POT_OIL;
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        return [RING_CLASS, WAND_CLASS].includes(itemClass)
            && ![RIN_SHOCK_RESISTANCE, WAN_LIGHTNING]
                .includes(object.otyp);
    }
    return false;
}
// C zap.c:adtyp_to_prop().
function adtypToProp(damageType) {
    const properties = {
        [INVENTORY_DAMAGE.COLD]: 'coldResistance',
        [INVENTORY_DAMAGE.FIRE]: 'fireResistance',
        [INVENTORY_DAMAGE.ELECTRIC]: 'shockResistance',
    };
    return properties[damageType];
}
// C zap.c:u_adtyp_resistance_obj().
//: extrinsic & (W_ARMOR | W_ACCESSORY | W_WEP | W_ART) (zap.c:5687) — the
// worn-slot sources plus the carried-artifact W_ART pass that
// set_artifact_intrinsic() installs at addinv/freeinv — gives 99%
// inventory protection, a dwarvish cloak 90% against heat and cold.
function protectionChance(state, damageType) {
    const hero = state.u;
    const property = adtypToProp(damageType);
    if (hasWornProperty(property, state) || hasCarriedProperty(property, null, state))
        return 99;
    const cloak = state.uarmc || hero.uarmc;
    return damageType !== INVENTORY_DAMAGE.ELECTRIC
        && cloak?.otyp === DWARVISH_CLOAK ? 90 : 0;
}
// C zap.c:inventory_resistance_check().
function inventoryResistanceCheck(damageType, state, random) {
    const protection = protectionChance(state, damageType);
    return !!protection && random(100) < protection;
}
// C zap.c:item_what().
//: wizard-mode source of the item-protection line,
// naming the worn piece whose extrinsic protects the inventory.
export function itemResistanceCause(property) {
    // C zap.c:adtyp_to_prop() already applied: callers pass the property.
    const sources = game.u._propertySources?.[property]?.worn ?? [];
    for (const slot of ['uarmc', 'uarm', 'uarmu', 'uarmh', 'uarmg', 'uarmf', 'uarms']) {
        const object = game[slot];
        if (object && sources.some(source => source.slot === slot))
            return ` by your ${simpleArmorName(object, slot, game)}`;
    }
    for (const slot of ['uamul', 'ublindf', 'uleft', 'uright', 'uwep']) {
        if (!sources.some(source => source.slot === slot))
            continue;
        if ((slot === 'uleft' || slot === 'uright')
            && sources.some(source => source.slot === 'uleft') && sources.some(source => source.slot === 'uright'))
            return ' by your rings';
        const object = game[slot];
        if (object)
            return ` by your ${minimalObjectName(object)}`;
    }
    return '';
}
// C zap.c:maybe_destroy_item().
//: one stack of a carrier's inventory meets
// elemental damage; the hero branch loses the HP here, monsters return it.
async function destroyChosenItem(object, damageType, { state, publish, random, rollOne, die, }) {
    const unharmed = { damage: 0, heroDied: false };
    if (inventoryResistanceCheck(damageType, state, random))
        return unharmed;
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.otyp === SPE_BOOK_OF_THE_DEAD) {
        if (!heroIsBlind(state)) {
            observeObject(object, state);
            await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
        }
        return unharmed;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC
        && object.oclass === RING_CLASS) {
        if (glovesBlockRingShock(object, state))
            return unharmed;
        if (objectCharged(object.otyp) && random(3) !== 0)
            return rechargeRing(object, 0, state, { publish, random, rollOne, die });
    }
    const resistant = heroResists(state, damageType);
    const resistanceStopsDamage = damageType === INVENTORY_DAMAGE.ELECTRIC
        ? object.oclass !== RING_CLASS
        : damageType === INVENTORY_DAMAGE.FIRE
            && object.oclass !== POTION_CLASS
            && object.otyp !== GLOB_OF_GREEN_SLIME;
    const total = object.quan ?? object.quantity ?? 1;
    const quantity = Math.max(0, total - Number(!!object.in_use));
    const damage = itemDamage(object, damageType, rollOne);
    let destroyed = 0;
    for (let index = 0; index < quantity; index++) {
        if (random(3) === 0)
            destroyed++;
    }
    if (!destroyed)
        return unharmed;
    if (!heroIsBlind(state))
        observeObject(object, state);
    await publish(destructionMessage(object, damageType, destroyed, quantity, state));
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.oclass === POTION_CLASS) {
        await applySupportedPotionVapor({ state, potion: object, publish });
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    const killer = destroyedItemKiller(object, damageType, destroyed);
    // Native Ring_gone precedes useup, even for a stack with an in-use unit.
    if (isWornRing(object, state)) {
        await removeHeroAccessory(object, state);
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    else if (object.owornmask)
        await removeHeroEquipment(object, state);
    if (state._currentWand === object)
        state._currentWand = null;
    for (let count = 0; count < destroyed; count++) {
        await consumeInventoryItem(object, state);
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    if (!damage)
        return unharmed;
    if (resistant && resistanceStopsDamage) {
        await publish("You aren't hurt!");
        return unharmed;
    }
    const heroDied = await loseHeroHp(damage, killer, {
        state, publish, die,
        deathCause: destroyed > 1 ? `killed by ${killer}` : null,
    });
    if (!heroDied)
        await exerciseAttribute(A_STR, false, state);
    return { damage, heroDied };
}
// Part of C zap.c:maybe_destroy_item(): the u_carry Fire_resistance /
// Shock_resistance macro gates (zap.c:5828, 5860).
function heroResists(state, damageType) {
    if (damageType === INVENTORY_DAMAGE.FIRE)
        return propertyIsActive('fireResistance', state);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return propertyIsActive('shockResistance', state);
    return false;
}
// C zap.c:maybe_destroy_item(): the worn-ring test (uleft/uright or the
// W_RING worn mask) before the shock-resistance gloves check.
function isWornRing(object, state) {
    return object === state.uleft || object === state.uright
        || object === state.u?.uleft || object === state.u?.uright
        || ((object?.owornmask ?? 0) & W_RING) !== 0;
}
// Part of C zap.c:maybe_destroy_item(): protect worn rings from shock with nonmetallic gloves.
function glovesBlockRingShock(object, state) {
    if (!isWornRing(object, state))
        return false;
    const gloves = state.uarmg || state.u?.uarmg;
    if (!gloves)
        return false;
    return !objectIsMetallic(gloves);
}
// Part of C zap.c:maybe_destroy_item(): name the destroyed item responsible for lethal damage.
function destroyedItemKiller(object, damageType, count) {
    let killer;
    if (damageType === INVENTORY_DAMAGE.COLD)
        killer = 'shattered potion';
    else if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        killer = 'exploding wand';
    else if (object.oclass === POTION_CLASS)
        killer = object.otyp === POT_OIL ? 'exploding potion' : 'boiling potion';
    else if (object.otyp === GLOB_OF_GREEN_SLIME)
        killer = 'exploding glob of slime';
    else
        killer = object.oclass === SPBOOK_CLASS ? 'burning book' : 'burning scroll';
    return count === 1 ? killer : makePlural(killer);
}
// C zap.c:destroy_items().
export async function destroyInventoryByElement(damageType, sourceDamage, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, die = finishHeroDeath, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const result = { damage: 0, heroDied: false };
    const limit = destructionLimit(sourceDamage, random);
    if (!limit)
        return result;
    const chosen = chooseStacks(state.inventory, damageType, limit, random, state)
        .map(object => ({ object, deferred: deferHeroItemDestruction(object, state) }));
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(state.inventory, false, state);
        return result;
    }
    for (const deferred of [false, true]) {
        for (const entry of chosen) {
            if (entry.deferred !== deferred || !state.inventory.includes(entry.object))
                continue;
            const hit = await destroyChosenItem(entry.object, damageType, {
                state, publish, random, rollOne, die,
            });
            result.damage += hit.damage;
            if (hit.heroDied)
                return { damage: result.damage, heroDied: true };
        }
    }
    bypassObjectList(state.inventory, false, state);
    return result;
}
// Part of C zap.c:destroy_items(): defer levitation, flight, and form-changing water items.
function deferHeroItemDestruction(object, state) {
    const property = objectPropertyName(object.otyp);
    return (!!object.owornmask && (property === 'levitation' || property === 'flying'))
        || (object.otyp === POT_WATER && ismnum(state.u.ulycn)
            && !!(Upolyd(state.u) ? object.blessed : object.cursed));
}
// C zap.c:resist().
export function monsterResistsEffect(monster, attackLevel, random = rn2) {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50)
        defenseLevel = 50;
    else if (defenseLevel < 1)
        defenseLevel = monsterIsPlayerMonster(monster.mnum) ? game.u.ulevel ?? 1 : 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}
// C zap.c:wishcmdassist().
async function showWishHelp(triesLeft) {
    const countNames = ['zero', 'one', 'two', 'three', 'four', 'five'];
    const count = countNames[triesLeft] ?? String(triesLeft);
    const retry = triesLeft < 5 ? ' more' : '';
    const lines = [
        'Wish details:',
        '',
        'Enter the name of an object, such as "potion of monster detection",',
        '"scroll labeled README", "elven mithril-coat", or "Grimtooth"',
        '(without the quotes).',
        '',
        'For object types which come in stacks, you may specify a plural name',
        'such as "potions of healing", or specify a count, such as "1000 gold',
        'pieces", although that aspect of your wish might not be granted.',
        '',
        'You may also specify various prefix values which might be used to',
        'modify the item, such as "uncursed" or "rustproof" or "+1".',
        'Most modifiers shown when viewing your inventory can be specified.',
        '',
        "You may specify 'nothing' to explicitly decline this wish.",
    ];
    if (!(game.u?.uconduct?.wishes ?? 0))
        lines.push("Doing so will preserve 'wishless' conduct.");
    lines.push('', `If you specify an unrecognized object name ${count}${retry} time${triesLeft === 1 ? '' : 's'},`, 'a randomly chosen item will be granted.', '');
    if (game.flags?.cmdassist !== false) {
        lines.push('(Suppress this assistance with !cmdassist in your config file.)');
    }
    await showTextWindow(lines);
}
// C zap.c:wish_history_add().
///wish_history_menu(). History belongs to the
// running game, is limited to twenty entries, and omits repeated prefixes.
function rememberWish(value) {
    if (!game.flags.debug)
        return;
    const wish = value.trim().replace(/\s+/g, ' ');
    const history = game._wishHistory ?? [];
    if (history.some(previous => wish.toLowerCase().startsWith(previous.toLowerCase())))
        return;
    game._wishHistory = [wish, ...history].slice(0, 20);
}
// C zap.c:wish_history_menu().
async function choosePastWish() {
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const wish of game._wishHistory ?? [])
            tty_add_menu(window, { identifier: wish, text: wish });
        tty_end_menu(window, 'Wish what?');
        const result = await tty_select_menu(window, PICK_ONE);
        return result.selections[0]?.identifier ?? '';
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
}
// C zap.c:makewish().
export async function makeWish() {
    requirePlayingGame(game);
    if (game.flags.verbose !== false) {
        await plineWithContinuation('You may wish for an object.');
        await flushPendingTopline();
    }
    let value = '';
    let result = null;
    let failedAttempts = 0;
    // zap.c captures the artifact-wish conduct before readobjnam() so the
    // livelog can report a first artifact wish.
    const oldWishArti = game.u.uconduct.wisharti ?? 0;
    while (failedAttempts < 5) {
        const assistance = failedAttempts > 0
            && game.flags?.cmdassist !== false
            ? " (enter 'help' for assistance)" : '';
        value = failedAttempts === 0 && game.iflags.menu_requested && game._wishHistory?.length
            ? await choosePastWish()
            : await getLine(`For what do you wish${assistance}?`, (_ch, key) => key >= 32 && key < 127);
        // zap.c:makewish() mungspaces() the typed line before comparing it,
        // parsing it, recording it in the history, and livelogging it.
        value = new TextDecoder().decode(mungSpaces(new TextEncoder().encode(value ?? '')));
        if ((value ?? '').trim().toLowerCase() === 'help') {
            await showWishHelp(5 - failedAttempts);
            continue;
        }
        result = await readObjectName(value ?? '', {
            wizardWish: !!game.flags.debug,
        });
        if (result)
            break;
        await pline('Nothing fitting that description exists in the game.');
        failedAttempts++;
    }
    if (!result) {
        await pline("That's enough tries!");
        result = await readObjectName('', { wizardWish: !!game.flags.debug });
        if (!result) {
            game.context.move = 0;
            return;
        }
    }
    if (result.noWish) {
        if (!['nothing', 'nil', 'none'].includes((value ?? '').trim().toLowerCase()))
            rememberWish(value ?? '');
        else
            recordGameLogEvent('declined to make a wish', { flags: LL_WISH });
        game.context.move = 0;
        return;
    }
    const object = result.object;
    rememberWish(value ?? '');
    if (object.oartifact)
        setArtifactOrigin(object, 'wish', { knownOrigin: true });
    const previousWishes = game.u.uconduct.wishes ?? 0;
    game.u.uconduct.wishes = previousWishes + 1;
    // zap.c:makewish() livelogs the granted wish before dropping the object;
    // its doname() -> xname() observes the object first.
    observeObjectForNaming(object);
    const wish = `"${value ?? ''}", got "${await objectDescription(object)}"`;
    const his = game.flags.female ? 'her' : 'his';
    const artifactFlags = oldWishArti < (game.u.uconduct.wisharti ?? 0) ? LL_ARTIFACT : 0;
    if (!previousWishes)
        recordGameLogEvent(`made ${his} first wish - ${wish}`, { flags: LL_CONDUCT | LL_WISH | artifactFlags });
    else if (!oldWishArti && game.u.uconduct.wisharti)
        recordGameLogEvent(`made ${his} first artifact wish - ${wish}`, { flags: LL_CONDUCT | LL_WISH | LL_ARTIFACT });
    else
        recordGameLogEvent(`wished for ${wish}`, { flags: LL_WISH | artifactFlags });
    if (object.otyp === CORPSE && !(game.uarmg || game.u.uarmg)
        && touchPetrifies(object.corpsenm) && !heroResistsStoning(game))
        object.wishedfor = true;
    const held = await holdAnotherObject(object, { dropMessage: wishDropMessage(object) });
    if (held.heroDied)
        return;
    game.u.ublesscnt = (game.u.ublesscnt || 0) + 50 + rn2(100);
    game.context.move = 0;
}
// Part of C zap.c:makewish(): choose the wished object's slipping, dropping, or materializing message.
function wishDropMessage(object) {
    const hero = game.u;
    const airLevel = Is_airlevel(hero.uz);
    const slips = airLevel || !!hero.uinwater;
    const dangerous = object.otyp === CORPSE && !!object.wishedfor;
    const verb = slips ? 'slip' : dangerous ? 'materialize' : 'drop';
    observeObjectForNaming(object);
    const quantity = object.quan;
    const noun = object.otyp === CORPSE ? corpseName(object) : objectName(object);
    const plural = object.otyp === CORPSE ? noun : pluralizeObjectNoun(object, noun);
    const subject = definiteName(quantity === 1 ? noun : `${quantity} ${plural}`);
    const action = `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${verb}${quantity === 1 ? 's' : ''}`;
    if (hero.uswallow)
        return `Oops!  ${action} out of your reach!`;
    const terrain = game.level?.at(hero.ux, hero.uy)?.typ;
    if (airLevel || Is_waterlevel(hero.uz) || terrain !== undefined && (terrain < IRONBARS || terrain >= ICE))
        return `Oops!  ${action} away from you!`;
    return dangerous ? `Careful! ${action} on the floor!` : `Oops!  ${action} to the floor!`;
}
// C zap.c:flash_str().
export function displayRayName(damageType, kind, { state = game, random = rn2 } = {}) {
    if (!heroIsHallucinating(state))
        return realRayName(damageType, kind);
    return `blast of ${rndHallublast(random)}`;
}
// C mon->data->mresists & mask: the raw resist-bit test zap.c's callers
// apply (polyself.c's fire contact passes MR_FIRE).
export function monsterHasElementalResistance(monster, mask) {
    return !!(monsterResistanceBits(monster) & mask);
}
// C zap.c:destroy_items(mon, AD_COLD, dmg).
export function destroyColdMonsterInventory(monster, sourceDamage, options = {}) {
    return destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.COLD, sourceDamage, options);
}
// C zap.c:destroy_items(mon, AD_FIRE, dmg).
export function destroyFireMonsterInventory(monster, sourceDamage, options = {}) {
    return destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.FIRE, sourceDamage, options);
}
// C zap.c:zhitm(): the damage-only entry muse.c and spell.c call; they own
// the death, wake-up, and hit messages. The numeric result is zhitm's
// applied damage, including MAGIC_COOKIE for disintegration.
export async function hitMonsterWithRay(monster, nativeType, dice, { state = game, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    const hit = await damageRayMonster(monster, nativeType, dice, {
        state, publish, random, rollDice, rollOne,
    });
    return hit.damage;
}
// C eat.c's acid-breath lookup: attacktype_fordmg(youmonst.data, AT_BREA,
// AD_ACID).
export function heroAcidBreathAttack(state = game) {
    return heroBreathAttack(state, AD_ACID);
}
// C apply.c:do_blinding_ray(): the bhit() dispatch of a light source.
export async function doBlindingRay(object, { dx, dy }, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    return bhit(object, COLNO, state, { x: dx, y: dy });
}
// Part of C pray.c:pray_revive(): revive(otmp, TRUE) with the revival's
// deferred message flush and buried-revival effects.
export async function reviveCorpseForHero(corpse, state = game) {
    const result = await revive(corpse, state, { byHero: true });
    await finishBuriedRevival(result, state);
    for (const message of result.messages)
        await plineWithContinuation(message);
    return result;
}
//# sourceMappingURL=zap.js.map