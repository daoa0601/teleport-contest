// C worn.c:mon_set_minvis() and mon_adjust_speed(). Permanent monster
// invisibility and speed changes.
import { MFAST, MSLOW } from './const.js';
import { game } from './gstate.js';
import { MONSTER_MOVE } from './monster_data.js';
import { OBJECT_PROPERTY } from './object_data.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { naturalMonsterSpeed } from './mon.js';
import { artifactById } from './artifacts.js';
import type { Artifact } from './artifacts.js';
import type { ArtifactDefense, ArtifactFlag } from './data_types.js';
import type { GameObject } from './object_types.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import { see_monsters } from './display.js';
import {
    grantWornProperty,
    hasCarriedProperty,
    removeWornProperty,
    setCarriedProperty,
} from './properties.js';

// C worn.c:mon_set_minvis(). The map refresh and worm-tail reveal that the
// native function performs when visibility flips stay with its callers.
export function setMonsterPermanentInvisibility(monster: Monster, permanent = true) {
    const oldPermanent = !!monster.perminvis;
    const oldInvisible = !!monster.minvis;
    monster.perminvis = permanent ? 1 : 0;
    if (!monster.invis_blkd) monster.minvis = monster.perminvis;
    return {
        oldPermanent,
        oldInvisible,
        permanent: !!monster.perminvis,
        invisible: !!monster.minvis,
        changed: oldInvisible !== !!monster.minvis,
    };
}
export interface MonsterSpeedChange {
    amount: number;
    oldSpeed: number;
    speed: number;
    changed: boolean;
    much: boolean;
    canDescribe: boolean;
}
function wearsSpeedItem(monster: Monster): boolean {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        OBJECT_PROPERTY[object.otyp] === 'fast' && (object.owornmask ?? 0) !== 0);
}
export function adjustMonsterSpeed(monster: Monster, amount: number): MonsterSpeedChange {
    const oldSpeed = monster.mspeed ?? 0;
    if (amount === 2) {
        monster.permspeed = MFAST;
    } else if (amount === 1) {
        monster.permspeed = monster.permspeed === MSLOW ? 0 : MFAST;
    } else if (amount === -1) {
        monster.permspeed = monster.permspeed === MFAST ? 0 : MSLOW;
    } else if (amount === -2) {
        monster.permspeed = MSLOW;
    } else if (amount === -3 || amount === -4) {
        if (monster.permspeed === MFAST) monster.permspeed = 0;
    }

    monster.mspeed = wearsSpeedItem(monster)
        ? MFAST : monster.permspeed ?? 0;
    return {
        amount,
        oldSpeed,
        speed: monster.mspeed,
        changed: monster.mspeed !== oldSpeed,
        much: monster.mspeed + oldSpeed === MFAST + MSLOW,
        canDescribe: naturalMonsterSpeed(monster) !== 0
            && !(monster.mfrozen ?? 0) && !monster.msleeping,
    };
}
export function monsterSpeedMessage(change: MonsterSpeedChange, subject: string, state: GameState = game): string | null {
    if (state.in_mklev || [2, -2, -4].includes(change.amount)
        || (!change.changed && change.amount !== -3) || !change.canDescribe)
        return null;
    if (change.amount === -3)
        return state.flags.verbose ? `${subject} is slowing down.` : null;
    const much = change.much ? 'much ' : '';
    if (change.amount > 0 || change.speed === MFAST)
        return `${subject} is suddenly moving ${much}faster.`;
    return `${subject} seems to be moving ${much}slower.`;
}

// worn.c counts all ordinary worn TELEPAT objects, plus one source for
// every carried ESP artifact together, regardless of their number.
// C worn.c:recalc_telepat_range().
export function recalculateTelepathyRange(state: GameState): void {
    const worn = [state.uarm, state.uarmc, state.uarmh, state.uarms,
        state.uarmg, state.uarmf, state.uarmu, state.uamul, state.uleft,
        state.uright, state.ublindf, state.uwep, state.uswapwep, state.uquiver];
    const ordinary = worn.filter(object => object && object.owornmask
        && OBJECT_PROPERTY[object.otyp] === 'telepathy').length;
    const sources = ordinary + Number(hasCarriedProperty('telepathy', null, state));
    state.u.unblind_telepat_range = sources ? 64 * sources : -1;
}
