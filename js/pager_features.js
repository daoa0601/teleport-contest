// C pager.c:lookat() and trap_description(). Describe the displayed glyph;
// the current square is consulted only where the native glyph needs context.
import { ALTAR, AM_SANCTUM, Amask2align, A_NONE, DOOR, D_BROKEN, D_TRAPPED, Is_airlevel, Is_astralevel, Is_waterlevel, SCORR, STONE, M_AP_FURNITURE, M_AP_TYPE, TER_MON, TER_OBJ, TRAPPED_CHEST, TRAPPED_DOOR, } from './const.js';
import { findDrawbridgeAt } from './dbridge.js';
import { glyphAt, terrain_glyph } from './display.js';
import { game } from './gstate.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { CHEST, LARGE_BOX } from './object_data.js';
import { monsterAtPosition } from './monster_location.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { waterbodyName } from './terrain_name.js';
import { trapName } from './trap_name.js';
// Looking never reads an engraving: report its saved text, even when the
// live inscription has since been scuffed or replaced.
export function quotedEngraving(x, y, name, force = false) {
    const engraving = game.level?.engravings?.find(e => e.x === x && e.y === y);
    const headstone = name === 'grave';
    if (!engraving || !force && name !== 'engraving' && !headstone)
        return '';
    return engraving.eread ? ` with ${headstone ? 'headstone reading' : 'remembered text'}: "${engraving.rememberedText}"`
        : ` ${headstone ? 'whose headstone' : 'that'} you haven't read`;
}
export function lookGlyphAt(x, y) {
    const glyph = glyphAt(x, y);
    const mode = game.iflags.terrainmode;
    if (!mode || !glyph)
        return glyph;
    const omitted = glyph.kind === 'monster' && !(mode & TER_MON)
        || glyph.kind === 'object' && !(mode & TER_OBJ);
    if (!omitted)
        return glyph;
    const location = game.level?.at(x, y);
    return location ? terrain_glyph(location, x, y) : null;
}
export function mapFeatureDescription(x, y, glyph) {
    if (glyph.kind === 'trap')
        return displayedTrapDescription(glyph.trapType, x, y);
    if (glyph.kind === 'invisible')
        return 'remembered, unseen, creature';
    if (glyph.kind === 'engraving')
        return 'engraving';
    if (glyph.kind === 'effect' && glyph.glyph !== undefined) {
        if (glyph.glyph >= GlyphOffset.zap && glyph.glyph < GlyphOffset.cmapC)
            return '';
        if (glyph.glyph >= GlyphOffset.cmapC && glyph.glyph < GlyphOffset.swallow) {
            if (glyph.glyph === cmapToGlyph(CmapSymbol.poisoncloud))
                return 'poison cloud';
            if (glyph.glyph === cmapToGlyph(CmapSymbol.goodpos))
                return 'valid position';
            return '';
        }
    }
    if (glyph.kind !== 'terrain')
        return 'unexplored area';
    const location = game.level?.at(x, y);
    if (!location)
        return 'unexplored area';
    if (glyph.terrainName === 'altar') {
        // pray.c:altarmask_at() gives the disguise priority over terrain.
        const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
        const mask = monster && M_AP_TYPE(monster) === M_AP_FURNITURE
            && monster.mappearance === CmapSymbol.altar
            ? monster.mcorpsenm ?? monster.mextra?.mcorpsenm ?? 0
            : location.typ === ALTAR ? location.altarmask ?? location.flags : 0;
        const alignment = Amask2align(mask);
        const distant = Is_astralevel(game.u.uz) && !adjacentToHero(x, y)
            && !!(mask & AM_SANCTUM);
        const name = distant ? 'aligned' : alignment === A_NONE ? 'unaligned'
            : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
        return `${name} ${mask & AM_SANCTUM ? 'high ' : ''}altar`;
    }
    if (glyph.glyph === cmapToGlyph(CmapSymbol.ndoor) || glyph.terrainName === 'doorway') {
        if (findDrawbridgeAt(x, y))
            return 'open drawbridge portcullis';
        return (location.doormask & ~D_TRAPPED) === D_BROKEN ? 'broken door' : 'doorway';
    }
    if (glyph.glyph === cmapToGlyph(CmapSymbol.cloud))
        return Is_airlevel(game.u.uz) ? 'cloudy area' : 'fog/vapor cloud';
    if ([CmapSymbol.pool, CmapSymbol.water, CmapSymbol.lava, CmapSymbol.lavawall, CmapSymbol.ice]
        .some(symbol => glyph.glyph === cmapToGlyph(symbol)))
        return waterbodyName(x, y);
    if (glyph.glyph === cmapToGlyph(CmapSymbol.stone)) {
        if (!location.seenv)
            return 'unexplored';
        if ((game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz))
            return adjacentToHero(x, y) ? 'land' : 'unknown';
        if (location.typ === STONE || location.typ === SCORR)
            return 'stone';
    }
    return glyph.terrainName;
}
export function displayedTrapDescription(type, x, y) {
    return detectedTrapDisguise(type, x, y) ?? trapName(type);
}
// C detect.c:trapped_chest_at()/trapped_door_at() identify the projection,
// not whether a visible box or door still has its trap armed.
export function detectedTrapDisguise(type, x, y) {
    if (glyphAt(x, y)?.kind !== 'trap')
        return null;
    if (type === TRAPPED_CHEST && (!heroIsHallucinating() || rn2(20) === 0)) {
        const level = game.level;
        const boxes = level?.objects[x]?.[y] ?? [];
        const here = x === game.u.ux && y === game.u.uy;
        const carried = here ? [...game.inventory, ...game.u.usteed?.minvent ?? []] : [];
        const monster = level ? monsterAtPosition(level, x, y) : null;
        const isBox = (object) => object.otyp === CHEST || object.otyp === LARGE_BOX;
        if (boxes.some(isBox) || [...carried, ...monster?.minvent ?? []]
            .some(object => isBox(object) && object.otrapped))
            return 'trapped chest';
    }
    if (type === TRAPPED_DOOR && (!heroIsHallucinating() || rn2(20) === 0)
        && game.level?.at(x, y)?.typ === DOOR)
        return 'trapped door';
    return null;
}
function adjacentToHero(x, y) {
    return Math.abs(x - game.u.ux) <= 1 && Math.abs(y - game.u.uy) <= 1;
}
//# sourceMappingURL=pager_features.js.map