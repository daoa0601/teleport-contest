import { arrayOf, boolean, closedFieldsMatch, integer, nullable, oneOf, optional, string, } from './saved_validation.js';
import { isSavedRecord } from './saved_graph.js';
import { validSavedDungeonLocation, validSavedPosition } from './map_validation.js';
import { TAKEOFF_ORDER } from './takeoff_state.js';
export function validSavedGameContext(value, entities) {
    return closedFieldsMatch(value, {
        move: integer,
        botl: optional((entry) => boolean(entry) || integer(entry)),
        bypasses: optional(boolean),
        current_fruit: optional(integer),
        digging: optional(validDiggingContext),
        forcefight: optional((entry) => boolean(entry) || integer(entry)),
        jingle: optional(string),
        lifelist: optional(validLifeList),
        made_amulet: optional(boolean),
        mon_moving: optional(boolean),
        mv: optional(boolean),
        no_of_wizards: optional(integer),
        nopick: optional(boolean),
        novel: optional(validNovelContext),
        obj_zapped: optional(boolean),
        polearm: optional(validPolearmContext),
        poly_zapped: optional(integer),
        run: optional(integer),
        snickersneeTurn: optional(integer),
        spbook: optional((entry) => closedFieldsMatch(entry, {
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
        xlock: optional(nullable((entry) => closedFieldsMatch(entry, {
            box: nullable(entities.object),
        }))),
        zap_oseen: optional(boolean),
        achieveo: optional(validAchievementObjects),
        victual: optional(nullable((entry) => validMeal(entry, entities))),
        tin: optional(nullable((entry) => validTinOpening(entry, entities))),
        forceSaveHungerState: optional(boolean),
        hungerStateBeforeMeal: optional(integer),
    });
}
function validTakeoffContext(value) {
    return closedFieldsMatch(value, {
        pending: arrayOf(oneOf(...TAKEOFF_ORDER)),
        current: nullable(oneOf(...TAKEOFF_ORDER)),
        delay: (entry) => integer(entry) && entry >= 0,
        text: oneOf('disrobing', 'disarming'),
    }) && new Set(value.pending).size === value.pending.length
        && (value.current === null || value.pending.includes(value.current));
}
export function validSavedDungeon(value) {
    return closedFieldsMatch(value, {
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
export function validSavedDungeonBranch(value) {
    return closedFieldsMatch(value, {
        end1: validSavedDungeonLocation,
        end2: validSavedDungeonLocation,
        end1_up: boolean,
        type: oneOf('stair', 'portal', 'no_end1', 'no_end2'),
        portal: boolean,
    });
}
export function validSavedSpecialLevel(value) {
    return closedFieldsMatch(value, {
        dnum: integer,
        dlevel: integer,
        bonetag: optional(string),
        flags: (entry) => closedFieldsMatch(entry, { town: boolean }),
        alignment: nullable(integer),
    });
}
export function validSavedOverviewRecord(value) {
    return closedFieldsMatch(value, {
        features: validOverviewFeatures,
        branch: nullable((entry) => closedFieldsMatch(entry, {
            dnum: integer, dlevel: integer, up: boolean,
        })),
        seenRooms: arrayOf(integer),
    });
}
export function validSavedActiveSpecialLevel(value, entities) {
    return closedFieldsMatch(value, {
        prototype: string,
        file: string,
        variant: optional(integer),
        align: optional(arrayOf(oneOf('law', 'neutral', 'chaos'))),
        defaultLit: optional(nullable(boolean)),
        context: optional((entry) => closedFieldsMatch(entry, {
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
        portalDestinationName: optional(string),
        upTeleportRegion: optional(validRectangle),
        upTeleportExclude: optional(nullable(validRectangle)),
        downTeleportRegion: optional(validRectangle),
        downTeleportExclude: optional(nullable(validRectangle)),
        explicitBranchRegion: optional(validRectangle),
        explicitBranchExclude: optional(nullable(validRectangle)),
        explicitPortalRegion: optional(validRectangle),
        explicitPortalExclude: optional(nullable(validRectangle)),
        explicitUpStairRegion: optional(validStairRegion),
        explicitDownStairRegion: optional(validStairRegion),
    });
}
function validDiggingContext(value) {
    return closedFieldsMatch(value, {
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
function validLifeList(value) {
    return closedFieldsMatch(value, {
        total_seen_upclose: optional(integer), total_photographed: optional(integer),
    });
}
function validNovelContext(value) {
    return closedFieldsMatch(value, {
        id: integer, count: integer, pasg: arrayOf(integer),
    });
}
function validPolearmContext(value) {
    return closedFieldsMatch(value, {
        hitmonId: nullable(integer),
    });
}
function validWarningContext(value) {
    return closedFieldsMatch(value, {
        obj: optional(integer), polyd: integer, speciesidx: integer,
    });
}
function validAchievementObjects(value) {
    return closedFieldsMatch(value, {
        mines_prize_oid: optional(integer), mines_prize_otyp: optional(integer),
        soko_prize_oid: optional(integer), soko_prize_otyp: optional(integer),
    });
}
function validMeal(value, entities) {
    if (!isSavedRecord(value))
        return false;
    if (value.key === 'eat-food') {
        return closedFieldsMatch(value, {
            key: oneOf('eat-food'),
            text: optional(string),
            piece: nullable((entry) => entities.object(entry) && integer(entry.oeaten)),
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
    return closedFieldsMatch(value, {
        key: (entry) => entry === undefined,
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
function validTinOpening(value, entities) {
    return closedFieldsMatch(value, {
        key: oneOf('open-tin'),
        text: string,
        object: entities.object,
        tin: nullable(entities.object),
        o_id: integer,
        reqtime: integer,
        usedtime: integer,
    });
}
function validDungeonFlags(value) {
    return closedFieldsMatch(value, {
        maze_like: boolean, hellish: boolean, alignment: nullable(integer),
        unconnected: optional(boolean),
    });
}
function validOverviewFeatures(value) {
    return closedFieldsMatch(value, {
        nshop: integer, shoptype: integer, nfount: integer, nsink: integer,
        naltar: integer, nthrone: integer, ngrave: integer, ntree: integer,
    });
}
function validBaalzebubArea(value) {
    return closedFieldsMatch(value, {
        x1: integer, y1: integer, x2: integer, y2: integer,
    });
}
function validRectangle(value) {
    return closedFieldsMatch(value, {
        lx: integer, ly: integer, hx: integer, hy: integer,
    });
}
function validStairRegion(value) {
    return closedFieldsMatch(value, {
        lx: integer, ly: integer, hx: integer, hy: integer,
        nlx: optional(integer), nly: optional(integer),
        nhx: optional(integer), nhy: optional(integer),
    });
}
//# sourceMappingURL=state_domain_validation.js.map