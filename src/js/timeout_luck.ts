// C timeout.c:nh_timeout(), before the prayer invulnerability guard.
import { FULL_MOON } from './const.js';
import { game } from './gstate.js';
import { confersLuck } from './hero_inventory.js';
import { FEDORA, LUCKSTONE } from './object_data.js';

export function recoverTimedLuck(state = game): void {
    let baseline = state.flags.moonphase === FULL_MOON ? 1 : 0;
    if (state.flags.friday13) baseline--;
    if (state.quest_status?.killed_leader) baseline -= 4;
    if (state.urole?.key === 'archeologist'
        && (state.uarmh ?? state.u.uarmh)?.otyp === FEDORA) baseline++;

    const hero = state.u;
    const luck = hero.uluck ?? 0;
    const interval = hero.uhave?.amulet || hero.ugangr ? 300 : 600;
    if (luck === baseline || state.moves % interval !== 0) return;

    // attrib.c:stone_luck(): count quantities, including luck artifacts.
    // Uncursed items count for possession but do not favor either timeout.
    let allStones = 0;
    let blessedAndCursed = 0;
    let luckstone = false;
    for (const object of state.inventory) {
        if (!confersLuck(object, state)) continue;
        const quantity = object.quan;
        allStones += object.cursed ? -quantity : quantity;
        if (object.cursed) blessedAndCursed -= quantity;
        else if (object.blessed) blessedAndCursed += quantity;
        if (object.otyp === LUCKSTONE) luckstone = true;
    }
    const noStone = !luckstone && allStones === 0;
    if (luck > baseline && (noStone || blessedAndCursed < 0)) hero.uluck = luck - 1;
    else if (luck < baseline && (noStone || blessedAndCursed > 0)) hero.uluck = luck + 1;
}
