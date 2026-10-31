// dothrow.js — Throw and fire command front ends.
// C refs: dothrow.c ok_to_throw(), dothrow(), dofire(), and throw_obj()'s
// per-missile handoff to the flight owners.
import { game } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { beginCommandResult, commandResultCancelled, setMulti, } from './command_state.js';
import { requireInitializedHero } from './hero_types.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { currentAttribute } from './attrib.js';
import { AKLYS, BOOMERANG, BOULDER, BULLWHIP, CORPSE, EGG, OBJECT_SUBTYPE, SLING, } from './object_data.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { artifactById } from './artifacts.js';
import { heroCannotTake, heroHasNoHands } from './polyself.js';
import { exceedsActionCapacity } from './weight.js';
import { isAmmunition, isPolearm, isWetTowel } from './weapon_type.js';
import { GETOBJ_DOWNPLAY, GETOBJ_SUGGEST, A_STR, STR19, } from './const.js';
import { isAutoReturningThrow } from './returning_throw.js';
import { launcherMatchesAmmo } from './object_properties.js';
import { autoquiverCandidate } from './quiver.js';
import { isWeldedPrimary, setQuiverObject } from './weapon_slots.js';
import { corpseName, killerObjectName, objectCombatName, objectName, observeObjectForNaming, singularObjectName, } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { objectClassForType } from './object_knowledge.js';
import { applyPolearm, applyTool } from './cmd.js';
import { snapshotMenuUnderlay } from './windows.js';
import { couldPoleMonster } from './polearm.js';
import { doquiverCore } from './wield.js';
import { promptDirection } from './tty_prompts.js';
import { rejoinObjectStack } from './object_stack.js';
import { resolveDirectGoldThrow, resolveQuiveredGoldThrow, } from './gold_throw.js';
import { captureThrownObjectFlight } from './thrown_object.js';
import { angerAttackedMonster, wakeAttackedMonster } from './monster_anger.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { canLetGo } from './hero_inventory.js';
import { wipeHeroEngraving } from './engrave.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies, } from './stoning.js';
import { makePlural } from './object_grammar.js';
import { heroHandName } from './body_parts.js';
import { dryTowel } from './towel.js';
import { beginHeroVolley, chooseHeroVolleyCount, finishHeroVolley, } from './hero_multishot.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { resolveGenericSwallowedThrow, resolveSwallowedEggPieOrVenomThrow, resolveSwallowedFoodThrow, resolveSwallowedPotionThrow, resolveSwallowedWeaponThrow, } from './swallowed_throw.js';
import { resolveMapPotionThrow } from './potion_throw.js';
import { throwOrdinaryObject } from './ordinary_throw.js';
const M2_ROCKTHROW = 0x08000000;
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
//# sourceMappingURL=dothrow.js.map