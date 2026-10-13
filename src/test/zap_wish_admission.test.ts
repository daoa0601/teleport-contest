import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER, ROCK, WAN_WISHING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [request, type, hero] of [
    ['rock', ROCK, { fumblingTurns: 10 }],
    ['boulder', BOULDER, {}],
] as const) {
    void test(`a wishing wand leaves ${request} on the floor when the hero cannot hold it`, async () => {
        const level = freshObjectRoom({ hero });
        requirePlayingGame(game);
        const wand = await addInventoryObject(WAN_WISHING, { spe: 2 });
        const input = resetInputState();
        installPagerInput(input, { expected: /may wish|Oops!|Careful!|floor|materialize|drop/, limit: 8 });
        input.feed(`${wand.invlet} ${request}\n`);

        await rhack('z'.charCodeAt(0));

        assert.ok(!game.inventory.some(object => object.otyp === type));
        assert.ok(level.objects[10]?.[10]?.some(object => object.otyp === type));
        assert.equal(game.u.uconduct.wishes, 1);
        assert.equal(wand.spe, 1);
        assert.equal(game.context.move, 1);
    });
}
