import { warningSymbols } from './warning_symbols.js';
// C pager.c:do_screen_description(), add_cmap_descr(), append_str().
import { BOULDER } from './object_data.js';
import { BUFSZ, def_warnsyms, In_hell, Is_rogue_level, Is_waterlevel, TER_DETECT, TER_MAP, TER_MON, TER_OBJ, TREE, TRAP_EXPLANATIONS, Upolyd, VIBRATING_SQUARE, WEB, } from './const.js';
import { canSpotHeroSelf, cmapSymbolAppearance, glyphAt, monsterClassSymbol, objectClassSymbol, randomDisplayMonsterName, swallowSymbolAppearance, transientMonsterGlyph, unblindTelepathyRange, } from './display.js';
import { okToQuest, onQuestStart } from './quest.js';
import { game } from './gstate.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { MONSTER_CLASS_EXPLAIN, MONSTER_CLASS_SYMBOLS, monsterTypeName } from './monster_data.js';
import { OBJECT_CLASS_EXPLAIN, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { lookGlyphAt, mapFeatureDescription, quotedEngraving, unseenCreatureDescription } from './pager_features.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { decodeMixedLiteral } from './windows.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { lookAtMonster, selfLookDetails, selfTrapDescription } from './pager_monsters.js';
import { objectAtMapDescription } from './map_object_description.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import { dist2 } from './hacklib.js';
import { heroIsPunished } from './ball.js';
import { propertyIsActive } from './properties.js';
import { heroIsPolymorphed } from './polyself.js';
import { cansee } from './vision.js';
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
    if (Array.from({ length: 8 }, (_, index) => swallowSymbolAppearance(index)).some(sameSymbol)) {
        append('the interior of a monster', 'the interior of a monster');
        needLook = true;
    }
    const terrainmode = game.iflags.terrainmode ?? 0;
    if (!terrainmode || terrainmode & TER_MON) {
        for (let index = 1; index < MONSTER_CLASS_SYMBOLS.length; index++) {
            const name = MONSTER_CLASS_EXPLAIN[index];
            if (!name || name === 'invisible monster' || !sameSymbol({ ch: monsterClassSymbol(index) }))
                continue;
            append(withIndefiniteArticle(name), name);
            needLook = true;
        }
        if (sameSymbol({ ch: monsterClassSymbol(MONSTER_CLASS_SYMBOLS.indexOf('@')) })
            && x === game.u.ux && y === game.u.uy
            && !Upolyd(game.u) && game.urace
            && !['human', 'elf'].includes(game.urace.name))
            append('you', 'you');
    }
    if (!terrainmode || terrainmode & TER_OBJ) {
        // pager.c matches ROCK_CLASS against the BOULDER override when one
        // is set for this level's symset (ov_rogue_syms on the Rogue level),
        // else the default rock symbol.
        const boulderSymbol = (Is_rogue_level(game.u.uz)
            ? game.rogueBoulderSym : game.boulderSym) || OBJECT_CLASS_SYMBOLS[14] || '';
        for (let index = 1; index < OBJECT_CLASS_SYMBOLS.length; index++) {
            const statue = index === 14 && glyph.kind === 'object' && glyph.statueGlyph;
            const boulder = index === 14 && sameSymbol({ ch: boulderSymbol });
            if (index === 14 ? !statue && !boulder : !sameSymbol({ ch: objectClassSymbol(index) }))
                continue;
            const name = index === 14 ? boulder ? 'boulder' : 'statue'
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
        const name = unseenCreatureDescription();
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
    for (const warning of warningSymbols().slice(1)) {
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
    const literal = text.slice(0, BUFSZ - 1 - ENCODED_LOOK_PREFIX_LENGTH);
    return { text: prefix + decodeMixedLiteral(literal), count, firstMatch, needsDetail };
}
// C pager.c:lookat() gives the sensed hero priority over the map glyph.
// Terrain-only inspection deliberately omits that self description.
export function farlookDescribesHero(x, y) {
    return x === game.u.ux && y === game.u.uy && canSpotHeroSelf()
        && (!game.iflags.terrainmode || !!(game.iflags.terrainmode & TER_MON));
}
// C pager.c:lookat(): the detailed description of the displayed glyph at
// (x, y), from do_screen_description()'s second pass and getpos describes.
export async function farlookLocationDescription(x, y) {
    // Detection temporarily removes swallowing. Native lookat() compares
    // the engulfer's glyph before deciding that this square describes us,
    // even when the terrain mode will subsequently omit monsters.
    const engulfer = x === game.u.ux && y === game.u.uy && canSpotHeroSelf()
        && game.iflags.save_uswallow ? game.u.ustuck : null;
    const describesEngulfer = engulfer
        && glyphAt(x, y)?.glyph === transientMonsterGlyph(engulfer).glyph;
    if (!describesEngulfer && farlookDescribesHero(x, y))
        return lookatDescription(x, y);
    if (game.u.uswallow && game.u.ustuck)
        return `interior of ${monsterName(game.u.ustuck)}`;
    const glyph = lookGlyphAt(x, y);
    if (!glyph || glyph.kind === 'unexplored') {
        if ((game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz))
            return dist2(x, y, game.u.ux, game.u.uy) <= 2 ? 'land' : 'unknown';
        return 'unexplored area';
    }
    if (glyph?.kind === 'warning') {
        const index = glyph.glyph === undefined ? -1 : glyph.glyph - GlyphOffset.warning;
        const warning = def_warnsyms[index];
        if (!warning)
            throw new RangeError(`Unknown warning glyph ${glyph.glyph}`);
        return warning.desc;
    }
    if (glyph?.kind === 'nothing' || glyph?.kind === 'terrain'
        && glyph.terrainName === 'dark part of a room')
        return 'dark part of a room';
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (monster && glyph?.kind === 'monster') {
        return lookAtMonster(monster, x, y);
    }
    if (glyph.kind === 'object')
        return objectAtMapDescription(x, y, glyph);
    // Hallucinated statues project monster glyphs without a live monster.
    if (glyph?.kind === 'monster' && heroIsHallucinating(game))
        return randomDisplayMonsterName();
    const description = mapFeatureDescription(x, y, glyph);
    if (description === 'ice')
        return iceDescriptionAt(x, y);
    if (description === 'staircase down' && onQuestStart(game) && !okToQuest(game))
        return 'blocked staircase down';
    return description;
}
// C pager.c:lookat() and self_lookat(): the hero's own square as getpos
// autodescribe, travel menus, and the look lists present it.
export async function lookatDescription(x, y) {
    if (x === game.u?.ux && y === game.u?.uy) {
        const species = game.u.umonnum;
        const polymorphName = heroIsPolymorphed(game) && species !== undefined
            ? monsterTypeName(species, !!game.u.mfemale) : '';
        const race = game.urace?.adj || game.urace?.name || 'human';
        const role = game.urole?.name;
        const roleName = game.flags.female && role?.f ? role.f : role?.m;
        const form = polymorphName
            || `${race} ${(roleName || 'adventurer').toLowerCase()}`;
        const punishment = heroIsPunished()
            ? ', chained to a heavy iron ball' : '';
        const blind = heroIsBlind(game);
        const telepathy = unblindTelepathyRange() >= 0;
        const detection = heroDetectsMonsters(game);
        const invisible = propertyIsActive('invisible', game);
        // self_lookat() includes invisibility while blind only when sensed.
        const prefix = invisible && (!blind || telepathy || detection)
            ? 'invisible ' : '';
        const description = `${prefix}${form} called ${game.plname || 'player'}${await selfLookDetails()}${punishment}${selfTrapDescription()}`;
        const unseen = invisible && !game.u.seeInvisible
            && (game.u.seeInvisibleTurns ?? 0) === 0;
        // lookat() treats touch while blind or swallowed as normal vision.
        if (blind || game.u.uswallow || !(unseen || game.u.uundetected))
            return description;
        const senses = [
            game.u.infravision ? 'infravision' : '',
            telepathy ? 'telepathy' : '',
            detection ? 'monster detection' : '',
        ].filter(sense => sense.length > 0);
        return senses.length > 0
            ? `${description} [seen: ${senses.join(', ')}]` : description;
    }
    const loc = game.level?.at(x, y);
    if (!loc)
        return 'unexplored area';
    const glyph = glyphAt(x, y);
    if (glyph?.kind === 'warning' || glyph?.kind === 'nothing' || glyph?.kind === 'monster')
        return farlookLocationDescription(x, y);
    if (loc.typ === TREE && loc.remembered_glyph)
        return 'tree';
    if (!loc.remembered_glyph && !cansee(x, y))
        return 'unexplored area';
    // C pager.c:do_screen_description() describes the displayed glyph, not
    // the terrain below it.  A visible (or still remembered) pile therefore
    // owns farlook before the room/corridor fallback.
    return await farlookLocationDescription(x, y) || 'unexplored area';
}
//# sourceMappingURL=pager_description.js.map