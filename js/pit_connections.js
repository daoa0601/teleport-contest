// C trap.c:conjoined_pits()/clear_conjoined_pits().
import { is_pit, isok, xdir, ydir } from './const.js';
import { game, requireGameLevel } from './gstate.js';
function pitDirection(from, to) {
    const dx = Math.sign(to.tx - from.tx);
    const dy = Math.sign(to.ty - from.ty);
    return xdir.findIndex((x, i) => i < 8 && x === dx && ydir[i] === dy);
}
export function pitsAreConjoined(first, second) {
    if (!first || !second || !is_pit(first.ttyp) || !is_pit(second.ttyp)
        || !isok(first.tx, first.ty) || !isok(second.tx, second.ty))
        return false;
    const direction = pitDirection(first, second);
    return direction >= 0 && !!((first.conjoined ?? 0) & (1 << direction))
        && !!((second.conjoined ?? 0) & (1 << ((direction + 4) % 8)));
}
export function connectPits(first, second) {
    const direction = pitDirection(first, second);
    if (direction < 0)
        return false;
    const opposite = (direction + 4) % 8;
    const changed = !((first.conjoined ?? 0) & (1 << direction))
        || !((second.conjoined ?? 0) & (1 << opposite));
    first.conjoined = (first.conjoined || 0) | (1 << direction);
    second.conjoined = (second.conjoined || 0) | (1 << opposite);
    return changed;
}
export function clearPitConnections(trap, state = game) {
    if (!trap || !is_pit(trap.ttyp))
        return;
    for (let direction = 0; direction < 8; direction++) {
        if (!((trap.conjoined ?? 0) & (1 << direction)))
            continue;
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined)
            throw new Error('Missing pit direction.');
        const x = trap.tx + dx, y = trap.ty + dy;
        const other = isok(x, y) ? requireGameLevel(state).traps.find(candidate => candidate.tx === x && candidate.ty === y
            && is_pit(candidate.ttyp)) : null;
        if (other)
            other.conjoined = (other.conjoined ?? 0) & ~(1 << ((direction + 4) % 8));
        trap.conjoined = (trap.conjoined ?? 0) & ~(1 << direction);
    }
}
//# sourceMappingURL=pit_connections.js.map