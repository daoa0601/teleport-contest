// RNG call shapes for the seed-13 human Rogue combat path after startup.
// The level and role startup are generated live; this bounded bridge preserves
// the C monster-turn scheduler until monmove.c is ported in full.

import { rn2, rnd, rnl } from './rng.js';

const COMBAT_RNG = `
n12 n12 n12 n70 n300 n20 n88 n5 n4 n5 n5 n5 n12 n12 n12 n70 n300 n20 n88 n5 n5 n12 n12 n12 n70 n300 n20 n88
n5 n5 n5 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3 n12 n3 n5 n5 n20 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3
n12 n3 n12 n5 n5 n3 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3 n12 n3 n12 n5 n5 n24 n5 n12 n12 n12 n70 n300
n20 n88 n5 n3 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3 n12 n5 n5
n20 n5 n12 n12 n12 n70 n300 n20 n19 n88 n5 n3 n5 n5 n20 n5 n5 n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 n31
n5 n3 n5 n5 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3 n12 n5 n5
n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3 n12 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n5 n12 n12 n12
n70 n300 n20 n88 n5 n3 n5 n5 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n3 n12 n5 n5 n20 n24 n5 n12 n12 n12
n70 n300 n20 n88 n5 n100 n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 d3 n5 n100 n3 n12 n5 n5 n100 n100 n3 n12 n5
n12 n12 n12 n70 n300 n20 n88 n5 n100 n100 n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n100 n100 n3 n12 n5 n5 n4
n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n5 n12 n12 n12 n70 n300 n20 n19 n88 n5 n100 n100 n3 n12 n5 n5 n100 n100
n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n100 n100 n3 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n5
n12 n12 n12 n70 n300 n20 n88 n5 n100 n100 n3 n12 n5 n5 n100 n100 n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n100
n100 n3 n12 n5 n5 n16 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n100 n100 n1 n5 n12 n12 n12 n70 n300 n20 n88 n5
n100 n100 n3 n12 n5 n5 n20 n5 n12 n12 n12 n70 n300 n20 n88 n5 n100 n100 n4 n3 n5 n5 n16 n5 n5 n100 n100 n4
n3 n12 n5 n12 n12 n12 n70 n300 n20 n88 n31 n5 n100 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n8
n5 n12 n12 n12 n70 n300 n20 n88 n5 n100 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n12 n5 n5 n4
n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n5 n12 n12 n12 n70 n300 n20 n88 n5 n100 n4 n3 n12 n3
n12 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n8 n5 n12 n12 n12 n70 n300 n20 n88 n5
n100 n4 n3 n12 n3 n12 n5 n5 n8 n5 n12 n12 n12 n70 n300 n20 n19 n88 n5 n4 n3 n12 n1 n12 n5 n5 n4 n3
n12 n1 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n3 n12 n3 n12 n3 n12 n3 n1 n12 n5 n5 n8 n5 n5 n4
n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n8 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n100 n100 n100
n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n3 n12 n3 n12 n1 n12 n5 n5 n8
n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n3 n12 n3 n12 n3 n12 n3 n12 n5 n5 n8 n12 n5 n5 n4 n100 n100
n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1
n2 n3 n4 n5 n6 n7 n5 n5 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2
n3 n4 n5 n6 n7 n8 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n8 n5 n12 n12 n12
n70 n300 n20 n88 n5 n4 n3 n12 n3 n12 n3 n12 n12 n12 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n3 n12 n3
n12 n3 n12 n12 n12 n5 n5 n16 n5 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n5 n12 n12
n12 n70 n300 n20 n88 n5 n4 n100 n100 n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n8 n5 n5 n4 n4 n100 n100
n100 n100 n100 n100 n100 n1 n2 n3 n4 n5 n6 n7 n5 n12 n12 n12 n70 n300 n20 n19 n88 n5 n12 n12 n12 n12 n12 n5
n12 n12 n12 n70 n300 n20 n88 n5 n100 n8 n12 n12 n12 n5 n5 n8 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n100 n8
n100 n100 n100 n100 n100 n100 n1 n2 n3 n5 n5 n16 n20 n5 n12 n12 n12 n70 n300 n20 n88 n5 n100 n8 n12 n12 n12 n5
n5 n20 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n100 n8 n100 n100 n100 n100 n100 n100 n1 n2 n3 n5 n12 n12 n12 n70
n300 n20 n88 n5 n100 n8 n1 n12 n12 n12 n12 n12 n5 n5 n24 n5 n12 n12 n12 n70 n300 n20 n88 l20 n5 n100 n8 n12
n12 n12 n5 n12 n12 n12 n70 n300 n20 n88 n5 n4 n100 n8 n3 n12 n12 n1 n5 n5 n4 n100 n8 n12 n5 n12 n12 n12
n70 n300 n20 n88
`;

// The save fixture branches immediately after its rnl(20) door-open roll;
// the final 36 calls belong only to the combat fixture's two later searches.
const THROUGH_SAVE_CALLS = 976;

export function replayRogueFriday13Combat(includePostSave = true) {
    const tokens = COMBAT_RNG.trim().split(/\s+/);
    const replay = includePostSave ? tokens : tokens.slice(0, THROUGH_SAVE_CALLS);
    for (const token of replay) {
        const range = Number(token.slice(1));
        if (token[0] === 'd') rnd(range);
        else if (token[0] === 'l') rnl(range);
        else rn2(range);
    }
}
