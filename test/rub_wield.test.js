import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { CLUB, OIL_LAMP } from '../js/object_data.js';
import { inventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

test('rubbing a lamp wields it and keeps the old weapon as secondary',
    async () => {
        freshPlayableRoom();
        const club = inventoryObject(CLUB, 'a', {
            wielded: true,
            owornmask: W_WEP,
        });
        const lamp = inventoryObject(OIL_LAMP, 'b');
        game.inventory = [club, lamp];
        game.uwep = game.u.uwep = club;
        game.flags.pushweapon = true;
        pushKeys('rub\nb');

        await rhack('#'.charCodeAt(0));

        assert.equal(game.uwep, lamp);
        assert.equal(game.uswapwep, club);
        assert.equal(club.alternate, true);
        assert.equal(lamp.wielded, true);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /now wield/);

        await rhack(0);

        assert.match(game._pending_message, /Nothing happens/);
        assert.equal(game.context.move, 1);
    });

test('a welded primary weapon prevents wielding a lamp to rub it',
    async () => {
        freshPlayableRoom();
        const club = inventoryObject(CLUB, 'a', {
            cursed: true,
            bknown: false,
            wielded: true,
            owornmask: W_WEP,
        });
        const lamp = inventoryObject(OIL_LAMP, 'b');
        game.inventory = [club, lamp];
        game.uwep = game.u.uwep = club;
        pushKeys('rub\nb');

        await rhack('#'.charCodeAt(0));

        assert.equal(game.uwep, club);
        assert.equal(club.bknown, true);
        assert.equal(lamp.wielded, false);
        assert.equal(game._cannedCommands?.length ?? 0, 0);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /welded to your hand/);
    });
