// Hero item theft by monsters, and monster inventory acquisition and release.
// C ref: steal.c — steal(), stealarm(), worn_item_removal(), mpickobj(),
// stealamulet(), maybe_absorb_item(), mdrop_obj(), mdrop_special_objs(),
// relobj().
import { game, requireGameLevel, requireInitializedGame, requireLiveGame } from './gstate.js';
import { recordRandom } from './monster_action_types.js';
import { plineWithContinuation } from './pline.js';
import { LARGEST_INT, PLNMSG_MON_TAKES_OFF_ITEM, TT_BURIEDBALL, W_ACCESSORY, W_ARMG, W_ARMOR, W_WEAPONS, LOST_DROPPED, LOST_NONE, LOST_STOLEN, LOST_THROWN, RLOC_MSG, SHOPBASE, W_SADDLE, } from './const.js';
import { canSeeMonster, canSpotMonster, newsym } from './display.js';
import { heroFootName, monsterFootName, heroHandName } from './body_parts.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_SYMBOL, monsterCanEngulf, monsterIsAnimal, monsterIsSlithy, monsterTypeName, } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { AD_SITM } from './monster_attack_types.js';
import { BOULDER, CORPSE, GOLD_PIECE, LEASH, OBJECT_NAMES, AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, FAKE_AMULET_OF_YENDOR, SPE_BOOK_OF_THE_DEAD, } from './object_data.js';
import { OBJECT_DELAY } from './object_data.js';
import { definiteName, objectName, objectNameIsPlural, observeDistantObjectForNaming, observeObjectForNaming, ownedObjectName, pluralizeObjectNoun, simpleObjectName, } from './objnam.js';
import { isBimanualObject } from './object_properties.js';
import { inventoryItemDescription } from './invent.js';
import { heroIsBlind } from './senses.js';
import { impossible } from './diagnostics.js';
import { rn2 } from './rng.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { objectShedsLight, snuffLightSource } from './light.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroSpecies } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { dist2 } from './hacklib.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { roomsAt } from './room.js';
import { openHoldingTrap } from './trap.js';
import { armorSimpleName, stopDonning } from './armor.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { isWeldedPrimary } from './wield.js';
import { isBeingTakenOff } from './takeoff_state.js';
import { monsterCanCarryObject } from './mon.js';
import { releaseObjectLeash } from './leash_apply.js';
import { assertCreatedObject, } from './object_release.js';
import { forgetObjectKnowledge, linkCreatedObjectToMonsterInventory, linkObjectToMonsterInventory, unlinkMonsterObject, } from './mkobj.js';
import { removeObjectFromMonsterInventory, updateMonsterEquipment, } from './monworn.js';
import { deleteObject } from './object_delete.js';
import { landFloorObject } from './floor_effects.js';
import { inventoryItem } from './u_init.js';
import { cansee } from './vision.js';
import { petDroppableObject } from './dog.js';
import { artifactById, artifactByName, monsterCanTouchArtifact } from './artifacts.js';
import { objectResistsDestruction } from './object_state.js';
import { relocateObjectRandomly } from './object_teleport.js';
import { freeInventoryObject, finishInventoryRemoval } from './hero_inventory.js';
import { costlySpot, removeObjectAndContentsFromBill, currentShopResident } from './shk.js';
import { unlinkObject } from './object_location.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { heroHasInvoluntaryDelay, nomul, pendingArmorAction, } from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { touchPetrifies } from './stoning.js';
import { petrifyMonsterImmediately } from './trap.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { makeMonsterFlee } from './monmove.js';
// C Some_Monnam(): unseen thieves are "Someone" or "Something".
function wornItemRemover(monster, state) {
    return monsterName(monster, { state, capitalized: true, augmentIt: true });
}
async function wornTheftObjectDescription(object) {
    // C steal.c:worn_item_removal() starts from doname(), then massages only
    // the ownership and equipment-location suffix for its pre-removal line.
    let description = (await inventoryItemDescription(object))
        .replace(/^(?:the|an|a) /, object === game.uchain ? 'the ' : 'your ')
        .replace(' (being worn)', '')
        .replace(' (alternate weapon; not wielded)', '');
    description = description.replace(/ \(on (left|right) hand\)$/, ' (from $1 hand)');
    return description;
}
function heroEquipmentSlots() {
    return [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ];
}
const COIN_CLASS = 12;
// C steal.c:steal().  Inventory stacks are candidates as objects rather than
// by quantity.  Worn armor and accessories receive five tickets; weapons
// (including the primary and alternate weapon) still receive one.  Keep
// selection after an animal's hit message and before removal prose.
function selectHeroItemForTheft(state, random, calls) {
    const inventory = state?.inventory || [];
    const wornObjects = new Set([
        state?.uarm,
        state?.uarmc,
        state?.uarmh,
        state?.uarms,
        state?.uarmg,
        state?.uarmf,
        state?.uarmu,
        state?.uleft,
        state?.uright,
        state?.uamul,
        state?.ublindf,
        state?.u?.uleft,
        state?.u?.uright,
    ].filter(Boolean));
    const candidates = [];
    let total = 0;
    for (const object of inventory) {
        if (object === state?.uskin || (object?.oclass ?? object?.class) === COIN_CLASS)
            continue;
        // When body armor is present, steal() omits the cloak from this
        // weighted pass; its later equipment-dependency rewrites remain
        // separate from candidate weighting.
        if (state?.uarm && object === state?.uarmc)
            continue;
        const wornMask = object?.owornmask ?? 0;
        const weighted = wornObjects.has(object) || !!(wornMask & (W_ARMOR | W_ACCESSORY));
        const weight = weighted ? 5 : 1;
        candidates.push({ object, weight });
        total += weight;
    }
    if (!total)
        return null;
    let ticket = recordRandom(random, calls, total);
    for (const candidate of candidates) {
        ticket -= candidate.weight;
        if (ticket < 0) {
            return theftEquipmentTarget(candidate.object, state);
        }
    }
    return null;
}
// C steal.c:steal(): rings are taken through gloves, gloves displace the
// wielded weapon, and body armor defers to the cloak over it.
function theftEquipmentTarget(object, state) {
    if ((object === state.uleft || object === state.uright) && state.uarmg)
        object = state.uarmg;
    if (object === state.uarmg && state.uwep)
        return state.uwep;
    if (object === state.uarm && state.uarmc)
        return state.uarmc;
    if (object === state.uarmu)
        return state.uarmc || state.uarm || object;
    return object;
}
export async function stealFromHero(monster, random, calls) {
    const game = requireInitializedGame();
    const animal = monsterIsAnimal(monster);
    const wasPunished = !!game.uball;
    const draw = (limit) => {
        calls.push(`rn2(${limit})`);
        return random(limit);
    };
    if (dist2(monster.mx, monster.my, game.u.ux, game.u.uy) > 2)
        return { outcome: 'too-far' };
    const seenBeforeRemoval = canSpotMonster(monster);
    // C steal.c:367-372: stealing worn gear might blind the hero or drop
    // them into liquid; keep Some_Monnam() from before any removal. An
    // unseen thief is "Someone" for nymphs, "Something" for monkeys.
    let subject = monsterName(monster, { state: game, capitalized: true, augmentIt: true });
    const meal = game.context.victual;
    if (game._occupation?.key === 'eat-food' && meal && meal.usedtime >= meal.reqtime) {
        await stopHeroOccupation(game);
        if (game.program_state.gameover)
            return { outcome: 'hero-died' };
    }
    const adornment = !animal && !game.uarmg
        ? [game.uleft, game.uright].find(ring => ring?.otyp === OBJECT_NAMES.indexOf('adornment'))
        : null;
    let object = adornment ?? selectHeroItemForTheft(game, random, calls);
    const throwsRocks = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x08000000);
    let retriedBoulder = false;
    while (object) {
        // C steal.c:474-475: gs.stealoid holds the armor this same thief
        // is already removing; a second claw leaves it alone.
        if (game._armorTheft?.object === object)
            return { outcome: 'busy' };
        if (object.otyp !== BOULDER || throwsRocks || retriedBoulder)
            break;
        retriedBoulder = true;
        object = selectHeroItemForTheft(game, random, calls);
    }
    if (!object) {
        // C steal.c:381-405: not even a thousand men in armor can strip a
        // naked man. steal() returns 1 so mhitm_ad_sedu() lets it flee.
        if (!animal && game.uchain && draw(4)) {
            await plineWithContinuation(`${wornItemRemover(monster, game)} takes off ${await wornTheftObjectDescription(game.uchain)}.`);
            await removeWornHeroItem(game.uchain, game);
        }
        else if (!animal && game.u.utrap && game.u.utraptype === TT_BURIEDBALL && !draw(4)) {
            await plineWithContinuation(`${subject} takes off your unseen chain.`);
            await openHoldingTrap(game.u, { state: game });
        }
        else
            await plineWithContinuation(heroIsBlind(game)
                ? 'Somebody tries to rob you, but finds nothing to steal.'
                : game.inventory.some(item => item.oclass === 12)
                    ? `${subject} tries to rob you, but isn't interested in gold.`
                    : `${subject} tries to rob you, but there is nothing to steal!`);
        return { outcome: 'nothing-to-steal' };
    }
    if (!game.inventory.includes(object))
        return { outcome: 'gone' };
    const equipmentSlots = heroEquipmentSlots();
    const occupiedSlots = equipmentSlots.filter(slot => game[slot] === object);
    const weaponMask = object?.owornmask ?? 0;
    const wasWeapon = occupiedSlots.some(slot => ['uwep', 'uswapwep', 'uquiver'].includes(slot))
        || !!(weaponMask & W_WEAPONS)
        || object.wielded || object.alternate || object.ready;
    const wasAccessory = occupiedSlots.some(slot => ['uleft', 'uright', 'uamul', 'ublindf'].includes(slot))
        || !!(weaponMask & W_ACCESSORY);
    const wasWorn = occupiedSlots.length > 0
        || object.worn || weaponMask !== 0;
    const wornArmor = occupiedSlots.some(slot => slot.startsWith('uarm'));
    // C steal.c:446-467 cant_take: the preface line, then the one roll
    // that decides whether the thief stays (steal() returns 0) or flees.
    const refuse = async () => {
        const verbs = ['steal', 'snatch', 'grab', 'take'];
        const name = wornArmor ? `your ${armorSimpleName(object, game)}`
            : ownedObjectName(object, game, { capitalized: false });
        await plineWithContinuation(`${subject} tries to ${verbs[draw(4)]} ${name} but gives up.`);
        return {
            outcome: 'refused',
            fled: draw(Math.trunc(game.inventory.filter(item => item.oclass !== 12).length / 5) + 2) === 0,
        };
    };
    if (object.otyp === BOULDER && !throwsRocks)
        return refuse();
    if (animal) {
        let stuck = object === game.uball || (!!object.cursed && wasWorn
            && object !== game.uquiver && !(object === game.uswapwep && !game.u.twoweap));
        const weapon = game.uwep;
        const ring = object === game.uleft || object === game.uright;
        if (!stuck && ring && weapon && isWeldedPrimary(weapon, game)) {
            // C welded() reveals the curse even when the other hand is free.
            weapon.bknown = true;
            const primaryRing = game.u.rightHanded === false ? game.uleft : game.uright;
            stuck = object === primaryRing || !!isBimanualObject(weapon);
        }
        if (stuck || !monsterCanCarryObject(monster, object, game, draw))
            return refuse();
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (animal && object.cursed)
            return refuse();
        releaseObjectLeash(object, game);
    }
    const previousDelay = pendingArmorAction(game);
    const removingThisArmor = previousDelay?.kind === 'remove' && previousDelay.object === object;
    const wasDoffing = removingThisArmor || isBeingTakenOff(object, game);
    // C stop_donning() captures -multi only after cancel_don() has already
    // zeroed it, so steal()'s olddelay is always 0: interrupting a doff
    // never shortens the seduction delay nor disarms the patience roll.
    await stopDonning(object, game);
    await stopHeroOccupation(game);
    // stop_donning() makes interrupted dressing armor unworn before steal()
    // decides whether this item still needs armor-removal time or feedback.
    const stillWorn = equipmentSlots.some(slot => game[slot] === object)
        || object.worn || (object.owornmask ?? 0) !== 0;
    let removalMessage = null;
    let charmed = false;
    if (equipmentSlots.some(slot => slot.startsWith('uarm') && game[slot] === object)) {
        const delay = OBJECT_DELAY[object.otyp] ?? 0;
        const helplessReason = game._helplessReason;
        const reason = typeof helplessReason === 'string' ? helplessReason : helplessReason?.text;
        const unresponsive = heroIsUnaware(game) || (heroHasInvoluntaryDelay(game)
            && !!reason && /^(?:frozen|paralyzed)/.test(reason));
        if (animal || unresponsive) {
            if (delay >= 1 && draw(10))
                return refuse();
        }
        else {
            charmed = true;
            const cursed = object.cursed;
            const slowly = delay >= 1 || heroHasInvoluntaryDelay(game);
            const name = armorSimpleName(object, game);
            const who = canSpotMonster(monster) ? subject : 'She';
            removalMessage = game.flags.female
                ? `${who} charms you.  You gladly ${cursed ? 'let her take'
                    : !slowly ? 'hand over' : wasDoffing ? 'continue removing' : 'start removing'} your ${name}.`
                : `${canSpotMonster(monster) ? monsterName(monster, { state: game,
                    capitalized: true, adjective: 'beautiful' }) : 'She'} seduces you and ${cursed
                    ? 'helps you to take' : !slowly ? 'you take' : wasDoffing
                    ? 'you continue taking' : 'you start taking'} off your ${name}.`;
            object.cursed = false;
            try {
                await plineWithContinuation(removalMessage, { urgent: true });
                // nomul() cannot shorten another involuntary delay. Set it
                // before removal, whose effects can sleep or life-save us.
                // Life saving may replace the counter during this same
                // monster turn.
                nomul(-delay);
                game._helplessReason = 'taking off clothes';
                game._helplessDoneMessage = null;
                await removeWornHeroItem(object, game);
            }
            finally {
                object.cursed = cursed;
            }
            if ((game._helplessTurns ?? 0) > 0) {
                // C steal.c:547-551: steal() returns 0 with ga.afternmv =
                // stealarm and the armor's transfer still pending.
                game._armorTheft = { thief: monster, object };
                game._afterMove = { kind: 'steal' };
                return { outcome: 'armor-removal' };
            }
        }
    }
    const removalItem = object === game.uball && game.uchain ? game.uchain : object;
    if (!charmed && (wasWeapon || stillWorn)) {
        observeObjectForNaming(removalItem);
        const description = await wornTheftObjectDescription(removalItem);
        const verb = removalItem === object && wasWeapon ? 'disarms'
            : wasAccessory ? 'removes' : 'takes off';
        // worn_item_removal() names the thief again with Some_Monnam().
        removalMessage = `${wornItemRemover(monster, game)} ${verb} ${description}.`;
    }
    if (removalMessage && !charmed) {
        await plineWithContinuation(removalMessage);
        game._lastPlineKind = PLNMSG_MON_TAKES_OFF_ITEM;
    }
    if (removalItem !== object)
        await removeWornHeroItem(removalItem, game);
    await removeWornHeroItem(object, game);
    if (game.program_state?.gameover || !game.inventory.includes(object))
        return { outcome: 'vanished' };
    // steal() refreshes its cached name when removing worn gear restores
    // sight. The later retreat message in mhitm_ad_sedu() names the thief too.
    if (!seenBeforeRemoval && (wornArmor || wasAccessory) && canSpotMonster(monster))
        subject = monsterName(monster, { state: game, capitalized: true });
    // C yname() observes and names ownership before the shop bill is cleared.
    observeObjectForNaming(object);
    const stolenName = ownedObjectName(object, game, { capitalized: false });
    if (!heroHasConflict(game) && !(wasPunished && !game.uball))
        monster.mavenge = 1;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, game, { resident: currentShopResident(game) });
    unlinkObject(object, game);
    await finishInventoryRemoval(object, game);
    if (game.program_state?.gameover)
        return { outcome: 'vanished' };
    observeObjectForNaming(object);
    const stolenObjectDescription = await inventoryItemDescription(object);
    const thief = charmed || (game._lastPlineKind === PLNMSG_MON_TAKES_OFF_ITEM
        && MONSTER_SYMBOL[monster.mnum] === 14) ? 'She' : subject;
    // urgent_pline() does not force a pager for its newly installed line.
    // It can first suspend while clearing the older worn-removal line; after
    // that acknowledgement, rloc() may append its own message to this one.
    await plineWithContinuation(`${thief} stole ${stolenObjectDescription}.`, { urgent: true });
    await reportHeroEncumbrance(game);
    const couldPetrify = object.otyp === CORPSE && touchPetrifies(object.corpsenm);
    object.how_lost = LOST_STOLEN;
    await addObjectToMonsterInventory(monster, object, game);
    if (couldPetrify && !((monster.misc_worn_check ?? 0) & W_ARMG)) {
        // C steal.c:605-608: minstapetrify() runs inside steal(); its
        // M_ATTK_AGR_DIED belongs to mhitm_ad_sedu()'s -1 case.
        await petrifyMonsterImmediately(monster, {
            creditHero: true,
            finishDeath: (target, death = {}) => finishHeroMonsterKill(target, target.mx, target.my, { ...death, showKillMessage: false, recordConduct: false }),
        });
        return { outcome: 'petrified' };
    }
    // C steal.c:611-612: steal() returns 0 while an involuntary delay is
    // still active; the thief can keep attacking and stays for its armor.
    return { outcome: 'stole', stolenName };
}
// C steal.c:stealarm(). The armor is already unworn; transfer
// waits until the removal delay finishes and requires the same nearby thief.
export async function finishDelayedArmorTheft(thief, object, state) {
    if (!state.inventory.includes(object))
        return;
    if (thief.dead || thief.mhp <= 0 || !state.level?.monsters.includes(thief)
        || dist2(thief.mx, thief.my, state.u.ux, state.u.uy) > 2
        || !MONSTER_ATTACKS[thief.mnum]?.some(attack => attack[1] === AD_SITM))
        return;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
    unlinkObject(object, state);
    await finishInventoryRemoval(object, state);
    observeObjectForNaming(object, { state });
    await plineWithContinuation(`${monsterName(thief, { state, capitalized: true })} steals ${await inventoryItemDescription(object)}!`);
    await addObjectToMonsterInventory(thief, object, state);
    await makeMonsterFlee(thief, { state, announce: false });
    if (!await reportMonsterTeleportRestriction(thief, { state }))
        await randomMonsterRelocation(thief, { state, flags: RLOC_MSG });
}
// C steal.c:stealgold() and somegold(); called from uhitm.c:mhitm_ad_sgld()'s
// hero branch.
export async function stealHeroGold(monster, state, publish, random, rollOne) {
    if (monster.mcan || MONSTER_SYMBOL[heroSpecies(state)] === MONSTER_SYMBOL[monster.mnum])
        return;
    const purse = state.inventory.find(object => object.otyp === GOLD_PIECE);
    const floor = state.level.objects[state.u.ux]?.[state.u.uy]?.find(object => object.otyp === GOLD_PIECE);
    if (floor && (!purse || floor.quan > purse.quan || random(5) === 0)) {
        unlinkObject(floor, state);
        await linkObjectToMonsterInventory(monster, floor, { state });
        await newsym(state.u.ux, state.u.uy);
        const steed = state.u.usteed;
        const species = steed ? steed.mnum : heroSpecies(state);
        const owner = steed ? possessiveName(monsterName(steed, { state, article: 'your' })) : 'your';
        const feet = monsterIsSlithy(species) ? 'coils'
            : makePlural(steed ? monsterFootName(species) : heroFootName(state)).replace(/^rear /, '');
        await publish(`${monsterName(monster, { state, capitalized: true })} quickly snatches some gold from ${state.u.levitating || state.u.flying ? 'beneath' : 'between'} ${owner} ${feet}!`);
        if (!purse || random(5) === 0)
            await fleeWithGold(monster, state, publish, random, rollOne);
        return;
    }
    if (!purse)
        return;
    const count = Math.min(purse.quan, someGold(heroGoldAmount(state), random));
    if (count === purse.quan)
        await removeHeroEquipment(purse, state);
    const stolen = detachHeroGold(state, count);
    if (!stolen)
        throw new Error('The leprechaun selected an absent purse.');
    await linkObjectToMonsterInventory(monster, stolen, { state });
    await publish('Your purse feels lighter.');
    await fleeWithGold(monster, state, publish, random, rollOne);
    state.context.botl = true;
}
// C steal.c:somegold().
export function someGold(amount, random) {
    const gold = Math.min(amount, LARGEST_INT);
    if (gold < 50)
        return gold;
    const minimum = gold < 100 ? 25 : gold < 500 ? 50 : gold < 1000 ? 100
        : gold < 5000 ? 500 : gold < 10000 ? 1000 : 5000;
    return minimum + random(gold - minimum + 1);
}
async function fleeWithGold(monster, state, publish, random, rollOne) {
    if (!await reportMonsterTeleportRestriction(monster, { state, publish }))
        await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
    await makeMonsterFlee(monster, { state, announce: false, publish, random, rollOne });
}
// C steal.c:mpickobj(). Carrying effects precede merging; engulfing snuffs
// the surviving object.
async function prepareMonsterPickup(monster, object, state) {
    if (state._thrownObject === object)
        state._thrownObject = null;
    else if (state._kickedObject === object)
        state._kickedObject = null;
    removeObjectAndContentsFromBill(object, state);
    const snuff = objectShedsLight(object) && monsterCanEngulf(monster);
    if (snuff && state.u.uswallow && state.u.ustuck === monster && !heroIsBlind(state)) {
        observeObjectForNaming(object, { state });
        const noun = objectName(object, state);
        const name = definiteName(object.quan > 1 ? pluralizeObjectNoun(object, noun) : noun, state);
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        await plineWithContinuation(`${subject} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out.`);
    }
    object.no_charge = false;
    if (!monster.mtame && monster !== state.u?.ustuck
        && !canSeeMonster(monster)) {
        forgetObjectKnowledge(object);
    }
    if (!monster.mtame) {
        if (object.how_lost === LOST_THROWN)
            object.how_lost = LOST_STOLEN;
        else if (object.how_lost === LOST_DROPPED)
            object.how_lost = LOST_NONE;
    }
    attachCursedFigurineTimer(object, state);
    return snuff;
}
// C steal.c:mpickobj().
export async function addObjectToMonsterInventory(monster, object, state = game, { atFront = true } = {}) {
    requireLiveGame(state);
    if (!monster)
        return null;
    if (!object) {
        await impossible(`monster (${monsterTypeName(monster.mnum, !!monster.female)}) taking or picking up nothing?`, { state });
        return null;
    }
    if (object === state.uball || object === state.uchain) {
        const part = object === state.uchain ? 'chain' : 'ball';
        await impossible(`monster (${monsterTypeName(monster.mnum, !!monster.female)}) taking or picking up attached ${part} (${simpleObjectName(object, state)})?`, { state });
        return null;
    }
    const extinguish = await prepareMonsterPickup(monster, object, state);
    const carried = await linkObjectToMonsterInventory(monster, object, { atFront, state });
    if (extinguish && monster.mx > 0)
        snuffLightSource(monster.mx, monster.my, state);
    return carried;
}
export async function addCreatedObjectToMonsterInventory(monster, object, state = game, { atFront = true } = {}) {
    assertCreatedObject(object, state);
    const extinguish = await prepareMonsterPickup(monster, object, state);
    const carried = await linkCreatedObjectToMonsterInventory(monster, object, { atFront, state });
    if (extinguish && monster.mx > 0)
        snuffLightSource(monster.mx, monster.my, state);
    return carried;
}
// C steal.c:stealamulet() and worn_item_removal().
export async function stealHeroQuestObject(monster, state, publish, random, rollOne) {
    const object = chooseQuestTheftTarget(monster, state, rollOne);
    if (!object)
        return;
    if ((object === state.uarm || object === state.uarmu) && state.uarmc)
        await removeForQuestTheft(monster, state.uarmc, state, publish);
    if (object === state.uarmu && state.uarm)
        await removeForQuestTheft(monster, state.uarm, state, publish);
    if ((object === state.uarmg || (object === state.uright || object === state.uleft) && state.uarmg)
        && state.uwep) {
        if (state.u.twoweap && state.uswapwep)
            await removeForQuestTheft(monster, state.uswapwep, state, publish);
        if (state.uwep)
            await removeForQuestTheft(monster, state.uwep, state, publish);
    }
    if ((object === state.uright || object === state.uleft) && state.uarmg)
        await removeForQuestTheft(monster, state.uarmg, state, publish);
    if (object.owornmask)
        await removeForQuestTheft(monster, object, state, publish);
    if (state.program_state.gameover)
        return;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
    unlinkObject(object, state);
    await finishInventoryRemoval(object, state);
    if (state.program_state.gameover)
        return;
    observeObjectForNaming(object, { state });
    const name = await inventoryItemDescription(object);
    await addObjectToMonsterInventory(monster, object, state);
    await publish(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} steals ${name}!`);
    if (((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x02000000)
        && !await reportMonsterTeleportRestriction(monster, { state, publish }))
        await randomMonsterRelocation(monster, { state, flags: RLOC_MSG, random, rollOne });
    await reportHeroEncumbrance(state);
}
function chooseQuestTheftTarget(monster, state, rollOne) {
    let candidates = state.inventory.filter(object => artifactById(object.oartifact, state)?.questArtifact);
    if (!candidates.length) {
        const possessions = state.u.uhave;
        const [real, fake] = possessions.amulet ? [AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR]
            : possessions.bell ? [BELL_OF_OPENING, BELL]
                : possessions.book ? [SPE_BOOK_OF_THE_DEAD, 0]
                    : possessions.menorah ? [CANDELABRUM_OF_INVOCATION, 0] : [0, 0];
        if (!real)
            return undefined;
        candidates = state.inventory.filter(object => object.otyp === real
            || object.otyp === fake && !monster.iswiz);
    }
    return candidates[candidates.length > 1 ? rollOne(candidates.length) - 1 : 0];
}
async function removeForQuestTheft(monster, object, state, publish) {
    observeObjectForNaming(object, { state });
    const description = (await inventoryItemDescription(object))
        .replace(/^(?:the|an|a) /, object === state.uchain ? 'the ' : 'your ')
        .replace(' (being worn)', '').replace(' (alternate weapon; not wielded)', '')
        .replace(/ \(on (left|right) hand\)/, ' (from $1 hand)');
    const mask = object.owornmask ?? 0;
    const verb = mask & W_WEAPONS ? 'disarms' : mask & W_ACCESSORY ? 'removes' : 'takes off';
    await publish(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} ${verb} ${description}.`);
    await removeWornHeroItem(object, state);
}
// C steal.c:maybe_absorb_item(). A mimic can take a carried or flying item.
const ABSORB_ROCK_CLASS = 14;
export async function maybeAbsorbItem(monster, object, state = game, ordinaryChance = 50, artifactChance = 10) {
    if (object === state.uball || object === state.uchain || object.oclass === ABSORB_ROCK_CLASS
        || objectResistsDestruction(object, 100 - ordinaryChance, 100 - artifactChance)
        || !monsterCanTouchArtifact(monster, object, state))
        return;
    if (object.where === 'inventory') {
        if (object.owornmask)
            await removeWornHeroItem(object, state);
        if (state.program_state.gameover)
            return;
        if (object.unpaid)
            removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
        observeObjectForNaming(object, { state });
        const name = ownedObjectName(object, state, { capitalized: false });
        if (cansee(monster.mx, monster.my)) {
            const subject = monsterName(monster, { capitalized: true, augmentIt: true, state });
            await plineWithContinuation(`${subject} pulls ${name} away from you and absorbs ${object.quan > 1 ? 'them' : 'it'}!`);
        }
        else {
            const hand = heroHandName(state);
            const hands = isBimanualObject(object) ? makePlural(hand) : hand;
            const subject = name.charAt(0).toUpperCase() + name.slice(1);
            await plineWithContinuation(`${subject} ${objectNameIsPlural(object, state) ? 'are' : 'is'} pulled from your ${hands}!`);
        }
        await freeInventoryObject(object, state);
        if (state.program_state.gameover)
            return;
        await reportHeroEncumbrance(state);
    }
    else if (canSpotMonster(monster)) {
        observeObjectForNaming(object, { state });
        const subject = monsterName(monster, { capitalized: true, state });
        await plineWithContinuation(`${subject} absorbs ${ownedObjectName(object, state, { capitalized: false })}!`);
    }
    await addObjectToMonsterInventory(monster, object, state);
}
// C steal.c:mdrop_obj().
export async function dropMonsterObject(monster, object, state = game, { verbosely = false, publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const x = monster.mx, y = monster.my;
    const worn = object.owornmask ?? 0;
    const name = await distantDropObjectName(object, state);
    if (!await removeObjectFromMonsterInventory(monster, object, state, {
        doExtrinsics: false, silently: true, publish,
    }))
        return null;
    if ((worn & W_SADDLE) && monster.mtame && !object.unpaid
        && costlySpot(x, y, state)
        && roomsAt(level, state.u.ux, state.u.uy, SHOPBASE)
            .includes(level.at(x, y)?.roomno ?? 0)) {
        object.no_charge = true;
    }
    if (verbosely && cansee(x, y))
        await publish(`${monsterName(monster, { state, capitalized: true })} drops ${name}.`);
    const landed = await landFloorObject(object, x, y, {
        state, publish, random,
    });
    // Losing a saddle can kill its rider. Keep the dropped item in the world
    // before dismounting, so a resulting bones file can include it.
    if (!state.program_state?.gameover && monster.mhp > 0 && worn)
        await updateMonsterEquipment(monster, object, false, state, {
            silently: true, publish,
        });
    return landed;
}
async function distantDropObjectName(object, state) {
    observeDistantObjectForNaming(object, state);
    return await inventoryItemDescription(inventoryItem(object));
}
// C steal.c:mdrop_special_objs().
export async function dropSpecialMonsterObjects(monster, state = game, { publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const questArtifact = artifactByName(state.urole?.artifactName);
    const dropped = [];
    for (const object of [...(monster.minvent || monster.inventory || [])]) {
        if (!objectResistsDestruction(object, 0, 0, random)
            && !(questArtifact && object.oartifact === questArtifact.id))
            continue;
        if (monster.mx) {
            const landed = await dropMonsterObject(monster, object, state, { publish, random });
            if (landed)
                dropped.push(landed);
        }
        else {
            await removeObjectFromMonsterInventory(monster, object, state, {
                silently: true, publish,
            });
            await relocateObjectRandomly(object, { state, publish, random });
            if (object.where !== 'gone')
                dropped.push(object);
        }
    }
    return dropped;
}
// C steal.c:relobj(). Pets keep their worn gear and useful tools.
export async function releaseMonsterInventory(monster, state = game, { isPet = false, show = true, publish = plineWithContinuation, random = rn2, } = {}) {
    requireLiveGame(state);
    const gameWasOver = state.program_state.gameover;
    const x = monster.mx, y = monster.my;
    const inventory = () => monster.minvent || monster.inventory || [];
    const gold = monster.isgd && inventory().find(object => object.otyp === GOLD_PIECE);
    if (gold) {
        if (canSpotMonster(monster)) {
            const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
            await publish(`${owner} gold ${canSeeMonster(monster)
                ? 'vanishes' : 'seems to vanish'}.`);
        }
        unlinkMonsterObject(monster, gold);
        await deleteObject(gold, state);
    }
    const dropped = [];
    for (let object; (object = isPet ? petDroppableObject(monster) : inventory()[0]);) {
        const landed = await dropMonsterObject(monster, object, state, {
            verbosely: isPet && state.flags?.verbose !== false, publish, random,
        });
        if (landed)
            dropped.push(landed);
        if (!gameWasOver && state.program_state.gameover)
            return dropped;
    }
    if (show && cansee(x, y))
        await newsym(x, y);
    return dropped;
}
//# sourceMappingURL=steal.js.map