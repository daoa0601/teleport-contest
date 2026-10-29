// Call the emitted constructors. This module only loads and projects state.
import { freshObjectRoom } from '../../test/support/object-room.js';
import { game } from '../../js/gstate.js';
import { initRng, enableRngLog, getRngLog } from '../../js/rng.js';
import { isaac64_next_uint64 } from '../../js/isaac64.js';
import { grantIntrinsicProperty } from '../../js/properties.js';
import { mksobj, mkobj, rndClass, rndmonstAdj, mkclassAligned, makemonAt, oinit } from '../../js/mklev.js';
import { level_difficulty } from '../../js/dungeon.js';
import { monsterTeleportRestricted } from '../../js/teleport_rules.js';
import { GLOB_OF_GRAY_OOZE, GLOB_OF_BLACK_PUDDING, CORPSE, STATUE, FIGURINE,
    TIN, EGG, SPE_NOVEL } from '../../js/object_data.js';
import { MM_NOGRP, MM_ANGRY, MM_NOMSG, MM_NONAME, MM_NOTAIL } from '../../js/const.js';

export async function runCreation(input) {
    setup(input);
    const before = [position(game.coreCtx), position(game.displayCtx)];
    let result = 0, objects = [], teleportRestricted = null;
    switch (input.target) {
    case 6: objects = [await mksobj(input.otyp, !!input.init, !!input.artif)]; break;
    case 7: objects = [await mkobj(input.oclass, !!input.artif)]; break;
    case 8: result = rndClass(input.first, input.last); break;
    case 9: result = rndmonstAdj() ?? -1; break;
    case 10: result = mkclassAligned(input.mclass, input.spc, input.alignment) ?? -1; break;
    case 11: {
        const monster = await makemonAt(input.mnum, 11, 10,
            MM_NOGRP | MM_ANGRY | MM_NOMSG | MM_NONAME | MM_NOTAIL);
        result = monster?.mnum ?? -1;
        objects = monster?.minvent ?? [];
        if (monster) teleportRestricted = Number(monsterTeleportRestricted(monster, game));
        break;
    }
    default: throw new Error(`Unknown creation target ${input.target}`);
    }
    return { result, objects: objects.map(saveObject), teleportRestricted,
        difficulty: level_difficulty(), nextIdent: game._nextIdent,
        vitals: game.mvitals.map(({ mvflags, born }) => [mvflags, born]),
        rng: { core: position(game.coreCtx) - before[0],
            display: position(game.displayCtx) - before[1], log: [...getRngLog()] } };
}

function setup(input) {
    const level = input.level;
    const dnum = level.place >= 4 ? 5 : level.place === 3 ? 2 : 0;
    const dlevel = level.place >= 4 ? 9 - level.place : level.depth;
    freshObjectRoom({ role: 'archeologist', moves: level.moves, recalculateVision: false,
        context: { current_fruit: 1 },
        hero: { uz: { dnum, dlevel }, ulevel: level.heroLevel,
            ualign: { type: 0, record: 10 } },
    });
    game._nextIdent = 2;
    game.quest_dnum = 1; game.mines_dnum = 2; game.sokoban_dnum = 3; game.tower_dnum = 4;
    game.astral_level = { dnum: 5, dlevel: 1 };
    game.water_level = { dnum: 5, dlevel: 2 };
    game.fire_level = { dnum: 5, dlevel: 3 };
    game.air_level = { dnum: 5, dlevel: 4 };
    game.earth_level = { dnum: 5, dlevel: 5 };
    game.sanctum_level = { dnum: 0, dlevel: level.depth };
    game.rogue_level = { dnum: level.place === 2 ? dnum : 6, dlevel };
    game.dungeons = Array.from({ length: 7 }, (_, index) => ({
        dname: index === 1 ? 'The Quest' : `difftest-${index}`,
        depth_start: 1, num_dunlevs: 50, entry_lev: 1, ledger_start: index * 50,
        flags: { hellish: index === dnum && level.place === 1,
            alignment: index === dnum && level.alignment !== -128 ? level.alignment : null },
    }));
    game.in_mklev = !!level.inMklev;
    game.level.flags.temperature = level.temperature;
    game.level.flags.noteleport = !!level.noTeleport;
    game.level.flags.stasis_until = level.stasisUntil;
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++) game.level.at(x, y).lit = !!level.lit;
    for (const vital of input.vitals) {
        game.mvitals[vital.mnum].mvflags |= vital.flags;
        game.mvitals[vital.mnum].born = vital.born;
    }
    grantIntrinsicProperty('protectionFromShapeChangers', 'outside');
    oinit();
    initRng(input.seed);
    for (let i = 0; i < input.position; i++) isaac64_next_uint64(game.coreCtx);
    enableRngLog();
}


function position(context) {
    return Number(context.c) * 256 - context.n;
}

function saveObject(object) {
    const body = [CORPSE, STATUE, FIGURINE, TIN, EGG].includes(object.otyp)
        || object.otyp >= GLOB_OF_GRAY_OOZE && object.otyp <= GLOB_OF_BLACK_PUDDING;
    const result = { otyp: object.otyp, o_id: object.o_id, oclass: object.oclass, quan: object.quan,
        owt: object.owt, corpsenm: body ? object.corpsenm ?? -1 : -1,
        spe: object.spe, age: object.age };
    for (const key of ['blessed', 'cursed', 'oeroded', 'oeroded2', 'oerodeproof',
        'opoisoned', 'greased', 'known', 'dknown', 'bknown', 'rknown', 'tknown',
        'olocked', 'otrapped', 'recharged', 'lamplit', 'globby', 'oeaten', 'oartifact']) {
        result[key] = Number(object[key] ?? 0);
    }
    result.wornMask = object.owornmask ?? 0;
    result.where = object.where;
    result.novelidx = object.otyp === SPE_NOVEL ? object.novelidx : -1;
    result.timers = (object.objectTimers ?? [])
        .map(({ kind, deadline }) => ({ kind, deadline }))
        .sort((a, b) => a.deadline - b.deadline || a.kind.localeCompare(b.kind));
    result.containerType = object.container?.otyp ?? -1;
    result.carrierSpecies = object.ocarry?.mnum ?? -1;
    result.aliases = {};
    for (const key of ['orotten', 'odiluted', 'norevive', 'on_ice', 'degraded_horn',
        'leashmon', 'fromsink', 'next_boulder', 'spestudied']) {
        result.aliases[key] = Number(object[key] ?? 0);
    }
    result.contents = (object.contents ?? []).map(saveObject);
    return result;
}
