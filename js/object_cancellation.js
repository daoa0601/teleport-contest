// Cancellation changes an actual object, including worn bonuses and timers.
// C ref: zap.c cancel_item() and blank_novel().
import { A_STR, A_CON, A_CHA, A_DEX, A_INT, A_WIS, W_RING, W_ARMG, W_ARMH, W_ARMOR } from './const.js';
import { game } from './gstate.js';
import { CANDELABRUM_OF_INVOCATION, CORPSE, CRYSTAL_BALL, MAGIC_LAMP, SPE_NOVEL, OBJECT_MAGIC, OBJECT_NAMES, POT_ACID, POT_FRUIT_JUICE, POT_SICKNESS, POT_WATER, SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, WAN_CANCELLATION, } from './object_data.js';
import { monsterIsRider } from './monster_data.js';
import { objectClassForType } from './object_knowledge.js';
import { isWeaponTool } from './object_properties.js';
import { unblessObjectState, uncurseObjectState } from './object_state.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopObjectTimer, } from './object_timers.js';
import { chargeAlteredUnpaidObject } from './shk.js';
import { objectWeight } from './weight.js';
const SPE_CANCELLATION = OBJECT_NAMES.indexOf('cancellation');
const POT_SEE_INVISIBLE = OBJECT_NAMES.indexOf('see invisible', 297);
export async function cancelObjectMagic(object, { state = game } = {}) {
    const originalType = object.otyp;
    const objectClass = object.oclass ?? objectClassForType(originalType);
    removeWornBonuses(object, state);
    const enchanted = !!object.spe
        && ([2, 3].includes(objectClass) || isWeaponTool(object));
    if (OBJECT_MAGIC[originalType] || enchanted
        || originalType === POT_ACID || originalType === POT_SICKNESS
        || (originalType === POT_WATER && (object.blessed || object.cursed))
        || originalType === SPE_NOVEL) {
        const cancelledCharges = objectClass === 11 || originalType === CRYSTAL_BALL ? -1 : 0;
        if (object.spe !== cancelledCharges
            && ![WAN_CANCELLATION, MAGIC_LAMP, CANDELABRUM_OF_INVOCATION].includes(originalType)) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.spe = cancelledCharges;
            if ('enchantment' in object)
                object.enchantment = cancelledCharges;
        }
        if (objectClass === 9) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.otyp = SCR_BLANK_PAPER;
            object.spe = 0;
        }
        else if (objectClass === 10
            && originalType !== SPE_CANCELLATION && originalType !== SPE_BOOK_OF_THE_DEAD) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.otyp = SPE_BLANK_PAPER;
            if (originalType === SPE_NOVEL)
                blankNovel(object);
        }
        else if (objectClass === 8) {
            await chargeAlteredUnpaidObject(object, originalType !== POT_WATER ? 'cancel'
                : object.cursed ? 'uncurse' : 'unbless', state);
            if (originalType === POT_SICKNESS || originalType === POT_SEE_INVISIBLE)
                object.otyp = POT_FRUIT_JUICE;
            else {
                object.otyp = POT_WATER;
                object.odiluted = 0;
            }
        }
    }
    if (object.otyp === CORPSE && object.timed
        && !monsterIsRider({ mnum: object.corpsenm ?? -1 })) {
        const revival = objectTimers(object).find(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON);
        if (revival) {
            stopObjectTimer(object, OBJECT_TIMER_KIND.REVIVE_MON);
            // C starts a new relative timeout using peek_timer's absolute value.
            scheduleObjectTimer(object, OBJECT_TIMER_KIND.ROT_CORPSE, (state.moves ?? 1) + revival.deadline, state);
        }
    }
    unblessObjectState(object);
    uncurseObjectState(object);
    state._capacityDirty = true;
}
function removeWornBonuses(object, state) {
    if (object.where !== 'inventory')
        return;
    const name = OBJECT_NAMES[object.otyp];
    const worn = object.owornmask ?? 0;
    const amount = object.spe ?? 0;
    const attributes = new Map([
        ['gain strength', [A_STR, W_RING]], ['gain constitution', [A_CON, W_RING]],
        ['adornment', [A_CHA, W_RING]], ['gauntlets of dexterity', [A_DEX, W_ARMG]],
        ['helm of brilliance', [A_INT, W_ARMH]],
    ]);
    const bonus = name ? attributes.get(name) : undefined;
    if (bonus && (worn & bonus[1])) {
        state.context.botl = true;
        state.u.abon ||= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[bonus[0]] = (state.u.abon.a[bonus[0]] ?? 0) - amount;
        if (name === 'helm of brilliance')
            state.u.abon.a[A_WIS] = (state.u.abon.a[A_WIS] ?? 0) - amount;
    }
    if ((worn & W_ARMOR) || (name === 'protection' && (worn & W_RING)))
        state.context.botl = true;
    if (!(worn & W_RING))
        return;
    if (name === 'increase accuracy')
        state.u.uhitinc = (state.u.uhitinc ?? 0) - amount;
    if (name === 'increase damage')
        state.u.udaminc = (state.u.udaminc ?? 0) - amount;
}
export function blankNovel(object) {
    if (object.otyp !== SPE_BLANK_PAPER)
        throw new TypeError('A blanked novel must be a blank spellbook.');
    object.novelidx = 0;
    object.corpsenm = 0;
    delete object.oname;
    delete object.name;
    if (object.oextra)
        delete object.oextra.oname;
    for (let current = object; current; current = current.container)
        current.owt = objectWeight(current);
}
//# sourceMappingURL=object_cancellation.js.map