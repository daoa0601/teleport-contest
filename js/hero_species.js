// Hero species, form properties, and species-based senses.
// C refs: polyself.c set_uasmon()/polysense(), mondata.c mon_hates_silver().

import { Upolyd } from './const.js';
import { game } from './gstate.js';
import { dragonFormForArmor } from './armor.js';
import {
    MONSTER_ATTACKS, MONSTER_EXPERIENCE_META, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_FLAGS3, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SYMBOL,
    monsterHasHead, monsterIsBat, monsterIsVampire, monsterSpeciesHatesSilver,
    validVampireShiftForm,
} from './monster_data.js';
import {
    AD_BLND, AD_HALU, AD_MAGM, AD_RBRE, AT_EXPL, AT_GAZE,
} from './monster_attack_types.js';
import {
    grantIntrinsicProperty, refreshMovementProperties, revokeIntrinsicProperty,
} from './properties.js';
import { syncBlindness } from './senses.js';
import { syncHeroInvisibility } from './hero_invisibility.js';

const RESISTANCE_BITS = {
    fireResistance: 0x01,
    coldResistance: 0x02,
    sleepResistance: 0x04,
    disintegrationResistance: 0x08,
    shockResistance: 0x10,
    poisonResistance: 0x20,
    acidResistance: 0x40,
    stoneResistance: 0x80,
};
const TELEPATHIC_SPECIES = new Set([
    'floating eye', 'mind flayer', 'master mind flayer',
].map(name => MONSTER_NAME.indexOf(name)));

// C set_uasmon(): install the body and replace only its property sources.
export function setHeroSpecies(mnum, state = game) {
    const hero = state.u;
    const oldSpeed = MONSTER_MOVE[hero.umonnum] ?? 12;
    const newSpeed = MONSTER_MOVE[mnum];
    if (hero.umovement && newSpeed < oldSpeed && oldSpeed > 0)
        hero.umovement = Math.trunc(hero.umovement * newSpeed / oldSpeed);
    hero.umonnum = mnum;
    if (hero.protectionFromShapeChangers || state.protectionFromShapeChangers)
        hero.mcham = -1;
    else if (monsterIsVampire(mnum)) hero.mcham = mnum;
    else if (!validVampireShiftForm(hero.mcham, mnum)) hero.mcham = -1;
    if (Upolyd(hero)) hero.formArmorClass = MONSTER_EXPERIENCE_META[mnum][0];
    else delete hero.formArmorClass;

    const flags1 = MONSTER_FLAGS1[mnum];
    const flags2 = MONSTER_FLAGS2[mnum];
    const symbol = MONSTER_SYMBOL[mnum];
    const name = MONSTER_NAME[mnum];
    const attacks = MONSTER_ATTACKS[mnum];
    const inflicts = damage => attacks.some(attack => attack[1] === damage);
    const floater = symbol === 5 || symbol === 25; // S_EYE, S_LIGHT
    const sightSpecies = Upolyd(hero) ? mnum : state.urace?.mnum;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    const lastDragon = MONSTER_NAME.indexOf('yellow dragon');
    const dragonDefense = mnum >= firstDragon && mnum <= lastDragon
        ? mnum : dragonFormForArmor(state.uarm || hero.uarm);
    const properties = {
        drainResistance: !!(flags2 & (0x02 | 0x04 | 0x100))
            || hero.ulycn >= 0 || name === 'Death'
            || validVampireShiftForm(hero.mcham, mnum)
            || dragonDefense === MONSTER_NAME.indexOf('black dragon'),
        antimagic: inflicts(AD_MAGM) || inflicts(AD_RBRE)
            || name === 'baby gray dragon',
        sicknessResistance: symbol === 32 || name === 'ghoul',
        stunned: name === 'stalker' || monsterIsBat(mnum),
        hallucinationResistance: inflicts(AD_HALU),
        seeInvisible: !!(flags1 & 0x01000000),
        telepathy: TELEPATHIC_SPECIES.has(mnum),
        infravision: !!(MONSTER_FLAGS3[sightSpecies] & 0x0100),
        invisible: name === 'stalker' || name === 'black light',
        teleportation: !!(flags1 & 0x02000000),
        teleportControl: !!(flags1 & 0x04000000),
        levitation: floater,
        flying: !!(flags1 & 0x01) && !floater,
        swimming: !!(flags1 & 0x02),
        passesWalls: !!(flags1 & 0x08),
        regeneration: !!(flags1 & 0x00800000),
        reflection: name === 'silver dragon',
        blinded: !!(flags1 & 0x00001000),
        blindResistance: attacks.some(([type, damage]) => damage === AD_BLND
            && (type === AT_EXPL || type === AT_GAZE)),
    };
    for (const [property, bit] of Object.entries(RESISTANCE_BITS))
        properties[property] = !!(MONSTER_RESISTS[mnum] & bit);
    for (const [property, active] of Object.entries(properties)) {
        if (active) grantIntrinsicProperty(property, 'form', state);
        else revokeIntrinsicProperty(property, 'form', state);
    }
    syncBlindness(state);
    syncHeroInvisibility(state);
    refreshMovementProperties(state);
    setFormSenses(mnum, state);
    state.were_changes = 0;
}

export function heroWarnsOfMonster(monster, state = game) {
    if (!state.u.warnOfMonster || !monster) return false;
    const warning = state.context.warntype;
    const types = (warning.obj || 0) | warning.polyd;
    return !!(types & MONSTER_FLAGS2[monster.mnum])
        || warning.speciesidx === monster.mnum;
}

function setFormSenses(mnum, state) {
    const name = MONSTER_NAME[mnum];
    const warning = state.context.warntype ||= {};
    warning.speciesidx = ['purple worm', 'baby purple worm'].includes(name)
        ? MONSTER_NAME.indexOf('shrieker') : -1;
    warning.polyd = ['vampire', 'vampire leader'].includes(name)
        ? 0x08 | 0x10 : 0; // M2_HUMAN | M2_ELF
    if (warning.speciesidx >= 0 || warning.polyd)
        grantIntrinsicProperty('warnOfMonster', 'form', state);
    else revokeIntrinsicProperty('warnOfMonster', 'form', state);
}

export function heroSpecies(state) {
    if (Upolyd(state.u)) return state.u.umonnum;
    const race = state.urace;
    return state.flags?.female
        ? race?.femalenum ?? race?.malenum ?? race?.mnum
        : race?.malenum ?? race?.mnum;
}

export function heroHatesSilver(state) {
    if (Number.isInteger(state.u?.ulycn) && state.u.ulycn >= 0) return true;
    return monsterSpeciesHatesSilver(heroSpecies(state));
}

export function heroHasNoHead(state) {
    return Upolyd(state.u)
        && !monsterHasHead({ mnum: state.u.umonnum });
}

export function heroIsBreathless(state = game) {
    return !!state.u.magicalBreathing
        || !!(MONSTER_FLAGS1[state.u.umonnum] & 0x00000400);
}
