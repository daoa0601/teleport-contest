// Ordinary monster death and corpse rules.
// C refs: mon.c mondead(), mondied(), corpse_chance(), and make_corpse().

import {
    CORPSTAT_FEMALE, CORPSTAT_INIT, CORPSTAT_MALE,
    G_NOCORPSE, Is_rogue_level,
} from './const.js';
import {
    canProjectMonster, newsym, plineWithContinuation, unmap_invisible,
} from './display.js';
import { recordVanquished } from './end.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import {
    mkcorpstat, mkgold, mksobj, undeadToCorpse,
} from './mklev.js';
import { preventMonsterDeath } from './mondeath.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL,
} from './monster_data.js';
import { corpseKeepsMonsterTraits } from './monster_traits.js';
import {
    BOOMERANG, BULLWHIP, CLUB, CORPSE, ELVEN_SPEAR,
    GRAPPLING_HOOK, IRON_CHAIN, LEASH, LEATHER_ARMOR, LEATHER_CLOAK,
    QUARTERSTAFF, ROCK, SADDLE, SCR_BLANK_PAPER, SMALL_SHIELD, STATUE,
    WORTHLESS_PIECE_OF_VIOLET_GLASS,
    WORTHLESS_PIECE_OF_WHITE_GLASS,
} from './object_data.js';
import { markQuestLeaderDead } from './quest.js';
import { d, rnd, rnl, rn2 } from './rng.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';

const PM_PAPER_GOLEM = 250;
const PM_ROPE_GOLEM = 251;
const PM_GOLD_GOLEM = 252;
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;
const PM_CLAY_GOLEM = 256;
const PM_STONE_GOLEM = 257;
const PM_GLASS_GOLEM = 258;
const PM_IRON_GOLEM = 259;
const PM_VLAD_THE_IMPALER = 228;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_LIZARD = 326;
const PM_ARCHEOLOGIST = 331;
const PM_WIZARD = 343;
const S_GOLEM = 55;
const S_LICH = 38;
const M2_UNDEAD = 0x00000002;
const M2_NEUTER = 0x00040000;

const SPECIAL_GOLEM_REMAINS = new Set([
    PM_PAPER_GOLEM, PM_ROPE_GOLEM, PM_GOLD_GOLEM, PM_LEATHER_GOLEM,
    PM_WOOD_GOLEM, PM_CLAY_GOLEM, PM_STONE_GOLEM, PM_GLASS_GOLEM,
    PM_IRON_GOLEM,
]);

export function levelAllowsMonsterDeathDrops(
    monster, state = game, random = rn2,
) {
    if (Is_rogue_level(state.u?.uz)
        || state.level?.flags?.deathdrops === false) return false;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_UNDEAD);
    return !(state.level?.flags?.graveyard && undead && random(3));
}

export function monsterBodyCrumblesMessage(monster) {
    const mnum = monster.mnum;
    if (mnum !== PM_VLAD_THE_IMPALER
        && MONSTER_SYMBOL[mnum] !== S_LICH) return null;
    const name = monster.name || MONSTER_NAME[mnum] || 'monster';
    const usesArticle = !monster.name && !/^[A-Z]/.test(name);
    const subject = usesArticle ? `The ${name}` : name;
    const possessive = /s$/i.test(subject) ? `${subject}'` : `${subject}'s`;
    return `${possessive} body crumbles into dust.`;
}

export function monsterLeavesCorpse(monster, random = rn2) {
    if (monsterBodyCrumblesMessage(monster)) return false;
    const mnum = monster.mnum;
    const guaranteed = (((MONSTER_SIZE[mnum] ?? 2) >= 3
            || mnum === PM_LIZARD) && !monster.mcloned)
        || MONSTER_SYMBOL[mnum] === S_GOLEM
        || (mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD)
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE)
        || !!monster.isshk;
    if (guaranteed) return true;
    const frequency = (MONSTER_GENO[mnum] ?? 0) & 0x7;
    const corpseDenominator = 2 + Number(frequency < 2)
        + Number((MONSTER_SIZE[mnum] ?? 0) === 0);
    return random(corpseDenominator) === 0;
}

function corpseFlags(monster, initialize = true) {
    let flags = initialize ? CORPSTAT_INIT : 0;
    if (monster.female) flags |= CORPSTAT_FEMALE;
    else if (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER))
        flags |= CORPSTAT_MALE;
    return flags;
}

function woodGolemMaterial() {
    if (rn2(2)) return QUARTERSTAFF;
    if (rn2(3)) return SMALL_SHIELD;
    if (rn2(3)) return CLUB;
    if (rn2(3)) return ELVEN_SPEAR;
    return BOOMERANG;
}

function ropeGolemMaterial() {
    if (rn2(2)) return LEASH;
    return rn2(3) ? BULLWHIP : GRAPPLING_HOOK;
}

function leatherGolemMaterial() {
    if (rn2(4)) return LEATHER_ARMOR;
    return rn2(3) ? LEATHER_CLOAK : SADDLE;
}

function createGolemRemains(monster, state) {
    const x = monster.mx;
    const y = monster.my;
    let remains = null;
    const placeNewObject = (type, initialize = true) => {
        remains = mksobj(type, initialize, false);
        place_object(remains, x, y, state);
    };

    switch (monster.mnum) {
    case PM_IRON_GOLEM:
        for (let count = d(2, 6); count > 0; count--)
            placeNewObject(IRON_CHAIN);
        break;
    case PM_GLASS_GOLEM:
        for (let count = d(2, 4); count > 0; count--) {
            const glassType = WORTHLESS_PIECE_OF_WHITE_GLASS
                + rn2(WORTHLESS_PIECE_OF_VIOLET_GLASS
                    - WORTHLESS_PIECE_OF_WHITE_GLASS + 1);
            placeNewObject(glassType);
        }
        break;
    case PM_CLAY_GOLEM:
        placeNewObject(ROCK, false);
        remains.quan = remains.quantity = rn2(20) + 50;
        remains.owt = objectWeight(remains);
        break;
    case PM_STONE_GOLEM:
        remains = mkcorpstat(
            STATUE, null, monster.mnum, x, y, corpseFlags(monster, false),
        );
        if (monster.name) remains.oname = monster.name;
        break;
    case PM_WOOD_GOLEM:
        for (let count = d(2, 4); count > 0; count--)
            placeNewObject(woodGolemMaterial());
        break;
    case PM_ROPE_GOLEM:
        for (let count = rn2(3); count > 0; count--)
            placeNewObject(ropeGolemMaterial());
        break;
    case PM_LEATHER_GOLEM:
        for (let count = d(2, 4); count > 0; count--)
            placeNewObject(leatherGolemMaterial());
        break;
    case PM_GOLD_GOLEM:
        remains = mkgold(200 - rnl(101), x, y, state);
        break;
    case PM_PAPER_GOLEM:
        for (let count = rnd(4); count > 0; count--)
            placeNewObject(SCR_BLANK_PAPER);
        break;
    default:
        break;
    }

    if (monster.mnum !== PM_STONE_GOLEM) delete monster.name;
    return remains ? stack_object(remains, state) : null;
}

export function createMonsterRemains(
    monster, state = game, { zombify = false } = {},
) {
    const x = monster.mx;
    const y = monster.my;
    if (SPECIAL_GOLEM_REMAINS.has(monster.mnum))
        return createGolemRemains(monster, state);

    const corpseForm = undeadToCorpse(monster.mnum);
    if (corpseForm === monster.mnum
        && ((MONSTER_GENO[monster.mnum] ?? 0) & G_NOCORPSE)) {
        return null;
    }
    const leaderId = state.quest_status?.leader_m_id;
    const savedMonster = corpseForm !== monster.mnum
        || corpseKeepsMonsterTraits(monster, leaderId)
        ? monster : null;
    const corpse = mkcorpstat(
        CORPSE, savedMonster, corpseForm, x, y, corpseFlags(monster), {
            zombify,
        },
    );
    corpse.name = `${MONSTER_NAME[corpseForm] || 'monster'} corpse`;
    if (monster.name) corpse.oname = monster.name;
    if (corpseForm !== monster.mnum)
        corpse.age = (corpse.age ?? state.moves ?? 1) - 51;
    return stack_object(corpse, state);
}

function releaseDeadMonsterInventory(monster, state) {
    const x = monster.mx;
    const y = monster.my;
    const carried = monster.minvent || monster.inventory || [];
    for (const object of carried) {
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        object.wielded = false;
        object.alternate = false;
        object.ready = false;
        place_object(object, x, y, state);
        stack_object(object, state);
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
}

function detachDeadMonster(monster, state) {
    const x = monster.mx;
    const y = monster.my;
    const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
    releaseDeadMonsterInventory(monster, state);
    monster.mhp = 0;
    monster.dead = true;
    markQuestLeaderDead(monster, state);
    if (state === game) unmap_invisible(x, y, false);
    state.level.monsters = state.level.monsters.filter(candidate =>
        candidate !== monster);
    recordVanquished(monster, monsterName, { state });
}

export function finishMonsterLiquidDeath(
    monster, {
        state = game,
        random = rn2,
        leaveCorpse = false,
    } = {},
) {
    const x = monster.mx;
    const y = monster.my;
    const leavesRemains = leaveCorpse
        && levelAllowsMonsterDeathDrops(monster, state, random)
        && monsterLeavesCorpse(monster, random);
    detachDeadMonster(monster, state);
    const corpse = leavesRemains
        ? createMonsterRemains(monster, state)
        : null;
    if (state === game) {
        unmap_invisible(x, y, false);
        newsym(x, y);
    }
    return {
        oldx: x, oldy: y, x, y,
        moved: false, dead: true,
        actionCompleted: true,
        corpse,
    };
}

export async function finishEnvironmentalMonsterDeath(
    monster, state, {
        deathMessage = null,
        visible = true,
        spotted = visible,
        noCorpse = false,
        zombifyCorpse = false,
        random = rn2,
        publish = plineWithContinuation,
    } = {},
) {
    const recovery = await preventMonsterDeath(monster, {
        creditedKill: deathMessage,
        visible,
        spotted,
        petSpotted: spotted,
        state,
        publish,
        random,
    });
    if (recovery.survived)
        return { monster, survived: true, corpse: null };

    const x = monster.mx;
    const y = monster.my;
    const dropsAllowed = !noCorpse
        && levelAllowsMonsterDeathDrops(monster, state, random);
    const crumbleMessage = dropsAllowed
        ? monsterBodyCrumblesMessage(monster) : null;
    const leavesRemains = dropsAllowed
        && monsterLeavesCorpse(monster, random);
    detachDeadMonster(monster, state);
    if (crumbleMessage && visible) await publish(crumbleMessage);
    const corpse = leavesRemains
        ? createMonsterRemains(
            monster, state, { zombify: zombifyCorpse },
        ) : null;
    if (state === game) newsym(x, y);
    return { monster, survived: false, corpse };
}

export function finishMonsterRayDeath(
    monster, death, state = game, publish = plineWithContinuation,
    random = rn2,
) {
    return finishEnvironmentalMonsterDeath(monster, state, {
        deathMessage: death.deathMessage,
        random,
        publish,
        noCorpse: death.noCorpse,
        visible: death.visible ?? cansee(monster.mx, monster.my),
        spotted: death.spotted
            ?? canProjectMonster(monster, monster.mx, monster.my),
    });
}
