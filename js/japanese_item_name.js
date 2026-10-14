import { OBJECT_NAMES } from './object_data.js';
// C objnam.c:Japanese_items. Naming and wish lookup use the same vocabulary.
const names = new Map([
    [OBJECT_NAMES.indexOf('short sword'), 'wakizashi'],
    [OBJECT_NAMES.indexOf('broadsword'), 'ninja-to'],
    [OBJECT_NAMES.indexOf('flail'), 'nunchaku'],
    [OBJECT_NAMES.indexOf('glaive'), 'naginata'],
    [OBJECT_NAMES.indexOf('lock pick'), 'osaku'],
    [OBJECT_NAMES.indexOf('wooden harp'), 'koto'],
    [OBJECT_NAMES.indexOf('magic harp'), 'magic koto'],
    [OBJECT_NAMES.indexOf('knife'), 'shito'],
    [OBJECT_NAMES.indexOf('plate mail'), 'tanko'],
    [OBJECT_NAMES.indexOf('helmet'), 'kabuto'],
    [OBJECT_NAMES.indexOf('leather gloves'), 'yugake'],
    [OBJECT_NAMES.indexOf('food ration'), 'gunyoki'],
    [OBJECT_NAMES.indexOf('booze'), 'sake'],
]);
export function japaneseItemName(type) {
    return names.get(type);
}
export function japaneseWishType(name) {
    if (!name)
        return null;
    for (const [type, japaneseName] of names)
        if (name.toLowerCase() === japaneseName)
            return type;
    return null;
}
//# sourceMappingURL=japanese_item_name.js.map