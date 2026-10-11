// C ref: uhitm.c check_caitiff().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { adjustHeroAlignment } from './alignment.js';
import { artifactById } from './artifacts.js';
import { recordGameLogEvent } from './gamelog.js';
import { minimalObjectName, objectHasPersonalName, pluralizeObjectNoun } from './objnam.js';
import type { GameObject } from './object_types.js';

const M2_UNDEAD = 0x00000002;

// C uhitm.c:first_weapon_hit(). Player-given names are omitted from the
// conduct log; a recognized artifact keeps its native artifact name.
export function recordFirstHeroWeaponHit(weapon: GameObject, state: GameState = game): void {
    let name: string;
    const artifact = artifactById(weapon.oartifact, state);
    if (objectHasPersonalName(weapon, state)) {
        name = weapon.oextra?.oname || weapon.oname || artifact?.name || minimalObjectName(weapon, state);
    } else {
        name = minimalObjectName(weapon, state);
        if (weapon.quan !== 1) name = pluralizeObjectNoun(weapon, name);
        if (artifact && weapon.dknown)
            name += ` named ${artifact.name.replace(/^The /, '')}`;
    }
    if (weapon.cursed && weapon.bknown) name = `cursed ${name}`;
    recordGameLogEvent(`hit with a wielded weapon (${name}) for the first time`, { state });
}

export async function applyCaitiffPenalty(monster: Monster, state: GameState = game): Promise<boolean> {
    const alignment = state.u.ualign;
    if (!alignment || alignment.record <= -10) return false;
    const helpless = !!monster.msleeping || !monster.mcanmove;
    const fleeingFromBehind = !!(monster.mflee && !monster.mavenge);
    const lawfulKnight = state.urole?.key === 'knight'
        && (state.u?.ualign?.type ?? 0) > 0;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_UNDEAD);
    if (lawfulKnight && !undead && (helpless || fleeingFromBehind)) {
        await plineWithContinuation('You caitiff!');
    } else if (state.urole?.key === 'samurai' && monster.mpeaceful) {
        await plineWithContinuation('You dishonorably attack the innocent!');
    } else return false;
    adjustHeroAlignment(-1, state);
    return true;
}
