// Ordinary monster death and corpse rules.
// C refs: mon.c mondead(), mondied(), corpse_chance(), and make_corpse().

import { G_NOCORPSE, Is_rogue_level } from './const.js';
import {
    canProjectMonster, newsym, plineWithContinuation, unmap_invisible,
} from './display.js';
import { recordVanquished } from './end.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { mkcorpstat, mksobj, undeadToCorpse } from './mklev.js';
import { preventMonsterDeath } from './mondeath.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL,
} from './monster_data.js';
import { corpseKeepsMonsterTraits } from './monster_traits.js';
import { CORPSE, IRON_CHAIN } from './object_data.js';
import { markQuestLeaderDead } from './quest.js';
import { d, rn2 } from './rng.js';
import { cansee } from './vision.js';

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

export function createMonsterRemains(
    monster, state = game, { zombify = false } = {},
) {
    const x = monster.mx;
    const y = monster.my;
    if (monster.mnum === PM_IRON_GOLEM) {
        const chainCount = d(2, 6);
        let lastChain = null;
        for (let index = 0; index < chainCount; index++) {
            lastChain = mksobj(IRON_CHAIN, true, false);
            place_object(lastChain, x, y, state);
        }
        delete monster.name;
        return lastChain;
    }

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
        CORPSE, savedMonster, corpseForm, x, y, 8, { zombify },
    );
    corpse.name = `${MONSTER_NAME[corpseForm] || 'monster'} corpse`;
    if (monster.name) corpse.oname = monster.name;
    if (corpseForm !== monster.mnum)
        corpse.age = (corpse.age ?? state.moves ?? 1) - 51;
    return corpse;
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
