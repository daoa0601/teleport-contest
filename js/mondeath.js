// Monster death rules which can keep a monster alive.
// C refs: mon.c mlifesaver(), lifesaved_monster(), mondead().
import { heroIsUnaware } from './hero_sleep.js';
import { A_WIS, DOOR, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, G_GENOD, NON_PM, W_AMUL, } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { canSeeMonster, canSpotMonster, flush_screen, newsym, pline, plineWithContinuation, } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { expelHero } from './hero_expulsion.js';
import { nhgetch } from './input.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { monsterName, namelessMonsterName, possessiveName } from './monster_name.js';
import { makePetWary } from './dog.js';
import { MONSTER_ATTACKS, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsNonliving, monsterIsVampire, } from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { triggerMonsterDoorTrap } from './monster_door_trap.js';
import { AMULET_OF_LIFE_SAVING } from './object_data.js';
import { recordObjectEncounter, recordObjectKnowledge, } from './object_knowledge.js';
import { rn2, rnd } from './rng.js';
import { cansee, vision_note_blocker_change } from './vision.js';
async function lifeSavingPage(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}
// which_armor(mon, W_AMUL) is the eligibility boundary: carrying an amulet
// without wearing it must never intercept monster death.
export function wornMonsterLifeSaver(monster) {
    const shiftedVampire = typeof monster.cham === 'number' && Number.isInteger(monster.cham)
        && monsterIsVampire(monster.cham);
    if (monsterIsNonliving(monster?.mnum) && !shiftedVampire)
        return null;
    return (monster?.minvent || monster?.inventory || []).find(object => object.otyp === AMULET_OF_LIFE_SAVING
        && ((object.owornmask ?? 0) & W_AMUL));
}
function monsterReconstitutesAfterLifeSaving(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(attack => attack[0] === 13 || attack[0] === 14);
}
// The caller supplies any credited kill line. The amulet is consumed and the
// monster is restored before any caller can remove it from the level.
export async function lifeSaveMonster(monster, amulet, { creditedKill, retainCursor = false, genocided = false, continueLine = plineWithContinuation, page = lifeSavingPage, line = pline, repaint = newsym, } = {}) {
    if (creditedKill)
        await continueLine(creditedKill);
    const visible = cansee(monster.mx, monster.my);
    if (visible) {
        await continueLine('But wait...');
        await page(`${game._pending_message}--More--`);
        await page(`${possessiveName(monsterName(monster, { capitalized: true }))} medallion begins to glow!--More--`);
        const alreadyKnown = game._knownObjectTypes instanceof Set
            && game._knownObjectTypes.has(amulet.otyp);
        if (!alreadyKnown)
            await exerciseAttribute(A_WIS, true);
        recordObjectEncounter(amulet.otyp);
        recordObjectKnowledge(amulet.otyp);
        if (canSeeMonster(monster)) {
            const recovery = monsterReconstitutesAfterLifeSaving(monster)
                ? 'reconstitutes' : 'looks much better';
            await page(`${monsterName(monster, { capitalized: true })} ${recovery}!--More--`);
        }
        await line('The medallion crumbles to dust!');
    }
    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(amulet);
    if (index >= 0)
        inventory.splice(index, 1);
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
    if ((monster.mtame ?? 0) > 0 && !monster.isminion) {
        await makePetWary(monster, {
            wasDead: genocided,
            publish: line, repaint, state: game,
        });
    }
    monster.mhpmax = Math.max(monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10);
    monster.mhp = monster.mhpmax;
    if (genocided) {
        if (cansee(monster.mx, monster.my)) {
            const failedSubject = monsterName(monster);
            await line(`Unfortunately, ${failedSubject} is still genocided...`);
        }
        monster.mhp = 0;
    }
    if (retainCursor)
        game._cursorOverride = [monster.mx - 1, monster.my + 1];
    return {
        kind: 'monster-life-saving', monster, amulet,
        messageShown: visible, genocided, survived: !genocided, completedDeath: null,
    };
}
export async function preventMonsterDeath(monster, { creditedKill, disintegrated = false, state = game, genocided = monsterSpeciesWasGenocided(monster, state), publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requireLiveGame(state);
    monster.mhp = 0;
    const amulet = wornMonsterLifeSaver(monster);
    if (amulet) {
        const saved = await lifeSaveMonster(monster, amulet, { creditedKill: creditedKill ?? null, genocided });
        if (saved.survived)
            return saved;
    }
    else if (creditedKill) {
        await publish(creditedKill);
    }
    const revived = await reviveShiftedVampire(monster, {
        visible: cansee(monster.mx, monster.my),
        spotted: canSpotMonster(monster), disintegrated, state, publish,
        random, rollOne,
    });
    return revived || {
        monster, survived: false, messageShown: false, completedDeath: null,
    };
}
function monsterSpeciesWasGenocided(monster, state = game) {
    return !!((state.mvitals?.[monster?.mnum]?.mvflags ?? 0) & G_GENOD);
}
function vampireRiseAction(monster, disintegrated, unaware, state) {
    const unusualBody = monsterIsNonliving(monster.mnum)
        || monsterIsNoncorporeal(monster) || monsterIsAmorphous(monster);
    const reconstitutes = disintegrated
        || monsterIsNoncorporeal(monster) || monsterIsAmorphous(monster);
    const oldSubject = monsterName(monster, {
        state, adjective: unusualBody ? '' : 'seemingly dead',
        suppressInvisible: true, suppressSaddle: false, augmentIt: true,
    });
    const action = reconstitutes ? 'reconstitutes' : 'transforms';
    const description = `${unaware ? 'you dream that ' : ''}${oldSubject} ${unaware ? '' : 'suddenly '}${action} and rises as`;
    return description.charAt(0).toUpperCase() + description.slice(1);
}
function closedDoorAt(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (location?.typ !== DOOR)
        return null;
    return (location.doormask ?? 0) & (D_CLOSED | D_LOCKED)
        ? location : null;
}
async function smashDoorUnderVampire(monster, x, y, { visible, spotted, unaware, state, publish, rollOne, random, }) {
    const door = closedDoorAt(state, x, y);
    if (!door) {
        return { monster, survived: true, messageShown: false, completedDeath: null };
    }
    const trapped = !!((door.doormask ?? 0) & D_TRAPPED);
    let message = null;
    if (!visible && !(state.deaf || state.u?.deaf)) {
        message = trapped
            ? 'You hear an explosion.' : 'You hear a door being smashed.';
    }
    else if (visible && !spotted) {
        message = trapped
            ? 'You see a door exploding.' : 'You see a door being smashed.';
    }
    else if (visible && spotted && !unaware) {
        message = trapped
            ? 'The door is smashed and it explodes!'
            : 'The door is smashed.';
    }
    if (message)
        await publish(message);
    door.doormask = D_NODOOR;
    if (state === game)
        vision_note_blocker_change(x, y);
    if (!trapped) {
        return { monster, survived: true, messageShown: !!message, completedDeath: null };
    }
    const verbose = state.flags.verbose;
    let trap;
    state.flags.verbose = false;
    try {
        trap = await triggerMonsterDoorTrap(monster, visible, { state, publish, rollOne, random });
    }
    finally {
        if (verbose === undefined)
            delete state.flags.verbose;
        else
            state.flags.verbose = verbose;
    }
    if (trap.heroDied)
        return {
            monster, survived: !trap.killed, messageShown: !!message,
            completedDeath: trap.death, heroDied: true,
        };
    const showDeath = trap.killed && canSpotMonster(monster) && !heroIsUnaware(state);
    if (showDeath) {
        await publish(`${monsterName(monster, { state, capitalized: true })} is destroyed!`);
    }
    return { monster, survived: !trap.killed,
        messageShown: !!message || showDeath, completedDeath: trap.death };
}
async function reviveShiftedVampire(monster, { visible, spotted, disintegrated, state, publish, random, rollOne, }) {
    const baseMnum = typeof monster.cham === 'number' && Number.isInteger(monster.cham)
        ? monster.cham : NON_PM;
    if (baseMnum < 0 || baseMnum === monster.mnum
        || !monsterIsVampire(baseMnum)
        || ((state.mvitals?.[baseMnum]?.mvflags ?? 0) & G_GENOD)) {
        return null;
    }
    const x = monster.mx;
    const y = monster.my;
    const unaware = heroIsUnaware(state);
    const riseAction = vampireRiseAction(monster, disintegrated, unaware, state);
    monster.dead = false;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    monster.mhpmax = Math.max(monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10);
    monster.mhp = monster.mhpmax;
    if (state.u?.ustuck === monster) {
        if (state.u.uswallow) {
            const expulsion = await expelHero(monster, {
                state, publish, message: false, random, rollOne,
            });
            if (expulsion.died)
                return {
                    monster, survived: monster.mhp > 0,
                    messageShown: false, heroDied: true, completedDeath: null,
                };
        }
        else {
            state.u.ustuck = null;
        }
    }
    const change = await changeMonsterForm(monster, baseMnum, state);
    if (change?.heroDied)
        return {
            monster, survived: monster.mhp > 0,
            messageShown: false, heroDied: true, completedDeath: null,
        };
    if (!change) {
        return {
            monster, survived: monster.mhp > 0, messageShown: false, completedDeath: null,
        };
    }
    monster.cham = monster.mnum === baseMnum ? NON_PM : baseMnum;
    const spottedAfter = state === game ? canSpotMonster(monster) : spotted;
    let messageShown = false;
    if (spottedAfter) {
        const newName = namelessMonsterName(monster, {
            state, article: 'a', suppressIt: true, suppressInvisible: true,
        });
        await publish(`${riseAction} ${newName}!`);
        messageShown = true;
    }
    const door = await smashDoorUnderVampire(monster, x, y, {
        visible: state === game ? cansee(x, y) : visible,
        spotted: spottedAfter,
        unaware,
        state,
        publish,
        rollOne,
        random,
    });
    if (door.heroDied)
        return door;
    if (state === game) {
        newsym(x, y);
        if (monster.mx !== x || monster.my !== y)
            newsym(monster.mx, monster.my);
    }
    return {
        ...door,
        messageShown: messageShown || door.messageShown,
    };
}
//# sourceMappingURL=mondeath.js.map