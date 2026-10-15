import test from 'node:test';
import assert from 'node:assert/strict';
import { Upolyd } from '../js/const.js';
import { game } from '../js/gstate.js';
import { createGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';

void test('lethal gas damage ends a vulnerable polymorph without killing the hero', async () => {
    freshRoomWithPolymorphedHero('wolf', { polymorph: { hitPoints: 1 } });
    const hp = game.u.uhp;
    await createGasCloudSelection(game, [{ x: 10, y: 10 }], 5, 8, async () => {});
    const messages: string[] = [];

    await runLevelRegions(game, {
        publish: async message => { messages.push(message); },
        rollOne: () => 1,
    });

    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, hp);
    assert.equal(!!game.program_state.gameover, false);
    assert.ok(messages.some(message => message.includes('return to')));
});
