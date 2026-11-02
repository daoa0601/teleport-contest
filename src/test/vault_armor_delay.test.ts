import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/do_wear.js';

import { CORR, ROOMOFFSET, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { RING_MAIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { createRoom } from './support/topology.js';

for (const arrivalTurn of [1, 5]) {
    void test(`a guard arriving on armor-removal turn ${arrivalTurn} leaves without delaying its completion`, async () => {
        const level = await freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
        requirePlayingGame(game);
        level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
        for (let x = 9; x <= 10; x++)
            for (let y = 9; y <= 10; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
        level.requireAt(16, 10).typ = CORR;
        level.requireAt(11, 10).typ = VWALL;
        game.u.uinvault = 30 - arrivalTurn;
        game._moveloopStarted = true;
        game.u.umovement = 12;
        const armor = await addInventoryObject(RING_MAIL);
        await wearHeroArmor(armor);
        const started = game.moves;
        const pages: string[] = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /Vault|ready to speak/, limit: 4, pages });
        input.feed('T');

        await moveloop_core();
        for (let turn = 1; turn < 5; turn++) await moveloop_core();
        await finishAtCommandInput(input, () => moveloop_core(), /You finish taking off your mail\./);

        assert.equal(game.moves, started + 5, 'ring mail removal takes five world turns');
        assert.equal(game.uarm, null, 'the armor is removed before the next command');
        assert.equal(level.monsters.some(monster => monster.isgd), false, 'the busy hero is left alone');
        assert.equal(level.requireAt(11, 10).typ, VWALL, 'the departing guard leaves the vault closed');
        const messages = pages.map(page => page.split('\n')[0]).join('\n');
        assert.match(messages, /"I'll be back when you're ready to speak to me!"--More--/,
            'the departure is acknowledged before the completion message replaces it');
    });
}
