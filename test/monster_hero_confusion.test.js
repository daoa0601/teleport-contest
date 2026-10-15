import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const condition of ['normal', 'confused', 'cancelled', 'cooldown']) {
    void test(`Yeenoghu's confusion strike against a ${condition} hero causes no HP damage`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10,
                confusionTurns: condition === 'confused' ? 7 : 0 } });
        requirePlayingGame(game);
        const demon = await createMonsterAt('Yeenoghu', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        demon.mux = game.u.ux;
        demon.muy = game.u.uy;
        demon.m_lev = 0; // Keep the final magic missile slot from casting.
        demon.mcan = condition === 'cancelled';
        demon.mspec_used = condition === 'cooldown' ? 5 : 0;
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Yeenoghu|confused/, limit: 12 });
        await performMonsterHeroAttack(demon, game, {
            random: range => range === 4 ? 0 : range - 1,
            rollOne: () => 1, rollDice: (count, sides) => count * sides,
        });
        assert.equal(game.u.uhp, 76, 'Only the physical weapon slot and paralysis claw deal damage');
        const blocked = condition === 'cancelled' || condition === 'cooldown';
        assert.equal(game.u.confusionTurns, blocked ? 0 : condition === 'confused' ? 23 : 16);
        assert.equal(demon.mspec_used, condition === 'cooldown' ? 5 : blocked ? 0 : 21);
        const prose = [...messages, game._pending_message].join('\n');
        if (!blocked)
            assert.match(prose, condition === 'confused'
                ? /You are getting even more confused\./ : /You are getting confused\./);
        else
            assert.doesNotMatch(prose, /You are getting/);
    });
}
//# sourceMappingURL=monster_hero_confusion.test.js.map