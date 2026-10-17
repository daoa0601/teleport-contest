// C monmove.c:dochugw(): the hero notices a monster and stops the current
// occupation.  movemon() passes the monster's pre-dochug() sighting; makemon()
// and teleport arrivals call dochugw(FALSE), which has no earlier sighting.

import { BOLT_LIM } from './const.js';
import { canSpotMonster } from './display.js';
import type { GameState } from './game_state.js';
import { monsterHasNoAttacks } from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import type { Monster } from './monster_types.js';
import { stopHeroOccupation } from './occupation.js';
import { heroIsHallucinating } from './senses.js';
import { couldsee } from './vision.js';

export interface MonsterSighting {
    seen: boolean;
    x: number;
    y: number;
}

const THREAT_DISTANCE = (BOLT_LIM + 1) * (BOLT_LIM + 1);

// C dochugw() skips canspotmon() when the hero has no occupation.
export function monsterSightingBeforeAction(monster: Monster, state: GameState): MonsterSighting {
    return { seen: !!state._occupation && canSpotMonster(monster), x: monster.mx, y: monster.my };
}

export async function interruptOccupationForMonster(
    monster: Monster, state: GameState, before: MonsterSighting | null = null,
): Promise<void> {
    if (!state._occupation) return;
    // Hallucination distorts what the hero knows about peacefulness and attacks.
    if (!heroIsHallucinating(state)
        && (monster.mpeaceful || monsterHasNoAttacks(monster.mnum))) return;
    const heroDistance = (x: number, y: number) => (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2;
    if (heroDistance(monster.mx, monster.my) > THREAT_DISTANCE) return;
    if (before?.seen && couldsee(before.x, before.y)
        && heroDistance(before.x, before.y) <= THREAT_DISTANCE) return;
    if (!canSpotMonster(monster) || !couldsee(monster.mx, monster.my)
        || !monster.mcanmove
        || monsterIsScaredAt(monster, state, state.u.ux, state.u.uy)) return;
    await stopHeroOccupation(state);
}
