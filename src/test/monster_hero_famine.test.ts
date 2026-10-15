import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { FAINTED, MM_ANGRY, MM_NOGRP, NO_MINVENT, NOT_HUNGRY } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const fainted of [false, true]) {
    void test(`Famine ${fainted ? 'spares the nutrition of a fainted hero' : 'takes nutrition once before substituting a stunning touch'}`, async () => {
        freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: 10,
            uhunger: fainted ? -10 : 900, uhs: fainted ? FAINTED : NOT_HUNGRY } });
        requirePlayingGame(game);
        const rider = await createMonsterAt('Famine', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        rider.mux = game.u.ux;
        rider.muy = game.u.uy;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Famine|shrivels/, limit: 12 });

        await performMonsterHeroAttack(rider, game, {
            random: range => range - 1, rollOne: () => 1,
            rollDice: (count, sides) => count * sides,
        });

        assert.equal(game.u.uhp, 372);
        assert.equal(game.u.uhunger, fainted ? -10 : 821);
        const prose = [...messages, game._pending_message].join('\n');
        assert.equal(prose.match(/reaches out, and your body shrivels\./g)?.length, 1);
        assert.match(prose, /Famine touches you!/);
    });
}
