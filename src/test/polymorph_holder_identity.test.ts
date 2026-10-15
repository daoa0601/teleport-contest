import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const visible of [false, true]) {
    void test(`polymorph remembers ${visible ? 'a visible' : 'an unseen'} holder before becoming eyeless`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        if (visible) installPolymorphedHero('mind flayer');
        const python = await createMonsterAt('python', 11, 10);
        python.minvis = 1;
        game.u.ustuck = python;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        pushKeys('polyself\nyellow light\n                        ');

        await rhack('#'.charCodeAt(0));
        messages.push(game._pending_message);

        assert.equal(game.u.ustuck, null);
        assert.match(messages.join('\n'), visible
            ? /The invisible python loses its grip on you\./
            : /Something loses its grip on you\./);
    });
}
