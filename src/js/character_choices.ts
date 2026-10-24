// C role.c: character admission and random selection, without terminal I/O.
import type { Role, Race, Gender, Alignment, RoleKey, RaceName, GenderName, AlignmentName } from './roles.js';
import { aligns, genders, races, roles } from './roles.js';
import { rn2 } from './rng.js';

export type RoleChoice = Role | null | undefined;
export type RaceChoice = Race | null | undefined;
export type GenderChoice = Gender | null | undefined;
export type AlignmentChoice = Alignment | null | undefined;

export interface CharacterChoices {
    role: RoleChoice;
    race: RaceChoice;
    gender: GenderChoice;
    alignment: AlignmentChoice;
}

export type CharacterFacet = 'role' | 'race' | 'gender' | 'alignment';

interface RoleSelectionRules {
    races: readonly RaceName[];
    aligns: readonly AlignmentName[];
    genders?: readonly GenderName[];
}

// C ref: role.c roles[].allow and races[].allow.  The JS role table keeps
// Ranger before Rogue for historical callers, while the C selection table
// deliberately keeps Rogue before Ranger; random character selection must
// use the latter order to preserve the PRNG-to-role mapping.
const CHARACTER_ROLE_ORDER: readonly RoleKey[] = [
    'archeologist', 'barbarian', 'caveman', 'healer', 'knight', 'monk',
    'priest', 'rogue', 'ranger', 'samurai', 'tourist', 'valkyrie', 'wizard',
];

export const ROLE_SELECTION_RULES: Record<RoleKey, RoleSelectionRules> = {
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

export const RACE_SELECTION_RULES: Record<RaceName, { aligns: readonly AlignmentName[] }> = {
    human: { aligns: ['lawful', 'neutral', 'chaotic'] },
    elf: { aligns: ['chaotic'] },
    dwarf: { aligns: ['lawful'] },
    gnome: { aligns: ['neutral'] },
    orc: { aligns: ['chaotic'] },
};

// role.c:root_plselection_prompt() and build_plselection_prompt().
export function characterSelectionQuestion(choices: CharacterChoices, random: ReadonlySet<CharacterFacet>): string {
    const { role, race, gender, alignment } = choices;
    const description: string[] = [];
    const missing = new Set<CharacterFacet>();
    const usableAlignment = alignment && validCharacterAlignment(role, race, alignment) ? alignment : null;
    if (usableAlignment) description.push(usableAlignment.name);
    else if (!race || validCharacterRace(role, race, null)
        && RACE_SELECTION_RULES[race.name].aligns.length > 1) missing.add('alignment');

    const genderCount = role ? ROLE_SELECTION_RULES[role.key].genders?.length ?? genders.length : 0;
    if (gender) {
        if (!role || genderCount > 1 && role.name.m === role.name.f)
            description.push(gender.name);
    } else if (!role || genderCount > 1) missing.add('gender');

    if (race && (!role || validCharacterRace(role, race, usableAlignment)))
        description.push(role ? race.adj : race.name);
    else missing.add('race');

    if (role) {
        const name = gender?.name === 'female' ? role.name.f
            : !gender && !random.has('gender') && role.name.m !== role.name.f
                ? `${role.name.m}/${role.name.f}` : role.name.m;
        description.push(name);
    } else if (!random.has('role')) missing.add('role');
    if (!role && !race) description.push('character');

    const owner = role || race || random.has('race') ? 'your' : 'a';
    let prompt = `Shall I pick ${owner} ${description.join(' ')}`
        .replace('pick a character', 'pick character');
    // Native s_suffix() uses a bare apostrophe after s; this one combined
    // role name has an explicit exception in build_plselection_prompt().
    prompt += /s$/i.test(prompt) && !prompt.endsWith('Priest/Priestess') ? "'" : "'s";

    if (!missing.size) {
        if (!role && !random.has('role')) missing.add('role');
        if (!race && !random.has('race')) missing.add('race');
        if (!gender && !random.has('gender')) missing.add('gender');
        if (!alignment && !random.has('alignment')) missing.add('alignment');
    }
    const facetOrder: readonly CharacterFacet[] = ['race', 'role', 'gender', 'alignment'];
    const facets = facetOrder.filter(facet => missing.has(facet));
    const last = facets.at(-1);
    if (facets.length > 1)
        prompt += ` ${facets.slice(0, -1).join(', ')} and ${last ?? ''}`;
    else if (last) prompt += ` ${last}`;
    return `${prompt} for you? [ynaq]`;
}

export function validCharacterChoice(
    role: RoleChoice, race: RaceChoice, gender: GenderChoice, alignment: AlignmentChoice,
): boolean {
    return !!role && (!race || validCharacterRace(role, race, alignment))
        && (!gender || validCharacterGender(role, gender))
        && (!alignment || validCharacterAlignment(role, race, alignment));
}

// Native ok_race(), ok_gend(), and ok_align() check only the constraints
// belonging to that facet. An incompatible alignment must not erase a
// valid gender or prevent the user from choosing a race first.
export function validCharacterRace(role: RoleChoice, race: Race, alignment: AlignmentChoice): boolean {
    return (!role || ROLE_SELECTION_RULES[role.key].races.includes(race.name))
        && (!alignment || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}

export function validCharacterGender(role: RoleChoice, gender: Gender): boolean {
    const permitted = role && ROLE_SELECTION_RULES[role.key].genders;
    return !permitted || permitted.includes(gender.name);
}

export function validCharacterAlignment(role: RoleChoice, race: RaceChoice, alignment: Alignment): boolean {
    return (!role || ROLE_SELECTION_RULES[role.key].aligns.includes(alignment.name))
        && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
}

export function hasCharacterCompletion(
    role: RoleChoice, race: RaceChoice, gender: GenderChoice, alignment: AlignmentChoice,
): boolean {
    return races.some(candidateRace => (race ? candidateRace === race : true)
        && genders.some(candidateGender => (gender ? candidateGender === gender : true)
            && aligns.some(candidateAlignment => (alignment ? candidateAlignment === alignment : true)
                && validCharacterChoice(
                    role, candidateRace, candidateGender, candidateAlignment,
                ))));
}

export function pickCharacterChoice<T>(choices: readonly T[]): T | null {
    return choices.length ? choices[rn2(choices.length)] ?? null : null;
}

export function nativeRoleChoices(): Role[] {
    return CHARACTER_ROLE_ORDER.flatMap(key => {
        const role = roles.find(candidate => candidate.key === key);
        return role ? [role] : [];
    });
}

// role.c:rigid_role_checks(). Explicit random choices run in role, race,
// alignment, gender order. Unspecified facets roll only when forced.
export function rigidCharacterChecks(initial: CharacterChoices, random: ReadonlySet<CharacterFacet>): CharacterChoices {
    let { role, race, gender, alignment } = initial;
    if (random.has('role')) {
        const candidates = nativeRoleChoices().filter(candidate =>
            hasCharacterCompletion(candidate, race, gender, alignment));
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
            if (candidates.length === 1) race = pickCharacterChoice(candidates);
        }
        if (!alignment && !random.has('alignment')) {
            const candidates = aligns.filter(candidate => validCharacterAlignment(role, race, candidate));
            if (candidates.length === 1) alignment = pickCharacterChoice(candidates);
        }
        if (!gender && !random.has('gender')) {
            const candidates = genders.filter(candidate => validCharacterGender(role, candidate));
            if (candidates.length === 1) gender = pickCharacterChoice(candidates);
        }
    }
    return { role, race, gender, alignment };
}

