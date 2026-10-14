import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { SADDLE } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createSaddledSteed } from './support/monsters.js';

void test('a cursed saddle refusal gives the hallucinated steed a new perceived name', async () => {
    freshPlayableRoom();
    const horse = await createSaddledSteed('horse', { saddle: { cursed: true } });
    const saddle = horse.minvent.find(object => object.otyp === SADDLE);
    assert.ok(saddle);
    game.u.hallucinationTurns = 20;
    initRng(142n);
    const input = resetInputState();

    const operation = runExtendedCommand('loot', 'l');
    await input.waitUntilBlocked();
    const prompt = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    const promptName = /remove the saddle from ([^?]+)\?/.exec(prompt)?.[1];
    assert.ok(promptName, `Expected the saddle question:\n${prompt}`);
    input.feed('y');
    await operation;

    const refusalName = /saddle seems to be stuck to (.+)\.$/.exec(game._pending_message)?.[1];
    assert.ok(refusalName, `Expected the cursed saddle refusal: ${game._pending_message}`);
    assert.notEqual(refusalName, promptName);
    assert.equal(horse.minvent.includes(saddle), true);
    assert.equal(game.context.move, 1);
});
