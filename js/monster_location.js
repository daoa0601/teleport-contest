// C steed.c:place_monster(). Map placement and list membership are separate:
// callers own the level/migration list, and placement resets every mstate bit.
import { MON_FLOOR } from './const.js';
import { game } from './gstate.js';
export function placeMonsterAt(monster, x, y) {
    monster.mx = x;
    monster.my = y;
    monster.mstate = MON_FLOOR;
    monster.headOnMap = true;
}
// Occupancy ends at unlink/off-map placement, not at zero hit points.
export function monsterAtPosition(level, x, y) {
    return level.monsters.find(monster => monsterHasMapPosition(monster)
        && monsterOccupiesPosition(monster, x, y)) || null;
}
// remove_monster() clears the mounted actor's map slot, without unlinking
// it from fmon or changing mstate. Its coordinates still follow the hero.
export function monsterHasMapPosition(monster, state = game) {
    if (!monster || monster === state.u?.usteed
        || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
        return false;
    const engulf = state._monsterEngulf;
    return !engulf || monster !== (engulf.defenderExposed ? engulf.attacker : engulf.defender);
}
// C mdamagem() makes the dying defender the mapped actor before monkilled().
// Both actors remain in fmon throughout the temporary engulf overlap.
export function exposeEngulfedDefenderForDeath(attacker, defender, state = game) {
    const engulf = state._monsterEngulf;
    if (engulf?.attacker === attacker && engulf.defender === defender
        && state.level && monsterAtPosition(state.level, defender.mx, defender.my) === attacker)
        engulf.defenderExposed = true;
}
export function monsterOccupiesPosition(monster, x, y) {
    return !!monster && ((monster.headOnMap !== false && monster.mx === x && monster.my === y)
        || !!monster.wormSegments?.some(segment => segment.x !== 0 && segment.x === x && segment.y === y)
        || !!monster.wormDetachedSegments?.some(segment => segment.x !== 0 && segment.x === x && segment.y === y));
}
//# sourceMappingURL=monster_location.js.map