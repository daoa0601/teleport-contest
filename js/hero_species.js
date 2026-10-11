// Hero species, form properties, and species-based senses.
// C refs: polyself.c set_uasmon()/polysense(), mondata.c mon_hates_silver().
import { Upolyd } from './const.js';
import { game } from './gstate.js';
import { dragonFormForArmor } from './armor.js';
import { MONSTER_ATTACKS, MONSTER_EXPERIENCE_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_FLAGS3, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SYMBOL, monsterHasHead, monsterIsBat, monsterIsVampire, monsterSpeciesHatesSilver, monsterSpeciesSticks, validVampireShiftForm, } from './monster_data.js';
import { AD_BLND, AD_HALU, AD_MAGM, AD_RBRE, AT_EXPL, AT_GAZE, } from './monster_attack_types.js';
import { grantIntrinsicProperty, refreshMovementProperties, revokeIntrinsicProperty, } from './properties.js';
import { syncBlindness } from './senses.js';
import { syncHeroInvisibility } from './hero_invisibility.js';
import { speciesCanBlow } from './monster_anatomy.js';
const PM_FIRE_ELEMENTAL = MONSTER_NAME.indexOf('fire elemental');
const PM_SALAMANDER = MONSTER_NAME.indexOf('salamander');
// C mondata.c:can_blow(). Silent or buzzing bodies need enough size, a
// head, and breath; bodies which can make other sounds can blow too.
export function heroCanBlow(state = game) {
    if (state.u.strangled || (state.u.strangledTurns ?? 0) > 0)
        return false;
    return speciesCanBlow(heroSpecies(state));
}
const RESISTANCE_BITS = [
    ['fireResistance', 0x01],
    ['coldResistance', 0x02],
    ['sleepResistance', 0x04],
    ['disintegrationResistance', 0x08],
    ['shockResistance', 0x10],
    ['poisonResistance', 0x20],
    ['acidResistance', 0x40],
    ['stoneResistance', 0x80],
];
const TELEPATHIC_SPECIES = new Set([
    'floating eye', 'mind flayer', 'master mind flayer',
].map(name => MONSTER_NAME.indexOf(name)));
// C ref: mondata.c sticks().
export function heroFormSticks(state = game) {
    return Upolyd(state.u) && monsterSpeciesSticks(heroSpecies(state));
}
// C set_uasmon(): install the body and replace only its property sources.
export function setHeroSpecies(mnum, state = game) {
    const hero = state.u;
    const oldSpeed = hero.umonnum === undefined ? 12
        : speciesEntry(MONSTER_MOVE, hero.umonnum);
    const newSpeed = speciesEntry(MONSTER_MOVE, mnum);
    if (hero.umovement && newSpeed < oldSpeed && oldSpeed > 0)
        hero.umovement = Math.trunc(hero.umovement * newSpeed / oldSpeed);
    hero.umonnum = mnum;
    if (hero.protectionFromShapeChangers || state.protectionFromShapeChangers)
        hero.mcham = -1;
    else if (monsterIsVampire(mnum))
        hero.mcham = mnum;
    else if (!validVampireShiftForm(hero.mcham ?? -1, mnum))
        hero.mcham = -1;
    if (Upolyd(hero))
        hero.formArmorClass = speciesEntry(MONSTER_EXPERIENCE_META, mnum)[0];
    else
        delete hero.formArmorClass;
    const flags1 = speciesEntry(MONSTER_FLAGS1, mnum);
    const flags2 = speciesEntry(MONSTER_FLAGS2, mnum);
    const symbol = speciesEntry(MONSTER_SYMBOL, mnum);
    const name = speciesEntry(MONSTER_NAME, mnum);
    const attacks = speciesEntry(MONSTER_ATTACKS, mnum);
    const inflicts = (damage) => attacks.some(attack => attack[1] === damage);
    const floater = symbol === 5 || symbol === 25; // S_EYE, S_LIGHT
    const sightSpecies = Upolyd(hero) ? mnum : state.urace?.mnum;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    const lastDragon = MONSTER_NAME.indexOf('yellow dragon');
    const dragonDefense = mnum >= firstDragon && mnum <= lastDragon
        ? mnum : dragonFormForArmor(state.uarm || hero.uarm);
    const properties = [
        ['drainResistance', !!(flags2 & (0x02 | 0x04 | 0x100))
                || (hero.ulycn ?? -1) >= 0 || name === 'Death'
                || validVampireShiftForm(hero.mcham ?? -1, mnum)
                || dragonDefense === MONSTER_NAME.indexOf('black dragon')],
        ['antimagic', inflicts(AD_MAGM) || inflicts(AD_RBRE)
                || name === 'baby gray dragon'],
        ['sicknessResistance', symbol === 32 || name === 'ghoul'],
        ['stunned', name === 'stalker' || monsterIsBat(mnum)],
        ['hallucinationResistance', inflicts(AD_HALU)],
        ['seeInvisible', !!(flags1 & 0x01000000)],
        ['telepathy', TELEPATHIC_SPECIES.has(mnum)],
        ['infravision', !!((sightSpecies === undefined ? 0 : speciesEntry(MONSTER_FLAGS3, sightSpecies)) & 0x0100)],
        ['invisible', name === 'stalker' || name === 'black light'],
        ['teleportation', !!(flags1 & 0x02000000)],
        ['teleportControl', !!(flags1 & 0x04000000)],
        ['levitation', floater],
        ['flying', !!(flags1 & 0x01) && !floater],
        ['swimming', !!(flags1 & 0x02)],
        ['passesWalls', !!(flags1 & 0x08)],
        ['regeneration', !!(flags1 & 0x00800000)],
        ['reflection', name === 'silver dragon'],
        ['blinded', !!(flags1 & 0x00001000)],
        ['blindResistance', attacks.some(([type, damage]) => damage === AD_BLND
                && (type === AT_EXPL || type === AT_GAZE))],
    ];
    for (const [property, bit] of RESISTANCE_BITS)
        properties.push([property, !!(speciesEntry(MONSTER_RESISTS, mnum) & bit)]);
    for (const [property, active] of properties) {
        if (active)
            grantIntrinsicProperty(property, 'form', state);
        else
            revokeIntrinsicProperty(property, 'form', state);
    }
    syncBlindness(state);
    syncHeroInvisibility(state);
    refreshMovementProperties(state);
    setFormSenses(mnum, state);
    state.were_changes = 0;
}
export function heroWarnsOfMonster(monster, state = game) {
    if (!state.u.warnOfMonster || !monster)
        return false;
    const warning = state.context.warntype;
    if (!warning)
        throw new Error('Monster warning sources are not initialized');
    const types = (warning.obj || 0) | (warning.polyd || 0);
    return !!(types & speciesEntry(MONSTER_FLAGS2, monster.mnum))
        || warning.speciesidx === monster.mnum;
}
function setFormSenses(mnum, state) {
    const name = speciesEntry(MONSTER_NAME, mnum);
    const speciesidx = ['purple worm', 'baby purple worm'].includes(name)
        ? MONSTER_NAME.indexOf('shrieker') : -1;
    const polyd = ['vampire', 'vampire leader'].includes(name)
        ? 0x08 | 0x10 : 0; // M2_HUMAN | M2_ELF
    const warning = state.context.warntype ||= { speciesidx, polyd };
    warning.speciesidx = speciesidx;
    warning.polyd = polyd;
    if (warning.speciesidx >= 0 || warning.polyd)
        grantIntrinsicProperty('warnOfMonster', 'form', state);
    else
        revokeIntrinsicProperty('warnOfMonster', 'form', state);
}
// C youmonst.data always describes u.umonnum, including the unpolymorphed
// role body. Racial rules use urace separately; a human Monk is herbivorous.
export function heroSpecies(state = game) {
    const species = state.u.umonnum;
    if (species === undefined)
        throw new Error('Hero species is not initialized');
    return species;
}
// C polyself.c:poly_gender(): non-humanoid and neuter forms use neuter prose.
export function heroPolyGender(state = game) {
    const species = heroSpecies(state);
    if ((speciesEntry(MONSTER_FLAGS2, species) & 0x00040000)
        || !(speciesEntry(MONSTER_FLAGS1, species) & 0x00020000))
        return 2;
    return state.flags.female ? 1 : 0;
}
// C polyself.c:change_sex(). Fixed-sex forms retain their visible sex;
// a polymorphed hero still changes the saved sex used on rehumanization.
export function changeHeroSex(state = game) {
    const polymorphed = Upolyd(state.u);
    const species = heroSpecies(state);
    const fixedSex = speciesEntry(MONSTER_FLAGS2, species) & 0x00070000;
    if (!polymorphed || !fixedSex)
        state.flags.female = !state.flags.female;
    if (polymorphed)
        state.u.mfemale = !state.u.mfemale;
    if (!polymorphed) {
        if (state.u.umonster === undefined)
            throw new Error('Hero role species is not initialized');
        state.u.umonnum = state.u.umonster;
    }
    else if (species === MONSTER_NAME.indexOf('amorous demon')) {
        state.flags.female = !state.flags.female;
        setHeroSpecies(species, state);
    }
}
export function heroHatesSilver(state) {
    if ((state.u.ulycn ?? -1) >= 0)
        return true;
    return monsterSpeciesHatesSilver(heroSpecies(state));
}
export function heroHasNoHead(state) {
    return Upolyd(state.u)
        && !monsterHasHead({ mnum: heroSpecies(state) });
}
export function heroIsBreathless(state = game) {
    return !!state.u.magicalBreathing
        || !!(speciesEntry(MONSTER_FLAGS1, heroSpecies(state)) & 0x00000400);
}
export function heroPassesWalls(state = game) {
    return !!state.u.passesWalls || !!(speciesEntry(MONSTER_FLAGS1, heroSpecies(state)) & 0x08);
}
export function heroLikesLava(state = game) {
    const hero = state.u;
    if (!Upolyd(hero))
        return false;
    return hero.umonnum === PM_FIRE_ELEMENTAL
        || hero.umonnum === PM_SALAMANDER;
}
function speciesEntry(table, species) {
    const value = table[species];
    if (value === undefined)
        throw new RangeError(`No monster species data for ${species}`);
    return value;
}
//# sourceMappingURL=hero_species.js.map