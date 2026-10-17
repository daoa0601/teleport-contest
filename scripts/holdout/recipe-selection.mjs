import { RECIPES } from './recipes.mjs';
/** Validate an explicit generator selection before launching native recorders. */
export function selectRecipes(value) {
    const names = value.split(',').map(name => name.trim());
    for (const name of names) {
        if (!name || !Object.hasOwn(RECIPES, name))
            throw new Error(`unknown recipe: ${name || '(empty)'}`);
    }
    if (new Set(names).size !== names.length)
        throw new Error('recipe selection must not repeat names');
    return names;
}
//# sourceMappingURL=recipe-selection.mjs.map