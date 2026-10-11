// C mhitu.c:could_seduce(). Cancellation belongs to each attack caller.
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroPolyGender, heroSpecies } from './hero_species.js';
import { AD_PHYS, AD_SEDU, AD_SITM, AD_SSEX } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL, monsterIsAnimal, } from './monster_data.js';
import { propertyIsActive } from './properties.js';
const M1_SEE_INVIS = 0x01000000;
const M2_NEUTER = 0x00040000;
const S_NYMPH = 14;
const PM_AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');
export function seductionCompatibility(aggressor, defender, attack, state = game) {
    const species = aggressor === 'hero' ? heroSpecies(state) : aggressor.mnum;
    if (monsterIsAnimal({ mnum: species }))
        return 0;
    const attacks = MONSTER_ATTACKS[species];
    const damage = attack?.[1] ?? (attacks?.some(candidate => candidate[1] === AD_SSEX)
        ? AD_SSEX : attacks?.some(candidate => candidate[1] === AD_SEDU) ? AD_SEDU : AD_PHYS);
    const invisible = aggressor === 'hero' ? heroIsInvisible(state) : !!aggressor.minvis;
    const perceived = defender === 'hero' ? propertyIsActive('seeInvisible', state)
        : !!((MONSTER_FLAGS1[defender.mnum] ?? 0) & M1_SEE_INVIS);
    if (invisible && !perceived && damage === AD_SEDU)
        return 0;
    const nymph = MONSTER_SYMBOL[species] === S_NYMPH;
    if ((!nymph && species !== PM_AMOROUS_DEMON)
        || ![AD_SEDU, AD_SSEX, AD_SITM].includes(damage))
        return 0;
    return participantGender(aggressor, state) === 1 - participantGender(defender, state)
        ? 1 : nymph ? 2 : 0;
}
function participantGender(participant, state) {
    if (participant === 'hero')
        return heroPolyGender(state);
    return (MONSTER_FLAGS2[participant.mnum] ?? 0) & M2_NEUTER
        ? 2 : participant.female ? 1 : 0;
}
//# sourceMappingURL=seduction_compatibility.js.map