// Revealing a monster disguised as an object or dungeon feature.
// C refs: uhitm.c stumble_onto_mimic() and lock.c stumble_on_door_mimic().

import {
    M_AP_FURNITURE, M_AP_OBJECT, STRAT_WAITMASK,
} from './const.js';
import {
    canSenseMonster, monsterHasWarningProjection, newsym, pline,
} from './display.js';
import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { MONSTER_NAME } from './monster_data.js';
import { OBJECT_NAMES } from './object_data.js';

const S_VERTICAL_CLOSED_DOOR = 15;
const S_HORIZONTAL_CLOSED_DOOR = 16;
const CLOSED_DOOR_APPEARANCES = new Set([
    S_VERTICAL_CLOSED_DOOR,
    S_HORIZONTAL_CLOSED_DOOR,
]);
const PM_SMALL_MIMIC = 64;
const PM_LARGE_MIMIC = 65;
const PM_GIANT_MIMIC = 66;
const STICKY_MIMICS = new Set([
    PM_SMALL_MIMIC,
    PM_LARGE_MIMIC,
    PM_GIANT_MIMIC,
]);

function indefiniteArticle(noun) {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function furnitureName(appearance) {
    if (CLOSED_DOOR_APPEARANCES.has(appearance)) return 'closed door';
    return 'dungeon feature';
}

function revealMessage(monster, state) {
    const species = MONSTER_NAME[monster.mnum] || 'mimic';
    const describedSpecies = `${indefiniteArticle(species)} ${species}`;
    if (monster.m_ap_type === M_AP_OBJECT) {
        // Native object_from_map() allocates a temporary object to name the
        // disguise, so revealing it advances the shared identity stream.
        nextIdent(state);
        const appearance = OBJECT_NAMES[monster.mappearance]
            || 'strange object';
        return `That ${appearance} is ${describedSpecies}!`;
    }
    return `That ${furnitureName(monster.mappearance)} actually is ${
        describedSpecies}!`;
}

export function isObjectOrFurnitureMimic(monster, state = game) {
    return !!monster
        && [M_AP_OBJECT, M_AP_FURNITURE].includes(monster.m_ap_type)
        && !(state.u?.protectionFromShapeChangers
            || state.u?.protection_from_shape_changers
            || state.protectionFromShapeChangers)
        && !canSenseMonster(monster)
        && !monsterHasWarningProjection(monster);
}

export function isDoorMimic(monster, state = game) {
    return isObjectOrFurnitureMimic(monster, state)
        && monster.m_ap_type === M_AP_FURNITURE
        && CLOSED_DOOR_APPEARANCES.has(monster.mappearance);
}

export async function revealMimic(
    monster,
    state = game,
    publish = pline,
) {
    if (!isObjectOrFurnitureMimic(monster, state)) return false;

    await publish(revealMessage(monster, state));
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    monster.msleeping = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!state.u?.ustuck && !monster.mflee
        && STICKY_MIMICS.has(monster.mnum)
        && Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1) {
        state.u.ustuck = monster;
    }
    newsym(monster.mx, monster.my);
    return true;
}
