import { STAIRS } from '../../js/const.js';
import { game } from '../../js/gstate.js';
import { createRoomLevel, freshGameplayRoom } from './playable-room.js';

export function freshConnectedLevels({ dungeonName = 'The Dungeons of Doom', ladder = false } = {}) {
    const source = freshGameplayRoom();
    const destination = createRoomLevel();
    source.at(10, 10).typ = destination.at(12, 10).typ = STAIRS;
    source.dnstair = { x: 10, y: 10 };
    destination.upstair = { x: 12, y: 10 };
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{
        dname: dungeonName, depth_start: 1, num_dunlevs: 2, flags: {},
    }];
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: ladder,
        tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    game._levelCache = new Map([['0:2', {
        level: destination,
        stairs: {
            sx: 12, sy: 10, up: true, isladder: ladder,
            tolev: { dnum: 0, dlevel: 1 }, next: null,
        },
        heroTrack: [], savedAt: game.moves,
    }]]);
    return { source, destination };
}
