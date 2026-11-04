// Object creation and species-dependent initialization.
// C ref: mkobj.c.
import { RANDOM_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, VENOM_CLASS, SPBOOK_no_NOVEL, } from './objclass.js';
import { objectBaseWeight, objectBaseCost, objectMerge, objectUsesKnown, objectMagic, getObjectClassBounds, getObjectDefinition, requireObjectData, WORM_TOOTH, UNICORN_HORN, HELM_OF_OPPOSITE_ALIGNMENT, GAUNTLETS_OF_FUMBLING, FUMBLE_BOOTS, LEVITATION_BOOTS, AMULET_OF_STRANGULATION, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_CHANGE, AMULET_OF_YENDOR, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING, BAG_OF_TRICKS, TALLOW_CANDLE, WAX_CANDLE, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, EXPENSIVE_CAMERA, CRYSTAL_BALL, TINNING_KIT, CAN_OF_GREASE, FIGURINE, MAGIC_MARKER, MAGIC_FLUTE, FROST_HORN, FIRE_HORN, HORN_OF_PLENTY, MAGIC_HARP, DRUM_OF_EARTHQUAKE, CORPSE, EGG, MEAT_RING, GLOB_OF_GRAY_OOZE, GLOB_OF_BLACK_PUDDING, KELP_FROND, SLIME_MOLD, CANDY_BAR, TIN, GOLD_PIECE, SPE_NOVEL, DILITHIUM_CRYSTAL, LUCKSTONE, LOADSTONE, ROCK, STATUE, SPLINT_MAIL, WAN_CANCELLATION, WAN_LIGHT, WAN_LIGHTNING, objectDirection, POT_OIL, BELL_OF_OPENING, ELVEN_SHIELD, ORCISH_SHIELD, SHIELD_OF_REFLECTION, BOULDER, FOOD_RATION, LUMP_OF_ROYAL_JELLY, POT_BOOZE, POT_SICKNESS, POT_WATER, APPLE, BANANA, EUCALYPTUS_LEAF, ORANGE, PEAR, HEAVY_IRON_BALL, CANDELABRUM_OF_INVOCATION, WAN_FIRE, oc_nutrition, objectPropertyName, } from './object_data.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { novelTitle } from './do_name.js';
import { eating_glob, set_tin_variety } from './eat.js';
import { relocateObjectRandomly } from './teleport.js';
import { erosionMatters, objectIsVulnerableToErosion } from './trap.js';
import { eggSpeciesIsDead, hatchableEggSpecies, copyPetData, copyShopkeeperData, maybeUnhideAt, undeadToCorpse } from './mon.js';
import { attachFigurineTimer, attachCursedFigurineTimer } from './figurine_timer.js';
import { isIceAt } from './dbridge.js';
import { block_point, cansee, vision_note_blocker_change } from './vision.js';
import { newsym } from './display.js';
import { heroCanReachFloor } from './engrave.js';
import { rn2, rnd, rn1, rne, rnz } from './rng.js';
import { depth as depth_of_level } from './hacklib.js';
import { level_difficulty } from './dungeon.js';
import { ALTAR, ICE, IRONBARS, In_quest, Is_airlevel, Is_rogue_level, Is_waterlevel, G_GONE, G_NOCORPSE, MON_DETACH, MON_FLOOR, ROT_AGE, TROLL_REVIVE_CHANCE, RANDOM_TIN, MAX_OIL_IN_FLASK, CORPSTAT_FEMALE, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_INIT, CORPSTAT_SPE_VAL, OBJECT_TIMER_KIND, LARGEST_INT, } from './const.js';
import { isok } from './cmd.js';
import { MONSTER_BODY_META, MONSTER_GENO, MONSTER_LEVEL, MONSTER_SYMBOL, MONSTER_SIZE, MONSTER_NAME, SPECIAL_PM, requireMonsterData } from './monster_data.js';
import { isReviver, isRider, zombieForm } from './corpse_species.js';
import { forgetTempleEntry } from './priest.js';
import { artifactExistCount, createRandomArtifact, uncreateArtifact } from './artifacts.js';
import { objectTimers, scheduleObjectTimer, stopAllObjectTimers, stopObjectTimer, stopObjectTimers, objectsInTimerGraph, copyObjectTimers } from './timeout.js';
import { isMultiGeneratedWeapon, isPoisonableObject, isBimanualObject } from './object_properties.js';
import { rndmonstAdj } from './makemon.js';
import { learnObjectType, objectMaterial, objectProb } from './o_init.js';
import { nameObjectFromTopten } from './topten.js';
import { makePlural, objectName, objectTypeName, observeObjectForNaming, ownedObjectName, rndClass } from './objnam.js';
import { attachEggHatchTimer } from './timeout.js';
import { assignCandyWrapper } from './read.js';
import { consumeObjectCharge, inventoryItemDescription, mergable, mergeCreatedObjectStacks, mergeObjectStacks, updateCarriedLuck } from './invent.js';
import { assertCreatedObject, createdObjectNoLongerHeld, dropObjectAtHero, objectNoLongerHeld, objectNoLongerHeldSynchronously } from './do.js';
import { addShopObjectToBill, costlyAdjacent, costlySpot, deleteObject, findObjectOwner, objectPriceAdjustment, reconcileObjectDeletionBill, settleGlobAbsorptionBilling, splitObjectBill } from './shk.js';
import { formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { nearCapacity } from './hack.js';
import { encumber_msg } from './pickup.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { hitFloorWithObject } from './dothrow.js';
import { landObjectOnAltar } from './altar_object.js';
import { surfaceName } from './terrain_name.js';
import { removeObjectFromMonsterInventory } from './monworn.js';
import { plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import { objectLightRadius, adjustObjectLightAfterBlessing, objectShedsLight } from './light.js';
import { bookCursed } from './spell.js';
import { resetBulkTakeoff } from './do_wear.js';
import { dropCursedAlternateWeapon } from './wield.js';
import { is_male, is_neuter, monsterIsFemale, monsterIsHuman } from './mondata.js';
const G_NOGEN = 0x0200;
const LIQUID = 1;
const WOOD = 8;
const DRAGON_HIDE = 10;
const PLASTIC = 18;
const PM_DEATH = 311;
const PM_FAMINE = 313;
function updateBlessingEffects(object, state) {
    if (object && state.inventory.includes(object))
        updateCarriedLuck(object, state);
    if (object?.otyp === BAG_OF_HOLDING)
        object.owt = objectWeight(object);
}
function stopFigurineTransformation(object) {
    if (object.otyp === FIGURINE && object.timed)
        stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
}
export function blessObjectState(object, state = game) {
    if (!object || object.oclass === COIN_CLASS)
        return false;
    const changed = !object.blessed || !!object.cursed;
    object.blessed = true;
    object.cursed = false;
    object.buc = 'blessed';
    updateBlessingEffects(object, state);
    stopFigurineTransformation(object);
    return changed;
}
export function unblessObjectState(object, state = game) {
    if (!object)
        return false;
    const changed = !!object.blessed;
    object.blessed = false;
    object.buc = object.cursed ? 'cursed' : 'uncursed';
    updateBlessingEffects(object, state);
    return changed;
}
export function curseObjectState(object, state = game) {
    if (!object || object.oclass === COIN_CLASS)
        return false;
    const changed = !object.cursed || !!object.blessed;
    object.blessed = false;
    object.cursed = true;
    object.buc = 'cursed';
    if (object === (state.uwep || state.u.uwep) && isBimanualObject(object))
        resetBulkTakeoff(state);
    updateBlessingEffects(object, state);
    if (object.otyp === FIGURINE
        && (object.where === 'inventory' || object.where === 'minvent'))
        attachCursedFigurineTimer(object, state);
    return changed;
}
// Live gameplay curses can interrupt an active study through its real input
// boundary. Constructors and bones retain the atomic state initializer.
export async function curseObject(object, { state = game } = {}) {
    const wasCursed = !!object?.cursed;
    const oldLight = objectLightRadius(object, state);
    const changed = curseObjectState(object, state);
    if (object && object === (state.uswapwep || state.u.uswapwep) && state.u.twoweap)
        await dropCursedAlternateWeapon(object, state);
    if (object && changed && !wasCursed && object.oclass === SPBOOK_CLASS)
        await bookCursed(object, { state });
    if (object?.lamplit)
        await adjustObjectLightAfterBlessing(object, oldLight, state);
    return changed;
}
export function uncurseObjectState(object, state = game) {
    if (!object)
        return false;
    const changed = !!object.cursed;
    object.cursed = false;
    object.buc = object.blessed ? 'blessed' : 'uncursed';
    updateBlessingEffects(object, state);
    stopFigurineTransformation(object);
    return changed;
}
// C mkobj.c:blessorcurse().
function blessorcurse(otmp, chance = 10) {
    if (!otmp || otmp.blessed || otmp.cursed)
        return;
    if (!rn2(chance)) {
        if (!rn2(2))
            otmp.cursed = true;
        else
            otmp.blessed = true;
    }
}
// C mkobj.c:mksobj().  Create a specific type of object; never Null.
export async function mksobj(otyp, init, artif, { zombify = false } = {}) {
    const definition = getObjectDefinition(otyp);
    const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0);
    if (init) {
        await mksobj_init(otmp, artif, definition);
    }
    // Fuel is intrinsic to an oil flask even when random initialization is skipped.
    if (otyp === POT_OIL)
        otmp.age = MAX_OIL_IN_FLASK;
    if (otyp === CORPSE || otyp === STATUE || otyp === FIGURINE) {
        if (otmp.corpsenm == null) {
            otmp.corpsenm = rndmonnum();
            if (otyp === CORPSE) {
                otmp.corpsenm = undeadToCorpse(otmp.corpsenm);
                if ((game.mvitals?.[otmp.corpsenm]?.mvflags ?? 0) & (G_NOCORPSE | G_GONE)) {
                    if (!game.urole)
                        throw new Error('Corpse fallback requires the hero role');
                    otmp.corpsenm = SPECIAL_PM + 1 + game.urole.mnum;
                }
            }
        }
        // mkobj.c:mksobj() stores corpse sex in spe. Stack admission and
        // later revival both read those bits, including for statues/figurines.
        const species = otmp.corpsenm;
        if (species === undefined)
            throw new Error('Body object requires a monster species');
        otmp.spe = is_neuter(species) ? CORPSTAT_NEUTER
            : monsterIsFemale(species) ? CORPSTAT_FEMALE
                : is_male(species) ? CORPSTAT_MALE
                    : rn2(2) ? CORPSTAT_FEMALE : CORPSTAT_MALE;
        if (otyp === CORPSE)
            startCorpseTimeout(otmp, { zombify });
    }
    if (otyp === EGG && (otmp.corpsenm ?? -1) >= 0) {
        attachEggHatchTimer(otmp);
    }
    if (otyp === SPE_NOVEL) {
        // mkobj.c:mksobj() names every novel after class initialization.
        // The title index is persistent object identity even when only the
        // floor glyph is currently visible.
        otmp.novelidx = -1;
        const title = novelTitle(otmp);
        if (title === undefined)
            throw new Error('Novel title selection requires a title');
        otmp.oextra = { ...(otmp.oextra || {}), oname: title };
    }
    // mkobj.c:mksobj() computes weight only after type-specific state,
    // quantities, corpse identity, timers, and generated contents are final.
    otmp.owt = objectWeight(otmp);
    return otmp;
}
// C mkobj.c:bcsign().
function bcsign(otmp) {
    return Number(!!otmp.blessed) - Number(!!otmp.cursed);
}
function mayGenerateEroded(otmp) {
    // C ref: mkobj.c:may_generate_eroded(): starting inventory is pristine, while
    // objects produced by mklev on move zero may still be damaged.
    if ((game.moves ?? 0) <= 1 && !game.in_mklev)
        return false;
    if (otmp.oerodeproof || otmp.oartifact || otmp.otyp === WORM_TOOTH || otmp.otyp === UNICORN_HORN)
        return false;
    if (!erosionMatters(otmp))
        return false;
    return objectIsVulnerableToErosion(otmp, 'rust')
        || objectIsVulnerableToErosion(otmp, 'burn')
        || objectIsVulnerableToErosion(otmp, 'rot')
        || objectIsVulnerableToErosion(otmp, 'corrosion')
        || objectIsVulnerableToErosion(otmp, 'crack');
}
// C mkobj.c:mkobj_erosions().
function mkobjErosions(otmp) {
    if (!mayGenerateEroded(otmp))
        return;
    if (!rn2(100)) {
        otmp.oerodeproof = true;
    }
    else {
        const primary = !rn2(80);
        if (primary && (objectIsVulnerableToErosion(otmp, 'burn')
            || objectIsVulnerableToErosion(otmp, 'rust')
            || objectIsVulnerableToErosion(otmp, 'crack'))) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9))
                erosion++;
            otmp.oeroded = erosion;
        }
        const secondary = !rn2(80);
        if (secondary && (objectIsVulnerableToErosion(otmp, 'rot')
            || objectIsVulnerableToErosion(otmp, 'corrosion'))) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9))
                erosion++;
            otmp.oeroded2 = erosion;
        }
    }
    if (!rn2(1000))
        otmp.greased = true;
}
// C mkobj.c:mksobj_init().
async function mksobj_init(otmp, artif, definition) {
    const otyp = otmp.otyp;
    switch (otmp.oclass) {
        case WEAPON_CLASS:
            if (isMultiGeneratedWeapon(otmp))
                otmp.quan = rn1(6, 6);
            if (!rn2(11)) {
                otmp.spe = rne(3);
                otmp.blessed = !!rn2(2);
            }
            else if (!rn2(10)) {
                otmp.cursed = true;
                otmp.spe = -rne(3);
            }
            else {
                blessorcurse(otmp, 10);
            }
            if (isPoisonableObject(otmp))
                otmp.opoisoned = rn2(100) === 0;
            if (artif && !rn2(20 + 10 * artifactExistCount()))
                createRandomArtifact(otmp);
            break;
        case ARMOR_CLASS:
            if (rn2(10)
                && (otyp === FUMBLE_BOOTS || otyp === LEVITATION_BOOTS
                    || otyp === HELM_OF_OPPOSITE_ALIGNMENT
                    || otyp === GAUNTLETS_OF_FUMBLING || !rn2(11))) {
                otmp.cursed = true;
                otmp.spe = -rne(3);
            }
            else if (!rn2(10)) {
                otmp.blessed = !!rn2(2);
                otmp.spe = rne(3);
            }
            else {
                blessorcurse(otmp, 10);
            }
            if (artif && !rn2(40 + 10 * artifactExistCount()))
                createRandomArtifact(otmp);
            // Native lacquer protects Samurai armor created at startup or
            // anywhere in the hero's quest, including armor carried by monsters.
            if (game.urole?.key === 'samurai' && otmp.otyp === SPLINT_MAIL
                && (game.moves <= 1 || In_quest(game.u.uz))) {
                otmp.oerodeproof = true;
                otmp.rknown = true;
            }
            break;
        case RING_CLASS:
            if (definition.charged) {
                blessorcurse(otmp, 3);
                if (rn2(10)) {
                    if (rn2(10) && bcsign(otmp)) {
                        otmp.spe = bcsign(otmp) * rne(3);
                    }
                    else {
                        otmp.spe = (rn2(2) ? 1 : -1) * rne(3);
                    }
                }
                if (otmp.spe === 0)
                    otmp.spe = rn2(4) - rn2(3);
                if (otmp.spe < 0 && rn2(5))
                    curseObjectState(otmp);
            }
            else if (rn2(10)
                && (otyp === 194 || otyp === 196 || otyp === 185
                    || otyp === 184 || !rn2(9))) {
                otmp.cursed = true;
            }
            break;
        case AMULET_CLASS:
            if (otyp === AMULET_OF_YENDOR)
                game.context.made_amulet = true;
            if (rn2(10) && (otyp === AMULET_OF_STRANGULATION
                || otyp === AMULET_OF_CHANGE
                || otyp === AMULET_OF_RESTFUL_SLEEP))
                otmp.cursed = true;
            else
                blessorcurse(otmp, 10);
            break;
        case FOOD_CLASS:
            if (otyp === CORPSE) {
                let tries = 50;
                do {
                    otmp.corpsenm = undeadToCorpse(rndmonnum());
                } while (((MONSTER_GENO[otmp.corpsenm] ?? 0) & 0x0010)
                    && --tries > 0);
                if (!tries)
                    otmp.corpsenm = 260; // PM_HUMAN fallback
            }
            else if (otyp === EGG) {
                otmp.corpsenm = -1; // NON_PM: generic egg
                if (!rn2(3)) {
                    // C ref: mkobj.c EGG initialization. Try up to 200 random
                    // monsters. Every failed rndmonnum() call still advances the
                    // gameplay RNG.
                    for (let tries = 200; tries > 0; tries--) {
                        const mndx = hatchableEggSpecies(rndmonnum());
                        if (mndx !== -1 && !eggSpeciesIsDead(mndx)) {
                            otmp.corpsenm = mndx;
                            break;
                        }
                    }
                }
            }
            else if (otyp === TIN) {
                otmp.corpsenm = -1;
                if (rn2(6)) {
                    // mkobj.c retries up to 200 times until the selected corpse
                    // has nutrition and is allowed to leave a corpse.
                    for (let tries = 200; tries > 0; tries--) {
                        const mndx = undeadToCorpse(rndmonnum());
                        const nutrition = MONSTER_BODY_META[mndx]?.[1] ?? 0;
                        if (!nutrition || ((MONSTER_GENO[mndx] ?? 0) & 0x0010))
                            continue;
                        otmp.corpsenm = mndx;
                        set_tin_variety(otmp, RANDOM_TIN);
                        break;
                    }
                }
                else
                    otmp.spe = 1;
                blessorcurse(otmp, 10);
            }
            else if (otyp >= GLOB_OF_GRAY_OOZE
                && otyp <= GLOB_OF_BLACK_PUDDING) {
                // mkobj.c:mksobj_init() constructs globs as one variable-weight
                // identity and immediately starts their first 23..27-turn timer.
                otmp.globby = true;
                otmp.quan = otmp.quantity = 1;
                otmp.owt = definition.weight;
                otmp.known = otmp.dknown = true;
                otmp.corpsenm = 206 + (otyp - GLOB_OF_GRAY_OOZE);
                scheduleObjectTimer(otmp, OBJECT_TIMER_KIND.SHRINK_GLOB, (game.moves ?? 0) + 23 + rn2(5), game);
            }
            else if (otyp === SLIME_MOLD) {
                const fruit = game.context.current_fruit;
                if (fruit === undefined)
                    throw new Error('Slime mold creation requires a current fruit');
                otmp.spe = fruit;
                game.flags.made_fruit = true;
            }
            else if (otyp === KELP_FROND) {
                otmp.quan = rnd(2);
            }
            else if (otyp === CANDY_BAR) {
                assignCandyWrapper(otmp);
            }
            if (otyp !== CORPSE && otyp !== MEAT_RING && otyp !== KELP_FROND
                && !(otyp >= GLOB_OF_GRAY_OOZE
                    && otyp <= GLOB_OF_BLACK_PUDDING))
                if (!rn2(6))
                    otmp.quan = 2;
            break;
        case GEM_CLASS:
            if (otyp === LOADSTONE)
                otmp.cursed = true;
            else if (otyp === ROCK)
                otmp.quan = rn1(6, 6);
            else if (otyp !== LUCKSTONE && !rn2(6))
                otmp.quan = 2;
            break;
        case TOOL_CLASS:
            switch (otyp) {
                case TALLOW_CANDLE:
                case WAX_CANDLE:
                    otmp.spe = 1;
                    otmp.age = 20 * objectBaseCost(otyp);
                    otmp.lamplit = false;
                    otmp.quan = 1 + (rn2(2) ? rn2(7) : 0);
                    blessorcurse(otmp, 5);
                    break;
                case BRASS_LANTERN:
                case OIL_LAMP:
                    otmp.spe = 1;
                    otmp.age = rn1(500, 1000);
                    otmp.lamplit = false;
                    blessorcurse(otmp, 5);
                    break;
                case MAGIC_LAMP:
                    otmp.spe = 1;
                    otmp.lamplit = false;
                    blessorcurse(otmp, 2);
                    break;
                case CHEST:
                case LARGE_BOX:
                    otmp.olocked = !!rn2(5);
                    otmp.otrapped = !rn2(10);
                    otmp.tknown = otmp.otrapped && !rn2(100); /* obvious trap */
                    /* FALLTHROUGH to the box group in C */
                    await mkboxCnts(otmp);
                    break;
                case ICE_BOX:
                case SACK:
                case OILSKIN_SACK:
                case BAG_OF_HOLDING:
                    await mkboxCnts(otmp);
                    break;
                case EXPENSIVE_CAMERA:
                case TINNING_KIT:
                case MAGIC_MARKER:
                    otmp.spe = rn1(70, 30);
                    break;
                case CAN_OF_GREASE:
                    otmp.spe = rn1(21, 5); /* 0..20 + 5 => 5..25 */
                    blessorcurse(otmp, 10);
                    break;
                case CRYSTAL_BALL:
                    otmp.spe = rn1(5, 3); /* 0..4 + 3 => 3..7 */
                    blessorcurse(otmp, 2);
                    break;
                case HORN_OF_PLENTY:
                case BAG_OF_TRICKS:
                    otmp.spe = rn1(18, 3); /* 0..17 + 3 => 3..20 */
                    break;
                case FIGURINE: {
                    // C mksobj_init(): figurines deliberately select from a
                    // harder band than ordinary corpses/statues and reject human forms
                    // through a bounded post-check retry.  Store the chosen identity so
                    // mksobj()'s shared corpse/statue/figurine tail only assigns gender.
                    let tryCount = 0;
                    do {
                        otmp.corpsenm = rndmonnumAdj(5, 10);
                    } while (monsterIsHuman(otmp.corpsenm)
                        && tryCount++ < 30);
                    blessorcurse(otmp, 4);
                    break;
                }
                case BELL_OF_OPENING:
                    otmp.spe = 3;
                    break;
                case MAGIC_FLUTE:
                case MAGIC_HARP:
                case FROST_HORN:
                case FIRE_HORN:
                case DRUM_OF_EARTHQUAKE:
                    otmp.spe = rn1(5, 4);
                    break;
            }
            break;
        case POTION_CLASS:
        case SCROLL_CLASS:
            // MAIL_STRUCTURES: stamped scrolls of mail bypass ordinary random BUC
            // initialization; readobjnam() marks a wished one via spe afterward.
            if (otyp !== 364)
                blessorcurse(otmp, 4);
            break;
        case SPBOOK_CLASS:
            blessorcurse(otmp, 17);
            break;
        case WAND_CLASS:
            if (otyp === 414)
                otmp.spe = 1;
            else if (otyp === 415)
                otmp.spe = rn1(4, 3);
            else
                otmp.spe = rn1(5, objectDirection(otyp, game) === 1 ? 11 : 4);
            blessorcurse(otmp, 17);
            break;
        case ROCK_CLASS:
            if (otyp === STATUE) {
                otmp.corpsenm = rndmonnum();
                if ((MONSTER_SIZE[otmp.corpsenm] || 0) >= 1
                    && rn2(Math.trunc(level_difficulty() / 2) + 10) > 10) {
                    // Ordinary initialized statues can contain one non-novel
                    // spellbook.  A Lua `contents` field clears this object only
                    // after its complete constructor has consumed RNG.
                    await addCreatedObjectToContainer(otmp, await mkobj(SPBOOK_no_NOVEL, false));
                }
            }
            break;
    }
    mkobjErosions(otmp);
}
// C mkobj.c:mkbox_cnts().
async function mkboxCnts(box) {
    let maximum;
    if (box.otyp === ICE_BOX)
        maximum = 20;
    else if (box.otyp === CHEST)
        maximum = box.olocked ? 7 : 5;
    else if (box.otyp === LARGE_BOX)
        maximum = box.olocked ? 5 : 3;
    else if (box.otyp === SACK || box.otyp === OILSKIN_SACK) {
        maximum = ((game.moves ?? 0) <= 1 && !game.in_mklev) ? 0 : 1;
    }
    else if (box.otyp === BAG_OF_HOLDING)
        maximum = 1;
    else
        maximum = 0;
    box.contents = [];
    const classProbs = [[18, GEM_CLASS], [15, FOOD_CLASS], [18, POTION_CLASS],
        [18, SCROLL_CLASS], [12, SPBOOK_CLASS], [7, COIN_CLASS],
        [6, WAND_CLASS], [5, RING_CLASS], [1, AMULET_CLASS]];
    for (let count = rn2(maximum + 1); count > 0; count--) {
        let content;
        if (box.otyp === ICE_BOX) {
            content = await mksobj(CORPSE, true, false);
            content.age = 0;
            stopAllObjectTimers(content);
        }
        else {
            let roll = rnd(100);
            let objectClass = AMULET_CLASS;
            for (const [probability, candidate] of classProbs) {
                roll -= probability;
                if (roll <= 0) {
                    objectClass = candidate;
                    break;
                }
            }
            content = await mkobj(objectClass, false);
            if (content.oclass === COIN_CLASS) {
                content.quan = rnd(level_difficulty() + 2) * rnd(75);
                content.quantity = content.quan;
                content.owt = objectWeight(content);
            }
            else
                while (content.otyp === ROCK) {
                    content.otyp = rndClass(DILITHIUM_CRYSTAL, LOADSTONE);
                    if (content.quan > 2)
                        content.quan = 1;
                    content.quantity = content.quan;
                    content.owt = objectWeight(content);
                }
            if (box.otyp === BAG_OF_HOLDING) {
                if (content.otyp === BAG_OF_HOLDING
                    || content.otyp === BAG_OF_TRICKS) {
                    content.otyp = SACK;
                    content.spe = 0;
                    content.owt = objectWeight(content);
                }
                else {
                    while (content.otyp === WAN_CANCELLATION) {
                        content.otyp = rndClass(WAN_LIGHT, WAN_LIGHTNING);
                        content.owt = objectWeight(content);
                    }
                }
            }
        }
        await addCreatedObjectToContainer(box, content);
    }
}
// C mkobj.c:mksobj_at().
export async function mksobj_at(otyp, x, y, init, artif) {
    return placeCreatedObject(await mksobj(otyp, init, artif), x, y);
}
// C mkobj.c:mkobj().
// Also C o_init.c:init_oclass_probs(): the per-class oc_prob totals are
// summed on demand by the roll below instead of cached per class.
export async function mkobj(oclass, artif) {
    if (oclass === RANDOM_CLASS) {
        // mkobj.c:mkobj() switches the RANDOM_CLASS reservoir in Gehennom.
        // Keep that shared constructor policy here; hellfill.lua merely asks
        // for des.object() and does not own the resulting class weights.
        const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
        const classProbs = Is_rogue_level(game.u.uz)
            ? [[12, WEAPON_CLASS], [12, ARMOR_CLASS], [22, FOOD_CLASS],
                [22, POTION_CLASS], [22, SCROLL_CLASS], [5, WAND_CLASS],
                [5, RING_CLASS]]
            : inHell ? [[20, WEAPON_CLASS], [20, ARMOR_CLASS],
                [16, FOOD_CLASS], [12, TOOL_CLASS], [10, GEM_CLASS],
                [1, POTION_CLASS], [1, SCROLL_CLASS], [8, WAND_CLASS],
                [8, RING_CLASS], [4, AMULET_CLASS]]
                : [[10, WEAPON_CLASS], [11, ARMOR_CLASS],
                    [20, FOOD_CLASS], [8, TOOL_CLASS], [7, GEM_CLASS],
                    [16, POTION_CLASS], [16, SCROLL_CLASS], [4, SPBOOK_CLASS],
                    [4, WAND_CLASS], [3, RING_CLASS], [1, AMULET_CLASS]];
        let roll = rnd(100);
        for (const [probability, cls] of classProbs) {
            roll -= probability;
            if (roll <= 0) {
                oclass = cls;
                break;
            }
        }
    }
    const excludeNovel = oclass === SPBOOK_no_NOVEL;
    const { first, last: classLast } = getObjectClassBounds(excludeNovel ? SPBOOK_CLASS : oclass);
    const last = excludeNovel ? 407 : classLast; // SPE_BLANK_PAPER
    let total = 0;
    for (let i = first; i <= last; i++)
        total += requireObjectData(objectProb, i);
    let roll = rnd(total);
    let otyp = first;
    while ((roll -= requireObjectData(objectProb, otyp)) > 0)
        otyp++;
    return await mksobj(otyp, true, artif);
}
// C mkobj.c:mkobj_at().
export async function mkobj_at(oclass, x, y, artif) {
    return placeCreatedObject(await mkobj(oclass, artif), x, y);
}
function coinStackWeight(quantity) {
    return Math.max(1, Math.trunc((quantity + 50) / 100));
}
export async function mkgold(amount, x, y, state = game) {
    // C ref: mkobj.c mkgold()
    if (amount <= 0) {
        // C ref: mkobj.c:2008-2010
        const depthVal = depth_of_level(game.u?.uz);
        const mul = rnd(Math.trunc(30 / Math.max(12 - depthVal, 2)));
        amount = 1 + rnd(level_difficulty() + 2) * mul;
    }
    const existing = state.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === GOLD_PIECE);
    if (existing) {
        existing.quan += amount;
        existing.quantity = existing.quan;
        existing.owt = coinStackWeight(existing.quan);
        return existing;
    }
    const gold = await mksobj(GOLD_PIECE, true, false);
    gold.quan = gold.quantity = amount;
    gold.owt = coinStackWeight(amount);
    return placeCreatedObject(gold, x, y, state);
}
const PM_LICHEN = 158;
const PM_LIZARD = 326;
function corpseHasNoTimer(mndx) {
    return mndx === PM_LICHEN || mndx === PM_LIZARD;
}
function corpseHasSpecialTiming(mndx) {
    return corpseHasNoTimer(mndx) || isReviver(mndx);
}
// C mkobj.c:rider_revival_time().
export function riderRevivalTime(body, retry = false) {
    const firstTurn = retry ? 3 : body.corpsenm === PM_DEATH ? 6 : 12;
    let turn = firstTurn;
    while (turn < 67 && rn2(3))
        turn++;
    return turn;
}
// C mkobj.c:start_corpse_timeout(). Troll and Rider corpses can revive;
// other corpses rot unless their creator requested zombification.
export function startCorpseTimeout(body, { zombify = false } = {}) {
    if (!body || corpseHasNoTimer(body.corpsenm))
        return;
    const species = body.corpsenm;
    if (species === undefined)
        throw new Error('Corpse timer requires a monster species');
    const rotAdjust = game.in_mklev ? 25 : 10;
    const currentMove = Math.max(game.moves ?? 1, 1);
    if (body.age == null)
        body.age = currentMove;
    const age = currentMove - body.age;
    const baseDelay = age > ROT_AGE ? rotAdjust : ROT_AGE - age;
    let kind = OBJECT_TIMER_KIND.ROT_CORPSE;
    let delay = baseDelay + rnz(rotAdjust) - rotAdjust;
    if (species >= PM_DEATH && species <= PM_FAMINE) {
        kind = OBJECT_TIMER_KIND.REVIVE_MON;
        delay = riderRevivalTime(body);
    }
    else if (MONSTER_SYMBOL[species] === 46) { // S_TROLL
        for (let turn = 2; turn <= 50; turn++) {
            if (rn2(TROLL_REVIVE_CHANCE))
                continue;
            kind = OBJECT_TIMER_KIND.REVIVE_MON;
            delay = turn;
            break;
        }
    }
    else if (zombify && zombieForm(species) !== null
        && !body.norevive) {
        kind = OBJECT_TIMER_KIND.ZOMBIFY_MON;
        delay = rn1(15, 5);
    }
    // start_timer() counts from svm.moves itself, which is still 0 while
    // the first level is built; only the age above uses max(moves, 1).
    scheduleObjectTimer(body, kind, (game.moves ?? 0) + delay, game);
}
// C mkobj.c:set_corpsenm().
export function set_corpsenm(otmp, pm) {
    if (!otmp)
        return;
    const existingEggTimer = otmp.otyp === EGG
        ? objectTimers(otmp).find(timer => timer.kind === OBJECT_TIMER_KIND.HATCH_EGG)
        : null;
    const remainingEggTime = existingEggTimer
        ? Math.max(0, existingEggTimer.deadline - (game.moves ?? 0))
        : 0;
    // set_corpsenm() replaces timers which depend on the object's species.
    if (otmp.otyp === EGG)
        stopObjectTimer(otmp, OBJECT_TIMER_KIND.HATCH_EGG);
    else
        stopAllObjectTimers(otmp);
    if (otmp.otyp === CORPSE && otmp.oeaten) {
        const previous = otmp.corpsenm;
        const oldNutrition = previous === undefined ? 0 : MONSTER_BODY_META[previous]?.[1] ?? 0;
        const newNutrition = MONSTER_BODY_META[pm]?.[1] ?? 0;
        if (oldNutrition <= 0)
            throw new Error('Partly eaten corpse requires its original nutrition');
        if (oldNutrition !== newNutrition)
            otmp.oeaten = Math.trunc(otmp.oeaten * newNutrition / oldNutrition);
    }
    otmp.corpsenm = pm;
    if (otmp.otyp === CORPSE) {
        startCorpseTimeout(otmp);
        otmp.owt = objectWeight(otmp);
    }
    else if (otmp.otyp === EGG) {
        if (pm >= 0 && !eggSpeciesIsDead(pm))
            attachEggHatchTimer(otmp, remainingEggTime);
    }
    else {
        if (otmp.otyp === FIGURINE
            && (otmp.where === 'inventory' || otmp.where === 'minvent'))
            attachFigurineTimer(otmp);
        otmp.owt = objectWeight(otmp);
    }
}
// C mkobj.c:mkcorpstat().  Make a corpse or statue; never returns Null.
// Generation uses an explicit square; live callers may request <0,0>, whose
// relocation (C rloco()) can run floor effects and show messages.  The
// explicit-square branch is C mksobj_at()'s body inline because it must
// forward mksobj()'s zombify option, which mksobj_at() does not take.
export async function mkcorpstat(objtyp, mtmp, pm, x, y, flags, { state = game, zombify = false, noRevive = false } = {}) {
    requireLiveGame(state);
    const init = (flags & CORPSTAT_INIT) !== 0;
    let otmp;
    if (x === 0 && y === 0) { /* special case - random placement */
        otmp = await mksobj(objtyp, init, false, { zombify });
        await relocateObjectRandomly(otmp, { state });
    }
    else {
        // Placement sees mksobj's temporary identity, not the caller's override.
        if (!isok(x, y))
            throw new RangeError('Corpstat creation needs an explicit map square');
        otmp = await mksobj(objtyp, init, false, { zombify });
        placeCreatedObject(otmp, x, y);
    }
    /* record gender and 'historic statue' in overloaded enchantment field;
       C reads gm.mkcorpstat_norevive here, which the port passes as noRevive */
    otmp.spe = flags & CORPSTAT_SPE_VAL;
    if (noRevive)
        otmp.norevive = true;
    /* when 'mtmp' is non-null save the monster's details with the
       corpse or statue; it will also force the 'pm' override below */
    if (mtmp) {
        /* save_mtraits updates otmp->oextra->omonst in place */
        otmp.oextra = {
            ...(otmp.oextra || {}),
            omonst: saveMonsterTraits(mtmp),
        };
        if (pm == null)
            pm = mtmp.mnum;
        /* don't give a revive timer to a cancelled troll's corpse */
        if (mtmp.mcan && !isRider(pm))
            otmp.norevive = true;
    }
    /* when 'pm' is non-null it comes from our caller or from 'mtmp';
       override mksobj()'s initialization of a random monster type */
    if (pm != null) {
        const oldCorpsenm = otmp.corpsenm;
        otmp.corpsenm = pm;
        otmp.owt = objectWeight(otmp);
        if (otmp.otyp === CORPSE
            && (zombify
                || corpseHasSpecialTiming(oldCorpsenm)
                || corpseHasSpecialTiming(pm))) {
            stopAllObjectTimers(otmp);
            startCorpseTimeout(otmp, { zombify });
        }
    }
    return otmp;
}
// C mkobj.c:rndmonnum().
export function rndmonnum() {
    return rndmonnumAdj(0, 0);
}
// C mkobj.c:rndmonnum_adj(). Object identities still need a species when
// no level-appropriate living monster can be generated. Its fallback
// deliberately ignores extinction and genocide, as well as difficulty.
export function rndmonnumAdj(minAdjustment = 0, maxAdjustment = 0) {
    const selected = rndmonstAdj(minAdjustment, maxAdjustment);
    if (selected != null)
        return selected;
    const G_UNIQ = 0x1000;
    const G_HELL = 0x0400;
    const G_NOHELL = 0x0800;
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const excluded = G_UNIQ | G_NOGEN | (inHell ? G_NOHELL : G_HELL);
    let species;
    do {
        species = rn2(SPECIAL_PM);
    } while (requireMonsterData(MONSTER_GENO, species) & excluded);
    return species;
}
// C mkobj.c:mk_tt_object(). Statues have no initial books; a missing score
// entry falls back to a real player role without supplying a name or gender.
export async function createToptenObject(type, x, y) {
    const object = await mksobj_at(type, x, y, type !== STATUE, false);
    if (!await nameObjectFromTopten(object)) {
        const firstRole = MONSTER_NAME.indexOf('archeologist');
        const lastRole = MONSTER_NAME.indexOf('wizard');
        set_corpsenm(object, rn1(lastRole - firstRole + 1, firstRole));
        object.owt = objectWeight(object);
    }
    return object;
}
// C mkobj.c:save_mtraits(): copy the dying monster's state into the
// corpse's stored traits, dropping live pointers and pet/shop copies kept.
export function saveMonsterTraits(monster) {
    if (!monster)
        return null;
    if (monster.ispriest)
        forgetTempleEntry(monster);
    const { minvent, inventory, mw, wormSegments, wormDetachedSegments, wormGrowTime, wormHead, lightRemoved, headOnMap, ...saved } = monster;
    saved.wormno = 0;
    saved.mhpmax = Math.max(saved.mhpmax ?? 1, (MONSTER_LEVEL[monster.mnum] ?? 0) + 1);
    saved.mhp = Math.max(0, Math.min(saved.mhp ?? 0, saved.mhpmax));
    saved.mstate = (saved.mstate ?? MON_FLOOR) & ~MON_DETACH;
    if (monster.edog)
        saved.edog = copyPetData(monster.edog);
    if (monster.mextra) {
        saved.mextra = { ...monster.mextra };
        if (monster.mextra.edog)
            saved.mextra.edog = copyPetData(monster.mextra.edog);
        if (monster.mextra.emin)
            saved.mextra.emin = { ...monster.mextra.emin };
        if (monster.mextra.epri)
            saved.mextra.epri = { ...monster.mextra.epri };
        if (monster.mextra.eshk)
            saved.mextra.eshk = copyShopkeeperData(monster.mextra.eshk);
    }
    if (monster.eshk)
        saved.eshk = copyShopkeeperData(monster.eshk);
    if (monster.emin)
        saved.emin = { ...monster.emin };
    if (monster.epri)
        saved.epri = { ...monster.epri };
    return saved;
}
// C mkobj.c dknowns[] (the class table clear_dknown() consults).
const DESCRIPTION_UNKNOWN_CLASSES = new Set([
    WEAPON_CLASS,
    RING_CLASS,
    TOOL_CLASS,
    POTION_CLASS,
    SCROLL_CLASS,
    SPBOOK_CLASS,
    WAND_CLASS,
    GEM_CLASS,
    VENOM_CLASS,
]);
// C mkobj.c:clear_dknown().
export function clearDescriptionKnowledge(object) {
    const isGlob = object.otyp >= GLOB_OF_GRAY_OOZE
        && object.otyp <= GLOB_OF_BLACK_PUDDING;
    const descriptionNeedsObservation = DESCRIPTION_UNKNOWN_CLASSES.has(object.oclass)
        || (object.otyp >= ELVEN_SHIELD && object.otyp <= ORCISH_SHIELD)
        || object.otyp === SHIELD_OF_REFLECTION
        || !!objectMerge(object.otyp);
    object.dknown = isGlob || !descriptionNeedsObservation;
}
// C mkobj.c:unknow_object().
export function forgetObjectKnowledge(object) {
    clearDescriptionKnowledge(object);
    object.bknown = false;
    delete object.buc;
    object.rknown = false;
    object.cknown = false;
    object.lknown = false;
    object.tknown = false;
    object.known = !objectUsesKnown(object.otyp);
}
// ---------------------------------------------------------------------------
// Floor-object ownership and pile order.
// C refs: mkobj.c place_object(), remove_object(), splitobj(),
// obj_timer_checks(), and invent.c stackobj(), obj_extract_self().
// ---------------------------------------------------------------------------
// C mkobj.c:obj_timer_checks(): a corpse placed on (or removed from) ice
// has its rot/revive timer doubled or halved and its age adjusted.
export function updateCorpseIceTimer(body, x, y, isOnIce, state = game) {
    if (!body || body.otyp !== CORPSE)
        return false;
    const timer = objectTimers(body).find(candidate => candidate.kind === OBJECT_TIMER_KIND.ROT_CORPSE)
        || objectTimers(body).find(candidate => candidate.kind === OBJECT_TIMER_KIND.REVIVE_MON);
    if (!timer)
        return false;
    const currentMove = state.moves ?? 0;
    if (isOnIce && !body.on_ice) {
        const remaining = Math.max(0, timer.deadline - currentMove);
        stopObjectTimer(body, timer.kind);
        body.on_ice = true;
        const age = currentMove - (body.age ?? currentMove);
        body.age = currentMove - age * 2;
        scheduleObjectTimer(body, timer.kind, currentMove + remaining * 2, state);
        return true;
    }
    if (!isOnIce && body.on_ice) {
        const remaining = Math.max(0, timer.deadline - currentMove);
        stopObjectTimer(body, timer.kind);
        body.on_ice = false;
        const age = currentMove - (body.age ?? currentMove);
        body.age += Math.trunc(age / 2);
        scheduleObjectTimer(body, timer.kind, currentMove + Math.trunc(remaining / 2), state);
        return true;
    }
    return false;
}
// C mkobj.c:obj_ice_effects(). Freezing also reaches corpses already buried.
export function updateIceObjectTimersAt(x, y, state = game, { includeBuried = false } = {}) {
    const level = requireGameLevel(state);
    const onIce = isIceAt(x, y, state);
    for (const object of level.objects[x]?.[y] || [])
        updateCorpseIceTimer(object, x, y, onIce, state);
    if (includeBuried) {
        for (const object of level.buriedObjects || []) {
            if (object.ox === x && object.oy === y)
                updateCorpseIceTimer(object, x, y, onIce, state);
        }
    }
}
function assertFreeFloorObject(object) {
    if (object.where !== 'free')
        throw new Error(`floor placement requires a free object, got ${object.where}`);
}
export function placeCreatedObject(object, x, y, state = game) {
    createdObjectNoLongerHeld(object, state);
    return linkFloorObject(object, x, y, state);
}
export function placeObjectSynchronously(object, x, y, state = game) {
    assertFreeFloorObject(object);
    objectNoLongerHeldSynchronously(object, state);
    return linkFloorObject(object, x, y, state);
}
export async function placeObject(object, x, y, state = game) {
    requireLiveGame(state);
    assertFreeFloorObject(object);
    await objectNoLongerHeld(object, state);
    return linkFloorObject(object, x, y, state);
}
function linkFloorObject(object, x, y, state) {
    const level = requireGameLevel(state);
    object.ox = x;
    object.oy = y;
    object.where = 'floor';
    state._fobjSerial = (state._fobjSerial || 0) + 1;
    object._fobjOrder = state._fobjSerial;
    const column = level.objects[x] ||= [];
    const pile = column[y] ||= [];
    // C mkobj.c:place_object() reads the pile top before linking, and a
    // boulder only joins the vision blocker table when that top is not
    // already a boulder: stacking a second boulder changes nothing for
    // sight, so the deferred vision recalc must not be requested either.
    const pileTopWasBoulder = pile[0]?.otyp === BOULDER;
    let index = 0;
    if (object.otyp !== BOULDER)
        while (pile[index]?.otyp === BOULDER)
            index++;
    pile.splice(index, 0, object);
    if (object.otyp === BOULDER && !pileTopWasBoulder && state === game)
        block_point(x, y);
    if (object.no_charge && !costlySpot(x, y, state)
        && !costlyAdjacent(findObjectOwner(object, x, y, state), x, y, state))
        object.no_charge = false;
    updateCorpseIceTimer(object, x, y, isIceAt(x, y, state), state);
    return object;
}
// C zap.c:bhitpile() and muse.c:fhito_loc() save each successor before
// applying the effect. Fracturing can reinsert rocks below another boulder,
// so the same ray may reach those rocks again. Returning false stops the sweep.
export async function sweepFloorPile(x, y, state, visit) {
    const level = requireGameLevel(state);
    let current = level.objects[x]?.[y]?.[0];
    while (current) {
        const pile = level.objects[x]?.[y] ?? [];
        const index = pile.indexOf(current);
        // Extraction clears C's nexthere link, ending this traversal if
        // an earlier effect also removed the saved successor.
        if (index < 0)
            return;
        const next = pile[index + 1];
        if (current.where === 'floor' && current.ox === x && current.oy === y) {
            if (!await visit(current))
                return;
        }
        current = next;
    }
}
export async function stack_object(object, state = game) {
    if (!object)
        return object;
    const pile = state.level?.objects?.[object.ox]?.[object.oy];
    if (!pile)
        return object;
    const existing = pile.find(candidate => candidate !== object && mergable(object, candidate, state));
    if (!existing)
        return object;
    return await mergeObjectStacks(object, existing, state) || object;
}
export function remove_object(object, state = game) {
    if (!object || !state.level)
        return object;
    const pile = state.level.objects?.[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    if (pile && index >= 0)
        pile.splice(index, 1);
    if (object.otyp === BOULDER && state === game)
        vision_note_blocker_change(object.ox, object.oy);
    object.where = 'free';
    updateCorpseIceTimer(object, object.ox, object.oy, false, state);
    return object;
}
export function detachFloorObjectUnit(object, state) {
    const quantity = objectQuantity(object);
    if (quantity <= 1) {
        remove_object(object, state);
        return object;
    }
    const detached = splitObjectStack(object, 1, state);
    if (!detached)
        throw new Error(`Object ${object.o_id} cannot split into floor units`);
    return remove_object(detached, state);
}
// C mkobj.c:add_to_minv(). Acquisition effects belong to mpickobj, not raw
// linkage.
function linkMonsterObject(monster, object, inventory, atFront) {
    if (atFront)
        inventory.unshift(object);
    else
        inventory.push(object);
    monster.minvent = monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.where = 'minvent';
    object.ocarry = monster;
    // C add_to_minv leaves the former floor coordinates unchanged.
    object.carrierMid = monster.m_id ?? null;
    return object;
}
export async function linkObjectToMonsterInventory(monster, object, { atFront = true, state = game } = {}) {
    requireLiveGame(state);
    if (!monster || !object)
        return null;
    if (object.where !== 'free')
        throw new Error('add_to_minv requires a free object');
    const inventory = monster.minvent || monster.inventory || [];
    const existing = inventory.find(candidate => mergable(candidate, object, state));
    return existing ? await mergeObjectStacks(existing, object, state)
        : linkMonsterObject(monster, object, inventory, atFront);
}
export async function linkCreatedObjectToMonsterInventory(monster, object, { atFront = true, state = game } = {}) {
    assertCreatedObject(object, state);
    const inventory = monster.minvent || monster.inventory || [];
    const existing = inventory.find(candidate => mergable(candidate, object, state));
    return existing ? await mergeCreatedObjectStacks(existing, object, state)
        : linkMonsterObject(monster, object, inventory, atFront);
}
// C mkobj.c:obj_extract_self(): only unlink the object. Worn items must go
// through removeObjectFromMonsterInventory() to update the monster and its
// equipment.
export function unlinkMonsterObject(monster, object) {
    if (!monster || !object)
        return false;
    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(object);
    if (index < 0)
        return false;
    inventory.splice(index, 1);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.ocarry = null;
    delete object.carrierMid;
    object.where = 'free';
    return true;
}
// C mkobj.c:discard_minvent().
export async function discardMonsterInventory(monster, uncreateArtifacts, state = game, { publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const discarded = [];
    for (;;) {
        const object = (monster.minvent || monster.inventory || [])[0];
        if (!object)
            break;
        if (!await removeObjectFromMonsterInventory(monster, object, state, {
            silently: true, publish,
        }))
            return discarded;
        if (uncreateArtifacts && object.oartifact)
            uncreateArtifact(object, state);
        await deleteObject(object, state);
        discarded.push(object);
    }
    return discarded;
}
export function unlinkObject(object, state = game) {
    if (object.where === 'floor') {
        remove_object(object, state);
    }
    else if (object.where === 'contained') {
        let parent = object.container?.contents?.includes(object)
            ? object.container
            : objectsInTimerGraph(state).find((candidate) => candidate !== object && candidate.contents?.includes(object));
        if (parent?.contents)
            parent.contents = parent.contents.filter((item) => item !== object);
        const updated = new Set();
        while (parent && !updated.has(parent)) {
            updated.add(parent);
            parent.owt = objectWeight(parent);
            parent = parent.container ?? undefined;
        }
    }
    else if (object.where === 'inventory') {
        state.inventory = state.inventory.filter((item) => item !== object);
    }
    else if (object.where === 'buried') {
        if (!state.level?.buriedObjects)
            throw new Error(`Buried object ${object.o_id} has no burial list`);
        state.level.buriedObjects = state.level.buriedObjects.filter((item) => item !== object);
    }
    else if (object.where === 'onbill') {
        if (!state.billObjects)
            throw new Error(`Billed object ${object.o_id} has no bill list`);
        state.billObjects = state.billObjects.filter((item) => item !== object);
    }
    else if (object.where === 'migrating') {
        if (!state.migratingObjects)
            throw new Error(`Migrating object ${object.o_id} has no migration list`);
        state.migratingObjects = state.migratingObjects.filter((item) => item !== object);
    }
    else if (object.where === 'minvent') {
        const carrier = object.ocarry;
        if (!carrier)
            throw new Error(`Monster-carried object ${object.o_id} has no owner`);
        unlinkMonsterObject(carrier, object);
    }
    object.where = 'free';
    object.buried = false;
    object.container = null;
    object.ocarry = null;
    delete object.carrierMid;
    return object;
}
// The chain that holds an object, for linking a neighbor beside it. Free
// objects have none.
function ownerChain(object, state) {
    switch (object.where) {
        case 'free':
            return null;
        case 'inventory':
            return state.inventory;
        case 'floor':
            return state.level?.objects[object.ox]?.[object.oy];
        case 'contained':
            return (object.container ?? objectsInTimerGraph(state).find((candidate) => candidate.contents?.includes(object)))?.contents;
        case 'minvent': {
            const owner = object.ocarry;
            if (!owner)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            return owner.minvent || owner.inventory;
        }
        case 'buried':
            return state.level?.buriedObjects;
        case 'migrating':
            return state.migratingObjects;
        case 'onbill':
            return state.billObjects;
        case 'gone':
            throw new Error(`Object ${object.o_id} is gone`);
    }
}
// C mkobj.c:splitobj() links the new piece right after the original in
// whatever chain owns it (nobj, and nexthere on the floor), so the piece
// stays where the original is until a caller extracts it.
export function linkObjectAfter(object, next, state = game) {
    if (object.where === 'free')
        return;
    const chain = ownerChain(object, state);
    const index = chain?.indexOf(object) ?? -1;
    if (!chain || index < 0)
        throw new Error(`Object ${object.o_id} is missing from its ${object.where} chain`);
    chain.splice(index + 1, 0, next);
}
// C mkobj.c:replace_object(). Keep the owner's order without pickup,
// dropping, merging, or transferring the old object's timers.
export function replaceObject(object, replacement, state = game) {
    if (replacement.where !== 'free')
        throw new Error('object replacement requires a free new object');
    const where = object.where;
    let chain;
    switch (where) {
        case 'free':
            break;
        case 'inventory':
            chain = state.inventory;
            break;
        case 'floor':
            if (!state.level)
                throw new Error('Floor object replacement requires a level');
            chain = state.level.objects[object.ox]?.[object.oy] ?? undefined;
            replacement.ox = object.ox;
            replacement.oy = object.oy;
            if (object._fobjOrder !== undefined)
                replacement._fobjOrder = object._fobjOrder;
            else
                delete replacement._fobjOrder;
            break;
        case 'contained': {
            const owner = object.container ||
                objectsInTimerGraph(state).find((candidate) => candidate.contents?.includes(object));
            chain = owner?.contents;
            replacement.container = owner ?? null;
            break;
        }
        case 'minvent': {
            const owner = object.ocarry;
            if (!owner)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            chain = owner.minvent || owner.inventory;
            replacement.ocarry = owner;
            replacement.carrierMid = owner.m_id;
            break;
        }
        case 'buried':
        case 'gone':
        case 'migrating':
        case 'onbill':
        default:
            throw new Error(`replace_object: unsupported object position ${where}`);
    }
    if (where !== 'free') {
        const index = chain?.indexOf(object) ?? -1;
        if (!chain || index < 0)
            throw new Error(`replace_object: object missing from ${where}`);
        chain[index] = replacement;
    }
    replacement.where = where;
    object.where = 'free';
    object.container = null;
    object.ocarry = null;
    delete object.carrierMid;
}
// C mkobj.c:dealloc_obj(). Billing, inventory release and meal cleanup
// belong to callers; raw absorption must not perform obfree() bookkeeping.
export function deallocateObject(object, state = game) {
    requireLiveGame(state);
    if (object.where === 'gone')
        return false;
    if (object.where !== 'free' || object.contents?.length)
        throw new Error('dealloc_obj requires a free object without contents');
    if (object.timed)
        stopObjectTimers(object, state);
    if (objectShedsLight(object))
        state.vision_full_recalc = 1;
    const latest = state.context.objsplit;
    if (latest && (object.o_id === latest.parent_oid || object.o_id === latest.child_oid)) {
        latest.parent_oid = latest.child_oid = 0;
    }
    object.where = 'gone';
    object.container = null;
    object.ocarry = null;
    object.ox = 0;
    object.oy = 0;
    object.lamplit = false;
    object.buried = false;
    delete object.carrierMid;
    return true;
}
// Shared head of C mkobj.c:mksobj() (newobj(), zeroobj, age, o_id, quan,
// and unknow_object()'s dknown/known defaults): the bones tests and hero
// gold construct plain objects through it too.  Identity allocation belongs
// to the caller; initializing these fields draws no random numbers and does
// not run class-specific creation effects.
export function createObjectBase(otyp, objectId, currentTurn) {
    const definition = getObjectDefinition(otyp);
    const oclass = definition.oclass;
    const pudding = otyp >= GLOB_OF_GRAY_OOZE && otyp <= GLOB_OF_BLACK_PUDDING;
    const dknown = pudding || !DESCRIPTION_UNKNOWN_CLASSES.has(oclass)
        && !(otyp >= ELVEN_SHIELD && otyp <= ORCISH_SHIELD)
        && otyp !== SHIELD_OF_REFLECTION && !definition.merge;
    return {
        otyp,
        oclass,
        o_id: objectId,
        ox: 0,
        oy: 0,
        quan: 1,
        where: 'free',
        age: Math.max(currentTurn, 1),
        owt: definition.weight,
        dknown,
        known: !definition.usesKnown,
        cursed: false,
        blessed: false,
        olocked: false,
        spe: 0,
        recharged: 0,
        artifact: false,
    };
}
// Object ownership inside containers.
// C ref: mkobj.c:add_to_container().
function assertFreeObject(object) {
    if (object.where !== 'free')
        throw new Error(`add_to_container requires a free object, got ${object.where}`);
}
function containerStack(container, object, state) {
    container.contents ||= [];
    return container.contents.find(candidate => mergable(candidate, object, state));
}
function linkContainerObject(container, object) {
    object.where = 'contained';
    object.container = container;
    // C add_to_container() leaves ox/oy untouched, so an object taken from
    // the floor keeps its last square while inside the container.
    (container.contents ||= []).unshift(object);
    return object;
}
// C add_to_container(): the IMMEDIATE container's state decides the
// release - an inventory- or monster-held container keeps the addition
// held; any other container first releases the object. The release is
// async because it can charge a free incoming unpaid crysknife before
// the link.
export async function addObjectToContainer(container, object, state = game) {
    requireLiveGame(state);
    if (!container || !object)
        return object;
    assertFreeObject(object);
    if (container.where !== 'inventory' && container.where !== 'minvent') {
        await objectNoLongerHeld(object, state);
    }
    const existing = containerStack(container, object, state);
    return existing ? await mergeObjectStacks(existing, object, state)
        : linkContainerObject(container, object);
}
// Constructor graphs cannot own a display continuation. The merge boundary
// also verifies that no billed or worn object reaches this synchronous path.
export async function addCreatedObjectToContainer(container, object, state = game) {
    if (!container || !object)
        return object;
    assertFreeObject(object);
    if (container.where !== 'inventory' && container.where !== 'minvent') {
        createdObjectNoLongerHeld(object, state);
    }
    else {
        assertCreatedObject(object, state);
    }
    const existing = containerStack(container, object, state);
    return existing ? await mergeCreatedObjectStacks(existing, object, state)
        : linkContainerObject(container, object);
}
export const CONTAINER_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, BAG_OF_HOLDING, OILSKIN_SACK, BAG_OF_TRICKS,
]);
export function isContainer(object) {
    return !!object && CONTAINER_TYPES.has(object.otyp);
}
// C mkobj.c:container_weight().  Update the container's weight, then every
// enclosing container's, recursively (C recurses through ocontainer; the
// timer-graph lookup covers restored states whose back-link was not saved).
export function containerWeight(object, state = game) {
    object.owt = objectWeight(object);
    if (object.where === 'contained') {
        const parent = parentContainer(object, state);
        if (parent)
            containerWeight(parent, state);
    }
}
// C unsplitobj(): a failed merge leaves the split piece beside its parent.
export async function restoreRejectedSplit(transfer, state) {
    if (transfer.parent)
        await rejoinObjectStack(transfer.parent, transfer.object, state);
}
// C mkobj.c:hornoplenty(), for doapply's one-charge use.
export async function useHornOfPlenty(horn, { tipping = false, target = null, } = {}) {
    requirePlayingGame(game);
    if (horn.spe < 1) {
        await pline('Nothing happens.');
        horn.cknown = true;
        return 0;
    }
    await consumeObjectCharge(horn, { maybeUnpaid: !tipping });
    let object;
    let what;
    if (!rn2(13)) {
        object = await mkobj(POTION_CLASS, false);
        if (objectMagic(object.otyp)) {
            do {
                object.otyp = rndClass(POT_BOOZE, POT_WATER);
            } while (object.otyp === POT_SICKNESS);
            if (object.otyp === POT_OIL)
                object.age = MAX_OIL_IN_FLASK;
        }
        what = object.quan > 1 ? 'Some potions spill' : 'A potion spills';
    }
    else {
        object = await mkobj(FOOD_CLASS, false);
        if (object.otyp === FOOD_RATION && !rn2(7))
            object.otyp = LUMP_OF_ROYAL_JELLY;
        what = 'Some food spills';
    }
    await pline(`${what} out.`);
    object.blessed = horn.blessed;
    object.cursed = horn.cursed;
    object.owt = objectWeight(object);
    if (horn.unpaid)
        await addShopObjectToBill(object, game, { ininv: false, silent: tipping });
    const previousPriceSuppression = game.iflags.suppress_price;
    game.iflags.suppress_price = true;
    try {
        const terrain = game.level.requireAt(game.u.ux, game.u.uy).typ;
        if (!tipping) {
            observeObjectForNaming(object);
            const name = object.quan > 1 ? `${object.quan} ${makePlural(objectName(object, game))}` : objectName(object, game);
            const action = `The ${name} ${object.quan > 1 ? 'slip' : 'slips'}`;
            let destination = 'to the floor';
            if (game.u.uswallow)
                destination = 'out of your reach';
            else if (Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz) || terrain < IRONBARS || terrain >= ICE)
                destination = 'away from you';
            await holdAnotherObject(object, { dropMessage: `Oops!  ${action} ${destination}!` });
        }
        else if (target) {
            await addObjectToContainer(target, object);
            target.owt = objectWeight(target);
            if (target.where === 'inventory')
                await encumber_msg();
        }
        else if (!heroCanReachFloor(game, { checkPit: true })) {
            await hitFloorWithObject(object);
        }
        else {
            if (terrain === ALTAR)
                await landObjectOnAltar(object);
            else {
                observeObjectForNaming(object);
                const description = await inventoryItemDescription(object);
                await pline(`${description.charAt(0).toUpperCase()}${description.slice(1)} ${object.quan === 1 ? 'drops' : 'drop'} to the ${surfaceName(game.u.ux, game.u.uy)}.`);
            }
            await dropObjectAtHero(object);
        }
    }
    finally {
        if (previousPriceSuppression === undefined)
            delete game.iflags.suppress_price;
        else
            game.iflags.suppress_price = previousPriceSuppression;
    }
    if (horn.dknown)
        learnObjectType(HORN_OF_PLENTY, game);
    return 1;
}
// ---------------------------------------------------------------------------
// Splitting one quantity from an ordinary object stack.
// C refs: mkobj.c splitobj()/unsplitobj().
// ---------------------------------------------------------------------------
export function objectQuantity(object) {
    if (!object)
        return 0;
    return Math.max(0, Math.trunc(object.quan ?? object.quantity ?? 1));
}
function setQuantity(object, count) {
    object.quan = object.quantity = count;
    object.owt = objectWeight(object);
}
// C mkobj.c:splitobj(): split one stack into two.
// Also C mkobj.c:copy_oextra(): inlined here (the split keeps the parent's
// extensions minus the m-id association).
export function splitObjectStack(object, count, state = game, objectId = null) {
    const total = objectQuantity(object);
    count = Math.trunc(count);
    if (!object || object.contents?.length || count <= 0 || count >= total)
        return null;
    const split = {
        ...object,
        contents: [],
        objectTimers: [],
        timed: 0,
        lamplit: false,
        owornmask: 0,
        worn: false,
        wornSlot: null,
        wielded: false,
        alternate: false,
        ready: false,
        pickup_prev: false,
        lua_ref_cnt: 0,
    };
    if (object.oextra) {
        split.oextra = structuredClone(object.oextra);
        delete split.oextra.omid;
    }
    split.o_id = objectId ?? nextObjectId(object, split, state);
    setQuantity(object, total - count);
    setQuantity(split, count);
    state.context.objsplit = { parent_oid: object.o_id, child_oid: split.o_id };
    linkObjectAfter(object, split, state);
    // C mkobj.c:494 splitobj(): an unpaid stack's bill follows the split.
    if (object.unpaid)
        splitObjectBill(object, split, state);
    copyObjectTimers(object, split, state);
    // splitobj() copies an active light source after copying its timers.
    // Each resulting candle stack has its own quantity-dependent radius, and
    // obj_split_light_source() inserts the copy at the head of light_base,
    // so the split-off stack owns the newer light source.
    if (objectShedsLight(object)) {
        split.lamplit = true;
        state._lightSerial = (state._lightSerial ?? 0) + 1;
        split._litSeq = state._lightSerial;
        if (object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE)
            state.vision_full_recalc = 1;
    }
    return split;
}
// ---------------------------------------------------------------------------
// Shared object and monster identity allocation.
// C ref: mkobj.c next_ident().
// ---------------------------------------------------------------------------
// Object and monster identities share one counter.  Every source call must
// pass through this boundary even when its caller only needs the RNG-visible
// side effect and does not retain the returned id yet.
export function nextIdent(state = game) {
    const ident = (typeof state._nextIdent === 'number' && Number.isInteger(state._nextIdent) ? state._nextIdent : 2) >>> 0;
    state._nextIdent = (ident + rnd(2)) >>> 0;
    if (!state._nextIdent)
        state._nextIdent = rnd(2) + 1;
    return ident;
}
// C mkobj.c nextoid(): a split or bill copy keeps the old price adjustment.
export function nextObjectId(oldObject, newObject, state = game) {
    const oldAdjustment = objectPriceAdjustment(oldObject, oldObject.o_id, state);
    let ident = (((state._nextIdent ?? 2) >>> 0) - 1) >>> 0;
    let tries = 256;
    do {
        ident = (ident + 1) >>> 0;
        if (!ident)
            ident = 1;
    } while (objectPriceAdjustment(newObject, ident, state) !== oldAdjustment
        && --tries >= 0);
    state._nextIdent = ident;
    nextIdent(state);
    return ident;
}
// C mkobj.c:unsplitobj(): floor, free, billed, buried, and migrating chains
// never rejoin; the caller knows both halves, which must share one carried,
// monster-carried, or contained chain (C walks obj->nobj lists here).
export async function rejoinObjectStack(parent, split, state = game) {
    const latest = state.context.objsplit;
    if (latest?.parent_oid !== parent.o_id || latest.child_oid !== split.o_id)
        return null;
    if (split.where !== 'inventory' && split.where !== 'minvent'
        && split.where !== 'contained')
        return null;
    if (!ownerChain(split, state)?.includes(parent))
        return null;
    return await mergeObjectStacks(parent, split, state);
}
export function clearSplitObjects(state = game) {
    state.context.objsplit = { parent_oid: 0, child_oid: 0 };
}
// ---------------------------------------------------------------------------
// Glob absorption. C ref: mkobj.c obj_absorb().
// ---------------------------------------------------------------------------
function combineGlobMatter(survivor, incoming, state) {
    const firstWeight = survivor.oeaten || survivor.owt;
    const secondWeight = incoming.oeaten || incoming.owt;
    const totalWeight = firstWeight + secondWeight;
    const moves = state.moves;
    if (!!survivor.bknown !== !!incoming.bknown)
        survivor.bknown = incoming.bknown = false;
    if (!!survivor.rknown !== !!incoming.rknown)
        survivor.rknown = incoming.rknown = false;
    if (!!survivor.greased !== !!incoming.greased)
        survivor.greased = incoming.greased = false;
    if (survivor.orotten || incoming.orotten)
        survivor.orotten = incoming.orotten = true;
    const relativeAge = Math.trunc(((moves - survivor.age) * firstWeight
        + (moves - incoming.age) * secondWeight) / totalWeight);
    survivor.age = moves - relativeAge;
    survivor.owt += secondWeight;
    if (survivor.oeaten || incoming.oeaten)
        survivor.oeaten = totalWeight;
    survivor.quan = survivor.quantity = 1;
    const first = stopObjectTimer(survivor, OBJECT_TIMER_KIND.SHRINK_GLOB);
    const second = stopObjectTimer(incoming, OBJECT_TIMER_KIND.SHRINK_GLOB);
    const firstDelay = first ? first.deadline - moves : 0;
    const secondDelay = second ? second.deadline - moves : 0;
    const delay = Math.trunc(((firstDelay || 25) + (secondDelay || 25) + 1) / 2);
    startGlobTimeout(survivor, state, moves, delay);
}
// C obj_absorb(), distinct from merged(): billing precedes all changes,
// then raw deallocation skips ordinary name, knowledge and bill folding.
export async function absorbGlob(survivor, incoming, state = game, { publish = plineWithContinuation } = {}) {
    await settleGlobAbsorptionBilling(survivor, incoming, state, { publish });
    combineGlobMatter(survivor, incoming, state);
    unlinkObject(incoming, state);
    deallocateObject(incoming, state);
    return survivor;
}
function isGlobType(otyp) {
    return otyp >= GLOB_OF_GRAY_OOZE && otyp <= GLOB_OF_BLACK_PUDDING;
}
// C mkobj.c:obj_nexto_xy(): the next mergable glob on this square or an
// adjacent one (obj_nexto() is the same scan at the glob's own square).
function nearbyMergableGlob(glob, x, y, state, random) {
    // The same-type pile scan of C invent.c:sobj_at() inlined: the
    // mergable() test itself finds the candidate.
    const findAt = (nx, ny) => (state.level?.objects?.[nx]?.[ny] || [])
        .find(object => object !== glob && mergable(object, glob, state));
    const onSameSquare = findAt(x, y);
    if (onSameSquare)
        return onSameSquare;
    const xStep = random(2) ? -1 : 1;
    const yStep = random(2) ? -1 : 1;
    for (let nx = x - xStep; Math.abs(nx - x) < 2; nx += xStep) {
        for (let ny = y - yStep; Math.abs(ny - y) < 2; ny += yStep) {
            if (!isok(nx, ny) || (nx === x && ny === y))
                continue;
            const nearby = findAt(nx, ny);
            if (nearby)
                return nearby;
        }
    }
    return null;
}
// C pudding_merge_message(): inventory merging remains noticeable while
// blind; visible monster/container merges can intentionally say nothing.
export async function announceGlobMerge(first, second, state = game, publish = plineWithContinuation) {
    const visible = cansee(first.ox, first.oy) || cansee(second.ox, second.oy);
    const onFloor = first.where === 'floor' || second.where === 'floor';
    const inPack = first.where === 'inventory' || second.where === 'inventory';
    if ((!heroIsBlind(state) && visible) || inPack) {
        if (heroIsHallucinating(state)) {
            if (onFloor)
                await publish(formatSeenMessage('parts of the floor melting!', state));
            else if (inPack)
                await publish('Your pack reaches out and grabs something!');
        }
        else if (onFloor || inPack) {
            const adjacent = (first.ox !== state.u.ux || first.oy !== state.u.uy)
                && (second.ox !== state.u.ux || second.oy !== state.u.uy);
            await publish(`The ${onFloor && adjacent ? 'adjacent ' : ''}${makePlural(objectTypeName(first.otyp, state))} coalesce${inPack ? ' inside your pack' : ''}.`);
        }
    }
    else {
        const heard = formatHeardMessage('a faint sloshing sound.', state);
        if (heard)
            await publish(heard);
    }
}
// C flooreffects()/obj_meld(): a free glob is always absorbed by a floor
// glob, even when the landing glob is heavier. Otherwise it remains free.
export async function meldLandingGlob(glob, x, y, { state = game, publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const nearby = nearbyMergableGlob(glob, x, y, state, random);
    if (!nearby)
        return null;
    await announceGlobMerge(glob, nearby, state, publish);
    return await absorbGlob(nearby, glob, state, { publish });
}
export async function meldNearbyFloorGlobs(glob, { state = game, publish = plineWithContinuation, random = rn2, } = {}) {
    let combined = glob;
    for (;;) {
        const nearby = nearbyMergableGlob(combined, combined.ox, combined.oy, state, random);
        if (!nearby)
            return combined;
        await announceGlobMerge(combined, nearby, state, publish);
        const equalWeight = combined.owt === nearby.owt;
        const combinedSurvives = combined.owt > nearby.owt
            || (equalWeight && random(2) !== 0);
        const survivor = combinedSurvives ? combined : nearby;
        const absorbed = combinedSurvives ? nearby : combined;
        const oldX = absorbed.ox;
        const oldY = absorbed.oy;
        combined = await absorbGlob(survivor, absorbed, state, { publish });
        if (state === game && cansee(oldX, oldY))
            await newsym(oldX, oldY);
        await maybeUnhideAt(oldX, oldY, state);
    }
}
function scheduleNextGlobAttempt(glob, state, currentTurn, delay = 0) {
    stopObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB);
    const turns = delay > 0 ? delay : 23 + rn2(5);
    return scheduleObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB, currentTurn + turns, state);
}
export function startGlobTimeout(glob, state = game, currentTurn = state.moves ?? 0, delay = 0) {
    return scheduleNextGlobAttempt(glob, state, currentTurn, delay);
}
function parentContainer(object, state) {
    if (object.container)
        return object.container;
    return objectsInTimerGraph(state).find(candidate => candidate !== object && candidate.contents?.includes(object)) ?? null;
}
function carryingMonster(object, state) {
    if (object.ocarry)
        return object.ocarry;
    return (state.level?.monsters || []).find(monster => monster.m_id === object.carrierMid
        || (monster.minvent || monster.inventory || []).includes(object)) ?? null;
}
function outermostContainer(object, state) {
    let outer = object;
    const seen = new Set();
    while (outer?.where === 'contained' && !seen.has(outer)) {
        seen.add(outer);
        const parent = parentContainer(outer, state);
        if (!parent)
            break;
        outer = parent;
    }
    return outer;
}
function objectLocation(object, state) {
    const outer = outermostContainer(object, state);
    if (!outer)
        return null;
    if (outer.where === 'floor' || outer.where === 'buried')
        return { x: outer.ox, y: outer.oy };
    if (outer.where === 'inventory')
        return { x: state.u?.ux, y: state.u?.uy };
    if (outer.where === 'minvent') {
        const monster = carryingMonster(outer, state);
        if (monster)
            return { x: monster.mx, y: monster.my };
    }
    return null;
}
// C mkobj.c:item_on_ice(): the outermost container decides whether a glob
// sits on ice or is buried beneath it.
function globIceState(glob, state) {
    const outer = outermostContainer(glob, state);
    if (!outer || !['floor', 'buried'].includes(outer.where))
        return 'none';
    // C mkobj.c get_obj_location(): the outermost container's own square.
    if (!isIceAt(outer.ox, outer.oy, state))
        return 'none';
    return outer.where === 'buried' ? 'buried' : 'on-ice';
}
function clearHeroEquipment(object, state) {
    const slots = [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ];
    let removed = !!(object.owornmask || object.worn || object.wielded
        || object.alternate || object.ready);
    for (const slot of slots) {
        if (state[slot] === object) {
            state[slot] = null;
            removed = true;
        }
        if (state.u?.[slot] === object) {
            state.u[slot] = null;
            removed = true;
        }
    }
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    // C stop_occupation(): a worn glob vanishing interrupts the occupation.
    if (removed)
        state._occupation = null;
}
// C mkobj.c:shrinking_glob_gone(): a glob that shrank away to nothing
// unwields/unwears itself and is removed from wherever it lives.
async function deleteGlob(glob, state) {
    const where = glob.where;
    const x = glob.ox, y = glob.oy;
    if (where === 'inventory') {
        clearHeroEquipment(glob, state);
    }
    else if (where === 'migrating') {
        glob.owornmask = 0;
    }
    else if (where === 'minvent' && glob.ocarry?.mw === glob) {
        glob.ocarry.mw = null;
        glob.owornmask = 0;
    }
    unlinkObject(glob, state);
    if (where === 'floor')
        await maybeUnhideAt(x, y, state);
    if (state.context.victual?.piece === glob)
        state.context.victual = null;
    // obfree() retains a consumed shop object for itemized billing.
    if (reconcileObjectDeletionBill(glob, null, state) === 'retained')
        return;
    deallocateObject(glob, state);
}
// shrink_glob() asks xname to include partly eaten food before reducing its mass.
function shrinkingGlobName(glob, state) {
    const previous = state.iflags.partly_eaten_hack;
    state.iflags.partly_eaten_hack = true;
    try {
        return ownedObjectName(glob, state);
    }
    finally {
        if (previous === undefined)
            delete state.iflags.partly_eaten_hack;
        else
            state.iflags.partly_eaten_hack = previous;
    }
}
export async function runClaimedGlobTimer(claimed, state = game, currentTurn = state.moves ?? 0) {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.SHRINK_GLOB)
        return null;
    const glob = claimed.object;
    if (!glob?.globby || !isGlobType(glob.otyp)) {
        throw new Error('SHRINK_GLOB requires a live glob');
    }
    if (!Number.isInteger(glob.owt) || glob.owt < 0)
        throw new Error('SHRINK_GLOB requires a nonnegative weight');
    const where = glob.where;
    const inInventory = where === 'inventory';
    const container = where === 'contained'
        ? parentContainer(glob, state) : null;
    const outer = container ? outermostContainer(glob, state) : glob;
    const containerInInventory = !!container && outer?.where === 'inventory';
    const updatesHeroInventory = inInventory || containerInInventory;
    const carrier = where === 'minvent'
        ? carryingMonster(glob, state) : null;
    const location = objectLocation(glob, state);
    const x = location?.x ?? 0;
    const y = location?.y ?? 0;
    const ice = globIceState(glob, state);
    const oldCapacity = state._encumbranceLevel ?? 0;
    const deadline = claimed.timer.deadline;
    if (deadline < currentTurn && ice !== 'buried') {
        const missedShrinks = Math.trunc((currentTurn - deadline + 24) / 25);
        const delay = 25 - (missedShrinks % 25);
        const delta = ice === 'on-ice'
            ? Math.trunc((missedShrinks + 2) / 3)
            : missedShrinks;
        if (delta >= glob.owt) {
            glob.owt = 0;
            await deleteGlob(glob, state);
            return {
                glob, x, y, overdue: true, delta,
                gone: true, message: null,
            };
        }
        glob.owt -= delta;
        if (container)
            containerWeight(container, state);
        scheduleNextGlobAttempt(glob, state, currentTurn, delay);
        return {
            glob, x, y, overdue: true, delta, delay,
            gone: false, message: null,
        };
    }
    const beingEaten = eating_glob(glob, state);
    const waitsOnIce = ice === 'buried'
        || (ice === 'on-ice' && currentTurn % 3 === 1);
    if (beingEaten || waitsOnIce) {
        scheduleNextGlobAttempt(glob, state, currentTurn);
        return {
            glob, x, y, overdue: false,
            skippedEating: beingEaten,
            skippedIce: waitsOnIce,
            delta: 0, gone: false, message: null,
        };
    }
    const name = shrinkingGlobName(glob, state);
    const oldTopWeight = containerInInventory ? objectWeight(outer) : null;
    const shrinkThreshold = glob.owt > 0 && glob.owt % 10 === 0;
    if (glob.owt > 0) {
        glob.owt--;
        if ((glob.oeaten ?? 0) > 1)
            glob.oeaten = (glob.oeaten ?? 0) - 1;
    }
    const gone = glob.owt === 0;
    if (container)
        containerWeight(container, state);
    let message = null;
    if (inInventory && (shrinkThreshold || gone)) {
        message = `${name} ${gone ? 'dissolves completely' : 'shrinks'}.`;
    }
    else if (containerInInventory) {
        const newTopWeight = outer.owt;
        const newCapacity = nearCapacity(state);
        if (gone
            || (shrinkThreshold && newTopWeight !== oldTopWeight)
            || newCapacity !== oldCapacity) {
            const change = newTopWeight !== oldTopWeight
                ? 'becomes' : 'seems';
            message = `${ownedObjectName(outer, state)} ${change}${gone ? '' : ' slightly'} lighter.`;
        }
    }
    if (updatesHeroInventory) {
        return {
            glob, x, y, carrier, overdue: false, delta: 1,
            shrinkThreshold, gone, message,
            finishPending: true,
        };
    }
    if (gone) {
        const visible = where === 'floor' && cansee(x, y);
        await deleteGlob(glob, state);
        if (visible) {
            await newsym(x, y);
            const subject = x !== state.u.ux || y !== state.u.uy
                ? name.replace(/^The /u, 'A ') : name;
            message = `${subject} fades away.`;
        }
    }
    else {
        scheduleNextGlobAttempt(glob, state, currentTurn);
    }
    return {
        glob, x, y, carrier, overdue: false, delta: 1,
        shrinkThreshold, gone, message,
    };
}
export async function finishGlobTimer(event, state = game, currentTurn = state.moves ?? 0, publish = plineWithContinuation) {
    if (!event?.finishPending || !event.glob)
        return event;
    if (event.gone)
        await deleteGlob(event.glob, state);
    else
        scheduleNextGlobAttempt(event.glob, state, currentTurn);
    event.finishPending = false;
    event.finished = true;
    await encumber_msg(state, publish);
    return event;
}
const TREE_FRUITS = [APPLE, ORANGE, PEAR, BANANA, EUCALYPTUS_LEAF];
// C mkobj.c:rnd_treefruit_at(): mksobj_at(ROLL_FROM(treefruits), ...).
// Moved from hero_digging.js (pure move); dig.c and dokick.c call this.
export async function placeTreeFruit(x, y, state = game, random = rn2) {
    const fruitType = TREE_FRUITS[random(TREE_FRUITS.length)];
    if (fruitType === undefined)
        throw new RangeError('Tree fruit selection is outside the fruit table.');
    const fruit = await mksobj(fruitType, true, false);
    placeCreatedObject(fruit, x, y, state);
}
const WEIGHTED_CONTENT_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING, STATUE,
]);
export function quantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
export function objectWeight(object) {
    if (!object)
        return 0;
    // C stores a stack's complete weight in owt.  Several early JS object
    // constructors still leave owt at the one-item metadata value after
    // changing quan, so reconstruct ordinary stack weight from the table.
    const base = objectBaseWeight(object.otyp);
    const count = quantity(object);
    if (count < 1)
        return 0;
    const species = object.corpsenm;
    const uneatenNutrition = object.oeaten ?? 0;
    // A top-level coin stack is treated specially by inv_weight(), but coin
    // inside a container reaches mkobj.c:weight() and therefore weighs at
    // least one unit even below 50 pieces.
    if (object.oclass === COIN_CLASS)
        return Math.max(1, Math.trunc((quantity(object) + 50) / 100));
    // mkobj.c:weight(): globs keep quantity one while absorption and
    // SHRINK_GLOB mutate their complete weight directly in owt.  This check
    // precedes partly-eaten food scaling because oeaten is also glob mass.
    if (object.globby)
        return object.owt ?? base ?? 0;
    if (object.otyp === CORPSE && species !== undefined
        && Number.isInteger(species) && species >= 0 && species < MONSTER_BODY_META.length) {
        const [bodyWeight = 0, nutrition = 0] = MONSTER_BODY_META[species] || [];
        const fullWeight = Math.min(LARGEST_INT, bodyWeight * count);
        if (uneatenNutrition > 0) {
            return Math.max(1, nutrition > 0
                ? Math.trunc(fullWeight * Math.min(uneatenNutrition, nutrition) / nutrition)
                : 0);
        }
        return fullWeight;
    }
    // mkobj.c:weight()->eaten_stat() scales partly eaten food by its
    // remaining nutrition per item, including stacks of partly eaten wishes.
    if (object.oclass === FOOD_CLASS && uneatenNutrition > 0 && base > 0) {
        const fullNutrition = oc_nutrition(object.otyp) ?? 0;
        if (fullNutrition > 0) {
            return Math.max(1, Math.trunc(base * count * Math.min(uneatenNutrition, fullNutrition) / fullNutrition));
        }
    }
    if (WEIGHTED_CONTENT_TYPES.has(object.otyp)) {
        let ownWeight = base || object.owt || 0;
        if (object.otyp === STATUE && species !== undefined
            && Number.isInteger(species) && species >= 0 && species < MONSTER_BODY_META.length) {
            const bodyWeight = MONSTER_BODY_META[species]?.[0] ?? 0;
            const size = MONSTER_SIZE[species] ?? 0;
            ownWeight = Math.max(Math.trunc(3 * bodyWeight / 2), (2 * size + 1) * 100) * quantity(object);
        }
        let contentsWeight = (object.contents || []).reduce((total, content) => total + objectWeight(content), 0);
        if (object.otyp === BAG_OF_HOLDING) {
            contentsWeight = object.cursed ? contentsWeight * 2
                : object.blessed ? Math.trunc((contentsWeight + 3) / 4)
                    : Math.trunc((contentsWeight + 1) / 2);
        }
        return ownWeight + contentsWeight;
    }
    if (object.otyp === HEAVY_IRON_BALL && object.owt)
        return object.owt;
    if (object.otyp === CANDELABRUM_OF_INVOCATION && object.spe)
        return (base || 0) + object.spe * objectBaseWeight(TALLOW_CANDLE);
    if (base > 0)
        return base * quantity(object);
    return Math.trunc((count + 1) / 2);
}
// C mkobj.c:is_flammable(). Candles can be burned, but they are not
// flammable in the erosion sense: they cannot get fire damage and it makes
// no sense for them to be fireproofed; fire-resistant objects and the wand
// of fire cannot burn either.
export function objectIsFlammable(object, state) {
    if (object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE)
        return false;
    if (objectPropertyName(object.otyp) === 'fireResistance'
        || object.otyp === WAN_FIRE)
        return false;
    const material = objectMaterial(object, state);
    return (material <= WOOD && material !== LIQUID) || material === PLASTIC;
}
// C mkobj.c:is_rottable().
export function objectIsRottable(object, state) {
    const material = objectMaterial(object, state);
    return (material <= WOOD && material !== LIQUID) || material === DRAGON_HIDE;
}
//# sourceMappingURL=mkobj.js.map