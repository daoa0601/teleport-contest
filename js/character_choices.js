import { aligns, genders, races, roles } from './roles.js';
import { rn2 } from './rng.js';
// C ref: role.c roles[].allow and races[].allow.  The JS role table keeps
// Ranger before Rogue for historical callers, while the C selection table
// deliberately keeps Rogue before Ranger; random character selection must
// use the latter order to preserve the PRNG-to-role mapping.
const CHARACTER_ROLE_ORDER = [
    'archeologist', 'barbarian', 'caveman', 'healer', 'knight', 'monk',
    'priest', 'rogue', 'ranger', 'samurai', 'tourist', 'valkyrie', 'wizard',
];
export const ROLE_SELECTION_RULES = {
    archeologist: { races: ['human', 'dwarf', 'gnome'], aligns: ['lawful', 'neutral'] },
    barbarian: { races: ['human', 'orc'], aligns: ['neutral', 'chaotic'] },
    caveman: { races: ['human', 'dwarf', 'gnome'], aligns: ['lawful', 'neutral'] },
    healer: { races: ['human', 'gnome'], aligns: ['neutral'] },
    knight: { races: ['human'], aligns: ['lawful'] },
    monk: { races: ['human'], aligns: ['lawful', 'neutral', 'chaotic'] },
    priest: { races: ['human', 'elf'], aligns: ['lawful', 'neutral', 'chaotic'] },
    rogue: { races: ['human', 'orc'], aligns: ['chaotic'] },
    ranger: { races: ['human', 'elf', 'gnome', 'orc'], aligns: ['neutral', 'chaotic'] },
    samurai: { races: ['human'], aligns: ['lawful'] },
    tourist: { races: ['human'], aligns: ['neutral'] },
    valkyrie: { races: ['human', 'dwarf'], aligns: ['lawful', 'neutral'], genders: ['female'] },
    wizard: { races: ['human', 'elf', 'gnome', 'orc'], aligns: ['neutral', 'chaotic'] },
};
export const RACE_SELECTION_RULES = {
    human: { aligns: ['lawful', 'neutral', 'chaotic'] },
    elf: { aligns: ['chaotic'] },
    dwarf: { aligns: ['lawful'] },
    gnome: { aligns: ['neutral'] },
    orc: { aligns: ['chaotic'] },
};
export function validCharacterChoice(role, race, gender, alignment) {
    return !!role && (!race || validCharacterRace(role, race, alignment))
        && (!gender || validCharacterGender(role, gender))
        && (!alignment || validCharacterAlignment(role, race, alignment));
}
// Native ok_race(), ok_gend(), and ok_align() check only the constraints
// belonging to that facet. An incompatible alignment must not erase a
// valid gender or prevent the user from choosing a race first.
export function validCharacterRace(role, race, alignment) {
    return (!role || ROLE_SELECTION_RULES[role.key].races.includes(race.name))
        && (!alignment || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}
export function validCharacterGender(role, gender) {
    const permitted = role && ROLE_SELECTION_RULES[role.key].genders;
    return !permitted || permitted.includes(gender.name);
}
export function validCharacterAlignment(role, race, alignment) {
    return (!role || ROLE_SELECTION_RULES[role.key].aligns.includes(alignment.name))
        && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}
export function hasCharacterCompletion(role, race, gender, alignment) {
    return races.some(candidateRace => (race ? candidateRace === race : true)
        && genders.some(candidateGender => (gender ? candidateGender === gender : true)
            && aligns.some(candidateAlignment => (alignment ? candidateAlignment === alignment : true)
                && validCharacterChoice(role, candidateRace, candidateGender, candidateAlignment))));
}
export function pickCharacterChoice(choices) {
    return choices.length ? choices[rn2(choices.length)] ?? null : null;
}
export function nativeRoleChoices() {
    return CHARACTER_ROLE_ORDER.flatMap(key => {
        const role = roles.find(candidate => candidate.key === key);
        return role ? [role] : [];
    });
}
// role.c:rigid_role_checks(). Explicit random choices run in role, race,
// alignment, gender order. Unspecified facets roll only when forced.
export function rigidCharacterChecks(initial, random) {
    let { role, race, gender, alignment } = initial;
    if (random.has('role')) {
        const candidates = nativeRoleChoices().filter(candidate => hasCharacterCompletion(candidate, race, gender, alignment));
        role = pickCharacterChoice(candidates) ?? pickCharacterChoice(nativeRoleChoices());
    }
    if (random.has('race'))
        race = pickCharacterChoice(races.filter(candidate => validCharacterRace(role, candidate, alignment)));
    if (random.has('alignment'))
        alignment = pickCharacterChoice(aligns.filter(candidate => validCharacterAlignment(role, race, candidate)));
    if (random.has('gender'))
        gender = pickCharacterChoice(genders.filter(candidate => validCharacterGender(role, candidate)));
    if (role) {
        if (!race && !random.has('race')) {
            const candidates = races.filter(candidate => validCharacterRace(role, candidate, alignment));
            if (candidates.length === 1)
                race = pickCharacterChoice(candidates);
        }
        if (!alignment && !random.has('alignment')) {
            const candidates = aligns.filter(candidate => validCharacterAlignment(role, race, candidate));
            if (candidates.length === 1)
                alignment = pickCharacterChoice(candidates);
        }
        if (!gender && !random.has('gender')) {
            const candidates = genders.filter(candidate => validCharacterGender(role, candidate));
            if (candidates.length === 1)
                gender = pickCharacterChoice(candidates);
        }
    }
    return { role, race, gender, alignment };
}
//# sourceMappingURL=character_choices.js.map