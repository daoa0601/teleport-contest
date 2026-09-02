// Statue traps and the monster released from their statue.
// C refs: trap.c animate_statue() and activate_statue_trap().

import { adjustHeroAlignment } from './alignment.js';
import {
    CORPSTAT_HISTORIC, MM_ADJACENTOK, MM_NOCOUNTBIRTH, MM_NOMSG,
    MM_NOTAIL, MM_NOWAIT, NO_MINVENT, STATUE_TRAP,
} from './const.js';
import {
    canSpotMonster, newsym, pline, randomDisplayMonsterName,
} from './display.js';
import { makePetWary } from './dog.js';
import { game } from './gstate.js';
import {
    makemonAt, makemonNear, remove_object,
} from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import {
    MONSTER_GENO, MONSTER_SOUND,
    monsterIsNonliving, monsterIsVampireShifter, monsterTypeName,
} from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { shapechangeMonster } from './monster_polymorph.js';
import { restoreMonsterTraits } from './monster_traits.js';
import { initializeMonsterArmor } from './monworn.js';
import { STATUE } from './object_data.js';
import { stopAllObjectTimers } from './object_timers.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { markQuestLeaderAlive } from './quest.js';
import {
    bodyGenderFlags, PM_DOPPELGANGER, revivalReplacement,
    restoreRevivedShapechanger,
} from './revival_species.js';
import { cansee } from './vision.js';

const G_UNIQ = 0x1000;
const MS_GUARDIAN = 38;

function monsterAt(x, y, state) {
    return (state.level?.monsters || []).find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    );
}

function statueReplacement(statue, state) {
    const replacement = revivalReplacement(statue.corpsenm, statue);
    if (replacement != null) return replacement;
    if ((MONSTER_SOUND[statue.corpsenm] ?? 0) === MS_GUARDIAN
        && state.urole?.guardnum !== statue.corpsenm) {
        return PM_DOPPELGANGER;
    }
    return null;
}

async function createStatueMonster(statue, x, y, state) {
    const savedTraits = statue.oextra?.omonst;
    const replacement = statueReplacement(statue, state);
    const useSavedTraits = replacement == null && !!savedTraits;
    const mnum = replacement ?? savedTraits?.mnum ?? statue.corpsenm;
    let flags = NO_MINVENT | MM_NOMSG;
    if (useSavedTraits) {
        flags |= MM_NOWAIT | MM_NOCOUNTBIRTH | MM_NOTAIL;
    } else {
        flags |= bodyGenderFlags(statue);
    }
    const mayMoveAside = replacement === PM_DOPPELGANGER;
    if (mayMoveAside) flags |= MM_NOCOUNTBIRTH | MM_ADJACENTOK;

    const heroAtStatue = state.u?.ux === x && state.u?.uy === y;
    const occupied = !!monsterAt(x, y, state);
    const monster = heroAtStatue || (occupied && mayMoveAside)
        ? await makemonNear(mnum, x, y, flags, heroAtStatue)
        : await makemonAt(mnum, x, y, flags);
    if (!monster) return null;

    if (useSavedTraits) {
        restoreMonsterTraits(monster, savedTraits);
        restoreRevivedShapechanger(monster, state);
        markQuestLeaderAlive(monster, state);
        if (monster.mtame && !monster.isminion)
            makePetWary(monster, { wasDead: true, state });
    } else if (replacement === PM_DOPPELGANGER
        && monster.cham === PM_DOPPELGANGER) {
        shapechangeMonster(monster, statue.corpsenm);
    }
    return monster;
}

function statueDescription(statue, article) {
    const female = ((statue.spe ?? 0) & 0x03) === 1;
    const species = monsterTypeName(statue.corpsenm, female);
    const name = statue.oextra?.oname || statue.oname;
    return `${article} statue of ${species}${name ? ` named ${name}` : ''}`;
}

function animationVerb(monster) {
    if (!canSpotMonster(monster)) return 'disappears';
    if (monsterIsNonliving(monster.mnum)
        || monsterIsVampireShifter(monster)) return 'moves';
    return 'comes to life';
}

async function describeAnimation(statue, monster, x, y, state, shatter) {
    const verb = animationVerb(monster);
    const heroAtStatue = state.u?.ux === x && state.u?.uy === y;
    if (heroAtStatue) {
        await pline(`${statueDescription(statue, 'The')} ${verb}!`);
        return;
    }
    if (state.u?.hallucinating || (state.u?.hallucinationTurns ?? 0) > 0) {
        await pline(
            `The ${randomDisplayMonsterName()} suddenly seems more animated.`,
        );
        return;
    }
    if (shatter) {
        const description = cansee(x, y)
            ? statueDescription(statue, 'the') : 'a statue';
        await pline(
            `Instead of shattering, ${description} suddenly ${verb}!`,
        );
        return;
    }
    const description = canSpotMonster(monster)
        ? `a ${monsterTypeName(monster.mnum, !!monster.female)}`
        : 'something';
    await pline(`You find ${description} posing as a statue.`);
}

function nameReleasedMonster(monster, statue) {
    const name = statue.oextra?.oname || statue.oname;
    if (!name || ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)) return;
    monster.name = name;
    monster.mgivenname = name;
    monster.mextra = { ...(monster.mextra || {}), mgivenname: name };
}

function transferStatueContents(statue, monster, state) {
    while (statue.contents?.length) {
        const object = statue.contents.shift();
        object.where = 'free';
        object.container = null;
        object.ocontainer = null;
        addObjectToMonsterInventory(monster, object, state);
    }
    initializeMonsterArmor(monster);
}

function deleteStatue(statue) {
    remove_object(statue);
    stopAllObjectTimers(statue);
    statue.where = 'gone';
    statue.ox = 0;
    statue.oy = 0;
}

function revealHeroWithoutCover(x, y, state) {
    if (state.u?.ux !== x || state.u?.uy !== y) return;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (state.u.uundetected && heroFormHidesUnderObjects(state)
        && pile.length === 0)
        state.u.uundetected = 0;
}

async function animateTrapStatue(statue, x, y, state, shatter) {
    const monster = await createStatueMonster(statue, x, y, state);
    if (!monster) {
        const unique = !!((MONSTER_GENO[statue.corpsenm] ?? 0) & G_UNIQ);
        return { monster: null, unique };
    }

    nameReleasedMonster(monster, statue);
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    monster.mundetected = 0;
    monster.msleeping = 0;
    monster.mtame = 0;
    monster.pet = false;
    monster.mpeaceful = 0;
    setMonsterMalign(monster, state);

    await describeAnimation(statue, monster, x, y, state, shatter);
    if (!state.context?.mon_moving
        && state.urole?.key === 'archeologist'
        && ((statue.spe ?? 0) & CORPSTAT_HISTORIC)) {
        await pline('You feel guilty that the historic statue is now gone.');
        adjustHeroAlignment(-1, state);
    }
    transferStatueContents(statue, monster, state);
    deleteStatue(statue);
    revealHeroWithoutCover(x, y, state);
    return { monster, unique: false };
}

export async function activateStatueTrapAt(
    x, y, { state = game, shatter = false } = {},
) {
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y
        && candidate.ttyp === STATUE_TRAP,
    );
    if (!trap) return null;

    const trapIndex = state.level.traps.indexOf(trap);
    if (trapIndex >= 0) state.level.traps.splice(trapIndex, 1);
    const statues = (state.level?.objects?.[x]?.[y] || [])
        .filter(object => object.otyp === STATUE);
    let monster = null;
    for (const statue of statues) {
        const result = await animateTrapStatue(statue, x, y, state, shatter);
        monster = result.monster;
        if (monster || !result.unique) break;
    }
    newsym(x, y);
    return monster;
}
