import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { canSpotMonster } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const blind of [false, true]) {
    void test(`warning reveals a hidden adjacent piercer to a ${blind ? 'blind' : 'sighted'} hero during the turn`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (blind) await makeBlinded(10, { talk: false });
        grantIntrinsicProperty('warning', 'outside');
        const piercer = await createMonsterAt('iron piercer', 11, 10);
        piercer.mundetected = 1;
        piercer.mpeaceful = 0;
        piercer.m_lev = 8;
        piercer.mcanmove = 0;
        piercer.mfrozen = 20;
        vision_recalc(0);
        assert.equal(canSpotMonster(piercer), false);
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 0;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            messages.push(text);
            input.feed(text.includes('--More--') ? ' ' : '.');
        };

        await moveloop_core();

        assert.equal(piercer.mundetected, 0);
        const displayed = messages.join('\n');
        assert.match(displayed, blind
            ? /Your danger sense causes you to take a second to check nearby\./
            : /Your danger sense causes you to take a second look close by\./);
        assert.match(displayed, blind ? /You feel an unseen monster!/ : /You find an iron piercer\./);
    });
}
