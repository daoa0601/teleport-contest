import { hasShopkeeperData } from './shop_types.js';
// Ordinary monster death and corpse rules.
// C refs: mon.c monkilled(), mondead(), mondied(), corpse_chance(), and make_corpse().

import { prepareVaultGuardDeath } from './vault_guard.js';
import { armorThiefGone } from './command_state.js';
import {
    ACCESSIBLE, CORPSTAT_FEMALE, CORPSTAT_INIT, CORPSTAT_MALE,
    DISMOUNT_GENERIC, G_NOCORPSE, Is_rogue_level, IS_POOL,
} from './const.js';
import { buryObject } from './buried_object.js';
import {
    canSeeMonster, monsterKillLineVisible, newsym, plineWithContinuation, unmap_invisible,
} from './display.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { removeMonsterWormBody } from './monster_worm.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { detachMonsterFromLevel } from './monster_level_departure.js';
import { meldNearbyFloorGlobs } from './glob.js';
import {
    mkcorpstat, mkgold, mksobj, undeadToCorpse,
} from './mklev.js';
import { preventMonsterDeath } from './mondeath.js';
import { releaseMonsterInventory } from './monster_drop.js';
import { finishShopkeeperDeparture } from './shop_damage.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL, monsterIsNonliving, monsterIsPlayerMonster,
} from './monster_data.js';
import { AD_DCAY, AD_DGST, AD_FIRE, AD_RUST } from './monster_attack_types.js';
import type { DamageType } from './monster_attack_types.js';
import { recordMonsterDeath } from './monster_vitals.js';
import { monsterName, possessiveName } from './monster_name.js';
import { createSteamVortexDeathCloud } from './monster_death_cloud.js';
import { returnDeadKop } from './monster_return.js';
import { restoreMonsterTrueSpecies } from './monster_species.js';
import {
    resolveMonsterDeathExplosion, monsterHasDeathExplosion,
    monsterDeathSwallower, rollMonsterDeathExplosion,
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
import { cansee, monsterEmitsLight } from './vision.js';
import { objectWeight } from './weight.js';
import { dismountHero } from './steed.js';
import { wizardDeadOrGone } from './wizard.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';

export interface MonsterDeathOptions {
    deathMessage?: string | null;
    noCorpse?: boolean;
    noRevive?: boolean;
    zombifyCorpse?: boolean;
    random?: (limit: number) => number;
    rollDice?: (count: number, sides: number) => number;
    publish?: MessagePublisher;
}

export interface MonsterDeathResult {
    monster: Monster;
    survived: boolean;
    corpse: GameObject | null;
    heroDied?: boolean;
}

interface MonsterKilledOptions extends Pick<MonsterDeathOptions,
    'zombifyCorpse' | 'noRevive' | 'random' | 'rollDice' | 'publish'> {
    // C uses -AD_RBRE to distinguish disintegration from other breath damage.
    damageType: DamageType | 'disintegration';
    cause?: string | null;
}

// Trap/contact owners need survival, whether the selected death owner also
// awards experience or records a corpse is a decision of that caller.
export type MonsterDeathHandler = (
    monster: Monster, options?: MonsterDeathOptions,
) => Promise<{ survived: boolean; heroDied?: boolean }>;

export interface MonsterLiquidDeathResult {
    oldx: number;
    oldy: number;
    x: number;
    y: number;
    moved: false;
    dead: true;
    actionCompleted: true;
    corpse: GameObject | null;
    heroDied?: boolean;
}

interface MonsterRemainsOptions {
    buried?: boolean;
    zombify?: boolean;
    noRevive?: boolean;
    seen?: boolean;
    publish?: MessagePublisher;
}

const PM_PAPER_GOLEM = 250;
const PM_STRAW_GOLEM = MONSTER_NAME.indexOf('straw golem');
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
    monster: Monster, state: GameState = game, random = rn2,
): boolean {
    if (Is_rogue_level(state.u?.uz)
        || state.level?.flags?.deathdrops === false) return false;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_UNDEAD);
    return !(state.level?.flags?.graveyard && undead && random(3));
}

export function monsterDeathSquareAllowsObjects(x: number, y: number, state: GameState = game): boolean {
    const terrain = state.level?.at?.(x, y)?.typ;
    return terrain !== undefined && (ACCESSIBLE(terrain) || IS_POOL(terrain));
}

export function monsterPossessiveName(monster: Monster, displayName: string | null = null): string {
    const name = monster.name || displayName
        || MONSTER_NAME[monster.mnum] || 'monster';
    const usesArticle = !monster.name && !/^[A-Z]/.test(name);
    const subject = usesArticle ? `The ${name}` : name;
    return /s$/i.test(subject) ? `${subject}'` : `${subject}'s`;
}

export function monsterBodyCrumbles(monster: Monster): boolean {
    return monster.mnum === PM_VLAD_THE_IMPALER
        || MONSTER_SYMBOL[monster.mnum] === S_LICH;
}

export function monsterBodyCrumblesMessage(monster: Monster, state: GameState = game): string {
    const name = monsterName(monster, { state, capitalized: true });
    return `${possessiveName(name)} body crumbles into dust.`;
}

export function monsterLeavesCorpse(monster: Monster, random = rn2): boolean {
    if (monsterBodyCrumbles(monster)
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

function ordinaryMonsterDeathResult(
    monster: Monster, state: GameState, random: (limit: number) => number,
    rollDice: (count: number, sides: number) => number,
) {
    if (monsterBodyCrumbles(monster)) {
        return { crumbles: true, explosion: null, leavesRemains: false };
    }

    const explosion = rollMonsterDeathExplosion(
        monster, { state, rollDice },
    );
    if (explosion !== null) {
        return { crumbles: false, explosion, leavesRemains: false };
    }

    const leavesRemains = levelAllowsMonsterDeathDrops(
        monster, state, random,
    ) && monsterLeavesCorpse(monster, random);
    return { crumbles: false, explosion: null, leavesRemains };
}

// C corpse_chance(): effects and eligibility are separate from placing a body.
// Digestion uses this after xkilled, including an explosion inside the eater.
export async function resolveMonsterCorpseChance(monster: Monster, {
    state = game, random = rn2, rollDice = d, publish = plineWithContinuation,
}: { state?: GameState; random?: typeof rn2; rollDice?: typeof d;
    publish?: MessagePublisher } = {}): Promise<{ leavesRemains: boolean; heroDied: boolean }> {
    const death = ordinaryMonsterDeathResult(monster, state, random, rollDice);
    if (death.crumbles && cansee(monster.mx, monster.my) && !monsterDeathSwallower(state))
        await publish(monsterBodyCrumblesMessage(monster, state));
    if (death.explosion) {
        if (state === game) newsym(monster.mx, monster.my);
        const explosion = await resolveMonsterDeathExplosion(monster, monster.mx, monster.my,
            death.explosion, { state, publish, random, rollDice });
        if (explosion.heroDied) return { leavesRemains: false, heroDied: true };
    }
    return { leavesRemains: death.leavesRemains, heroDied: false };
}

function corpseFlags(monster: Monster, initialize = true): number {
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

async function createGolemRemains(monster: Monster, state: GameState): Promise<GameObject | null> {
    const x = monster.mx;
    const y = monster.my;
    let remains: GameObject | null = null;
    const placeNewObject = async (type: number, initialize = true): Promise<GameObject> => {
        remains = await mksobj(type, initialize, false);
        placeCreatedObject(remains, x, y, state);
        return remains;
    };

    switch (monster.mnum) {
    case PM_IRON_GOLEM:
        for (let count = d(2, 6); count > 0; count--)
            await placeNewObject(IRON_CHAIN);
        break;
    case PM_GLASS_GOLEM:
        for (let count = d(2, 4); count > 0; count--) {
            const glassType = WORTHLESS_PIECE_OF_WHITE_GLASS
                + rn2(WORTHLESS_PIECE_OF_VIOLET_GLASS
                    - WORTHLESS_PIECE_OF_WHITE_GLASS + 1);
            await placeNewObject(glassType);
        }
        break;
    case PM_CLAY_GOLEM: {
        const rocks = await placeNewObject(ROCK, false);
        rocks.quan = rocks.quantity = rn2(20) + 50;
        rocks.owt = objectWeight(rocks);
        break;
    }
    case PM_STONE_GOLEM:
        remains = await mkcorpstat(
            STATUE, null, monster.mnum, x, y, corpseFlags(monster, false), { state },
        );
        break;
    case PM_WOOD_GOLEM:
        for (let count = d(2, 4); count > 0; count--)
            await placeNewObject(woodGolemMaterial());
        break;
    case PM_ROPE_GOLEM:
        for (let count = rn2(3); count > 0; count--)
            await placeNewObject(ropeGolemMaterial());
        break;
    case PM_LEATHER_GOLEM:
        for (let count = d(2, 4); count > 0; count--)
            await placeNewObject(leatherGolemMaterial());
        break;
    case PM_GOLD_GOLEM:
        remains = await mkgold(200 - rnl(101), x, y, state);
        break;
    case PM_PAPER_GOLEM:
        for (let count = rnd(4); count > 0; count--)
            await placeNewObject(SCR_BLANK_PAPER);
        break;
    default:
        break;
    }

    if (monster.mnum !== PM_STONE_GOLEM) delete monster.name;
    return remains;
}

async function placeMonsterPart(type: number, monster: Monster, state: GameState, initialize = true): Promise<GameObject> {
    const part = await mksobj(type, initialize, false);
    placeCreatedObject(part, monster.mx, monster.my, state);
    return part;
}

async function createMonsterPart(monster: Monster, state: GameState, seen: boolean, publish: MessagePublisher): Promise<GameObject | null> {
    const mnum = monster.mnum;
    if (mnum >= PM_GRAY_DRAGON && mnum <= PM_YELLOW_DRAGON) {
        const chance = monster.mrevived ? 20 : 3;
        if (rn2(chance) !== 0) return null;
        const scales = await placeMonsterPart(
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
        const horn = await placeMonsterPart(UNICORN_HORN, monster, state);
        if (monster.mrevived) horn.degraded_horn = 1;
        return horn;
    }
    if (mnum === PM_LONG_WORM)
        return await placeMonsterPart(WORM_TOOTH, monster, state);
    return null;
}

async function createPuddingGlob(monster: Monster, state: GameState, publish: MessagePublisher): Promise<GameObject | null> {
    if (monster.mnum < PM_GRAY_OOZE
        || monster.mnum > PM_BLACK_PUDDING) return null;
    const glob = await placeMonsterPart(
        GLOB_OF_GRAY_OOZE + monster.mnum - PM_GRAY_OOZE,
        monster, state,
    );
    delete monster.name;
    return meldNearbyFloorGlobs(glob, { state, publish });
}

export async function createMonsterRemains(
    monster: Monster, state: GameState = game, {
        buried = false,
        zombify = false,
        noRevive = false,
        seen = false,
        publish = plineWithContinuation,
    }: MonsterRemainsOptions = {},
): Promise<GameObject | null> {
    const x = monster.mx;
    const y = monster.my;
    if (SPECIAL_GOLEM_REMAINS.has(monster.mnum)) {
        const remains = await createGolemRemains(monster, state);
        return remains ? await finishMonsterRemains(remains, monster, state) : null;
    }
    if (monster.mnum >= PM_GRAY_OOZE && monster.mnum <= PM_BLACK_PUDDING)
        return createPuddingGlob(monster, state, publish);

    await createMonsterPart(monster, state, seen, publish);

    const corpseForm = undeadToCorpse(monster.mnum);
    const vitalFlags = state.mvitals?.[monster.mnum]?.mvflags
        ?? MONSTER_GENO[monster.mnum] ?? 0;
    if (corpseForm === monster.mnum
        && (vitalFlags & G_NOCORPSE)) {
        return null;
    }
    const leaderId = state.quest_status?.leader_m_id;
    const savedMonster = corpseForm !== monster.mnum
        || corpseKeepsMonsterTraits(monster, leaderId)
        ? monster : null;
    const corpse = await mkcorpstat(
        CORPSE, savedMonster, corpseForm, x, y, corpseFlags(monster), {
            state, zombify, noRevive,
        },
    );
    corpse.name = `${MONSTER_NAME[corpseForm] || 'monster'} corpse`;
    if (corpseForm !== monster.mnum)
        corpse.age = (corpse.age ?? state.moves ?? 1) - 51;
    if (buried) {
        const result = await buryObject(corpse, state);
        if (result.outcome === 'absorbed') return null;
        if (result.outcome === 'buried') return corpse;
    }
    return await finishMonsterRemains(corpse, monster, state);
}

// Special golem objects share make_corpse's tail with ordinary corpses.
// In particular, the beam which killed a monster must skip its new remains.
async function finishMonsterRemains(
    remains: GameObject, monster: Monster, state: GameState,
): Promise<GameObject> {
    if (state.context.bypasses) remains.bypass = true;
    if (monster.name) remains.oname = monster.name;
    const stacked = await stack_object(remains, state);
    newsym(monster.mx, monster.my);
    if (stacked.ox !== monster.mx || stacked.oy !== monster.my)
        newsym(stacked.ox, stacked.oy);
    return stacked;
}

// Native mondead() after recovery has failed. Kill credit and remains belong
// to the caller; map, inventory, and population cleanup share this owner.
export async function detachDeadMonster(
    monster: Monster, state: GameState, random: (limit: number) => number,
    publish: MessagePublisher,
): Promise<boolean> {
    const x = monster.mx;
    const y = monster.my;
    monster.mhp = 0;
    await createSteamVortexDeathCloud(monster, state, random, publish);
    if (monster.isgd && !await prepareVaultGuardDeath(monster, state)) return false;
    const emittedLight = monsterEmitsLight(monster.mnum);
    restoreMonsterTrueSpecies(monster);
    recordMonsterDeath(monster, state);
    markQuestLeaderDead(monster, state);
    await returnDeadKop(monster, state, random);
    if (state === game) unmap_invisible(x, y, false);
    if (monster.mleashed) releaseMonsterLeash(monster, state);
    // m_detach removes the light of the form which died, before its true
    // species and empty map square are projected by mon_leaving_level.
    if (x > 0 && emittedLight) state.vision_full_recalc = 1;
    await detachMonsterFromLevel(monster, state);
    if (state.program_state.gameover) return true;
    if (monster.iswiz) wizardDeadOrGone(state, random);
    markQuestNemesisDead(monster, state);
    await releaseMonsterInventory(monster, state, { publish, random });
    if (state.program_state.gameover) return true;
    armorThiefGone(monster, state);
    if (monster.isshk) {
        if (!hasShopkeeperData(monster)) throw new Error('shopkeeper lacks shop history');
        finishShopkeeperDeparture(monster, state);
    }
    if (monster.wormno) removeMonsterWormBody(monster);
    monster.dead = true;
    if (state.u.usteed === monster) {
        const result = await dismountHero(DISMOUNT_GENERIC, {
            state, random, announce: publish,
        });
        return !!result.died;
    }
    return false;
}

export async function finishMonsterLiquidDeath(
    monster: Monster, {
        state = game,
        random = rn2,
        rollDice = d,
        leaveCorpse = false,
        publish = plineWithContinuation,
    }: { state?: GameState; random?: (limit: number) => number;
        rollDice?: (count: number, sides: number) => number;
        leaveCorpse?: boolean; publish?: MessagePublisher } = {},
): Promise<MonsterLiquidDeathResult> {
    const x = monster.mx;
    const y = monster.my;
    if (await detachDeadMonster(monster, state, random, publish)) {
        return {
            oldx: x, oldy: y, x, y,
            moved: false, dead: true, actionCompleted: true,
            corpse: null, heroDied: true,
        };
    }
    const death = leaveCorpse
        ? await resolveMonsterCorpseChance(monster, { state, random, rollDice, publish })
        : { leavesRemains: false, heroDied: false };
    if (death.heroDied) return {
        oldx: x, oldy: y, x, y,
        moved: false, dead: true, actionCompleted: true,
        corpse: null, heroDied: true,
    };
    const corpse = death.leavesRemains
        && monsterDeathSquareAllowsObjects(monster.mx, monster.my, state)
        ? await createMonsterRemains(monster, state, {
            seen: state === game && canSeeMonster(monster),
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

// C monkilled(): the death line precedes recovery, but pet grief follows it.
// A null cause suppresses the line even when the monster's square is visible.
export async function finishMonsterKilled(
    monster: Monster, state: GameState, {
        damageType, cause = '', publish = plineWithContinuation, ...options
    }: MonsterKilledOptions,
): Promise<MonsterDeathResult> {
    const species = monster.mnum;
    const visible = cause !== null && monsterKillLineVisible(monster);
    const deathMessage = visible
        ? `${monsterName(monster, { state, capitalized: true })} is ${
            monsterIsNonliving(species) ? 'destroyed' : 'killed'}${
            cause ? ` by the ${cause}` : ''}!`
        : null;
    const burns = damageType === AD_FIRE
        && (species === PM_PAPER_GOLEM || species === PM_STRAW_GOLEM);
    const disintegrated = damageType === 'disintegration' || damageType === AD_DGST || burns;
    const death = await resolveMonsterDeath(monster, state, {
        ...options, publish, deathMessage, noCorpse: disintegrated,
    }, { disintegrated, sadFeeling: !visible && !!monster.mtame });
    if (death.survived || death.heroDied) return death;
    if (monster.mtame) {
        const epitaph = burns ? 'roast'
            : damageType === AD_RUST && species === PM_IRON_GOLEM ? 'rust'
            : damageType === AD_DCAY && (species === PM_WOOD_GOLEM || species === PM_LEATHER_GOLEM)
                ? 'rot' : null;
        if (epitaph)
            await publish(`May ${monsterName(monster, { state, suppressIt: true })} ${epitaph} in peace.`);
    }
    return death;
}

export function finishEnvironmentalMonsterDeath(
    monster: Monster, state: GameState, options: MonsterDeathOptions = {},
): Promise<MonsterDeathResult> {
    return resolveMonsterDeath(monster, state, options);
}

async function resolveMonsterDeath(
    monster: Monster, state: GameState, {
        deathMessage = null,
        noCorpse = false,
        noRevive = false,
        zombifyCorpse = false,
        random = rn2,
        rollDice = d,
        publish = plineWithContinuation,
    }: MonsterDeathOptions,
    { disintegrated = false, sadFeeling = false }: {
        disintegrated?: boolean; sadFeeling?: boolean;
    } = {},
): Promise<MonsterDeathResult> {
    requireLiveGame(state);
    const recovery = await preventMonsterDeath(monster, {
        creditedKill: deathMessage,
        disintegrated,
        state,
        publish,
        random,
    });
    if (recovery.survived || recovery.heroDied)
        return { monster, survived: recovery.survived, corpse: recovery.completedDeath?.corpse ?? null,
            ...(recovery.heroDied ? { heroDied: true } : {}) };

    const x = monster.mx;
    const y = monster.my;
    if (!recovery.completedDeath) {
        if (sadFeeling)
            await publish('You have a sad feeling for a moment, then it passes.');
        if (await detachDeadMonster(monster, state, random, publish))
            return { monster, survived: false, corpse: null, heroDied: true };
    }
    // C vamprises returns true even when its door already ran mondied.
    // An outer mondied still tries to leave remains; mondead does not.
    const death = noCorpse
        ? { leavesRemains: false, heroDied: false }
        : await resolveMonsterCorpseChance(monster, { state, random, rollDice, publish });
    if (death.heroDied)
        return { monster, survived: false, corpse: null, heroDied: true };
    const corpse = death.leavesRemains
        && monsterDeathSquareAllowsObjects(monster.mx, monster.my, state)
        ? await createMonsterRemains(
            monster, state, {
                zombify: zombifyCorpse,
                noRevive,
                seen: canSeeMonster(monster),
                publish,
            },
        ) : recovery.completedDeath?.corpse ?? null;
    if (state === game) newsym(x, y);
    return { monster, survived: false, corpse };
}

