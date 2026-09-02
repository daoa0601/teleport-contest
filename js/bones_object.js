import {
    BOOMERANG, BOW, ELVEN_BOW, OBJECT_NAMES, ORCISH_BOW, YUMI,
} from './object_data.js';

const HANDED_WEAPONS = new Set([
    BOW, ELVEN_BOW, ORCISH_BOW, YUMI, BOOMERANG,
]);

export function finishGhostlyPickup(object, state) {
    if (!object?.ghostly) return null;
    object.ghostly = false;
    if (!HANDED_WEAPONS.has(object.otyp)) return null;

    const noun = String(object.name || OBJECT_NAMES[object.otyp] || 'object')
        .replace(/^(?:an?|the)\s+/i, '');
    const hand = state?.u?.rightHanded === false ? 'left' : 'right';
    return `You make adjustments to the ${noun} to suit your ${hand} hand.`;
}
