import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DOOR, D_ISOPEN, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const doorway of ['entry', 'exit']) {
    void test(`a pet cannot be displaced diagonally at an intact doorway ${doorway}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', 11, 9, MM_NOGRP | NO_MINVENT);
        initializePet(dog, { state: game });
        const cell = doorway === 'entry' ? level.requireAt(11, 9) : level.requireAt(10, 10);
        cell.typ = DOOR;
        cell.doormask = D_ISOPEN;
        initRng(1n);

        await rhack('u'.charCodeAt(0));

        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.equal(dog.mx, 11);
        assert.equal(dog.my, 9);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, '');
    });
}
