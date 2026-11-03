// Native read.c: doread(), seffects() with its seffect_*() scroll and spell
// effects, learnscrolltyp()/learnscroll(), charge_ok(), recharge(),
// stripspe(), p_glow1()..p_glow3(), wand_explode(), forget(), maybe_tame(),
// valid_cloud_pos(), can_center_cloud(), drop_boulder_on_player(),
// drop_boulder_on_monster(), do_class_genocide(), do_genocide(), punish(),
// unpunish(), cant_revive(), create_particular() and its parse/creation
// halves. Effects own their exceptions to scroll disposal.

import { exerciseAttribute, exerciseWisdom, exerciseAttribute as exerciseAttributeNamed } from './attrib.js';
import { adjustArmorAttributeBonus, armorSlotFor, destroyWornArmor, disintegrateWornArmor, erodeWornArmor, objectIsHardHelmet, removeHeroAccessory, someHeroArmor, wearHeroAccessory, wearHeroArmor, wornArmorInDestroyOrder } from './do_wear.js';
import { explode } from './explosion.js';
import { heroIsPunished, placeBallAndChain, setBallAndChainFelt } from './ball.js';
import { heroHandName, heroHeadName, heroLegName, monsterStomachName } from './body_parts.js';
import { A_CON, A_STR, A_WIS, ACCESSIBLE, COLNO, D_CLOSED, D_LOCKED, DOOR, EXPL_FIERY, G_EXTINCT, G_GENOD, G_NOCORPSE, G_GONE, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, In_endgame, In_quest, IS_AIR, IS_OBSTRUCTED, Is_earthlevel, Is_rogue_level, Luck, M_SEEN_FIRE, MM_EDOG, MM_FEMALE, MM_MALE, MM_MINVIS, MM_NOEXCLAM, MM_NOMSG, NO_MINVENT, PLNMSG_TOWER_OF_FLAME, POLY_REVERT, ROWNO, SDOOR, SPE_LIM, TT_BURIEDBALL, Upolyd, W_ARMH, W_ART, W_ARTI, W_BALL, W_CHAIN, WT_IRON_BALL_INCR } from './const.js';
import { canSpotMonster, displayColorName, displayLiquidName, flashGlyphAt, map_invisible, newsym, shieldeff, transientMonsterGlyph } from './display.js';
import { isok } from './cmd.js';
import { pline as syncPline, plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { revealSecretDoor, detectFood, detectGold, detectTraps, mapMagicLevel } from './detect.js';
import { impossible } from './diagnostics.js';
import { lightDamage, lightRoom, objectLightRadius } from './light.js';
import type { RoomLightOptions } from './light.js';
import { game, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { makeConfused, finishStrangeFeeling, strangeFeeling, makeStunned } from './potion.js';
import { feelingAfterSelfGenocide, genocideDeathOptions, heroIsUnchanging, heroMonsterForm, heroSpecies, polymorphHero, rememberPolymorphGenocide, returnHeroToHumanForm } from './polyself.js';
import { formatFeltMessage, formatHeardMessage, heroCanChant } from './hero_speech.js';
import { sokobanGuilt } from './trap.js';
import { consumeInventoryItem, delobj, identifyPack, inventoryItemDescription } from './invent.js';
import { createCritters, mkclassAligned, rndmonstAdj, setMonsterMalign } from './makemon.js';
import { withMonsterNoticesBlocked, showGetposTip, loseHeroHp, exceedsActionCapacity } from './hack.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL, monsterIsAmorphous, monsterIsHuman, monsterIsNoncorporeal, monsterIsUnsolid, monsterIsVampire, monsterIsWhirly, monsterTypeName, requireMonsterData } from './monster_data.js';
import { makeMonsterFlee } from './monmove.js';
import { monsterAtPosition, monsterSaddle, putSaddleOnMonster } from './steed.js';
import { makePlural, objectName, observeObjectForNaming, ownedObjectAction, ownedObjectName, withIndefiniteArticle } from './objnam.js';
import type { ObjectInscriptionView } from './objnam.js';
import { learnObjectType, observeObject } from './o_init.js';
import { tryCallObjectType } from './do.js';
import { BAG_OF_TRICKS, BELL_OF_OPENING, BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES, BOULDER, BRASS_LANTERN, CAN_OF_GREASE, CORNUTHAUM, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, ELVEN_BOOTS, ELVEN_CLOAK, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, HEAVY_IRON_BALL, HORN_OF_PLENTY, LEASH, LOADSTONE, MAGIC_FLUTE, MAGIC_HARP, MAGIC_LAMP, MAGIC_MARKER, OBJECT_CHARGED, OBJECT_INITIAL_KNOWN, OBJECT_MAGIC, OBJECT_MERGE, OBJECT_NAMES, OIL_LAMP, POT_WATER, ROCK, ALCHEMY_SMOCK, CANDY_BAR, HAWAIIAN_SHIRT, SCR_AMNESIA, SCR_BLANK_PAPER, SCR_CREATE_MONSTER, SCR_DESTROY_ARMOR, SCR_EARTH, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_FIRE, SCR_GENOCIDE, SCR_IDENTIFY, SCR_LIGHT, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SCR_REMOVE_CURSE, SCR_SCARE_MONSTER, SCR_STINKING_CLOUD, SCR_TELEPORTATION, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALE_MAIL, SILVER_DRAGON_SCALES, SLING, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CAUSE_FEAR, SPE_CHARM_MONSTER, SPE_CONFUSE_MONSTER, SPE_CREATE_MONSTER, SPE_DETECT_FOOD, SPE_IDENTIFY, SPE_MAGIC_MAPPING, SPE_NOVEL, SPE_REMOVE_CURSE, TINNING_KIT, WAN_CANCELLATION, WAN_COLD, WAN_DEATH, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_POLYMORPH, WAN_UNDEAD_TURNING, WAN_WISHING, YELLOW_DRAGON_SCALES, objectDirection, requireObjectData } from './object_data.js';
import { blessObjectState, curseObject, curseObjectState, mkobj, objectWeight, uncurseObjectState } from './mkobj.js';
import { askTeleportDestination, teleportHero } from './teleport.js';
import { levelTeleport } from './level_teleport.js';
import { d, rn2, rn1, rnd } from './rng.js';
import { wipeoutText } from './engrave.js';
import { APRON_MESSAGES, CANDY_WRAPPERS, HAWAIIAN_BACKGROUNDS, HAWAIIAN_MOTIFS, SHIRT_MESSAGES } from './readable_object_text.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, deleteObject, objectTypeKnown, updateUnpaidObjectPrice } from './shk.js';
import { dropCursedSecondaryWeapon } from './two_weapon.js';
import { cansee, couldsee } from './vision.js';
import { prepareMapPositionHighlights, selectMapPosition, showGetposInstructions } from './getpos.js';
import { finishHeroDeath as defaultHeroDeath, finishHeroDeath as finishNativeHeroDeath, listGenocided } from './end.js';
import type { DeathHandler } from './end.js';
import { mksobj } from './mkobj.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { propertyIsActive } from './properties.js';
import { createPoisonGasCloud } from './regions.js';
import { drainHeroWeaponSkills } from './skills.js';
import { burnAwayHeroSlime, endObjectBurn } from './timeout.js';
import { loseHeroSpellMemory } from './spell.js';
import { ceilingName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { levelHasCeiling } from './dungeon.js';
import { MONSTER_CLASS_SYMBOLS, monsterObjectPronoun, monstersForgetHeroResistance, monstersObserveHeroResistance, nameToMonster, nameToMonsterClass, resolveMonsterClass, resolveMonsterName } from './mondata.js';
import { addExperience } from './exper.js';
import { enchantWeapon } from './enchant_weapon.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import type { InventoryClassification } from './inventory_prompt.js';
import { gotoLevel as changeLevel, scheduleLevelChange } from './level_change.js';
import { recordLiteracy } from './literacy.js';
import { getLine, promptYesNo } from './query.js';
import { readOrdinaryObject } from './readable_objects.js';
import { angerMonster, changeMonsterForm, finishEnvironmentalMonsterDeath, killGenocidedMonsters, removeMonsterFromGame, wakeMonster, wakeMonstersNearWithMessages } from './mon.js';
import { monsterResistsEffect } from './zap.js';
import { initializePet, tameMonster } from './dog.js';
import { studyBook } from './spellbook_study.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MonsterVital } from './monster_types.js';
import type { Position } from './map_types.js';
import { freeHeroFromBuriedBall } from './dig.js';
import { adjustHeroAlignment } from './alignment.js';
import { LL_CONDUCT, LL_GENOCIDE, recordGameLogEvent } from './gamelog.js';
import { landFloorObject } from './floor_effects.js';
import { possessiveName, upstart } from './hacklib.js';
import { monsterName } from './do_name.js';
import { makemonNear } from './mklev.js';
import { isWeaponTool } from './object_properties.js';
import { questMonsterSound } from './role_monsters.js';
import { addObjectToMonsterInventory } from './steal.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { isWeldedPrimary } from './wield.js';
import { monsterCensus } from './minion.js';
import type { HeroGenocideCause } from './polyself.js';
import type { MonsterNameGender } from './mondata.js';

export type ScrollLevelChange = (...args: Parameters<typeof changeLevel>) => unknown;
export type ScrollMonsterKill = NonNullable<RoomLightOptions['finishMonsterKill']>;

export interface ScrollEffectOptions {
    state?: GameState | undefined;
    gotoLevel?: ScrollLevelChange | undefined;
    finishHeroDeath?: DeathHandler | undefined;
    finishMonsterKill?: ScrollMonsterKill | undefined;
}

export interface ScrollEffectResult {
    known: boolean;
    consumed: boolean;
    heroDied: boolean;
}

type ScrollEffectHooks = Omit<ScrollEffectOptions, 'state'>;
type ScrollEffectChange = Partial<ScrollEffectResult>;
type RemoveCurseSource = Pick<GameObject, 'otyp'>
    & Partial<Pick<GameObject, 'blessed' | 'cursed'>>;

export interface RemoveCurseOptions {
    source?: RemoveCurseSource | null | undefined;
    state?: GameState | undefined;
    blessed?: boolean | undefined;
    cursed?: boolean | undefined;
    confused?: boolean | undefined;
    publish?: MessagePublisher | undefined;
    announce?: boolean | undefined;
}

const WEAPON_CLASS = 2;
const SCROLL_CLASS = 9, SPBOOK_CLASS = 10;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const S_HUMAN = 53;

const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
const SCR_CONFUSE_MONSTER = OBJECT_NAMES.indexOf('confuse monster');
const SCR_TAMING = OBJECT_NAMES.indexOf('taming');
const SCR_GOLD_DETECTION = OBJECT_NAMES.indexOf('gold detection');
const SCR_FOOD_DETECTION = OBJECT_NAMES.indexOf('food detection');
const SCR_CHARGING = OBJECT_NAMES.indexOf('charging');

export async function doread(options: Omit<ScrollEffectOptions, 'state'> = {}) {
    const {
        gotoLevel = (...args: Parameters<typeof changeLevel>) => { scheduleLevelChange(args); },
        ...hooks
    } = options;
    requirePlayingGame(game);
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        return finishRead(false);
    }
    const source = await chooseInventoryObject('read', classifyReadableObject, { forcePrompt: true });
    if (!source) return finishRead(false, true);
    source.pickup_prev = false;
    const type = source.otyp;

    const ordinary = await readOrdinaryObject(source);
    if (ordinary.handled) return finishRead(ordinary.spentTime);
    if (heroIsBlind() && type !== SPE_BOOK_OF_THE_DEAD) {
        const unreadable = type === SPE_NOVEL ? 'words'
            : source.oclass === SPBOOK_CLASS ? 'mystic runes'
            : !source.dknown ? 'formula on the scroll' : null;
        if (unreadable) {
            await pline(`Being blind, you cannot read the ${unreadable}.`);
            return finishRead(false);
        }
    }
    const confused = type !== SCR_MAIL && (game.u.confusionTurns ?? 0) > 0;
    if (type === SCR_MAIL && !game.u.uconduct?.literate && !source.spe) {
        const answer = await promptYesNo(
            'Reading mail will violate "illiterate" conduct.  Read anyway?', 'n');
        if (answer !== 'y') return finishRead(false);
    }
    if (![SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, SPE_BLANK_PAPER, SCR_BLANK_PAPER].includes(type))
        recordLiteracy(`became literate by reading ${source.oclass === SPBOOK_CLASS ? 'a book' : 'a scroll'}`);
    if (source.oclass === SPBOOK_CLASS) {
        const result = await studyBook(source);
        return finishRead(result.spentTime);
    }

    source.in_use = true;
    if (type !== SCR_BLANK_PAPER) await announceScroll(source, confused);
    // C schedule_goto() leaves the source level only after doread finishes
    // discovery and useup, so consumed unpaid scrolls still reach that bill.
    const deferred: { destination: Parameters<typeof changeLevel> | null } = { destination: null };
    const effect = await applyScrollEffects(source, {
        ...hooks,
        gotoLevel: async (...args: Parameters<typeof changeLevel>) => { deferred.destination = args; },
    });
    if (effect.heroDied || game.program_state.gameover) return finishRead(false);
    if (!effect.consumed) {
        if (!OBJECT_INITIAL_KNOWN[type] && !game._knownObjectTypes?.has(type)) {
            if (effect.known) learnScrollType(type);
            else await tryCallObjectType(source);
        }
        source.in_use = false;
        if (type !== SCR_BLANK_PAPER) await consumeInventoryItem(source);
    }
    if (deferred.destination) await gotoLevel(...deferred.destination);
    return finishRead(true);
}

// C read.c:read_ok().
function classifyReadableObject(object: GameObject | null | undefined) {
    if (!object) return GETOBJ_EXCLUDE;
    return [SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
}

async function announceScroll(source: GameObject, confused: boolean) {
    const silently = !heroCanChant();
    const staysVisible = source.otyp === SCR_FIRE || (source.otyp === SCR_REMOVE_CURSE && source.cursed);
    if (heroIsBlind()) {
        const verb = silently ? 'cogitate' : 'pronounce';
        await pline(staysVisible ? `You ${verb} the formula on the scroll.`
            : `As you ${verb} the formula on it, the scroll disappears.`);
    } else {
        await pline(staysVisible ? 'You read the scroll.' : 'As you read the scroll, it disappears.');
    }
    if (confused) await pline(heroIsHallucinating() ? 'Being so trippy, you screw up...'
        : `Being confused, you ${silently ? 'misunderstand' : 'mispronounce'} the magic words...`);
}

function finishRead(spentTime: boolean, cancelled = false) {
    const heroDied = !!game.program_state.gameover;
    game.context.move = Number(spentTime && !heroDied);
    return { spentTime, heroDied, cancelled };
}

// C read.c:learnscrolltyp(). Discovering a scroll awards score experience in
// addition to the Wisdom exercise owned by makeknown().
export function learnScrollType(otyp: number, { state = game }: { state?: GameState | undefined } = {}): boolean {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (OBJECT_INITIAL_KNOWN[otyp] || state._knownObjectTypes?.has(otyp)) return false;
    learnObjectType(otyp, state);
    addExperience(0, 10, state);
    return true;
}

// C read.c:learnscroll().
export function learnScroll(source: Pick<GameObject, 'otyp' | 'oclass'>, {
    state = game,
}: { state?: GameState | undefined } = {}): boolean {
    return source.oclass === SPBOOK_CLASS ? false : learnScrollType(source.otyp, { state });
}

// ---------------------------------------------------------------------------
// Charging. C refs: read.c charge_ok(), recharge() (wand, ring and tool
// halves), stripspe(), p_glow1()..p_glow3(), wand_explode().
// ---------------------------------------------------------------------------

export interface RechargeResult { heroDied: boolean; damage?: number }
export interface RingRechargeResult extends RechargeResult { damage: number }
export interface RechargeRingOptions {
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    die?: DeathHandler;
}

const RING_CLASS = 4;
const TOOL_CLASS = 6;
const WAND_CLASS = 11;
const NODIR = 1;
const WAN_NOTHING = OBJECT_NAMES.indexOf('nothing');

// C read.c:charge_ok().
function chargingChoice(object: GameObject, state: GameState): InventoryClassification {
    if (object.oclass === WAND_CLASS) return GETOBJ_SUGGEST;
    const discovered = object.dknown && objectTypeKnown(object, state);
    if (object.oclass === RING_CLASS && OBJECT_CHARGED[object.otyp]
        && discovered) return GETOBJ_SUGGEST;
    if (isWeaponTool(object)) return GETOBJ_EXCLUDE;
    // Weapons, armor and the rest stay selectable for the "feeling of
    // loss" response.
    if (object.oclass !== TOOL_CLASS) return GETOBJ_EXCLUDE_SELECTABLE;
    if (object.otyp === OIL_LAMP || object.otyp === BRASS_LANTERN
        || object.otyp === MAGIC_LAMP && !objectTypeKnown(object, state))
        return GETOBJ_SUGGEST;
    if (OBJECT_CHARGED[object.otyp]) return discovered ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    return GETOBJ_EXCLUDE;
}

// getobj("charge", charge_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT).
export async function chooseObjectToCharge(state: GameState = game): Promise<GameObject | null> {
    return chooseInventoryObject('charge', object => chargingChoice(object, state),
        { forcePrompt: true, allowCount: true });
}

// C read.c:recharge().
export async function rechargeObject(object: GameObject, blessing: number, state: GameState = game): Promise<RechargeResult> {
    if (object.oclass === WAND_CLASS) {
        await rechargeWand(object, blessing, state);
    } else if (object.oclass === RING_CLASS && OBJECT_CHARGED[object.otyp]) {
        return rechargeRing(object, blessing, state);
    } else if (object.oclass === TOOL_CLASS) {
        await rechargeTool(object, blessing, state);
    } else {
        await pline('You have a feeling of loss.');
    }
    if (state.program_state.gameover) return { heroDied: true };
    if (object.where !== 'gone' && object.where !== 'onbill')
        object.spe = Math.max(-SPE_LIM, Math.min(object.spe, SPE_LIM));
    return { heroDied: false };
}

async function rechargeWand(wand: GameObject, blessing: number, state: GameState) {
    const limit = wand.otyp === WAN_WISHING ? 1
        : objectDirection(wand.otyp, state) === NODIR ? 15 : 8;
    if (wand.spe === -1) wand.spe = 0;
    const previous = wand.recharged;
    if (previous > 0 && (wand.otyp === WAN_WISHING || previous ** 3 > rn2(343))) {
        await explodeWand(wand, rnd(limit), state);
        return;
    }
    wand.recharged = previous + 1;
    if (blessing < 0) {
        await stripCharges(wand, state);
        return;
    }
    let charges = limit === 1 ? 1 : rn1(5, limit - 4);
    if (blessing === 0) charges = rnd(charges);
    wand.spe = wand.spe < charges ? charges : wand.spe + 1;
    if (wand.otyp === WAN_WISHING && wand.spe > 3) {
        await explodeWand(wand, 1, state);
    } else {
        await glow(wand, state, limit === 1 || wand.spe >= limit ? 'blue' : null,
            limit === 1);
    }
}

export async function rechargeRing(ring: GameObject, blessing: number, state: GameState = game, {
    publish = pline, random = rn2, rollOne = rnd, die = defaultHeroDeath,
}: RechargeRingOptions = {}): Promise<RingRechargeResult> {
    const adjustment = blessing > 0 ? rollOne(3) : blessing < 0 ? -rollOne(2) : 1;
    const slot = (['uleft', 'uright'] as const).find(slot =>
        state[slot] === ring || state.u[slot] === ring);
    if (ring.spe > random(7) || ring.spe <= -5) {
        if (!heroIsBlind(state)) observeObject(ring, state);
        await publish(`${ownedObjectName(ring, state)} pulsates momentarily, then explodes!`);
        if (slot) await removeHeroAccessory(ring, state);
        if (state.program_state.gameover) return { damage: 0, heroDied: true };
        const damage = physicalDamage(rollOne(3 * Math.abs(ring.spe)), state);
        await consumeInventoryItem(ring, state);
        if (state.program_state.gameover) return { damage: 0, heroDied: true };
        // C read.c:recharge() explodes the ring without find_ac(); the
        // worn-ring removal (Ring_gone) already recomputed a protection
        // ring's AC, and moveloop's once-per-input find_ac() catches up.
        const heroDied = await loseHeroHp(damage, 'exploding ring', { state, publish, die });
        return { damage, heroDied };
    }
    const direction = adjustment < 0 ? 'counterclockwise' : 'clockwise';
    if (!heroIsBlind(state)) observeObject(ring, state);
    await publish(`${ownedObjectName(ring, state)} spins ${direction} for a moment.`);
    if (adjustment < 0) await chargeAlteredUnpaidObject(ring, 'disenchant', state);
    if (slot) await removeHeroAccessory(ring, state);
    if (state.program_state.gameover) return { damage: 0, heroDied: true };
    ring.spe += adjustment;
    if (slot) await wearHeroAccessory(ring, slot, state);
    if (state.program_state.gameover) return { damage: 0, heroDied: true };
    // C read.c:recharge()'s spin path never calls find_ac(); Ring_off
    // and Ring_on only recompute for a protection ring with nonzero
    // enchantment, and moveloop's once-per-input find_ac() catches up.
    if (adjustment > 0 && ring.unpaid) updateUnpaidObjectPrice(ring, state);
    ring.spe = Math.max(-SPE_LIM, Math.min(ring.spe, SPE_LIM));
    return { damage: 0, heroDied: false };
}

async function rechargeTool(tool: GameObject, blessing: number, state: GameState) {
    const previous = tool.recharged;
    if (OBJECT_CHARGED[tool.otyp] && previous < 7) tool.recharged++;
    switch (tool.otyp) {
    case BELL_OF_OPENING:
        if (blessing < 0) await stripCharges(tool, state);
        else tool.spe += blessing > 0 ? rnd(3) : 1;
        tool.spe = Math.min(tool.spe, 5);
        return;
    case MAGIC_MARKER:
    case TINNING_KIT:
    case EXPENSIVE_CAMERA:
        if (blessing < 0) {
            await stripCharges(tool, state);
        } else if (previous && tool.otyp === MAGIC_MARKER) {
            tool.recharged = 1;
            await pline(tool.spe < 3 ? 'Your marker seems permanently dried out.' : 'Nothing happens.');
        } else if (blessing > 0) {
            const charges = tool.spe + rn1(16, 15);
            tool.spe = charges <= 50 ? 50 : charges <= 75 ? 75 : Math.min(charges, 127);
            await glow(tool, state, 'blue');
        } else {
            tool.spe = Math.min(Math.max(tool.spe + rn1(11, 10), 50), SPE_LIM);
            await glow(tool, state, 'white');
        }
        return;
    case OIL_LAMP:
    case BRASS_LANTERN:
        if (blessing < 0) {
            await stripCharges(tool, state);
            if (tool.lamplit) {
                if (!heroIsBlind(state)) await pline(`The ${objectName(tool, state)} goes out!`);
                endObjectBurn(tool, state);
            }
        } else {
            tool.spe = 1;
            tool.age = blessing > 0 ? 1500 : Math.min(tool.age + 750, 1500);
            await glow(tool, state, blessing > 0 ? 'blue' : null);
        }
        return;
    case CRYSTAL_BALL:
        if (tool.spe === -1) tool.spe = 0;
        if (blessing < 0) {
            if (!tool.cursed) {
                await glow(tool, state, 'black');
                await curseObject(tool);
            } else {
                await pline(`${ownedObjectName(tool, state)} vibrates briefly.`);
            }
            if (tool.spe > 0) await chargeAlteredUnpaidObject(tool, 'uncharge', state);
            tool.spe = 0;
        } else if (blessing > 0) {
            tool.spe = 7;
            await glow(tool, state, tool.blessed ? 'blue' : 'light blue');
            if (!tool.blessed) blessObjectState(tool);
        } else if (tool.spe < 7 || tool.cursed) {
            tool.spe = Math.min(tool.spe + rnd(2), 7);
            await glow(tool, state, tool.cursed ? 'amber' : null);
            if (tool.cursed) uncurseObjectState(tool);
        } else {
            await pline('Nothing happens.');
        }
        return;
    case HORN_OF_PLENTY:
    case BAG_OF_TRICKS:
    case CAN_OF_GREASE:
        if (blessing < 0) {
            await stripCharges(tool, state);
        } else {
            const charges = blessing > 0 ? rn1(tool.spe <= 10 ? 10 : 5, 6) : rn1(5, 2);
            tool.spe = Math.min(tool.spe + charges, 50);
            await glow(tool, state, blessing > 0 ? 'blue' : null);
        }
        return;
    case MAGIC_FLUTE:
    case MAGIC_HARP:
    case FROST_HORN:
    case FIRE_HORN:
    case DRUM_OF_EARTHQUAKE:
        if (blessing < 0) {
            await stripCharges(tool, state);
        } else {
            tool.spe = Math.min(tool.spe + (blessing > 0 ? d(2, 4) : rnd(4)), 20);
            await glow(tool, state, blessing > 0 ? 'blue' : null);
        }
        return;
    default:
        await pline('You have a feeling of loss.');
    }
}

// C read.c:stripspe().
async function stripCharges(object: GameObject, state: GameState) {
    if (object.blessed || object.spe <= 0) {
        await pline('Nothing happens.');
        return;
    }
    await pline(`${ownedObjectName(object, state)} vibrates briefly.`);
    await chargeAlteredUnpaidObject(object, 'uncharge', state);
    object.spe = 0;
    if (object.otyp === OIL_LAMP || object.otyp === BRASS_LANTERN) object.age = 0;
}

// C read.c:p_glow1().
// C read.c:p_glow2().
// C read.c:p_glow3().
async function glow(object: GameObject, state: GameState, color: string | null = null, feeble = false) {
    const blind = heroIsBlind(state);
    const verb = blind ? 'vibrates' : 'glows';
    const hue = !blind && color ? ` ${displayColorName(color, state)}` : '';
    const duration = color ? 'for a moment' : 'briefly';
    await pline(`${ownedObjectName(object, state)} ${verb}${feeble ? ' feebly' : ''}${hue} ${duration}.`);
}

// C read.c:wand_explode().
export async function explodeWand(wand: GameObject, extraCharges = 0, state: GameState = game) {
    let sides;
    switch (wand.otyp) {
    case WAN_WISHING: sides = 12; break;
    case WAN_CANCELLATION:
    case WAN_DEATH:
    case WAN_POLYMORPH:
    case WAN_UNDEAD_TURNING: sides = 10; break;
    case WAN_COLD:
    case WAN_FIRE:
    case WAN_LIGHTNING:
    case WAN_MAGIC_MISSILE: sides = 8; break;
    case WAN_NOTHING: sides = 4; break;
    default: sides = 6;
    }
    const damage = d(Math.max(2, wand.spe + (extraCharges || 2)), sides);
    wand.in_use = true;
    const motion = extraCharges ? 'vibrates violently and' : 'suddenly';
    await pline(`${ownedObjectName(wand, state)} ${motion} explodes!`);
    if (await loseHeroHp(physicalDamage(damage, state), 'exploding wand', { state })) return;
    await consumeInventoryItem(wand, state);
    await exerciseAttribute(A_STR, false, state);
}

function physicalDamage(amount: number, state: GameState) {
    return state.u.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}

// Armor and weapon scroll effects. C read.c:seffect_enchant_armor(),
// seffect_destroy_armor(), and seffect_enchant_weapon().

// Initial reading prose, Wisdom exercise, normal disposal, and discovery
// remain with seffects()/doread(). Strange feelings consume their own source.
export async function applyArmorScrollEffect(
    source: GameObject, { state = game }: Pick<ScrollEffectOptions, 'state'> = {},
): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let result: Partial<ScrollEffectResult>;
    switch (source.otyp) {
    case SCR_ENCHANT_ARMOR:
        result = await enchantArmor(source, state);
        break;
    case SCR_DESTROY_ARMOR:
        result = await destroyArmor(source, state);
        break;
    case SCR_ENCHANT_WEAPON:
        result = { known: false, consumed: await enchantWeapon(source, state) };
        break;
    default:
        throw new RangeError(`Not an armor or weapon scroll: ${source.otyp}`);
    }
    // C read.c never calls find_ac(): moveloop_core() recomputes u.uac once
    // per player input, after the monsters have moved.
    state._armorClassDirty = true;
    return { known: false, consumed: false, ...result,
        heroDied: !!state.program_state?.gameover };
}

// C read.c:seffect_enchant_armor().
async function enchantArmor(source: GameObject, state: PlayingGameState): Promise<Partial<ScrollEffectResult>> {
    const armor = someHeroArmor(state);
    if (!armor) {
        const result = await strangeFeeling(source, heroIsBlind(state)
            ? 'Your skin feels warm for a moment.' : 'Your skin glows then fades.', { state });
        await exerciseAttribute(A_CON, !source.cursed, state);
        await exerciseAttribute(A_STR, !source.cursed, state);
        return result;
    }
    if (isConfused(state)) {
        await proofArmor(armor, source.cursed, state);
        return {};
    }

    const special = isSpecialArmor(armor, state);
    const safeLimit = special ? 5 : 3;
    const sameColor = !heroIsBlind(state) && (source.cursed
        ? [BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL].includes(armor.otyp)
        : [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL, SHIELD_OF_REFLECTION]
            .includes(armor.otyp));
    let power = armor.spe * (source.cursed ? -1 : 1);
    if (power > safeLimit && rn2(power)) {
        armor.in_use = true;
        await pline(`${armorGlow(armor, source.cursed, sameColor, true, state)} for a while, `
            + `then ${armorVerb(armor, 'evaporate')}.`);
        await destroyWornArmor(armor, state);
        return {};
    }

    power = Math.trunc((4 - Math.max(power, -100)) / 2)
        + Number(special) + Number(!OBJECT_MAGIC[armor.otyp]) + Number(!!source.blessed);
    let amount = power <= 0
        ? (armor.spe > 0 && rn2(armor.spe) === 0 ? 1 : 0)
        : rnd(power);
    amount = Math.min(amount, 11) * (source.cursed ? -1 : 1);
    if (amount >= 0 && armor.otyp >= GRAY_DRAGON_SCALES
        && armor.otyp <= YELLOW_DRAGON_SCALES) {
        await hardenDragonScales(armor, source, state);
        return {};
    }

    await pline(`${armorGlow(armor, source.cursed, sameColor, !amount, state)} `
        + `for a ${amount * amount > 1 ? 'while' : 'moment'}.`);
    if (amount < 0) await chargeAlteredUnpaidObject(armor, 'disenchant', state);
    const oldLight = objectLightRadius(armor, state);
    if (source.cursed && !armor.cursed) curseObjectState(armor);
    else if (source.blessed && !armor.blessed) blessObjectState(armor);
    else if (!source.cursed && armor.cursed) uncurseObjectState(armor);
    await adjustArmorLight(armor, oldLight, state);

    let known = false;
    if (amount) {
        const old = armor.spe ?? 0;
        setEnchantment(armor, old + amount);
        amount = armor.spe - old;
        if (amount) adjustArmorAttributeBonus(armor, amount, state);
        known = !!armor.known;
        if (amount > 0 && armor.unpaid) updateUnpaidObjectPrice(armor, state);
    }
    if (armor.spe > safeLimit && (special || rn2(7) === 0)) {
        await pline(`${ownedObjectAction(armor, 'suddenly vibrate', state)} `
            + `${heroIsBlind(state) ? 'again' : 'unexpectedly'}.`);
    }
    return { known };
}

async function proofArmor(armor: GameObject, cursed: boolean, state: PlayingGameState): Promise<void> {
    const oldProof = !!armor.oerodeproof;
    armor.oerodeproof = false;
    if (heroIsBlind(state)) {
        armor.rknown = false;
        await pline(`${ownedObjectAction(armor, 'feel', state)} warm for a moment.`);
    } else {
        armor.rknown = true;
        const color = displayColorName(cursed ? 'black' : 'golden', state);
        const protection = cursed ? 'glow' : armorSlotFor(armor.otyp) === 'uarms' ? 'layer' : 'shield';
        await pline(`${ownedObjectAction(armor, 'are', state)} covered by a `
            + `${cursed ? 'mottled' : 'shimmering'} ${color} ${protection}!`);
    }
    if (!cursed && (armor.oeroded || armor.oeroded2)) {
        armor.oeroded = armor.oeroded2 = 0;
        await pline(`${ownedObjectAction(armor, heroIsBlind(state) ? 'feel' : 'look', state)} as good as new!`);
    }
    await replaceProofing(armor, oldProof, !cursed, state);
}

async function hardenDragonScales(armor: GameObject, source: GameObject, state: PlayingGameState): Promise<void> {
    await pline(`${ownedObjectAction(armor, null, state)} merges and hardens!`);
    const wasLit = armor.lamplit;
    const oldLight = objectLightRadius(armor, state);
    armor.otyp += GRAY_DRAGON_SCALE_MAIL - GRAY_DRAGON_SCALES;
    armor.lamplit = false;
    if (source.blessed) {
        setEnchantment(armor, armor.spe + 1);
        if (!armor.blessed) blessObjectState(armor);
    } else if (armor.cursed) uncurseObjectState(armor);
    armor.known = true;
    const name = requireObjectData(OBJECT_NAMES, armor.otyp);
    if (name === null) throw new Error('Hardened dragon scales require a native armor name.');
    if (armor.name !== undefined) armor.name = name;
    if (armor.plural !== undefined) armor.plural = makePlural(name);
    armor.owt = objectWeight(armor);
    await wearHeroArmor(armor, state);
    if (armor.unpaid) updateUnpaidObjectPrice(armor, state);
    if (wasLit === undefined) delete armor.lamplit;
    else armor.lamplit = wasLit;
    await adjustArmorLight(armor, oldLight, state);
}

// C read.c:seffect_destroy_armor().
// C read.c:disintegrate_cursed_armor().
// C do_wear.c:count_worn_armor().
// C do_wear.c:any_worn_armor_ok().
async function destroyArmor(source: GameObject, state: PlayingGameState): Promise<Partial<ScrollEffectResult>> {
    let armor = someHeroArmor(state);
    if (isConfused(state)) {
        if (!armor) return itchyFeeling(source, 'Your bones itch.', state);
        const oldProof = !!armor.oerodeproof;
        armor.oerodeproof = false;
        const color = heroIsBlind(state) ? '' : ` ${displayColorName('purple', state)}`;
        await pline(`${ownedObjectAction(armor, heroIsBlind(state) ? 'vibrate' : 'glow', state)}${color} for a moment.`);
        await replaceProofing(armor, oldProof, !!source.cursed, state);
        return {};
    }
    if (source.cursed) {
        if (armor?.cursed) {
            await pline(`${ownedObjectAction(armor, 'vibrate', state)}.`);
            if (armor.spe >= -6) {
                setEnchantment(armor, armor.spe - 1);
                adjustArmorAttributeBonus(armor, -1, state);
            }
            await makeStunned((state.u.stunnedTurns ?? 0) + rn1(10, 10), { state });
            return {};
        }
        return { known: armor ? await disintegrateWornArmor(armor, { state }) : false };
    }

    const worn = wornArmorInDestroyOrder(state);
    if (armor && source.blessed && worn.length > 1) {
        if (!state._knownObjectTypes?.has(source.otyp))
            await pline('This is a scroll of destroy armor!');
        const selected = await chooseInventoryObject('destroy', object =>
            worn.includes(object) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
        if (selected && worn.includes(selected)) armor = selected;
        await disintegrateWornArmor(armor, { state });
        return { known: true };
    }
    if (source.blessed) {
        const cursed = worn.filter(object => object.cursed);
        if (cursed.length) {
            const target = cursed[rn2(cursed.length)];
            if (!target) throw new RangeError('Destroy armor selected no cursed worn armor.');
            if (await disintegrateWornArmor(target, { state })) return { known: true };
        }
    }
    if (await erodeWornArmor(state)) return { known: true };
    return itchyFeeling(source, 'Your skin itches.', state);
}

async function itchyFeeling(source: GameObject, message: string, state: PlayingGameState): Promise<ScrollEffectResult> {
    const result = await strangeFeeling(source, message, { state });
    await exerciseAttribute(A_STR, false, state);
    await exerciseAttribute(A_CON, false, state);
    return result;
}

async function replaceProofing(armor: GameObject, oldProof: boolean, newProof: boolean, state: GameState): Promise<void> {
    if (oldProof && !newProof) {
        armor.oerodeproof = true;
        await chargeAlteredUnpaidObject(armor, 'degrade', state);
    }
    armor.oerodeproof = newProof;
}

async function adjustArmorLight(armor: GameObject, oldRadius: number, state: GameState): Promise<void> {
    if (!oldRadius) return;
    const delta = objectLightRadius(armor, state) - oldRadius;
    if (!delta) return;
    state.vision_full_recalc = 1;
    if (!heroIsBlind(state)) {
        await pline(`${ownedObjectAction(armor, 'shine', state)} `
            + `${Math.abs(delta) > 1 ? 'much ' : ''}${delta > 0 ? 'brighter' : 'less brightly'}.`);
    }
}

function armorGlow(armor: GameObject, cursed: boolean, sameColor: boolean, violent: boolean, state: GameState): string {
    const verb = heroIsBlind(state) ? 'vibrate' : 'glow';
    const color = heroIsBlind(state) || sameColor
        ? '' : ` ${displayColorName(cursed ? 'black' : 'silver', state)}`;
    return `${ownedObjectAction(armor, `${violent ? 'violently ' : ''}${verb}`, state)}${color}`;
}

function armorVerb(armor: GameObject, verb: string): string {
    return armor.quan > 1 ? verb : `${verb}s`;
}

function isSpecialArmor(armor: GameObject, state: GameState): boolean {
    return [ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_CLOAK,
        ELVEN_SHIELD, ELVEN_BOOTS].includes(armor.otyp)
        || armor.otyp === CORNUTHAUM && state.urole?.key === 'wizard';
}

function isConfused(state: GameState): boolean {
    return !!state.u?.confused || (state.u?.confusionTurns ?? 0) > 0;
}

function setEnchantment(armor: GameObject, amount: number): void {
    armor.spe = Math.max(-SPE_LIM, Math.min(SPE_LIM, amount));
    armor.enchantment = armor.spe;
}

// C read.c:seffect_confuse_monster().
async function confuseMonsterEffect(source: GameObject, state: PlayingGameState): Promise<void> {
    const hero = state.u;
    const confused = (hero.confusionTurns ?? 0) > 0;
    const hiddenHands = heroIsBlind(state) || (heroIsInvisible(state)
        && !(hero.seeInvisible || (hero.seeInvisibleTurns ?? 0) > 0));
    const hands = makePlural(heroHandName(state));
    if (MONSTER_SYMBOL[heroSpecies(state)] !== S_HUMAN || source.cursed) {
        if (!hero.confusionTurns) await plineWithContinuation(formatFeltMessage('confused.', state));
        await makeConfused((hero.confusionTurns ?? 0) + rnd(100), { state, talk: false });
        return;
    }
    if (confused) {
        if (!source.blessed) {
            const feeling = hiddenHands ? 'tingle' : `glow ${displayColorName('purple', state)}`;
            await plineWithContinuation(`Your ${hands} begin to ${feeling}.`);
            await makeConfused((hero.confusionTurns ?? 0) + rnd(100), { state, talk: false });
        } else {
            const aura = hiddenHands ? 'faint buzz' : `${displayColorName('red', state)} glow`;
            await plineWithContinuation(`A ${aura} surrounds your ${heroHeadName(state)}.`);
            await makeConfused(0, { state });
        }
        return;
    }
    let increase = source.oclass === SCROLL_CLASS ? 3 : 0;
    if (!source.blessed) {
        if (hiddenHands) {
            await plineWithContinuation(`Your ${hands} tingle${hero.umconf ? ' even more' : ''}.`);
        } else if (!hero.umconf) {
            await plineWithContinuation(`Your ${hands} begin to glow ${displayColorName('red', state)}.`);
        } else {
            await plineWithContinuation(`The ${displayColorName('red', state)} glow of your ${hands} intensifies.`);
        }
        increase += rnd(2);
    } else {
        if (hiddenHands) {
            await plineWithContinuation(`Your ${hands} tingle ${hero.umconf ? 'even more' : 'very'} sharply.`);
        } else {
            await plineWithContinuation(`Your ${hands} glow ${hero.umconf ? 'an even more' : 'a'} brilliant ${displayColorName('red', state)}.`);
        }
        increase += rn1(8, 2);
    }
    hero.umconf = (hero.umconf ?? 0) + ((hero.umconf ?? 0) >= 40 ? 1 : increase);
}

// C read.c:seffect_scare_monster().
async function causeFearEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectChange | undefined> {
    const reverse = source.cursed || (state.u.confusionTurns ?? 0) > 0;
    let nonPets = 0;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !cansee(monster.mx, monster.my)) continue;
        if (reverse) {
            monster.mflee = monster.mfrozen = monster.msleeping = 0;
            monster.mcanmove = 1;
        } else if (!monsterResistsEffect(monster, source.oclass === SCROLL_CLASS ? 9 : state.u.ulevel)) {
            const result = await makeMonsterFlee(monster, { state, announce: false });
            if (result.heroDied) return { heroDied: true };
        }
        if (!monster.mtame) nonPets++;
    }
    if (source.otyp === SCR_SCARE_MONSTER || !nonPets) {
        const message = formatHeardMessage(`${reverse ? 'sad wailing' : 'maniacal laughter'} ${nonPets ? 'close by' : 'in the distance'}.`, state);
        if (message) await plineWithContinuation(message);
    }
    return;
}

function removeCurseWornMask(object: GameObject, state: PlayingGameState): number {
    let mask = (object.owornmask ?? 0) & ~(W_BALL | W_ART | W_ARTI);
    const swapWeapon = state.uswapwep || state.u?.uswapwep;
    const quiver = state.uquiver || state.u?.uquiver;
    if (object === swapWeapon && !(state.u?.twoweap)) {
        mask = 0;
    } else if (object === quiver) {
        if (object.oclass === WEAPON_CLASS) {
            if (!OBJECT_MERGE[object.otyp]) mask = 0;
        } else if (object.oclass === GEM_CLASS) {
            if ((state.uwep || state.u?.uwep)?.otyp !== SLING) mask = 0;
        } else {
            mask = 0;
        }
    }
    return mask;
}

function removeCurseAppliesTo(object: GameObject, blessed: boolean, state: PlayingGameState): boolean {
    return blessed || !!removeCurseWornMask(object, state)
        || object.otyp === LOADSTONE
        || (object.otyp === LEASH && !!object.leashmon);
}

async function randomlyBlessOrCurse(object: GameObject, state: PlayingGameState): Promise<boolean> {
    if (object.blessed || object.cursed || rn2(2)) return false;
    if (rn2(2)) return blessObjectState(object);
    const changed = await curseObject(object, { state });
    await dropCursedSecondaryWeapon(object, state);
    return changed;
}

export function removeCurseFeeling(confused: boolean): string {
    const hallucinating = heroIsHallucinating(game);
    if (hallucinating) {
        return confused
            ? 'the power of the Force against you!'
            : 'in touch with the Universal Oneness.';
    }
    return confused ? 'like you need some help.'
        : 'like someone is helping you.';
}

// C read.c:seffect_remove_curse().  The caller owns scroll consumption and
// its reading message; this function owns the effect on carried equipment.
export async function removeCurseEffect({
    source = null,
    state = game,
    blessed = !!source?.blessed,
    cursed = !!source?.cursed,
    confused = (state.u.confusionTurns ?? 0) > 0,
    publish = syncPline,
    announce = true,
}: RemoveCurseOptions = {}): Promise<GameObject[]> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (announce) await publish(formatFeltMessage(removeCurseFeeling(confused), state));
    if (cursed && announce) await publish('The scroll disintegrates.');

    const changed: GameObject[] = [];
    for (const object of cursed ? [] : [...(state.inventory || [])]) {
        const quantity = object.quan ?? object.quantity ?? 1;
        if (object.oclass === COIN_CLASS
            || (object === source && quantity === 1)
            || !removeCurseAppliesTo(object, blessed, state)) continue;
        if (confused) {
            if (await randomlyBlessOrCurse(object, state)) changed.push(object);
            if (state.program_state.gameover) return changed;
            object.bknown = false;
            if (object.unpaid && object.otyp === POT_WATER
                && (object.blessed || object.cursed)) updateUnpaidObjectPrice(object, state);
        } else if (object.cursed) {
            if (object.unpaid && object.otyp === POT_WATER)
                await chargeAlteredUnpaidObject(object, 'uncurse', state);
            uncurseObjectState(object);
            if (object.bknown && source?.otyp === SCR_REMOVE_CURSE
                && !state._knownObjectTypes?.has(SCR_REMOVE_CURSE)) {
                learnScrollType(SCR_REMOVE_CURSE, { state });
            }
            changed.push(object);
        }
    }

    const saddle = cursed ? null : monsterSaddle(state.u.usteed);
    if (saddle && confused) {
        if (await randomlyBlessOrCurse(saddle, state)) changed.push(saddle);
        saddle.bknown = false;
    } else if (saddle?.cursed) {
        uncurseObjectState(saddle);
        changed.push(saddle);
        if (!heroIsBlind(state)) {
            await publish(`${ownedObjectAction(saddle, 'glow', state)} ${displayColorName('amber', state)}.`);
            saddle.bknown = !(
                heroIsHallucinating(state)
            );
        } else {
            saddle.bknown = false;
        }
    }

    if (heroIsPunished(state) && !confused) await unpunishHero(state);
    if (state.u.utrap && state.u.utraptype === TT_BURIEDBALL) {
        await freeHeroFromBuriedBall(state);
        await publish(`The clasp on your ${heroLegName(state)} vanishes.`);
    }
    return changed;
}

// C sit.c:316 calls seffects() with a zeroobj spell source on the stack. It
// has no inventory identity or creation effects, but still passes through
// seffects' Wisdom gain. throne.c's confused blessed remove curse and
// trap.c's magic trap use the same entry.
export async function applyRemoveCurseSpell({
    state = game, blessed = false, cursed = false,
}: Pick<RemoveCurseOptions, 'state' | 'blessed' | 'cursed'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    await exerciseScrollWisdom(SPE_REMOVE_CURSE, state);
    await removeCurseEffect({
        source: { otyp: SPE_REMOVE_CURSE, blessed, cursed },
        state,
        publish: plineWithContinuation,
    });
    return { known: false, consumed: false, heroDied: !!state.program_state.gameover };
}

async function maybeTame(monster: Monster, source: GameObject, state: PlayingGameState): Promise<number> {
    const wasTame = monster.mtame ?? 0;
    const wasPeaceful = !!monster.mpeaceful;
    if (source.cursed) {
        await angerMonster(monster);
        return wasPeaceful && !monster.mpeaceful ? -1 : 0;
    }
    if (!monsterResistsEffect(monster, source.oclass === SCROLL_CLASS ? 9 : state.u.ulevel) || monster.isshk)
        await tameMonster(monster, source, { state });
    return (!wasPeaceful && monster.mpeaceful) || wasTame !== (monster.mtame ?? 0) ? 1 : 0;
}

// C read.c:seffect_taming().
async function charmMonsterEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectChange | undefined> {
    let candidates = 0, results = 0, visibleResults = 0;
    if (state.u.uswallow) {
        const swallower = state.u.ustuck;
        if (!swallower) throw new Error('A swallowed hero needs its swallowing monster.');
        candidates = 1;
        results = visibleResults = await maybeTame(swallower, source, state);
        if (state.program_state.gameover) return { heroDied: true };
    } else {
        const radius = (state.u.confusionTurns ?? 0) > 0 ? 5 : 1;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const x = state.u.ux + dx, y = state.u.uy + dy;
                if (!isok(x, y)) continue;
                const monster = monsterAtPosition(state.level, x, y)
                    || (!dx && !dy ? state.u.usteed : null);
                if (!monster) continue;
                candidates++;
                const changed = await maybeTame(monster, source, state);
                if (state.program_state.gameover) return { heroDied: true };
                results += changed;
                if (canSpotMonster(monster)) visibleResults += changed;
            }
        }
    }
    await plineWithContinuation(!results
        ? `Nothing interesting ${candidates ? 'seems to happen' : 'happens'}.`
        : `The neighborhood ${visibleResults ? 'is' : 'seems'} ${results < 0 ? 'un' : ''}friendlier.`);
    return { known: visibleResults > 0 };
}

const PM_YELLOW_LIGHT = 118;
const PM_BLACK_LIGHT = 119;

// C read.c:seffect_light(). The light owner (litroom, light sources)
// stays in light.ts; this half owns the scroll effect itself.
export async function applyLightScrollEffect(
    scroll: GameObject,
    { finishMonsterKill }: Pick<RoomLightOptions, 'finishMonsterKill'> = {},
) {
    let known = false;
    if ((game.u.confusionTurns ?? 0) > 0) {
        known = await createConfusedLightPets(scroll);
    } else {
        known = !heroIsBlind();
        const lit = !scroll.cursed;
        await lightRoom(lit, {
            radius: scroll.blessed ? 9 : 5,
            source: scroll,
            finishMonsterKill: finishMonsterKill || finishHeroMonsterKillOutcome,
        });
        if (game.program_state.gameover) return { known, consumed: false, heroDied: true };
        if (lit && await lightDamage(scroll, true, 5)) known = true;
    }
    return { known, consumed: false, heroDied: !!game.program_state.gameover };
}

async function createConfusedLightPets(scroll: GameObject): Promise<boolean> {
    const mnum = scroll.cursed ? PM_BLACK_LIGHT : PM_YELLOW_LIGHT;
    if ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE) {
        await plineWithContinuation(
            'Tiny lights sparkle in the air momentarily.',
        );
        return false;
    }

    const count = rn2(2) + 3 + (scroll.blessed ? 2 : 0);
    let sawLight = false;
    for (let index = 0; index < count; index++) {
        const monster = await makemonNear(
            mnum, game.u.ux, game.u.uy,
            NO_MINVENT | MM_EDOG | MM_NOMSG,
        );
        if (!monster) continue;
        initializePet(monster);
        monster.msleeping = 0;
        monster.mcan = 1;
        if (canSpotMonster(monster)) sawLight = true;
        await newsym(monster.mx, monster.my);
    }
    if (sawLight)
        await plineWithContinuation('Lights appear all around you!');
    return sawLight;
}

// C read.c:seffect_charging().
async function chargingEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectChange | undefined> {
    const blessing = source.cursed ? -1 : source.blessed ? 1 : 0;
    if ((state.u.confusionTurns ?? 0) > 0) {
        await plineWithContinuation(formatFeltMessage(source.cursed ? 'discharged.' : 'charged up!', state));
        if (source.cursed) state.u.uen = 0;
        else {
            state.u.uen += d(source.blessed ? 6 : 4, 4);
            state.u.uen = state.u.uenmax = Math.max(state.u.uen, state.u.uenmax);
        }
        state.context.botl = true;
        return;
    }
    const known = source.oclass === SPBOOK_CLASS || OBJECT_INITIAL_KNOWN[source.otyp]
        || state._knownObjectTypes?.has(source.otyp);
    if (!known) {
        await plineWithContinuation('This is a charging scroll.');
        learnScroll(source, { state });
    }
    await consumeInventoryItem(source, state);
    const object = await chooseObjectToCharge(state);
    const charged = object ? await rechargeObject(object, blessing, state) : null;
    return { consumed: true, heroDied: !!charged?.heroDied };
}

async function mailEffect(source: GameObject, state: PlayingGameState): Promise<void> {
    const odd = (source.o_id ?? 0) % 2 === 1;
    if (source.spe === 2)
        await plineWithContinuation(`This scroll is marked "${odd ? 'Postage Due' : 'Return to Sender'}".`);
    else if (source.spe === 1)
        await plineWithContinuation(`This seems to be ${odd
            ? 'a chain letter threatening your luck' : 'junk mail addressed to the finder of the Eye of Larn'}.`);
    else if (!state.iflags?.debug_fuzzer)
        await plineWithContinuation('This game cannot open the system mail reader.');
}

// C read.c:seffect_fire(), seffect_earth(), seffect_stinking_cloud(),
// seffect_amnesia(), and can_center_cloud().

interface AreaEffectOptions {
    state: PlayingGameState;
    finishHeroDeath: DeathHandler;
    finishMonsterKill: ScrollMonsterKill;
}

export async function applyAreaScrollEffect(source: GameObject, {
    state = game, finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome,
}: ScrollEffectOptions = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const options = { state, finishHeroDeath, finishMonsterKill };
    switch (source.otyp) {
    case SCR_FIRE: return fireEffect(source, options);
    case SCR_EARTH: return earthEffect(source, options);
    case SCR_STINKING_CLOUD: return cloudEffect(source, state);
    case SCR_AMNESIA: return amnesiaEffect(source, state);
    default: throw new Error(`Unsupported area scroll ${source.otyp}`);
    }
}

// C read.c:seffect_amnesia().
// C read.c:forget().
async function amnesiaEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectResult> {
    if (heroIsPunished(state)) state.u.bc_felt = 0;
    if (!source.blessed) loseHeroSpellMemory({ state });
    await drainHeroWeaponSkills(rnd(source.blessed ? 3 : 5), state);
    for (const monster of state.level.monsters) {
        if (monster !== state.u.usteed && monster !== state.u.ustuck) monster.meverseen = 0;
    }
    for (const monster of state._migratingMonsters || []) monster.meverseen = 0;
    if (heroIsHallucinating(state)) await pline('Your mind releases itself from mundane concerns.');
    else if (/^maud/i.test(state.plname || ''))
        await pline('As your mind turns inward on itself, you forget everything else.');
    else await pline(rn2(2) ? 'Who was that Maud person anyway?'
        : 'Thinking of Maud you forget everything else.');
    exerciseWisdom(false, state);
    return { known: true, consumed: false, heroDied: false };
}

// C read.c:seffect_fire().
async function fireEffect(
    source: GameObject, { state, finishHeroDeath }: AreaEffectOptions,
): Promise<ScrollEffectResult> {
    const blessed = !!source.blessed;
    const confused = (state.u.confusionTurns ?? 0) > 0;
    const alreadyKnown = sourceTypeKnown(source, state);
    let damage = Math.trunc((2 * (rn1(3, 3) + 2 * blessing(source)) + 1) / 3);
    await consumeInventoryItem(source, state);
    if (!alreadyKnown) learnScrollType(SCR_FIRE, { state });
    const result = { known: false, consumed: true, heroDied: false };
    const underwater = state.underwater || state.u.uinwater;
    if (confused) {
        if (underwater) {
            await pline(`A little ${displayLiquidName('water', state)} around you vaporizes.`);
        } else if (propertyIsActive('fireResistance', state)) {
            await shieldeff(state.u.ux, state.u.uy, state);
            monstersObserveHeroResistance(M_SEEN_FIRE, state);
            await pline(heroIsBlind(state)
                ? formatFeltMessage(`a pleasant warmth in your ${makePlural(heroHandName(state))}.`, state)
                : `Oh, look, what a pretty fire in your ${makePlural(heroHandName(state))}.`);
        } else {
            monstersForgetHeroResistance(M_SEEN_FIRE, state);
            await pline(`The scroll catches fire and you burn your ${makePlural(heroHandName(state))}.`);
            result.heroDied = !!await loseHeroHp(1, 'scroll of fire', { state, die: finishHeroDeath });
        }
        return result;
    }
    let center = { x: state.u.ux, y: state.u.uy };
    if (underwater) {
        await pline(`The ${displayLiquidName('water', state)} around you vaporizes violently!`);
    } else {
        if (blessed) {
            if (!alreadyKnown) await pline('This is a scroll of fire!');
            damage *= 5;
            const selected = await chooseCenter('Where do you want to center the explosion?', state);
            if (selected && canCenterCloud(selected.x, selected.y, state)) center = selected;
        }
        if (center.x === state.u.ux && center.y === state.u.uy) {
            await pline('The scroll erupts in a tower of flame!');
            state._lastPlineKind = PLNMSG_TOWER_OF_FLAME;
            await burnAwayHeroSlime({ state });
        }
    }
    const explosion = await explode(center.x, center.y, 11, damage, 9, EXPL_FIERY, {
        state, die: finishHeroDeath,
    });
    result.heroDied = explosion.heroDied;
    return result;
}

// C read.c:seffect_earth().
async function earthEffect(source: GameObject, options: AreaEffectOptions): Promise<ScrollEffectResult> {
    const { state } = options;
    const result = { known: false, consumed: false, heroDied: false };
    if (Is_rogue_level(state.u.uz) || !levelHasCeiling(state)
        || In_endgame(state.u.uz) && !Is_earthlevel(state.u.uz)) return result;
    if (state.u.uswallow) {
        const heard = formatHeardMessage('rumbling.', state);
        if (heard) await pline(heard);
    } else if (In_quest(state.u.uz)) {
        await pline(source.blessed ? 'Avalanches of boulders materialize around you!'
            : 'An avalanche of boulders materializes above you!');
    } else {
        await pline(`The ${ceilingName(state.u.ux, state.u.uy, state)} rumbles ${source.blessed ? 'around' : 'above'} you!`);
    }
    result.known = true;
    sokobanGuilt(state);
    const dropOptions = { ...options, confused: (state.u.confusionTurns ?? 0) > 0 };
    let count = 0;
    if (!source.cursed) {
        for (let x = state.u.ux - 1; x <= state.u.ux + 1; x++) {
            for (let y = state.u.uy - 1; y <= state.u.uy + 1; y++) {
                if (!isok(x, y) || x === state.u.ux && y === state.u.uy) continue;
                const location = state.level.at(x, y);
                if (!location) continue;
                if (IS_OBSTRUCTED(location.typ) || IS_AIR(location.typ)
                    || location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))) continue;
                const dropped = await dropBoulderOnMonster(x, y, dropOptions);
                count += Number(dropped.dropped);
                if (dropped.heroDied) return { ...result, heroDied: true };
            }
        }
    }
    if (!source.blessed) {
        const dropped = await dropBoulderOnHero({ ...dropOptions, helmetProtects: !source.cursed });
        result.heroDied = dropped.heroDied;
    } else if (!count) await pline('But nothing else happens.');
    return result;
}

// C read.c:seffect_stinking_cloud().
// C read.c:do_stinking_cloud().
async function cloudEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectResult> {
    const alreadyKnown = sourceTypeKnown(source, state);
    if (!alreadyKnown) await pline('You have found a scroll of stinking cloud!');
    const center = await chooseCenter(`Where do you want to center the ${alreadyKnown ? 'stinking ' : ''}cloud?`, state);
    if (!center) await pline('Never mind.');
    else if (!canCenterCloud(center.x, center.y, state)) {
        await pline(heroIsHallucinating(state) ? 'Ugh... someone cut the cheese.'
            : `${source.oclass === 9 ? 'The scroll crumbles with' : 'You smell'} a whiff of rotten eggs.`);
    } else {
        await createPoisonGasCloud(state, center.x, center.y,
            15 + 10 * blessing(source), 8 + 4 * blessing(source));
    }
    return { known: true, consumed: false, heroDied: false };
}

function blessing(source: Pick<GameObject, 'blessed' | 'cursed'>): -1 | 0 | 1 {
    return source.blessed ? 1 : source.cursed ? -1 : 0;
}

function sourceTypeKnown(source: GameObject, state: GameState): boolean {
    return source.oclass === 10 || !!OBJECT_INITIAL_KNOWN[source.otyp]
        || !!state._knownObjectTypes?.has(source.otyp);
}


// C read.c:valid_cloud_pos(). Can a stinking cloud physically exist at a
// position? NOT the same thing as canCenterCloud; region.c's cloud growth
// (regions.ts) shares the test through this export.
export function validCloudPosition(state: GameState, x: number, y: number): boolean {
    if (!isok(x, y)) return false;
    const typ = state.level?.at(x, y)?.typ;
    return (typ !== undefined && ACCESSIBLE(typ))
        || isPoolAt(x, y, state) || isLavaAt(x, y, state);
}

function canCenterCloud(x: number, y: number, state: PlayingGameState): boolean {
    if (!isok(x, y)) return false;
    const location = state.level.at(x, y);
    if (!location) return false;
    return (ACCESSIBLE(location.typ)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state))
        && cansee(x, y) && (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2 < 32;
}

async function chooseCenter(question: string, state: PlayingGameState): Promise<Position | null> {
    await pline(question);
    const valid = (x: number, y: number) => canCenterCloud(x, y, state);
    await prepareMapPositionHighlights(valid);
    const firstUse = await showGetposTip(state);
    await showGetposInstructions(state);
    if (firstUse) await pline('Move cursor to the desired position:');
    const selected = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: state._pending_message,
        goal: 'the desired position',
        isValidLocation: valid,
        highlightHero: false,
    });
    // C getpos() clears the message window itself at exit, and only when a
    // non-autodescribe message is pending (getpos.c:exitgetpos); a pick made
    // with autodescribe on leaves the last description visible, and
    // do_stinking_cloud() prints nothing after a valid center.
    return selected;
}

// C read.c:seffect_teleportation(). The read transaction owns useup().
export async function teleportScrollEffect(source: GameObject, {
    state = game, gotoLevel,
}: Pick<ScrollEffectOptions, 'state' | 'gotoLevel'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let known = false;
    if (source.cursed || state.u.confused || (state.u.confusionTurns ?? 0) > 0) {
        await levelTeleport({ state, ...(gotoLevel ? { gotoLevel } : {}) });
        known = true;
    } else {
        await teleportHero({
            source, chooseDestination: askTeleportDestination,
            discover: async () => {
                await learnScroll(source, { state });
            },
        });
    }
    return { known, consumed: false, heroDied: !!state.program_state.gameover };
}

// C read.c:seffect_food_detection().
// C read.c:seffect_gold_detection().
async function detectionEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectChange | undefined> {
    const detect = source.otyp === SCR_GOLD_DETECTION
        ? (source.cursed || (state.u.confusionTurns ?? 0) > 0 ? detectTraps : detectGold)
        : detectFood;
    const result = await detect(source, { state });
    if (result.strangeFeeling) await finishStrangeFeeling(source, { state });
    return { known: !!result.known, consumed: !!result.result };
}

// Native seffect_identify(), including the scroll-only consumption and
// discovery boundary before selecting the remaining inventory.
export async function identifyEffect(source: GameObject, {
    state = game,
}: Pick<ScrollEffectOptions, 'state'> = {}): Promise<GameObject[]> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const isScroll = source.oclass === SCROLL_CLASS;
    const alreadyKnown = !isScroll || state._knownObjectTypes?.has(source.otyp);
    if (isScroll) {
        const selfOnly = (state.u.confusionTurns ?? 0) > 0 || (source.cursed && !alreadyKnown);
        await consumeInventoryItem(source);
        if (selfOnly) await plineWithContinuation('You identify this as an identify scroll.');
        else if (!alreadyKnown) await plineWithContinuation('This is an identify scroll.');
        if (!alreadyKnown) learnScrollType(SCR_IDENTIFY, { state });
        if (selfOnly) return [];
    }
    if (!state.inventory.length) {
        await plineWithContinuation(`You're not carrying anything${isScroll ? ' else' : ''} to be identified.`);
        return [];
    }
    let limit = 1;
    if (source.blessed || (!source.cursed && !rn2(5))) {
        limit = rn2(5);
        if (limit === 1 && source.blessed
            && Luck(state.u) > 0) limit++;
    }
    return identifyPack(limit, !alreadyKnown);
}

// C read.c:seffect_magic_mapping().
async function magicMappingEffect(source: GameObject, state: PlayingGameState): Promise<ScrollEffectChange | undefined> {
    const isScroll = source.oclass === SCROLL_CLASS;
    if (state.level.flags.nommap) {
        if (isScroll) {
            await plineWithContinuation('Your mind is filled with crazy lines!');
            await plineWithContinuation(heroIsHallucinating(state)
                ? 'Wow!  Modern art.' : `Your ${heroHeadName(state)} spins in bewilderment.`);
        } else {
            await plineWithContinuation(`Your ${heroHeadName(state)} spins as something blocks the spell!`);
        }
        await makeConfused((state.u.confusionTurns ?? 0) + rnd(30), { state, talk: false });
        return;
    }
    if (isScroll && source.blessed) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                if (state.level.requireAt(x, y).typ === SDOOR) revealSecretDoor(x, y);
            }
        }
    }
    await plineWithContinuation('A map coalesces in your mind!');
    const temporarilyConfused = source.cursed && !((state.u.confusionTurns ?? 0) > 0);
    if (temporarilyConfused) state.u.confusionTurns = 1;
    // C seffect_magic_mapping() suppresses notices through do_mapping(),
    // including its temporary map's redraw, without a catch-up afterward.
    await withMonsterNoticesBlocked(state, () => mapMagicLevel({ state }));
    if (temporarilyConfused) {
        state.u.confusionTurns = 0;
        await plineWithContinuation("Unfortunately, you can't grasp the details.");
    }
    return { known: isScroll };
}

// C read.c:seffects(). Scrolls and scroll-like spells use the same effects;
// the caller owns normal discovery, source disposal, and the action turn.
export async function applyScrollEffects(source: GameObject, {
    state = game, gotoLevel, finishHeroDeath, finishMonsterKill,
}: ScrollEffectOptions = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hooks = { gotoLevel, finishHeroDeath, finishMonsterKill };
    await exerciseScrollWisdom(source.otyp, state);
    const result = await scrollEffect(source, state, hooks);
    return {
        known: !!result?.known,
        consumed: !!result?.consumed,
        heroDied: !!result?.heroDied || !!state.program_state.gameover,
    };
}

async function exerciseScrollWisdom(otyp: number, state: PlayingGameState): Promise<void> {
    if (OBJECT_MAGIC[otyp]) await exerciseAttribute(A_WIS, true, state);
}

// C read.c:seffect_blank_paper().
// C read.c:seffect_create_monster().
// C read.c:seffect_genocide().
// C read.c:seffect_punishment().
async function scrollEffect(
    source: GameObject, state: PlayingGameState, hooks: ScrollEffectHooks,
): Promise<ScrollEffectChange | undefined> {
    switch (source.otyp) {
    case SCR_ENCHANT_ARMOR:
    case SCR_DESTROY_ARMOR:
    case SCR_ENCHANT_WEAPON:
        return applyArmorScrollEffect(source, { state });
    case SCR_AMNESIA:
    case SCR_FIRE:
    case SCR_EARTH:
    case SCR_STINKING_CLOUD:
        return applyAreaScrollEffect(source, {
            state,
            finishHeroDeath: hooks.finishHeroDeath,
            finishMonsterKill: hooks.finishMonsterKill,
        });
    case SCR_REMOVE_CURSE:
    case SPE_REMOVE_CURSE:
        await removeCurseEffect({ source, state, publish: plineWithContinuation });
        return;
    case SCR_CONFUSE_MONSTER:
    case SPE_CONFUSE_MONSTER:
        await confuseMonsterEffect(source, state);
        return;
    case SCR_GOLD_DETECTION:
    case SCR_FOOD_DETECTION:
    case SPE_DETECT_FOOD:
        return detectionEffect(source, state);
    case SCR_SCARE_MONSTER:
    case SPE_CAUSE_FEAR:
        return causeFearEffect(source, state);
    case SCR_IDENTIFY:
    case SPE_IDENTIFY:
        await identifyEffect(source, { state });
        return { consumed: source.oclass === SCROLL_CLASS };
    case SCR_TAMING:
    case SPE_CHARM_MONSTER:
        return charmMonsterEffect(source, state);
    case SCR_MAGIC_MAPPING:
    case SPE_MAGIC_MAPPING:
        return magicMappingEffect(source, state);
    case SCR_CREATE_MONSTER:
    case SPE_CREATE_MONSTER: {
        const confused = (state.u.confusionTurns ?? 0) > 0;
        const count = 1 + (confused || source.cursed ? 12 : 0)
            + (source.blessed || rn2(73) ? 0 : rnd(4));
        const known = await createCritters(count,
            confused ? MONSTER_NAME.indexOf('acid blob') : null);
        return { known };
    }
    case SCR_LIGHT:
        return applyLightScrollEffect(source, hooks.finishMonsterKill
            ? { finishMonsterKill: hooks.finishMonsterKill } : {});
    case SCR_GENOCIDE:
        if (source.oclass !== SPBOOK_CLASS && !OBJECT_INITIAL_KNOWN[source.otyp]
            && !state._knownObjectTypes?.has(source.otyp))
            await plineWithContinuation('You have found a scroll of genocide!');
        if (source.blessed) await doClassGenocide(hooks.finishHeroDeath
            ? { finishHeroDeath: hooks.finishHeroDeath } : {});
        else await doGenocide(Number(!source.cursed)
            | (2 * Number((state.u.confusionTurns ?? 0) > 0)), hooks.finishHeroDeath
            ? { finishHeroDeath: hooks.finishHeroDeath } : {});
        return { known: true };
    case SCR_CHARGING:
        return chargingEffect(source, state);
    case SCR_TELEPORTATION:
        return teleportScrollEffect(source, { state, gotoLevel: hooks.gotoLevel });
    case SCR_PUNISHMENT:
        if (source.blessed || (state.u.confusionTurns ?? 0) > 0)
            await plineWithContinuation(formatFeltMessage('guilty.', state));
        else await punishHero(source);
        return { known: true };
    case SCR_BLANK_PAPER:
        await plineWithContinuation(heroIsBlind(state)
            ? "You don't remember there being any magic words on this scroll."
            : 'This scroll seems to be blank.');
        return { known: true };
    case SCR_MAIL:
        await mailEffect(source, state);
        return { known: true };
    default:
        await impossible(`What weird effect is this? (${source.otyp})`);
        return;
    }
}


// ---------------------------------------------------------------------------
// Falling boulders. C refs: read.c drop_boulder_on_player(),
// drop_boulder_on_monster().
// ---------------------------------------------------------------------------

interface FallingBoulderOptions extends Pick<ScrollEffectOptions,
    'state' | 'finishHeroDeath' | 'finishMonsterKill'> {
    confused?: boolean;
    heroCaused?: boolean;
}

interface HeroBoulderOptions extends FallingBoulderOptions {
    helmetProtects?: boolean;
    skipSwallower?: boolean;
}

export interface FallingBoulderResult {
    dropped: true;
    heroDied: boolean;
}

const M1_WALLWALK = 0x00000008;

// C read.c:drop_boulder_on_player().
export async function dropBoulderOnHero({
    state = game, confused = false, helmetProtects = true,
    heroCaused = true, skipSwallower = false,
    finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome,
}: HeroBoulderOptions = {}): Promise<FallingBoulderResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.uswallow && !skipSwallower)
        return dropBoulderOnMonster(state.u.ux, state.u.uy, {
            state, confused, heroCaused, finishHeroDeath, finishMonsterKill,
        });
    const object = await fallingRock(confused);
    let damage = 0;
    if (canBeHit({ mnum: heroSpecies(state) }) && !state.u.passesWalls) {
        await plineWithContinuation(`You are hit by ${await fallingRockName(object, state)}!`);
        damage = rollPhysicalWeaponDamageAgainstHero(object, state) * object.quan;
        const helmet = state.uarmh || state.u.uarmh;
        if (helmet && helmetProtects) {
            if (objectIsHardHelmet(helmet)) {
                await plineWithContinuation('Fortunately, you are wearing a hard helmet.');
                damage = Math.min(damage, 2);
            } else if (state.flags.verbose !== false) {
                await plineWithContinuation(`${ownedObjectName(helmet, state)} does not protect you.`);
            }
        }
    }
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, 16, state);
    await landFallingRock(object, state.u.ux, state.u.uy, state);
    if (state.u.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
    const heroDied = damage ? await loseHeroHp(damage, 'scroll of earth', {
        state, die: finishHeroDeath,
    }) : false;
    return { dropped: true, heroDied: !!heroDied };
}

// C read.c:drop_boulder_on_monster().
export async function dropBoulderOnMonster(x: number, y: number, {
    state = game, confused = false, heroCaused = true,
    finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome,
}: FallingBoulderOptions = {}): Promise<FallingBoulderResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const object = await fallingRock(confused);
    const monster = monsterAtPosition(state.level, x, y);
    const swallowsHero = monster && state.u.uswallow && state.u.ustuck === monster;
    if (monster && canBeHit(monster)) {
        // C rechecks canspotmon() after each pline(), whose pending vision
        // recalculation can hide the target behind boulders that just fell.
        if (cansee(x, y)) {
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} is hit by ${await fallingRockName(object, state)}!`);
            if (monster.minvis && !canSpotMonster(monster)) await map_invisible(x, y);
        } else if (swallowsHero) {
            await hear(`something hit ${possessiveName(monsterName(monster, { state }))} ${monsterStomachName(monster.mnum)} over your ${heroHeadName(state)}!`, state);
        }
        let damage = rollPhysicalWeaponDamage(object, monster) * object.quan;
        const inventory = monster.minvent ?? monster.inventory;
        const helmet = inventory?.find(item => (item.owornmask ?? 0) & W_ARMH);
        if (helmet) {
            if (objectIsHardHelmet(helmet)) {
                if (canSpotMonster(monster))
                    await plineWithContinuation(`Fortunately, ${monsterName(monster, { state })} is wearing a hard helmet.`);
                else await hear('a clanging sound.', state);
                damage = Math.min(damage, 2);
            } else if (canSpotMonster(monster)) {
                await plineWithContinuation(`${possessiveName(monsterName(monster, { state, capitalized: true }))} ${objectName(helmet, state)} does not protect ${monsterObjectPronoun(monster, { state })}.`);
            }
        }
        monster.mhp -= damage;
        if (monster.mhp <= 0) {
            if (heroCaused) await finishMonsterKill(monster, x, y);
            else {
                await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} is killed.`);
                await finishEnvironmentalMonsterDeath(monster, state);
            }
        } else await wakeMonster(monster, { attacked: heroCaused });
        if (state.program_state.gameover) return { dropped: true, heroDied: true };
        await wakeMonstersNearWithMessages(x, y, 16, state);
    } else if (swallowsHero) {
        await deleteObject(object, state);
        return dropBoulderOnHero({ state, confused, helmetProtects: true,
            heroCaused: false, skipSwallower: true, finishHeroDeath, finishMonsterKill });
    }
    await landFallingRock(object, x, y, state);
    return { dropped: true, heroDied: !!state.program_state.gameover };
}

function canBeHit(monster: Pick<Monster, 'mnum'>): boolean {
    return !monsterIsAmorphous(monster) && !monsterIsNoncorporeal(monster)
        && !monsterIsUnsolid(monster) && !(requireMonsterData(MONSTER_FLAGS1, monster.mnum) & M1_WALLWALK);
}

async function fallingRock(confused: boolean): Promise<GameObject> {
    const object = await mksobj(confused ? ROCK : BOULDER, false, false);
    object.quan = confused ? rn1(5, 2) : 1;
    object.owt = objectWeight(object);
    return object;
}

// C doname() observes the falling object, so later blind feeling still
// calls seen rocks "rocks" rather than "stones".
async function fallingRockName(object: GameObject, state: GameState): Promise<string> {
    observeObjectForNaming(object, { state });
    return await inventoryItemDescription(object);
}

async function landFallingRock(object: GameObject, x: number, y: number, state: PlayingGameState): Promise<void> {
    await landFloorObject(object, x, y, { state, verb: 'fall' });
    await newsym(x, y);
}

async function hear(message: string, state: GameState): Promise<void> {
    const heard = formatHeardMessage(message, state);
    if (heard) await plineWithContinuation(heard);
}

// ---------------------------------------------------------------------------
// Genocide. C refs: read.c do_class_genocide(), do_genocide().
// ---------------------------------------------------------------------------

interface GenocideOptions { finishHeroDeath?: DeathHandler | undefined }

const GENOCIDE_REALLY = 1, GENOCIDE_PLAYER = 2;
export const GENOCIDE_ON_THRONE = 4;
const G_GENO = 0x0020, G_UNIQ = 0x1000;
const M2_DEMON = 0x00000100, M2_PNAME = 0x00080000;
const MS_LEADER = 36, MS_NEMESIS = 37, MS_GUARDIAN = 38;
const S_INVISIBLE = 35;
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_NINJA = MONSTER_NAME.indexOf('ninja');

// C read.c:do_class_genocide().
export async function doClassGenocide({
    finishHeroDeath = finishNativeHeroDeath,
}: GenocideOptions = {}): Promise<boolean> {
    const state = requireInitializedGame();
    const monsterClass = await requestGenocideClass();
    if (monsterClass === null) return false;
    let doomed = false;
    let feltDead = false;
    let loggedClass = false;
    for (let species = 0; species < MONSTER_NAME.length; species++) {
        if (MONSTER_SYMBOL[species] !== monsterClass) continue;
        const name = requireMonsterData(MONSTER_NAME, species);
        const plural = makePlural(name);
        if (heroOwnSpecies(species)
            || ((MONSTER_GENO[species] ?? 0) & G_GENO) && !speciesWasGenocided(species)) {
            if (!loggedClass) {
                const symbol = MONSTER_CLASS_SYMBOLS[monsterClass];
                if (!symbol) throw new RangeError(`Genocide class ${monsterClass} has no symbol`);
                const firstGenocide = !MONSTER_NAME.some((_, index) => speciesWasGenocided(index));
                recordGameLogEvent(firstGenocide
                    ? `performed ${state.flags.female ? 'her' : 'his'} first genocide (class ${symbol})`
                    : `genocided class ${symbol}`, {
                    state,
                    flags: firstGenocide ? LL_CONDUCT | LL_GENOCIDE : LL_GENOCIDE,
                });
                loggedClass = true;
            }
            recordGenocide(species);
            const removal = await killGenocidedMonsters();
            if (removal.heroDied || state.program_state.gameover) return true;
            await plineWithContinuation(`Wiped out all ${plural}.`);
            await revertTargetedVampireForm(species);
            if (state.program_state.gameover) return true;
            if (Upolyd(state.u) && species === state.u.umonnum) {
                state.u.mh = -1;
                if (heroIsUnchanging(state)) {
                    if (!feltDead) await plineWithContinuation('You die.', { urgent: true });
                    feltDead = true;
                    doomed = true;
                } else {
                    const outcome = await returnHeroToHumanForm(state, { die: finishHeroDeath });
                    if (outcome.died || state.program_state.gameover) return true;
                }
            }
            if (heroOwnSpecies(species)) {
                state.u.uhp = -1;
                if (Upolyd(state.u)) {
                    if (!feltDead)
                        await plineWithContinuation(formatFeltMessage(`${feelingAfterSelfGenocide(state)} inside.`, state));
                } else {
                    if (!feltDead) await plineWithContinuation('You die.', { urgent: true });
                    doomed = true;
                }
                feltDead = true;
            }
        } else if (!doomed && speciesWasGenocided(species)) {
            await plineWithContinuation(`${upstart(plural)} are already nonexistent.`);
        } else if (!doomed && canAnnounceImmuneSpecies(species)) {
            const named = !!((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME);
            const unique = !!((MONSTER_GENO[species] ?? 0) & G_UNIQ) && species !== PM_HIGH_CLERIC;
            await plineWithContinuation(`You aren't permitted to genocide ${
                unique && !named ? 'the ' : ''}${unique || named ? name : plural}.`);
        }
    }
    // Unlike single-species genocide, C does not install a delayed killer here.
    if (doomed) await finishHeroDeath(genocideDeathOptions('scroll'));
    return true;
}

// C read.c:do_genocide().
export async function doGenocide(how: number, {
    finishHeroDeath = finishNativeHeroDeath,
}: GenocideOptions = {}): Promise<boolean> {
    const state = requireInitializedGame();
    const really = !!(how & GENOCIDE_REALLY);
    const playerSelected = !!(how & GENOCIDE_PLAYER);
    const species = playerSelected ? state.u.umonster : await requestGenocideSpecies(really);
    if (state.program_state.gameover) return true;
    if (species === null) return false;
    const presentation = genocidePresentation(species);

    if (!really) return sendInMonsters(species, presentation.name);

    const firstGenocide = !MONSTER_NAME.some((_, index) => speciesWasGenocided(index));
    const realName = makePlural(requireMonsterData(MONSTER_NAME, species));
    recordGameLogEvent(firstGenocide
        ? `performed ${state.flags.female ? 'her' : 'his'} first genocide (${realName})`
        : `genocided ${realName}`, {
        state,
        flags: firstGenocide ? LL_CONDUCT | LL_GENOCIDE : LL_GENOCIDE,
    });
    recordGenocide(species);
    await plineWithContinuation(`Wiped out ${presentation.prefix}${
        presentation.prefix === 'all ' ? makePlural(presentation.name) : presentation.name}.`);
    const killPlayer = playerSelected || heroOwnSpecies(species)
        || heroIsUnchanging(state) && species === heroSpecies(state);
    if (killPlayer) {
        state.u.uhp = -1;
        const cause: HeroGenocideCause = playerSelected ? 'confusion'
            : how & GENOCIDE_ON_THRONE ? 'throne' : 'scroll';
        if (Upolyd(state.u) && species !== heroSpecies(state)) {
            rememberPolymorphGenocide(cause, state);
            await plineWithContinuation(formatFeltMessage(`${feelingAfterSelfGenocide(state)} inside.`, state));
        } else {
            await finishHeroDeath(genocideDeathOptions(cause));
            if (state.program_state.gameover) return true;
        }
    } else if (species === heroSpecies(state)) {
        const outcome = await returnHeroToHumanForm(state, { die: finishHeroDeath });
        if (outcome.died || state.program_state.gameover) return true;
    }
    await killGenocidedMonsters();
    return true;
}

function heroOwnSpecies(species: number): boolean {
    const state = requireInitializedGame();
    return species === state.u.umonster || species === state.urace.mnum;
}

function genocideVital(species: number): MonsterVital {
    const vital = game.mvitals?.[species];
    if (!vital) throw new Error(`Genocide requires initialized history for species ${species}`);
    return vital;
}

function speciesWasGenocided(species: number): boolean {
    return !!(genocideVital(species).mvflags & G_GENOD);
}

function recordGenocide(species: number): void {
    const state = requireInitializedGame();
    const vital = genocideVital(species);
    const alreadyGenocided = !!(vital.mvflags & G_GENOD);
    vital.mvflags |= G_GENOD | G_NOCORPSE;
    if (alreadyGenocided) return;
    state.u.uconduct.genocides = (state.u.uconduct.genocides ?? 0) + 1;
}

function genocidePresentation(species: number): { name: string; prefix: string } {
    const state = requireInitializedGame();
    if (heroIsHallucinating(state)) {
        const role = state.flags.female && state.urole.name.f
            ? state.urole.name.f : state.urole.name.m;
        const name = Upolyd(state.u) ? monsterTypeName(heroSpecies(state), !!state.flags.female)
            : role.charAt(0).toLowerCase() + role.slice(1);
        return { name, prefix: 'all ' };
    }
    const unique = !!((MONSTER_GENO[species] ?? 0) & G_UNIQ) && species !== PM_HIGH_CLERIC;
    const named = !!((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME);
    return { name: requireMonsterData(MONSTER_NAME, species), prefix: unique ? named ? '' : 'the ' : 'all ' };
}

async function revertTargetedVampireForm(species: number): Promise<void> {
    const state = requireInitializedGame();
    const base = state.u.mcham;
    if (Upolyd(state.u) && base !== undefined && monsterIsVampire(base)
        && !monsterIsVampire(state.u.umonnum)
        && (species === state.u.umonnum || species === base))
        await polymorphHero(POLY_REVERT);
}

async function sendInMonsters(species: number, name: string): Promise<boolean> {
    const state = requireInitializedGame();
    const census = () => state.level.monsters.filter(monster =>
        monster.mhp > 0 && !(monster.isgd && monster.mx === 0)).length;
    const before = census();
    let created = 0;
    if (!((MONSTER_GENO[species] ?? 0) & G_UNIQ)
        && !(genocideVital(species).mvflags & (G_GENOD | G_EXTINCT))) {
        for (let count = rn1(3, 4); count > 0; count--) {
            const monster = await makemonNear(species, state.u.ux, state.u.uy, NO_MINVENT | MM_NOMSG);
            if (!monster) break;
            created++;
            if (genocideVital(species).mvflags & G_EXTINCT) break;
        }
    }
    if (created) {
        const total = census() - before;
        const subject = total > 1 ? `some ${makePlural(name)}` : withIndefiniteArticle(name);
        await plineWithContinuation(`Sent in ${subject}.`);
    } else {
        await plineWithContinuation('Nothing happens.');
    }
    return true;
}

async function requestGenocideSpecies(really: boolean): Promise<number | null> {
    const state = requireInitializedGame();
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await genocideInput('species', attempt);
        if (!response) {
            await plineWithContinuation(attempt < 4
                ? "Type the name of a type of monster or 'none'." : 'No type of monster specified.');
            continue;
        }
        if (declinedGenocide(response)) {
            const species = really ? null : rndmonstAdj();
            if (species !== null) return species;
            recordGameLogEvent('declined to perform genocide', { state, flags: LL_GENOCIDE });
            return null;
        }
        if (response === '?' || response === "'?'") {
            await listGenocided('g');
            attempt--;
            continue;
        }
        const species = nameToMonster(response);
        if (species < 0 || speciesWasGenocided(species)) {
            await plineWithContinuation(`Such creatures ${species < 0 ? 'do not' : 'no longer'} exist in this world.`);
            continue;
        }
        await revertTargetedVampireForm(species);
        if (state.program_state.gameover) return null;
        if (heroOwnSpecies(species)) return species;
        if (monsterIsHuman(species)) adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
        if ((MONSTER_FLAGS2[species] ?? 0) & M2_DEMON)
            adjustHeroAlignment(Math.sign(state.u.ualign.type), state);
        if (!((MONSTER_GENO[species] ?? 0) & G_GENO)) {
            if (!heroIsDeaf(state)) {
                if (state.flags.verbose) await plineWithContinuation('A thunderous voice booms through the caverns:');
                await plineWithContinuation('"No, mortal!  That will not be done."');
            }
            continue;
        }
        return species;
    }
    if (!really) {
        const species = rndmonstAdj();
        if (species !== null) return species;
    }
    await plineWithContinuation("That's enough tries!");
    return null;
}

async function requestGenocideClass(): Promise<number | null> {
    const state = requireInitializedGame();
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await genocideInput('class', attempt);
        if (!response) {
            await plineWithContinuation(attempt < 4
                ? "Type letter (or punctuation) or name used for a class of monsters or 'none'."
                : 'No class of monsters specified.');
            continue;
        }
        if (declinedGenocide(response)) {
            recordGameLogEvent('declined to perform class genocide', { state, flags: LL_GENOCIDE });
            return null;
        }
        if (response === '?' || response === "'?'") {
            await listGenocided('g');
            attempt--;
            continue;
        }
        const monsterClass = nameToMonsterClass(response);
        let immune = 0, gone = 0, available = 0;
        for (let species = 0; species < MONSTER_NAME.length; species++) {
            if (MONSTER_SYMBOL[species] !== monsterClass) continue;
            if (!((MONSTER_GENO[species] ?? 0) & G_GENO)) immune++;
            else if (speciesWasGenocided(species)) gone++;
            else available++;
        }
        if (available || monsterClass === MONSTER_SYMBOL[state.u.umonster]
            || monsterClass === MONSTER_SYMBOL[state.urace.mnum]) return monsterClass;
        if (gone) await plineWithContinuation('All such monsters are already nonexistent.');
        else if (immune || monsterClass === S_INVISIBLE)
            await plineWithContinuation("You aren't permitted to genocide such monsters.");
        else if (state.flags.debug && response.startsWith('*')) {
            let removed = 0;
            for (const monster of [...state.level.monsters].reverse()) {
                if (monster.mhp <= 0) continue;
                await removeMonsterFromGame(monster);
                removed++;
                if (state.program_state.gameover) return null;
            }
            await plineWithContinuation(`Eliminated ${removed} monster${removed === 1 ? '' : 's'}.`);
            return null;
        } else {
            await plineWithContinuation(`That ${response.length === 1 ? 'symbol' : 'response'} does not represent any monster.`);
        }
    }
    await plineWithContinuation("That's enough tries!");
    return null;
}

async function genocideInput(kind: 'class' | 'species', attempt: number): Promise<string> {
    const state = requireInitializedGame();
    const subject = kind === 'class' ? 'class of monsters' : 'type of monster';
    const assisted = kind === 'class' ? "the symbol or name representing a class, or '?'"
        : "the name of a type of monster, or '?'";
    const suffix = attempt ? ` [enter ${(state.flags.cmdassist ?? true) ? assisted : "'?' to see previous genocides"}]` : '';
    const response = await getLine(`What ${subject} do you want to genocide?${suffix}`,
        (_ch, key) => key >= 32 && key < 127);
    return response === null ? '\u001b' : response.trim().replace(/\s+/g, ' ');
}

function declinedGenocide(response: string): boolean {
    return response.startsWith('\u001b') || ['none', "'none'", 'nothing'].includes(response.toLowerCase());
}

function canAnnounceImmuneSpecies(species: number): boolean {
    const role = requireInitializedGame().urole;
    const sound = questMonsterSound(species);
    return (sound !== MS_LEADER || species === role.ldrnum)
        && (sound !== MS_NEMESIS || species === role.neminum)
        && (sound !== MS_GUARDIAN || species === role.guardnum)
        && (species !== PM_NINJA || role.key === 'samurai');
}


// ---------------------------------------------------------------------------
// Punishment. C refs: read.c punish(), unpunish().
// ---------------------------------------------------------------------------

const BALL_CLASS = 15;
const CHAIN_CLASS = 16;

// C read.c:punish().
export async function punishHero(source: GameObject | null = null, state: GameState = game) {
    requirePlayingGame(state);
    const reusedBall = source?.otyp === HEAVY_IRON_BALL ? source : null;
    if (!reusedBall)
        await plineWithContinuation('You are being punished for your misbehavior!');
    const attachedBall = state.uball || state.u.uball;
    if (attachedBall) {
        await plineWithContinuation('Your iron ball gets heavier.');
        attachedBall.owt += WT_IRON_BALL_INCR * (source?.cursed ? 2 : 1);
        return;
    }
    const species = heroMonsterForm(state);
    const form = species == null ? null : { mnum: species };
    if (monsterIsAmorphous(form) || monsterIsWhirly(form) || monsterIsUnsolid(form)) {
        if (!reusedBall)
            await plineWithContinuation('A ball and chain appears, then falls away.');
        const ball = reusedBall || await mkobj(BALL_CLASS, true);
        if (state.u.uswallow) {
            const swallower = state.u.ustuck;
            if (!swallower) throw new Error('A swallowed hero has no swallowing monster');
            await addObjectToMonsterInventory(swallower, ball, state);
        } else
            await landFloorObject(ball, state.u.ux, state.u.uy, { state });
        return;
    }
    const chain = await mkobj(CHAIN_CLASS, true);
    const ball = reusedBall || await mkobj(BALL_CLASS, true);
    chain.owornmask = W_CHAIN;
    ball.owornmask = W_BALL;
    state.uchain = state.u.uchain = chain;
    state.uball = state.u.uball = ball;
    state.u.punished = true;
    if (!state.u.uswallow) {
        await placeBallAndChain(state);
        if (heroIsBlind(state)) await setBallAndChainFelt(true, state);
        await newsym(state.u.ux, state.u.uy);
    }
}

// C read.c:unpunish().
export async function unpunishHero(state: GameState = game) {
    const chain = state.uchain || state.u.uchain;
    const ball = state.uball || state.u.uball;

    if (chain) {
        state.uchain = null;
        state.u.uchain = null;
        chain.owornmask = (chain.owornmask ?? 0) & ~W_CHAIN;
        await delobj(chain, state);
    }
    if (ball)
        ball.owornmask = (ball.owornmask ?? 0) & ~W_BALL;

    state.uchain = state.uball = null;
    state.u.uchain = state.u.uball = null;
    state.u.punished = false;
    return { ball, chain };
}

// ---------------------------------------------------------------------------
// Species and gender rules shared by corpse revival and statues.
// C refs: read.c cant_revive() and obj.h corpse/statue gender flags.
// ---------------------------------------------------------------------------

const PM_ANGEL = 123;
const PM_GUARD = 272;
const PM_SHOPKEEPER = 271;
const PM_ALIGNED_CLERIC = 275;
const PM_LONG_WORM = 114;
const PM_LONG_WORM_TAIL = 330;

export const PM_HUMAN_ZOMBIE = 244;
export const PM_DOPPELGANGER = 270;

// C read.c:cant_revive().
export function revivalReplacement(mnum: number, body: GameObject | null, revival = true): number | null {
    if ([PM_GUARD, PM_HIGH_CLERIC, PM_ALIGNED_CLERIC, PM_ANGEL]
        .includes(mnum) || mnum === PM_SHOPKEEPER && !revival) return PM_HUMAN_ZOMBIE;
    if (mnum === PM_LONG_WORM_TAIL) return PM_LONG_WORM;
    if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ
        && !body?.oextra?.omonst) return PM_DOPPELGANGER;
    return null;
}

export function bodyGenderFlags(body: GameObject): number {
    const gender = (body.spe ?? 0) & 0x03;
    if (gender === 1) return MM_FEMALE;
    if (gender === 2) return MM_MALE;
    return 0;
}

// ---------------------------------------------------------------------------
// Wizard-mode monster creation. C refs: read.c create_particular(),
// create_particular_parse(), create_particular_creation(). The caller owns
// the command's turn. C read.c:3166 leans on minion.c's monster_census().
// ---------------------------------------------------------------------------

type Gender = -1 | MonsterNameGender;
type MonsterChoice = { kind: 'species'; species: number; gender: MonsterNameGender }
    | { kind: 'class'; monsterClass: number }
    | { kind: 'random' };
interface CreationRequest {
    quantity: number;
    choice: MonsterChoice;
    gender: Gender;
    genderConflict: boolean;
    disposition: 'tame' | 'peaceful' | 'hostile' | null;
    saddled: boolean;
    sleeping: boolean;
    invisible: boolean;
    hidden: boolean;
}

const PM_STALKER = MONSTER_NAME.indexOf('stalker');

// C read.c:create_particular().
export async function createParticularMonster(): Promise<boolean> {
    requirePlayingGame(game);
    let prompt = 'Create what kind of monster?';
    let explainedEmptyInput = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await getLine(prompt, (_ch, key) => key >= 32 && key < 127);
        if (response === null || response.startsWith('\u001b')) return false;
        const text = response.trim().replace(/\s+/g, ' ');
        const request = parseCreationRequest(text);
        if (request) return createRequestedMonsters(request);
        if (text || explainedEmptyInput || attempt === 4)
            await plineWithContinuation("I've never heard of such monsters.");
        else {
            await plineWithContinuation('Try again (type * for random, ESC to cancel).');
            explainedEmptyInput = true;
        }
        prompt = 'Create what kind of monster? [type name or symbol]';
    }
    await plineWithContinuation("That's enough tries!");
    return false;
}

// C read.c:create_particular_parse().
function parseCreationRequest(text: string): CreationRequest | null {
    const explicitQuantity = /^(\d+) */u.exec(text);
    let quantity = explicitQuantity ? Number.parseInt(explicitQuantity[1] ?? '', 10)
        : 1 + Math.max(game.multi, 0);
    const limit = ROWNO * (COLNO - 1);
    if (quantity < 1 || quantity > limit) quantity = limit - monsterCensus();
    let name = explicitQuantity ? text.slice(explicitQuantity[0].length) : text;
    // Native removes one occurrence of each modifier before lookup. Checking
    // female first prevents the embedded "male " from being mistaken for it.
    const modifiers = new Set<string>();
    for (const modifier of ['saddled', 'sleeping', 'invisible', 'hidden', 'female', 'male']) {
        const pattern = new RegExp(`${modifier} `, 'i');
        if (pattern.test(name)) {
            modifiers.add(modifier);
            name = name.replace(pattern, ' '.repeat(modifier.length + 1));
        }
    }
    name = name.trim().replace(/\s+/g, ' ');
    let disposition: CreationRequest['disposition'] = null;
    for (const candidate of ['tame', 'peaceful', 'hostile'] as const) {
        if (name.toLowerCase().startsWith(`${candidate} `)) {
            disposition = candidate;
            name = name.slice(candidate.length + 1);
            break;
        }
    }
    const choice = monsterChoice(name);
    if (!choice) return null;
    const namedGender = choice.kind === 'species' ? choice.gender : -1;
    const explicitGender = modifiers.has('male') ? 0 : modifiers.has('female') ? 1 : null;
    return {
        quantity, choice, disposition,
        gender: explicitGender ?? namedGender,
        genderConflict: explicitGender !== null && namedGender !== -1
            && namedGender !== 2 && explicitGender !== namedGender,
        saddled: modifiers.has('saddled'), sleeping: modifiers.has('sleeping'),
        invisible: modifiers.has('invisible'), hidden: modifiers.has('hidden'),
    };
}

function monsterChoice(name: string): MonsterChoice | null {
    if (game.flags.debug && (name === '*' || name === 'random')) return { kind: 'random' };
    const match = resolveMonsterName(name);
    if (match) return { kind: 'species', species: match.mnum, gender: match.gender };
    const { monsterClass, mnum } = resolveMonsterClass(name);
    if (mnum >= 0) return { kind: 'species', species: mnum, gender: 2 };
    if (monsterClass === 35) return { kind: 'species', species: PM_STALKER, gender: 2 };
    if (monsterClass === 59) return { kind: 'species', species: 114, gender: 2 };
    return monsterClass > 0 ? { kind: 'class', monsterClass } : null;
}

// C read.c:create_particular_creation().
async function createRequestedMonsters(request: CreationRequest): Promise<boolean> {
    requirePlayingGame(game);
    const firstChoice = request.choice.kind === 'species' ? request.choice.species
        : request.choice.kind === 'class' ? game.u.umonster : -1;
    let species = firstChoice;
    if (request.choice.kind === 'species') {
        const replacement = revivalReplacement(species, null, false);
        if (replacement !== null) {
            species = replacement;
            if (firstChoice !== 330) {
                const answer = await promptYesNo(`Creating ${requireMonsterData(MONSTER_NAME, species)} instead; force ${requireMonsterData(MONSTER_NAME, firstChoice)}?`);
                if (answer === 'y') species = firstChoice;
            }
        }
    }
    let madeAny = false;
    for (let index = 0; index < request.quantity; index++) {
        const selected = request.choice.kind === 'class' ? mkclassAligned(request.choice.monsterClass)
            : request.choice.kind === 'random' ? rndmonstAdj() : species;
        const flags = creationFlags(request, selected);
        const monster = await makemonNear(selected, game.u.ux, game.u.uy, flags);
        if (!monster) {
            if (request.choice.kind === 'species') break;
            continue;
        }
        if (request.disposition === 'tame') await tameMonster(monster);
        else if (request.disposition) {
            monster.mtame = 0;
            monster.pet = false;
            monster.mpeaceful = request.disposition === 'peaceful' ? 1 : 0;
            setMonsterMalign(monster);
        }
        if (request.saddled && !monsterSaddle(monster)) await putSaddleOnMonster(null, monster);
        if (request.hidden && canHideCreatedMonster(monster)) monster.mundetected = 1;
        if (request.sleeping) monster.msleeping = 1;
        if ((request.hidden || request.invisible) && !canSpotMonster(monster))
            await flashCreatedMonster(monster);
        madeAny = true;
        if (monster.cham !== undefined && monster.cham >= 0 && firstChoice >= 0
            && monster.cham !== firstChoice) await changeMonsterForm(monster, firstChoice);
    }
    return madeAny;
}

function creationFlags(request: CreationRequest, species: number | null): number {
    const fixedGender = species !== null && (requireMonsterData(MONSTER_FLAGS2, species) & 0x00030000);
    const setGender = request.genderConflict || !fixedGender;
    const gender = setGender && request.gender === 1 ? MM_FEMALE
        : setGender && request.gender === 0 ? MM_MALE : 0;
    return gender | (request.genderConflict ? 0 : MM_NOEXCLAM)
        | (request.invisible ? MM_MINVIS : 0);
}

function canHideCreatedMonster(monster: Monster): boolean {
    const traits = requireMonsterData(MONSTER_FLAGS1, monster.mnum);
    const symbol = requireMonsterData(MONSTER_SYMBOL, monster.mnum);
    return !!(traits & 0x00000100) && symbol !== 13
        || !!(traits & 0x00000080) && !!game.level?.objects[monster.mx]?.[monster.my]?.length
        || symbol === 57 && isPoolAt(monster.mx, monster.my);
}

async function flashCreatedMonster(monster: Monster): Promise<void> {
    let count = couldsee(monster.mx, monster.my) ? 8 : 4;
    if (game.flags.sparkle === false) count /= 2;
    const row = game.viz_array?.[monster.my];
    const saved = row?.[monster.mx];
    if (!row || saved === undefined) throw new Error('A created monster needs its visibility cell');
    row[monster.mx] = saved | 3;
    try {
        await flashGlyphAt(monster.mx, monster.my, transientMonsterGlyph(monster), count);
    } finally {
        row[monster.mx] = saved;
        await newsym(monster.mx, monster.my);
    }
}

// ---------------------------------------------------------------------------
// Readable garment and wrapper text. C refs: read.c tshirt_text(),
// apron_text(), hawaiian_motif(), hawaiian_design(), candy_wrapper_text(),
// assign_candy_wrapper(). Shared with end-of-game xname_flags() disclosure.
// ---------------------------------------------------------------------------

const T_SHIRT = OBJECT_NAMES.indexOf('T-shirt');

// C read.c:tshirt_text() and read.c:apron_text(). Erosion wears the
// lettering away deterministically from the hero's birth date.
export function garmentInscription(object: ObjectInscriptionView, state: GameState = game): string {
    if (object.otyp !== T_SHIRT && object.otyp !== ALCHEMY_SMOCK)
        throw new Error('Only T-shirts and alchemy smocks have garment inscriptions.');
    const messages = object.otyp === T_SHIRT ? SHIRT_MESSAGES : APRON_MESSAGES;
    const id = object.o_id ?? 0;
    const text = inscriptionAt(messages, id % messages.length);
    const erosion = Math.max(object.oeroded || 0, object.oeroded2 || 0);
    if (!erosion) return text;
    return wipeoutText(text, Math.trunc(text.length * erosion / 6),
        (id ^ heroBirthday(state)) >>> 0);
}

// C read.c:candy_wrapper_text().
export function candyWrapperText(object: ObjectInscriptionView): string {
    return CANDY_WRAPPERS[(object.spe ?? 0) % CANDY_WRAPPERS.length] ?? '';
}

// C read.c:hawaiian_motif().
export function hawaiianMotif(object: ObjectInscriptionView, state: GameState = game): string {
    const motif = ((object.o_id ?? 0) ^ heroBirthday(state)) >>> 0;
    return inscriptionAt(HAWAIIAN_MOTIFS, motif % HAWAIIAN_MOTIFS.length);
}

// C read.c:hawaiian_design().
export function hawaiianDesign(object: ObjectInscriptionView, state: GameState = game): string {
    const background = ((object.o_id ?? 0) ^ ~heroBirthday(state)) >>> 0;
    const backgroundText = inscriptionAt(HAWAIIAN_BACKGROUNDS, background % HAWAIIAN_BACKGROUNDS.length);
    return `${makePlural(hawaiianMotif(object, state))} on ${withIndefiniteArticle(backgroundText)} background`;
}

function heroBirthday(state: GameState): number {
    if (state.ubirthday === undefined)
        throw new Error('Object text requires the initialized hero birth time.');
    return state.ubirthday;
}

function inscriptionAt(messages: readonly string[], index: number): string {
    const message = messages[index];
    if (message === undefined)
        throw new RangeError(`No readable inscription at index ${index}.`);
    return message;
}

// C read.c:assign_candy_wrapper(). Index zero is the blank wrapper.
export function assignCandyWrapper(object: GameObject): void {
    if (object.otyp === CANDY_BAR)
        object.spe = 1 + rn2(CANDY_WRAPPERS.length - 1);
}
