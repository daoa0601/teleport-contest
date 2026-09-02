import { COLNO, ROWNO } from '../../js/const.js';

export function countTerrain(level, ...types) {
    const wanted = new Set(types);
    let count = 0;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (wanted.has(level.at(x, y)?.typ)) count++;
        }
    }
    return count;
}

export function floorObjects(level) {
    return (level.objects || []).flatMap(column =>
        (column || []).flatMap(pile => pile || []));
}

export function floorObjectsAt(level, x, y) {
    return level.objects?.[x]?.[y] || [];
}

export function floorObjectQuantityAt(level, x, y, type) {
    return floorObjectsAt(level, x, y)
        .filter(object => object.otyp === type)
        .reduce((total, object) => total + object.quan, 0);
}

export function levelStairs(state) {
    const stairs = [];
    for (let stair = state.stairs; stair; stair = stair.next)
        stairs.push(stair);
    return stairs;
}
