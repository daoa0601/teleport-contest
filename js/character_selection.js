// C role.c: genl_player_setup(), plsel_startmenu(), and setup_*menu().
import { NHW_MENU, PICK_ONE, MENU_ITEMFLAGS_SELECTED } from './const.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { rn2 } from './rng.js';
import { NO_COLOR } from './terminal.js';
import { withIndefiniteArticle } from './objnam.js';
import { rawPrint } from './pline.js';
import { RACE_SELECTION_RULES, ROLE_SELECTION_RULES, aligns, build_plselection_prompt, createCharacterFilters, genders, gotrolefilter, nativeRoleChoices, ok_align, ok_gend, ok_race, ok_role, races, randomCharacterOption, reset_role_filtering, roles, str2align, str2gend, str2race, str2role, } from './roles.js';
import { tty_create_nhwindow, tty_add_menu, tty_end_menu, tty_select_menu, tty_destroy_nhwindow } from './tty_menu.js';
const FACETS = ['role', 'race', 'gender', 'alignment'];
const ROUTE_KEYS = { role: '?', race: '/', gender: '"', alignment: '[' };
const TITLES = {
    role: 'Pick a role or profession', race: 'Pick a race or species',
    gender: 'Pick a gender or sex', alignment: 'Pick an alignment or creed',
};
const EMPTY_CHOICES = { role: null, race: null, gender: null, alignment: null };
// C role.c:genl_player_selection(): run the selection once and quit the
// game when the player cancels it; genl_player_setup(): its menu loop is
// the CharacterSelection class below.
export async function selectCharacter(options, readName) {
    return new CharacterSelection(options, readName).choose();
}
class CharacterSelection {
    readName;
    choices;
    random = new Set();
    filters;
    name = game.plname;
    constructor(options, readName) {
        this.readName = readName;
        this.filters = options.characterFilters ?? createCharacterFilters();
        this.choices = {
            role: str2role(options.role) ?? null,
            race: str2race(options.race) ?? null,
            gender: str2gend(options.gender) ?? null,
            alignment: str2align(options.align) ?? null,
        };
        for (const facet of FACETS) {
            const value = facet === 'alignment' ? options.align : options[facet];
            if (!this.choices[facet] && value
                && randomCharacterOption(value))
                this.random.add(facet);
        }
    }
    // C role.c:genl_player_setup(): the selection loop's guts — the
    // pick-for-you question, the facet menus, and the confirmation.
    async choose() {
        const pickSomething = FACETS.some(facet => !this.choices[facet] && !this.random.has(facet));
        if (FACETS.some(facet => !this.choices[facet]))
            game._characterPickerUsed = true;
        this.rigidChecks();
        let pickForYou = 'n';
        if (FACETS.some(facet => !this.choices[facet] && !this.random.has(facet))) {
            const question = build_plselection_prompt(this.choices, this.random, this.filters);
            for (;;) {
                pickForYou = (await readSetupAnswer(question)).toLowerCase();
                if (pickForYou === 'q' || pickForYou === '\x1b')
                    return null;
                if (' \n\r'.includes(pickForYou))
                    pickForYou = 'y';
                if (pickForYou === '*' || pickForYou === '@')
                    pickForYou = 'a';
                if ('yna'.includes(pickForYou))
                    break;
            }
        }
        for (;;) {
            let next = 'role';
            let completed = false;
            do {
                const facet = next;
                next = this.nextFacet(facet);
                completed = facet === 'alignment';
                if (this.validCurrentFacet(facet))
                    continue;
                if (pickForYou === 'y' || pickForYou === 'a' || this.random.has(facet)) {
                    // genl_player_setup() runs before the game windows
                    // exist, so pline() uses nonblocking raw_print().
                    if (this.candidates(facet).length === 0)
                        rawPrint(`Incompatible ${facet}!`);
                    this.pickRandom(facet);
                    continue;
                }
                let count = this.candidates(facet).length;
                if (count === 0)
                    count = this.fallbackCandidates(facet).length;
                if (facet !== 'role' && count <= 1) {
                    this.pickSoleOrFallback(facet);
                    continue;
                }
                // plsel_startmenu() may resolve facets before setup_*menu()
                // builds its entries, including the rn2(1) for a rigid pick.
                const excess = facet === 'role' ? this.roleMenuExcess() : 0;
                this.rigidChecks();
                const key = await this.facetMenu(facet, excess);
                if (key === 'quit')
                    return null;
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
                }
                else if (key === 'random')
                    this.pickRandom(facet);
                else
                    this.setFacet(facet, key);
            } while (!completed || FACETS.some(facet => !this.choices[facet]));
            if (!pickSomething || pickForYou === 'a')
                return this.result();
            for (;;) {
                this.rigidChecks();
                const window = this.startMenu();
                addChoice(window, 'yes', 'y', 'Yes; start game', true);
                addChoice(window, 'again', 'n', 'No; choose role again');
                if (game.iflags.renameallowed)
                    addChoice(window, 'rename', 'a', 'Not yet; choose another name');
                addChoice(window, 'quit', 'q', 'Quit');
                const answer = await finishMenu(window, `Is this ok? [yn${game.iflags.renameallowed ? 'a' : ''}q]`, 'yes');
                if (answer === 'quit')
                    return null;
                if (answer === 'yes')
                    return this.result();
                if (answer === 'rename') {
                    for (;;) {
                        const renamed = await this.readName();
                        // tty_askname() gave up; the game ends with the player.
                        if (renamed === null)
                            return null;
                        this.name = renamed.name;
                        if (this.name)
                            break;
                    }
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
    result() {
        const { role, race, gender, alignment } = this.choices;
        if (!role || !race || !gender || !alignment)
            throw new Error('Character selection has unresolved facets');
        return { role, race, gender, alignment, name: this.name };
    }
    nextFacet(facet) {
        const { role, race } = this.choices;
        switch (facet) {
            case 'role': return 'race';
            case 'race': return role ? 'gender' : 'role';
            case 'gender': return !role ? 'role' : !race ? 'race' : 'alignment';
            case 'alignment': return !role ? 'role' : !race ? 'race' : 'gender';
        }
    }
    validCurrentFacet(facet) {
        const { role, race, gender, alignment } = this.choices;
        switch (facet) {
            case 'role': return !!role;
            case 'race': return !!race && (!role || ROLE_SELECTION_RULES[role.key].races.includes(race.name));
            case 'gender': return !!gender && (!role || this.roleAllowsGender(role, gender));
            case 'alignment': return !!alignment && (!role || ROLE_SELECTION_RULES[role.key].aligns.includes(alignment.name))
                && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(alignment.name));
        }
    }
    clearFacet(facet) {
        this.random.delete(facet);
        switch (facet) {
            case 'role':
                this.choices.role = null;
                break;
            case 'race':
                this.choices.race = null;
                break;
            case 'gender':
                this.choices.gender = null;
                break;
            case 'alignment':
                this.choices.alignment = null;
                break;
        }
    }
    setFacet(facet, key) {
        switch (facet) {
            case 'role':
                this.choices.role = roles.find(role => role.key === key) ?? null;
                break;
            case 'race':
                this.choices.race = races.find(race => race.name === key) ?? null;
                break;
            case 'gender':
                this.choices.gender = genders.find(gender => gender.name === key) ?? null;
                break;
            case 'alignment':
                this.choices.alignment = aligns.find(alignment => alignment.name === key) ?? null;
                break;
        }
        if (this.choices[facet])
            this.random.delete(facet);
    }
    // C role.c:rigid_role_checks(): resolve ROLE_RANDOM facets before the
    // rigid picks. pick_role(), pick_race(), pick_gend(), and pick_align()
    // are the per-facet PICK_RANDOM/PICK_RIGID draws through pickRandom()
    // and the sole-candidate branch below; randrole_filtered() is the
    // honor-the-filters role fallback, whose tail is randrole().
    rigidChecks() {
        // role.c resolves explicitly random facets before its rigid picks.
        for (const facet of ['role', 'race', 'alignment', 'gender']) {
            if (!this.random.has(facet))
                continue;
            // A conflicting configured facet can leave pick_*() with no
            // candidates. Keep ROLE_RANDOM until makepicks corrects it.
            if (facet !== 'role' && this.candidates(facet).length === 0)
                continue;
            if (facet === 'role' && this.candidates(facet).length === 0) {
                // randrole_filtered() drops incompatible choices but keeps
                // each exclusion when an explicitly random role cannot fit.
                const permitted = this.roleCandidates(EMPTY_CHOICES);
                const candidates = permitted.length ? permitted : this.fallbackCandidates('role');
                const key = candidates[rn2(candidates.length)];
                if (key)
                    this.setFacet('role', key);
                continue;
            }
            this.pickRandom(facet);
        }
        if (!this.choices.role)
            return;
        for (const facet of ['race', 'alignment', 'gender']) {
            if (this.choices[facet] || this.random.has(facet))
                continue;
            const candidates = this.candidates(facet);
            if (candidates.length === 1) {
                const key = candidates[rn2(1)];
                if (key)
                    this.setFacet(facet, key);
            }
        }
    }
    // C role.c:pick_role(): the PICK_RANDOM draw over candidates(), whose
    // filter loop is the ok_role()/ok_race()/ok_gend()/ok_align()
    // conjunction; pick_race(), pick_gend(), and pick_align() share it.
    // randrole(), randrace(), randgend(), and randalign() are the same
    // draw with no constraints (randrace() scales only the fallback), and
    // randrole_filtered() honors the filter masks first.
    pickRandom(facet) {
        let candidates = this.candidates(facet);
        const fallback = candidates.length === 0;
        if (fallback)
            candidates = this.fallbackCandidates(facet);
        // Native randrace() scales by 100 only for the incompatible fallback.
        const index = fallback && facet === 'race'
            ? Math.floor(rn2(candidates.length * 100) / 100) : rn2(candidates.length);
        const key = candidates[index];
        if (!key)
            throw new Error(`No permitted ${facet} for character selection`);
        this.setFacet(facet, key);
    }
    pickSoleOrFallback(facet) {
        const candidates = this.candidates(facet);
        const key = (candidates.length ? candidates : this.fallbackCandidates(facet)).at(-1);
        if (key) {
            this.setFacet(facet, key);
            return;
        }
        throw new Error(`No permitted ${facet} for character selection`);
    }
    fallbackCandidates(facet) {
        const { role, race } = this.choices;
        switch (facet) {
            case 'role': return nativeRoleChoices().map(role => role.key);
            case 'race': return races.filter(candidate => !role
                || ROLE_SELECTION_RULES[role.key].races.includes(candidate.name)).map(candidate => candidate.name);
            case 'gender': return genders.filter(candidate => !role
                || this.roleAllowsGender(role, candidate)).map(candidate => candidate.name);
            case 'alignment': return aligns.filter(candidate => (!role
                || ROLE_SELECTION_RULES[role.key].aligns.includes(candidate.name))
                && (!race || RACE_SELECTION_RULES[race.name].aligns.includes(candidate.name))).map(candidate => candidate.name);
        }
    }
    roleAllowsGender(role, gender) {
        return ROLE_SELECTION_RULES[role.key].genders?.includes(gender.name) ?? true;
    }
    candidates(facet, menu = false) {
        const c = this.choices;
        switch (facet) {
            case 'role': return this.roleCandidates(c);
            case 'race': return races.filter(race => {
                const choice = { ...c, race };
                return ok_race(choice, this.filters) && (!menu
                    || ok_role(choice, this.filters) && ok_align(choice, this.filters));
            }).map(race => race.name);
            case 'gender': return genders.filter(gender => {
                const choice = { ...c, gender };
                return ok_gend(choice, this.filters) && (!menu
                    || ok_role(choice, this.filters) && ok_race(choice, this.filters));
            }).map(gender => gender.name);
            case 'alignment': return aligns.filter(alignment => {
                const choice = { ...c, alignment };
                return ok_align(choice, this.filters) && (!menu
                    || ok_role(choice, this.filters) && ok_race(choice, this.filters));
            }).map(alignment => alignment.name);
        }
    }
    roleCandidates(choices) {
        return nativeRoleChoices().filter(role => {
            const choice = { ...choices, role };
            return ok_role(choice, this.filters) && ok_race(choice, this.filters)
                && ok_gend(choice, this.filters) && ok_align(choice, this.filters);
        }).map(role => role.key);
    }
    roleName(role, gender, combined = false) {
        if (gender?.value === 1)
            return role.name.f;
        if (!gender && combined && role.name.f !== role.name.m)
            return `${role.name.m}/${role.name.f}`;
        return role.name.m;
    }
    summary() {
        const { role, race, gender, alignment } = this.choices;
        const roleName = role ? this.roleName(role, gender) : '<role>';
        const short = (value) => value.slice(0, 20);
        if (this.name && role && race && gender && alignment)
            return [this.name, 'the', alignment.name, gender.name, race.adj, roleName].map(short).join(' ');
        return [roleName, race?.noun ?? '<race>', gender?.name ?? '<gender>',
            alignment?.name ?? '<alignment>'].map(short).join(' ');
    }
    // C role.c:plsel_startmenu(): open the facet menu with the header line
    // of aspects chosen so far; summary() is that line, after
    // C role.c:rigid_role_checks() has narrowed the forced facets, and the
    // second C role.c:maybe_skip_seps() call drops the header separator.
    startMenu(excess = 0) {
        const window = tty_create_nhwindow(NHW_MENU);
        addText(window, this.summary());
        if (excess !== 2)
            addText(window, '');
        return window;
    }
    // C role.c:maybe_skip_seps(): the excess-line count (four header lines,
    // one per permitted role, random plus separator, five footers) whose
    // one-or-two surplus drops the menu separators.
    roleMenuExcess() {
        const count = this.candidates('role').length + 12;
        const rows = game.nhDisplay?.rows ?? 24;
        return Math.max(0, count - rows);
    }
    // C role.c:role_menu_extra(): the forced-value line naming what
    // constrains the facet, and the RS_menu_let routes offered as
    // "pick <facet> first"; ROUTE_KEYS holds those letters.
    async facetMenu(facet, excess) {
        // plsel_startmenu() measures after rigid checks; the Random separator
        // below uses the role count from before those checks.
        const window = this.startMenu(facet === 'role' ? this.roleMenuExcess() : 0);
        this.addFacetChoices(window, facet);
        addChoice(window, 'random', '*', 'Random', true);
        if (facet !== 'role' || excess < 1 || excess > 2)
            addText(window, '');
        for (const other of FACETS) {
            if (other === facet)
                continue;
            const forced = this.forcedRoute(other);
            if (forced)
                addText(window, `    ${forced}`);
            else
                addChoice(window, `pick-${other}`, ROUTE_KEYS[other], `Pick${this.choices[other] ? ' another' : ''} ${other} first`);
        }
        addChoice(window, 'filter', '~', `${gotrolefilter(this.filters) ? 'Reset' : 'Set'} role/race/&c filtering`);
        addChoice(window, 'quit', 'q', 'Quit');
        return finishMenu(window, TITLES[facet], 'random');
    }
    // C role.c:setup_rolemenu(), setup_racemenu(), setup_gendmenu(), and
    // setup_algnmenu(): the selection-menu variant; the filter-reset
    // variant is editCharacterFilters.
    addFacetChoices(window, facet) {
        let previous = '';
        for (const key of this.candidates(facet, true)) {
            let selector = key.charAt(0);
            let text = key;
            if (facet === 'role') {
                const role = roles.find(candidate => candidate.key === key);
                if (!role)
                    continue;
                if (selector === previous)
                    selector = selector.toUpperCase();
                previous = selector;
                text = withIndefiniteArticle(this.roleName(role, this.choices.gender, true));
            }
            tty_add_menu(window, {
                identifier: key, selector,
                group: facet !== 'role' ? selector.toUpperCase() : '', text,
            });
        }
    }
    forcedRoute(facet) {
        const { role, race, gender, alignment } = this.choices;
        const rules = role && ROLE_SELECTION_RULES[role.key];
        switch (facet) {
            case 'role':
                return nativeRoleChoices().every(candidate => candidate === role || this.filters.roles.has(candidate.key))
                    ? 'filter forces role' : null;
            case 'race':
                if (rules?.races.length === 1)
                    return `role forces ${rules.races[0]}`;
                if (rules && race && this.filterForces(rules.races, race.name, this.filters.races))
                    return 'filter forces race';
                return null;
            case 'gender':
                if (rules?.genders?.length === 1)
                    return `role forces ${rules.genders[0]}`;
                if (role && gender && this.filterForces(genders.map(candidate => candidate.name), gender.name, this.filters.genders))
                    return 'filter forces gender';
                return null;
            case 'alignment':
                if (rules?.aligns.length === 1)
                    return `role forces ${rules.aligns[0]}`;
                if (race && RACE_SELECTION_RULES[race.name].aligns.length === 1)
                    return `race forces ${RACE_SELECTION_RULES[race.name].aligns[0]}`;
                if (alignment && this.filterForces(aligns.map(candidate => candidate.name), alignment.name, this.filters.alignments))
                    return 'filter forces alignment';
                return null;
        }
    }
    filterForces(keys, selected, excluded) {
        const remaining = keys.filter(key => !excluded.has(key));
        return remaining.length === 1 && remaining[0] === selected;
    }
    async editFilters() {
        const result = await reset_role_filtering(this.filters);
        if (result !== 'cancelled') {
            this.choices = { ...EMPTY_CHOICES };
            this.random.clear();
        }
        return result === 'filtered';
    }
}
async function readSetupAnswer(question) {
    const display = game.nhDisplay;
    if (!display)
        throw new Error('Character selection needs a display');
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
        for (let row = 0; row * width < text.length; row++)
            display.clearRow(row);
    }
    return String.fromCharCode(answer);
}
function addText(window, text) {
    tty_add_menu(window, { identifier: null, text });
}
function addChoice(window, identifier, selector, text, selected = false) {
    tty_add_menu(window, { identifier, selector, text, itemflags: selected ? MENU_ITEMFLAGS_SELECTED : 0 });
}
async function finishMenu(window, title, defaultChoice) {
    tty_end_menu(window, title);
    const result = await tty_select_menu(window, PICK_ONE, true);
    await tty_destroy_nhwindow(window);
    if (result.cancelled)
        return 'quit';
    // Explicitly toggling the preselected row off still chooses its default.
    // A different choice is returned alongside the preselected row by tty.
    return result.selections.find(item => item.identifier !== defaultChoice)?.identifier
        ?? result.selections[0]?.identifier ?? defaultChoice;
}
//# sourceMappingURL=character_selection.js.map