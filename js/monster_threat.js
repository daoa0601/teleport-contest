// C monmove.c:dochugw(): the hero notices a monster and stops the current
// occupation.  movemon() passes the monster's pre-dochug() sighting; makemon()
// and teleport arrivals call dochugw(FALSE), which has no earlier sighting.
import { BOLT_LIM } from './const.js';
import { canSpotMonster } from './display.js';
import { monsterHasNoAttacks } from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { stopHeroOccupation } from './occupation.js';
import { heroIsHallucinating } from './senses.js';
import { couldsee } from './vision.js';
const THREAT_DISTANCE = (BOLT_LIM + 1) * (BOLT_LIM + 1);
// C dochugw() skips canspotmon() when the hero has no occupation.
export function monsterSightingBeforeAction(monster, state) {
    return { seen: !!state._occupation && canSpotMonster(monster), x: monster.mx, y: monster.my };
}
export async function interruptOccupationForMonster(monster, state, before = null) {
    if (!state._occupation)
        return;
    // Hallucination distorts what the hero knows about peacefulness and attacks.
    if (!heroIsHallucinating(state)
        && (monster.mpeaceful || monsterHasNoAttacks(monster.mnum)))
        return;
    const heroDistance = (x, y) => (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2;
    if (heroDistance(monster.mx, monster.my) > THREAT_DISTANCE)
        return;
    if (before?.seen && couldsee(before.x, before.y)
        && heroDistance(before.x, before.y) <= THREAT_DISTANCE)
        return;
    if (!canSpotMonster(monster) || !couldsee(monster.mx, monster.my)
        || !monster.mcanmove
        || monsterIsScaredAt(monster, state, state.u.ux, state.u.uy))
        return;
    await stopHeroOccupation(state);
}
//# sourceMappingURL=monster_threat.js.map