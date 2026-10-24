// C role.c:reset_role_filtering() and its four setup_*menu() helpers.
import { MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_ANY } from './const.js';
import { nativeRoleChoices, validCharacterAlignment, validCharacterGender, validCharacterRace, } from './character_choices.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { aligns, genders, races } from './roles.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
export function createCharacterFilters() {
    return { roles: new Set(), races: new Set(), genders: new Set(), alignments: new Set() };
}
export function hasCharacterFilters(filters) {
    return !!(filters.roles.size || filters.races.size || filters.genders.size || filters.alignments.size);
}
// role.c:ok_role(), ok_race(), and ok_align() each consult only their own
// filters and constraints. Menu builders combine the predicates they need.
export function characterRoleAllowed(filters, choices) {
    const { role, race, gender, alignment } = choices;
    return (role ? [role] : nativeRoleChoices()).some(candidate => !filters.roles.has(candidate.key)
        && (!race || validCharacterRace(candidate, race, null))
        && (!gender || validCharacterGender(candidate, gender))
        && (!alignment || validCharacterAlignment(candidate, null, alignment)));
}
export function characterRaceAllowed(filters, choices) {
    const { role, race, alignment } = choices;
    return (race ? [race] : races).some(candidate => !filters.races.has(candidate.name) && validCharacterRace(role, candidate, alignment));
}
export function characterAlignmentAllowed(filters, choices) {
    const { role, race, alignment } = choices;
    return (alignment ? [alignment] : aligns).some(candidate => !filters.alignments.has(candidate.name) && validCharacterAlignment(role, race, candidate));
}
export async function editCharacterFilters(filters) {
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        tty_add_menu(window, { identifier: null, text: 'Unacceptable roles' });
        let previousKey = '';
        for (const role of nativeRoleChoices()) {
            const first = role.name.m.charAt(0).toLowerCase();
            const key = first === previousKey ? first.toUpperCase() : first;
            previousKey = key;
            const name = role.name.m === role.name.f ? role.name.m : `${role.name.m}/${role.name.f}`;
            tty_add_menu(window, {
                identifier: { facet: 'role', value: role.key }, selector: key,
                text: withIndefiniteArticle(name),
                itemflags: filters.roles.has(role.key) ? MENU_ITEMFLAGS_SELECTED : 0,
            });
        }
        tty_add_menu(window, { identifier: null, text: '' });
        tty_add_menu(window, { identifier: null, text: 'Unacceptable races' });
        for (const race of races) {
            tty_add_menu(window, {
                identifier: { facet: 'race', value: race.name }, selector: race.name.charAt(0).toUpperCase(),
                text: race.name, itemflags: filters.races.has(race.name) ? MENU_ITEMFLAGS_SELECTED : 0,
            });
        }
        tty_add_menu(window, { identifier: null, text: '' });
        tty_add_menu(window, { identifier: null, text: 'Unacceptable genders' });
        for (const gender of genders) {
            tty_add_menu(window, {
                identifier: { facet: 'gender', value: gender.name }, selector: gender.name.charAt(0).toUpperCase(),
                text: gender.name, itemflags: filters.genders.has(gender.name) ? MENU_ITEMFLAGS_SELECTED : 0,
            });
        }
        tty_add_menu(window, { identifier: null, text: '' });
        tty_add_menu(window, { identifier: null, text: 'Unacceptable alignments' });
        for (const alignment of aligns) {
            tty_add_menu(window, {
                identifier: { facet: 'alignment', value: alignment.name }, selector: alignment.name.charAt(0).toUpperCase(),
                text: alignment.name, itemflags: filters.alignments.has(alignment.name) ? MENU_ITEMFLAGS_SELECTED : 0,
            });
        }
        tty_end_menu(window, `Pick all that apply${hasCharacterFilters(filters) ? ' and/or unpick any that no longer apply' : ''}`);
        const result = await tty_select_menu(window, PICK_ANY);
        if (result.cancelled)
            return 'cancelled';
        filters.roles.clear();
        filters.races.clear();
        filters.genders.clear();
        filters.alignments.clear();
        for (const { identifier } of result.selections) {
            switch (identifier.facet) {
                case 'role':
                    filters.roles.add(identifier.value);
                    break;
                case 'race':
                    filters.races.add(identifier.value);
                    break;
                case 'gender':
                    filters.genders.add(identifier.value);
                    break;
                case 'alignment':
                    filters.alignments.add(identifier.value);
                    break;
            }
        }
        return result.selections.length ? 'filtered' : 'empty';
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
}
//# sourceMappingURL=character_filters.js.map