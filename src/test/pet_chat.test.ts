import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { publishMonsterGrowl, publishMonsterYelp, publishMonsterWhimper } from '../js/monster_anger.js';
import { flush_screen } from '../js/display.js';
import type { Monster } from '../js/monster_types.js';
import { createMonsterAt } from './support/monsters.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { runExtendedCommand } from './support/commands.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [name, message] of [
    ['', 'The saddled pony is eating noisily.'],
    ['spot', 'Spot is eating noisily.'],
] as const) {
    void test(`chat uses the perceived name of an eating ${name ? 'named' : 'saddled'} pet`, async () => {
        freshObjectRoom();
        const pony = await createSaddledSteed('pony', { x: 11, y: 10 });
        pony.meating = 3;
        if (name) setMonsterGivenName(pony, name);

        await runExtendedCommand('chat', 'l');

        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 0);
        assert.equal(pony.meating, 3);
    });
}

async function petLine(deaf: boolean, sound: (monster: Monster) => Promise<unknown>) {
    freshObjectRoom();
    if (deaf) game.u.deafTurns = 5;
    const dog = await createMonsterAt('little dog', 11, 10);
    dog.mtame = 5;
    dog.msleeping = 0;
    await sound(dog);
    await flush_screen();
    return game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('an abused pet yelps for a hearing hero', async () => {
    assert.equal(await petLine(false, publishMonsterYelp), 'The little dog yelps!');
});

void test('an abused pet only recoils before a deaf hero', async () => {
    assert.equal(await petLine(true, publishMonsterYelp), 'The little dog recoils!');
});

void test('a distressed pet whines', async () => {
    assert.equal(await petLine(false, publishMonsterWhimper), 'The little dog whines.');
});

void test('an angry pet still growls before a deaf hero who can see it', async () => {
    assert.equal(await petLine(true, publishMonsterGrowl), 'The little dog growls!');
});
