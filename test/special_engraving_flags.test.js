import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
// C sp_lev.c:lspo_engraving() applies the Lua guardobjects/degrade flags
// after make_engr_at(), so they also override the old-style Elbereth guard
// that make_engr_at() itself installs while making a level: a special-level
// Elbereth without guardobjects=true protects nothing once objects lie on
// it.
void test('special-level Elbereth keeps the Lua guardobjects flag', async (t) => {
    const lua = await roomBindings(t);
    game.level = new GameMap();
    initRng(173);
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", x = 3, y = 3, w = 3, h = 3, lit = 1,
                contents = function()
                    des.engraving({ type = "burn", text = "Elbereth" })
                end })
        end }}
    `);
    await mklev();
    requirePlayingGame(game);
    const engraving = game.level.engravings?.find(e => e.text === 'Elbereth');
    assert.ok(engraving, 'the special level should carry the engraved Elbereth');
    assert.equal(engraving.guardobjects, false);
    assert.equal(engraving.nowipeout, false);
});
//# sourceMappingURL=special_engraving_flags.test.js.map