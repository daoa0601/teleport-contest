// C pager.c:lookat() and trap_description(). Describe the displayed glyph;
// the current square is consulted only where the native glyph needs context.
import {
    AM_SANCTUM, Amask2align, A_NONE, DOOR, D_BROKEN, D_TRAPPED,
    Is_airlevel, Is_astralevel, Is_waterlevel, SCORR, STONE,
    TRAPPED_CHEST, TRAPPED_DOOR,
} from './const.js';
import { findDrawbridgeAt } from './dbridge.js';
import type { GlyphMetadata } from './display.js';
import { game } from './gstate.js';
import { CmapSymbol, cmapToGlyph } from './glyph_numbers.js';
import { CHEST, LARGE_BOX } from './object_data.js';
import { monsterAtPosition } from './monster_location.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { waterbodyName } from './terrain_name.js';
import { trapName } from './trap_name.js';

export function mapFeatureDescription(x: number, y: number, glyph: GlyphMetadata): string {
    if (glyph.kind === 'trap') return displayedTrapDescription(glyph.trapType, x, y);
    if (glyph.kind === 'invisible') return 'remembered, unseen, creature';
    if (glyph.kind === 'engraving') return 'engraving';
    if (glyph.kind !== 'terrain') return 'unexplored area';
    const location = game.level?.at(x, y);
    if (!location) return 'unexplored area';
    if (glyph.terrainName === 'altar') {
        const mask = location.altarmask ?? location.flags;
        const alignment = Amask2align(mask);
        const distant = Is_astralevel(game.u.uz) && !adjacentToHero(x, y)
            && !!(mask & AM_SANCTUM);
        const name = distant ? 'aligned' : alignment === A_NONE ? 'unaligned'
            : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
        return `${name} ${mask & AM_SANCTUM ? 'high ' : ''}altar`;
    }
    if (glyph.glyph === cmapToGlyph(CmapSymbol.ndoor) || glyph.terrainName === 'doorway') {
        if (findDrawbridgeAt(x, y)) return 'open drawbridge portcullis';
        return (location.doormask & ~D_TRAPPED) === D_BROKEN ? 'broken door' : 'doorway';
    }
    if (glyph.glyph === cmapToGlyph(CmapSymbol.cloud))
        return Is_airlevel(game.u.uz) ? 'cloudy area' : 'fog/vapor cloud';
    if ([CmapSymbol.pool, CmapSymbol.water, CmapSymbol.lava, CmapSymbol.lavawall, CmapSymbol.ice]
        .some(symbol => glyph.glyph === cmapToGlyph(symbol)))
        return waterbodyName(x, y);
    if (glyph.glyph === cmapToGlyph(CmapSymbol.stone)) {
        if (!location.seenv) return 'unexplored';
        if ((game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz))
            return adjacentToHero(x, y) ? 'land' : 'unknown';
        if (location.typ === STONE || location.typ === SCORR) return 'stone';
    }
    return glyph.terrainName;
}

export function displayedTrapDescription(type: number, x: number, y: number): string {
    if (type === TRAPPED_CHEST && (!heroIsHallucinating() || rn2(20) === 0)) {
        const level = game.level;
        const boxes = level?.objects[x]?.[y] ?? [];
        const here = x === game.u.ux && y === game.u.uy;
        const carried = here ? [...game.inventory, ...game.u.usteed?.minvent ?? []] : [];
        const monster = level ? monsterAtPosition(level, x, y) : null;
        const isBox = (object: { otyp: number }) => object.otyp === CHEST || object.otyp === LARGE_BOX;
        if (boxes.some(isBox) || [...carried, ...monster?.minvent ?? []]
            .some(object => isBox(object) && object.otrapped)) return 'trapped chest';
    }
    if (type === TRAPPED_DOOR && (!heroIsHallucinating() || rn2(20) === 0)
        && game.level?.at(x, y)?.typ === DOOR) return 'trapped door';
    return trapName(type);
}

function adjacentToHero(x: number, y: number): boolean {
    return Math.abs(x - game.u.ux) <= 1 && Math.abs(y - game.u.uy) <= 1;
}
