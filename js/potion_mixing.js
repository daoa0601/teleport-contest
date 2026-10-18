import { exerciseAttribute } from './attrib.js';
import { A_STR, BOLT_LIM } from './const.js';
import { displayColorName, plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { freeInventoryObject, useUpInventoryStack } from './hero_inventory.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { mkobj } from './mklev.js';
import { wakeMonstersNear } from './monster_wake.js';
import { tryCallObjectType } from './object_call.js';
import { deleteObject } from './object_delete.js';
import { observeObject } from './object_knowledge.js';
import { unlinkObject } from './object_location.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { ALCHEMY_SMOCK, OBJECT_DESCRIPTIONS, OBJECT_MAGIC, OBJECT_NAMES, POT_ACID, POT_BLINDNESS, POT_BOOZE, POT_CONFUSION, POT_ENLIGHTENMENT, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HALLUCINATION, POT_HEALING, POT_LEVITATION, POT_OIL, POT_SEE_INVISIBLE, POT_SICKNESS, POT_SPEED, POT_WATER, UNICORN_HORN } from './object_data.js';
import { simpleObjectName } from './objnam.js';
import { applySupportedPotionVapor, heroPotionVaporProfile } from './potion_hit.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject } from './shk.js';
import { nearCapacity } from './weight.js';
import { pickupBurden } from './lift_object.js';
const AMETHYST = OBJECT_NAMES.indexOf('amethyst');
export async function mixPotions(object, potion) {
    requirePlayingGame(game);
    const mixture = mixtureType(object, potion);
    const magic = mixture ? OBJECT_MAGIC[mixture]
        : OBJECT_MAGIC[object.otyp] || OBJECT_MAGIC[potion.otyp];
    const count = objectQuantity(object);
    let amount = count;
    if (count > (object.odiluted ? 2 : magic ? 3 : 7)) {
        amount = object.odiluted ? 2 : magic ? rnd(Math.min(count, 8) - 2) + 2 : rnd(count - 6) + 6;
    }
    let prefix = 'The';
    if (amount < count) {
        const split = splitObjectStack(object, amount);
        if (!split)
            throw new Error(`Cannot dip ${amount} bottles from a stack of ${count}`);
        object = split;
        prefix = `${amount} of the`;
    }
    await pline(`${prefix} ${simpleObjectName(object)} ${amount === 1 ? 'mixes' : 'mix'} with ${objectQuantity(potion) > 1 ? 'one of ' : ''}the ${simpleObjectName(potion)}...`);
    await consumeInventoryItem(potion);
    if (await mixtureExplodes(object, amount + rnd(9)))
        return;
    object.blessed = false;
    object.cursed = false;
    object.buc = 'uncursed';
    object.bknown = false;
    if (heroIsBlind() || heroIsHallucinating())
        object.dknown = false;
    if (mixture)
        object.otyp = mixture;
    else {
        switch (object.odiluted ? 1 : rnd(8)) {
            case 1:
                object.otyp = POT_WATER;
                break;
            case 2:
            case 3:
                object.otyp = POT_SICKNESS;
                break;
            case 4: {
                const randomPotion = await mkobj(8, false);
                object.otyp = randomPotion.otyp;
                if (object.otyp === POT_OIL)
                    object.age = randomPotion.age;
                await deleteObject(randomPotion);
                break;
            }
            default:
                await useUpInventoryStack(object);
                await pline(`The mixture ${heroIsBlind() ? '' : 'glows brightly and '}evaporates.`);
                return;
        }
    }
    object.odiluted = object.otyp !== POT_WATER;
    if (object.otyp === POT_WATER && !heroIsHallucinating())
        await pline(`The mixture bubbles${heroIsBlind() ? '' : ', then clears'}.`);
    else if (!heroIsBlind())
        await pline(`The mixture looks ${potionColor(object)}.`);
    await freeInventoryObject(object);
    await holdPotion(object, 'You drop');
}
export async function neutralizePotion(object, potion) {
    if (object.otyp !== UNICORN_HORN && object.otyp !== AMETHYST)
        return false;
    const mixture = mixtureType(object, potion);
    if (!mixture)
        return false;
    const oldType = potion.otyp;
    const oldKnown = !!potion.dknown;
    const oldColor = oldKnown ? `${potionColor(potion)} ` : '';
    const several = objectQuantity(potion) > 1;
    let single = potion;
    if (several) {
        const split = splitObjectStack(potion, 1);
        if (!split)
            throw new Error('Cannot separate the potion being neutralized');
        single = split;
    }
    await chargeAlteredUnpaidObject(single, 'neutralize');
    single.otyp = mixture;
    single.blessed = false;
    single.cursed = mixture === POT_WATER ? false : !!object.cursed;
    single.buc = single.cursed ? 'cursed' : 'uncursed';
    if (mixture === POT_WATER)
        single.odiluted = false;
    single.bknown = false;
    single.dknown = false;
    if (!heroIsBlind()) {
        if (!heroIsHallucinating())
            observeObject(single);
        const change = mixture === POT_WATER && single.dknown ? 'clears' : `turns ${potionColor(single)}`;
        await pline(`The ${oldColor}potion${several ? ' that you dipped into' : ''} ${change}.`);
        if (oldKnown) {
            // docall's temporary object describes the old liquid, whose
            // identity must remain available after the real bottle changes.
            await tryCallObjectType({ ...single, otyp: oldType, dknown: true });
        }
    }
    await holdPotion(single, 'You juggle and drop');
    return true;
}
async function holdPotion(potion, dropPrefix) {
    const burden = game.flags.pickup_burden;
    game.flags.pickup_burden = Math.max(nearCapacity(game), pickupBurden(game));
    const description = inventoryItemDescription(potion);
    unlinkObject(potion);
    try {
        await holdAnotherObject(potion, { dropMessage: `${dropPrefix} ${description}!` });
    }
    finally {
        if (burden === undefined)
            delete game.flags.pickup_burden;
        else
            game.flags.pickup_burden = burden;
    }
}
async function mixtureExplodes(object, damage) {
    if (!(object.cursed || object.otyp === POT_ACID || object.otyp === POT_OIL && object.lamplit
        || !rn2(game.uarmc?.otyp === ALCHEMY_SMOCK ? 30 : 10)))
        return false;
    object.in_use = true;
    await pline(`${heroIsDeaf() ? '' : 'BOOM!  '}They explode!`);
    wakeMonstersNear(game.u.ux, game.u.uy, (BOLT_LIM + 1) * (BOLT_LIM + 1));
    await exerciseAttribute(A_STR, false);
    if (heroPotionVaporProfile(game).canReceive)
        await applySupportedPotionVapor({ potion: object });
    await useUpInventoryStack(object);
    await loseHeroHp(damage, 'alchemic blast');
    return true;
}
function potionColor(potion) {
    return displayColorName(game.objectDescriptions?.[potion.otyp] ?? OBJECT_DESCRIPTIONS[potion.otyp]);
}
function mixtureType(first, second) {
    let left = first.otyp, right = second.otyp;
    if (first.oclass === 8 && [POT_GAIN_LEVEL, POT_GAIN_ENERGY, POT_HEALING, POT_EXTRA_HEALING,
        POT_FULL_HEALING, POT_ENLIGHTENMENT, POT_FRUIT_JUICE].includes(right)) {
        left = second.otyp;
        right = first.otyp;
    }
    switch (left) {
        case POT_HEALING:
            if (right === POT_SPEED)
                return POT_EXTRA_HEALING;
            // Healing also follows the higher-healing and horn recipes below.
            break;
        case POT_GAIN_LEVEL:
        case POT_GAIN_ENERGY:
            switch (right) {
                case POT_CONFUSION: return rn2(3) ? POT_BOOZE : POT_ENLIGHTENMENT;
                case POT_HEALING: return POT_EXTRA_HEALING;
                case POT_EXTRA_HEALING: return POT_FULL_HEALING;
                case POT_FULL_HEALING: return POT_GAIN_ABILITY;
                case POT_FRUIT_JUICE: return POT_SEE_INVISIBLE;
                case POT_BOOZE: return POT_HALLUCINATION;
                default: return null;
            }
        case POT_FRUIT_JUICE:
            switch (right) {
                case POT_SICKNESS: return POT_SICKNESS;
                case POT_ENLIGHTENMENT:
                case POT_SPEED: return POT_BOOZE;
                case POT_GAIN_LEVEL:
                case POT_GAIN_ENERGY: return POT_SEE_INVISIBLE;
                default: return null;
            }
        case POT_ENLIGHTENMENT:
            if (right === POT_LEVITATION)
                return rn2(3) ? POT_GAIN_LEVEL : null;
            if (right === POT_FRUIT_JUICE)
                return POT_BOOZE;
            if (right === POT_BOOZE)
                return POT_CONFUSION;
            return null;
        case AMETHYST: return right === POT_BOOZE ? POT_FRUIT_JUICE : null;
        case POT_EXTRA_HEALING:
        case POT_FULL_HEALING:
        case UNICORN_HORN: break;
        default: return null;
    }
    if (left !== UNICORN_HORN && (right === POT_GAIN_LEVEL || right === POT_GAIN_ENERGY)) {
        return left === POT_HEALING ? POT_EXTRA_HEALING
            : left === POT_EXTRA_HEALING ? POT_FULL_HEALING : POT_GAIN_ABILITY;
    }
    if (right === POT_SICKNESS)
        return POT_FRUIT_JUICE;
    return [POT_HALLUCINATION, POT_BLINDNESS, POT_CONFUSION].includes(right) ? POT_WATER : null;
}
//# sourceMappingURL=potion_mixing.js.map