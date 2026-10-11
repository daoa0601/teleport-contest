// C invent.c:currency(). Hallucinated currency names use the core RNG.
import { game } from './gstate.js';
import { makePlural } from './object_grammar.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
const CURRENCIES = [
    'Altarian Dollar', 'Ankh-Morpork Dollar', 'auric', 'buckazoid', 'cirbozoid',
    'credit chit', 'cubit', 'Flanian Pobble Bead', 'fretzer', 'imperial credit',
    'Hong Kong Luna Dollar', 'kongbuck', 'nanite', 'quatloo', 'simoleon',
    'solari', 'spacebuck', 'sporebuck', 'Triganic Pu', 'woolong', 'zorkmid',
];
export function currency(amount, { state = game, random = rn2, } = {}) {
    const name = heroIsHallucinating(state) ? CURRENCIES[random(CURRENCIES.length)] : 'zorkmid';
    if (!name)
        throw new RangeError('Currency selection is outside the native name table.');
    return amount === 1 ? name : makePlural(name);
}
//# sourceMappingURL=currency.js.map