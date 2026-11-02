// Revealing a monster disguised as an object or dungeon feature.
// C refs: uhitm.c that_is_a_mimic() and stumble_onto_mimic(); monst.h
// is_door_mappear(). lock.c:stumble_on_door_mimic() lives in lock.ts.
import { setHeroGrip } from './hero_grip.js';
import { M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE } from './const.js';
import { canSenseMonster, canSpotMonster, glyphAt, map_invisible } from './display.js';
import { plineWithContinuation as pline } from './pline.js';
import { game } from './gstate.js';
import { AD_STCK } from './monster_attack_types.js';
import { objectAtMonsterDescription } from './pager.js';
import { revealMonsterAppearance } from './mon.js';
import { MONSTER_ATTACKS, MONSTER_SYMBOL, monsterTypeName, requireMonsterData } from './monster_data.js';
import { monsterName } from './do_name.js';
import { monsterAtPosition } from './steed.js';
import { heroIsBlind } from './senses.js';
import { wakeMonster } from './mon.js';
const S_VERTICAL_CLOSED_DOOR = 15;
const S_HORIZONTAL_CLOSED_DOOR = 16;
const CLOSED_DOOR_APPEARANCES = new Set([
    S_VERTICAL_CLOSED_DOOR,
    S_HORIZONTAL_CLOSED_DOOR,
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
            identity = monsterName(monster, { state, article: 'a', exact: true, called: true });
        else if (MONSTER_SYMBOL[monster.mnum] === 13
            && [M_AP_OBJECT, M_AP_FURNITURE].includes(appearance)
            && (monster.msleeping || monster.mfrozen))
            // BUG(per C): a paralyzed mimic is misclassified as sleeping.
            identity = monsterName(monster, {
                state, article: 'a', adjective: 'sleeping', suppressSaddle: false,
            });
        else
            identity = monsterName(monster, { state, article: 'a' });
    }
    if (identity)
        await publish(`${omitWait ? prefix.replace(/^Wait!  /, '') : prefix}${identity}!`);
    await revealMonsterAppearance(monster);
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
        && hasDoorAppearance(monster);
}
// C is_door_mappear() tests only the disguise, regardless of perception.
export function hasDoorAppearance(monster) {
    return !!monster && M_AP_TYPE(monster) === M_AP_FURNITURE
        && monster.mappearance !== undefined && CLOSED_DOOR_APPEARANCES.has(monster.mappearance);
}
export async function revealMimic(monster, state = game, publish = pline) {
    if (!isObjectOrFurnitureMimic(monster, state))
        return false;
    await stumbleOntoMimic(monster, state, publish);
    return true;
}
// C stumble_onto_mimic(): callers establish the unrevealed appearance.
export async function stumbleOntoMimic(monster, state = game, publish = pline) {
    await revealMimicIdentity(monster, { state, publish });
    if (!state.u?.ustuck && !monster.mflee
        && requireMonsterData(MONSTER_ATTACKS, monster.mnum)
            .some(attack => attack[1] === AD_STCK)
        && Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1) {
        setHeroGrip(monster, state);
    }
    await wakeMonster(monster, { attacked: false });
    if (!canSpotMonster(monster))
        await map_invisible(monster.mx, monster.my);
}
//# sourceMappingURL=mimic.js.map