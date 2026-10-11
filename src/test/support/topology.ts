import type {
    Dungeon, DungeonFlags, DungeonLocation, SpecialLevelDescriptor,
} from '../../js/dungeon_types.js';
import type { Rectangle, Room } from '../../js/map_types.js';

export function createDungeon({
    flags = {}, ...fields
}: Pick<Dungeon, 'dname'> & Omit<Partial<Dungeon>, 'flags'> & {
    flags?: Partial<DungeonFlags>;
}): Dungeon {
    return {
        num_dunlevs: 1, entry_lev: 1, dunlev_ureached: 1, depth_start: 1,
        bonetag: undefined, protofile: undefined,
        levelFill: undefined, themeRooms: undefined,
        ...fields,
        flags: { maze_like: false, hellish: false, alignment: null, ...flags },
    };
}

export function createSpecialLevel({
    flags = {}, ...fields
}: DungeonLocation & Omit<Partial<SpecialLevelDescriptor>, 'flags'> & {
    flags?: Partial<SpecialLevelDescriptor['flags']>;
}): SpecialLevelDescriptor {
    return { alignment: null, ...fields, flags: { town: false, ...flags } };
}

export function createRoom(fields: Rectangle & Partial<Room>): Room {
    return {
        rtype: 0, rlit: 1, doorct: 0, fdoor: 0, irregular: false,
        needjoining: false, nsubrooms: 0, sbrooms: [], roomnoidx: 0,
        needfill: 0,
        ...fields,
    };
}
