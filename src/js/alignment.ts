// Hero deity names.
// C ref: pray.c halu_gname().

import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Role } from './roles.js';
import { rn2Display } from './rng.js';
import { nativeRoleAt, roles } from './roles.js';
import { heroIsHallucinating } from './senses.js';
import { A_NONE } from './const.js';

export function deityName(alignment: number, state: GameState = game): string {
    if (alignment === A_NONE) return 'Moloch';
    const key = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    return state.urole?.gods?.[key] || 'your god';
}

// C pray.c:halu_gname(). Both selection steps use the display RNG.
const HALLUCINATED_GODS = [
    'the Flying Spaghetti Monster', 'Eris', 'the Martians', 'Xom',
    'AnDoR dRaKoN', 'the Central Bank of Yendor', 'Tooth Fairy', 'Om',
    'Yawgmoth', 'Morgoth', 'Cthulhu', 'the Ori', 'destiny',
    'your Friend the Computer',
];

// C pray.c:halu_gname().
export function hallucinatedDeityName(
    alignment: number, state: GameState = game, hallucinating = heroIsHallucinating(state),
) {
    requireLiveGame(state);
    if (!hallucinating) return deityName(alignment, state);
    if (!state.urole) throw new Error('Hallucinated deity names require a selected hero role');
    let gods: Role['gods'];
    do {
        const role = nativeRoleAt(rn2Display(roles.length));
        if (!role) throw new Error('No hallucinated deity role was selected');
        // role_init() copies borrowed gods into urole. halu_gname() reads
        // the unchanged roles[] table, so Priest remains a rejected choice.
        gods = role.gods;
    } while (!gods?.lawful);
    const choice = rn2Display(9);
    const name = choice < 2 ? gods.lawful
        : choice < 4 ? gods.neutral
        : choice < 6 ? gods.chaotic
        : choice < 8 ? HALLUCINATED_GODS[rn2Display(HALLUCINATED_GODS.length)]
        : 'Moloch';
    if (name === undefined) throw new Error('No hallucinated deity name was selected');
    return name.replace(/^_/, '');
}
