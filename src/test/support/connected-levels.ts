import type { GameMap } from '../../js/game.js';
import type { RoleKey } from '../../js/roles.js';
import { LADDER, LA_DOWN, LA_UP, STAIRS } from '../../js/const.js';
import { game } from '../../js/gstate.js';
import { createRoomLevel, freshGameplayRoom } from './playable-room.js';

export interface ConnectedLevelOptions {
    dungeonName?: string; ladder?: boolean; destinationDepth?: number;
    role?: RoleKey; generateDestination?: boolean;
}


export function freshConnectedLevels(options: ConnectedLevelOptions & { generateDestination: true }): { source: GameMap };
export function freshConnectedLevels(options?: ConnectedLevelOptions & { generateDestination?: false }): { source: GameMap; destination: GameMap };
export function freshConnectedLevels(options: ConnectedLevelOptions): { source: GameMap; destination?: GameMap };
export function freshConnectedLevels({
    dungeonName = 'The Dungeons of Doom', ladder = false, destinationDepth = 2,
    role = 'valkyrie', generateDestination = false,
}: ConnectedLevelOptions = {}) {
    const source = freshGameplayRoom({ role });
    const sourceSquare = source.at(10, 10);
    if (!sourceSquare) throw new Error('Connected level needs its source stair square');
    sourceSquare.typ = ladder ? LADDER : STAIRS;
    sourceSquare.ladder = LA_DOWN;
    source.dnstair = { x: 10, y: 10 };
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{
        dname: dungeonName, depth_start: 1, num_dunlevs: destinationDepth,
        entry_lev: 1, dunlev_ureached: 1,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
    }];
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: ladder, u_traversed: false,
        tolev: { dnum: 0, dlevel: destinationDepth }, next: null,
    };
    game._levelCache = new Map();
    if (generateDestination) return { source };

    const destination = createRoomLevel();
    const destinationSquare = destination.at(12, 10);
    if (!destinationSquare) throw new Error('Connected level needs its destination stair square');
    destinationSquare.typ = ladder ? LADDER : STAIRS;
    destinationSquare.ladder = LA_UP;
    destination.upstair = { x: 12, y: 10 };
    game._levelCache.set(`0:${destinationDepth}`, {
        level: destination,
        stairs: {
            sx: 12, sy: 10, up: true, isladder: ladder, u_traversed: false,
            tolev: { dnum: 0, dlevel: 1 }, next: null,
        },
        heroTrack: [], savedAt: game.moves, activeSpecialLevel: null,
    });
    return { source, destination };
}
