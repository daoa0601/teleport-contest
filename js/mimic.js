// Revealing a monster disguised as an object or dungeon feature.
// C refs: uhitm.c stumble_onto_mimic() and lock.c stumble_on_door_mimic().
import { M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, } from './const.js';
import { canSenseMonster, canSpotMonster, glyphAt, map_invisible, plineWithContinuation as pline, } from './display.js';
import { game } from './gstate.js';
import { objectAtMonsterDescription } from './monster_birth.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_SYMBOL, monsterTypeName } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { wakeMonster } from './monster_anger.js';
import { heroIsBlind } from './senses.js';
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
// C that_is_a_mimic(): revelation alone neither wakes nor creates a hold.
export async function revealMimicIdentity(monster, { state = game, omitWait = false, publish = pline, } = {}) {
    const appearance = M_AP_TYPE(monster);
    let prefix = 'Wait!  That\'s ', identity = null;
    if (heroIsBlind(state)) {
        if (!state.u.telepathy)
            identity = 'a monster';
        else if (appearance === M_AP_MONSTER)
            identity = monsterName(monster, { state, article: 'a' });
    }
    else {
        const glyph = glyphAt(monster.mx, monster.my, state);
        if (glyph?.kind === 'terrain' && (appearance === M_AP_FURNITURE
            || appearance === M_AP_OBJECT && glyph.terrainName === 'trapped chest')) {
            prefix = `That ${glyph.terrainName} actually is `;
        }
        else if (glyph?.kind === 'object') {
            const description = await objectAtMonsterDescription(monster, state, { glyph });
            const singular = /^(?:a|an) /.test(description) || description === 'something';
            const name = description.replace(/^(?:a|an) /, '');
            prefix = `${singular ? 'That' : 'Those'} ${name} ${singular ? 'is' : 'are'} `;
        }
        else if (glyph?.kind === 'monster') {
            if (glyph.mnum === undefined)
                throw new Error('monster display glyph lacks its species');
            prefix = `Wait!  That ${monsterTypeName(glyph.mnum, monster.female)} is really `;
        }
        const seesInvisible = state.u.seeInvisible || (state.u.seeInvisibleTurns ?? 0) > 0;
        if (monster.minvis && !seesInvisible)
            identity = 'a monster';
        else if (appearance === M_AP_MONSTER)
            identity = monsterName(monster, { state, article: 'a', exact: true });
        else {
            const sleeping = MONSTER_SYMBOL[monster.mnum] === 13
                && [M_AP_OBJECT, M_AP_FURNITURE].includes(appearance)
                && (monster.msleeping || monster.mfrozen);
            identity = monsterName(monster, {
                state, article: 'a', adjective: sleeping ? 'sleeping' : '',
            });
        }
    }
    if (identity)
        await publish(`${omitWait ? prefix.replace(/^Wait!  /, '') : prefix}${identity}!`);
    revealMonsterAppearance(monster);
}
export function isObjectOrFurnitureMimic(monster, state = game) {
    return !!monster
        && [M_AP_OBJECT, M_AP_FURNITURE].includes(M_AP_TYPE(monster))
        && !(state.u?.protectionFromShapeChangers
            || state.protectionFromShapeChangers)
        && !canSenseMonster(monster)
        && glyphAt(monster.mx, monster.my, state)?.kind !== 'warning';
}
export function isDoorMimic(monster, state = game) {
    return isObjectOrFurnitureMimic(monster, state)
        && M_AP_TYPE(monster) === M_AP_FURNITURE
        && monster.mappearance !== undefined && CLOSED_DOOR_APPEARANCES.has(monster.mappearance);
}
export async function revealMimic(monster, state = game, publish = pline) {
    if (!isObjectOrFurnitureMimic(monster, state))
        return false;
    await revealMimicIdentity(monster, { state, publish });
    if (!state.u?.ustuck && !monster.mflee
        && STICKY_MIMICS.has(monster.mnum)
        && Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1) {
        state.u.ustuck = monster;
    }
    await wakeMonster(monster, { attacked: false });
    if (!canSpotMonster(monster))
        map_invisible(monster.mx, monster.my);
    return true;
}
//# sourceMappingURL=mimic.js.map