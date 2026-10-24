import { genders, roles } from './roles.js';
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
// role.c:root_plselection_prompt() and build_plselection_prompt().
export function characterSelectionQuestion(choices, random) {
    const { role, race, gender, alignment } = choices;
    const description = [];
    const missing = new Set();
    const usableAlignment = alignment && validCharacterAlignment(role, race, alignment) ? alignment : null;
    if (usableAlignment)
        description.push(usableAlignment.name);
    else if (!race || validCharacterRace(role, race, null)
        && RACE_SELECTION_RULES[race.name].aligns.length > 1)
        missing.add('alignment');
    const genderCount = role ? ROLE_SELECTION_RULES[role.key].genders?.length ?? genders.length : 0;
    if (gender) {
        if (!role || genderCount > 1 && role.name.m === role.name.f)
            description.push(gender.name);
    }
    else if (!role || genderCount > 1)
        missing.add('gender');
    if (race && (!role || validCharacterRace(role, race, usableAlignment)))
        description.push(role ? race.adj : race.name);
    else
        missing.add('race');
    if (role) {
        const name = gender?.name === 'female' ? role.name.f
            : !gender && !random.has('gender') && role.name.m !== role.name.f
                ? `${role.name.m}/${role.name.f}` : role.name.m;
        description.push(name);
    }
    else if (!random.has('role'))
        missing.add('role');
    if (!role && !race)
        description.push('character');
    const owner = role || race || random.has('race') ? 'your' : 'a';
    let prompt = `Shall I pick ${owner} ${description.join(' ')}`
        .replace('pick a character', 'pick character');
    // Native s_suffix() uses a bare apostrophe after s; this one combined
    // role name has an explicit exception in build_plselection_prompt().
    prompt += /s$/i.test(prompt) && !prompt.endsWith('Priest/Priestess') ? "'" : "'s";
    if (!missing.size) {
        if (!role && !random.has('role'))
            missing.add('role');
        if (!race && !random.has('race'))
            missing.add('race');
        if (!gender && !random.has('gender'))
            missing.add('gender');
        if (!alignment && !random.has('alignment'))
            missing.add('alignment');
    }
    const facetOrder = ['race', 'role', 'gender', 'alignment'];
    const facets = facetOrder.filter(facet => missing.has(facet));
    const last = facets.at(-1);
    if (facets.length > 1)
        prompt += ` ${facets.slice(0, -1).join(', ')} and ${last ?? ''}`;
    else if (last)
        prompt += ` ${last}`;
    return `${prompt} for you? [ynaq]`;
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
export function nativeRoleChoices() {
    return CHARACTER_ROLE_ORDER.flatMap(key => {
        const role = roles.find(candidate => candidate.key === key);
        return role ? [role] : [];
    });
}
//# sourceMappingURL=character_choices.js.map