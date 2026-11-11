import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { makemapPrepost } from '../js/cmd.js';
import { finish, startMenuGame } from './support/context-menu-game.js';
// C cmd.c:makemap_prepost() leaves the water through set_uinwater(0)
// (hack.c:3221), which runs switch_terrain(); with the optional terrain
// status on, that reclassifies the hero's square from the SUBMERGED
// pseudo-type (hack.ts terrainType()'s 44) to the real terrain.  A bare
// u.uinwater write would keep the stale class.
void test('#makemap leaving water reclassifies terrain status', async () => {
    const engine = await startMenuGame();
    try {
        game.u.uinwater = 1;
        game.flags.terrainstatus = true;
        game.iflags.terrain_typ = 44; // SUBMERGED
        await makemapPrepost(true, false);
        assert.equal(game.u.uinwater, 0);
        assert.notEqual(game.iflags.terrain_typ, 44);
    }
    finally {
        await finish(engine);
    }
});
//# sourceMappingURL=makemap_water_terrain.test.js.map