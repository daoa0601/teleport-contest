import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedCalendar } from '../js/allmain.js';
import { recorderIsLeapDay } from '../js/calendar.js';
import { game } from '../js/gstate.js';
import { sessionIsNight } from '../js/monster_sound.js';
import { freshGame } from './support/game-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { prepareHeroStartup } from './support/startup.js';

for (const helper of [
    { name: 'fresh game', start: () => freshGame(),
        leapDay: () => freshGame({ datetime: '20000229120000' }) },
    { name: 'object room', start: () => freshObjectRoom(),
        leapDay: () => freshObjectRoom({ datetime: '20000229120000' }) },
    { name: 'hero startup', start: () => prepareHeroStartup({ role: 'wizard' }),
        leapDay: () => prepareHeroStartup({ role: 'wizard', datetime: '20000229120000' }) },
]) {
    void test(`${helper.name} defaults to daytime without calendar events even at host midnight`, context => {
        context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 10, 5) });
        game.datetime = '20000229000000';

        helper.start();

        assert.equal(sessionIsNight(game.datetime), false);
        assert.equal(recorderIsLeapDay(game.datetime), false);
        const calendar = fixedCalendar(game.datetime);
        assert.ok(calendar.moonphase !== null, 'the helper needs a fixed calendar');
        assert.notEqual(calendar.moonphase, 0, 'new moon changes petrification');
        assert.notEqual(calendar.moonphase, 4, 'full moon changes luck and monsters');
        assert.equal(calendar.friday13, false);
    });

    void test(`${helper.name} allows a test to choose leap day`, () => {
        helper.leapDay();

        assert.equal(recorderIsLeapDay(game.datetime), true);
    });
}
