// C objnam.c:readobjnam(), physical modifiers after object generation.
import { WT_IRON_BALL_INCR } from './const.js';
import { consumeRemainingFood, foodNutrition } from './food_lifecycle.js';
import { placeCreatedObject } from './floor_object.js';
import { game } from './gstate.js';
import { beginObjectBurn } from './light.js';
import { BAG_OF_TRICKS, BRASS_LANTERN, CHEST, HEAVY_IRON_BALL, HORN_OF_PLENTY, LARGE_BOX, MAGIC_LAMP, OIL_LAMP, POT_OIL, POT_WATER, TALLOW_CANDLE, TIN, TOWEL, WAX_CANDLE, } from './object_data.js';
import { deleteObjectContents } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { isPoisonableObject } from './object_properties.js';
import { objectWeight } from './weight.js';
export function lightWishedObject(object, parsed) {
    if (!parsed.lit || ![OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN,
        TALLOW_CANDLE, WAX_CANDLE, POT_OIL].includes(object.otyp))
        return;
    placeCreatedObject(object, game.u.ux, game.u.uy);
    beginObjectBurn(object);
    unlinkObject(object);
}
export async function applyWishProperties(object, parsed, wizardWish, luck) {
    if (object.otyp === TOWEL && parsed.wetness)
        object.spe = parsed.wetness;
    if (parsed.poisoned) {
        if (isPoisonableObject(object))
            object.opoisoned = luck >= 0;
        else if (object.oclass === 7)
            object.age = 1;
    }
    if (parsed.trapped && (wizardWish || parsed.trapped === 'untrapped')
        && (object.otyp === CHEST || object.otyp === LARGE_BOX || object.otyp === TIN))
        object.otrapped = parsed.trapped === 'trapped';
    if (parsed.empty) {
        if (object.otyp === BAG_OF_TRICKS || object.otyp === HORN_OF_PLENTY) {
            if (object.spe > 0)
                object.spe = 0;
        }
        else if (object.contents?.length)
            await deleteObjectContents(object);
    }
    if (object.otyp === CHEST || object.otyp === LARGE_BOX) {
        if (parsed.lock) {
            object.olocked = parsed.lock === 'locked';
            object.obroken = parsed.lock === 'broken';
        }
        if (object.obroken)
            object.otrapped = false;
    }
    if (parsed.greased)
        object.greased = true;
    if (parsed.diluted && object.oclass === 8)
        object.odiluted = object.otyp !== POT_WATER;
}
export async function finishWishWeight(object, parsed) {
    if (parsed.partlyEaten && object.oclass === 7) {
        const nutrition = foodNutrition(object);
        if (nutrition > 1) {
            object.oeaten = nutrition;
            await consumeRemainingFood(object, 1);
        }
    }
    object.owt = objectWeight(object);
    if (parsed.heavy && object.otyp === HEAVY_IRON_BALL)
        object.owt += WT_IRON_BALL_INCR;
}
//# sourceMappingURL=wish_properties.js.map