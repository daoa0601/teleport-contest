// Class-specific details appended by objnam.c:doname_base(). Equipment,
// object identity, quantities, and shop prices have separate owners.
import { CORPSTAT_FEMALE, CORPSTAT_GENDER, CORPSTAT_MALE, CORPSTAT_RANDOM, MV_KNOWS_EGG, W_SADDLE, W_TOOL, } from './const.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { game } from './gstate.js';
import { deferImpossible } from './diagnostics.js';
import { monsterTypeName } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, CORPSE, EGG, FIGURINE, LEASH, MAGIC_LAMP, OBJECT_CHARGED, OBJECT_COST, OIL_LAMP, POT_OIL, STATUE, TALLOW_CANDLE, WAX_CANDLE, requireObjectData, } from './object_data.js';
import { isWeaponTool } from './object_properties.js';
import { OBJECT_TIMER_KIND } from './object_timers.js';
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const WAND_CLASS = 11;
export function objectClassDescription(item, state = game) {
    const details = { prefix: [], suffix: '' };
    const known = item.known || item.overrideIdentified || state.iflags.override_ID;
    switch (item.oclass) {
        case TOOL_CLASS:
            if (!isWeaponTool(item))
                describeTool(item, details, !!known, state);
            break;
        case FOOD_CLASS:
            if (item.oeaten)
                details.prefix.push('partly eaten');
            if (item.otyp === EGG && item.spe === 1 && eggHasMonsterSpecies(item)
                && (known || (state.mvitals?.[item.corpsenm]?.mvflags ?? 0) & MV_KNOWS_EGG))
                details.suffix = ' (laid by you)';
            break;
        case POTION_CLASS:
            if (item.otyp === POT_OIL && item.lamplit)
                details.suffix = ' (lit)';
            break;
        case WAND_CLASS:
            if (known)
                details.suffix = chargeDescription(item);
            break;
    }
    if (state.flags.debug && state.iflags.wizmgender
        && [CORPSE, STATUE, FIGURINE].includes(item.otyp)) {
        const gender = item.spe & CORPSTAT_GENDER;
        const label = gender === CORPSTAT_RANDOM ? 'unspecified gender'
            : gender === CORPSTAT_MALE ? 'male'
                : gender === CORPSTAT_FEMALE ? 'female' : 'neuter';
        details.suffix += ` (${label})`;
    }
    return details;
}
function describeTool(item, details, known, state) {
    // The native worn-tool branch ends before attachment, fuel, or charges.
    if ((item.owornmask ?? 0) & (W_TOOL | W_SADDLE))
        return;
    if (item.otyp === LEASH && item.leashmon) {
        const monster = state.level?.monsters.find(actor => actor.m_id === item.leashmon);
        if (monster && monster.mhp > 0) {
            details.suffix = ` (attached to ${monsterName(monster, {
                state, article: 'your', suppressIt: true,
            })})`;
        }
        else {
            deferImpossible(monster
                ? `leashed ${monsterTypeName(monster.mnum, monster.female)} #${item.leashmon} is dead`
                : `leashed monster #${item.leashmon} not found`, state);
            item.leashmon = 0;
        }
        return;
    }
    if (item.otyp === CANDELABRUM_OF_INVOCATION) {
        details.suffix = ` (${item.spe} of 7 candle${item.spe === 1 ? '' : 's'}${item.lamplit ? ', lit' : ' attached'})`;
        return;
    }
    const candle = item.otyp === TALLOW_CANDLE || item.otyp === WAX_CANDLE;
    if (candle || [OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN].includes(item.otyp)) {
        if (candle && remainingCandleFuel(item, state) < 20 * requireObjectData(OBJECT_COST, item.otyp))
            details.prefix.push('partly used');
        if (item.lamplit)
            details.suffix = ' (lit)';
        return;
    }
    if (known && OBJECT_CHARGED[item.otyp])
        details.suffix = chargeDescription(item);
}
function remainingCandleFuel(item, state) {
    if (!item.lamplit)
        return item.age;
    const deadline = item.objectTimers?.find(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT)?.deadline ?? 0;
    return item.age + deadline - state.moves;
}
function chargeDescription(item) {
    return ` (${item.recharged}:${item.spe})`;
}
//# sourceMappingURL=object_description_details.js.map