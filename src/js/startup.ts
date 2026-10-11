// Source-owned new-game initialization before mklev().
// C refs: allmain.c:newgame(), o_init.c:init_objects(), role.c:role_init(),
// dungeon.c:init_dungeons(), u_init.c:u_init_misc().

import { game } from './gstate.js';
import { init_objects } from './o_init.js';
import { init_dungeons } from './dungeon.js';
import { initializeArtifacts } from './artifacts.js';
import { initializeMonsterVitals } from './monster_population.js';
import { rn2, rnd } from './rng.js';

// This is the part of newgame() that runs before level creation. Role
// inventory and starting attributes run from u_init.js after mklev().
export async function initializeSourceStartup() {
    initializeMonsterVitals(game);
    init_objects();

    // role_init(): Priests borrow a pantheon from a random non-Priest role.
    if (game.urole?.key === 'priest') {
        do game._priestPantheonIndex = rn2(13);
        while (game._priestPantheonIndex === 6);
    }

    // role_init(): these quest nemeses have random gender.
    if (game.urole?.key === 'wizard' || game.urole?.key === 'archeologist')
        rn2(100);

    // role_init() random gender/alignment initialization before dungeon.lua.
    await init_dungeons();
    initializeArtifacts(game);

    // newpw() precedes the human racial point applied by u_init_misc().
    if (game.urole?.key === 'priest' || game.urole?.key === 'wizard')
        game._initialPwBonus = rnd(3);
    else if (game.urole?.key === 'healer' || game.urole?.key === 'knight')
        game._initialPwBonus = rnd(4);
    else if (game.urole?.key === 'monk') game._initialPwBonus = rnd(2);

    return rn2(10);
}
