// C steed.c:place_monster(). Map placement and list membership are separate:
// callers own the level/migration list, and placement resets every mstate bit.
import { In_endgame, In_quest, Is_knox_level, MON_FLOOR, NON_PM, isok } from './const.js';
import { impossible } from './diagnostics.js';
import { game } from './gstate.js';
import { depth, endgameLevelName } from './hacklib.js';
import { MONSTER_NAME, monsterTypeName } from './monster_data.js';
// C place_monster() diagnoses invalid placements before changing the map.
export async function placeMonsterOnMap(monster, x, y, state = game) {
    const levelName = placementLevelName(state);
    const monsterState = (monster.mstate ?? MON_FLOOR).toString(16);
    if (!isok(x, y) && (x !== 0 || y !== 0 || !monster.isgd)) {
        const name = placementMonsterName(monster, true, state);
        await impossible(`trying to place ${name} at <${x},${y}>`
            + ` mstate:${monsterState} on ${levelName}`, { state });
        x = y = 0;
    }
    if (monster === state.u.usteed && !state._steedDismounting
        || monster.mhp <= 0 && !(monster.isgd && x === 0 && y === 0)) {
        const name = monster === state.u.usteed ? 'steed' : 'defunct monster';
        await impossible(`placing ${name} onto map, mstate:${monsterState}, on ${levelName}?`, { state });
        return;
    }
    const other = state.level && monsterAtPosition(state.level, x, y, state);
    if (other) {
        const name = placementMonsterName(monster, false, state);
        const otherName = other === monster ? 'itself' : placementMonsterName(other, true, state);
        const otherState = (other.mstate ?? MON_FLOOR).toString(16);
        await impossible(`placing ${name} over ${otherName} at <${x},${y}>,`
            + ` mstates:${otherState} ${monsterState} on ${levelName}?`, { state });
    }
    placeMonsterAt(monster, x, y, state);
}
// C minimal_monnam(): diagnostics describe the real species and attitude,
// independently of the hero's sight, hallucination, or the monster's name.
function placementMonsterName(monster, checkLocation, state) {
    if (checkLocation && monster.mnum === MONSTER_NAME.indexOf('long worm') && monster.mx
        && state.level && monsterAtPosition(state.level, monster.mx, monster.my, state) !== monster)
        return `${monsterTypeName(MONSTER_NAME.indexOf('long worm tail'), !!monster.female)} <${monster.mx},${monster.my}>`;
    const attitude = monster.mtame ? 'tame ' : monster.mpeaceful ? 'peaceful ' : '';
    const shape = monster.cham !== undefined && monster.cham !== NON_PM
        ? `{${monsterTypeName(monster.cham, !!monster.female)}}` : '';
    return `${attitude}${monsterTypeName(monster.mnum, !!monster.female)} <${monster.mx},${monster.my}>${shape}`;
}
// C botl.c:describe_level(buf, 0), including its padded dungeon depth.
function placementLevelName(state) {
    const location = state.u.uz;
    if (Is_knox_level(location))
        return state.dungeons[location?.dnum ?? 0]?.dname ?? '';
    if (In_quest(location))
        return `Home ${location?.dlevel ?? 1}`;
    if (In_endgame(location))
        return endgameLevelName(location).replace('Plane of ', '');
    return `${state._tutorialActive ? 'Tutorial' : 'Dlvl'}:${String(depth(location, state.dungeons)).padEnd(2)}`;
}
// Commit a map-slot assignment. The monster chain retains an overwritten
// occupant, but moving the new occupant away must leave an empty square.
export function placeMonsterAt(monster, x, y, state = game) {
    const other = state.level && monsterAtPosition(state.level, x, y, state);
    if (other && other !== monster)
        clearMonsterMapSquare(other, x, y);
    monster.mx = x;
    monster.my = y;
    monster.mstate = MON_FLOOR;
    monster.headOnMap = true;
}
// C remove_monster() clears the square, even when the caller's monster
// was overwritten there. It leaves both coordinates and mstate alone.
export function removeMonsterFromMapAt(x, y, state = game) {
    const occupant = state.level && monsterAtPosition(state.level, x, y, state);
    if (occupant)
        clearMonsterMapSquare(occupant, x, y);
}
function clearMonsterMapSquare(monster, x, y) {
    if (monster.mx === x && monster.my === y)
        monster.headOnMap = false;
    for (const segments of [monster.wormSegments, monster.wormDetachedSegments]) {
        for (const segment of segments ?? []) {
            if (segment.x === x && segment.y === y)
                segment.onMap = false;
        }
    }
}
// Occupancy ends at unlink/off-map placement, not at zero hit points.
export function monsterAtPosition(level, x, y, state = game) {
    return level.monsters.find(monster => monsterHasMapPosition(monster, state)
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
        && state.level && monsterAtPosition(state.level, defender.mx, defender.my, state) === attacker) {
        attacker.headOnMap = false;
        defender.headOnMap = true;
        engulf.defenderExposed = true;
    }
}
export function monsterOccupiesPosition(monster, x, y) {
    return !!monster && ((monster.headOnMap !== false && monster.mx === x && monster.my === y)
        || !!monster.wormSegments?.some(segment => segment.onMap !== false && segment.x !== 0 && segment.x === x && segment.y === y)
        || !!monster.wormDetachedSegments?.some(segment => segment.onMap !== false && segment.x !== 0 && segment.x === x && segment.y === y));
}
//# sourceMappingURL=monster_location.js.map