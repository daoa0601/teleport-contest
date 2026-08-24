// Source-owned new-game initialization before mklev().
// C refs: allmain.c:newgame(), o_init.c:init_objects(), role.c:role_init(),
// dungeon.c:init_dungeons(), u_init.c:u_init_misc().

import { game } from './gstate.js';
import { init_objects } from './o_init.js';
import { init_dungeons } from './dungeon.js';
import { rn2, rnd } from './rng.js';

// This boundary owns live operations and their state mutations.  It does not
// consume a recorded range list.  Role inventory and attribute construction
// continue in u_init.js after mklev(), so the ownership registry marks the
// larger startup subsystem partial rather than complete.
export function initializeSourceStartup() {
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
    rn2(3);
    rn2(2);
    init_dungeons();

    // newpw() precedes the human racial point applied by u_init_misc().
    if (game.urole?.key === 'priest' || game.urole?.key === 'wizard')
        game._initialPwBonus = rnd(3);
    else if (game.urole?.key === 'healer' || game.urole?.key === 'knight')
        game._initialPwBonus = rnd(4);
    else if (game.urole?.key === 'monk') game._initialPwBonus = rnd(2);

    return rn2(10);
}
