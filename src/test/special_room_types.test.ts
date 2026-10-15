import assert from 'node:assert/strict';
import test from 'node:test';
import { ANTHOLE, COCKNEST, LEPREHALL, VAULT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { floorObjects } from './support/level-state.js';
import { roomBindings } from './support/themed-room-bindings.js';

for (const { label, type, species } of [
    { label: 'vault', type: VAULT, species: null },
    { label: 'anthole', type: ANTHOLE, species: 'ant' },
    { label: 'cocknest', type: COCKNEST, species: 'cockatrice' },
    { label: 'leprehall', type: LEPREHALL, species: 'leprechaun' },
]) {
    void test(`Lua level generation accepts and stocks a ${label}`, async t => {
        const lua = await roomBindings(t);
        await lua.executeAsync(`
            themerooms = {{ frequency = 1, contents = function()
                des.room({ type = "themed", w = 13, h = 8, filled = 0,
                    contents = function()
                        des.room({ type = "${label}", x = 2, y = 2,
                                   w = 6, h = 4, filled = 1 })
                    end })
            end }}
        `);

        await mklev();

        requirePlayingGame(game);
        assert.ok(game.level.subrooms?.some(room => room.rtype === type));
        if (species) {
            assert.ok(game.level.monsters.some(monster =>
                MONSTER_NAME[monster.mnum]?.includes(species) && monster.msleeping),
            'the room must receive its sleeping inhabitants');
        } else {
            assert.ok(floorObjects(game.level).some(object => object.otyp === GOLD_PIECE),
                'a vault must receive gold');
        }
    });
}
