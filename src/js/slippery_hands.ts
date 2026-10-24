// C do_wear.c:glibr(). Each turn, slippery fingers shed uncursed rings and
// any wielded weapon that is not welded or an aklys.
import { canLetGo } from './hero_inventory.js';
import { removeHeroAccessory } from './accessory.js';
import { heroFingerName, heroHandName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { AKLYS, OBJECT_BIMANUAL } from './object_data.js';
import { makePlural, makeSingular } from './object_grammar.js';
import type { GameObject } from './object_types.js';
import { heroHasNoLimbs } from './polyself.js';
import { isWeldedPrimary, setPrimaryWeapon, setSecondaryWeapon } from './weapon_slots.js';
import { weaponDescription } from './weapon_description.js';
import { isSword } from './weapon_type.js';

export function heroHasSlipperyHands(state: GameState): boolean {
    return !!state.u.glib || (state.u.glibTurns ?? 0) > 0;
}

function slipVerb(plural: boolean): string {
    return plural ? 'slip' : 'slips';
}

export async function slipFromSlipperyHands(
    state: GameState, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    const hero = state.u;
    const weapon = state.uwep ?? null;
    const rightHanded = hero.rightHanded !== false;
    // A welded two-handed weapon pins only the ring on the weapon hand.
    const ringFalls = (ring: GameObject | null | undefined, weaponHand: boolean) => {
        if (!ring || ring.cursed) return false;
        return !weapon || !(isWeldedPrimary(weapon, state) && weaponHand)
            || !OBJECT_BIMANUAL[weapon.otyp];
    };
    const left = state.uleft ?? null;
    const right = state.uright ?? null;
    const leftFalls = ringFalls(left, !rightHanded);
    const rightFalls = ringFalls(right, rightHanded);
    let slipped = 0;
    if (!state.uarmg && (leftFalls || rightFalls) && !heroHasNoLimbs(state)) {
        const both = leftFalls && rightFalls;
        await publish(`Your ${both ? 'rings slip' : 'ring slips'} off your ${
            both ? makePlural(heroFingerName(state)) : heroFingerName(state)}.`);
        slipped++;
        for (const ring of [leftFalls ? left : null, rightFalls ? right : null]) {
            if (!ring) continue;
            await removeHeroAccessory(ring, state);
            await dropInventoryObjectAtHero(ring, { state, publish });
            state._cannedCommands = [];
        }
    }

    let otherWeapon: string | null = null;
    let wasTwoWeapon = false;
    const secondary = state.uswapwep ?? null;
    if (hero.twoweap && secondary) {
        const quantity = secondary.quan ?? 1;
        otherWeapon = isSword(secondary) ? 'sword' : weaponDescription(secondary);
        if (quantity > 1) otherWeapon = makePlural(otherWeapon);
        await publish(`Your ${otherWeapon} ${slipped ? 'also ' : ''}${slipVerb(quantity > 1)} from your ${
            rightHanded ? 'left ' : 'right '}${heroHandName(state)}.`);
        slipped++;
        wasTwoWeapon = true;
        await setSecondaryWeapon(null, state);
        state._cannedCommands = [];
        if (await canLetGo(secondary, '', state)) await dropInventoryObjectAtHero(secondary, { state, publish });
    }

    const primary = state.uwep ?? null;
    if (!primary || primary.otyp === AKLYS || isWeldedPrimary(primary, state)) return;
    let kind = isSword(primary) ? 'sword' : weaponDescription(primary);
    if (otherWeapon && kind !== makeSingular(otherWeapon)) otherWeapon = null;
    // Several wielded food items still slip as one "food".
    let plural = (primary.quan ?? 1) > 1;
    if (plural) {
        if (kind === 'food') plural = false;
        else kind = makePlural(kind);
    }
    let hand = heroHandName(state);
    let which = '';
    if (OBJECT_BIMANUAL[primary.otyp]) hand = makePlural(hand);
    else if (wasTwoWeapon) which = rightHanded ? 'right ' : 'left ';
    await publish(`${kind.startsWith('corpse') ? 'The' : 'Your'} ${otherWeapon ? 'other ' : ''}${kind} ${
        slipped ? 'also ' : ''}${slipVerb(plural)} from your ${which}${hand}.`);
    await setPrimaryWeapon(null, state);
    state._cannedCommands = [];
    if (await canLetGo(primary, '', state)) await dropInventoryObjectAtHero(primary, { state, publish });
}
