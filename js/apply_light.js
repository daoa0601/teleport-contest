// Applied fire sources. C apply.c:use_lamp(), use_candle(),
// use_candelabrum(), and light_cocktail(). Command admission belongs to doapply.
import { game, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { beginObjectBurn, endObjectBurn } from './light.js';
import { heroIsBlind } from './senses.js';
import { objectName, ownedObjectName } from './objnam.js';
import { heroFingerName } from './body_parts.js';
import { armorSimpleName } from './armor.js';
import { makePlural } from './object_grammar.js';
import { inventoryItemDescription } from './invent.js';
import { freeInventoryObject, useUpInventoryStack } from './hero_inventory.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { unlinkObject } from './object_location.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { addInventoryItem } from './u_init.js';
import { learnObjectType } from './object_knowledge.js';
import { heroIsOnStairs, isInvocationPosition } from './invocation_position.js';
import { promptYesNo } from './query.js';
import { billDummyObject, carriedObjectOwner, chargeUnpaidUsage, costlySpot, } from './shk.js';
import { impossible } from './diagnostics.js';
import { objectWeight } from './weight.js';
import { d, rn2 } from './rng.js';
import { setSlipperyHands } from './towel.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, MAGIC_LAMP, OBJECT_COST, OIL_LAMP, TALLOW_CANDLE, WAX_CANDLE, requireObjectData, } from './object_data.js';
function result(object, state) {
    return { spentTime: true, heroDied: !!state.program_state?.gameover, object };
}
function isCandle(object) {
    return object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
}
function underwater(state) {
    return !!(state.u.uinwater || state.underwater || state.u.underwater);
}
function lampOwner(object, state) {
    const owner = carriedObjectOwner(object, state);
    return owner.charAt(0).toUpperCase() + owner.slice(1); // C Shk_Your().
}
function theName(object, state) {
    const name = objectName(object, state);
    return `The ${objectQuantity(object) > 1 ? makePlural(name) : name}`;
}
async function announcePurchase(message) {
    // These apply.c verbalize() calls have no hearing/muteshk gate. The
    // separate usage-fee owner does check those before its own notice.
    await plineWithContinuation(`"${message}"`);
}
function splitCarriedObject(object, count, state) {
    const split = splitObjectStack(object, count, state);
    if (!split)
        throw new Error('Lighting requires a valid quantity to split from the stack.');
    return split;
}
export async function useLamp(object, { state = game } = {}) {
    requireLiveGame(state);
    const lamp = object.otyp === BRASS_LANTERN ? 'lantern'
        : [OIL_LAMP, MAGIC_LAMP].includes(object.otyp) ? 'lamp' : null;
    if (object.lamplit) {
        await plineWithContinuation(lamp ? `${lampOwner(object, state)} ${lamp} is now off.`
            : `You snuff out ${ownedObjectName(object, state, { capitalized: false })}.`);
        endObjectBurn(object, state);
        return result(object, state);
    }
    if (underwater(state)) {
        await plineWithContinuation(isCandle(object)
            ? "Sorry, fire and water don't mix." : 'This is not a diving lamp.');
        return result(object, state);
    }
    if (!isCandle(object) && object.age === 0 || object.otyp === MAGIC_LAMP && object.spe === 0) {
        await plineWithContinuation(object.otyp === BRASS_LANTERN
            ? heroIsBlind(state) ? 'Nothing seems to happen.' : 'Your lantern is out of power.'
            : `This ${objectName(object, state)} has no oil.`);
        return result(object, state);
    }
    if (object.cursed && rn2(2) === 0) {
        if ([OIL_LAMP, MAGIC_LAMP].includes(object.otyp) && rn2(3) === 0) {
            const gloves = state.uarmg || state.u.uarmg;
            const fingers = gloves ? armorSimpleName(gloves, state) : makePlural(heroFingerName(state));
            await plineWithContinuation(`The lamp spills and covers your ${fingers} with oil.`);
            setSlipperyHands((state.u.glibTurns ?? 0) + d(2, 10), state);
        }
        else
            await plineWithContinuation(heroIsBlind(state) ? 'Nothing seems to happen.'
                : `${theName(object, state)} ${objectQuantity(object) === 1 ? 'flickers' : 'flicker'} for a moment, then ${objectQuantity(object) === 1 ? 'dies' : 'die'}.`);
        return result(object, state);
    }
    if (lamp) {
        await chargeUnpaidUsage(object, { state });
        await plineWithContinuation(`${lampOwner(object, state)} ${lamp} is now on.`);
    }
    else {
        const owner = ownedObjectName(object, state);
        await plineWithContinuation(`${owner}${owner.endsWith('s') ? "'" : "'s"} flame${objectQuantity(object) > 1 ? 's burn' : ' burns'}${heroIsBlind(state) ? '.' : ' brightly!'}`);
        if (object.unpaid && costlySpot(state.u.ux, state.u.uy, state)
            && object.age === 20 * requireObjectData(OBJECT_COST, object.otyp)) {
            const pronoun = objectQuantity(object) > 1 ? 'them' : 'it';
            await announcePurchase(`You burn ${pronoun}, you bought ${pronoun}!`);
            await billDummyObject(object, state);
        }
    }
    beginObjectBurn(object, state);
    return result(object, state);
}
export async function useCandelabrum(object, { state = game } = {}) {
    requireLiveGame(state);
    const candles = object.spe === 1 ? 'candle' : 'candles';
    if (object.lamplit) {
        await plineWithContinuation(`You snuff the ${candles}.`);
        endObjectBurn(object, state);
        return result(object, state);
    }
    if (object.spe <= 0) {
        await plineWithContinuation(`This ${objectName(object, state)} has no ${candles}.`);
        if (state.inventory.some(isCandle))
            await plineWithContinuation(`To attach candles, apply them instead of the ${objectName(object, state)}.`);
        return result(object, state);
    }
    if (underwater(state)) {
        await plineWithContinuation('You cannot make fire under water.');
        return result(object, state);
    }
    if (state.u.uswallow || object.cursed) {
        if (!heroIsBlind(state))
            await plineWithContinuation(`The ${candles} ${object.spe === 1 ? 'flickers' : 'flicker'} for a moment, then ${object.spe === 1 ? 'dies' : 'die'}.`);
        return result(object, state);
    }
    if (object.spe < 7) {
        await plineWithContinuation(`There ${object.spe === 1 ? 'is' : 'are'} only ${object.spe} ${candles} in the ${objectName(object, state)}.`);
        if (!heroIsBlind(state))
            await plineWithContinuation(`${object.spe === 1 ? 'It is' : 'They are'} lit.  ${theName(object, state)} shines dimly.`);
    }
    else
        await plineWithContinuation(`${theName(object, state)}'s ${candles} burn${heroIsBlind(state) ? '.' : ' brightly!'}`);
    if (!isInvocationPosition(state.u.ux, state.u.uy, state) || heroIsOnStairs(state)) {
        await plineWithContinuation(`The ${candles} ${object.spe === 1 ? 'is' : 'are'} being rapidly consumed!`);
        object.age = Math.trunc((object.age + 1) / 2);
        if (object.age === 0) {
            await impossible('Candelabrum with candles but no fuel?');
            object.age = 1;
        }
    }
    else {
        if (object.spe === 7)
            await plineWithContinuation(heroIsBlind(state)
                ? `${theName(object, state)} radiates a strange warmth!`
                : `${theName(object, state)} glows with a strange light!`);
        object.known = true;
    }
    beginObjectBurn(object, state);
    return result(object, state);
}
export async function useCandle(object, { state = game } = {}) {
    requireLiveGame(state);
    if (state.u.uswallow) {
        await plineWithContinuation("You don't have enough elbow-room to maneuver.");
        return result(object, state);
    }
    const candelabrum = state.inventory.find(item => item.otyp === CANDELABRUM_OF_INVOCATION);
    if (!candelabrum || candelabrum.spe === 7)
        return useLamp(object, { state });
    const answer = await promptYesNo(`Attach ${ownedObjectName(object, state, { capitalized: false })} to ${ownedObjectName(candelabrum, state, { capitalized: false })}?`);
    if (answer !== 'y')
        return useLamp(object, { state });
    const remainder = candelabrum.spe + objectQuantity(object) > 7 ? object : null;
    if (remainder)
        object = splitCarriedObject(object, 7 - candelabrum.spe, state);
    const wasLit = object.lamplit;
    if (wasLit)
        endObjectBurn(object, state);
    const count = objectQuantity(object);
    await plineWithContinuation(`You attach ${count}${candelabrum.spe ? ' more' : ''} ${count === 1 ? 'candle' : 'candles'} to the ${objectName(candelabrum, state)}.`);
    if (!candelabrum.spe || candelabrum.age > object.age)
        candelabrum.age = object.age;
    candelabrum.spe += count;
    if (candelabrum.lamplit && !wasLit)
        await plineWithContinuation(`The new ${count === 1 ? 'candle magically ignites' : 'candles magically ignite'}!`);
    else if (!candelabrum.lamplit && wasLit)
        await plineWithContinuation(count === 1 ? 'It goes out.' : 'They go out.');
    if (object.unpaid) {
        const pronoun = count === 1 ? 'it' : 'them';
        await announcePurchase(`You ${candelabrum.lamplit ? 'burn' : 'use'} ${pronoun}, you bought ${pronoun}!`);
    }
    if (count < 7 && candelabrum.spe === 7)
        await plineWithContinuation(`${theName(candelabrum, state)} now has seven${candelabrum.lamplit ? ' lit' : ''} candles attached.`);
    if (candelabrum.lamplit)
        state.vision_full_recalc = 1;
    await useUpInventoryStack(object, state);
    candelabrum.owt = objectWeight(candelabrum);
    state._capacityDirty = true;
    return result(remainder, state);
}
export async function lightCocktail(object, { state = game } = {}) {
    requireLiveGame(state);
    if (state.u.uswallow) {
        await plineWithContinuation("You don't have enough elbow-room to maneuver.");
        return result(object, state);
    }
    if (object.lamplit) {
        await plineWithContinuation('You snuff the lit potion.');
        endObjectBurn(object, state);
        if (!object.owornmask) {
            await freeInventoryObject(object, state);
            object = await addInventoryItem(object, null, false);
        }
        return result(object, state);
    }
    if (underwater(state)) {
        await plineWithContinuation('There is not enough oxygen to sustain a fire.');
        return result(object, state);
    }
    const split = objectQuantity(object) > 1;
    if (split)
        object = splitCarriedObject(object, 1, state);
    const ownership = carriedObjectOwner(object, state);
    const owner = ownership === 'Your' || ownership === 'The'
        ? ownership.toLowerCase() : ownership;
    await plineWithContinuation(`You light ${owner} potion.${heroIsBlind(state) ? '' : '  It gives off a dim light.'}`);
    if (object.unpaid && costlySpot(state.u.ux, state.u.uy, state)) {
        await chargeUnpaidUsage(object, { state });
        await announcePurchase("That's in addition to the cost of the potion, of course.");
        await billDummyObject(object, state);
    }
    learnObjectType(object.otyp, state);
    beginObjectBurn(object, state);
    if (split) {
        unlinkObject(object, state);
        object.nomerge = true;
        const held = await holdAnotherObject(object, {
            state, dropMessage: `You drop ${inventoryItemDescription(object)}!`,
        });
        if (held.object)
            held.object.nomerge = false;
        return result(held.object, state);
    }
    return result(object, state);
}
//# sourceMappingURL=apply_light.js.map