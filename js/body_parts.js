// body_parts.js — Current-form anatomy projections used by source messages.
// C ref: polyself.c mbodypart().  Keep each exported body part tied to the
// corresponding source table rather than deriving one part from another.
import { game } from './gstate.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM, } from './monster_data.js';
import { AT_CLAW } from './monster_attack_types.js';
const M1_NOEYES = 0x00001000;
const M1_HUMANOID = 0x00020000;
const M1_SLITHY = 0x00080000;
const S_BLOB = 2;
const S_COCKATRICE = 3;
const S_DOG = 4;
const S_EYE = 5;
const S_FELINE = 6;
const S_JELLY = 10;
const S_RODENT = 18;
const S_SPIDER = 19;
const S_UNICORN = 21;
const S_VORTEX = 22;
const S_WORM = 23;
const S_LIGHT = 25;
const S_CENTAUR = 29;
const S_ELEMENTAL = 31;
const S_FUNGUS = 32;
const S_PUDDING = 42;
const S_YETI = 51;
const S_EEL = 57;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_CYCLOPS = MONSTER_NAME.indexOf('Cyclops');
const PM_ROTHE = 81;
const PM_KI_RIN = 124;
const PM_RAVEN = 128;
const PM_OWLBEAR = 235;
const PM_HUMAN = 260;
const PM_JELLYFISH = 316;
const PM_KRAKEN = 321;
const PM_STONE_GOLEM = 257;
const PM_AMOROUS_DEMON = 290;
const HUMANOIDS_WITH_HANDS = new Set([
    53, // human
    39, // mummy
    52, // zombie
    27, // angel
    14, // nymph
    12, // leprechaun
    43, // quantum mechanic
    48, // vampire
    15, // orc
    34, // giant
]);
function humanoidHasClaws(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    return (MONSTER_ATTACKS[mnum] || []).some(([attackType]) => attackType === AT_CLAW) && (symbol === undefined || !HUMANOIDS_WITH_HANDS.has(symbol))
        && mnum !== PM_STONE_GOLEM
        && mnum !== PM_AMOROUS_DEMON;
}
export function monsterArmName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR)
        return 'foreleg';
    if (symbol === S_YETI)
        return 'arm';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN)
        return 'tentacle';
    if (flags & M1_HUMANOID)
        return 'arm';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'wing';
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'foreleg';
    if (symbol === S_LIGHT)
        return 'ray';
    if (symbol === S_EEL)
        return 'fin';
    if (symbol === S_WORM)
        return 'anterior segment';
    if (symbol === S_SPIDER)
        return 'pedipalp';
    if (flags & M1_SLITHY)
        return 'vestigial limb';
    if (symbol === S_EYE)
        return 'appendage';
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'pseudopod';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'region';
    if (symbol === S_FUNGUS)
        return 'mycelium';
    return 'forelimb';
}
export function monsterFootName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR)
        return 'rear paw';
    if (symbol === S_YETI)
        return 'foot';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN)
        return 'tentacle';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'foot';
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'rear hoof';
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL)
        return 'anal fin';
    if (symbol === S_WORM)
        return 'posterior segment';
    if (symbol === S_SPIDER)
        return 'claw';
    if (flags & M1_SLITHY)
        return 'rear region';
    if (symbol === S_EYE)
        return 'lower appendage';
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'pseudopod root';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'lower current';
    if (symbol === S_FUNGUS)
        return 'root';
    if (flags & M1_HUMANOID)
        return 'foot';
    return 'rear claw';
}
export function monsterHandName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    if (symbol === S_DOG || symbol === S_FELINE || symbol === S_RODENT
        || mnum === PM_OWLBEAR)
        return 'paw';
    if (symbol === S_YETI)
        return 'hand';
    if ((flags & M1_HUMANOID) && humanoidHasClaws(mnum))
        return 'claw';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN)
        return 'tentacle';
    if (flags & M1_HUMANOID)
        return 'hand';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'wing';
    if (symbol === S_CENTAUR || symbol === S_UNICORN
        || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'forehoof';
    if (symbol === S_LIGHT)
        return 'ray';
    if (symbol === S_EEL)
        return 'pectoral fin';
    if (symbol === S_WORM)
        return 'segment';
    if (symbol === S_SPIDER)
        return 'pedipalp';
    if (flags & M1_SLITHY)
        return 'scale gap';
    if (symbol === S_EYE)
        return 'tentacle';
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'grasp';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'swirl';
    if (symbol === S_FUNGUS)
        return 'strand';
    return 'foreclaw';
}
export function monsterHeadName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_JELLY || symbol === S_PUDDING || symbol === S_BLOB)
        return 'cerebral area';
    if (symbol === S_EYE || symbol === S_LIGHT)
        return 'body';
    if (symbol === S_FUNGUS)
        return 'cap area';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'central core';
    if (symbol === S_WORM)
        return 'anterior segment';
    if (symbol === S_SPIDER)
        return 'cephalothorax';
    return 'head';
}
function currentHeroMonsterNumber(state) {
    const current = state.u.umonnum;
    if (typeof current === 'number' && Number.isInteger(current))
        return current;
    const original = state.u.umonster;
    if (typeof original === 'number' && Number.isInteger(original))
        return original;
    const role = state.urole;
    if (role && Number.isInteger(role.mnum))
        return SPECIAL_PM + 1 + role.mnum;
    return PM_HUMAN;
}
export function heroArmName(state = game) {
    return monsterArmName(currentHeroMonsterNumber(state));
}
export function heroFootName(state = game) {
    return monsterFootName(currentHeroMonsterNumber(state));
}
// C mbodypart(TOE). Hooves, tentacles, and body edges retain their own names.
export function heroToeName(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_YETI && mnum !== PM_OWLBEAR)
        return 'toe';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN)
        return 'tentacle';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'toe';
    if ((symbol !== undefined && [S_CENTAUR, S_UNICORN].includes(symbol))
        || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'rear hoof tip';
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL)
        return 'caudal fin';
    if (symbol === S_WORM)
        return 'posterior setae';
    if (symbol === S_SPIDER)
        return 'claw';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'rear scale';
    if (symbol === S_EYE)
        return 'lower tentacle tip';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)))
        return 'pseudopod extremity';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'edge';
    if (symbol === S_FUNGUS)
        return 'rhizome tip';
    return (MONSTER_FLAGS1[mnum] ?? 0) & M1_HUMANOID ? 'toe' : 'rear claw tip';
}
export function heroHandName(state = game) {
    return monsterHandName(currentHeroMonsterNumber(state));
}
// C mbodypart(FINGER). A clawed humanoid still has fingers; HAND's
// special claw rule does not apply to this part.
export function heroFingerName(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_YETI && mnum !== PM_OWLBEAR)
        return 'finger';
    if (mnum === PM_JELLYFISH || mnum === PM_KRAKEN)
        return 'tentacle';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_HUMANOID)
        return 'finger';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'wing';
    if ((symbol !== undefined && [S_CENTAUR, S_UNICORN].includes(symbol))
        || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'forehoof';
    if (symbol === S_LIGHT)
        return 'ray';
    if (symbol === S_EEL)
        return 'pelvic axillary';
    if (symbol === S_WORM)
        return 'setae';
    if (symbol === S_SPIDER)
        return 'pedipalp';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'large scale';
    if (symbol === S_EYE)
        return 'tentacle';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)))
        return 'pseudopod extension';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'minor current';
    return symbol === S_FUNGUS ? 'hypha' : 'foreclaw';
}
export function heroHeadName(state = game) {
    return monsterHeadName(currentHeroMonsterNumber(state));
}
// C mbodypart(NOSE).
export function heroNoseName(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    const symbol = MONSTER_SYMBOL[mnum];
    if (['mumak', 'mastodon'].includes(MONSTER_NAME[mnum] ?? ''))
        return 'trunk';
    if (symbol === S_YETI && mnum !== PM_OWLBEAR)
        return 'nose';
    if (symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'bill';
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return 'nostril';
    if (symbol === S_WORM)
        return 'prostomium';
    if (symbol === S_SPIDER)
        return 'labrum';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'forked tongue';
    if (symbol === S_EYE)
        return 'olfactory nerve';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)) || mnum === PM_JELLYFISH)
        return 'sensor';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'leading edge';
    return symbol === S_FUNGUS ? 'gill' : 'nose';
}
export function heroLegName(state = game) {
    return monsterLegName(currentHeroMonsterNumber(state));
}
export function monsterLegName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if ((symbol !== undefined && [S_DOG, S_FELINE, S_RODENT].includes(symbol)) || mnum === PM_OWLBEAR)
        return 'rear leg';
    if (symbol === S_YETI || symbol === S_COCKATRICE || mnum === PM_RAVEN)
        return 'leg';
    if ((symbol !== undefined && [S_CENTAUR, S_UNICORN].includes(symbol))
        || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'rear leg';
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return 'peduncle';
    if (symbol === S_WORM)
        return 'posterior';
    if (symbol === S_SPIDER)
        return 'leg';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'rear region';
    if (symbol === S_EYE)
        return 'lower tentacle';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)) || mnum === PM_JELLYFISH)
        return 'lower pseudopod';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'lower current';
    if (symbol === S_FUNGUS)
        return 'rhizome';
    return (MONSTER_FLAGS1[mnum] ?? 0) & M1_HUMANOID ? 'leg' : 'rear limb';
}
// C mbodypart(NECK). A body without a humanoid neck still has its own name
// for that region, for example a spider's cephalothorax or an eye's equator.
export function heroNeckName(state = game) {
    return monsterNeckName(currentHeroMonsterNumber(state));
}
export function monsterNeckName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return 'gills';
    if (symbol === S_WORM)
        return 'clitellum';
    if (symbol === S_SPIDER)
        return 'cephalothorax';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'neck';
    if (symbol === S_EYE)
        return 'equator';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol))
        || mnum === PM_JELLYFISH)
        return 'middle';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'center';
    if (symbol === S_FUNGUS)
        return 'stalk';
    return 'neck';
}
export function heroSpineName(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    const symbol = MONSTER_SYMBOL[mnum];
    if ((symbol !== undefined && [S_CENTAUR, S_UNICORN].includes(symbol)) || mnum === PM_KI_RIN || mnum === PM_ROTHE)
        return 'backbone';
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return 'dorsal fin';
    if (symbol === S_WORM || (MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'length';
    if (symbol === S_SPIDER)
        return 'abdomen';
    if (symbol === S_EYE)
        return 'body';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)) || mnum === PM_JELLYFISH)
        return 'surface';
    if ((symbol !== undefined && [S_VORTEX, S_ELEMENTAL].includes(symbol)))
        return 'currents';
    if (symbol === S_FUNGUS)
        return 'root';
    return 'spine';
}
// C mbodypart(LIGHT_HEADED), including non-humanoid sensations.
export function heroLightHeadedFeeling(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return 'played out';
    if (symbol === S_WORM)
        return 'over stretched';
    if (symbol === S_SPIDER)
        return 'spun out';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'light headed';
    if (symbol === S_EYE)
        return 'rotational';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)) || mnum === PM_JELLYFISH)
        return 'viscous';
    if (symbol === S_VORTEX || symbol === S_ELEMENTAL)
        return 'addled';
    return symbol === S_FUNGUS ? 'sporulated' : 'light headed';
}
// C mbodypart(STOMACH).
export function heroStomachName(state = game) {
    return monsterStomachName(currentHeroMonsterNumber(state));
}
export function monsterStomachName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_SPIDER)
        return 'digestive tract';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'stomach';
    return (symbol !== undefined && [S_EYE, S_VORTEX, S_ELEMENTAL, S_FUNGUS].includes(symbol))
        ? 'interior' : 'stomach';
}
export function heroHasEyes(state = game) {
    return heroEyeCount(state) > 0;
}
// C mondata.h:eyecount(). Eye count is anatomy, independent of sight.
export function heroEyeCount(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOEYES)
        return 0;
    return mnum === PM_CYCLOPS || mnum === PM_FLOATING_EYE ? 1 : 2;
}
// C mbodypart(EYE).
export function heroEyeName(state = game) {
    const mnum = currentHeroMonsterNumber(state);
    const symbol = MONSTER_SYMBOL[mnum];
    if (mnum === PM_FLOATING_EYE)
        return 'cornea';
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_WORM)
        return 'light sensitive cell';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'eye';
    if (symbol === S_EYE)
        return 'optic nerve';
    if ((symbol !== undefined && [S_JELLY, S_PUDDING, S_BLOB].includes(symbol)) || mnum === PM_JELLYFISH)
        return 'dark spot';
    return symbol === S_FUNGUS ? 'visual area' : 'eye';
}
// C mbodypart(FACE). Eels and worms precede the slithy-form rule.
export function heroFaceName(state = game) {
    return monsterFaceName(currentHeroMonsterNumber(state));
}
export function monsterFaceName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_LIGHT)
        return 'beam';
    if (symbol === S_EEL && mnum !== PM_JELLYFISH)
        return 'premaxillary';
    if (symbol === S_WORM)
        return 'clitellum';
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY)
        return 'face';
    if (symbol === S_EYE)
        return 'body';
    if ((symbol !== undefined
        && [S_JELLY, S_PUDDING, S_BLOB, S_VORTEX, S_ELEMENTAL, S_FUNGUS].includes(symbol))
        || mnum === PM_JELLYFISH)
        return 'front';
    return 'face';
}
//# sourceMappingURL=body_parts.js.map