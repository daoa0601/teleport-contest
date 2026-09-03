// Monster deaths not credited to the hero.
// C refs: mon.c mondead(), mondied(), corpse_chance(), and make_corpse().

import { G_NOCORPSE } from './const.js';
import {
    canProjectMonster, newsym, plineWithContinuation, unmap_invisible,
} from './display.js';
import { recordVanquished } from './end.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { mkcorpstat, mksobj, undeadToCorpse } from './mklev.js';
import { preventMonsterDeath } from './mondeath.js';
import {
    MONSTER_GENO, MONSTER_NAME, MONSTER_SIZE,
} from './monster_data.js';
import { corpseKeepsMonsterTraits } from './monster_traits.js';
import { CORPSE, IRON_CHAIN } from './object_data.js';
import { markQuestLeaderDead } from './quest.js';
import { d, rn2 } from './rng.js';
import { cansee } from './vision.js';

const PM_IRON_GOLEM = 259;

function createOrdinaryMonsterCorpse(
    monster, state, random, { zombify = false } = {},
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
        return lastChain;
    }

    const frequency = (MONSTER_GENO[monster.mnum] ?? 0) & 0x7;
    const corpseDenominator = 2 + Number(frequency < 2)
        + Number((MONSTER_SIZE[monster.mnum] ?? 0) === 0);
    if (random(corpseDenominator) !== 0) return null;

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
    const sourceMove = Math.max(1, (state?.moves ?? 1)
        - Number(state?.urole?.key === 'wizard'));
    if (corpseForm !== monster.mnum) corpse.age = sourceMove - 51;
    if (corpseForm === 59) corpse.owt = 400;
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
    detachDeadMonster(monster, state);
    const corpse = leaveCorpse
        ? createOrdinaryMonsterCorpse(monster, state, random)
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
    detachDeadMonster(monster, state);
    const corpse = noCorpse ? null : createOrdinaryMonsterCorpse(
        monster, state, random, { zombify: zombifyCorpse },
    );
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
