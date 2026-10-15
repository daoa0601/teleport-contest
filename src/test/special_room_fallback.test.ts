import assert from 'node:assert/strict';
import test from 'node:test';
import { BARRACKS, COURT, G_GONE, THRONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { roomBindings } from './support/themed-room-bindings.js';

for (const { label, type, unavailable } of [
    { label: 'barracks', type: BARRACKS,
        unavailable: (species: number) => ['soldier', 'sergeant', 'lieutenant', 'captain']
            .includes(MONSTER_NAME[species] ?? '') },
    { label: 'throne', type: COURT,
        unavailable: (species: number) => MONSTER_SYMBOL[species] === 11
            || MONSTER_SYMBOL[species] === 33 },
]) {
    void test(`a declared ${label} room uses random monsters when its class selection is unavailable`, async t => {
        const lua = await roomBindings(t);
        requirePlayingGame(game);
        for (const [species, vital] of (game.mvitals ?? []).entries()) {
            if (unavailable(species)) vital.mvflags |= G_GONE;
        }
        await lua.executeAsync(`
            themerooms = {{ frequency = 1, contents = function()
                des.room({ type = "${label}", w = 8, h = 5, filled = 1 })
            end }}
        `);

        await mklev();

        const rooms = game.level.rooms.filter(isRoom).filter(room => room.rtype === type);
        assert.ok(rooms.length > 0, 'the generator must create the declared special room');
        for (const room of rooms) {
            for (let x = room.lx + 1; x < room.hx; x++) {
                for (let y = room.ly + 1; y < room.hy; y++) {
                    if (game.level.requireAt(x, y).typ === THRONE) continue;
                    const monster = game.level.monsters.find(monster => monster.mx === x && monster.my === y);
                    assert.ok(monster, `stocking must populate the interior at ${x},${y}`);
                    assert.ok(monster.msleeping, 'replacement inhabitants start asleep');
                }
            }
        }
    });
}
