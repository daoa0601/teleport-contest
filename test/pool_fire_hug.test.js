import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const held of [false, true]) {
    void test(`a salamander roasts the hero during ${held ? 'an existing' : 'a new'} hold`, async () => {
        freshObjectRoom({ hero: { uhp: 200, uhpmax: 200, uac: 10 } });
        requirePlayingGame(game);
        const salamander = await createMonsterAt('salamander', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        salamander.mux = game.u.ux;
        salamander.muy = game.u.uy;
        if (held)
            game.u.ustuck = salamander;
        const input = resetInputState();
        installPagerInput(input, { expected: /salamander|roasted|crushed/, limit: 16 });
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        await performMonsterHeroAttack(salamander, game, {
            random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();
        assert.equal(game.u.ustuck, salamander);
        assert.match(messages.join('\n'), /The salamander hits!  You're being roasted!/);
        assert.doesNotMatch(messages.join('\n'), /hits again/);
        assert.ok(game.u.uhp < 200);
    });
}
//# sourceMappingURL=pool_fire_hug.test.js.map