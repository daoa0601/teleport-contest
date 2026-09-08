import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { TT_PIT, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BOULDER, BULLWHIP, CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import {
    addInventoryObject, floorObject, knownObject,
} from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

test('applying an unwielded bullwhip wields it before asking for direction',
    async () => {
        freshPlayableRoom({ role: 'archeologist' });
        const whip = addInventoryObject(BULLWHIP, {
            invlet: 'a', spe: 2,
        });
        initRng(7101n);
        await applyInventoryObject(whip, 'l');

        assert.equal(game.uwep, whip);
        assert.equal(game.context.move, 1);

        await rhack(0);

        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /Snap/);
    });

test('an archeologist can pull a wielded weapon from an adjacent monster',
    async () => {
        freshPlayableRoom({
            role: 'archeologist',
            hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
        });
        const whip = addInventoryObject(BULLWHIP, {
            invlet: 'a',
            spe: 2,
            wielded: true,
            owornmask: W_WEP,
        });
        game.uwep = game.u.uwep = whip;
        const club = knownObject(CLUB, {
            where: 'minvent',
            wielded: true,
            owornmask: W_WEP,
        });
        const bugbear = await createMonsterAt('bugbear', 11, 10);
        equipMonsterObject(bugbear, club, W_WEP);
        initRng(7102n);
        await applyInventoryObject(whip, 'l ');

        assert.equal(bugbear.mw, null);
        assert.equal(bugbear.minvent.includes(club), false);
        assert.equal(game.context.move, 1);
    });

test('a proficient bullwhip can pull the hero from a pit toward a boulder',
    async () => {
        freshPlayableRoom({
            role: 'archeologist',
            hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
        });
        const whip = addInventoryObject(BULLWHIP, {
            invlet: 'a',
            spe: 2,
            wielded: true,
            owornmask: W_WEP,
        });
        game.uwep = game.u.uwep = whip;
        game.u.utrap = 3;
        game.u.utraptype = TT_PIT;
        floorObject(BOULDER, 11, 10);
        initRng(7103n);
        await applyInventoryObject(whip, 'l');

        assert.equal(game.u.utrap, 0);
        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game.context.move, 1);
    });
