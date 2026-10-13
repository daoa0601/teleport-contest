import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a pet swap is announced before the hero touches the corpse on its square', async () => {
    freshObjectRoom({ flags: { explore: true, pickup: true, pickup_types: '' } });
    requirePlayingGame(game);
    const kitten = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(kitten, { state: game });
    await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const input = resetInputState();
    const messages: string[] = [];
    input.display = { async readKey() {
        const message = requireScreenRow(0).map(cell => cell.ch).join('');
        messages.push(message);
        return message.includes('Die?') ? 110 : 32;
    } };
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.match(messages[0] ?? '', /You swap places with your kitten\./);
    assert.match(messages.join('\n'), /Touching a cockatrice corpse is a fatal mistake/);
    assert.equal(game.u.ux, 11);
    assert.equal(kitten.mx, 10);
});
