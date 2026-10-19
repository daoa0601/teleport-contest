// C invent.c:freeinv_core()/addinv_core1()/addinv_core2()/learn_unseen_invent()
// and attrib.c:set_moreluck().
import { isQuestArtifact, touchQuestArtifact } from './quest.js';
import { artifactById, artifactByName } from './artifacts.js';
import { recordAchievement } from './achievements.js';
import { deactivateArtifactProperty } from './artifact_invoke.js';
import { setCarriedArtifactProperties } from './artifact_properties.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { panic } from './diagnostics.js';
import { recordLiteracy } from './literacy.js';
import { levelPrizeKind } from './level_prize.js';
import { learnObjectType } from './object_knowledge.js';
import { observeObjectForNaming, ownedObjectName } from './objnam.js';
import { heroIsBlind } from './senses.js';
import { objectTypeKnown } from './shk.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { deleteObject } from './object_delete.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { ACH_AMUL, ACH_BELL, ACH_BOOK, ACH_CNDL, ACH_MINE_PRIZE, ACH_SOKO_PRIZE, W_ACCESSORY, W_ARMOR, W_SADDLE } from './const.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, FIGURINE, LEASH, LOADSTONE, LUCKSTONE, OBJECT_BIMANUAL, OBJECT_NAMES, SCR_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, } from './object_data.js';
import { curseObjectState } from './object_state.js';
import { OBJECT_TIMER_KIND, stopObjectTimer } from './object_timers.js';
import { isWeldedPrimary } from './weapon_slots.js';
const SCROLL_CLASS = 9;
const COIN_CLASS = 12;
const CARRIED_FLAGS = new Map([
    [AMULET_OF_YENDOR, 'amulet'], [BELL_OF_OPENING, 'bell'],
    [CANDELABRUM_OF_INVOCATION, 'menorah'], [SPE_BOOK_OF_THE_DEAD, 'book'],
]);
// C do.c:canletgo(). A silent check still discovers curses.
export async function canLetGo(object, verb = '', state = game) {
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) {
        if (verb)
            await plineWithContinuation(`You cannot ${verb} something you are wearing.`, { noRepeat: true });
        return false;
    }
    if (isWeldedPrimary(object, state)) {
        object.bknown = true;
        if (verb) {
            let hand = heroHandName(state);
            if (OBJECT_BIMANUAL[object.otyp])
                hand = makePlural(hand);
            await plineWithContinuation(`You cannot ${verb} something welded to your ${hand}.`, { noRepeat: true });
        }
        return false;
    }
    if (object.otyp === LOADSTONE && object.cursed) {
        const quantity = object.quantity ?? object.quan ?? 1;
        if (verb) {
            if (verb === 'throw' && quantity > 1)
                object.corpsenm = 1;
            await plineWithContinuation(`For some reason, you cannot ${verb}${object.corpsenm ? ' any of' : ''} the stone${quantity !== 1 ? 's' : ''}!`);
        }
        object.corpsenm = 0;
        object.bknown = true;
        return false;
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (verb)
            await plineWithContinuation(`The leash is tied around your ${heroHandName(state)}.`);
        return false;
    }
    if ((object.owornmask ?? 0) & W_SADDLE) {
        if (verb)
            await plineWithContinuation(`You cannot ${verb} something you are sitting on.`);
        return false;
    }
    return true;
}
// C freeinv(): extraction precedes carried effects; equipment stays installed.
export async function freeInventoryObject(object, state = game) {
    requireLiveGame(state);
    const index = state.inventory.indexOf(object);
    if (index < 0)
        await panic('extract_nobj: object lost', { state });
    state.inventory.splice(index, 1);
    object.where = 'free';
    await finishInventoryRemoval(object, state);
}
// C invent.c useupall(): setnotworn, freeinv, then obfree.
export async function useUpInventoryStack(object, state = game) {
    requireLiveGame(state);
    const gameWasOver = state.program_state.gameover;
    await removeHeroEquipment(object, state);
    if (!gameWasOver && state.program_state.gameover)
        return;
    await freeInventoryObject(object, state);
    if (!gameWasOver && state.program_state.gameover)
        return;
    await deleteObject(object, state);
}
// C addinv_core1(): clear prize protection before addinv tests stack merging.
export function recordHeroPrizeAcquisition(object, state = game) {
    const prizes = state.context.achieveo;
    const kind = levelPrizeKind(object, state);
    if (!prizes || !kind)
        return;
    const achievement = kind === 'mines' ? ACH_MINE_PRIZE : ACH_SOKO_PRIZE;
    if (recordAchievement(state, achievement) && !state.program_state.gameover) {
        const type = kind === 'mines' ? prizes.mines_prize_otyp : prizes.soko_prize_otyp;
        const name = type === undefined ? null : OBJECT_NAMES[type];
        if (!name)
            throw new Error('A level prize needs its original object type');
        recordGameLogEvent(`acquired the ${kind === 'mines' ? "Mines' End" : 'Sokoban'} ${name}`, { state });
    }
    if (kind === 'mines')
        prizes.mines_prize_oid = 0;
    else
        prizes.soko_prize_oid = 0;
    object.nomerge = false;
}
// C addinv_core1(): these effects precede merging and inventory insertion.
export async function prepareInventoryAddition(object, state = game) {
    if (object.oclass === COIN_CLASS)
        state.context.botl = true;
    updateCarriedFlags(object, true, state);
    const achievement = object.otyp === AMULET_OF_YENDOR ? ACH_AMUL
        : object.otyp === BELL_OF_OPENING ? ACH_BELL
            : object.otyp === CANDELABRUM_OF_INVOCATION ? ACH_CNDL
                : object.otyp === SPE_BOOK_OF_THE_DEAD ? ACH_BOOK : null;
    if (achievement !== null)
        recordAchievement(state, achievement);
    if (isQuestArtifact(object, state))
        await touchQuestArtifact(object, state);
    await setCarriedArtifactProperties(object, true, state);
}
// C addinv_core2(): the surviving object is now in the inventory chain.
export async function finishInventoryAddition(object, state = game) {
    await reactToSeenInventoryObject(object, state);
}
// C addinv_core2(): the object is already linked, including after a merge.
// Sight recovery reuses these effects without adding the object again.
export async function reactToSeenInventoryObject(object, state = game) {
    updateCarriedLuck(object, state);
    if (state.urole?.key !== 'archeologist' || object.oclass !== SCROLL_CLASS
        || object.otyp === SCR_BLANK_PAPER || heroIsBlind(state)
        || objectTypeKnown(object, state))
        return;
    observeObjectForNaming(object, { state });
    await plineWithContinuation(`You decipher the label on ${ownedObjectName(object, state, { capitalized: false })}.`);
    learnObjectType(object.otyp, state);
    recordLiteracy('became literate by deciphering a scroll label', { state });
}
export async function learnUnseenInventory(state = game) {
    if (heroIsBlind(state))
        return;
    const priest = state.urole?.key === 'priest';
    const archeologist = state.urole?.key === 'archeologist';
    for (const object of state.inventory) {
        if (object.dknown && (object.bknown || !priest)
            && (object.oclass !== SCROLL_CLASS || !archeologist))
            continue;
        observeObjectForNaming(object, { state });
        await reactToSeenInventoryObject(object, state);
    }
    // The pinned TTY build's update_inventory() has no persistent window.
}
export async function finishInventoryRemoval(object, state = game) {
    const gameWasOver = state.program_state.gameover;
    object.pickup_prev = false;
    if (object.oclass === COIN_CLASS) {
        state.context.botl = true;
        return;
    }
    updateCarriedFlags(object, false, state);
    await setCarriedArtifactProperties(object, false, state);
    const artifact = artifactById(object.oartifact, state);
    if (artifact) {
        await deactivateArtifactProperty(object, artifact, {
            state, publish: plineWithContinuation,
        });
        if (!gameWasOver && state.program_state.gameover)
            return;
    }
    if (object.otyp === LOADSTONE) {
        curseObjectState(object);
    }
    else if (confersLuck(object, state)) {
        updateCarriedLuck(object, state);
    }
    else if (object.otyp === FIGURINE && object.timed) {
        stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    }
}
function updateCarriedFlags(object, carried, state) {
    let flag = CARRIED_FLAGS.get(object.otyp);
    if (object.oartifact
        && object.oartifact === artifactByName(state.urole?.artifactName, state)?.id)
        flag = 'questart';
    if (flag) {
        if (!state.u.uhave)
            throw new Error('Carried quest objects require initialized hero possessions');
        state.u.uhave[flag] = carried;
    }
}
export function updateCarriedLuck(object, state = game) {
    if (confersLuck(object, state)) {
        const lucky = state.inventory.filter(item => confersLuck(item, state));
        const luck = lucky.reduce((sum, item) => sum + (item.cursed ? -1 : 1) * item.quan, 0);
        state.u.moreluck = !luck && !lucky.some(item => item.otyp === LUCKSTONE)
            ? 0 : luck < 0 ? -3 : 3;
    }
}
export function confersLuck(object, state = game) {
    return object.otyp === LUCKSTONE
        || !!artifactById(object.oartifact, state)?.flags.includes('SPFX_LUCK');
}
//# sourceMappingURL=hero_inventory.js.map