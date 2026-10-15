import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterAvoidsKickedLocation } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('repeating a kick lets pets enter the kicked square after dispatch', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 9, 10);
    initializePet(pet, { state: game });
    input.feed('\x04l');
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.equal(monsterAvoidsKickedLocation(pet, 11, 10, game), true);

    input.feed('\x01');
    await rhack(0);

    assert.equal(game.context.move, 1);
    assert.equal(monsterAvoidsKickedLocation(pet, 11, 10, game), false);
});
