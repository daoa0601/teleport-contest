// mondeath.js — shared monster fatality interception.
// C refs: mon.c mlifesaver(), lifesaved_monster(), mondead().

import { W_AMUL } from './const.js';
import { exerciseAttribute } from './attrib.js';
import {
    flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import {
    MONSTER_ATTACKS, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { AMULET_OF_LIFE_SAVING } from './object_data.js';
import {
    recordObjectEncounter, recordObjectKnowledge,
} from './object_knowledge.js';
import { rn2 } from './rng.js';

async function lifeSavingPage(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}

// which_armor(mon, W_AMUL) is the eligibility boundary: carrying an amulet
// without wearing it must never intercept monster death.
export function wornMonsterLifeSaver(monster) {
    const shapechanging = Number.isInteger(monster?.cham)
        && monster.cham >= 0;
    if (monsterIsNonliving(monster?.mnum) && !shapechanging) return null;
    return (monster?.minvent || monster?.inventory || []).find(object =>
        object.otyp === AMULET_OF_LIFE_SAVING
        && ((object.owornmask ?? 0) & W_AMUL));
}

function lifeSavingSubject(monster, spotted) {
    if (!spotted) return 'It';
    if (monster?.name) return monster.name;
    return `The ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function possessiveSubject(subject) {
    if (subject === 'It') return 'Its';
    return /s$/i.test(subject) ? `${subject}'` : `${subject}'s`;
}

function ordinaryMonsterSubject(monster, spotted) {
    if (monster?.name) return monster.name;
    if (!spotted) return 'it';
    return `the ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function monsterReconstitutesAfterLifeSaving(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(attack => attack[0] === 13 || attack[0] === 14);
}

function monsterPetRecord(monster) {
    return monster?.edog || monster?.mextra?.edog || null;
}

// Keep the shared owner fail-loud for wary_dog() branches whose state or
// presentation is not yet complete.  This same predicate is used by the ice
// transaction before it mutates terrain.
export function petLifeSavingGap(
    monster, { genocided = false, state = game } = {},
) {
    if (!(monster?.mtame > 0)) return null;
    if (genocided) return 'genocide-defeated pet death';
    if (monster.isminion) return 'minion recovery';
    const edog = monsterPetRecord(monster);
    if (!edog || !edog.ogoal) return 'missing edog state';
    if (monster.meating) return 'active eating';
    if ((monster.m_ap_type ?? 0) !== 0) return 'active appearance';
    if (edog.killed_by_u === 1 || (edog.abuse ?? 0) > 2)
        return 'heavy-abuse recovery';
    if (monster.mleashed) return 'leash release';
    if (state.u?.usteed === monster) return 'steed dismount';
    if (state.u?.ustuck === monster) return 'hero attachment';
    return null;
}

async function waryDogAfterLifeSaving(
    monster, {
        wasDead = false, spotted = true,
        line = pline, repaint = newsym, state = game,
    } = {},
) {
    const edog = monsterPetRecord(monster);
    monster.meating = 0;
    const penalty = edog.mhpmax_penalty ?? 0;
    if (penalty) {
        monster.mhpmax = (monster.mhpmax ?? 0) + penalty;
        monster.mhp = (monster.mhp ?? 0) + penalty;
        edog.mhpmax_penalty = 0;
    }

    monster.mtame = rn2((monster.mtame ?? 0) + 1);
    if (!monster.mtame)
        monster.mpeaceful = rn2(2);

    if (!monster.mtame) {
        monster.pet = false;
        if (!wasDead && spotted) {
            const subject = lifeSavingSubject(monster, true);
            const disposition = monster.mpeaceful
                ? 'is no longer tame' : 'has become feral';
            await line(`${subject} ${disposition}.`);
        }
        repaint(monster.mx, monster.my);
        return;
    }

    monster.pet = true;
    edog.revivals = (edog.revivals ?? 0) + 1;
    edog.killed_by_u = 0;
    edog.abuse = 0;
    edog.ogoal.x = edog.ogoal.y = -1;
    const hungerFloor = (state.moves ?? 0) + 500;
    if (wasDead || (edog.hungrytime ?? 0) < hungerFloor)
        edog.hungrytime = hungerFloor;
    if (wasDead) {
        edog.droptime = 0;
        edog.dropdist = 10000;
        edog.whistletime = 0;
        edog.apport = 5;
    }
}

// Run the source pre-detach revival transaction.  The fatal caller owns the
// credited kill phrase and supplies it as the first pager; this owner consumes
// the amulet and restores the actor before mondead() could detach it.
export async function lifeSaveMonster(
    monster, amulet, {
        creditedKill, retainCursor = false,
        visible = true, spotted = true, genocided = false,
        petSpotted = spotted,
        continueLine = plineWithContinuation,
        page = lifeSavingPage, line = pline, repaint = newsym,
    } = {},
) {
    const petGap = petLifeSavingGap(monster, { genocided, state: game });
    if (petGap)
        throw new Error(`unsupported monster life-saving ${petGap}`);
    const subject = lifeSavingSubject(monster, spotted);
    if (creditedKill) await continueLine(creditedKill);
    if (visible) {
        await continueLine('But wait...');
        await page(`${game._pending_message}--More--`);

        const alreadyKnown = game._knownObjectTypes instanceof Set
            && game._knownObjectTypes.has(amulet.otyp);
        if (!alreadyKnown) exerciseAttribute(4, true);
        recordObjectEncounter(amulet.otyp);
        recordObjectKnowledge(amulet.otyp);
        await page(
            `${possessiveSubject(subject)} medallion begins to glow!--More--`,
        );
        if (spotted) {
            const recovery = monsterReconstitutesAfterLifeSaving(monster)
                ? 'reconstitutes' : 'looks much better';
            await page(`${subject} ${recovery}!--More--`);
        }
        await line('The medallion crumbles to dust!');
    }

    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(amulet);
    if (index >= 0) inventory.splice(index, 1);
    amulet.owornmask = 0;
    amulet.worn = false;
    amulet.wornSlot = null;
    amulet.where = 'gone';
    amulet.ox = amulet.oy = 0;
    amulet.ocarry = null;
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) & ~W_AMUL;
    checkMonsterGearNextTurn(monster);
    monster.dead = false;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    if (monster.mtame > 0) {
        await waryDogAfterLifeSaving(monster, {
            wasDead: genocided, spotted: petSpotted,
            line, repaint, state: game,
        });
    }
    monster.mhpmax = Math.max(
        monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10,
    );
    monster.mhp = monster.mhpmax;
    if (genocided) {
        if (visible) {
            const failedSubject = ordinaryMonsterSubject(monster, spotted);
            await line(`Unfortunately, ${failedSubject} is still genocided...`);
        }
        monster.mhp = 0;
    }
    if (retainCursor)
        game._cursorOverride = [monster.mx - 1, monster.my + 1];
    return {
        kind: 'monster-life-saving', monster, amulet,
        visible, spotted, genocided, survived: !genocided,
    };
}
