import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
for (const female of [undefined, false, true]) {
    void test(`Lua vampire-class creation uses ${female === true ? 'explicit female' : female === false ? 'explicit male' : 'default male'} sex through shape changes`, async (t) => {
        const lua = await roomBindings(t);
        requirePlayingGame(game);
        initRng(2n);
        await lua.executeAsync(`
            des.map({ map = [[......
......
......]], contents = function()
                for x = 0, 5 do
                    des.monster({ class = "V", x = x, y = 1,
                        ${female === undefined ? '' : `female = ${female ? 1 : 0},`}
                        group = 0, peaceful = 0 })
                end
            end })
        `);
        const vampires = game.level.monsters.filter(monster => monster.cham === MONSTER_NAME.indexOf('vampire')
            || monster.cham === MONSTER_NAME.indexOf('vampire leader'));
        assert.equal(vampires.length, 6);
        for (const vampire of vampires) {
            assert.equal(!!vampire.female, female ?? false);
            const naturalForm = vampire.cham;
            assert.ok(naturalForm !== undefined);
            await changeMonsterForm(vampire, naturalForm, game);
            assert.equal(!!vampire.female, female ?? false);
        }
    });
}
//# sourceMappingURL=lua_monster_gender.test.js.map