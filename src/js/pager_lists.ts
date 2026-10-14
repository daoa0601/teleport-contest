// C pager.c:look_all(), look_traps(), look_engrs(), look_region_nearby().
import {
    BOLT_LIM, COLNO, CORR, GRAVE, Is_airlevel, Is_waterlevel, ROWNO, def_warnsyms,
} from './const.js';
import { glyphAt, pline, transientTrapGlyph } from './display.js';
import { game } from './gstate.js';
import { GlyphOffset } from './glyph_numbers.js';
import { objectAtMapDescription } from './map_object_description.js';
import { monsterAtPosition } from './monster_location.js';
import { displayedTrapDescription, quotedEngraving } from './pager_features.js';
import { lookAtMonster } from './pager_monsters.js';
import { DEC_TO_UNICODE } from './terminal.js';
import { trapName } from './trap_name.js';
import { couldsee } from './vision.js';
import { showDisclosureOverlay } from './windows.js';

export type LookListKind = 'monsters' | 'objects' | 'traps' | 'engravings';

export async function showLookList(kind: LookListKind, nearby: boolean,
    describeHero: () => Promise<string>): Promise<void> {
    const level = game.level;
    if (!level) return;
    const mode = game.iflags.getpos_coords === 'n' ? 'm' : game.iflags.getpos_coords ?? 'm';
    const lines: string[] = [];
    const lowX = nearby ? Math.max(1, game.u.ux - BOLT_LIM) : 1;
    const highX = nearby ? Math.min(COLNO - 1, game.u.ux + BOLT_LIM) : COLNO - 1;
    const lowY = nearby ? Math.max(0, game.u.uy - BOLT_LIM) : 0;
    const highY = nearby ? Math.min(ROWNO - 1, game.u.uy + BOLT_LIM) : ROWNO - 1;
    for (let y = lowY; y <= highY; y++) {
        for (let x = lowX; x <= highX; x++) {
            const glyph = glyphAt(x, y);
            if (!glyph) continue;
            let symbol = mapSymbolAt(x, y), description = '';
            if (kind === 'monsters') {
                if (glyph.kind === 'monster') {
                    if (x === game.u.ux && y === game.u.uy) description = (await describeHero()).split(' [seen: ')[0] ?? '';
                    else {
                        const monster = monsterAtPosition(level, x, y);
                        if (monster) description = await lookAtMonster(monster, x, y);
                    }
                } else if (glyph.kind === 'invisible') description = 'remembered, unseen, creature';
                else if (glyph.kind === 'warning') {
                    const warning = def_warnsyms[(glyph.glyph ?? -1) - GlyphOffset.warning];
                    if (warning) description = warning.desc;
                }
            } else if (kind === 'objects') {
                if (glyph.kind === 'object') description = await objectAtMapDescription(x, y, glyph);
            } else if (kind === 'traps') {
                if (glyph.kind === 'trap') description = displayedTrapDescription(glyph.trapType, x, y);
                else {
                    const trap = level.traps.find(t => t.tx === x && t.ty === y && t.tseen);
                    if (trap && (!(Is_waterlevel(game.u.uz) || Is_airlevel(game.u.uz)) || couldsee(x, y))) {
                        description = `${trapName(trap.ttyp)}, obscured by ${symbol}`;
                        symbol = transientTrapGlyph(trap).ch;
                    }
                }
            } else {
                const location = level.at(x, y);
                const engraving = level.engravings?.find(e => e.x === x && e.y === y);
                if (!location?.seenv || !engraving) continue;
                const headstone = location.lastseentyp === GRAVE;
                const suffix = quotedEngraving(x, y, headstone ? 'grave' : 'engraving', true);
                description = ' ' + (headstone ? suffix.replace(/^ (with |whose )/, '')
                    : suffix.startsWith(' with ') ? suffix.slice(6) : `engraving${suffix}`);
                const shown = glyph.kind === 'engraving' || glyph.kind === 'terrain' && glyph.terrainName === 'grave';
                if (!shown) {
                    description += `, obscured by ${symbol}`;
                    symbol = headstone ? '|' : location.lastseentyp === CORR ? '#' : '`';
                }
            }
            if (!description) continue;
            if (!lines.length) lines.push(listHeading(kind, nearby, mode), '    ');
            let coordinates = coordinateDescription(x, y, mode);
            if (mode === 'm' && y < 10 && (kind === 'monsters' || kind === 'objects')) coordinates += ' ';
            const prefix = mode === 's' ? coordinates : coordinates.padStart(mode === 'm' ? 8 : 12);
            lines.push(`${prefix}  ${symbol}${kind === 'engravings' ? ' ' : '  '}${description}`.slice(0, 255));
        }
    }
    if (lines.length) await showDisclosureOverlay(lines, { restoreUnderlay: true });
    else if (kind === 'monsters' || kind === 'objects')
        await pline(`No ${kind} are currently shown ${nearby ? 'nearby' : 'on the map'}.`);
    else await pline(`No ${kind} seen or remembered${nearby ? ' nearby' : ''}.`);
}

function listHeading(kind: LookListKind, nearby: boolean, mode: string): string {
    if (kind === 'traps' || kind === 'engravings')
        return nearby ? `Nearby seen or remembered ${kind}:` : `Seen or remembered ${kind} on this level:`;
    if (!nearby) return `All ${kind} currently shown on the map:`;
    const name = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `${name} currently shown near ${mode === 'c' ? 'you' : coordinateDescription(game.u.ux, game.u.uy, mode)}:`;
}

export function coordinateDescription(x: number, y: number, mode: string): string {
    if (mode === 'n') return '';
    if (mode === 'm') return `<${x},${y}>`;
    if (mode === 's') return `[${String(y + 2).padStart(2, '0')},${String(x).padStart(2, '0')}]`;
    const dx = x - game.u.ux, dy = y - game.u.uy;
    if (!dx && !dy) return '(here)';
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)
        return `(${dy ? dy > 0 ? 'south' : 'north' : ''}${dx ? dx > 0 ? 'east' : 'west' : ''})`;
    const full = mode === 'f';
    const parts = [dy ? `${Math.abs(dy)}${dy > 0 ? full ? 'south' : 's' : full ? 'north' : 'n'}` : '',
        dx ? `${Math.abs(dx)}${dx > 0 ? full ? 'east' : 'e' : full ? 'west' : 'w'}` : ''].filter(Boolean);
    return `(${parts.join(',')})`;
}

function mapSymbolAt(x: number, y: number): string {
    const location = game.level?.at(x, y);
    if (!location) return ' ';
    return location.disp_decgfx ? DEC_TO_UNICODE[location.disp_ch] ?? location.disp_ch : location.disp_ch;
}
