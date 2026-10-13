import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT, ROOM } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { mfndpos } from '../js/monmove.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { createMonsterAt } from './support/monsters.js';
void test('a Valley invisible room boundary becomes traversable floor', async (t) => {
    freshGame({ flags: { bones: false } });
    initRng(731n);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    game._specialLevelPrototype = 'valley';
    await mklev();
    requirePlayingGame(game);
    const origin = game._activeSpecialLevel?.context;
    assert.ok(origin, 'the Valley map must retain its coordinate frame');
    // valley.lua puts an invisible boundary at (41,15), next to floor
    // at (41,14). Locate those squares after the level's optional flips.
    const flip = game.level._flip;
    const mapPoint = (x, y) => ({
        x: flip && flip.flp & 2 ? flip.maxx - x + flip.minx : x,
        y: flip && flip.flp & 1 ? flip.maxy - y + flip.miny : y,
    });
    const boundary = mapPoint(origin.xstart + 41, origin.ystart + 15);
    const floor = mapPoint(origin.xstart + 41, origin.ystart + 14);
    assert.equal(game.level.requireAt(boundary.x, boundary.y).typ, ROOM);
    game.level.monsters = [];
    game.u.ux = 1;
    game.u.uy = 0;
    const goblin = await createMonsterAt('goblin', floor.x, floor.y, MM_ANGRY | NO_MINVENT);
    assert.ok(mfndpos(goblin, game).some(square => square.x === boundary.x && square.y === boundary.y), 'invisible room boundaries must not obstruct monster movement');
});
//# sourceMappingURL=special_level_boundaries.test.js.map