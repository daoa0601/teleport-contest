import test from 'node:test';
import assert from 'node:assert/strict';
import { CORPSTAT_GENDER, CORPSTAT_HISTORIC, CORPSTAT_MALE } from '../js/const.js';
import { monsterTypeName } from '../js/do_name.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { generateMedusaLevel, generateMinetown } from '../js/mkmaze.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { roles } from '../js/role.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { floorObjects } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
import { createDungeon } from './support/topology.js';
// C sp_lev.c:lspo_object() "Obey statue type gender": a montype spelling
// that is the male or female name of its species records that gender in
// the statue's CORPSTAT overloads, so minetn-5's gnome king statue is not
// described with the species' neutral "gnome ruler" name.
void test('a montype spelling with gender marks the statue gender', async () => {
    const active = freshSpecialLevel({
        prototype: 'minetn', variant: 5, seed: 5 * 131, depth: 6,
    });
    requirePlayingGame(game);
    const role = roles.find(entry => entry.key === 'wizard');
    assert.ok(role);
    game.urole = role;
    await generateMinetown(active);
    const statue = floorObjects(game.level).find(object => object.otyp === STATUE
        && object.corpsenm === MONSTER_NAME.indexOf('gnome ruler'));
    assert.ok(statue, 'minetn-5 places the gnome ruler statue');
    assert.equal(statue.spe, CORPSTAT_HISTORIC | CORPSTAT_MALE);
});
// C sp_lev.c:lspo_object() "Fix statue and figurine genders": a level's
// random statues no longer overwrite the gender mksobj() rolled for them,
// so a species with gendered spellings never shows its neutral name.
void test('random statues keep the gender their species rolled', async (t) => {
    const level = await buildStatuaryLevel(t);
    const statues = floorObjects(level).filter(object => object.otyp === STATUE && (object.corpsenm ?? -1) >= 0);
    assert.ok(statues.length > 0, 'the themed room places statues');
    for (const statue of statues)
        assert.notEqual(statue.spe & CORPSTAT_GENDER, 0, `statue of ${MONSTER_NAME[statue.corpsenm ?? 0]} lost its gender`);
});
// The Statuary themed room places plain statues through lspo_object().
async function buildStatuaryLevel(t) {
    freshGame({ flags: { bones: false } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 30,
            themeRooms: 'themerms.lua',
        })];
    initRng(731);
    init_objects();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'regular level generation should load its themed-room script');
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 9, h = 5, filled = 0, lit = 1 })
            for i = 1, 12 do des.object({ id = "statue" }); end
        end }}
    `);
    game.level = new GameMap();
    await mklev();
    return game.level;
}
//# sourceMappingURL=statue_montype_gender.test.js.map