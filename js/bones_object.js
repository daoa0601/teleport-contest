import { artifactById, nameArtifact } from './artifacts.js';
import { sanitizeBonesName } from './bones_name.js';
import { ROOMOFFSET, SHOPBASE } from './const.js';
import { game } from './gstate.js';
import { AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, BOOMERANG, BOW, CANDELABRUM_OF_INVOCATION, CORPSE, EGG, ELVEN_BOW, FAKE_AMULET_OF_YENDOR, SPE_NOVEL, OBJECT_USES_KNOWN, ORCISH_BOW, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, STATUE, TIN, WAX_CANDLE, YUMI, } from './object_data.js';
import { MONSTER_GENO, SPECIAL_PM } from './monster_data.js';
import { OBJECT_TIMER_KIND } from './object_timers.js';
import { curseObjectState } from './object_state.js';
import { roomForRoomno } from './room.js';
import { shopkeeperInOwnShop } from './shk.js';
import { objectWeight } from './weight.js';
import { definiteName, objectCombatName } from './objnam.js';
const HANDED_WEAPONS = new Set([
    BOW, ELVEN_BOW, ORCISH_BOW, YUMI, BOOMERANG,
]);
const G_UNIQ = 0x1000;
const PM_DOPPELGANGER = 270;
const PM_HUMAN_ZOMBIE = 244;
const PM_SHOPKEEPER = 271;
const SPECIAL_LOCATION_MONSTERS = new Set([123, 272, 275, 276]);
function keepIndividualName(object) {
    return !!(object.oartifact || object.artifact)
        || object.otyp === STATUE
        || object.otyp === SPE_NOVEL
        || (object.otyp === CORPSE && object.corpsenm !== undefined && object.corpsenm >= SPECIAL_PM);
}
function clearPresentation(object) {
    for (const key of [
        'name', 'plural', 'class', 'enchantment', 'buc',
    ])
        delete object[key];
}
function discardUnsafeMonsterTraits(object) {
    if (![CORPSE, STATUE].includes(object.otyp)
        || !object.oextra?.omonst)
        return;
    const mnum = object.corpsenm;
    if (mnum === undefined)
        return;
    let replacement = null;
    if (mnum === PM_SHOPKEEPER || SPECIAL_LOCATION_MONSTERS.has(mnum))
        replacement = PM_HUMAN_ZOMBIE;
    else if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ)
        replacement = PM_DOPPELGANGER;
    if (replacement === null)
        return;
    delete object.oextra.omonst;
    if (replacement === PM_DOPPELGANGER && object.otyp === CORPSE)
        object.corpsenm = replacement;
}
export function prepareBonesObjectForSave(object) {
    if (!object)
        return object;
    if (OBJECT_USES_KNOWN[object.otyp]) {
        object.known = false;
    }
    for (const key of ['dknown', 'bknown', 'rknown', 'lknown', 'cknown', 'tknown'])
        object[key] = false;
    object.invlet = null;
    object.no_charge = false;
    object.how_lost = 0;
    object.pickup_prev = false;
    if (!keepIndividualName(object)) {
        delete object.oname;
        if (object.oextra)
            delete object.oextra.oname;
    }
    clearPresentation(object);
    if (object.otyp === EGG) {
        object.spe = 0;
    }
    else if (object.otyp === TIN && object.corpsenm !== undefined
        && (MONSTER_GENO[object.corpsenm] ?? 0) & G_UNIQ) {
        object.corpsenm = -1;
    }
    else if (object.otyp === CORPSE || object.otyp === STATUE) {
        discardUnsafeMonsterTraits(object);
    }
    else if (object.o_id === game.context.achieveo?.mines_prize_oid
        || object.o_id === game.context.achieveo?.soko_prize_oid) {
        object.nomerge = false;
    }
    else if (object.otyp === AMULET_OF_YENDOR) {
        object.otyp = FAKE_AMULET_OF_YENDOR;
        curseObjectState(object);
    }
    else if (object.otyp === CANDELABRUM_OF_INVOCATION) {
        object.objectTimers = (object.objectTimers || []).filter(timer => timer.kind !== OBJECT_TIMER_KIND.BURN_OBJECT);
        object.timed = object.objectTimers.length;
        object.lamplit = false;
        object.otyp = WAX_CANDLE;
        object.age = 50;
        if (object.spe > 0)
            object.quan = object.quantity = object.spe;
        else
            object.quantity = object.quan;
        object.spe = 0;
        object.owt = objectWeight(object);
        curseObjectState(object);
    }
    else if (object.otyp === BELL_OF_OPENING) {
        object.otyp = BELL;
        curseObjectState(object);
    }
    else if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
        object.otyp = SPE_BLANK_PAPER;
        curseObjectState(object);
    }
    delete object.buc;
    return object;
}
function removeArtifactIdentity(object) {
    object.oartifact = 0;
    object.artifact = false;
    delete object.oname;
    if (object.oextra)
        delete object.oextra.oname;
}
function outermostContainer(object) {
    let current = object;
    const visited = new Set();
    while (current?.where === 'contained' && current.container
        && !visited.has(current)) {
        visited.add(current);
        current = current.container;
    }
    return current;
}
function isInStaffedShop(object, state) {
    const top = outermostContainer(object);
    if (top?.where !== 'floor')
        return false;
    const location = state.level?.at?.(top.ox, top.oy);
    if (!location || location.edge || location.roomno < ROOMOFFSET)
        return false;
    const room = roomForRoomno(state.level, location.roomno);
    return !!room && room.rtype >= SHOPBASE
        && shopkeeperInOwnShop(room.resident, state);
}
export function prepareBonesObjectForRestore(object, state = game) {
    if (!object)
        return object;
    if (object.oartifact) {
        const artifact = artifactById(object.oartifact, state);
        if (!artifact || artifact.questArtifact
            || !nameArtifact(object, artifact, { state })) {
            removeArtifactIdentity(object);
        }
    }
    else {
        if (object.oname)
            object.oname = sanitizeBonesName(object.oname);
        if (object.oextra?.oname) {
            object.oextra.oname = sanitizeBonesName(object.oextra.oname);
        }
    }
    if (object.oclass === 7 && (object.oeaten ?? 0) > 0)
        object.no_charge = isInStaffedShop(object, state);
    return object;
}
export function finishGhostlyPickup(object, state) {
    if (!object?.ghostly)
        return null;
    object.ghostly = false;
    if (!HANDED_WEAPONS.has(object.otyp))
        return null;
    const noun = definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state);
    const hand = state?.u?.rightHanded === false ? 'left' : 'right';
    return `You make adjustments to ${noun} to suit your ${hand} hand.`;
}
//# sourceMappingURL=bones_object.js.map