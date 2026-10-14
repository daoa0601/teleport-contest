import assert from 'node:assert/strict';
import test from 'node:test';
import { MOAT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { WAN_FIRE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a fire zap reports enveloping steam before its hit instead of repeating evaporation feedback', async () => {
    const level = freshObjectRoom({ hero: { fireResistance: true, waterWalking: true, uac: 100 } });
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = MOAT;
    const wand = await addInventoryObject(WAN_FIRE, { spe: 2 });
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /steam|fire|hot|water evaporates/, limit: 8 });
    input.feed(`${wand.invlet}>`);
    initRng(3n);

    await rhack('z'.charCodeAt(0));

    const feedback = [...messages, game._pending_message].join('\n');
    assert.match(feedback, /You are enveloped in a cloud of steam!/);
    assert.doesNotMatch(feedback, /Some water evaporates\./);
    assert.equal(game.u.uhp, 40);
    assert.ok(level.regions.some(region => region.kind === 'gas-cloud' && region.damage === 0));
});
