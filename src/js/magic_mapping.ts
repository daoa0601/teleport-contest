import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { requirePlayingGame } from './gstate.js';
// C detect.c:do_mapping(), do_vicinity_map().

import { monsterHasMapPosition } from './monster_location.js';
import { exerciseWisdom } from './attrib.js';
import {
    COLNO, IN_SIGHT, ROWNO,
    TER_DETECT, TER_MAP, TER_MON, TER_OBJ, TER_TRP,
} from './const.js';
import { mapLevel, showMapSpot } from './detect.js';
import {
    canSpotMonster, docrt, flush_screen, glyphAt, map_invisible,
    map_object, pline, see_monsters,
} from './display.js';
import { game, requireLiveGame } from './gstate.js';
import {
    browseDetectionMap, mapDetectedMonster, reconstrainMap,
    redisplayDetectionMap, unconstrainMap,
} from './magic_map_display.js';
import { MONSTER_NAME } from './monster_data.js';
import { observeObject } from './object_knowledge.js';
import { propertyIsActive } from './properties.js';
import { terrainCoversObjectsAt } from './terrain_properties.js';

const LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
const MAP_MODE = TER_DETECT | TER_MAP | TER_TRP | TER_OBJ;

export async function mapMagicLevel({ state = game,
    confused = (state.u.confusionTurns ?? 0) > 0, revealAllTraps = false }: { state?: GameState; confused?: boolean; revealAllTraps?: boolean } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const constraints = unconstrainMap(state);
    try {
        mapLevel({ confused, revealAllTraps, exercise: false });
        if (!state.level.flags.hero_memory || constraints.changed) {
            await flush_screen(1);
            await browseDetectionMap(MAP_MODE, 'anything of interest', { state });
            await redisplayDetectionMap(constraints, state);
        }
    } finally { reconstrainMap(constraints, state); }
    exerciseWisdom(true, state);
}

export async function mapVicinity(source: GameObject | null, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const extended = !!source && (source.blessed
        || propertyIsActive('clairvoyant', state) || state.u.clairvoyant);
    const hero = state.u;
    const bounds = { left: Math.max(1, hero.ux - 9),
        right: Math.min(COLNO - 1, hero.ux + 10),
        top: Math.max(0, hero.uy - 5), bottom: Math.min(ROWNO - 1, hero.uy + 6) };
    const visionRow = state.viz_array?.[hero.uy];
    const savedVision = visionRow?.[hero.ux];
    if (!visionRow || savedVision === undefined) throw new Error('Mapping requires current hero vision.');
    const savedDetection = hero.detectMonsters;
    if (hero.uswallow) visionRow[hero.ux] = savedVision | IN_SIGHT;
    hero.detectMonsters = true;
    const constraints = unconstrainMap(state);
    const shownObjects = new Map<string, GameObject>();
    let detectedMonster = false, detectedObject = false, refresh = false;
    try {
        for (let x = bounds.left; x <= bounds.right; x++) {
            for (let y = bounds.top; y <= bounds.bottom; y++) {
                const oldGlyph = glyphAt(x, y, state);
                showMapSpot(x, y, { state, confused: (hero.confusionTurns ?? 0) > 0 });
                const object = state.level.objects[x]?.[y]?.[0];
                if (object) {
                    if (extended) observeObject(object, state);
                    map_object(object, true);
                    shownObjects.set(`${x},${y}`, object);
                    if (glyphChanged(oldGlyph, glyphAt(x, y, state))
                        && terrainCoversObjectsAt(x, y, state)) detectedObject = true;
                }
                const monster = state.level.monsters.find(actor => monsterHasMapPosition(actor, state) &&
                    !actor.dead && actor.mhp > 0 && actor.mx === x && actor.my === y);
                if (!monster) continue;
                if ((constraints.changed || !state.level.flags.hero_memory)
                    && !extended && (x !== hero.ux || y !== hero.uy)
                    && oldGlyph?.kind !== 'monster') map_invisible(x, y);
                else mapDetectedMonster(monster, false, state);
                const newGlyph = glyphAt(x, y, state);
                if (extended && glyphChanged(oldGlyph, newGlyph)
                    && newGlyph?.kind !== 'invisible') detectedMonster = true;
            }
        }
        if (!source && state.flags.quick_farsight)
            detectedMonster = detectedObject = false;
        if (!state.level.flags.hero_memory || constraints.changed
            || detectedMonster || detectedObject) {
            await flush_screen(1);
            await pline('You sense your surroundings.');
            const mode = MAP_MODE | (extended || glyphAt(hero.ux, hero.uy)?.kind === 'monster'
                ? TER_MON : 0);
            await browseDetectionMap(mode, 'anything of interest', { objects: shownObjects, state });
            refresh = true;
        }
    } finally {
        reconstrainMap(constraints, state);
        if (savedDetection === undefined) delete hero.detectMonsters;
        else hero.detectMonsters = savedDetection;
        visionRow[hero.ux] = savedVision;
    }
    for (let x = bounds.left; x <= bounds.right; x++) {
        for (let y = bounds.top; y <= bounds.bottom; y++) {
            if (x === hero.ux && y === hero.uy) continue;
            const glyph = glyphAt(x, y, state);
            if (glyph?.kind !== 'monster' || glyph.mnum === LONG_WORM_TAIL) continue;
            const monster = state.level.monsters.find(actor => monsterHasMapPosition(actor, state) &&
                !actor.dead && actor.mhp > 0 && actor.mx === x && actor.my === y);
            if (!monster || !canSpotMonster(monster)) map_invisible(x, y);
        }
    }
    await see_monsters();
    if (refresh) await docrt();
}

// Native compares glyph identities, which include species and object type;
// colors and tty highlighting do not make a different remembered glyph.
function glyphChanged(before: ReturnType<typeof glyphAt>, after: ReturnType<typeof glyphAt>): boolean {
    if (before?.kind !== after?.kind || glyphCharacter(before) !== glyphCharacter(after)) return true;
    if (!before || !after) return false;
    if (before.kind === 'object' && after.kind === 'object') return before.otyp !== after.otyp;
    if (before.kind === 'monster' && after.kind === 'monster') return before.mnum !== after.mnum;
    if (before.kind === 'trap' && after.kind === 'trap') return before.trapType !== after.trapType;
    return false;
}

function glyphCharacter(glyph: ReturnType<typeof glyphAt>): string | undefined {
    return glyph && 'ch' in glyph && typeof glyph.ch === 'string' ? glyph.ch : undefined;
}
