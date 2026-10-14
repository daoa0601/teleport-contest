// C pager.c:do_screen_description(), add_cmap_descr(), append_str().
import { BOULDER } from './object_data.js';
import { BUFSZ, In_hell, Upolyd, Is_rogue_level, Is_waterlevel, TER_DETECT, TER_MAP, TER_MON, TER_OBJ, TRAP_EXPLANATIONS, VIBRATING_SQUARE, WEB, def_warnsyms, } from './const.js';
import { cmapSymbolAppearance } from './display.js';
import { onQuestStart } from './quest.js';
import { game } from './gstate.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { MONSTER_CLASS_EXPLAIN, MONSTER_CLASS_SYMBOLS } from './monster_data.js';
import { OBJECT_CLASS_EXPLAIN, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { quotedEngraving, lookGlyphAt } from './pager_features.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
// encglyph() occupies ten bytes in the native buffer, followed by eight spaces.
const ENCODED_LOOK_PREFIX_LENGTH = 10 + 8;
export function screenDescription(x, y, description) {
    const glyph = lookGlyphAt(x, y);
    const location = game.level?.at(x, y);
    const appearance = location?.disp_glyph
        ? { ch: location.disp_ch, dec: location.disp_decgfx }
        : location?.remembered_glyph;
    if (!glyph || !appearance)
        return { text: description, count: 0, firstMatch: '', needsDetail: false };
    const symbol = appearance.dec ? `\x0e${appearance.ch}\x0f` : appearance.ch;
    const prefix = `${symbol}        `;
    const submerged = (game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz);
    const distant = Math.abs(x - game.u.ux) > 1 || Math.abs(y - game.u.uy) > 1;
    const detectionOnly = ((game.iflags.terrainmode ?? 0) & (TER_DETECT | TER_MAP)) === TER_DETECT;
    if ((game.u.uswallow || submerged) && distant
        || detectionOnly && glyph.glyph === cmapToGlyph(CmapSymbol.stone))
        return { text: prefix + 'unreconnoitered', count: 1, firstMatch: 'unreconnoitered', needsDetail: false };
    const meanings = [];
    let count = 0, firstMatch = '', needLook = false, hitTrap = false, skippedVenom = false;
    const append = (text, name, counted = true) => {
        if (meanings.join(' or ').toLowerCase().includes(text.toLowerCase()))
            return;
        if (!meanings.length)
            firstMatch = name;
        meanings.push(text);
        if (counted)
            count++;
    };
    const sameSymbol = (candidate) => candidate.ch === appearance.ch && !!candidate.dec === !!appearance.dec;
    const dec = /^DECgraphics$/i.test(game.symset ?? '') && !Is_rogue_level(game.u.uz);
    const swallowChars = dec ? ['/', 'o', '\\', 'x', 'x', '\\', 's', '/']
        : ['/', '-', '\\', '|', '|', '\\', '-', '/'];
    const swallowDec = dec ? [false, true, false, true, true, false, true, false]
        : swallowChars.map(() => false);
    if (swallowChars.some((ch, i) => sameSymbol({ ch, dec: !!swallowDec[i] }))) {
        append('the interior of a monster', 'the interior of a monster');
        needLook = true;
    }
    const terrainmode = game.iflags.terrainmode ?? 0;
    if (!terrainmode || terrainmode & TER_MON) {
        for (let index = 1; index < MONSTER_CLASS_SYMBOLS.length; index++) {
            const name = MONSTER_CLASS_EXPLAIN[index];
            if (!name || name === 'invisible monster' || !sameSymbol({ ch: MONSTER_CLASS_SYMBOLS[index] ?? '' }))
                continue;
            append(withIndefiniteArticle(name), name);
            needLook = true;
        }
        if (sameSymbol({ ch: '@' }) && x === game.u.ux && y === game.u.uy
            && !Upolyd(game.u) && game.urace
            && !['human', 'elf'].includes(game.urace.name))
            append('you', 'you');
    }
    if (!terrainmode || terrainmode & TER_OBJ) {
        const symbols = Is_rogue_level(game.u.uz)
            ? ['', ']', ')', ']', '=', ',', '(', ':', '!', '?', '+', '/', '*', '*', '`', '0', '_', '.']
            : OBJECT_CLASS_SYMBOLS;
        for (let index = 1; index < symbols.length; index++) {
            const statue = index === 14 && glyph.kind === 'object' && glyph.statueGlyph;
            if (!statue && !sameSymbol({ ch: symbols[index] ?? '' }))
                continue;
            const name = index === 14 ? statue && !sameSymbol({ ch: '`' }) ? 'statue' : 'boulder'
                : OBJECT_CLASS_EXPLAIN[index];
            if (!name)
                continue;
            needLook = true;
            if (index === 17) {
                skippedVenom = true;
                continue;
            }
            append(withIndefiniteArticle(name), name);
        }
    }
    if (sameSymbol({ ch: 'I' })) {
        const name = heroIsBlind(game) ? 'unseen creature' : 'remembered, unseen, creature';
        append(withIndefiniteArticle(name), name);
    }
    if (glyph.kind === 'nothing' || sameSymbol({ ch: ' ' }))
        append('the dark part of a room', 'the dark part of a room');
    if (glyph.kind === 'unexplored' || sameSymbol({ ch: ' ' }))
        append(submerged ? 'land' : 'unexplored', submerged ? 'land' : 'unexplored');
    for (let order = 0; order <= CmapSymbol.goodpos; order++) {
        const index = order === CmapSymbol.lava ? CmapSymbol.water
            : order === CmapSymbol.lavawall ? CmapSymbol.lava
                : order === CmapSymbol.water ? CmapSymbol.lavawall : order;
        const definition = MAP_SYMBOLS[index];
        const trapType = index - CmapSymbol.arrowTrap + 1;
        const trap = trapType > 0 && trapType < TRAP_EXPLANATIONS.length;
        let name = definition?.name ?? (trap ? TRAP_EXPLANATIONS[trapType]
            : index === CmapSymbol.poisoncloud ? 'poison cloud'
                : index === CmapSymbol.goodpos ? 'valid position' : '');
        if (!name)
            continue;
        const candidate = index === CmapSymbol.darkroom
            ? game.flags.dark_room !== false && game.flags.color !== false
                ? cmapSymbolAppearance(CmapSymbol.room) : { ch: ' ', dec: false }
            : definition ? cmapSymbolAppearance(index) : { ch: trap ? trapType === WEB ? '"'
                    : trapType === VIBRATING_SQUARE ? '~' : '^' : index === CmapSymbol.poisoncloud ? '#' : '$', dec: false };
        if (!sameSymbol(candidate))
            continue;
        if (index === CmapSymbol.darkroom && glyph.kind === 'nothing')
            continue;
        if (hitTrap && trap || count >= 3 && index >= CmapSymbol.vodbridge && index <= CmapSymbol.hcdbridge)
            continue;
        if (trapType === VIBRATING_SQUARE && count && !In_hell(game.u.uz)
            && !(glyph.kind === 'trap' && glyph.trapType === VIBRATING_SQUARE))
            continue;
        if (index === CmapSymbol.pool)
            name = 'pool';
        else if (index === CmapSymbol.water)
            name = Is_waterlevel(game.u.uz) ? 'limitless water' : 'wall of water';
        else if (index === CmapSymbol.lava)
            name = 'lava';
        const liquid = [CmapSymbol.pool, CmapSymbol.water, CmapSymbol.lava, CmapSymbol.lavawall, CmapSymbol.ice].includes(index);
        const article = name.includes(' of a room') ? `the ${name}`
            : liquid || index === CmapSymbol.stone || name === 'air' ? name : withIndefiniteArticle(name);
        append(!count && trap && trapType !== VIBRATING_SQUARE ? 'a trap' : article, name);
        if (trap && trapType !== VIBRATING_SQUARE)
            hitTrap = true;
        if (index === CmapSymbol.pool) {
            const currentLevel = game.u.uz;
            const here = (level) => !!level && !!currentLevel && level.dnum === currentLevel.dnum && level.dlevel === currentLevel.dlevel;
            const moat = here(game.medusa_level) ? 'shallow sea' : here(game.juiblex_level) ? 'swamp'
                : game.urole?.key === 'samurai' && onQuestStart(game) ? 'pond' : 'moat';
            append(moat === 'pond' ? 'a pond' : moat, moat, false);
        }
        if (index === CmapSymbol.altar || trap || index === CmapSymbol.engroom || index === CmapSymbol.engrcorr
            || index === CmapSymbol.grave || liquid && heroIsHallucinating(game))
            needLook = true;
    }
    for (const warning of def_warnsyms.slice(1)) {
        if (!sameSymbol({ ch: warning.ch }))
            continue;
        append(warning.desc, warning.desc);
        if (game.level?.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
            meanings[meanings.length - 1] += ' co-located with a boulder';
        break;
    }
    if (skippedVenom && count < 2)
        append('a splash of venom', 'splash of venom');
    let text = count > 4 ? 'can be many things' : meanings.join(' or ');
    const needsDetail = count > 1 || needLook;
    if (needsDetail) {
        firstMatch = description || firstMatch;
        if (firstMatch) {
            text += ` (${firstMatch}${quotedEngraving(x, y, firstMatch)})`;
            count = 1;
        }
    }
    return { text: prefix + text.slice(0, BUFSZ - 1 - ENCODED_LOOK_PREFIX_LENGTH), count, firstMatch, needsDetail };
}
//# sourceMappingURL=pager_description.js.map