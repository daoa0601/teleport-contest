// Traps triggered while opening or disarming containers.
// C ref: trap.c chest_trap().
import { makeHallucinated, makeStunned } from './hero_mental_status.js';
import { heroIsHallucinating } from './senses.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { A_CON, A_DEX, A_STR, Upolyd, W_BALL } from './const.js';
import { bot, plineWithContinuation, shieldeff, } from './display.js';
import { triggerHeroFireTrap } from './fire_trap.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { wakeMonstersNear } from './monster_wake.js';
import { deleteObject, deleteObjectContents, } from './object_delete.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { poisonHero } from './poison.js';
import { createPoisonGasCloud } from './regions.js';
import { d, rn2 } from './rng.js';
import { costlySpot, shopObjectUnitCost, unpaidObjectCost, } from './shk.js';
import { heroIsBlind } from './senses.js';
import { destroyElectricInventory } from './zap.js';
const BLIND_GAS = [
    'humid', 'odorless', 'pungent', 'chilling', 'acrid', 'biting',
];
const GAS_COLORS = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'colorless', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];
function objectName(object) {
    return object?.name || OBJECT_NAMES[object?.otyp ?? -1] || 'container';
}
function quantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
function containerLocation(container, state) {
    if (container.where === 'floor')
        return { x: container.ox, y: container.oy };
    const location = { x: state.u.ux, y: state.u.uy };
    container.ox = location.x;
    container.oy = location.y;
    return location;
}
function damageHero(amount, state) {
    state.context.botl = true;
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(0, (state.u[hitPoints] ?? 1) - amount);
}
function halfPhysicalDamage(amount, state) {
    return state.u?.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}
async function clearPunishment(state) {
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (chain)
        await deleteObject(chain, state);
    if (ball) {
        ball.owornmask = (ball.owornmask ?? 0) & ~W_BALL;
        ball.worn = false;
    }
    state.uball = null;
    state.uchain = null;
    if (state.u) {
        state.u.uball = null;
        state.u.uchain = null;
        state.u.punished = false;
    }
}
function destroyedShopValue(objects, resident, state) {
    let loss = 0;
    for (const object of objects) {
        if (!object || object.no_charge)
            continue;
        const billed = unpaidObjectCost(object, state);
        loss += billed || shopObjectUnitCost(object, resident, state)
            * quantity(object);
    }
    return loss;
}
async function settleExplosionDamage(location, objects, state, publish) {
    const spot = costlySpot(location.x, location.y, state);
    if (!spot)
        return 0;
    const loss = destroyedShopValue(objects, spot.resident, state);
    if (!loss)
        return 0;
    const heroRoom = state.level?.at?.(state.u.ux, state.u.uy)?.roomno;
    if (heroRoom === spot.roomno) {
        spot.resident.eshk.debit = (spot.resident.eshk.debit ?? 0) + loss;
        await publish(`You owe ${loss} zorkmids for objects destroyed.`);
    }
    else {
        spot.resident.eshk.robbed = (spot.resident.eshk.robbed ?? 0) + loss;
        spot.resident.eshk.surcharge = true;
        spot.resident.mpeaceful = 0;
        await publish(`You caused ${loss} zorkmids worth of damage!`);
    }
    return loss;
}
async function explodeContainer(container, location, state, publish, rollDice) {
    await publish(`The ${objectName(container)} explodes!`);
    const contents = [...(container.contents || [])];
    const pile = [...(state.level?.objects?.[location.x]?.[location.y] || [])];
    const destroyed = [...new Set([container, ...contents, ...pile])];
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if ((ball && pile.includes(ball)) || (chain && pile.includes(chain)))
        await clearPunishment(state);
    await deleteObjectContents(container, state);
    let containerDestroyed = false;
    for (const object of pile) {
        if (objectResistsDestruction(object, 0, 0))
            continue;
        if (object === container)
            containerDestroyed = true;
        await deleteObject(object, state);
    }
    wakeMonstersNear(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state);
    const damage = halfPhysicalDamage(rollDice(6, 6), state);
    damageHero(damage, state);
    await exerciseAttribute(A_STR, false, state);
    await settleExplosionDamage(location, destroyed, state, publish);
    return { outcome: 'explosion', damage, destroyed: containerDestroyed };
}
async function releaseNoxiousGas(container, location, state, publish, random, rollDice) {
    await publish(`A cloud of noxious gas billows from the ${objectName(container)}.`);
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
    await publish(`You feel a needle prick your ${bodyPart}.`);
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
        damage = 0;
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
    endVoluntaryMultiTurn(state);
    state._helplessTurns = duration;
    state._helplessReason = 'frozen by a trap';
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
    return { outcome: 'paralysis', duration, destroyed: false };
}
async function confuseHero(container, state, publish, random) {
    const blind = heroIsBlind(state);
    const description = blind
        ? BLIND_GAS[random(BLIND_GAS.length)]
        : GAS_COLORS[random(GAS_COLORS.length)];
    await publish(`A cloud of ${description} gas billows from the ${objectName(container)}.`);
    const alreadyStunned = state.u?.stunned
        || (state.u?.stunnedTurns ?? 0) > 0;
    const hallucinating = heroIsHallucinating(state);
    if (!alreadyStunned) {
        if (hallucinating)
            await publish('What a groovy feeling!');
        else
            await publish('You stagger...');
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
export async function triggerChestTrap(container, { state = game, disarm = false, bodyPart = 'hand', random = rn2, rollDice = d, publish = plineWithContinuation, } = {}) {
    if (!container?.otrapped)
        return null;
    const location = containerLocation(container, state);
    container.tknown = false;
    container.otrapped = false;
    await publish(`You ${disarm ? 'set it off' : 'trigger a trap'}!`);
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
    if (!result.destroyed && !result.died) {
        await bot();
        container.tknown = true;
    }
    return result;
}
//# sourceMappingURL=chest_trap.js.map