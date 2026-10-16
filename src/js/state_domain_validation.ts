import type { DiggingContext, GameContext, SpellbookContext } from './game_state.js';
import type {
    Dungeon, DungeonBranch, DungeonFlags, OverviewRecord, SpecialLevelDescriptor,
} from './dungeon_types.js';
import type {
    ActiveSpecialLevel, LevelRegion, Rectangle, SpecialLevelContext,
} from './map_types.js';
import type {
    FoodMeal, NonfoodMeal, PreparedFoodObject, TinOpening,
} from './occupation_types.js';
import type { SavedEntityContext } from './saved_validation.js';
import {
    arrayOf, boolean, closedFieldsMatch, integer, nullable, oneOf, optional, string,
} from './saved_validation.js';
import { isSavedRecord } from './saved_graph.js';
import { validSavedDungeonLocation, validSavedPosition } from './map_validation.js';
import { TAKEOFF_ORDER } from './takeoff_state.js';
import type { TakeoffContext } from './takeoff_state.js';

export function validSavedGameContext(
    value: unknown, entities: SavedEntityContext,
): value is GameContext {
    return closedFieldsMatch<GameContext>(value, {
        move: integer,
        botl: optional((entry): entry is boolean | number => boolean(entry) || integer(entry)),
        time_botl: optional(boolean),
        bypasses: optional(boolean),
        current_fruit: optional(integer),
        deathNotice: optional(boolean),
        digging: optional(validDiggingContext),
        forcefight: optional((entry): entry is boolean | number => boolean(entry) || integer(entry)),
        jingle: optional(string),
        lifelist: optional(validLifeList),
        made_amulet: optional(boolean),
        mon_moving: optional(boolean),
        mv: optional(boolean),
        no_of_wizards: optional(integer),
        nopick: optional(boolean),
        novel: optional(validNovelContext),
        objsplit: optional((entry): entry is NonNullable<GameContext['objsplit']> =>
            closedFieldsMatch<NonNullable<GameContext['objsplit']>>(entry, {
                parent_oid: (id): id is number => integer(id) && id >= 0,
                child_oid: (id): id is number => integer(id) && id >= 0,
            })),
        obj_zapped: optional(boolean),
        polearm: optional(validPolearmContext),
        poly_zapped: optional(integer),
        run: optional(integer),
        snickersneeTurn: optional(integer),
        spbook: optional((entry): entry is SpellbookContext =>
            closedFieldsMatch<SpellbookContext>(entry, {
                book: nullable(entities.object), o_id: integer, delay: integer,
            })),
        startingpet_mid: optional(integer),
        startingpet_typ: optional(integer),
        takeoff: optional(validTakeoffContext),
        tips: optional(integer),
        travel: optional(boolean),
        travel1: optional(boolean),
        warnlevel: optional(integer),
        warntype: optional(validWarningContext),
        zap_oseen: optional(boolean),
        achieveo: optional(validAchievementObjects),
        victual: optional(nullable((entry): entry is FoodMeal | NonfoodMeal =>
            validMeal(entry, entities))),
        tin: optional(nullable((entry): entry is TinOpening => validTinOpening(entry, entities))),
        forceSaveHungerState: optional(boolean),
        hungerStateBeforeMeal: optional(integer),
    });
}

function validTakeoffContext(value: unknown): value is TakeoffContext {
    return closedFieldsMatch<TakeoffContext>(value, {
        pending: arrayOf(oneOf(...TAKEOFF_ORDER)),
        current: nullable(oneOf(...TAKEOFF_ORDER)),
        delay: (entry): entry is number => integer(entry) && entry >= 0,
        text: oneOf('disrobing', 'disarming'),
    }) && new Set(value.pending).size === value.pending.length
        && (value.current === null || value.pending.includes(value.current));
}

export function validSavedDungeon(value: unknown): value is Dungeon {
    return closedFieldsMatch<Dungeon>(value, {
        dname: string,
        num_dunlevs: integer,
        entry_lev: integer,
        dunlev_ureached: integer,
        depth_start: integer,
        flags: validDungeonFlags,
        bonetag: optional(string),
        protofile: optional(string),
        levelFill: optional(string),
        themeRooms: optional(string),
    });
}

export function validSavedDungeonBranch(value: unknown): value is DungeonBranch {
    return closedFieldsMatch<DungeonBranch>(value, {
        end1: validSavedDungeonLocation,
        end2: validSavedDungeonLocation,
        end1_up: boolean,
        type: oneOf('stair', 'portal', 'no_end1', 'no_end2'),
        portal: boolean,
    });
}

export function validSavedSpecialLevel(value: unknown): value is SpecialLevelDescriptor {
    return closedFieldsMatch<SpecialLevelDescriptor>(value, {
        dnum: integer,
        dlevel: integer,
        bonetag: optional(string),
        flags: (entry): entry is SpecialLevelDescriptor['flags'] =>
            closedFieldsMatch<SpecialLevelDescriptor['flags']>(entry, { town: boolean }),
        alignment: nullable(integer),
    });
}

export function validSavedOverviewRecord(value: unknown): value is OverviewRecord {
    return closedFieldsMatch<OverviewRecord>(value, {
        flags: (entry): entry is OverviewRecord['flags'] => closedFieldsMatch<OverviewRecord['flags']>(entry, {
            notreachable: boolean, forgot: boolean, sokosolved: boolean, bigroom: boolean,
            roguelevel: boolean, oracle: boolean, castle: boolean, castletune: boolean,
            ludios: boolean, valley: boolean, msanctum: boolean, vibrating_square: boolean,
            quest_summons: boolean, questing: boolean,
        }),
        features: validOverviewFeatures,
        branch: nullable((entry): entry is NonNullable<OverviewRecord['branch']> =>
            closedFieldsMatch<NonNullable<OverviewRecord['branch']>>(entry, {
                dnum: integer, dlevel: integer, up: boolean,
            })),
        seenRooms: arrayOf(integer),
        untendedRooms: arrayOf(integer),
    });
}

export function validSavedActiveSpecialLevel(
    value: unknown, entities: SavedEntityContext,
): value is ActiveSpecialLevel {
    return closedFieldsMatch<ActiveSpecialLevel>(value, {
        prototype: string,
        file: string,
        variant: optional(integer),
        align: optional(arrayOf(oneOf('law', 'neutral', 'chaos'))),
        defaultLit: optional(nullable(boolean)),
        context: optional((entry): entry is SpecialLevelContext =>
            closedFieldsMatch<SpecialLevelContext>(entry, {
                xstart: integer, ystart: integer, width: integer, height: integer,
                _room: optional(entities.room),
            })),
        allowFlips: optional(integer),
        checkInaccessibles: optional(boolean),
        icedPools: optional(boolean),
        levelInitialized: optional(boolean),
        solidify: optional(boolean),
        premapped: optional(boolean),
        elementalBubbles: optional(boolean),
        baalzFixup: optional(boolean),
        baalzFixupArea: optional(validBaalzebubArea),
        baalzPoolMarkers: optional(arrayOf(validSavedPosition)),
        specialMessages: optional(arrayOf(string)),
        levelRegions: optional(arrayOf((region): region is LevelRegion =>
            closedFieldsMatch<LevelRegion>(region, {
                type: oneOf('stair-up', 'stair-down', 'branch', 'portal'),
                area: validRectangle,
                exclude: nullable(validRectangle),
                destination: optional(string),
            }))),
        upTeleportRegion: optional(validRectangle),
        upTeleportExclude: optional(nullable(validRectangle)),
        downTeleportRegion: optional(validRectangle),
        downTeleportExclude: optional(nullable(validRectangle)),
    });
}

function validDiggingContext(value: unknown): value is DiggingContext {
    return closedFieldsMatch<DiggingContext>(value, {
        pos: validSavedPosition,
        level: validSavedDungeonLocation,
        down: boolean,
        chew: boolean,
        warned: boolean,
        effort: integer,
        lastdigtime: integer,
        quiet: boolean,
    });
}

function validLifeList(value: unknown): value is NonNullable<GameContext['lifelist']> {
    return closedFieldsMatch<NonNullable<GameContext['lifelist']>>(value, {
        total_seen_upclose: optional(integer), total_photographed: optional(integer),
    });
}

function validNovelContext(value: unknown): value is NonNullable<GameContext['novel']> {
    return closedFieldsMatch<NonNullable<GameContext['novel']>>(value, {
        id: integer, count: integer, pasg: arrayOf(integer),
    });
}

function validPolearmContext(value: unknown): value is NonNullable<GameContext['polearm']> {
    return closedFieldsMatch<NonNullable<GameContext['polearm']>>(value, {
        hitmonId: nullable(integer),
    });
}

function validWarningContext(value: unknown): value is NonNullable<GameContext['warntype']> {
    return closedFieldsMatch<NonNullable<GameContext['warntype']>>(value, {
        obj: optional(integer), polyd: integer, speciesidx: integer,
    });
}

function validAchievementObjects(value: unknown): value is NonNullable<GameContext['achieveo']> {
    return closedFieldsMatch<NonNullable<GameContext['achieveo']>>(value, {
        mines_prize_oid: optional(integer), mines_prize_otyp: optional(integer),
        soko_prize_oid: optional(integer), soko_prize_otyp: optional(integer),
    });
}

function validMeal(
    value: unknown, entities: SavedEntityContext,
): value is FoodMeal | NonfoodMeal {
    if (!isSavedRecord(value)) return false;
    if (value.key === 'eat-food') {
        return closedFieldsMatch<FoodMeal>(value, {
            key: oneOf('eat-food'),
            text: optional(string),
            piece: nullable((entry): entry is PreparedFoodObject =>
                entities.object(entry) && integer(entry.oeaten)),
            o_id: integer,
            usedtime: integer,
            reqtime: integer,
            nmod: integer,
            canchoke: boolean,
            fullwarn: boolean,
            eating: boolean,
            doreset: boolean,
        });
    }
    return closedFieldsMatch<NonfoodMeal>(value, {
        key: (entry): entry is undefined => entry === undefined,
        piece: nullable(entities.object),
        o_id: integer,
        reqtime: integer,
        usedtime: integer,
        nmod: integer,
        canchoke: boolean,
        eating: boolean,
        fullwarn: optional(boolean),
        doreset: optional(boolean),
    });
}

function validTinOpening(value: unknown, entities: SavedEntityContext): value is TinOpening {
    return closedFieldsMatch<TinOpening>(value, {
        key: oneOf('open-tin'),
        text: string,
        object: entities.object,
        tin: nullable(entities.object),
        o_id: integer,
        reqtime: integer,
        usedtime: integer,
    });
}

function validDungeonFlags(value: unknown): value is DungeonFlags {
    return closedFieldsMatch<DungeonFlags>(value, {
        maze_like: boolean, hellish: boolean, alignment: nullable(integer),
        unconnected: optional(boolean),
    });
}

function validOverviewFeatures(value: unknown): value is OverviewRecord['features'] {
    return closedFieldsMatch<OverviewRecord['features']>(value, {
        nshop: integer, shoptype: integer, nfount: integer, nsink: integer,
        naltar: integer, altarAlignment: nullable(integer), ntemple: integer,
        nthrone: integer, ngrave: integer, ntree: integer,
    });
}

function validBaalzebubArea(
    value: unknown,
): value is NonNullable<ActiveSpecialLevel['baalzFixupArea']> {
    return closedFieldsMatch<NonNullable<ActiveSpecialLevel['baalzFixupArea']>>(value, {
        x1: integer, y1: integer, x2: integer, y2: integer,
    });
}

function validRectangle(value: unknown): value is Rectangle {
    return closedFieldsMatch<Rectangle>(value, {
        lx: integer, ly: integer, hx: integer, hy: integer,
    });
}

