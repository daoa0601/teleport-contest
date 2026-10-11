import { NON_PM, ismnum } from './const.js';
// Native species carriers use NON_PM for an absent or unassigned species.
// LOW_PM is zero and is also the first real entry in mons[].
export function validSavedSpeciesOrNone(value) {
    return value === NON_PM || ismnum(value);
}
//# sourceMappingURL=species_validation.js.map