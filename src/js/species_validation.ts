import { NON_PM, ismnum } from './const.js';

// Port only: validate saved species indices and the absent-species sentinel.
// Native species carriers use NON_PM for an absent or unassigned species.
// LOW_PM is zero and is also the first real entry in mons[].
export function validSavedSpeciesOrNone(value: unknown): value is number {
    return value === NON_PM || ismnum(value);
}
