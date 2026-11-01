// dothrow.js — Throw and fire command front ends.
// C refs: dothrow.c ok_to_throw(), dothrow(), dofire(), and throw_obj()'s
// per-missile handoff to the flight owners.
import { game, requirePlayingGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { beginCommandResult, commandResultCancelled, setMulti } from './cmd.js';
import { requireInitializedHero } from './hero_types.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { currentAttribute } from './attrib.js';
import { AKLYS, BOOMERANG, BOULDER, BULLWHIP, CORPSE, EGG, OBJECT_SUBTYPE, SLING } from './object_data.js';
import { MONSTER_FLAGS2, MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL } from './monster_data.js';
import { artifactById } from './artifacts.js';
import { heroCannotTake, heroHasNoHands } from './polyself.js';
import { exceedsActionCapacity } from './weight.js';
import { isAmmunition, isPolearm, isWetTowel, launcherMatchesAmmo } from './object_properties.js';
import { isWeldedPrimary, setQuiverObject } from './wield.js';
import { GETOBJ_DOWNPLAY, GETOBJ_SUGGEST, A_DEX, A_STR, STR19, IS_WATERWALL, MM_IGNORELAVA, MM_IGNOREWATER, W_ARM, W_ARMC, W_ARMU, } from './const.js';
import { isAutoReturningThrow } from './returning_throw.js';
import { weaponHitBonus } from './weapon.js';
import { autoquiverCandidate } from './quiver.js';
import { corpseName, killerObjectName, objectCombatName, objectName, observeObjectForNaming, singularObjectName, } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { objectClassForType } from './object_knowledge.js';
import { applyPolearm, applyTool } from './apply.js';
import { snapshotMenuUnderlay } from './windows.js';
import { couldPoleMonster } from './polearm.js';
import { doquiverCore } from './wield.js';
import { promptDirection } from './tty_prompts.js';
import { rejoinObjectStack } from './object_stack.js';
import { resolveDirectGoldThrow, resolveQuiveredGoldThrow } from './gold_throw.js';
import { captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, prepareHeroThrownTarget, } from './thrown_object.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { canLetGo } from './hero_inventory.js';
import { wipeHeroEngraving } from './engrave.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { makePlural } from './object_grammar.js';
import { heroHandName } from './body_parts.js';
import { dryTowel } from './towel.js';
import { beginHeroVolley, chooseHeroVolleyCount, finishHeroVolley } from './hero_multishot.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { resolveGenericSwallowedThrow, resolveSwallowedEggPieOrVenomThrow, resolveSwallowedFoodThrow, resolveSwallowedPotionThrow, resolveSwallowedWeaponThrow, } from './swallowed_throw.js';
import { hitMonsterWithSupportedPotion, SUPPORTED_MONSTER_POTION_TYPES, } from './potion.js';
import { dist2 } from './hacklib.js';
import { hurtleHero } from './hero_hurtle.js';
import { hitFloorWithObject } from './object_drop.js';
import { tossObjectUp } from './toss_up.js';
import { reportHeroThrownMiss } from './hero_physical_messages.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { offerThrownFood } from './thrown_food.js';
import { throwOrdinaryObject } from './ordinary_throw.js';
import { angerAttackedMonster, wakeAttackedMonster, finishEnvironmentalMonsterDeath, monsterWearsTorsoArmor, resolveMonsterLiquid, wakeMonster as awakenMonster, } from './mon.js';
import { monsterHasMapPosition } from './steed.js';
import { canSeeMonster, canSpotMonster, flush_screen, newsym } from './display.js';
import { goodPosition } from './teleport_rules.js';
import { finishImmediateMonsterTrap, petrifyMonsterImmediately, triggerImmediateMonsterTrap } from './trap.js';
import { stopHeroOccupation } from './occupation.js';
import { cansee, vision_recalc } from './vision.js';
import { rn2, rnd } from './rng.js';
import { updateMonsterRegions } from './regions.js';
import { setMonsterApparentHeroPosition } from './monmove.js';
import { monsterSentenceSubject } from './ambient_sounds.js';
import { monsterName } from './do_name.js';
import { isPoolAt } from './terrain_properties.js';
import { artifactToHitBonus } from './artifacts.js';
import { P_PICK_AXE, P_SPEAR } from './const.js';
import { monsterHatesBlessings } from './monster_data.js';
import { HEAVY_IRON_BALL, OBJECT_HIT_BONUS, TRIDENT } from './object_data.js';
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
export async function dofire(cannedShotLimit = null) {
    const shotLimit = cannedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, cannedShotLimit || 0);
    setMulti(0);
    if (!await okToThrow())
        return;
    let fireObject = game.uquiver;
    const weapon = game.uwep;
    const throwWielded = weapon && isAutoReturningThrow(weapon, weapon.owornmask ?? 0, game)
        && (artifactById(weapon.oartifact, game)?.name !== 'Mjollnir'
            || currentAttribute(A_STR) >= STR19(25))
        && (!fireObject || isAmmunition(fireObject));
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
                game._cannedCommands ||= [];
                game._cannedCommands.push({ kind: 'swap-weapon' });
                game._cannedCommands.push({ kind: 'fire', shotLimit });
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
        if (fireassist && isAmmunition(fireObject) && game.uwep && isPolearm(game.uwep)
            && couldPoleMonster(game.uwep, { state: game })) {
            return applyPolearm(game.uwep, true);
        }
        if (fireassist && !matchingLauncher(game.uwep)
            && matchingLauncher(alternate)) {
            game._cannedCommands ||= [];
            game._cannedCommands.push({ kind: 'swap-weapon' });
            game._cannedCommands.push({ kind: 'fire', shotLimit });
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
                game._cannedCommands ||= [];
                if (game.uwep && !game.flags?.pushweapon) {
                    game._cannedCommands.push({ kind: 'swap-weapon' });
                }
                game._cannedCommands.push({
                    kind: 'wield', invlet: inventoryLauncher.invlet,
                });
                game._cannedCommands.push({ kind: 'fire', shotLimit });
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
            || item.otyp === BOULDER && ((MONSTER_FLAGS2[game.u.umonnum ?? -1] ?? 0) & M2_ROCKTHROW)
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
            && !((MONSTER_FLAGS2[game.u.umonnum] ?? 0) & M2_ROCKTHROW)) {
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
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 3
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
//# sourceMappingURL=dothrow.js.map