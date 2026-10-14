import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { WAN_CANCELLATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('cancellation names a clay golem before erasing the writing on its head', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    const golem = await createMonsterAt('clay golem', 11, 10);
    setMonsterGivenName(golem, 'Clay');
    const wand = await addInventoryObject(WAN_CANCELLATION, { spe: 2 });
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /writing|destroy|Clay/, limit: 8 });
    input.feed(`${wand.invlet}l`);
    initRng(1n);

    await rhack('z'.charCodeAt(0));

    assert.equal(golem.dead, true);
    assert.match([...messages, game._pending_message].join('\n'), /Some writing vanishes from Clay's head!/);
    assert.equal(wand.spe, 1);
});
