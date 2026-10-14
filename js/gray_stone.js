// C apply.c:use_stone() and touchstone_ok().
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { OBJECT_COLOR, TOUCHSTONE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { learnObjectType } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { isFlimsyObject, isGrayStone } from './object_properties.js';
import { objectResistsDestruction } from './object_state.js';
import { objectName, observeObjectForNaming } from './objnam.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { objectTypeKnown } from './shk.js';
const RING_CLASS = 4;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const LIQUID = 1, WAX = 2, CLOTH = 6, WOOD = 8;
const SILVER = 14, GOLD = 15, GLASS = 19, GEMSTONE = 20, MINERAL = 21;
const SCRITCH = '"scritch, scritch"';
// C decl.c:c_obj_colors: object streaks use these names, not hallucination colors.
const OBJECT_COLOR_NAMES = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'transparent', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];
export async function useGrayStone(stone, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!heroIsBlind(state))
        observeObjectForNaming(stone, { state });
    const known = stone.otyp === TOUCHSTONE && stone.dknown && objectTypeKnown(stone, state);
    const plural = (stone.quantity ?? stone.quan ?? 1) > 1;
    const object = await chooseInventoryObject(`rub on the stone${plural ? 's' : ''}`, target => known ? touchstoneSuggestion(target, state) : GETOBJ_SUGGEST, { forcePrompt: true });
    if (!object)
        return { spentTime: false };
    const quantity = object.quantity ?? object.quan ?? 1;
    if (object === stone && quantity === 1) {
        await plineWithContinuation(`You can't rub the ${objectName(object, state)} on itself.`);
        return { spentTime: false };
    }
    if (stone.otyp === TOUCHSTONE && stone.cursed && object.oclass === GEM_CLASS
        && !isGrayStone(object) && !objectResistsDestruction(object, 80, 100)) {
        const message = heroIsBlind(state) ? 'You feel something shatter.'
            : heroIsHallucinating(state) ? 'Oh, wow, look at the pretty shards.'
                : `A sharp crack shatters ${quantity > 1 ? 'one of ' : ''}the ${stoneNoun(object, state)}.`;
        await plineWithContinuation(message);
        await consumeInventoryItem(object, state);
        return { spentTime: true };
    }
    if (heroIsBlind(state) || heroIsHallucinating(state)) {
        await plineWithContinuation(heroIsBlind(state) ? SCRITCH : 'Oh wow, man: Fractals!');
        return { spentTime: true };
    }
    const material = objectMaterial(object, state);
    const gemLike = object.oclass === GEM_CLASS
        || object.oclass === RING_CLASS && [GEMSTONE, MINERAL].includes(material);
    if (stone.otyp === TOUCHSTONE && object.oclass === GEM_CLASS
        && (stone.blessed || !stone.cursed
            && (state.urole.key === 'archeologist' || state.urace.name === 'gnome'))) {
        learnObjectType(TOUCHSTONE, state);
        learnObjectType(object.otyp, state);
        observeObjectForNaming(object, { state });
        await plineWithContinuation(`${object.invlet} - ${inventoryItemDescription(object)}.`);
        return { spentTime: true };
    }
    const result = stoneMarks(stone, object, gemLike, material, state);
    if ('message' in result) {
        await plineWithContinuation(result.message);
    }
    else {
        const name = `stone${plural ? 's' : ''}`;
        await plineWithContinuation(result.scratch
            ? `You make ${result.color ? result.color + ' ' : ''}scratch marks on the ${name}.`
            : result.color ? `You see ${result.color} streaks on the ${name}.` : SCRITCH);
    }
    return { spentTime: true };
}
function touchstoneSuggestion(object, state) {
    if (!object)
        return GETOBJ_EXCLUDE;
    if (object.oclass === COIN_CLASS || object.oclass === GEM_CLASS
        && !(object.dknown && objectTypeKnown(object, state)))
        return GETOBJ_SUGGEST;
    return GETOBJ_DOWNPLAY;
}
function stoneNoun(object, state) {
    const name = objectName(object, state);
    return (object.quantity ?? object.quan ?? 1) > 1 ? makePlural(name) : name;
}
function stoneMarks(stone, object, gemLike, material, state) {
    const colorIndex = state.objectColors?.[object.otyp] ?? OBJECT_COLOR[object.otyp];
    const color = colorIndex === undefined ? null : OBJECT_COLOR_NAMES[colorIndex] ?? null;
    if (gemLike) {
        if (stone.otyp !== TOUCHSTONE)
            return { scratch: true, color };
        if (material === GLASS)
            return { scratch: true, color: null };
        return { scratch: false, color };
    }
    const plural = (stone.quantity ?? stone.quan ?? 1) > 1;
    switch (material) {
        case CLOTH:
            return { message: `The ${stoneNoun(stone, state)} look${plural ? '' : 's'} a little more polished now.` };
        case LIQUID:
            return { message: object.known
                    ? `The ${stoneNoun(stone, state)} ${plural ? 'are' : 'is'} a little wetter now.`
                    : 'You must think this is a wetstone, do you?' };
        case WAX: return { scratch: false, color: 'waxy' };
        case WOOD: return { scratch: false, color: 'wooden' };
        case GOLD: return { scratch: true, color: 'golden' };
        case SILVER: return { scratch: true, color: 'silvery' };
        default: return isFlimsyObject(object, state)
            ? { scratch: false, color } : { scratch: stone.otyp !== TOUCHSTONE, color: null };
    }
}
//# sourceMappingURL=gray_stone.js.map