import { game, resetGame } from '../../js/gstate.js';
import { init_objects } from '../../js/o_init.js';
import { initRng } from '../../js/rng.js';
import { aligns, races, roles } from '../../js/roles.js';
import {
    finishStartingDiscoveries, uInitInventoryAttrs, uInitMisc,
} from '../../js/u_init.js';

function namedEntry(entries, requested, kind) {
    if (typeof requested === 'object' && requested !== null) return requested;
    const entry = entries.find(candidate => (
        candidate.key === requested || candidate.name === requested
    ));
    if (!entry) throw new Error(`Unknown ${kind}: ${requested}`);
    return entry;
}

export function prepareHeroStartup({
    role,
    race = 'human',
    alignment = 'chaotic',
    flags = {},
    seed = 123n,
}) {
    resetGame();
    initRng(seed);
    game.urole = namedEntry(roles, role, 'role');
    game.urace = namedEntry(races, race, 'race');
    game.initAlignment = namedEntry(aligns, alignment, 'alignment');
    game.flags = { ...flags };
    init_objects();
    uInitMisc(1);
    return game;
}

export function completeHeroStartup(options) {
    const state = prepareHeroStartup(options);
    if (!uInitInventoryAttrs())
        throw new Error('Hero inventory setup failed');
    if (!finishStartingDiscoveries())
        throw new Error('Hero discovery setup failed');
    return state;
}
