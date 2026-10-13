import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLogEvents } from '../js/gamelog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SCR_GENOCIDE } from '../js/object_data.js';
import { readInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const blessed of [false, true]) {
    void test(`declining ${blessed ? 'class' : 'species'} genocide records the choice without breaking genocideless conduct`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        input.beforeRead = () => input.feed(/do you want to genocide/.test(game._pending_message)
            ? 'none\n' : ' ');
        const scroll = await addInventoryObject(SCR_GENOCIDE, { blessed, typeKnown: true });
        await readInventoryObject(scroll);
        assert.ok(gameLogEvents().some(event => event.text === `declined to perform ${blessed ? 'class genocide' : 'genocide'}`));
        assert.equal(game.u.uconduct.genocides || 0, 0);
        assert.equal(scroll.where, 'gone');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=read_genocide_choice.test.js.map