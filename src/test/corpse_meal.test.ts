import type { InputGate } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { inventoryLetter } from './support/commands.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { polymonHero, returnHeroToHumanForm } from '../js/polyself.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function diningRoom() {
    freshObjectRoom({ role: 'monk', gameplaySeed: 61n, hero: { uhunger: 200 } });
    requirePlayingGame(game);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
    };
    installPagerInput(input, {
        expected:
            /This .* corpse|You feel guilty|You finish eating|You turn into a tiger|You return to human form|You no longer feel|You feel less concerned about becoming petrified/,
        limit: 8,
    });
    return { input, messages };
}

async function eatCorpse(name: string, input: InputGate) {
    const food = await addInventoryObject(CORPSE, {
        corpsenm: MONSTER_NAME.indexOf(name),
        age: game.moves,
    });
    input.feed(inventoryLetter(food));
    await rhack('e'.charCodeAt(0));
    for (let turn = 0; game._occupation && turn < 40; turn++) await continueCountedCommand(game);
    assert.equal(food.where, 'gone', 'the meal consumes the selected corpse');
}

void test('an ordinary Monk finds meat terrible even though humans are omnivorous', async () => {
    const { input, messages } = diningRoom();
    requirePlayingGame(game);

    await eatCorpse('lizard', input);

    assert.match(
        [...messages, game._pending_message].join('\n'),
        /This lizard corpse tastes terrible!/,
    );
    assert.equal(game.u.uconduct.unvegetarian, 1);
});

void test('an ordinary Monk finds a vegan corpse delicious', async () => {
    const { input, messages } = diningRoom();
    requirePlayingGame(game);

    await eatCorpse('lichen', input);

    assert.match(
        [...messages, game._pending_message].join('\n'),
        /This lichen corpse tastes delicious!/,
    );
    assert.equal(game.u.uconduct.unvegetarian || 0, 0);
});

void test('a Monk eats with the transformed body and regains the original diet on return', async () => {
    const { input, messages } = diningRoom();
    requirePlayingGame(game);
    await polymonHero(MONSTER_NAME.indexOf('tiger'));

    await eatCorpse('lizard', input);

    assert.match(
        [...messages, game._pending_message].join('\n'),
        /This lizard corpse (?:is|tastes) delicious!/,
    );
    await returnHeroToHumanForm();
    messages.length = 0;

    await eatCorpse('lizard', input);

    assert.match(
        [...messages, game._pending_message].join('\n'),
        /This lizard corpse tastes terrible!/,
    );
});
