// Monster death rules which can keep a monster alive.
// C refs: mon.c mlifesaver(), lifesaved_monster(), mondead().

import {
    A_WIS, DOOR, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, G_GENOD,
    NON_PM, TRAPPED_DOOR, W_AMUL,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import {
    canSpotMonster, flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import {
    moveExpelledMonster, releaseHeroFromMonster,
} from './hero_expulsion.js';
import { nhgetch } from './input.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { makePetWary } from './dog.js';
import {
    MONSTER_ATTACKS, monsterIsAmorphous, monsterIsNoncorporeal,
    monsterIsNonliving, monsterIsVampire, monsterTypeName,
} from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { wakeMonstersNear } from './monster_wake.js';
import { AMULET_OF_LIFE_SAVING } from './object_data.js';
import {
    recordObjectEncounter, recordObjectKnowledge,
} from './object_knowledge.js';
import { rn2, rnd } from './rng.js';
import { cansee, vision_note_blocker_change } from './vision.js';

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
    const shiftedVampire = Number.isInteger(monster?.cham)
        && monsterIsVampire(monster.cham);
    if (monsterIsNonliving(monster?.mnum) && !shiftedVampire) return null;
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

// The caller supplies any credited kill line. The amulet is consumed and the
// monster is restored before any caller can remove it from the level.
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

export async function preventMonsterDeath(
    monster, {
        creditedKill,
        visible = true,
        spotted = true,
        petSpotted = spotted,
        disintegrated = false,
        state = game,
        genocided = monsterSpeciesWasGenocided(monster, state),
        publish = plineWithContinuation,
        saveMonster = lifeSaveMonster,
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    monster.mhp = 0;
    const amulet = wornMonsterLifeSaver(monster);
    if (amulet) {
        const saved = await saveMonster(monster, amulet, {
            creditedKill, visible, spotted, petSpotted, genocided,
        });
        if (saved?.survived) return { ...saved, messageShown: visible };
    } else if (creditedKill) {
        await publish(creditedKill);
    }

    const revived = await reviveShiftedVampire(monster, {
        visible, spotted, disintegrated, state, publish,
        random, rollOne,
    });
    return revived || {
        monster, survived: false, messageShown: false,
    };
}

function monsterSpeciesWasGenocided(monster, state = game) {
    return !!((state.mvitals?.[monster?.mnum]?.mvflags ?? 0) & G_GENOD);
}

function heroIsUnaware(state) {
    return !!(state.unaware || state.u?.unaware
        || state._helplessReason === 'unconscious from rotten food'
        || state._helplessReason === 'unconscious from drinking');
}

function vampireRiseMessage(monster, oldMnum, disintegrated, unaware) {
    const oldForm = { mnum: oldMnum };
    const unusualBody = monsterIsNonliving(oldMnum)
        || monsterIsNoncorporeal(oldForm) || monsterIsAmorphous(oldForm);
    const reconstitutes = disintegrated
        || monsterIsNoncorporeal(oldForm) || monsterIsAmorphous(oldForm);
    const oldName = monster.name
        || monsterTypeName(oldMnum, !!monster.female);
    const oldSubject = `${unusualBody ? '' : 'seemingly dead '}${oldName}`;
    const action = reconstitutes ? 'reconstitutes' : 'transforms';
    const newName = monsterTypeName(monster.mnum, !!monster.female);
    if (unaware) {
        return `You dream that the ${oldSubject} ${action} and rises as a ${
            newName}!`;
    }
    return `The ${oldSubject} suddenly ${action} and rises as a ${newName}!`;
}

function closedDoorAt(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (location?.typ !== DOOR) return null;
    return (location.doormask ?? 0) & (D_CLOSED | D_LOCKED)
        ? location : null;
}

async function smashDoorUnderVampire(
    monster, x, y, {
        visible, spotted, unaware, state, publish, rollOne,
    },
) {
    const door = closedDoorAt(state, x, y);
    if (!door) {
        return { survived: true, messageShown: false };
    }

    const trapped = !!((door.doormask ?? 0) & D_TRAPPED);
    let message = null;
    if (!visible && !(state.deaf || state.u?.deaf)) {
        message = trapped
            ? 'You hear an explosion.' : 'You hear a door being smashed.';
    } else if (visible && !spotted) {
        message = trapped
            ? 'You see a door exploding.' : 'You see a door being smashed.';
    } else if (visible && spotted && !unaware) {
        message = trapped
            ? 'The door is smashed and it explodes!'
            : 'The door is smashed.';
    }
    if (message) await publish(message);

    door.doormask = D_NODOOR;
    if (state === game) vision_note_blocker_change(x, y);
    if (!trapped) {
        return { survived: true, messageShown: !!message };
    }

    wakeMonstersNear(x, y, 49, state);
    monster.mstun = 1;
    monster.mhp -= rollOne(15);
    if (monster.mhp > 0) {
        monster.mtrapseen = (monster.mtrapseen ?? 0)
            | (1 << (TRAPPED_DOOR - 1));
        return { survived: true, messageShown: !!message };
    }

    monster.mhp = 0;
    if (spotted && !unaware) {
        await publish(
            `The ${monsterTypeName(monster.mnum, !!monster.female)
            } is destroyed!`,
        );
    }
    return { survived: false, messageShown: true };
}

async function reviveShiftedVampire(
    monster, {
        visible, spotted, disintegrated, state, publish,
        random, rollOne,
    },
) {
    const baseMnum = Number.isInteger(monster?.cham) ? monster.cham : NON_PM;
    if (baseMnum < 0 || baseMnum === monster.mnum
        || !monsterIsVampire(baseMnum)
        || ((state.mvitals?.[baseMnum]?.mvflags ?? 0) & G_GENOD)) {
        return null;
    }

    const x = monster.mx;
    const y = monster.my;
    const oldMnum = monster.mnum;
    const unaware = heroIsUnaware(state);
    monster.dead = false;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    monster.mhpmax = Math.max(
        monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10,
    );
    monster.mhp = monster.mhpmax;

    if (state.u?.ustuck === monster) {
        if (state.u.uswallow) {
            releaseHeroFromMonster(monster, state);
            moveExpelledMonster(monster, state, { random, rollOne });
        } else {
            state.u.ustuck = null;
        }
    }

    const change = changeMonsterForm(monster, baseMnum, state);
    if (!change) {
        return {
            monster, survived: monster.mhp > 0, messageShown: false,
        };
    }
    monster.cham = monster.mnum === baseMnum ? NON_PM : baseMnum;

    const spottedAfter = state === game ? canSpotMonster(monster) : spotted;
    let messageShown = false;
    if (spottedAfter) {
        await publish(vampireRiseMessage(
            monster, oldMnum, disintegrated, unaware,
        ));
        messageShown = true;
    }

    const door = await smashDoorUnderVampire(monster, x, y, {
        visible: state === game ? cansee(x, y) : visible,
        spotted: spottedAfter,
        unaware,
        state,
        publish,
        rollOne,
    });
    if (state === game) {
        newsym(x, y);
        if (monster.mx !== x || monster.my !== y)
            newsym(monster.mx, monster.my);
    }
    return {
        monster, survived: door.survived,
        messageShown: messageShown || door.messageShown,
    };
}
