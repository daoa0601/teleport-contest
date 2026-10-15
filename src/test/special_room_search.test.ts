import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, TELEP_TRAP, VAULT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { teleportMonsterFromTrap } from '../js/teleport.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('a vault teleport trap finds a vault nested inside another room', async t => {
    const lua = await roomBindings(t);
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ type = "themed", w = 72, h = 15, filled = 0,
                contents = function()
                    des.room({ type = "vault", x = 2, y = 2,
                               w = 4, h = 3, filled = 0 })
                end })
        end }}
    `);
    await mklev();
    requirePlayingGame(game);
    const parent = game.level.rooms.filter(isRoom).find(room => room.nsubrooms > 0);
    const vault = parent?.sbrooms[0];
    assert.ok(parent && vault && vault.rtype === VAULT, 'the generator must create the nested vault');
    assert.equal(game.level.rooms.filter(isRoom).some(room => room.rtype === VAULT), false,
        'this level must require a search through subrooms');
    const x = parent.hx - 1, y = parent.hy - 1;
    const monster = await createMonsterAt('newt', x, y, MM_NOGRP | NO_MINVENT);
    const trap = addTrap(game.level, TELEP_TRAP, x, y, { once: true });

    await teleportMonsterFromTrap(monster, trap);

    assert.ok(monster.mx >= vault.lx && monster.mx <= vault.hx
        && monster.my >= vault.ly && monster.my <= vault.hy,
    `the monster must arrive inside the nested vault, got ${monster.mx},${monster.my}`);
});
