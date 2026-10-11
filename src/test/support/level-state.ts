import type { GameMap } from '../../js/game.js';
import type { GameObject } from '../../js/object_types.js';
import type { Stairway, Trap } from '../../js/map_types.js';
import { COLNO, ROWNO } from '../../js/const.js';

export function countTerrain(level: GameMap, ...types: number[]): number {
    const wanted = new Set(types);
    let count = 0;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = level.at(x, y);
            if (location && wanted.has(location.typ)) count++;
        }
    }
    return count;
}

export function floorObjects(level: GameMap): GameObject[] {
    return level.objects.flatMap(column =>
        (column || []).flatMap(pile => pile || []));
}

export function floorObjectsAt(level: GameMap, x: number, y: number): GameObject[] {
    return level.objects[x]?.[y] || [];
}

export function floorObjectQuantityAt(level: GameMap, x: number, y: number, type: number): number {
    return floorObjectsAt(level, x, y)
        .filter(object => object.otyp === type)
        .reduce((total, object) => total + object.quan, 0);
}

export function addTrap(level: GameMap, type: number, x: number, y: number, overrides: Partial<Trap> = {}): Trap {
    const trap: Trap = {
        ttyp: type, tx: x, ty: y, tseen: false, once: false,
        launch: { x: 0, y: 0 }, ...overrides,
    };
    level.traps.push(trap);
    return trap;
}

export function levelStairs(state: { stairs: Stairway | null }): Stairway[] {
    const stairs = [];
    for (let stair = state.stairs; stair; stair = stair.next)
        stairs.push(stair);
    return stairs;
}
