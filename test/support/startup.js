import { requireInitializedHero } from '../../js/hero_types.js';
import { resetGame } from '../../js/gstate.js';
import { init_objects } from '../../js/o_init.js';
import { initRng } from '../../js/rng.js';
import { aligns, races, roles } from '../../js/roles.js';
import { DEFAULT_TEST_DATETIME } from './calendar.js';
import { finishStartingDiscoveries, uInitInventoryAttrs, uInitMisc, } from '../../js/u_init.js';
function namedEntry(entries, requested, kind) {
    if (typeof requested === 'object')
        return requested;
    const entry = entries.find(candidate => (candidate.key === requested || candidate.name === requested));
    if (!entry)
        throw new Error(`Unknown ${kind}: ${requested}`);
    return entry;
}
export function prepareHeroStartup({ role, datetime = DEFAULT_TEST_DATETIME, race = 'human', alignment = 'chaotic', flags = {}, seed = 123n, }) {
    const state = resetGame();
    state.datetime = datetime;
    const selectedRole = namedEntry(roles, role, 'role');
    const selectedRace = namedEntry(races, race, 'race');
    const selectedAlignment = namedEntry(aligns, alignment, 'alignment');
    state.urole = selectedRole;
    state.urace = selectedRace;
    state.initAlignment = selectedAlignment;
    state.flags = { ...flags };
    initRng(seed);
    init_objects();
    uInitMisc(1);
    return state;
}
export async function completeHeroStartup(options) {
    const state = prepareHeroStartup(options);
    if (!await uInitInventoryAttrs())
        throw new Error('Hero inventory setup failed');
    if (!await finishStartingDiscoveries())
        throw new Error('Hero discovery setup failed');
    requireInitializedHero(state.u);
    return state;
}
//# sourceMappingURL=startup.js.map