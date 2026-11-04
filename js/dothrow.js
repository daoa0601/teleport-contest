// dothrow.js — Throw and fire command front ends.
// C refs: dothrow.c ok_to_throw(), dothrow(), dofire(), and throw_obj()'s
// per-missile handoff to the flight owners.
import { game, requirePlayingGame, requireLiveGame, requireGameLevel, requireInitializedGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { beginCommandResult, commandResultCancelled, cmdq_add_ec, cmdq_add_key, setMulti, isok } from './cmd.js';
import { requireInitializedHero } from './hero_types.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { currentAttribute, changeHeroLuck } from './attrib.js';
import { AKLYS, BOOMERANG, BOULDER, BULLWHIP, CORPSE, EGG, OBJECT_SUBTYPE, SLING, ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EXPENSIVE_CAMERA, CRYSTAL_BALL, LENSES, MELON, MIRROR, POT_OIL, POT_WATER, STATUE, HEAVY_IRON_BALL, OBJECT_HIT_BONUS, TRIDENT, WAN_STRIKING, BAG_OF_HOLDING, BAG_OF_TRICKS, EUCALYPTUS_LEAF, FLINT, FORTUNE_COOKIE, HARD_GEM_TYPES, KELP_FROND, OBJECT_COST, OBJECT_MAGIC, OBJECT_NAMES, OILSKIN_SACK, PANCAKE, SACK, SPRIG_OF_WOLFSBANE } from './object_data.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL, monsterHatesBlessings, monsterIsBig, monsterThrowsRocks, MONSTER_BODY_META, MONSTER_NAME, monsterDigests, monsterIsWhirly, monsterTypeName } from './monster_data.js';
import { artifactById, artifactToHitBonus } from './artifacts.js';
import { heroCannotTake, heroHasNoHands, heroHatesSilver, heroSpecies, polymonHero } from './polyself.js';
import { isLauncherAmmunition, isPolearm, isWetTowel, launcherMatchesAmmo, objectIsCrackable } from './object_properties.js';
import { isWeldedPrimary, setQuiverObject, doquiverCore } from './wield.js';
import { GETOBJ_DOWNPLAY, GETOBJ_SUGGEST, A_DEX, A_STR, STR19, IS_WATERWALL, MM_IGNORELAVA, MM_IGNOREWATER, W_ARM, W_ARMC, W_ARMU, P_PICK_AXE, P_SPEAR, IS_SOFT, IS_ALTAR, CQ_CANNED, HOLE, PIT, SPIKED_PIT, TRAPDOOR, MM_NOMSG, M_AP_MONSTER, M_AP_TYPE, A_CHA, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, FIRE_TRAP, IRONBARS, IS_OBSTRUCTED, IS_STWALL, Is_airlevel, Is_waterlevel, KILLED_BY, LOST_THROWN, MAGIC_PORTAL, STONING, TREE, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_WEB, Upolyd, VIBRATING_SQUARE, W_NONPASSWALL, WT_TO_DMG, ZAP_POS, is_hole, is_pit, SHOPBASE } from './const.js';
import { isAutoReturningThrow } from './returning_throw.js';
import { weaponHitBonus, dryTowel, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { autoquiverCandidate } from './quiver.js';
import { corpseName, killerObjectName, objectCombatName, objectName, observeObjectForNaming, singularObjectName, makePlural, verbForSubject, objectDescription, objectNameIsPlural, simpleObjectName, withIndefiniteArticle } from './objnam.js';
import { inventoryItemDescription, delobj } from './invent.js';
import { chooseInventoryObject } from './invent.js';
import { objectClassForType, objectMaterial } from './o_init.js';
import { rejoinObjectStack, linkObjectToMonsterInventory, placeObjectSynchronously, stack_object } from './mkobj.js';
import { applyPolearm, applyTool, couldPoleMonster } from './apply.js';
import { snapshotMenuUnderlay } from './windows.js';
import { promptDirection } from './cmd.js';
import { captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, prepareHeroThrownTarget, heroDirectGoldThrowRange } from './thrown_object.js';
import { wakeMonstersNearWithMessages, angerAttackedMonster, wakeAttackedMonster, finishEnvironmentalMonsterDeath, monsterWearsTorsoArmor, resolveMonsterLiquid, wakeMonster as awakenMonster, angerMonster } from './mon.js';
import { canLetGo } from './do.js';
import { freeInventoryObject } from './invent.js';
import { wipeHeroEngraving } from './engrave.js';
import { heroResistsStoning, touchPetrifies, formCanBecomeStoneGolem } from './stoning.js';
import { heroHandName, heroEyeCount, heroEyeName, heroFaceName, heroHeadName } from './body_parts.js';
import { beginHeroVolley, chooseHeroVolleyCount, finishHeroVolley, endHeroVolley } from './hero_multishot.js';
import { reportHeroEncumbrance } from './pickup.js';
import { resolveGenericSwallowedThrow, resolveSwallowedEggPieOrVenomThrow, resolveSwallowedFoodThrow, resolveSwallowedPotionThrow, resolveSwallowedWeaponThrow } from './swallowed_throw.js';
import { hitMonsterWithSupportedPotion, SUPPORTED_MONSTER_POTION_TYPES, applySupportedPotionVapor, heroPotionVaporProfile } from './potion.js';
import { dist2, possessiveName } from './hacklib.js';
import { dropObjectAtHero } from './do.js';
import { resolveGoldMonsterContact, shipObject } from './dokick.js';
import { landObjectOnAltar } from './altar_object.js';
import { surfaceName, ceilingName } from './terrain_name.js';
import { captureHeroProjectileName } from './uhitm.js';
import { capitalizedDefiniteName, rayMissMessage } from './ray_hit_message.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { makeBlinded } from './potion.js';
import { offerThrownFood } from './thrown_food.js';
import { throwOrdinaryObject } from './ordinary_throw.js';
import { monsterHasMapPosition, monsterOccupiesPosition } from './steed.js';
import { canSeeMonster, canSpotMonster, flush_screen, newsym, glyphAt, map_invisible } from './display.js';
import { goodPosition } from './teleport_rules.js';
import { finishImmediateMonsterTrap, petrifyMonsterImmediately, triggerImmediateMonsterTrap, erodeObject, resolveImmediatePetrification, petrifyMonsterFromContact, trapName, dotrap } from './trap.js';
import { stopHeroOccupation } from './occupation.js';
import { cansee, vision_recalc } from './vision.js';
import { rn2, rnd, d, rnl } from './rng.js';
import { updateMonsterRegions, updateHeroRegions } from './regions.js';
import { setMonsterApparentHeroPosition } from './monmove.js';
import { monsterSentenceSubject } from './ambient_sounds.js';
import { displayLiquidName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { isPoolAt, isLavaAt, isMoatAt, isWaterwallAt } from './dbridge.js';
import { armorSimpleName, heroHasWaterWalking, objectIsHardHelmet, simpleArmorName } from './do_wear.js';
import { publishHeardMessage, formatFeltMessage } from './hero_speech.js';
import { setMonsterMalign, makemonAt } from './makemon.js';
import { applyHeroEggLuckPenalty, explodePyroliskEggAt, isPyroliskEgg } from './egg_impact.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { objectResistsDestruction } from './zap.js';
import { costlySpot, stolenValue, makeAngryShopkeeper, insideShopRoomAt, containedGold, donateGold, makeShopkeeperHappy, objectIsUnpaid, removeObjectAndContentsFromBill, sellHeroDroppedObject, shopResident } from './shk.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { exceedsActionCapacity, checkSpecialRoom, finishDestinationSpotEffects, heroBadRock, heroGoldAmount, heroLiquidEffects, heroTestMove, heroTightDiagonalReason, inventoryWeight, loseHeroHp, nomul, switchHeroTerrain, roomsAt } from './hack.js';
import { currency } from './invent.js';
import { heroCanBeBlindedByObject } from './blinding_attack.js';
import { finishHeroDeath } from './end.js';
import { hitHeroWithFallingArtifact } from './falling_artifact.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { levelHasCeiling } from './dungeon.js';
import { beginBallAndChainMove, finishBallAndChainMove, heroIsPunished } from './ball.js';
import { placeHeroOnLevel } from './hero_location.js';
import { walkPathCells } from './path_walk.js';
import { monsterObjectPronoun } from './mondata.js';
import { hiddenGold } from './vault.js';
import { detachHeroGold, heroGoldObject } from './hero_gold.js';
import { addObjectToMonsterInventory } from './steal.js';
import { hasShopkeeperData, requireShopGame } from './shop_types.js';
import { applyFloorEffects } from './floor_effects.js';
import { finishMonsterEating } from './dogmove.js';
const M2_ROCKTHROW = 0x08000000;
// C weapon.c WEAPON_CLASS/GEM_CLASS/TOOL_CLASS used by omon_adj()'s hitval() branch.
const WEAPON_CLASS = 2;
const GEM_CLASS = 13;
const TOOL_CLASS = 6;
// C refs: dothrow(), throw_obj().  Splitting the selected arrow stack makes
// a new object id, then obj_resists() is consulted when it lands.
async function okToThrow() {
    // dothrow.c:ok_to_throw() is shared by #throw and #fire.  It rejects
    // form capabilities before capacity and before either command chooses an
    // object. M1_NOTAKE deliberately precedes M1_NOHANDS because forms such
    // as brown molds satisfy both and own the stronger message.
    if (heroCannotTake(game)) {
        await pline('You are physically incapable of throwing or shooting anything.');
        game.context.move = 0;
        return false;
    }
    if (heroHasNoHands(game)) {
        await pline("You can't throw or shoot without hands.");
        game.context.move = 0;
        return false;
    }
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return false;
    }
    return true;
}
export async function dofire() {
    // C dothrow.c:ok_to_throw() reads the count from gc.command_count; a
    // queued dofire (fireassist swap chains) finds it untouched because
    // no parse() runs between the two commands.
    const shotLimit = Math.max(0, game._commandCount || 0);
    setMulti(0);
    if (!await okToThrow())
        return;
    let fireObject = game.uquiver;
    const weapon = game.uwep;
    const throwWielded = weapon && isAutoReturningThrow(weapon, weapon.owornmask ?? 0, game)
        && (artifactById(weapon.oartifact, game)?.name !== 'Mjollnir'
            || currentAttribute(A_STR) >= STR19(25))
        && (!fireObject || isLauncherAmmunition(fireObject));
    if (throwWielded)
        fireObject = weapon;
    let quiverSelectionSpentTime = false;
    if (!fireObject) {
        if (game.flags?.autoquiver) {
            fireObject = autoquiverCandidate(game);
            if (fireObject) {
                const wasReady = fireObject.ready;
                fireObject.ready = false;
                observeObjectForNaming(fireObject);
                await pline(`You ready: ${fireObject.invlet} - ${await inventoryItemDescription(fireObject)}.`);
                if (wasReady === undefined)
                    delete fireObject.ready;
                else
                    fireObject.ready = wasReady;
                await setQuiverObject(fireObject, game);
            }
            else {
                await pline('You have nothing appropriate for your quiver.');
            }
        }
        else {
            if (game.uwep && isPolearm(game.uwep))
                return applyPolearm(game.uwep, true);
            if (game.uwep?.otyp === BULLWHIP) {
                await applyTool(game.uwep, snapshotMenuUnderlay());
                return;
            }
            const alternate = game.uswapwep || game.u?.uswapwep;
            if (game.flags?.fireassist !== false && alternate && isPolearm(alternate)
                && !(alternate.cursed && alternate.bknown)) {
                // C dothrow.c:522-525: swap to the polearm and retry
                // fire, each as its own queued command.
                cmdq_add_ec(CQ_CANNED, 'doswapweapon');
                cmdq_add_ec(CQ_CANNED, 'dofire');
                game.context.move = 0;
                return;
            }
            await pline('You have no ammunition readied.');
        }
        if (!fireObject) {
            // A repeated direction cannot answer the empty-quiver picker.
            game._inDoAgain = false;
            const selection = await doquiverCore('fire');
            // doquiverCore() reports its own ECMD_CANCEL from the declined
            // verb prompt.
            if (selection.cancelled)
                return;
            fireObject = selection.item;
            quiverSelectionSpentTime = selection.spentTime;
        }
        if (!fireObject) {
            // dofire() keeps the quiver refill's ECMD_TIME in place of the
            // missing missile (dothrow.c:585).
            if (!quiverSelectionSpentTime)
                commandResultCancelled();
            return;
        }
    }
    // dothrow.c:dofire() routes launcher assistance through CQ_CANNED: a
    // matching alternate weapon is swapped in as one timed action, then fire
    // resumes after the complete monster/global turn without consuming a new
    // physical key.  This applies to every matching ammo/launcher pair; role
    // names and recorded command streams do not participate in selection.
    if (fireObject) {
        const matchingLauncher = (launcher) => launcherMatchesAmmo(fireObject, launcher);
        const alternate = game.uswapwep || game.u?.uswapwep || null;
        const fireassist = !throwWielded && game.flags?.fireassist !== false;
        if (fireassist && isLauncherAmmunition(fireObject) && game.uwep && isPolearm(game.uwep)
            && couldPoleMonster(game.uwep, { state: game })) {
            return applyPolearm(game.uwep, true);
        }
        if (fireassist && !matchingLauncher(game.uwep)
            && matchingLauncher(alternate)) {
            // C dothrow.c:567-569: swap weapons and retry fire.
            cmdq_add_ec(CQ_CANNED, 'doswapweapon');
            cmdq_add_ec(CQ_CANNED, 'dofire');
            game.context.move = quiverSelectionSpentTime ? 1 : 0;
            return;
        }
        if (fireassist && !matchingLauncher(game.uwep)) {
            // dothrow.c:find_launcher() scans the live inventory chain.  A
            // known cursed launcher is ineligible; the first known blessed
            // or uncursed match wins immediately, while only the first
            // unknown-BUC match is retained as a fallback.
            let unknownLauncher = null;
            let inventoryLauncher = null;
            for (const candidate of game.inventory || []) {
                if (candidate.cursed && candidate.bknown)
                    continue;
                if (!matchingLauncher(candidate))
                    continue;
                if (candidate.bknown) {
                    inventoryLauncher = candidate;
                    break;
                }
                if (!unknownLauncher)
                    unknownLauncher = candidate;
            }
            inventoryLauncher ||= unknownLauncher;
            if (inventoryLauncher) {
                if (!inventoryLauncher.invlet)
                    throw new Error('Cannot queue a wield command for an object without an inventory letter.');
                // C dothrow.c:573-577: push the old weapon aside, wield
                // the launcher, and retry fire.
                if (game.uwep && !game.flags?.pushweapon)
                    cmdq_add_ec(CQ_CANNED, 'doswapweapon');
                cmdq_add_ec(CQ_CANNED, 'dowield');
                cmdq_add_key(CQ_CANNED, inventoryLauncher.invlet.charCodeAt(0));
                cmdq_add_ec(CQ_CANNED, 'dofire');
                game.context.move = quiverSelectionSpentTime ? 1 : 0;
                return;
            }
        }
        await throwCommand(fireObject, true, shotLimit);
        // dofire() returns the quiver refill's ECMD_TIME in place of the
        // cancelled throw's ECMD_CANCEL (dothrow.c:585), so a refill that
        // spent the turn drops the throw's cancellation.
        if (quiverSelectionSpentTime) {
            beginCommandResult();
            game.context.move = 1;
        }
        return;
    }
}
async function finishOrdinarySwallowedThrowKill(monster, projectile, options = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...options,
        deathContext: {
            kind: 'swallowed-projectile',
            projectile,
        },
    });
}
async function finishOrdinarySwallowedConsumedKill(monster, kind, death = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...death,
        deathContext: {
            kind,
        },
    });
}
async function finishOrdinaryMapPotionKill(monster, death = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, death);
}
export async function dothrow(selectedItem = null) {
    await throwCommand(selectedItem);
}
async function throwCommand(selectedItem = null, capabilityChecked = false, suppliedShotLimit = null) {
    const shotLimit = suppliedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, suppliedShotLimit || 0);
    requireInitializedHero(game.u);
    setMulti(0);
    if (!capabilityChecked && !await okToThrow())
        return;
    // getobj("throw") changes its suggested class when the primary weapon is
    // a sling: ordinary weapons become downplayed and GEM_CLASS sling ammo is
    // suggested instead.  Every directly selected inventory letter remains
    // valid even when downplayed.
    const launcher = game.uwep;
    const wieldingSling = !!launcher
        && OBJECT_SUBTYPE[launcher.otyp] === OBJECT_SUBTYPE[SLING];
    // C getobj() sorts its candidates independently of the carried chain.
    const throwClassification = (item) => {
        const objectClass = item.oclass || objectClassForType(item.otyp);
        if (item.bknown && isWeldedPrimary(item))
            return GETOBJ_DOWNPLAY;
        if (item.otyp === BOOMERANG || item === game.uwep && (item.otyp === AKLYS
            || artifactById(item.oartifact)?.name === 'Mjollnir'
                && game.urole?.key === 'valkyrie' && currentAttribute(A_STR) >= STR19(25)))
            return GETOBJ_SUGGEST;
        if (item.quan === 1 && (item === game.uwep || item === game.uswapwep && game.u.twoweap))
            return GETOBJ_DOWNPLAY;
        return objectClass === 12 || objectClass === (wieldingSling ? 13 : 2)
            || item.otyp === BOULDER && (monsterThrowsRocks(game.u.umonnum ?? -1))
            ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    };
    if (!selectedItem) {
        selectedItem = await chooseInventoryObject('throw', throwClassification, { forcePrompt: true, allowCount: true });
    }
    const item = selectedItem;
    if (!item) {
        commandResultCancelled(); // dothrow.c:dothrow() getobj ECMD_CANCEL.
        return;
    }
    const previous = game.inventory[game.inventory.indexOf(item) - 1];
    const splitParent = previous && previous.invlet === item.invlet ? previous : null;
    const selectedObjectClass = item.oclass || objectClassForType(item.otyp);
    const selectedIsGold = selectedObjectClass === 12;
    const directGoldThrow = selectedIsGold && item !== game.uquiver;
    const direction = await promptDirection();
    if (!direction) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        // getdir() already cleared its prompt; a message it printed for
        // the rejected key ("What a strange direction!") stays visible in
        // C because throw_obj() just returns ECMD_CANCEL (dothrow.c).
        commandResultCancelled(); // throw_obj() getdir ECMD_CANCEL.
        return;
    }
    const { dx, dy, dz } = direction;
    const selfThrow = !dx && !dy && !dz;
    if (directGoldThrow) {
        if (selfThrow) {
            if (splitParent)
                await rejoinObjectStack(splitParent, item, game);
            await pline('You cannot throw gold at yourself.');
            commandResultCancelled(); // throw_gold() self ECMD_CANCEL.
            game.context.move = 0;
            return;
        }
        await resolveDirectGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz,
            captureFlight: captureThrownObjectFlight,
            wakeMonster: wakeAttackedMonster,
            angerMonster: angerAttackedMonster,
        });
        game.context.move = 1;
        return;
    }
    if (!await canLetGo(item, 'throw')) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        game.context.move = 0;
        return;
    }
    const mjollnir = artifactById(item.oartifact, game)?.name === 'Mjollnir';
    if (mjollnir && item !== game.uwep) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        await pline(`The ${objectName(item)} must be wielded before it can be thrown.`);
        game.context.move = 0;
        return;
    }
    if (mjollnir && currentAttribute(A_STR) < STR19(25)
        || item.otyp === BOULDER
            && !(monsterThrowsRocks(game.u.umonnum))) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        await pline("It's too heavy.");
        game.context.move = 1;
        return;
    }
    if (selfThrow) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        await pline('You cannot throw an object at yourself.');
        game.context.move = 0;
        return;
    }
    wipeHeroEngraving(2);
    if (!(game.uarmg || game.u.uarmg) && item.otyp === CORPSE
        && touchPetrifies(item.corpsenm) && !heroResistsStoning(game)) {
        await plineWithContinuation(`You throw ${corpseName(item, { definite: true })} with your bare ${makePlural(heroHandName(game))}.`);
        const result = await resolveImmediatePetrification({
            state: game,
            killer: `throwing ${killerObjectName(item, game)} bare-handed`,
        });
        if (result.died || game.program_state.gameover)
            return;
    }
    if (isWetTowel(item))
        await dryTowel(item, -1);
    const volleyCount = chooseHeroVolleyCount(item, { state: game, shotLimit });
    if (volleyCount > 1 || shotLimit > 0) {
        if (volleyCount === 1)
            observeObjectForNaming(item);
        const noun = volleyCount === 1
            ? singularObjectName(item) : objectCombatName(item, { includeCorpseSpecies: false });
        await plineWithContinuation(`You ${launcherMatchesAmmo(item, game.uwep) ? 'shoot' : 'throw'} ${volleyCount} ${noun}.`);
    }
    const volley = {
        count: volleyCount, index: 1, objectType: item.otyp,
        shooting: launcherMatchesAmmo(item, game.uwep),
    };
    // end.c:savelife() truncates m_shot so a life-saved hero fires no
    // further missiles; the loop reads the shared volley for that cut.
    beginHeroVolley(volley);
    try {
        for (; volley.index <= volley.count; volley.index++) {
            const stopVolley = await throwSelectedUnit(item, dx, dy, volley);
            if (game.program_state.gameover)
                return;
            await reportHeroEncumbrance(game);
            if (game.program_state.gameover || stopVolley)
                break;
        }
    }
    finally {
        finishHeroVolley();
    }
    game.context.move = 1;
}
// throw_obj() hands off one missile at a time. An engulfer can die during a
// volley, so every remaining missile must choose its current destination.
async function throwSelectedUnit(item, dx, dy, volley) {
    if (item.oclass === 12 && item === game.uquiver) {
        await resolveQuiveredGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz: game.u.dz ?? 0,
            captureFlight: captureThrownObjectFlight,
            wakeMonster: wakeAttackedMonster,
        });
        return false;
    }
    const selectedQuantity = item.quantity ?? item.quan ?? 1;
    const thrownObjectClass = item.oclass || objectClassForType(item.otyp);
    if (await resolveSwallowedEggPieOrVenomThrow({
        state: game,
        item,
        selectedQuantity,
        finishKill: (monster) => finishOrdinarySwallowedConsumedKill(monster, item.otyp === EGG ? 'swallowed-egg' : 'swallowed-venom'),
    }))
        return false;
    if (await resolveSwallowedWeaponThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        volley,
        finishKill: finishOrdinarySwallowedThrowKill,
    }))
        return false;
    if (await resolveSwallowedPotionThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNearWithMessages,
        finishKill: (monster, death) => finishOrdinarySwallowedConsumedKill(monster, 'swallowed-potion', death),
    }))
        return false;
    if (await resolveSwallowedFoodThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
    }))
        return false;
    if (await resolveGenericSwallowedThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
    }))
        return false;
    if (game.u?.uswallow) {
        // Every swallowed object class owns a monster-contact continuation
        // above: C's throwit() never reaches its flight or floor paths
        // while u.uswallow (dothrow.c:1569-1578, 1704-1706).
        throw new Error('a swallowed throw reached no engulfer contact arm');
    }
    if (!game.u?.uswallow && await resolveMapPotionThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        dx,
        dy,
        captureFlight: captureThrownObjectFlight,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNearWithMessages,
        finishKill: finishOrdinaryMapPotionKill,
    }))
        return false;
    if (!game.u?.uswallow && thrownObjectClass === 8)
        throw new Error('map potion impact is not implemented');
    const shotResult = await throwOrdinaryObject({
        state: game,
        item,
        quantity: selectedQuantity,
        dx,
        dy,
        volley,
    });
    return 'stopVolley' in shotResult && !!shotResult.stopVolley;
}
// C dothrow.c:tmiss(). Concealed targets are omitted even when sensed;
// the caller owns whether a missed throw wakes the target.
export async function reportHeroThrownMiss(monster, object, { state = game, publish = plineWithContinuation, volley, target = { x: monster.mx, y: monster.my }, } = {}) {
    const name = captureHeroProjectileName(object, state, volley);
    const appearance = M_AP_TYPE(monster);
    if (!canSeeMonster(monster) || appearance !== 0 && appearance !== M_AP_MONSTER) {
        const verb = objectNameIsPlural(object, state) ? 'miss' : 'misses';
        await publish(`${capitalizedDefiniteName(name, state)} ${verb}.`);
    }
    else
        await publish(rayMissMessage(name, monster, { ...target, state }));
}
const POTION_CLASS = 8;
function canResolveMapPotionThrow({ state, item, objectClass, selectedQuantity, dx, dy, }) {
    if (state.u?.uswallow || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1
        || !Number.isInteger(dx) || !Number.isInteger(dy))
        return false;
    return true;
}
function distanceFromHero(state, x, y) {
    return dist2(state.u.ux, state.u.uy, x, y);
}
function hitMonsterWithThrownPotion({ state, monster, potion, wakeMonster, wakeNearby, finishKill, publish, }) {
    return hitMonsterWithSupportedPotion({
        state,
        monster,
        potion,
        wakeMonster,
        wakeNearby,
        finishKill,
        publish,
        targetVisible: cansee(monster.mx, monster.my),
        resolveVapor: true,
        distance: distanceFromHero(state, monster.mx, monster.my),
    });
}
export async function resolveMapPotionThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, dx, dy, captureFlight = null, wakeMonster = null, wakeNearby = null, finishKill = null, publish = plineWithContinuation, }) {
    if (!canResolveMapPotionThrow({
        state, item, objectClass, selectedQuantity, dx, dy,
    }))
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        // In C, slipping or low stamina changes the direction after the potion
        // leaves inventory and before it begins moving across the map.
        await applyThrowSlip({ state, object: thrown, publish });
        await applyLowStaminaThrow({ state, object: thrown, publish });
        if (state.u?.dz) {
            const steed = state.u.dz > 0 ? state.u.usteed : null;
            if (steed && rn2(6) !== 0) {
                const impact = await hitMonsterWithThrownPotion({
                    state,
                    monster: steed,
                    potion: thrown,
                    wakeMonster,
                    wakeNearby,
                    finishKill,
                    publish,
                });
                if (impact?.heroDied)
                    return true;
                state.context.move = 1;
                return true;
            }
            if (state.u.dz > 0) {
                await hitFloorWithObject(thrown, { state, publish });
            }
            else {
                await tossObjectUp(thrown, { state, publish });
            }
            state.context.move = 1;
            return true;
        }
        const actualDx = state.u?.dx ?? dx;
        const actualDy = state.u?.dy ?? dy;
        const underwater = state.underwater || state.u?.uinwater;
        const trajectory = underwater
            ? { range: 1, recoil: 0 }
            : heroThrowTrajectory(thrown, state);
        const flight = await flyHeroThrownObject({
            state,
            object: thrown,
            dx: actualDx,
            dy: actualDy,
            range: trajectory.range,
            captureFlight,
            publish,
        });
        if (trajectory.recoil) {
            await hurtleHero(-actualDx, -actualDy, trajectory.recoil, { verbose: true });
            // C throwit() recoils after bhit() (dothrow.c:1682); a fatal
            // hurtle ends in done(), which never returns, so the potion
            // never hits its target or landing square afterwards.
            if (state.program_state?.gameover)
                return true;
        }
        if (flight.destroyed) {
            state.context.move = 1;
            return true;
        }
        if (flight.contact) {
            prepareHeroThrownTarget(flight.contact);
            rnd(20); // thitmonst() computes this before the potion class test
            if (currentAttribute(A_DEX, state) > rnd(25)) {
                const impact = await hitMonsterWithThrownPotion({
                    state,
                    monster: flight.contact,
                    potion: thrown,
                    wakeMonster,
                    wakeNearby,
                    finishKill,
                    publish,
                });
                if (impact?.heroDied)
                    return true;
                state.context.move = 1;
                return true;
            }
            const food = await offerThrownFood(flight.contact, thrown, state);
            if (food?.heroDied || food?.handled)
                return true;
            if (!food) {
                await reportHeroThrownMiss(flight.contact, thrown, { state, publish });
                if (rn2(3) === 0 && (await wakeMonster?.(flight.contact))?.heroDied)
                    return true;
            }
        }
        await finishHeroThrownObjectLanding({
            state,
            object: thrown,
            x: flight.x,
            y: flight.y,
            contactedMonster: flight.contact,
            publish,
        });
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// ---------------------------------------------------------------------------
// Moving a monster after a forceful hit.
// C refs: dothrow.c:will_hurtle()/mhurtle()/mhurtle_to_doom()/mhitm_knockback().
// ---------------------------------------------------------------------------
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_SLITHY = 0x00080000;
const M1_THICK_HIDE = 0x00200000;
const M1_NOLIMBS = 0x00006000;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_GRID_BUG = 116;
function monsterAt(state, x, y, ignoredMonster) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        monster !== ignoredMonster && !monster.dead
        && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
export function staggerVerb(mnum) {
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT)
        return 'wobbles';
    if (flags & M1_FLY)
        return (MONSTER_SIZE[mnum] ?? 2) <= 1
            ? 'flutters' : 'staggers';
    if (flags & M1_SLITHY)
        return 'falters';
    if (flags & M1_AMORPHOUS)
        return 'trembles';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0)
        return 'pulsates';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS)
        return 'falters';
    return 'staggers';
}
// C trap.c:minstapetrify(mon, TRUE) kills through xkilled(XKILL_NOMSG);
// petrifyMonsterImmediately() has already recorded the kill conduct.
function silentHeroStoning(finishMonsterDeath) {
    return (monster, death = {}) => finishMonsterDeath(monster, {
        ...death, showKillMessage: false, recordConduct: false,
    });
}
async function hurtleOneSquare(monster, dx, dy, { state, announce, nameMonster, finishMonsterDeath, monsterMoving, random, }) {
    const oldX = monster.mx;
    const oldY = monster.my;
    const nextX = oldX + dx;
    const nextY = oldY + dy;
    if (!willMonsterHurtle(monster, state, nextX, nextY, random)) {
        const occupant = monsterAt(state, nextX, nextY, monster);
        if (occupant) {
            if (canSeeMonster(monster)
                || canSeeMonster(occupant)) {
                await announce(`${monsterName(monster, { state, capitalized: true })} bumps into ${monsterName(occupant, { state, article: 'a' })}.`);
            }
            await awakenMonster(occupant, { attacked: !monsterMoving });
            const contact = monsterMoving
                ? { publish: announce, finishDeath: finishMonsterDeath }
                : { publish: announce, finishDeath: silentHeroStoning(finishMonsterDeath), creditHero: true };
            if (touchPetrifies(occupant.mnum) && !monsterWearsTorsoArmor(monster)) {
                await petrifyMonsterImmediately(monster, contact);
                await newsym(monster.mx, monster.my);
            }
            if (touchPetrifies(monster.mnum) && !monsterWearsTorsoArmor(occupant)) {
                await petrifyMonsterImmediately(occupant, contact);
                await newsym(occupant.mx, occupant.my);
            }
        }
        else if (nextX === state.u.ux && nextY === state.u.uy) {
            // C Some_Monnam(): an unseen hurtler is "Someone" or "Something".
            await announce(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} bumps into you.`);
            await stopHeroOccupation(state, announce);
            if (touchPetrifies(state.u.umonnum) && !monsterWearsTorsoArmor(monster)) {
                await petrifyMonsterImmediately(monster, {
                    publish: announce, finishDeath: silentHeroStoning(finishMonsterDeath), creditHero: true,
                });
                await newsym(monster.mx, monster.my);
            }
            const torsoArmor = state.inventory.some(object => (object.owornmask ?? 0) & (W_ARM | W_ARMC | W_ARMU));
            if (touchPetrifies(monster.mnum) && !torsoArmor) {
                const noun = nameMonster(monster).replace(/^(?:the|The|your) /u, '');
                await resolveImmediatePetrification({
                    state, publish: announce,
                    killer: `being hit by ${monster.mtame ? 'your' : 'a'} hurtling ${noun}`,
                });
            }
        }
        return { moved: false, dead: !!monster.dead || monster.mhp <= 0, occupant };
    }
    updateMonsterRegions(monster, state, { x: nextX, y: nextY });
    monster.mx = nextX;
    monster.my = nextY;
    await newsym(oldX, oldY);
    if (monster === state.u.usteed) {
        state.u.ux0 = state.u.ux;
        state.u.uy0 = state.u.uy;
        state.u.ux = nextX;
        state.u.uy = nextY;
        await vision_recalc(0);
    }
    await newsym(nextX, nextY);
    await flush_screen(1);
    await state.animationFrame?.();
    setMonsterApparentHeroPosition(monster, state, random);
    if (IS_WATERWALL(state.level.requireAt(nextX, nextY).typ))
        return { moved: true, stopped: true };
    await applyHurtleTrap(monster, { state, announce, finishMonsterDeath, random }, 'in-flight');
    return {
        moved: true,
        dead: !!monster.dead || monster.mhp <= 0,
        stopped: !!monster.mtrapped || !monster.mcanmove
            || monster.mx !== nextX || monster.my !== nextY
            || (monster !== state.u.usteed && !state.level.monsters.includes(monster)),
    };
}
// C dothrow.c:mhurtle_step() calls mintrap(HURTLING) on each square; mhurtle()
// ends with mintrap(FORCEBUNGLE), which still rolls a known trap's avoidance.
async function applyHurtleTrap(monster, options, stage) {
    const { state, announce, finishMonsterDeath, random } = options;
    const action = await triggerImmediateMonsterTrap(monster, state, stage === 'in-flight'
        ? { inAir: true, random } : { forceBungle: true, random });
    await finishImmediateMonsterTrap(action, state, {
        publish: announce,
        random,
        finishDeath: async (target, death) => {
            const outcome = await finishMonsterDeath(target, death);
            if (typeof outcome === 'boolean')
                return { survived: !outcome };
            if ('survived' in outcome)
                return outcome;
            return { survived: !outcome.killed, heroDied: outcome.heroDied };
        },
    });
}
export async function hurtleMonster(monster, dx, dy, distance, options = {}) {
    const { monsterMoving = false, state = game, announce = plineWithContinuation, nameMonster = monsterSentenceSubject, random = rn2, } = options;
    requirePlayingGame(state);
    const wakeMonster = options.wakeMonster
        || (() => awakenMonster(monster, { attacked: !monsterMoving }));
    const finishMonsterDeath = options.finishMonsterDeath
        || ((target, death) => finishEnvironmentalMonsterDeath(target, state, {
            ...death, publish: announce, random,
        }));
    const active = {
        state, announce, nameMonster, random, monsterMoving,
        finishMonsterDeath,
        finishLiquidDeath: options.finishLiquidDeath || ((target, liquid) => finishMonsterDeath(target, {
            random: liquid.random,
            noCorpse: !liquid.leaveCorpse,
            sadFeeling: liquid.sadFeeling,
            publish: liquid.publish,
        })),
    };
    const waking = await wakeMonster();
    if (waking?.heroDied)
        return { moved: false, dead: false, heroDied: true };
    monster.movement = 0;
    monster.mstun = 1;
    if ((MONSTER_SIZE[monster.mnum] ?? 0) >= 4 || monster === state.u.ustuck || monster.mtrapped) {
        if (canSeeMonster(monster))
            await announce(`${monsterName(monster, { state, capitalized: true })} doesn't budge!`);
        return { moved: false, dead: false };
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!distance || (!dx && !dy) || (dx && dy && monster.mnum === PM_GRID_BUG))
        return { moved: false, dead: false };
    if (monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
    }
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    let result = { moved: false, dead: false };
    for (let step = 0; step < distance; step++) {
        const next = await hurtleOneSquare(monster, dx, dy, active);
        result = { ...next, moved: result.moved || next.moved };
        if (!next.moved || next.dead || next.stopped)
            break;
    }
    if (!monster.dead && monster.mhp > 0
        && (monster === state.u.usteed || state.level.monsters.includes(monster))) {
        if (state.level.traps.some(trap => trap.tx === monster.mx && trap.ty === monster.my))
            await applyHurtleTrap(monster, active, 'landing');
        else
            await resolveMonsterLiquid(monster, state, {
                announce, finishDeath: active.finishLiquidDeath,
                monsterMoving,
            });
    }
    result.dead = !!monster.dead || monster.mhp <= 0;
    return result;
}
// C dothrow.c:will_hurtle(): the size, holder and trap gates, then goodpos()
// decides the destination. goodpos() draws rn2(13) for an S_EEL monster even
// though MM_IGNOREWATER discards the result, shifting the draws after it.
export function willMonsterHurtle(monster, state, x, y, random = rn2) {
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 4
        || monster === state.u?.ustuck || monster.mtrapped)
        return false;
    return goodPosition(x, y, { kind: 'monster', monster }, {
        state, gpflags: MM_IGNOREWATER | MM_IGNORELAVA, random,
    });
}
export async function tryUnarmedStagger(monster, { skill, damage, dx, dy, state = game, announce = async () => { }, nameMonster = target => monsterName(target, { state, capitalized: true }), wakeMonster = async () => {
    monster.msleeping = 0;
}, finishLiquidDeath, finishMonsterDeath, }) {
    if (rnd(100) >= skill)
        return { staggered: false };
    if (monsterIsBig(monster.mnum)
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_THICK_HIDE)) {
        return { staggered: false };
    }
    if (canSpotMonster(monster)) {
        await announce(`${nameMonster(monster)} ${staggerVerb(monster.mnum)} from your powerful strike!`);
    }
    if (damage >= (monster.mhp ?? 1))
        return { staggered: true };
    const hurtle = await hurtleMonster(monster, dx, dy, 1, {
        state,
        announce,
        nameMonster,
        wakeMonster,
        finishLiquidDeath,
        finishMonsterDeath,
    });
    return { staggered: true, ...hurtle };
}
export function rangedTargetHitBonus(object, defender, { state = game, defenderNotices = false, random = rn2, rollOne = rnd, } = {}) {
    const size = MONSTER_SIZE[defender.mnum];
    if (size === undefined)
        throw new RangeError(`Unknown ranged defender species ${defender.mnum}`);
    let bonus = size - 2;
    if (defender.msleeping)
        bonus += 2;
    const speciesCanMove = MONSTER_MOVE[defender.mnum] !== 0;
    if (!defender.mcanmove || !speciesCanMove) {
        bonus += 4;
        if (defenderNotices && speciesCanMove && random(10) === 0) {
            defender.mcanmove = 1;
            defender.mfrozen = 0;
        }
    }
    if (object.otyp === HEAVY_IRON_BALL) {
        if (object !== state.uball)
            bonus += 2;
    }
    else if (object.otyp === BOULDER) {
        bonus += 6;
    }
    else if (object.oclass === WEAPON_CLASS || object.oclass === GEM_CLASS
        || (object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0)) {
        bonus += weaponHitBonus(object, defender, { state, random, rollOne });
    }
    return bonus;
}
const ARMOR_CLASS = 3;
const WAND_CLASS = 11;
const GLASS = 19;
const BREAKABLE_TYPES = new Set([
    EXPENSIVE_CAMERA,
    EGG,
    CREAM_PIE,
    MELON,
    ACID_VENOM,
    BLINDING_VENOM,
]);
export function objectBreaksOnImpact(object, random = rn2) {
    const glassArmor = object.oclass === ARMOR_CLASS
        && objectMaterial(object.otyp) === GLASS;
    const ordinaryResistance = glassArmor ? 90 : 1;
    if (objectResistsDestruction(object, ordinaryResistance, 99, random))
        return false;
    const glassObject = objectMaterial(object.otyp) === GLASS
        && !object.oartifact && !object.artifact
        && object.oclass !== GEM_CLASS;
    return glassObject || object.oclass === POTION_CLASS
        || BREAKABLE_TYPES.has(object.otyp);
}
async function publishBreakMessage(object, visible, publish, state) {
    if ([EGG, MELON].includes(object.otyp)) {
        await publish('Splat!');
        return;
    }
    if (object.otyp === CREAM_PIE) {
        if (visible)
            await publish('What a mess!');
        return;
    }
    if ([ACID_VENOM, BLINDING_VENOM].includes(object.otyp)) {
        await publish('Splash!');
        return;
    }
    if (!visible) {
        await publishHeardMessage('something shatter!', publish, state);
        return;
    }
    const quantity = object.quan ?? object.quantity ?? 1;
    // C breakmsg(): glass and crystal wands share the default case.
    const intoPieces = object.oclass === WAND_CLASS
        || [LENSES, MIRROR, CRYSTAL_BALL, EXPENSIVE_CAMERA].includes(object.otyp)
        ? ' into a thousand pieces' : '';
    observeObjectForNaming(object, { state });
    const description = await objectDescription(object, { state });
    const subject = description.charAt(0).toUpperCase() + description.slice(1);
    await publish(`${subject} ${quantity === 1 ? 'shatters' : 'shatter'}${intoPieces}!`);
}
async function crackGlassArmor(object, x, y, publish, luckRandom, state) {
    const result = await erodeObject(object, 'crack', {
        state, publish, luckRandom, destroy: true, grease: false, verbose: true,
        position: { x, y }, displayName: armorSimpleName(object, state),
    });
    return result === 'destroyed';
}
async function applyPotionBreakEffect(object, x, y, state, publish) {
    if (object.otyp === POT_OIL && object.lamplit)
        return false;
    const nearby = Math.max(Math.abs(x - state.u.ux), Math.abs(y - state.u.uy)) <= 1;
    if (!nearby)
        return false;
    const profile = heroPotionVaporProfile(state);
    if (object.otyp !== POT_WATER && !state.u?.halfGasDamage) {
        if (!profile.breathless)
            await publish('You smell a peculiar odor...');
        else if (profile.hasEyes) {
            // C dothrow.c breakobj(): the eye name follows the current form's
            // anatomy, pluralized by eyecount() and tensed by vtense().
            const eye = heroEyeName(state);
            const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
            await publish(`Your ${eyes} ${verbForSubject(eyes, 'water')}.`);
        }
    }
    await applySupportedPotionVapor({ state, potion: object, publish });
    return true;
}
async function settleBrokenShopObject(object, x, y, fromInventory, state, publish) {
    if (fromInventory || object.unpaid) {
        if ((state.u.ushops?.length ?? 0) || object.unpaid)
            await settleThrownShopObject(object, x, y, state, publish, { broken: true });
        return;
    }
    const spot = !object.no_charge && costlySpot(x, y, state);
    if (!spot)
        return;
    const { resident, roomno } = spot;
    const shop = resident.eshk;
    if (!shop)
        throw new Error('A costly shop square has no shopkeeper account.');
    const sequence = state._heroActionSeq ?? 0;
    if (sequence !== shop.break_seq)
        shop.seq_peaceful = resident.mpeaceful;
    const loss = await stolenValue(object, x, y, shop.seq_peaceful, {
        silent: false, state, publish,
    });
    if (loss > 0 && sequence !== shop.break_seq
        && (roomno !== state.u.ushops?.[0]
            || !insideShopRoomAt(state, state.u.ux, state.u.uy)))
        await makeAngryShopkeeper(resident, state);
    shop.break_seq = sequence;
}
export async function breakFloorObject(object, { x = object.ox, y = object.oy, fromInventory = false, inView = null, state = game, heroCaused = true, publish = plineWithContinuation, random = rn2, luckRandom = rnl, rollDice = d, summonMonster = makemonAt, } = {}) {
    requireLiveGame(state);
    if (!objectBreaksOnImpact(object, random)) {
        return { destroyed: false, observed: false };
    }
    return breakObjectAtLocation(object, {
        x, y, fromInventory, inView, state, heroCaused, publish, random, luckRandom, rollDice,
        summonMonster,
    });
}
export async function breakObjectAtLocation(object, { x = object.ox, y = object.oy, fromInventory = false, inView = null, state = game, heroCaused = true, showBreakMessage = true, publish = plineWithContinuation, random = rn2, luckRandom = rnl, rollDice = d, summonMonster = makemonAt, } = {}) {
    requireLiveGame(state);
    const visible = !heroIsBlind(state)
        && (inView ?? (fromInventory || cansee(x, y)));
    const audible = !heroIsDeaf(state);
    const glassArmor = objectIsCrackable(object, state);
    if (glassArmor) {
        const destroyed = await crackGlassArmor(object, x, y, publish, luckRandom, state);
        if (destroyed)
            await newsym(x, y);
        return { destroyed, observed: destroyed && (visible || audible) };
    }
    if (showBreakMessage)
        await publishBreakMessage(object, visible, publish, state);
    if (heroCaused && object.otyp === MIRROR) {
        changeHeroLuck(-2, state);
    }
    const cameraDemon = object.otyp === EXPENSIVE_CAMERA
        ? await releaseCameraDemon(object, x, y, {
            state, publish, random, summonMonster,
        }) : null;
    if (object.oclass === POTION_CLASS) {
        // The blast from burning oil must not ignite or destroy the same
        // potion again while breakage is still finishing.
        object.in_use = true;
        await applyPotionBreakEffect(object, x, y, state, publish);
        if (state.program_state?.gameover)
            return { destroyed: false, observed: visible || audible };
    }
    const oilExplosion = object.otyp === POT_OIL && object.lamplit;
    const eggExplosion = isPyroliskEgg(object);
    if (heroCaused)
        applyHeroEggLuckPenalty(object, state);
    if (oilExplosion) {
        // Blast credit follows the active turn, independently of breakage.
        const explosion = await explodeLitOilPotion(object, x, y, {
            state, heroCaused: !state.context.mon_moving, publish, random, rollDice,
        });
        if (explosion.heroDied)
            return { destroyed: false, observed: visible || audible, heroDied: true };
    }
    if (heroCaused)
        await settleBrokenShopObject(object, x, y, fromInventory, state, publish);
    // Fracture callers replace the stone object after breakobj settles its cost.
    if (object.otyp === BOULDER || object.otyp === STATUE)
        return { destroyed: false, observed: false };
    // breakobj() leaves any redraw of the square to its caller.
    await delobj(object, state, random);
    if (eggExplosion) {
        await explodePyroliskEggAt(x, y, {
            state, heroCaused: !state.context.mon_moving, publish, random, rollDice,
        });
    }
    return {
        destroyed: true,
        observed: visible || audible,
        cameraDemon,
    };
}
export async function hitFloorWithObject(object, { verbose = true, state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    const level = requireGameLevel(state);
    const location = level.at(hero.ux, hero.uy);
    if (!location)
        throw new Error('The hero is outside the dungeon map.');
    if (IS_SOFT(location.typ) || hero.uinwater || hero.uswallow)
        return dropObjectAtHero(object, { state, publish });
    if (IS_ALTAR(location.typ)) {
        await landObjectOnAltar(object, { state, publish });
    }
    else if (verbose) {
        // C Doname2(obj) is the capitalized full doname; otense conjugates
        // the verb by quantity.
        const verb = (object.otyp === WAN_STRIKING ? 'strike' : 'hit')
            + (object.quan > 1 ? '' : 's');
        let surf = surfaceName(hero.ux, hero.uy, state);
        const trap = level.traps.find(candidate => candidate.tx === hero.ux && candidate.ty === hero.uy);
        // describe something that might keep the object where it is or
        // precede the next message stating that it falls
        if (trap?.tseen) {
            if (trap.ttyp === TRAPDOOR)
                surf = 'trap door';
            else if (trap.ttyp === HOLE)
                surf = 'edge of the hole';
            else if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT)
                surf = 'edge of the pit';
        }
        observeObjectForNaming(object, { state });
        const description = await inventoryItemDescription(object);
        await publish(`${description.charAt(0).toUpperCase()}${description.slice(1)} `
            + `${verb} the ${surf}.`);
    }
    const broke = await breakFloorObject(object, {
        state, publish, x: hero.ux, y: hero.uy, fromInventory: true,
    });
    // A fatal break (potion vapor, burning oil) can end the game without
    // destroying the object; gate on the game-over state itself.
    if (broke.destroyed || state.program_state?.gameover)
        return null;
    if (await shipObject(object, hero.ux, hero.uy, { state: requireInitializedGame(state), publish }))
        return null;
    return dropObjectAtHero(object, { impact: true, state, publish });
}
// C dothrow.c:release_camera_demon().
const PM_HOMUNCULUS = 51;
const PM_IMP = 52;
export async function releaseCameraDemon(object, x, y, { state = game, publish = plineWithContinuation, random = rn2, summonMonster = makemonAt, } = {}) {
    if (random(3) !== 0)
        return null;
    const mnum = random(3) === 0 ? PM_IMP : PM_HOMUNCULUS;
    const monster = await summonMonster(mnum, x, y, MM_NOMSG);
    if (!monster)
        return null;
    if (canSpotMonster(monster)) {
        const subject = heroIsHallucinating(state)
            ? `A ${randomDisplayMonsterName()}`
            : 'The picture-painting demon';
        await publish(`${subject} is released!`);
    }
    monster.mpeaceful = object.cursed ? 0 : 1;
    setMonsterMalign(monster, state);
    return monster;
}
// ---------------------------------------------------------------------------
// C dothrow.c:check_shop_obj(). Broken objects settle through the hero's
// current shop. Intact returns remove bills or offer a sale before stacking.
// ---------------------------------------------------------------------------
export async function settleThrownShopObject(object, x, y, state = game, publish = plineWithContinuation, { broken = false } = {}) {
    requireLiveGame(state);
    requireShopGame(state);
    const heroShop = state.u.ushops[0];
    const resident = shopResident(heroShop, state);
    if (!resident)
        return false;
    const spot = costlySpot(x, y, state);
    const objectRoom = roomsAt(state.level, x, y, SHOPBASE)[0];
    if (broken || !spot || objectRoom !== heroShop) {
        if (objectIsUnpaid(object))
            await stolenValue(object, state.u.ux, state.u.uy, resident.mpeaceful, {
                state, publish, silent: false,
            });
        if (broken)
            object.no_charge = true;
        return true;
    }
    const previousRoom = state.u.ushops0[0];
    if (objectRoom === heroShop || objectRoom === previousRoom) {
        if (objectIsUnpaid(object)) {
            const gold = containedGold(object, true);
            removeObjectAndContentsFromBill(object, state, { resident });
            if (gold > 0)
                await donateGold(gold, resident, { selling: true, publish });
        }
        else if (x !== resident.mx || y !== resident.my) {
            await sellHeroDroppedObject(object, x, y, state, { publish });
        }
    }
    return true;
}
function heroForm() {
    requirePlayingGame(game);
    return Upolyd(game.u) ? game.u.umonnum : null;
}
function heroFormFlags() {
    const form = heroForm();
    return form === null ? 0 : MONSTER_FLAGS1[form] ?? 0;
}
function floorBoulder(x, y) {
    return (game.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER) || null;
}
// C m_at() also finds a long worm by any of its tail segments.
function heroHurtleMonsterAt(x, y) {
    return game.level?.monsters?.find(monster => monsterHasMapPosition(monster) && !monster.dead && (monster.mhp ?? 1) > 0
        && monsterOccupiesPosition(monster, x, y)) || null;
}
function wallPassage(location) {
    const hasAbility = !!(game.u.passesWalls
        || (heroFormFlags() & M1_WALLWALK));
    return {
        hasAbility,
        mayPass: hasAbility
            && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL)),
    };
}
function obstacleReason(location, openDoorFrame) {
    if (location.typ === TREE)
        return 'bumping into a tree';
    if (openDoorFrame)
        return 'bumping into a door frame';
    if (location.typ === DOOR)
        return 'bumping into a closed door';
    return 'bumping into a wall';
}
// C dothrow.c:hurtle_step() losehp(..., why, KILLED_BY): "killed by bumping into a wall".
async function loseImpactHitPoints(amount, killer) {
    if (game.u.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    return loseHeroHp(amount, killer, { killerFormat: KILLED_BY });
}
function obstacleAt(x, y) {
    const hero = game.u;
    const location = game.level?.at?.(x, y);
    if (!location)
        return null;
    const diagonal = hero.ux !== x && hero.uy !== y;
    const closedDoor = location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const openDoorFrame = diagonal && location.typ === DOOR
        && !!((location.doormask ?? 0) & D_ISOPEN);
    const passage = wallPassage(location);
    if (!passage.hasAbility || !passage.mayPass) {
        if (IS_OBSTRUCTED(location.typ) || closedDoor || openDoorFrame) {
            return {
                message: openDoorFrame ? 'You hit the door frame!' : 'Ouch!',
                followup: openDoorFrame ? 'Ouch!' : null,
                reason: obstacleReason(location, openDoorFrame),
            };
        }
        if (location.typ === IRONBARS) {
            return {
                message: 'You crash into some iron bars.  Ouch!',
                reason: 'crashing into iron bars',
            };
        }
        const boulder = floorBoulder(x, y);
        if (boulder) {
            return {
                message: `You bump into a ${objectName(boulder)}.  Ouch!`,
                reason: 'bumping into a boulder',
            };
        }
        if (passage.hasAbility && !passage.mayPass) {
            return {
                message: 'You smack into something!',
                reason: 'touching the edge of the universe',
            };
        }
    }
    if ((!passage.hasAbility || !passage.mayPass) && diagonal
        && heroBadRock(game, hero.ux, y)
        && heroBadRock(game, x, hero.uy)) {
        const tight = heroTightDiagonalReason(game);
        if (tight === 1 || tight === 2) {
            return {
                message: tight === 2
                    ? 'You and all your belongings get forcefully wedged into a crevice.'
                    : 'You get forcefully wedged into a crevice.',
                reason: 'wedging into a narrow crevice',
            };
        }
    }
    return null;
}
async function hitObstacle(obstacle, x, y, remaining) {
    await plineWithContinuation(obstacle.message);
    if (obstacle.followup)
        await plineWithContinuation(obstacle.followup);
    if (await loseImpactHitPoints(rnd(2 + remaining), obstacle.reason))
        return;
    await wakeMonstersNearWithMessages(x, y, 10);
}
function heroWearsTorsoArmor() {
    return !!(game.uarmu || game.uarm || game.uarmc
        || game.u?.uarmu || game.u?.uarm || game.u?.uarmc);
}
async function collideWithMonster(monster, x, y, options) {
    const glyph = glyphAt(x, y);
    monster.mundetected = 0;
    const name = monsterName(monster, { article: 'a', augmentIt: true });
    await plineWithContinuation(glyph?.kind === 'monster' || glyph?.kind === 'invisible'
        ? `You bump into ${name}.`
        : `You find ${name} by bumping into ${monsterObjectPronoun(monster, { noIt: true })}.`);
    await awakenMonster(monster);
    if (!canSpotMonster(monster))
        await map_invisible(monster.mx, monster.my);
    await angerMonster(monster);
    // C dothrow.c:hurtle_step() instapetrify()s an unarmored hero.
    if (touchPetrifies(monster.mnum) && !heroWearsTorsoArmor()) {
        const result = await resolveImmediatePetrification({
            killer: `bumping into ${withIndefiniteArticle(monsterTypeName(monster.mnum, !!monster.female))}`,
        });
        if (result.died)
            return;
    }
    const form = heroForm();
    if (form !== null && touchPetrifies(form) && !monsterWearsTorsoArmor(monster)) {
        await petrifyMonsterFromContact(monster, {
            creditHero: true,
            finishDeath: options.finishMonsterDeath ?? undefined,
        });
    }
    await wakeMonstersNearWithMessages(x, y, 10);
}
function anchoredMessage() {
    const type = game.u?.utraptype;
    if (type === TT_WEB)
        return 'You are anchored by the web.';
    if (type === TT_LAVA)
        return `You are anchored by the ${displayLiquidName('lava')}.`;
    if (type === TT_INFLOOR)
        return `You are anchored by the ${surfaceName(game.u.ux, game.u.uy)}.`;
    if (type === TT_BURIEDBALL)
        return 'You are anchored by the buried ball.';
    return 'You are anchored by the trap.';
}
function stopHurtle() {
    nomul(0);
}
async function triggerLandingTrap(trap, options, remaining) {
    requirePlayingGame(game);
    if (!trap)
        return false;
    // Jump's final square is handled by teleds(), after the path walk.
    if (options.jumping && remaining.value < 2)
        return false;
    const before = {
        level: game.level, x: game.u.ux, y: game.u.uy,
    };
    const sokobanFall = game.level.flags.sokoban_rules
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp));
    if (trap.ttyp === VIBRATING_SQUARE)
        await plineWithContinuation('The ground vibrates as you pass it.');
    if ([VIBRATING_SQUARE, FIRE_TRAP, MAGIC_PORTAL].includes(trap.ttyp) || sokobanFall) {
        const result = sokobanFall && options.jumping
            ? { died: false } : await dotrap(trap, options);
        if (result.died)
            return true;
        if (trap.ttyp === MAGIC_PORTAL)
            return true;
        if (sokobanFall) {
            remaining.value = 0;
            return !options.jumping;
        }
    }
    else if (trap.tseen) {
        await plineWithContinuation(`You pass right over ${withIndefiniteArticle(trapName(trap.ttyp))}.`);
    }
    return game.level !== before.level
        || game.u.ux !== before.x || game.u.uy !== before.y;
}
// drown() relocates a hero who crawls out or is rescued through teleds(),
// whose spoteffects() covers the room, trap, and look-here at the landing.
function hurtleTrapOptions(options) {
    const trapOptions = {};
    if (options.finishTeleport)
        trapOptions.finishTeleport = options.finishTeleport;
    if (options.gotoLevel)
        trapOptions.gotoLevel = options.gotoLevel;
    return trapOptions;
}
async function settleLiquid(options, remaining) {
    requirePlayingGame(game);
    const { ux: x, uy: y } = game.u;
    if (isLavaAt(x, y)) {
        if (!options.jumping || remaining.value >= 2)
            await plineWithContinuation('You move over some lava.', { noRepeat: true });
        return false;
    }
    if (!isPoolAt(x, y) || game.u.uinwater)
        return false;
    const staysAboveWater = game.u?.levitating || game.u?.levitation
        || game.u.flying
        || heroHasWaterWalking(game) || options.jumping;
    if (!isWaterwallAt(x, y) && staysAboveWater) {
        if (!Is_waterlevel(game.u?.uz)
            && (!options.jumping || remaining.value >= 2)) {
            await plineWithContinuation(`You move over ${isMoatAt(x, y) ? 'a moat' : 'a pool'}.`, { noRepeat: true });
        }
        return false;
    }
    // C dothrow.c:926-928 resets the counter directly (`gm.multi = 0;
    // (void) drown(); return FALSE;`) so drown() may crawl the hero out;
    // it touches neither gm.multi_reason nor gn.nomovemsg, so hurtle()'s
    // reason and its empty-but-set end message ("") both survive until
    // the next nomul(0) (reason only, hack.c:4170), done_eating() or
    // unmul() consumes them.
    setMulti(0);
    // C hurtle_step() calls drown() directly, then stops even if a swimmer
    // survives in place. pooleffects() would check the steed too early.
    await heroLiquidEffects({
        entry: 'drown',
        chooseTeleportDestination: options.chooseTeleportDestination ?? null,
        applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y, newx: to.x, newy: to.y,
            pick, trapOptions: hurtleTrapOptions(options),
        }),
    });
    return true;
}
async function moveOneSquare(x, y, options, remaining) {
    requirePlayingGame(game);
    if (!isok(x, y)) {
        await plineWithContinuation(formatFeltMessage('the spirits holding you back.'));
        return false;
    }
    updateHeroRegions(game, x, y);
    if (!remaining.value)
        return false;
    const obstacle = obstacleAt(x, y);
    if (obstacle) {
        await hitObstacle(obstacle, x, y, remaining.value);
        return false;
    }
    const monster = heroHurtleMonsterAt(x, y);
    if (monster) {
        await collideWithMonster(monster, x, y, options);
        return false;
    }
    const hero = game.u;
    const diagonal = hero.ux !== x && hero.uy !== y;
    if (diagonal && game.level?.flags?.sokoban_rules
        && heroBadRock(game, hero.ux, y)
        && heroBadRock(game, x, hero.uy)) {
        await plineWithContinuation('You come to an abrupt halt!');
        return false;
    }
    const ballAndChain = await beginBallAndChainMove(x, y);
    if (ballAndChain?.blocked) {
        if (!options.jumping)
            return false;
    }
    if (ballAndChain && !ballAndChain.blocked)
        await finishBallAndChainMove(ballAndChain);
    const oldx = hero.ux;
    const oldy = hero.uy;
    await placeHeroOnLevel(x, y);
    await newsym(oldx, oldy);
    await vision_recalc(1);
    await flush_screen(1);
    const previousLocation = game.level.at(oldx, oldy);
    const currentLocation = game.level.at(x, y);
    if (!previousLocation || !currentLocation)
        throw new Error(`Hurtle moved between invalid map cells ${oldx},${oldy} and ${x},${y}`);
    if (previousLocation.typ !== currentLocation.typ)
        await switchHeroTerrain(game);
    await checkSpecialRoom();
    if (await settleLiquid(options, remaining))
        return false;
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    if (await triggerLandingTrap(trap, options, remaining))
        return false;
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value)
        await game.animationFrame?.();
    return true;
}
// C hurtle_jump() walks an irregular jump with the same collisions as hurtle.
// The caller owns trap escape, the final landing, and the one-turn delay.
export async function hurtleJumpTo(x, y, options = {}) {
    requirePlayingGame(game);
    const path = walkPathCells(game.u.ux, game.u.uy, x, y);
    const remaining = { value: path.length };
    let reached = { x: game.u.ux, y: game.u.uy };
    for (const point of path) {
        if (!await moveOneSquare(point.x, point.y, { ...options, jumping: true }, remaining))
            break;
        reached = point;
    }
    // walk_path() rolls its destination back to the preceding accepted
    // square on failure, even if a portal or liquid moved the actor.
    return reached;
}
export async function hurtleHero(dx, dy, range, { verbose = false, finishTeleport = null, gotoLevel = null, chooseTeleportDestination = null, finishMonsterDeath = null, volley, } = {}) {
    requirePlayingGame(game);
    const ball = game.uball || game.u.uball;
    if (heroIsPunished()
        && (!ball || !game.inventory.includes(ball))) {
        await plineWithContinuation(formatFeltMessage('a tug from the iron ball.'));
        stopHurtle();
        return false;
    }
    if (game.u?.utrap) {
        await plineWithContinuation(anchoredMessage());
        stopHurtle();
        return false;
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    range = Math.max(0, Math.trunc(range));
    if (!range || (!dx && !dy) || game.u?.ustuck)
        return false;
    nomul(-range);
    game._helplessReason = 'moving through the air';
    game._helplessDoneMessage = '';
    if (verbose) {
        await plineWithContinuation(`You ${range > 1 ? 'hurtle' : 'float'} in the opposite direction.`);
    }
    if (volley)
        await endHeroVolley(volley);
    const remaining = { value: range };
    const options = {
        finishTeleport, gotoLevel, chooseTeleportDestination,
        finishMonsterDeath,
    };
    while (remaining.value) {
        const x = game.u.ux + dx;
        const y = game.u.uy + dy;
        if (!await moveOneSquare(x, y, options, remaining))
            break;
    }
    return true;
}
// ---------------------------------------------------------------------------
// Thrown-projectile helpers.
// C refs: dothrow.c harmless_missile() and should_mulch_missile().
// ---------------------------------------------------------------------------
const P_BOW = 20;
const P_CROSSBOW = 22;
const P_DART = 23;
const P_BOOMERANG = 25;
const RUBBER_HOSE = OBJECT_NAMES.indexOf('rubber hose');
const SCROLL_CLASS = 9;
const CLOTH = 6;
// C dothrow.c:harmless_missile(). Contents make an otherwise soft bag hurt.
export function harmlessMissile(object, state = game) {
    switch (object.otyp) {
        case SLING:
        case EUCALYPTUS_LEAF:
        case KELP_FROND:
        case SPRIG_OF_WOLFSBANE:
        case FORTUNE_COOKIE:
        case PANCAKE:
            return true;
        case RUBBER_HOSE:
        case BAG_OF_TRICKS:
            return object.spe < 1;
        case SACK:
        case OILSKIN_SACK:
        case BAG_OF_HOLDING:
            return !object.contents?.length;
        default:
            return object.oclass === SCROLL_CLASS || objectMaterial(object, state) === CLOTH;
    }
}
export function projectileKind(object) {
    const subtype = object ? OBJECT_SUBTYPE[object.otyp] ?? 0 : 0;
    if (subtype >= -P_CROSSBOW && subtype <= -P_BOW)
        return 'ammunition';
    if (subtype >= -P_BOOMERANG && subtype <= -P_DART)
        return 'missile';
    return null;
}
// C frees a mulched projectile. Remove it from every JavaScript object list.
export function destroyMulchedProjectile(object) {
    if (!object)
        return;
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
    delete object.carrierMid;
}
export function shouldMulchMissile(object, { monsterMoving = false } = {}) {
    if (!object || !projectileKind(object)
        || OBJECT_NAMES[object.otyp] === 'boomerang'
        || OBJECT_MAGIC[object.otyp])
        return false;
    const erosion = Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
    const enchantment = object.spe ?? object.enchantment ?? 0;
    const chance = 3 + erosion - enchantment;
    let broken = chance > 1 ? rn2(chance) !== 0 : rn2(4) === 0;
    if (object.blessed
        && (monsterMoving ? rn2(3) === 0 : rnl(4) === 0))
        broken = false;
    if ((HARD_GEM_TYPES.has(object.otyp) || object.otyp === FLINT)
        && rn2(2) === 0)
        broken = false;
    return broken;
}
const RING_CLASS = 4;
const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
const M1_UNSOLID = 0x00100000;
// C dothrow.c:toss_up(). The hero tosses an object upwards; it falls back.
export async function tossObjectUp(object, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const hasCeiling = levelHasCeiling(state);
    const hitsRoof = random(5) !== 0 && !(state.underwater || hero.uinwater);
    const ceiling = ceilingName(hero.ux, hero.uy, state);
    const breakObject = () => breakObjectAtLocation(object, {
        x: hero.ux, y: hero.uy, fromInventory: true, state, publish, random,
    });
    const hitFloor = (verbose) => hitFloorWithObject(object, { state, publish, verbose });
    const petrifier = (object.otyp === EGG || object.otyp === CORPSE)
        && touchPetrifies(object.corpsenm);
    if (hasCeiling && hitsRoof && objectBreaksOnImpact(object, random)) {
        await publish(`${await fallingObjectSubject(object, state)} hits the ${ceiling}.`);
        const broken = await breakObject();
        if (broken.destroyed || state.program_state.gameover)
            return null;
        return hitFloor(false);
    }
    const action = !hasCeiling ? 'flies up into' : hitsRoof ? 'hits' : 'almost hits';
    await publish(`${await fallingObjectSubject(object, state)} ${action} the ${ceiling}, then falls back on top of your ${heroHeadName(state)}.`);
    if (object.oclass === POTION_CLASS) {
        await hitHeroWithThrownPotion(object, { state, publish, random, rollOne });
        return null;
    }
    const helmet = state.uarmh || hero.uarmh || null;
    if (objectBreaksOnImpact(object, random)) {
        // C dothrow.c passes &gy.youmonst as both magr and mdef here.
        const blindIncrement = heroCanBeBlindedByObject(object.otyp, state, { thrownByHero: true }) ? rollOne(25) : 0;
        const broken = await breakObject();
        if (state.program_state.gameover)
            return null;
        const remaining = broken.destroyed ? null : object;
        if (object.otyp === EGG && petrifier && !heroResistsStoning(state)
            && await petrifyFromFallingObject(remaining, helmet, state, publish))
            return remaining;
        if (object.otyp === EGG || object.otyp === CREAM_PIE || object.otyp === BLINDING_VENOM) {
            await publish(`You've got it all over your ${heroFaceName(state)}!`);
            if (blindIncrement) {
                if (object.otyp === BLINDING_VENOM && !heroIsBlind(state))
                    await publish('It blinds you!');
                hero.ucreamed = (hero.ucreamed ?? 0) + blindIncrement;
                await makeBlinded((hero.blindTurns ?? 0) + blindIncrement, { state, talk: false, publish });
                if (!heroIsBlind(state))
                    await publish('Your vision quickly clears.');
            }
        }
        return remaining ? hitFloor(false) : null;
    }
    if (harmlessMissile(object, state)) {
        await publish("It doesn't hurt.");
        return hitFloor(false);
    }
    const material = objectMaterial(object, state);
    const silver = material === SILVER;
    const hatesSilver = heroHatesSilver(state);
    const lessDamage = objectIsHardHelmet(helmet) && (!silver || !hatesSilver);
    const formFlags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    let harmless = object.oclass !== RING_CLASS && (material === GEMSTONE || material === MINERAL)
        && !!(formFlags & M1_WALLWALK) && !(formFlags & M1_UNSOLID);
    let damage = rollPhysicalWeaponDamageAgainstHero(object, state, { rollOne });
    let artifactMessage = false;
    if (object.oartifact && !harmless) {
        const artifact = await hitHeroWithFallingArtifact(object, damage, {
            state, publish, random, rollOne, dieRoll: random(18) + 2,
        });
        if (artifact.heroDied)
            return object;
        damage = artifact.damage;
        artifactMessage = artifact.specialMessage;
    }
    if (!damage) {
        const weightDamage = Math.max(1, Math.ceil(object.owt / WT_TO_DMG));
        damage = Math.min(6, weightDamage <= 1 ? 1 : rollOne(weightDamage));
        if (MONSTER_NAME[heroSpecies(state)] === 'shade' && !silver)
            damage = 0;
        if (object.blessed && monsterHatesBlessings({ mnum: heroSpecies(state) }))
            damage += rollOne(4);
        if (silver && hatesSilver)
            damage += rollOne(20);
    }
    if (damage > 1 && lessDamage)
        damage = 1;
    if (damage > 0)
        damage += hero.udaminc ?? 0;
    damage = Math.max(0, damage);
    if (hero.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    if (helmet) {
        const helmetName = simpleArmorName(helmet, 'uarmh', state);
        const hp = Upolyd(hero) ? hero.mh : hero.uhp;
        if ((lessDamage && damage < hp) || harmless) {
            if (!artifactMessage)
                await publish(harmless
                    ? `Unfortunately, you are wearing ${withIndefiniteArticle(helmetName)}.`
                    : 'Fortunately, you are wearing a hard helmet.');
        }
        else if (!petrifier && state.flags.verbose !== false) {
            await publish(`Your ${helmetName} does not protect you.`);
        }
        harmless = false;
    }
    else if (petrifier && !heroResistsStoning(state)
        && await petrifyFromFallingObject(object, null, state, publish))
        return object;
    if (silver && hatesSilver)
        await publish('The silver sears you!');
    if (harmless)
        await publish(`The ${simpleObjectName(object, state)} hits you but doesn't hurt.`);
    const landed = await hitFloor(true);
    state._thrownObject = null;
    if (!harmless && !state.program_state.gameover)
        await loseHeroHp(damage, 'falling object', { state, publish });
    return landed;
}
async function fallingObjectSubject(object, state) {
    observeObjectForNaming(object, { state });
    const name = await objectDescription(object, { state });
    return name.charAt(0).toUpperCase() + name.slice(1);
}
async function petrifyFromFallingObject(object, helmet, state, publish) {
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const result = await polymonHero(MONSTER_NAME.indexOf('stone golem'));
        if (result.transformed)
            return false;
        if (result.died)
            return true;
    }
    if (helmet)
        await publish(`Your ${simpleArmorName(helmet, 'uarmh', state)} fails to protect you.`);
    await publish('You turn to stone.');
    if (object)
        await dropObjectAtHero(object, { state, publish });
    state._thrownObject = null;
    await finishHeroDeath({
        killer: 'elementary physics', killerFormat: KILLED_BY,
        deathVerb: 'turned to stone', deathLineShown: true, deathType: STONING,
    });
    return true;
}
async function settleGoldOnFloor(state, gold, x, y, dz = 0) {
    const floor = await applyFloorEffects(gold, x, y, { state, verb: 'fall' });
    if (state.program_state?.gameover || floor.finished)
        return floor.object;
    if (dz > 0)
        await pline(`The gold hits the ${surfaceName(x, y, state)}.`);
    placeObjectSynchronously(gold, x, y);
    // throw_gold() sells unconditionally inside a shop; sellobj() itself
    // decides whether the landing spot belongs to the resident keeper.
    await sellHeroDroppedObject(gold, x, y, state);
    const survivor = await stack_object(gold, state) || gold;
    await newsym(x, y);
    return survivor;
}
async function resolveQuiveredGoldMonsterContact({ state, monster, gold, swallowed = false, wakeMonster = null, }) {
    // dothrow.c:omon_adj() can thaw a mobile species before thitmonst()
    // consumes its ordinary d20 targeting roll. Coins skip the damaging
    // classes, but a metal-eating pet can still catch one as food.
    prepareHeroThrownTarget(monster);
    rnd(20);
    const food = await offerThrownFood(monster, gold, state);
    if (food?.heroDied)
        return true;
    if (food)
        return food.handled;
    if (swallowed) {
        // thitmonst()'s guaranteed-hit arm names the engulfer's entrails or
        // currents (dothrow.c:2276-2298) before swallowit()'s mpickobj().
        await wakeMonster?.(monster);
        const name = monsterName(monster, { state });
        const trail = monsterDigests(monster) ? ' entrails'
            : monsterIsWhirly(monster) ? ' currents' : '';
        const destination = trail
            ? `${possessiveName(name)}${trail}` : name;
        await pline(`The gold piece vanishes into ${destination}.`);
        await addObjectToMonsterInventory(monster, gold, state);
        return true;
    }
    await reportHeroThrownMiss(monster, gold, { state });
    if (rn2(3) === 0)
        await wakeMonster?.(monster);
    return false;
}
export async function resolveDirectGoldThrow({ state, gold, dx = 0, dy = 0, dz = 0, captureFlight = null, wakeMonster = null, angerMonster = null, }) {
    if (!gold || gold.oclass !== 12 || !state.inventory.includes(gold))
        return false;
    await freeInventoryObject(gold, state);
    if (state.u?.uswallow && state.u?.ustuck) {
        const engulfer = state.u.ustuck;
        const swallower = monsterDigests(engulfer)
            ? `${possessiveName(monsterName(engulfer, { state }))} entrails`
            : monsterName(engulfer, { state });
        await pline(`The gold disappears into ${swallower}.`);
        await linkObjectToMonsterInventory(engulfer, gold, { state });
        return true;
    }
    if (dz) {
        // throw_gold() describes the purse bouncing off the ceiling unless
        // the level is open to the sky or the hero is in water.
        if (dz < 0 && !Is_airlevel(state.u?.uz)
            && !(state.underwater || state.u?.uinwater)
            && !Is_waterlevel(state.u?.uz)) {
            await pline(`The gold hits the ${ceilingName(state.u.ux, state.u.uy, state)}, then falls back on top of your ${heroHeadName(state)}.`);
            const helmet = state.uarmh ?? state.u?.uarmh ?? null;
            if (helmet) {
                await pline(`Fortunately, you are wearing ${withIndefiniteArticle(simpleArmorName(helmet, 'uarmh', state))}!`);
            }
        }
        await settleGoldOnFloor(state, gold, state.u.ux, state.u.uy, dz);
        return true;
    }
    // throw_gold() never enters bhit() when the purse cannot leave the hero.
    const nextX = state.u.ux + dx;
    const nextY = state.u.uy + dy;
    const next = isok(nextX, nextY) ? state.level?.at(nextX, nextY) : null;
    if (!next || !ZAP_POS(next.typ)
        || next.typ === DOOR && !!(next.doormask & (D_CLOSED | D_LOCKED))) {
        await settleGoldOnFloor(state, gold, state.u.ux, state.u.uy);
        return true;
    }
    const range = heroDirectGoldThrowRange(gold, state);
    const { x, y, contact } = await flyHeroThrownObject({
        state, object: gold, dx, dy, range, captureFlight,
    });
    if (contact) {
        const caught = await resolveGoldMonsterContact({
            state, monster: contact, gold,
            wakeMonster, angerMonster,
        });
        if (caught)
            return true;
    }
    else if (await shipObject(gold, x, y, {
        state: requireInitializedGame(state), publish: plineWithContinuation,
    })) {
        return true;
    }
    await settleGoldOnFloor(state, gold, x, y);
    return true;
}
export async function resolveQuiveredGoldThrow({ state, gold, dx = 0, dy = 0, dz = 0, captureFlight = null, wakeMonster = null, }) {
    if (!gold || gold !== heroGoldObject(state) || gold !== state.uquiver)
        return false;
    gold = detachHeroGold(state, 1);
    if (!gold)
        return false;
    // Quivered coins use throwit(), including its message and persistent
    // direction changes. An unquivered purse uses throw_gold() instead.
    state.u.dx = dx;
    state.u.dy = dy;
    state.u.dz = dz;
    await applyThrowSlip({ state, object: gold });
    dx = state.u.dx;
    dy = state.u.dy;
    dz = state.u.dz;
    gold.how_lost = LOST_THROWN;
    if (state.u?.uswallow && state.u?.ustuck) {
        return resolveQuiveredGoldMonsterContact({
            state, monster: state.u.ustuck, gold,
            swallowed: true, wakeMonster,
        });
    }
    if (dz) {
        if (dz < 0) {
            await tossObjectUp(gold, { state });
        }
        else {
            await hitFloorWithObject(gold, { state });
        }
        return true;
    }
    const underwater = !!(state.underwater || state.u?.uinwater);
    const trajectory = heroThrowTrajectory(gold, state);
    const range = underwater ? 1 : trajectory.range;
    const { x, y, contact } = await flyHeroThrownObject({
        state, object: gold, dx, dy, range, captureFlight,
    });
    // throwit() recoils after bhit(), before resolving the monster contact.
    if (trajectory.recoil) {
        await hurtleHero(-dx, -dy, trajectory.recoil, { verbose: true });
        if (state.program_state.gameover)
            return true;
    }
    if (contact) {
        const handled = await resolveQuiveredGoldMonsterContact({
            state, monster: contact, gold, wakeMonster,
        });
        if (handled)
            return true;
    }
    await finishHeroThrownObjectLanding({
        state, object: gold, x, y, contactedMonster: contact,
    });
    return true;
}
//# sourceMappingURL=dothrow.js.map