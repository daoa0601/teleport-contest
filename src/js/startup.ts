// Source-owned new-game initialization before mklev().
// C refs: allmain.c:newgame(), o_init.c:init_objects(),
// dungeon.c:init_dungeons(), u_init.c:u_init_misc(). The role_init()
// pieces live in roles.ts.

import { game } from './gstate.js';
import { init_objects } from './o_init.js';
import { init_dungeons } from './dungeon.js';
import { initializeArtifacts } from './artifacts.js';
import { rn2, rnd } from './rng.js';
import { initializeRoleQuestGenders, roleInitPriestPantheon } from './roles.js';
import { initializeMonsterVitals } from './allmain.js';

// This is the part of newgame() that runs before level creation. Role
// inventory and starting attributes run from u_init.js after mklev().
export async function initializeSourceStartup() {
    initializeMonsterVitals(game);
    init_objects();
    initializeRoleQuestGenders();
    roleInitPriestPantheon(game);

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
