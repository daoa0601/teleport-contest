import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { TT_BEARTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createSaddledSteed } from './support/monsters.js';

for (const mounted of [false, true]) {
    void test(`escaping a bear trap reports ${mounted ? 'the steed' : 'the hero'} before freedom`, async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        if (mounted) game.u.usteed = await createSaddledSteed();
        game.u.utrap = 1;
        game.u.utraptype = TT_BEARTRAP;

        await rhack('n'.charCodeAt(0));

        assert.match(game._pending_message, mounted
            ? /Your pony is caught in a bear trap\.  Your pony finally lurches free\./
            : /You are caught in a bear trap\.  You finally wriggle free\./);
        assert.equal(game.u.utrap, 0);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
    });
}

