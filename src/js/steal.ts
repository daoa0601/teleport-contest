// Hero item theft by monsters.
// C ref: steal.c — steal(), stealarm(), worn_item_removal().

import { game, requireInitializedGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type {
    HeroContactAttack, MonsterAction, MonsterCallLog, RandomBelow,
} from './monster_action_types.js';
import type { MessagePublisher } from './pline.js';
import type { rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { plineWithContinuation } from './pline.js';
import {
    M_ATTK_AGR_DONE, M_ATTK_AGR_DIED, LARGEST_INT, PLNMSG_MON_TAKES_OFF_ITEM,
    TT_BURIEDBALL, W_ACCESSORY, W_ARMG, W_ARMOR, W_WEAPONS,
} from './const.js';
import { RLOC_MSG } from './const.js';
import { LOST_STOLEN } from './const.js';
import { canSeeMonster, canSpotMonster, newsym } from './display.js';
import { heroFootName, monsterFootName } from './body_parts.js';
import { monsterName, possessiveName } from './monster_name.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_SYMBOL, monsterIsAnimal, monsterIsSlithy,
} from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { AD_SEDU, AD_SITM, AD_SSEX } from './monster_attack_types.js';
import { BOULDER, CORPSE, GOLD_PIECE, LEASH, OBJECT_BIMANUAL, OBJECT_NAMES } from './object_data.js';
import { OBJECT_DELAY } from './object_data.js';
import {
    observeObjectForNaming, ownedObjectName,
} from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroSpecies } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { dist2 } from './hacklib.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { openHoldingTrap } from './trap_magic.js';
import { armorSimpleName, stopDonning } from './armor.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { isBeingTakenOff } from './takeoff_state.js';
import { monsterCanCarryObject } from './monster_carry.js';
import { releaseObjectLeash } from './monster_leash.js';
import { addObjectToMonsterInventory, linkObjectToMonsterInventory } from './monster_inventory.js';
import { unlinkObject } from './object_location.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { removeWornHeroItem } from './hero_equipment.js';
import {
    heroHasInvoluntaryDelay, nomul, pendingArmorAction,
} from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { removeObjectAndContentsFromBill, currentShopResident } from './shk.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { touchPetrifies } from './stoning.js';
import { petrifyMonsterImmediately } from './monster_stoning.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { makeMonsterFlee } from './monmove.js';
// C Some_Monnam(): unseen thieves are "Someone" or "Something".
function wornItemRemover(monster: Monster, state: GameState): string {
    return monsterName(monster, { state, capitalized: true, augmentIt: true });
}

async function wornTheftObjectDescription(object: GameObject): Promise<string> {
    // C steal.c:worn_item_removal() starts from doname(), then massages only
    // the ownership and equipment-location suffix for its pre-removal line.
    let description = (await inventoryItemDescription(object))
        .replace(/^(?:the|an|a) /, object === game.uchain ? 'the ' : 'your ')
        .replace(' (being worn)', '')
        .replace(' (alternate weapon; not wielded)', '');
    description = description.replace(
        / \(on (left|right) hand\)$/,
        ' (from $1 hand)',
    );
    return description;
}

function heroEquipmentSlots() {
    return [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ] as const;
}

const COIN_CLASS = 12;

// C steal.c:steal().  Inventory stacks are candidates as objects rather than
// by quantity.  Worn armor and accessories receive five tickets; weapons
// (including the primary and alternate weapon) still receive one.  Keep
// selection after an animal's hit message and before removal prose.
function selectHeroItemForTheft(
    state: PlayingGameState,
    random: RandomBelow,
    calls: MonsterCallLog,
) {
    const inventory = state?.inventory || [];
    const wornObjects = new Set(
        [
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
        ].filter(Boolean),
    );
    const candidates = [];
    let total = 0;
    for (const object of inventory) {
        if (object === state?.uskin || (object?.oclass ?? object?.class) === COIN_CLASS) continue;
        // When body armor is present, steal() omits the cloak from this
        // weighted pass; its later equipment-dependency rewrites remain
        // separate from candidate weighting.
        if (state?.uarm && object === state?.uarmc) continue;
        const wornMask = object?.owornmask ?? 0;
        const weighted = wornObjects.has(object) || !!(wornMask & (W_ARMOR | W_ACCESSORY));
        const weight = weighted ? 5 : 1;
        candidates.push({ object, weight });
        total += weight;
    }
    if (!total) return null;
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
function theftEquipmentTarget(object: GameObject, state: PlayingGameState): GameObject {
    if ((object === state.uleft || object === state.uright) && state.uarmg)
        object = state.uarmg;
    if (object === state.uarmg && state.uwep) return state.uwep;
    if (object === state.uarm && state.uarmc) return state.uarmc;
    if (object === state.uarmu) return state.uarmc || state.uarm || object;
    return object;
}
// C refs: steal.c:steal()/worn_item_removal(), uhitm.c:mhitm_ad_sedu().
// Animal hit feedback precedes selection; garment removal can suspend it.
// Removal prose is split here because urgent_pline() can suspend before the
// no-teleport check, fleeing state, and the rest of movemon().
export async function resolveDeferredHeroItemTheft(
    action: MonsterAction, monster: Monster, attack: HeroContactAttack, random: RandomBelow,
): Promise<boolean> {
    const game = requireInitializedGame();
    if (!attack?.deferredItemTheft) return false;
    attack.deferredItemTheft = false;
    const animal = monsterIsAnimal(monster);
    const wasPunished = !!game.uball;
    const draw = (limit: number): number => {
        action.calls.push(`rn2(${limit})`);
        return random(limit);
    };
    if (!animal && MONSTER_ATTACKS[heroSpecies(game)]?.some(
        attack => attack[1] === AD_SEDU || attack[1] === AD_SSEX,
    )) {
        const subject = monsterName(monster, { state: game, capitalized: true });
        await plineWithContinuation(`${subject} ${heroIsDeaf(game)
            ? "says something but you can't hear it"
            : (monster.minvent || monster.inventory || []).length ? 'brags about the goods some dungeon explorer provided'
                : 'makes some remarks about how difficult theft is lately'}.`);
        if (!await reportMonsterTeleportRestriction(monster, { state: game }))
            await randomMonsterRelocation(monster, { calls: action.calls, flags: RLOC_MSG });
        attack.attackerDone = true;
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_AGR_DONE;
        return true;
    }
    if (monster.mcan) {
        if (animal) return false;
        if (!heroIsBlind(game)) {
            const subject = monsterName(monster, { state: game,
                capitalized: true, adjective: 'plain' });
            await plineWithContinuation(`${subject} tries to ${game.flags.female
                ? 'charm' : 'seduce'} you, but you seem ${game.flags.female
                ? 'unaffected' : 'uninterested'}.`);
        }
        if (draw(3)) {
            if (!await reportMonsterTeleportRestriction(monster, { state: game }))
                await randomMonsterRelocation(monster, { calls: action.calls, flags: RLOC_MSG });
            attack.attackerDone = true;
            attack.contactDone = true;
            attack.nativeResult = M_ATTK_AGR_DONE;
        }
        return false;
    }
    if (dist2(monster.mx, monster.my, game.u.ux, game.u.uy) > 2) return false;
    const seenBeforeRemoval = canSpotMonster(monster);
    // C steal() keeps Some_Monnam() from before any removal; an unseen thief
    // named by a hallucinating hero takes a random someone/something.
    let subject = monsterName(monster, { state: game, capitalized: true, augmentIt: true });
    const meal = game.context.victual;
    if (game._occupation?.key === 'eat-food' && meal && meal.usedtime >= meal.reqtime) {
        await stopHeroOccupation(game);
        if (game.program_state.gameover) return true;
    }
    const adornment = !animal && !game.uarmg
        ? [game.uleft, game.uright].find(ring => ring?.otyp === OBJECT_NAMES.indexOf('adornment'))
        : null;
    let object = adornment ?? selectHeroItemForTheft(game, random, action.calls);
    const throwsRocks = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x08000000);
    let retriedBoulder = false;
    while (object) {
        if (game._armorTheft?.object === object)
            return false;
        if (object.otyp !== BOULDER || throwsRocks || retriedBoulder) break;
        retriedBoulder = true;
        object = selectHeroItemForTheft(game, random, action.calls);
    }
    if (!object) {
        if (!animal && game.uchain && draw(4)) {
            await plineWithContinuation(`${wornItemRemover(monster, game)} takes off ${
                await wornTheftObjectDescription(game.uchain)}.`);
            await removeWornHeroItem(game.uchain, game);
        } else if (!animal && game.u.utrap && game.u.utraptype === TT_BURIEDBALL && !draw(4)) {
            await plineWithContinuation(`${subject} takes off your unseen chain.`);
            await openHoldingTrap(game.u, { state: game });
        } else await plineWithContinuation(heroIsBlind(game)
            ? 'Somebody tries to rob you, but finds nothing to steal.'
            : game.inventory.some(item => item.oclass === 12)
                ? `${subject} tries to rob you, but isn't interested in gold.`
                : `${subject} tries to rob you, but there is nothing to steal!`);
        await retreatAfterItemTheft(action, monster, attack, animal);
        return true;
    }
    if (!game.inventory.includes(object)) return false;

    const equipmentSlots = heroEquipmentSlots();
    const occupiedSlots = equipmentSlots.filter(slot => game[slot] === object);
    const weaponMask = object?.owornmask ?? 0;
    const wasWeapon = occupiedSlots.some(slot =>
        ['uwep', 'uswapwep', 'uquiver'].includes(slot))
        || !!(weaponMask & W_WEAPONS)
        || object.wielded || object.alternate || object.ready;
    const wasAccessory = occupiedSlots.some(slot =>
        ['uleft', 'uright', 'uamul', 'ublindf'].includes(slot))
        || !!(weaponMask & W_ACCESSORY);
    const wasWorn = occupiedSlots.length > 0
        || object.worn || weaponMask !== 0;
    const wornArmor = occupiedSlots.some(slot => slot.startsWith('uarm'));
    const refuse = async (): Promise<boolean> => {
        const verbs = ['steal', 'snatch', 'grab', 'take'];
        const name = wornArmor ? `your ${armorSimpleName(object, game)}`
            : ownedObjectName(object, game, { capitalized: false });
        await plineWithContinuation(`${subject} tries to ${verbs[draw(4)]} ${name} but gives up.`);
        if (draw(Math.trunc(game.inventory.filter(item => item.oclass !== 12).length / 5) + 2) === 0) {
            await retreatAfterItemTheft(action, monster, attack, animal);
        }
        return false;
    };
    if (object.otyp === BOULDER && !throwsRocks) return refuse();
    if (animal) {
        let stuck = object === game.uball || (!!object.cursed && wasWorn
            && object !== game.uquiver && !(object === game.uswapwep && !game.u.twoweap));
        const weapon = game.uwep;
        const ring = object === game.uleft || object === game.uright;
        if (!stuck && ring && weapon && isWeldedPrimary(weapon, game)) {
            // C welded() reveals the curse even when the other hand is free.
            weapon.bknown = true;
            const primaryRing = game.u.rightHanded === false ? game.uleft : game.uright;
            stuck = object === primaryRing || !!OBJECT_BIMANUAL[weapon.otyp];
        }
        if (stuck || !monsterCanCarryObject(monster, object, game, draw)) return refuse();
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (animal && object.cursed) return refuse();
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
            if (delay >= 1 && draw(10)) return refuse();
        } else {
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
            } finally {
                object.cursed = cursed;
            }
            if ((game._helplessTurns ?? 0) > 0) {
                game._armorTheft = { thief: monster, object };
                game._afterMove = { kind: 'steal' };
                return false;
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
    if (removalItem !== object) await removeWornHeroItem(removalItem, game);
    await removeWornHeroItem(object, game);
    if (game.program_state?.gameover || !game.inventory.includes(object)) {
        attack.theftResolved = true;
        return true;
    }
    // steal() refreshes its cached name when removing worn gear restores
    // sight. The later retreat message in mhitm_ad_sedu() names the thief too.
    if (!seenBeforeRemoval && (wornArmor || wasAccessory) && canSpotMonster(monster))
        subject = monsterName(monster, { state: game, capitalized: true });
    // C yname() observes and names ownership before the shop bill is cleared.
    observeObjectForNaming(object);
    const stolenName = ownedObjectName(object, game, { capitalized: false });
    if (!heroHasConflict(game) && !(wasPunished && !game.uball)) monster.mavenge = 1;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, game, { resident: currentShopResident(game) });
    unlinkObject(object, game);
    await finishInventoryRemoval(object, game);
    if (game.program_state?.gameover) {
        attack.theftResolved = true;
        return true;
    }
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
        await petrifyMonsterImmediately(monster, {
            creditHero: true,
            finishDeath: (target, death = {}) => finishHeroMonsterKill(
                target, target.mx, target.my,
                { ...death, showKillMessage: false, recordConduct: false },
            ),
        });
        attack.nativeResult = M_ATTK_AGR_DIED;
        attack.contactDone = true;
        return true;
    }

    // steal() returns zero while an involuntary delay is still active.
    // The thief can keep attacking and must stay for any pending armor.
    attack.theftResolved = true;
    if (heroHasInvoluntaryDelay(game)) return true;
    await retreatAfterItemTheft(action, monster, attack, animal, stolenName);
    return true;
}

async function retreatAfterItemTheft(
    action: MonsterAction, monster: Monster, attack: HeroContactAttack,
    animal: boolean, stolenName?: string,
): Promise<void> {
    const game = requireInitializedGame();
    if (animal) {
        if (stolenName && canSeeMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { state: game,
                capitalized: true })} tries to run away with ${stolenName}.`);
    } else if (!await reportMonsterTeleportRestriction(monster, { state: game })) {
        const relocation = await randomMonsterRelocation(monster, {
            calls: action.calls, flags: RLOC_MSG,
        });
        if (relocation && 'died' in relocation && relocation.died) return;
    }
    const flight = await makeMonsterFlee(monster, { announce: false });
    if (flight.heroDied) return;
    attack.attackerDone = true;
    attack.contactDone = true;
    attack.nativeResult = M_ATTK_AGR_DONE;
}

// C steal.c:stealarm(). The armor is already unworn; transfer
// waits until the removal delay finishes and requires the same nearby thief.
export async function finishDelayedArmorTheft(thief: Monster, object: GameObject, state: GameState): Promise<void> {
    if (!state.inventory.includes(object)) return;
    if (thief.dead || thief.mhp <= 0 || !state.level?.monsters.includes(thief)
        || dist2(thief.mx, thief.my, state.u.ux, state.u.uy) > 2
        || !MONSTER_ATTACKS[thief.mnum]?.some(attack => attack[1] === AD_SITM)) return;
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
export async function stealHeroGold(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher,
    random: typeof rn2, rollOne: typeof rnd,
): Promise<void> {
    if (monster.mcan || MONSTER_SYMBOL[heroSpecies(state)] === MONSTER_SYMBOL[monster.mnum]) return;
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
        if (!purse || random(5) === 0) await fleeWithGold(monster, state, publish, random, rollOne);
        return;
    }
    if (!purse) return;
    const count = Math.min(purse.quan, someGold(heroGoldAmount(state), random));
    if (count === purse.quan) await removeHeroEquipment(purse, state);
    const stolen = detachHeroGold(state, count);
    if (!stolen) throw new Error('The leprechaun selected an absent purse.');
    await linkObjectToMonsterInventory(monster, stolen, { state });
    await publish('Your purse feels lighter.');
    await fleeWithGold(monster, state, publish, random, rollOne);
    state.context.botl = true;
}

// C steal.c:somegold().
export function someGold(amount: number, random: typeof rn2): number {
    const gold = Math.min(amount, LARGEST_INT);
    if (gold < 50) return gold;
    const minimum = gold < 100 ? 25 : gold < 500 ? 50 : gold < 1000 ? 100
        : gold < 5000 ? 500 : gold < 10000 ? 1000 : 5000;
    return minimum + random(gold - minimum + 1);
}

async function fleeWithGold(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher,
    random: typeof rn2, rollOne: typeof rnd,
): Promise<void> {
    if (!await reportMonsterTeleportRestriction(monster, { state, publish }))
        await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
    await makeMonsterFlee(monster, { state, announce: false, publish, random, rollOne });
}
