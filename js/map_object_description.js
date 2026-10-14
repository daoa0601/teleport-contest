// C pager.c:object_from_map(), look_at_object(), and mhidden_description().
import { D_CLOSED, D_LOCKED, DOOR, IS_WALL, M_AP_F_DKNOWN, M_AP_OBJECT, M_AP_TYPE, SCORR, SDOOR, STONE, TREE, } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { mkobj, mksobj } from './mklev.js';
import { monsterAtPosition } from './monster_location.js';
import { APPLE, BANANA, CORPSE, EUCALYPTUS_LEAF, GOLD_PIECE, LEASH, OBJECT_NAMES, ORANGE, PEAR, SLIME_MOLD, STATUE, } from './object_data.js';
import { deallocateObject, stopObjectTimers } from './object_delete.js';
import { objectDescription } from './object_description.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { objectClassForType, observeObject } from './object_knowledge.js';
import { distantObjectName, minimalObjectName } from './objnam.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { costlySpot } from './shk.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
const STRANGE_OBJECT = 0;
export async function objectAtMapDescription(x, y, glyph, state = game, style = 'farlook') {
    if (glyph?.kind !== 'object')
        return 'something';
    const level = requireGameLevel(state);
    const monster = monsterAtPosition(level, x, y);
    const mimic = monster && M_AP_TYPE(monster) === M_AP_OBJECT
        && monster.mappearance === glyph.otyp ? monster : null;
    const realObject = mimic ? null
        : level.objects[x]?.[y]?.find(object => object.otyp === glyph.otyp)
            ?? level.buriedObjects?.find(object => object.otyp === glyph.otyp
                && object.ox === x && object.oy === y);
    const temporary = !realObject;
    const object = realObject ?? (OBJECT_NAMES[glyph.otyp]
        ? await mksobj(glyph.otyp, false, false)
        : await mkobj(objectClassForType(glyph.otyp), false));
    try {
        if (temporary) {
            stopObjectTimers(object, state);
            if (object.otyp === GOLD_PIECE)
                object.quan = 2;
            const represented = mimic?.mcorpsenm;
            if (object.otyp === SLIME_MOLD) {
                const fruit = represented !== undefined && represented >= 0
                    ? represented : state.context.current_fruit;
                if (fruit === undefined)
                    throw new Error('Map object description requires fruit history');
                object.spe = fruit;
            }
            else if (represented !== undefined && represented >= 0) {
                object.corpsenm = represented;
            }
            else if ((object.otyp === CORPSE || object.otyp === STATUE)
                && glyph.corpsenm !== undefined) {
                object.corpsenm = glyph.corpsenm;
            }
            if (object.otyp === LEASH)
                object.leashmon = 0;
            object.where = 'floor';
            object.ox = x;
            object.oy = y;
            object.no_charge = object.otyp === STRANGE_OBJECT && !!costlySpot(x, y, state);
        }
        const adjacent = Math.abs(x - state.u.ux) <= 1 && Math.abs(y - state.u.uy) <= 1;
        if (adjacent && !heroIsBlind(state) && !heroIsHallucinating(state)
            && (temporary || object.where === 'floor') && !state.iflags.terrainmode)
            observeObject(object, state);
        if (temporary && mimic
            && (object.dknown || ((mimic.m_ap_type ?? 0) & M_AP_F_DKNOWN))) {
            mimic.m_ap_type = (mimic.m_ap_type ?? 0) | M_AP_F_DKNOWN;
            observeObject(object, state);
        }
        if (style === 'hidden') {
            const noun = minimalObjectName(object, state);
            return object.quan === 1 ? withIndefiniteArticle(noun) : makePlural(noun);
        }
        const withPrice = object.dknown;
        const description = distantObjectName(object, item => item.otyp === STRANGE_OBJECT ? 'strange object'
            : objectDescription(item, { state, withPrice, vagueQuantity: true }), state);
        return description + placementSuffix(temporary ? null : object, x, y, state);
    }
    finally {
        if (temporary) {
            object.where = 'free';
            deallocateObject(object, state);
        }
    }
}
function placementSuffix(object, x, y, state) {
    const level = requireGameLevel(state);
    const location = level.requireAt(x, y);
    if (object?.where === 'buried')
        return ' (buried)';
    if (location.typ === TREE || level.flags.arboreal && location.typ === STONE) {
        const fruit = object && [APPLE, ORANGE, PEAR, BANANA, EUCALYPTUS_LEAF].includes(object.otyp);
        return fruit ? ' dangling in a tree' : ' stuck in a tree';
    }
    if (location.typ === STONE || location.typ === SCORR)
        return ' embedded in stone';
    if (IS_WALL(location.typ) || location.typ === SDOOR)
        return ' embedded in a wall';
    if (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))
        return ' embedded in a door';
    if (isPoolAt(x, y, state))
        return ' in water';
    if (isLavaAt(x, y, state))
        return ' in molten lava';
    return '';
}
//# sourceMappingURL=map_object_description.js.map