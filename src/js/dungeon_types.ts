// Dungeon topology and the validated dungeon.lua definitions which create it.

export interface DungeonLocation {
    dnum: number;
    dlevel: number;
}

export type DungeonFlag = 'town' | 'hellish' | 'mazelike' | 'roguelike' | 'unconnected';
export type DungeonAlignment = 'lawful' | 'neutral' | 'chaotic' | 'unaligned' | 'noalign';
export type DungeonBranchType = 'stair' | 'portal' | 'no_end1' | 'no_end2';
export type BranchDefinitionType = 'stair' | 'portal' | 'no_up' | 'no_down';

export interface DungeonFlags {
    maze_like: boolean;
    hellish: boolean;
    alignment: number | null;
    unconnected?: boolean;
}

export interface Dungeon {
    dname: string;
    num_dunlevs: number;
    entry_lev: number;
    dunlev_ureached: number;
    depth_start: number;
    flags: DungeonFlags;
    bonetag: string | undefined;
    protofile: string | undefined;
    levelFill: string | undefined;
    themeRooms: string | undefined;
}

export interface DungeonBranch {
    end1: DungeonLocation;
    end2: DungeonLocation;
    end1_up: boolean;
    type: DungeonBranchType;
    portal: boolean;
}

export interface SpecialLevelDescriptor extends DungeonLocation {
    flags: { town: boolean };
    alignment: number | null;
    bonetag?: string;
}

export interface OverviewRecord {
    features: {
        nshop: number;
        shoptype: number;
        nfount: number;
        nsink: number;
        naltar: number;
        altarAlignment: number | null;
        ntemple: number;
        nthrone: number;
        ngrave: number;
        ntree: number;
    };
    branch: (DungeonLocation & { up: boolean }) | null;
    seenRooms: number[];
    untendedRooms: number[];
}

export interface LevelRangeDefinition {
    base: number;
    range: number;
    chain: string | undefined;
}

export interface SpecialLevelDefinition extends LevelRangeDefinition {
    name: string;
    chance: number;
    variants: number;
    alignment: number | null;
    flags: DungeonFlag[];
    bonetag: string | undefined;
}

export interface BranchDefinition extends LevelRangeDefinition {
    name: string;
    up: boolean;
    branchType: BranchDefinitionType;
}

export interface DungeonDefinition {
    name: string;
    base: number;
    range: number;
    chance: number;
    entry: number;
    packedFlags: number;
    bonetag: string | undefined;
    protofile: string | undefined;
    levelFill: string | undefined;
    themeRooms: string | undefined;
    unconnected: boolean;
    flags: DungeonFlags;
    branches: BranchDefinition[];
    levels: SpecialLevelDefinition[];
}
