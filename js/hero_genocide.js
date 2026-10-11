// Native polyself.c:ugenocided()/udeadinside() and end.c delayed_killer(POLYMORPH).
import { GENOCIDED, G_GENOD } from './const.js';
import { game, requireInitializedGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { monsterIsNonliving, monsterIsWeirdNonliving } from './monster_data.js';
export function rememberPolymorphGenocide(cause, state = game) {
    state._polymorphGenocideCause = cause;
}
// Native polyman removes the delayed killer before done(), which can return
// when a wizard refuses death. A later reversion then uses self-genocide.
export function takePolymorphGenocide(state = game) {
    const cause = state._polymorphGenocideCause ?? null;
    delete state._polymorphGenocideCause;
    return cause;
}
export function heroHasBeenGenocided(state = game) {
    const { u, urace } = requireInitializedGame(state);
    // This port's role.mnum is a role-table index; u.umonster stores its
    // initialized monster species, equivalent to native urole.mnum.
    const roleVital = state.mvitals?.[u.umonster];
    const raceVital = state.mvitals?.[urace.mnum];
    if (!roleVital || !raceVital)
        throw new Error('Hero genocide requires initialized species population state');
    return !!((roleVital.mvflags | raceVital.mvflags) & G_GENOD);
}
export function feelingAfterSelfGenocide(state = game) {
    const species = heroSpecies(state);
    if (!monsterIsNonliving(species))
        return 'dead';
    return monsterIsWeirdNonliving(species) ? 'empty' : 'condemned';
}
export function genocideDeathOptions(cause) {
    let killer;
    let description;
    switch (cause) {
        case 'scroll':
            killer = 'scroll of genocide';
            description = 'a scroll of genocide';
            break;
        case 'throne':
            killer = 'imperious order';
            description = 'an imperious order';
            break;
        case 'confusion':
            killer = description = 'genocidal confusion';
            break;
        case 'self':
            killer = description = 'self-genocide';
            break;
    }
    return { killer, deathCause: `killed by ${description}`, deathType: GENOCIDED, deathLineShown: true };
}
//# sourceMappingURL=hero_genocide.js.map