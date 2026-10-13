import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const resistant of [false, true]) {
    void test(`an ice troll's cold claw ${resistant ? 'cannot chill a cold-resistant hero' : 'damages and chills the hero'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, coldResistance: resistant } });
        requirePlayingGame(game);
        const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        troll.mux = game.u.ux;
        troll.muy = game.u.uy;
        const input = resetInputState();
        const messages = [];
        installPagerInput(input, { expected: /ice troll|frost/, limit: 8 });
        input.beforeRead = () => { messages.push(game._pending_message); };
        await performMonsterHeroAttack(troll, game, {
            random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();
        assert.equal(game.u.uhp, resistant ? 96 : 94, 'the weapon and bite hurt; only cold resistance prevents the claw damage');
        assert.match(messages.join('\n'), /You're covered in frost!/);
        if (resistant)
            assert.match(messages.join('\n'), /The frost doesn't seem cold!/);
    });
}
//# sourceMappingURL=monster_cold_contact.test.js.map