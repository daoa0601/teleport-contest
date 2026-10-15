import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, SICK_NONVOMITABLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const resistant of [false, true]) {
    void test(`Pestilence ${resistant ? 'still hurts a disease-resistant hero' : 'infects the hero once before substituting a stunning touch'}`, async () => {
        freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: 10, sicknessResistance: resistant } });
        requirePlayingGame(game);
        const rider = await createMonsterAt('Pestilence', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        rider.mux = game.u.ux;
        rider.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Pestilence|sick|illness/, limit: 12 });

        await performMonsterHeroAttack(rider, game, {
            random: range => range - 1, rollOne: () => 1,
            rollDice: (count, sides) => count * sides,
        });

        assert.equal(game.u.uhp, 372, 'Disease resistance does not remove either of the Rider touch damages');
        assert.equal(!!game.u.sick, !resistant);
        if (!resistant) {
            assert.equal(game.u.sickCause, 'Pestilence');
            assert.equal(game.u.sickType, SICK_NONVOMITABLE);
        }
        const prose = [...messages, game._pending_message].join('\n');
        assert.equal(prose.match(/reaches out, and you feel fever and chills\./g)?.length, 1);
        assert.match(prose, /Pestilence touches you!/);
    });
}
