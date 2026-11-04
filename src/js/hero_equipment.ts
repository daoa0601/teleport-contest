// Clear every equipment slot an item still occupies when it leaves the hero
// or changes type (C refs: worn.c:setnotworn(), steal.c:remove_worn_item()).
// Command messages belong to the caller.

import { clearHeroAccessory, removeHeroAccessory, removeEyewear } from './do_wear.js';

import { armorSlotFor, clearHeroArmor, removeHeroArmor } from './do_wear.js';

import { I_SPECIAL, W_BALL, W_CHAIN, W_TOOL } from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { syncBlindness } from './senses.js';
import { uqwepgone, uswapwepgone, uwepgone } from './wield.js';
import { setnotworn, setworn } from './worn.js';
import { unpunishHero } from './read.js';

export async function removeHeroEquipment(object: GameObject, state: GameState = game, {
    deferArmorClass = false,
}: { deferArmorClass?: boolean } = {}): Promise<void> {
    const armorSlot = armorSlotFor(object.otyp);
    if (state.uskin === object) {
        state.uskin = null;
        object.owornmask = (object.owornmask ?? 0) & ~I_SPECIAL;
        await clearHeroArmor(object, state, { deferArmorClass, embeddedSkin: true });
    }
    if (armorSlot && (state[armorSlot] === object
        || state.u?.[armorSlot] === object)) {
        await clearHeroArmor(object, state, { deferArmorClass });
    }
    await clearHeroAccessory(object, state, { deferArmorClass });
    if (state.ublindf === object || state.u?.ublindf === object) {
        // C do_wear.c:Blindf_off() clears the slot with
        // setworn(0, otmp->owornmask); setnotworn() runs below.
        await setworn(null, W_TOOL, state);
        syncBlindness(state);
    }
    // C worn.c:setnotworn(): destroyed/used-up wielded items do not arm the
    // "begin bashing with your bare hands" notice (zap.c:maybe_destroy_item,
    // invent.c:useupall, apply.c:use_cream_pie all route through setnotworn).
    await setnotworn(object, state);
}

// C steal.c:remove_worn_item(). Landing can otherwise disrobe or burn the
// very item whose removal is still in progress.
// Armor routes through the do_wear.c *_off() owners inside
// removeHeroArmor()/clearHeroArmor(): Cloak_off(), Armor_off(),
// Helmet_off(), Gloves_off(), Boots_off(), Shield_off(), Shirt_off().
export async function removeWornHeroItem(object: GameObject, state: GameState = game, {
    unchainBall = true,
    ...armorOptions
}: { unchainBall?: boolean; cancelledDon?: boolean } = {}): Promise<void> {
    const wasInUse = object.in_use;
    // C steal.c:remove_worn_item() branches on the ball/chain bits on
    // entry: those items take the unpunish branch and skip the
    // setnotworn() catchall, which clears them.
    const wasBallOrChain = ((object.owornmask ?? 0) & (W_BALL | W_CHAIN)) !== 0;
    object.in_use = true;
    try {
        const slot = armorSlotFor(object.otyp);
        if (slot && (state[slot] === object || state.u?.[slot] === object)) {
            // Native *_off() clears worn sources; the command loop owns find_ac().
            await removeHeroArmor(object, state, {
                deferArmorClass: true,
                ...armorOptions,
            });
        }
        await removeHeroAccessory(object, state);
        if (state.ublindf === object || state.u?.ublindf === object) {
            await removeEyewear(object, { state });
            if (state.program_state?.gameover) return;
        }
        // C steal.c:remove_worn_item() W_WEAPONS branch.
        if (state.uwep === object || state.u?.uwep === object)
            await uwepgone(state);
        if (state.uswapwep === object || state.u?.uswapwep === object)
            await uswapwepgone(state);
        if (state.uquiver === object || state.u?.uquiver === object)
            await uqwepgone(state);
        if (wasBallOrChain) {
            if (unchainBall) await unpunishHero(state);
        } else {
            await removeHeroEquipment(object, state);
        }
    } finally {
        if (wasInUse === undefined) delete object.in_use;
        else object.in_use = wasInUse;
    }
}
