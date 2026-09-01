// mondeath.js — shared monster fatality interception.
// C refs: mon.c mlifesaver(), lifesaved_monster(), mondead().

import { A_WIS, W_AMUL } from './const.js';
import { exerciseAttribute } from './attrib.js';
import {
    flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { makePetWary } from './dog.js';
import {
    MONSTER_ATTACKS, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { AMULET_OF_LIFE_SAVING } from './object_data.js';
import {
    recordObjectEncounter, recordObjectKnowledge,
} from './object_knowledge.js';

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

async function waryDogAfterLifeSaving(
    monster, {
        wasDead = false, spotted = true,
        line = pline, repaint = newsym, state = game,
    } = {},
) {
    if (!(monster?.mtame > 0)) return;
    const result = makePetWary(monster, { wasDead, state });
    if (result?.tame !== false) return;
    if (!wasDead && spotted) {
        const subject = lifeSavingSubject(monster, true);
        await line(`${subject} ${result.disposition}.`);
    }
    repaint(monster.mx, monster.my);
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
    const subject = lifeSavingSubject(monster, spotted);
    if (creditedKill) await continueLine(creditedKill);
    if (visible) {
        await continueLine('But wait...');
        await page(`${game._pending_message}--More--`);

        const alreadyKnown = game._knownObjectTypes instanceof Set
            && game._knownObjectTypes.has(amulet.otyp);
        if (!alreadyKnown) exerciseAttribute(A_WIS, true);
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
    if (monster.mtame > 0 && !monster.isminion) {
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
