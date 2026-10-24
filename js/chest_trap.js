// Traps triggered while opening or disarming containers.
// C ref: trap.c chest_trap().
import { formatFeltMessage } from './hero_speech.js';
import { makeHallucinated, makeStunned } from './hero_mental_status.js';
import { heroHandName } from './body_parts.js';
import { heroSpecies } from './hero_species.js';
import { nomul } from './command_state.js';
import { exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { A_CON, A_DEX, A_STR, M_SEEN_ELEC } from './const.js';
import { currency } from './currency.js';
import { bot, displayMessageWindow, plineWithContinuation, randomColorName, shieldeff, } from './display.js';
import { triggerHeroFireTrap } from './fire_trap.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { staggerVerb } from './monster_hurtle.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { delobj, deleteObjectContents, } from './object_delete.js';
import { getObjectLocation } from './object_location.js';
import { definiteName, definiteObjectAction, objectCombatName } from './objnam.js';
import { poisonHero } from './poison.js';
import { unpunishHero } from './punishment.js';
import { createPoisonGasCloud } from './regions.js';
import { d, rn2 } from './rng.js';
import { costlySpot, insideShopRoomAt } from './shk.js';
import { makeAngryShopkeeper } from './shop_damage.js';
import { stolenValue } from './shop_loss.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { destroyElectricInventory } from './zap.js';
const BLIND_GAS = [
    'humid', 'odorless', 'pungent', 'chilling', 'acrid', 'biting',
];
function containerLocation(container, state) {
    const location = getObjectLocation(container, state);
    if (location) {
        container.ox = location.x;
        container.oy = location.y;
    }
    return { x: container.ox, y: container.oy };
}
function halfPhysicalDamage(amount, state) {
    return state.u?.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}
async function explodeContainer(container, location, state, publish, rollDice) {
    const spot = costlySpot(location.x, location.y, state);
    const insider = !!spot && !!insideShopRoomAt(state, state.u.ux, state.u.uy)
        && state.u.ushops?.[0] === spot.roomno;
    await publish(`${definiteObjectAction(container, 'explode', state)}!`);
    const killer = `exploding ${objectCombatName(container, { state, includeCorpseSpecies: false })}`;
    // Charge while the objects and their bills still exist, before damage
    // can end the game and settle the hero's debt through inheritance.
    let loss = spot ? await stolenValue(container, location.x, location.y, spot.resident.mpeaceful, { state, publish, silent: true }) : 0;
    await deleteObjectContents(container, state);
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if ((chain && chain.ox === location.x && chain.oy === location.y)
        || (ball?.where === 'floor' && ball.ox === location.x && ball.oy === location.y))
        await unpunishHero(state);
    let containerDestroyed = false;
    const pile = [...(state.level?.objects?.[location.x]?.[location.y] || [])];
    for (const object of pile) {
        if (spot)
            loss += await stolenValue(object, object.ox, object.oy, spot.resident.mpeaceful, { state, publish, silent: true });
        if (object === container)
            containerDestroyed = true;
        await delobj(object, state);
    }
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state, publish);
    const damage = halfPhysicalDamage(rollDice(6, 6), state);
    if (await loseHeroHp(damage, killer, { state, publish }))
        return { outcome: 'explosion', damage, destroyed: containerDestroyed, died: true };
    await exerciseAttribute(A_STR, false, state);
    if (spot && loss) {
        const money = `${loss} ${currency(loss, { state })}`;
        if (insider)
            await publish(`You owe ${money} for objects destroyed.`);
        else {
            await publish(`You caused ${money} worth of damage!`);
            await makeAngryShopkeeper(spot.resident, state);
        }
    }
    return { outcome: 'explosion', damage, destroyed: containerDestroyed };
}
async function releaseNoxiousGas(container, location, state, publish, random, rollDice) {
    await publish(`A cloud of noxious gas billows from ${definiteName(objectCombatName(container, { state, includeCorpseSpecies: false }), state)}.`);
    if (random(3) !== 0) {
        const poison = await poisonHero({
            reason: 'gas cloud',
            killer: 'cloud of poison gas',
            attribute: A_STR,
            fatal: 15,
            state,
            random,
            rollDice,
            publish,
        });
        if (poison.died)
            return { outcome: 'noxious-gas', destroyed: false, died: true };
    }
    else {
        await createPoisonGasCloud(state, location.x, location.y, 1, 8, random, publish);
    }
    await exerciseAttribute(A_CON, false, state);
    return { outcome: 'noxious-gas', destroyed: false };
}
async function prickHero(state, publish, random, rollDice, bodyPart) {
    await publish(formatFeltMessage(`a needle prick your ${bodyPart}.`, state));
    const poison = await poisonHero({
        reason: 'needle',
        killer: 'poisoned needle',
        attribute: A_CON,
        fatal: 10,
        state,
        random,
        rollDice,
        publish,
    });
    if (!poison.died)
        await exerciseAttribute(A_CON, false, state);
    return {
        outcome: 'poisoned-needle',
        damage: poison.damage,
        destroyed: false,
        died: poison.died,
    };
}
async function shockHero(state, publish, random, rollDice) {
    const originalDamage = rollDice(4, 4);
    let damage = originalDamage;
    await publish('You are jolted by a surge of electricity!');
    if (state.u?.shockResistance) {
        if (state === game)
            await shieldeff(state.u.ux, state.u.uy);
        await publish("You don't seem to be affected.");
        monstersObserveHeroResistance(M_SEEN_ELEC, state);
        damage = 0;
    }
    else {
        monstersForgetHeroResistance(M_SEEN_ELEC, state);
    }
    const items = await destroyElectricInventory(originalDamage, {
        state, publish, random,
    });
    if (items.heroDied)
        return { outcome: 'electric-shock', died: true };
    const died = damage > 0 && await loseHeroHp(damage, 'electric shock', { state, publish });
    return { outcome: 'electric-shock', damage, destroyed: false, died };
}
async function paralyzeHero(state, publish, rollDice) {
    if (heroHasFreeAction(state)) {
        await publish('You momentarily stiffen.');
        return { outcome: 'paralysis', duration: 0, destroyed: false };
    }
    await publish('Suddenly you are frozen in place!');
    const duration = rollDice(5, 6);
    nomul(-duration, state);
    state._helplessReason = 'frozen by a trap';
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
    return { outcome: 'paralysis', duration, destroyed: false };
}
async function confuseHero(container, state, publish, random) {
    const blind = heroIsBlind(state);
    const description = blind
        ? BLIND_GAS[random(BLIND_GAS.length)]
        : randomColorName(state, random);
    await publish(`A cloud of ${description} gas billows from ${definiteName(objectCombatName(container, { state, includeCorpseSpecies: false }), state)}.`);
    const alreadyStunned = state.u?.stunned
        || (state.u?.stunnedTurns ?? 0) > 0;
    const hallucinating = heroIsHallucinating(state);
    if (!alreadyStunned) {
        if (hallucinating)
            await publish('What a groovy feeling!');
        else {
            const movement = staggerVerb(heroSpecies(state)).replace(/s$/, '');
            const feeling = state.u.hallucinationResistance ? ''
                : blind ? ' and get dizzy' : ' and your vision blurs';
            await publish(`You ${movement}${feeling}...`);
        }
    }
    await makeStunned((state.u.stunnedTurns ?? 0) + 16 + random(7), { state, talk: false });
    await makeHallucinated((state.u.hallucinationTurns ?? 0) + 16 + random(5), {
        state, talk: false, publish,
    });
    return { outcome: 'stunning-gas', destroyed: false };
}
function luckSaveMessage(random) {
    const outcome = random(13);
    if (outcome >= 11)
        return 'explosive charge is a dud';
    if (outcome >= 9)
        return 'electric charge is grounded';
    if (outcome >= 7)
        return 'flame fizzles out';
    if (outcome >= 4)
        return 'poisoned needle misses';
    return 'gas cloud blows away';
}
function trapOutcome(luck, random) {
    if (random(20) === 0)
        return random(26);
    return luck >= 13 ? 0 : random(13 - luck);
}
export async function triggerChestTrap(container, { state = game, disarm = false, bodyPart = heroHandName(state), random = rn2, rollDice = d, publish = plineWithContinuation, } = {}) {
    if (!container?.otrapped)
        return null;
    const location = containerLocation(container, state);
    container.tknown = false;
    container.otrapped = false;
    await publish(`You ${disarm ? 'set it off' : 'trigger a trap'}!`);
    await displayMessageWindow();
    const luck = (state.u.uluck ?? 0) + (state.u.moreluck ?? 0);
    if (luck > -13 && random(13 + luck) > 7) {
        const message = luckSaveMessage(random);
        await publish(`But luckily the ${message}!`);
        container.tknown = true;
        return { outcome: 'luck-save', damage: 0, destroyed: false };
    }
    const outcome = trapOutcome(luck, random);
    let result;
    if (outcome >= 21) {
        result = await explodeContainer(container, location, state, publish, rollDice);
    }
    else if (outcome >= 17) {
        result = await releaseNoxiousGas(container, location, state, publish, random, rollDice);
    }
    else if (outcome >= 13) {
        result = await prickHero(state, publish, random, rollDice, bodyPart);
    }
    else if (outcome >= 9) {
        const fire = await triggerHeroFireTrap(container, { publish });
        result = { outcome: 'fire', destroyed: false, died: fire.died };
    }
    else if (outcome >= 6) {
        result = await shockHero(state, publish, random, rollDice);
    }
    else if (outcome >= 3) {
        result = await paralyzeHero(state, publish, rollDice);
    }
    else {
        result = await confuseHero(container, state, publish, random);
    }
    // C trap.c:6494-6497: bot() and tknown=1 run after surviving outcomes
    // (including a life-saved or declined death); done() never returns for a
    // real death, so a fatal outcome leaves tknown clear for the bones file.
    if (!result.destroyed && !result.died) {
        await bot();
        container.tknown = true;
    }
    return result;
}
//# sourceMappingURL=chest_trap.js.map