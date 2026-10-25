import { def_warnsyms } from './const.js';
import { CmapSymbol } from './glyph_numbers.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { MONSTER_CLASS_EXPLAIN, MONSTER_CLASS_SYMBOLS } from './monster_data.js';
import { OBJECT_CLASS_EXPLAIN, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { withIndefiniteArticle } from './object_grammar.js';
// pager.c:do_screen_description() with looked=FALSE. Typed symbols use the
// default class and dungeon symbols, even when the map uses another set.
export function typedSymbolDescription(symbol, context) {
    const meanings = [];
    let firstMatch = '';
    let count = 0;
    const append = (text, name, countMeaning = true) => {
        if (meanings.join(' or ').toLowerCase().includes(text.toLowerCase()))
            return;
        if (!meanings.length)
            firstMatch = name;
        meanings.push(text);
        if (countMeaning)
            count++;
    };
    for (let index = 1; index < MONSTER_CLASS_SYMBOLS.length; index++) {
        const name = MONSTER_CLASS_EXPLAIN[index];
        if (symbol === MONSTER_CLASS_SYMBOLS[index] && name && name !== 'invisible monster')
            append(withIndefiniteArticle(name), name);
    }
    if (symbol === '@' && context.includeHero)
        append('you', 'you');
    for (let index = 1; index < OBJECT_CLASS_SYMBOLS.length; index++) {
        const name = index === 14 ? 'boulder' : OBJECT_CLASS_EXPLAIN[index];
        if (symbol === OBJECT_CLASS_SYMBOLS[index] && name)
            append(withIndefiniteArticle(name), name);
    }
    if (symbol === 'I') {
        const name = context.blind ? 'unseen creature' : 'remembered, unseen, creature';
        append(withIndefiniteArticle(name), name);
    }
    for (let index = 0; index < MAP_SYMBOLS.length; index++) {
        // Native orders wall of water before lava and wall of lava.
        const orderedIndex = index === CmapSymbol.lava ? CmapSymbol.water
            : index === CmapSymbol.lavawall ? CmapSymbol.lava
                : index === CmapSymbol.water ? CmapSymbol.lavawall : index;
        const definition = MAP_SYMBOLS[orderedIndex];
        if (!definition || symbol !== definition.ch)
            continue;
        if (orderedIndex >= CmapSymbol.vodbridge && orderedIndex <= CmapSymbol.hcdbridge
            && count >= 3)
            continue;
        const name = orderedIndex === CmapSymbol.pool ? 'pool of water'
            : orderedIndex === CmapSymbol.water
                ? context.waterLevel ? 'limitless water' : 'wall of water'
                : definition.name;
        const text = name.includes(' of a room') ? `the ${name}`
            : orderedIndex === CmapSymbol.stone || name === 'air' ? name
                : withIndefiniteArticle(name);
        append(text, name);
        // Moat adds a meaning without increasing the ambiguity count.
        if (orderedIndex === CmapSymbol.pool)
            append('a moat', 'moat', false);
    }
    // Trap symbols share one general explanation. The two special effects
    // with explanations also participate in the native dungeon-symbol pass.
    if (symbol === '^')
        append('a trap', 'arrow trap');
    // A web is a trap cmap: add_cmap_descr() reports the first trap symbol
    // as "a trap", keeping the web name only for the encyclopedia lookup.
    if (symbol === '"')
        append('a trap', 'web');
    if (symbol === '~' && (!count || context.inHell))
        append('a vibrating square', 'vibrating square');
    if (symbol === '#')
        append('a poison cloud', 'poison cloud');
    if (symbol === '$')
        append('a valid position', 'valid position');
    for (const warning of def_warnsyms.slice(1)) {
        if (symbol === warning.ch) {
            append(warning.desc, warning.desc);
            break;
        }
    }
    return { text: count > 4 ? 'can be many things' : meanings.join(' or '), count, firstMatch };
}
//# sourceMappingURL=look_symbols.js.map