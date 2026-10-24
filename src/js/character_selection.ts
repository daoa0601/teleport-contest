// C role.c: genl_player_setup(), plsel_startmenu(), and setup_*menu().
import { NHW_MENU, PICK_ONE, MENU_ITEMFLAGS_SELECTED } from './const.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { rn2 } from './rng.js';
import { NO_COLOR } from './terminal.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { pline } from './display.js';
import { findRole, findRace, findGender, findAlignment, randomCharacterOption, roles, races, genders, aligns } from './roles.js';
import type { Role, Race, Gender, Alignment } from './roles.js';
import type { ParsedCharacterName } from './character_name.js';
import { characterSelectionQuestion, nativeRoleChoices, ROLE_SELECTION_RULES as ROLE_RULES,
    RACE_SELECTION_RULES } from './character_choices.js';
import type { CharacterChoices as Choices, CharacterFacet as Facet, GenderChoice } from './character_choices.js';
import { characterRoleAllowed, characterRaceAllowed, characterGenderAllowed, characterAlignmentAllowed,
    createCharacterFilters, editCharacterFilters, hasCharacterFilters } from './character_filters.js';
import type { CharacterFilters } from './character_filters.js';
import { tty_create_nhwindow, tty_add_menu, tty_end_menu, tty_select_menu,
    tty_destroy_nhwindow } from './tty_menu.js';
import type { TtyMenuWindow } from './tty_menu.js';

export interface CharacterOptions {
    role: string | null;
    race: string | null;
    gender: string | null;
    align: string | null;
    characterFilters?: CharacterFilters;
}
export interface SelectedCharacter {
    role: Role;
    race: Race;
    gender: Gender;
    alignment: Alignment;
    name: string;
}
const FACETS: readonly Facet[] = ['role', 'race', 'gender', 'alignment'];
const ROUTE_KEYS: Record<Facet, string> = { role: '?', race: '/', gender: '"', alignment: '[' };
const TITLES: Record<Facet, string> = {
    role: 'Pick a role or profession', race: 'Pick a race or species',
    gender: 'Pick a gender or sex', alignment: 'Pick an alignment or creed',
};
const EMPTY_CHOICES: Choices = { role: null, race: null, gender: null, alignment: null };

export async function selectCharacter(options: CharacterOptions,
    readName: () => Promise<ParsedCharacterName>): Promise<SelectedCharacter | null> {
    return new CharacterSelection(options, readName).choose();
}

class CharacterSelection {
    private choices: Choices;
    private readonly random = new Set<Facet>();
    private readonly filters: CharacterFilters;
    private name = game.plname;

    constructor(options: CharacterOptions, private readonly readName: () => Promise<ParsedCharacterName>) {
        this.filters = options.characterFilters ?? createCharacterFilters();
        this.choices = {
            role: findRole(options.role) ?? null,
            race: findRace(options.race) ?? null,
            gender: findGender(options.gender) ?? null,
            alignment: findAlignment(options.align) ?? null,
        };
        for (const facet of FACETS) {
            const value = facet === 'alignment' ? options.align : options[facet];
            if (!this.choices[facet] && value
                && randomCharacterOption(value))
                this.random.add(facet);
        }
    }

    async choose(): Promise<SelectedCharacter | null> {
        const pickSomething = FACETS.some(facet => !this.choices[facet] && !this.random.has(facet));
        if (FACETS.some(facet => !this.choices[facet])) game._characterPickerUsed = true;
        this.rigidChecks();
        let pickForYou = 'n';
        if (FACETS.some(facet => !this.choices[facet] && !this.random.has(facet))) {
            const question = this.selectionQuestion();
            for (;;) {
                pickForYou = (await readSetupAnswer(question)).toLowerCase();
                if (pickForYou === 'q' || pickForYou === '\x1b') return null;
                if (' \n\r'.includes(pickForYou)) pickForYou = 'y';
                if (pickForYou === '*' || pickForYou === '@') pickForYou = 'a';
                if ('yna'.includes(pickForYou)) break;
            }
        }

        for (;;) {
            let next: Facet = 'role';
            let completed = false;
            do {
                const facet: Facet = next;
                next = this.nextFacet(facet);
                completed = facet === 'alignment';
                if (this.validCurrentFacet(facet)) continue;
                if (pickForYou === 'y' || pickForYou === 'a' || this.random.has(facet)) {
                    if (this.candidates(facet).length === 0)
                        await pline(`Incompatible ${facet}!`);
                    this.pickRandom(facet);
                    continue;
                }
                let count = this.candidates(facet).length;
                if (count === 0) count = this.fallbackCandidates(facet).length;
                if (facet !== 'role' && count <= 1) {
                    this.pickSoleOrFallback(facet);
                    continue;
                }

                // plsel_startmenu() may resolve facets before setup_*menu()
                // builds its entries, including the rn2(1) for a rigid pick.
                const excess = facet === 'role' ? this.roleMenuExcess() : 0;
                this.rigidChecks();
                const key = await this.facetMenu(facet, excess);
                if (key === 'quit') return null;
                if (key === 'filter') {
                    this.clearFacet(facet);
                    const selectedFilters = await this.editFilters();
                    next = facet === 'role' || selectedFilters ? 'role' : facet;
                    continue;
                }
                const route = FACETS.find(candidate => key === `pick-${candidate}`);
                if (route) {
                    this.clearFacet(facet);
                    this.clearFacet(route);
                    next = route;
                } else if (key === 'random') this.pickRandom(facet);
                else this.setFacet(facet, key);
            } while (!completed || FACETS.some(facet => !this.choices[facet]));

            if (!pickSomething || pickForYou === 'a') return this.result();
            for (;;) {
                this.rigidChecks();
                const window = this.startMenu();
                addChoice(window, 'yes', 'y', 'Yes; start game', true);
                addChoice(window, 'again', 'n', 'No; choose role again');
                addChoice(window, 'rename', 'a', 'Not yet; choose another name');
                addChoice(window, 'quit', 'q', 'Quit');
                const answer = await finishMenu(window, 'Is this ok? [ynaq]', 'yes');
                if (answer === 'quit') return null;
                if (answer === 'yes') return this.result();
                if (answer === 'rename') {
                    do {
                        this.name = (await this.readName()).name;
                    } while (!this.name);
                    game.plname = this.name;
                    continue;
                }
                pickForYou = 'n';
                this.choices = { ...EMPTY_CHOICES };
                this.random.clear();
                break;
            }
        }
    }

    private result(): SelectedCharacter {
        const { role, race, gender, alignment } = this.choices;
        if (!role || !race || !gender || !alignment)
            throw new Error('Character selection has unresolved facets');
        return { role, race, gender, alignment, name: this.name };
    }

    private nextFacet(facet: Facet): Facet {
        const { role, race } = this.choices;
        switch (facet) {
        case 'role': return 'race';
        case 'race': return role ? 'gender' : 'role';
        case 'gender': return !role ? 'role' : !race ? 'race' : 'alignment';
        case 'alignment': return !role ? 'role' : !race ? 'race' : 'gender';
        }
    }

    private validCurrentFacet(facet: Facet): boolean {
        const { role, race, gender, alignment } = this.choices;
        switch (facet) {
        case 'role': return !!role;
        case 'race': return !!race && (!role || ROLE_RULES[role.key].races.includes(race.name));
        case 'gender': return !!gender && (!role || this.roleAllowsGender(role, gender));
        case 'alignment': return !!alignment && (!role || ROLE_RULES[role.key].aligns.includes(alignment.name))
            && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
        }
    }

    private clearFacet(facet: Facet): void {
        this.random.delete(facet);
        switch (facet) {
        case 'role': this.choices.role = null; break;
        case 'race': this.choices.race = null; break;
        case 'gender': this.choices.gender = null; break;
        case 'alignment': this.choices.alignment = null; break;
        }
    }

    private setFacet(facet: Facet, key: string): void {
        switch (facet) {
        case 'role': this.choices.role = roles.find(role => role.key === key) ?? null; break;
        case 'race': this.choices.race = races.find(race => race.name === key) ?? null; break;
        case 'gender': this.choices.gender = genders.find(gender => gender.name === key) ?? null; break;
        case 'alignment': this.choices.alignment = aligns.find(alignment => alignment.name === key) ?? null; break;
        }
        if (this.choices[facet]) this.random.delete(facet);
    }

    private rigidChecks(): void {
        // role.c resolves explicitly random facets before its rigid picks.
        for (const facet of ['role', 'race', 'alignment', 'gender'] satisfies Facet[]) {
            if (!this.random.has(facet)) continue;
            // A conflicting configured facet can leave pick_*() with no
            // candidates. Keep ROLE_RANDOM until makepicks corrects it.
            if (facet !== 'role' && this.candidates(facet).length === 0) continue;
            if (facet === 'role' && this.candidates(facet).length === 0) {
                // randrole_filtered() drops incompatible choices but keeps
                // each exclusion when an explicitly random role cannot fit.
                const permitted = this.roleCandidates(EMPTY_CHOICES);
                const candidates = permitted.length ? permitted : this.fallbackCandidates('role');
                const key = candidates[rn2(candidates.length)];
                if (key) this.setFacet('role', key);
                continue;
            }
            this.pickRandom(facet);
        }
        if (!this.choices.role) return;
        for (const facet of ['race', 'alignment', 'gender'] satisfies Facet[]) {
            if (this.choices[facet] || this.random.has(facet)) continue;
            const candidates = this.candidates(facet);
            if (candidates.length === 1) {
                const key = candidates[rn2(1)];
                if (key) this.setFacet(facet, key);
            }
        }
    }

    private pickRandom(facet: Facet): void {
        let candidates = this.candidates(facet);
        const fallback = candidates.length === 0;
        if (fallback) candidates = this.fallbackCandidates(facet);
        // Native randrace() scales by 100 only for the incompatible fallback.
        const index = fallback && facet === 'race'
            ? Math.floor(rn2(candidates.length * 100) / 100) : rn2(candidates.length);
        const key = candidates[index];
        if (!key) throw new Error(`No permitted ${facet} for character selection`);
        this.setFacet(facet, key);
    }

    private pickSoleOrFallback(facet: Facet): void {
        const candidates = this.candidates(facet);
        const key = (candidates.length ? candidates : this.fallbackCandidates(facet)).at(-1);
        if (key) { this.setFacet(facet, key); return; }
        throw new Error(`No permitted ${facet} for character selection`);
    }

    private fallbackCandidates(facet: Facet): string[] {
        const { role, race } = this.choices;
        switch (facet) {
        case 'role': return nativeRoleChoices().map(role => role.key);
        case 'race': return races.filter(candidate => !role
            || ROLE_RULES[role.key].races.includes(candidate.name)).map(candidate => candidate.name);
        case 'gender': return genders.filter(candidate => !role
            || this.roleAllowsGender(role, candidate)).map(candidate => candidate.name);
        case 'alignment': return aligns.filter(candidate => (!role
            || ROLE_RULES[role.key].aligns.includes(candidate.name))
            && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(candidate.name))).map(candidate => candidate.name);
        }
    }

    private roleAllowsGender(role: Role, gender: Gender): boolean {
        return ROLE_RULES[role.key].genders?.includes(gender.name) ?? true;
    }

    private candidates(facet: Facet, menu = false): string[] {
        const c = this.choices;
        switch (facet) {
        case 'role': return this.roleCandidates(c);
        case 'race': return races.filter(race => {
            const choice = { ...c, race };
            return characterRaceAllowed(this.filters, choice) && (!menu
                || characterRoleAllowed(this.filters, choice) && characterAlignmentAllowed(this.filters, choice));
        }).map(race => race.name);
        case 'gender': return genders.filter(gender => {
            const choice = { ...c, gender };
            return characterGenderAllowed(this.filters, choice) && (!menu
                || characterRoleAllowed(this.filters, choice) && characterRaceAllowed(this.filters, choice));
        }).map(gender => gender.name);
        case 'alignment': return aligns.filter(alignment => {
            const choice = { ...c, alignment };
            return characterAlignmentAllowed(this.filters, choice) && (!menu
                || characterRoleAllowed(this.filters, choice) && characterRaceAllowed(this.filters, choice));
        }).map(alignment => alignment.name);
        }
    }

    private roleCandidates(choices: Choices): string[] {
        return nativeRoleChoices().filter(role => {
            const choice = { ...choices, role };
            return characterRoleAllowed(this.filters, choice) && characterRaceAllowed(this.filters, choice)
                && characterGenderAllowed(this.filters, choice) && characterAlignmentAllowed(this.filters, choice);
        }).map(role => role.key);
    }

    private roleName(role: Role, gender: GenderChoice, combined = false): string {
        if (gender?.value === 1) return role.name.f;
        if (!gender && combined && role.name.f !== role.name.m)
            return `${role.name.m}/${role.name.f}`;
        return role.name.m;
    }

    private summary(): string {
        const { role, race, gender, alignment } = this.choices;
        const roleName = role ? this.roleName(role, gender) : '<role>';
        const short = (value: string) => value.slice(0, 20);
        if (this.name && role && race && gender && alignment)
            return [this.name, 'the', alignment.name, gender.name, race.adj, roleName].map(short).join(' ');
        return [roleName, race?.noun ?? '<race>', gender?.name ?? '<gender>',
            alignment?.name ?? '<alignment>'].map(short).join(' ');
    }

    private startMenu(excess = 0): TtyMenuWindow<string> {
        const window = tty_create_nhwindow<string>(NHW_MENU);
        addText(window, this.summary());
        if (excess !== 2) addText(window, '');
        return window;
    }

    private roleMenuExcess(): number {
        const count = this.candidates('role').length + 12;
        const rows = game.nhDisplay?.rows ?? 24;
        return Math.max(0, count - rows);
    }

    private async facetMenu(facet: Facet, excess: number): Promise<string> {
        // plsel_startmenu() measures after rigid checks; the Random separator
        // below uses the role count from before those checks.
        const window = this.startMenu(facet === 'role' ? this.roleMenuExcess() : 0);
        this.addFacetChoices(window, facet);
        addChoice(window, 'random', '*', 'Random', true);
        if (facet !== 'role' || excess < 1 || excess > 2) addText(window, '');
        for (const other of FACETS) {
            if (other === facet) continue;
            const forced = this.forcedRoute(other);
            if (forced) addText(window, `    ${forced}`);
            else addChoice(window, `pick-${other}`, ROUTE_KEYS[other],
                `Pick${this.choices[other] ? ' another' : ''} ${other} first`);
        }
        addChoice(window, 'filter', '~', `${hasCharacterFilters(this.filters) ? 'Reset' : 'Set'} role/race/&c filtering`);
        addChoice(window, 'quit', 'q', 'Quit');
        return finishMenu(window, TITLES[facet], 'random');
    }

    private addFacetChoices(window: TtyMenuWindow<string>, facet: Facet): void {
        let previous = '';
        for (const key of this.candidates(facet, true)) {
            let selector = key.charAt(0);
            let text = key;
            if (facet === 'role') {
                const role = roles.find(candidate => candidate.key === key);
                if (!role) continue;
                if (selector === previous) selector = selector.toUpperCase();
                previous = selector;
                text = withIndefiniteArticle(this.roleName(role, this.choices.gender, true));
            }
            tty_add_menu(window, {
                identifier: key, selector,
                group: facet !== 'role' ? selector.toUpperCase() : '', text,
            });
        }
    }

    private forcedRoute(facet: Facet): string | null {
        const { role, race, gender, alignment } = this.choices;
        const rules = role && ROLE_RULES[role.key];
        switch (facet) {
        case 'role':
            return nativeRoleChoices().every(candidate => candidate === role || this.filters.roles.has(candidate.key))
                ? 'filter forces role' : null;
        case 'race':
            if (rules?.races.length === 1) return `role forces ${rules.races[0]}`;
            if (rules && race && this.filterForces(rules.races, race.name, this.filters.races))
                return 'filter forces race';
            return null;
        case 'gender':
            if (rules?.genders?.length === 1) return `role forces ${rules.genders[0]}`;
            if (role && gender && this.filterForces(genders.map(candidate => candidate.name), gender.name, this.filters.genders))
                return 'filter forces gender';
            return null;
        case 'alignment':
            if (rules?.aligns.length === 1) return `role forces ${rules.aligns[0]}`;
            if (race && RACE_SELECTION_RULES[race.name].aligns.length === 1) return `race forces ${RACE_SELECTION_RULES[race.name].aligns[0]}`;
            if (alignment && this.filterForces(aligns.map(candidate => candidate.name), alignment.name, this.filters.alignments))
                return 'filter forces alignment';
            return null;
        }
    }

    private filterForces<T extends string>(keys: readonly T[], selected: T, excluded: ReadonlySet<T>): boolean {
        const remaining = keys.filter(key => !excluded.has(key));
        return remaining.length === 1 && remaining[0] === selected;
    }

    private async editFilters(): Promise<boolean> {
        const result = await editCharacterFilters(this.filters);
        if (result !== 'cancelled') {
            this.choices = { ...EMPTY_CHOICES };
            this.random.clear();
        }
        return result === 'filtered';
    }

    private selectionQuestion(): string {
        return characterSelectionQuestion(this.choices, this.random, this.filters);
    }

}

async function readSetupAnswer(question: string): Promise<string> {
    const display = game.nhDisplay;
    if (!display) throw new Error('Character selection needs a display');
    // WIN_MAP does not exist yet. Paint the prompt over the base window
    // without flushing map cells over the name-entry copyright notice.
    const text = question + ' ';
    const width = display.cols - 1;
    for (let row = 0; row * width < text.length; row++) {
        display.clearRow(row);
        display.putstr(0, row, text.slice(row * width, (row + 1) * width), NO_COLOR);
    }
    display.setCursor((text.length - 1) % width + 1, Math.floor((text.length - 1) / width));
    const answer = await nhgetch();
    // tty_yn_function() clears WIN_MESSAGE when its prompt spans rows.
    if (text.length > width) {
        for (let row = 0; row * width < text.length; row++) display.clearRow(row);
    }
    return String.fromCharCode(answer);
}

function addText(window: TtyMenuWindow<string>, text: string): void {
    tty_add_menu(window, { identifier: null, text });
}

function addChoice(window: TtyMenuWindow<string>, identifier: string, selector: string,
    text: string, selected = false): void {
    tty_add_menu(window, { identifier, selector, text, itemflags: selected ? MENU_ITEMFLAGS_SELECTED : 0 });
}

async function finishMenu(window: TtyMenuWindow<string>, title: string, defaultChoice: string): Promise<string> {
    tty_end_menu(window, title);
    const result = await tty_select_menu(window, PICK_ONE, true);
    await tty_destroy_nhwindow(window);
    if (result.cancelled) return 'quit';
    // Explicitly toggling the preselected row off still chooses its default.
    // A different choice is returned alongside the preselected row by tty.
    return result.selections.find(item => item.identifier !== defaultChoice)?.identifier
        ?? result.selections[0]?.identifier ?? defaultChoice;
}
