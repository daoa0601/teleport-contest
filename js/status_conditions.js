// botl.c: conditions[], condtests[], cond_cmp(), and bot_via_windowport().
import { ICE, SICK_NONVOMITABLE, SICK_VOMITABLE, TT_BURIEDBALL, TT_LAVA } from './const.js';
import { heroHasInvoluntaryDelay } from './command_state.js';
import { heroIsSick } from './hero_illness.js';
import { heroIsUnconscious } from './hero_sleep.js';
import { heroFormSticks } from './hero_species.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { monsterClassSymbol } from './monster_data.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroIsSliming } from './slime.js';
import { heroIsPetrifying } from './stoning.js';
const definitions = [
    { option: 'barehanded', rank: 20, enabled: false, text: ['Bare', 'Bar', 'Bh'] },
    { option: 'blind', rank: 10, enabled: true, text: ['Blind', 'Blnd', 'Bl'] },
    { option: 'busy', rank: 20, enabled: false, text: ['Busy', 'Bsy', 'By'] },
    { option: 'conf', rank: 10, enabled: true, text: ['Conf', 'Cnf', 'Cf'] },
    { option: 'deaf', rank: 10, enabled: true, text: ['Deaf', 'Def', 'Df'] },
    { option: 'iron', rank: 15, enabled: true, text: ['Iron', 'Irn', 'Fe'] },
    { option: 'fly', rank: 10, enabled: true, text: ['Fly', 'Fly', 'Fl'] },
    { option: 'foodPois', rank: 6, enabled: true, text: ['FoodPois', 'Fpois', 'Poi'] },
    { option: 'glowhands', rank: 20, enabled: false, text: ['Glow', 'Glo', 'Gl'] },
    { option: 'grab', rank: 2, enabled: true, text: ['Grab', 'Grb', 'Gr'] },
    { option: 'hallucinat', rank: 10, enabled: true, text: ['Hallu', 'Hal', 'Hl'] },
    { option: 'held', rank: 20, enabled: false, text: ['Held', 'Hld', 'Hd'] },
    { option: 'ice', rank: 20, enabled: false, text: ['Icy', 'Icy', 'Ic'] },
    { option: 'lava', rank: 8, enabled: true, text: ['InLava', 'Lav', 'La'] },
    { option: 'levitate', rank: 10, enabled: true, text: ['Lev', 'Lev', 'Lv'] },
    { option: 'paralyzed', rank: 20, enabled: false, text: ['Parlyz', 'Para', 'Par'] },
    { option: 'ride', rank: 10, enabled: true, text: ['Ride', 'Rid', 'Rd'] },
    { option: 'sleep', rank: 20, enabled: false, text: ['Zzz', 'Zzz', 'Zz'] },
    { option: 'slime', rank: 6, enabled: true, text: ['Slime', 'Slim', 'Slm'] },
    { option: 'slip', rank: 20, enabled: false, text: ['Slip', 'Slp', 'Sl'] },
    { option: 'stone', rank: 6, enabled: true, text: ['Stone', 'Ston', 'Sto'] },
    { option: 'strngl', rank: 4, enabled: true, text: ['Strngl', 'Stngl', 'Str'] },
    { option: 'stun', rank: 10, enabled: true, text: ['Stun', 'Stun', 'St'] },
    { option: 'submerged', rank: 15, enabled: false, text: ['Submrg', 'Subm', 'Sm'] },
    { option: 'termIll', rank: 6, enabled: true, text: ['TermIll', 'Ill', 'Ill'] },
    { option: 'tethered', rank: 20, enabled: false, text: ['Teth', 'Tth', 'Te'] },
    { option: 'trap', rank: 20, enabled: false, text: ['Trap', 'Trp', 'Tr'] },
    { option: 'unconscious', rank: 20, enabled: false, text: ['Out', 'Out', 'KO'] },
    { option: 'woundedlegs', rank: 20, enabled: false, text: ['WLegs', 'Leg', 'Lg'] },
    { option: 'holding', rank: 20, enabled: false, text: ['UHold', 'UHld', 'UHd'] },
];
const defaultMask = definitions.reduce((mask, condition, index) => condition.enabled ? mask | (1 << index) : mask, 0);
// parse_cond_option() accepts each option's first four letters (or its
// complete name if shorter). Config parsing supplies the negation separately.
export function setConditionOption(option, enabled, mask = defaultMask) {
    const name = option.slice(5).toLowerCase();
    const index = definitions.findIndex(condition => name.length >= Math.min(4, condition.option.length)
        && condition.option.toLowerCase().startsWith(name));
    if (index < 0)
        return null;
    const bit = 1 << index;
    return enabled ? mask | bit : mask & ~bit;
}
export function statusConditions(state) {
    const mask = state.flags.statusConditionMask ?? defaultMask;
    const enabled = (name) => statusConditionEnabled(name, state);
    const selected = definitions.filter((condition, index) => (mask & (1 << index)) !== 0 && conditionApplies(condition.option, state, enabled));
    selected.sort((left, right) => left.rank - right.rank
        || (left.option.toLowerCase() < right.option.toLowerCase() ? -1 : 1));
    return selected.map(condition => condition.text);
}
export function statusConditionEnabled(name, state) {
    const mask = state.flags.statusConditionMask ?? defaultMask;
    return definitions.some((condition, index) => condition.option === name && (mask & (1 << index)) !== 0);
}
function conditionApplies(name, state, enabled) {
    const hero = state.u;
    const helpless = heroHasInvoluntaryDelay(state);
    const drowningHold = !!hero.ustuck && !hero.uswallow && !heroFormSticks(state)
        && monsterClassSymbol(hero.ustuck.mnum) === ';';
    const holding = !!hero.ustuck && !hero.uswallow && heroFormSticks(state);
    const unconscious = enabled('unconscious') && !hero.usleep && heroIsUnconscious(state);
    const reason = typeof state._helplessReason === 'string'
        ? state._helplessReason : state._helplessReason?.text ?? '';
    const paralyzed = enabled('paralyzed')
        && (reason.startsWith('paralyzed') || reason.startsWith('frozen'));
    const sleeping = enabled('sleep') && !!hero.usleep;
    switch (name) {
        case 'barehanded': return !state.uarmg && !state.uwep;
        case 'blind': return heroIsBlind(state);
        case 'busy': return helpless && !unconscious && !paralyzed && !sleeping;
        case 'conf': return propertyIsActive('confusion', state);
        case 'deaf': return heroIsDeaf(state);
        case 'iron': return false; // Native currently disables this test too.
        case 'fly': return propertyIsActive('flying', state);
        case 'foodPois': return heroIsSick(state) && !!((hero.sickType ?? 0) & SICK_VOMITABLE);
        case 'glowhands': return !!hero.umconf;
        case 'grab': return drowningHold;
        case 'hallucinat': return heroIsHallucinating(state);
        case 'held': return !!hero.ustuck && !holding && !(enabled('grab') && drowningHold);
        case 'ice': return state.level?.at(hero.ux, hero.uy)?.typ === ICE;
        case 'lava': return !!hero.utrap && hero.utraptype === TT_LAVA;
        case 'levitate': return propertyIsActive('levitation', state);
        case 'paralyzed': return helpless && !unconscious && paralyzed;
        case 'ride': return !!hero.usteed;
        case 'sleep': return helpless && !unconscious && !paralyzed && sleeping;
        case 'slime': return heroIsSliming(state);
        case 'slip': return (hero.glibTurns ?? 0) > 0;
        case 'stone': return heroIsPetrifying(state);
        case 'strngl': return heroIsStrangled(state);
        case 'stun': return !!hero.stunned || propertyIsActive('stunned', state);
        case 'submerged': return !!hero.uinwater;
        case 'termIll': return heroIsSick(state) && !!((hero.sickType ?? 0) & SICK_NONVOMITABLE);
        case 'tethered': return !!hero.utrap && hero.utraptype === TT_BURIEDBALL;
        case 'trap': return !!hero.utrap
            && !(enabled('lava') && hero.utraptype === TT_LAVA)
            && !(enabled('tethered') && hero.utraptype === TT_BURIEDBALL);
        case 'unconscious': return helpless && unconscious;
        case 'woundedlegs': return (hero._woundedLegTurns ?? 0) > 0 || !!hero._woundedLegSide;
        case 'holding': return holding;
    }
}
//# sourceMappingURL=status_conditions.js.map