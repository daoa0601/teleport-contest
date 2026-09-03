// Ordinary monster death and corpse rules.
// C refs: mon.c mondead(), mondied(), corpse_chance(), and make_corpse().

import {
    ACCESSIBLE, CORPSTAT_FEMALE, CORPSTAT_INIT, CORPSTAT_MALE,
    G_NOCORPSE, Is_rogue_level,
    IS_POOL,
} from './const.js';
import { buryFloorObject } from './buried_object.js';
import {
    canProjectMonster, newsym, plineWithContinuation, unmap_invisible,
} from './display.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { meldNearbyFloorGlobs } from './glob.js';
import {
    mkcorpstat, mkgold, mksobj, undeadToCorpse,
} from './mklev.js';
import { preventMonsterDeath } from './mondeath.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL, monsterIsPlayerMonster,
} from './monster_data.js';
import { recordMonsterDeath } from './monster_vitals.js';
import { createSteamVortexDeathCloud } from './monster_death_cloud.js';
import { returnDeadKop } from './monster_return.js';
import { restoreMonsterTrueSpecies } from './monster_species.js';
import {
    createPhysicalMonsterExplosion, monsterHasDeathExplosion,
    rollMonsterDeathExplosionDamage,
} from './monster_explosion.js';
import { corpseKeepsMonsterTraits } from './monster_traits.js';
import {
    BOOMERANG, BULLWHIP, CLUB, CORPSE, ELVEN_SPEAR,
    GLOB_OF_GRAY_OOZE, GRAPPLING_HOOK, GRAY_DRAGON_SCALES, IRON_CHAIN,
    LEASH, LEATHER_ARMOR, LEATHER_CLOAK, QUARTERSTAFF, ROCK, SADDLE,
    SCR_BLANK_PAPER, SMALL_SHIELD, STATUE, UNICORN_HORN, WORM_TOOTH,
    WORTHLESS_PIECE_OF_VIOLET_GLASS,
    WORTHLESS_PIECE_OF_WHITE_GLASS,
} from './object_data.js';
import { markQuestLeaderDead, markQuestNemesisDead } from './quest.js';
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
const PM_WHITE_UNICORN = 101;
const PM_BLACK_UNICORN = 103;
const PM_LONG_WORM = 114;
const PM_GRAY_DRAGON = 143;
const PM_YELLOW_DRAGON = 152;
const PM_GRAY_OOZE = 206;
const PM_BLACK_PUDDING = 209;
const PM_VLAD_THE_IMPALER = 228;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_LIZARD = 326;
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

export function monsterDeathSquareAllowsObjects(x, y, state = game) {
    const terrain = state.level?.at?.(x, y)?.typ;
    return ACCESSIBLE(terrain) || IS_POOL(terrain);
}

export function monsterPossessiveName(monster, displayName = null) {
    const name = monster.name || displayName
        || MONSTER_NAME[monster.mnum] || 'monster';
    const usesArticle = !monster.name && !/^[A-Z]/.test(name);
    const subject = usesArticle ? `The ${name}` : name;
    return /s$/i.test(subject) ? `${subject}'` : `${subject}'s`;
}

export function monsterBodyCrumblesMessage(monster) {
    const mnum = monster.mnum;
    if (mnum !== PM_VLAD_THE_IMPALER
        && MONSTER_SYMBOL[mnum] !== S_LICH) return null;
    return `${monsterPossessiveName(monster)} body crumbles into dust.`;
}

export function monsterLeavesCorpse(monster, random = rn2) {
    if (monsterBodyCrumblesMessage(monster)
        || monsterHasDeathExplosion(monster)) return false;
    const mnum = monster.mnum;
    const guaranteed = (((MONSTER_SIZE[mnum] ?? 2) >= 3
            || mnum === PM_LIZARD) && !monster.mcloned)
        || MONSTER_SYMBOL[mnum] === S_GOLEM
        || monsterIsPlayerMonster(mnum)
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE)
        || !!monster.isshk;
    if (guaranteed) return true;
    const frequency = (MONSTER_GENO[mnum] ?? 0) & 0x7;
    const corpseDenominator = 2 + Number(frequency < 2)
        + Number((MONSTER_SIZE[mnum] ?? 0) === 0);
    return random(corpseDenominator) === 0;
}

function ordinaryMonsterDeathResult(monster, state, random, rollDice) {
    const crumbleMessage = monsterBodyCrumblesMessage(monster);
    if (crumbleMessage) {
        return { crumbleMessage, explosionDamage: null, leavesRemains: false };
    }

    const explosionDamage = rollMonsterDeathExplosionDamage(
        monster, rollDice,
    );
    if (explosionDamage !== null) {
        return { crumbleMessage: null, explosionDamage, leavesRemains: false };
    }

    const corpseRolled = levelAllowsMonsterDeathDrops(
        monster, state, random,
    ) && monsterLeavesCorpse(monster, random);
    const leavesRemains = corpseRolled && monsterDeathSquareAllowsObjects(
        monster.mx, monster.my, state,
    );
    return { crumbleMessage: null, explosionDamage: null, leavesRemains };
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

function placeMonsterPart(type, monster, state, initialize = true) {
    const part = mksobj(type, initialize, false);
    place_object(part, monster.mx, monster.my, state);
    return part;
}

async function createMonsterPart(monster, state, seen, publish) {
    const mnum = monster.mnum;
    if (mnum >= PM_GRAY_DRAGON && mnum <= PM_YELLOW_DRAGON) {
        const chance = monster.mrevived ? 20 : 3;
        if (rn2(chance) !== 0) return null;
        const scales = placeMonsterPart(
            GRAY_DRAGON_SCALES + mnum - PM_GRAY_DRAGON,
            monster, state, false,
        );
        scales.spe = 0;
        scales.cursed = false;
        scales.blessed = false;
        return scales;
    }
    if (mnum >= PM_WHITE_UNICORN && mnum <= PM_BLACK_UNICORN) {
        if (monster.mrevived && rn2(2)) {
            if (seen) {
                await publish(
                    `${monsterPossessiveName(monster)} recently regrown horn `
                        + 'crumbles to dust.',
                );
            }
            return null;
        }
        const horn = placeMonsterPart(UNICORN_HORN, monster, state);
        if (monster.mrevived) horn.degraded_horn = 1;
        return horn;
    }
    if (mnum === PM_LONG_WORM)
        return placeMonsterPart(WORM_TOOTH, monster, state);
    return null;
}

async function createPuddingGlob(monster, state, publish) {
    if (monster.mnum < PM_GRAY_OOZE
        || monster.mnum > PM_BLACK_PUDDING) return null;
    const glob = placeMonsterPart(
        GLOB_OF_GRAY_OOZE + monster.mnum - PM_GRAY_OOZE,
        monster, state,
    );
    delete monster.name;
    return meldNearbyFloorGlobs(glob, { state, publish });
}

export async function createMonsterRemains(
    monster, state = game, {
        buried = false,
        zombify = false,
        seen = false,
        publish = plineWithContinuation,
    } = {},
) {
    const x = monster.mx;
    const y = monster.my;
    if (SPECIAL_GOLEM_REMAINS.has(monster.mnum))
        return createGolemRemains(monster, state);
    if (monster.mnum >= PM_GRAY_OOZE && monster.mnum <= PM_BLACK_PUDDING)
        return createPuddingGlob(monster, state, publish);

    await createMonsterPart(monster, state, seen, publish);

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
    if (buried) {
        const result = buryFloorObject(corpse, state);
        if (result === null) return null;
        if (result === true) return corpse;
    }
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

async function detachDeadMonster(monster, state, random) {
    const x = monster.mx;
    const y = monster.my;
    createSteamVortexDeathCloud(monster, state, random);
    restoreMonsterTrueSpecies(monster);
    monster.mhp = 0;
    recordMonsterDeath(monster, state);
    markQuestLeaderDead(monster, state);
    markQuestNemesisDead(monster, state);
    await returnDeadKop(monster, state, random);
    releaseDeadMonsterInventory(monster, state);
    monster.dead = true;
    if (state === game) unmap_invisible(x, y, false);
    state.level.monsters = state.level.monsters.filter(candidate =>
        candidate !== monster);
}

export async function finishMonsterLiquidDeath(
    monster, {
        state = game,
        random = rn2,
        rollDice = d,
        leaveCorpse = false,
        publish = plineWithContinuation,
    } = {},
) {
    const x = monster.mx;
    const y = monster.my;
    await detachDeadMonster(monster, state, random);
    const death = leaveCorpse
        ? ordinaryMonsterDeathResult(monster, state, random, rollDice)
        : {
            crumbleMessage: null,
            explosionDamage: null,
            leavesRemains: false,
        };
    const visible = state === game && cansee(x, y);
    if (death.crumbleMessage && visible)
        await publish(death.crumbleMessage);
    if (death.explosionDamage !== null) {
        if (state === game) newsym(x, y);
        await createPhysicalMonsterExplosion(
            monster, x, y, death.explosionDamage, {
                state,
                publish,
                random,
                finishMonsterDeath: (target, options) =>
                    finishEnvironmentalMonsterDeath(target, state, options),
            },
        );
    }
    const corpse = death.leavesRemains
        ? await createMonsterRemains(monster, state, {
            seen: state === game && canProjectMonster(monster, x, y),
            publish,
        })
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
        rollDice = d,
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
    await detachDeadMonster(monster, state, random);
    const death = noCorpse
        ? {
            crumbleMessage: null,
            explosionDamage: null,
            leavesRemains: false,
        }
        : ordinaryMonsterDeathResult(monster, state, random, rollDice);
    if (death.crumbleMessage && visible)
        await publish(death.crumbleMessage);
    if (death.explosionDamage !== null) {
        if (state === game) newsym(x, y);
        await createPhysicalMonsterExplosion(
            monster, x, y, death.explosionDamage, {
                state,
                publish,
                random,
                finishMonsterDeath: (target, options) =>
                    finishEnvironmentalMonsterDeath(target, state, options),
            },
        );
    }
    const corpse = death.leavesRemains
        ? await createMonsterRemains(
            monster, state, {
                zombify: zombifyCorpse,
                seen: spotted,
                publish,
            },
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
