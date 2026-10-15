import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { newsym } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const remembersObjects of [false, true]) {
    void test(`a reluctant cube names ${remembersObjects ? 'a remembered rock' : 'something when the level has no hero memory'}`, async () => {
        const input = freshTurnRoom({ left: 9, right: 13, top: 10, bottom: 10,
            heroX: 9, heroY: 10 });
        requirePlayingGame(game);
        game.level.flags.hero_memory = remembersObjects;
        const cube = await createMonsterAt('gelatinous cube', 13, 10, NO_MINVENT);
        initializePet(cube);
        cube.movement = 12;
        await floorObject(ROCK, 12, 10, { cursed: true });
        newsym(12, 10);
        const messages = [];
        input.beforeRead = () => {
            assert.ok(messages.length < 30, 'the pet turn must settle promptly');
            const line = game._screen_output.split('\n')[0] ?? '';
            messages.push(line);
            input.feed(line.includes('--More--') ? ' ' : '.');
        };
        await moveloop_core();
        await moveloop_core();
        const reluctant = messages.find(message => message.includes('reluctantly')) ?? '';
        assert.match(reluctant, /gelatinous cube crawls reluctantly onto/);
        assert.match(reluctant, remembersObjects ? /a cursed rock\./ : /onto something\./);
    });
}
//# sourceMappingURL=pet_cursed_pile_message.test.js.map