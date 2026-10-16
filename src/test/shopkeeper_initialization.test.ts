import assert from 'node:assert/strict';
import test from 'node:test';

import { FIRE_TRAP, PIT, RUST_TRAP, SHOPBASE, TELEP_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { GOLD_PIECE, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('generated hardware shopkeepers begin ready to tend their shops and know every trap', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 2 };
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "tool shop", w = 8, h = 4, filled = 1 })
        end }}
        function post_level_generate() end
    `);
    initRng(67);

    await mklev();

    const shops = game.level.rooms.filter(isRoom).filter(room => room.rtype === SHOPBASE + 8);
    assert.ok(shops.length > 0, 'the level generator must create hardware shops');
    for (const room of shops) {
        const keeper = room.resident;
        assert.ok(keeper?.isshk, 'each shop needs its appointed resident');
        assert.ok(keeper.mpeaceful, 'a new keeper must be peaceful');
        assert.equal(keeper.msleeping, 0, 'a new keeper must be awake');
        for (const ttyp of [PIT, FIRE_TRAP, RUST_TRAP, TELEP_TRAP])
            assert.ok(monsterKnowsTrap(keeper, { ttyp }), `the keeper must already know trap ${ttyp}`);
        const account = keeper.eshk;
        assert.ok(account);
        assert.equal(account.bill?.length, 0, 'a new shop must have an empty bill');
        assert.equal(account.debit, 0);
        assert.equal(account.credit, 0);
        const gold = keeper.minvent?.find(object => object.otyp === GOLD_PIECE)?.quan;
        assert.ok(gold !== undefined && gold >= 1030 && gold <= 4000 && (gold - 1000) % 30 === 0,
            'initial capital is 1000 plus 30 times a roll from 1 through 100');
        assert.ok(keeper.minvent?.some(object => object.otyp === OBJECT_NAMES.indexOf('charging')),
            'hardware shopkeepers carry a scroll of charging');
        assert.equal(keeper.mx, account.shk.x);
        assert.equal(keeper.my, account.shk.y);
        assert.equal(Math.abs(keeper.mx - account.shd.x) + Math.abs(keeper.my - account.shd.y), 1,
            'the keeper must stand immediately inside the entrance');
    }
});
