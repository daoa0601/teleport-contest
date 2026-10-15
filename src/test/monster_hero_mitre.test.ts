import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const role of ['priest', 'wizard'] as const) {
    for (const species of ['human zombie', 'goblin']) {
        void test(`the Mitre of Holiness ${role === 'priest' && species === 'human zombie' ? 'halves' : 'does not reduce'} a ${species} hit against a ${role}`, async () => {
            freshObjectRoom({ role, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
            requirePlayingGame(game);
            // Noon isolates the Mitre's reduction from undead midnight damage.
            game.datetime = '20000101120000';
            const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            monster.mux = game.u.ux;
            monster.muy = game.u.uy;
            game.uarmh = await artifactObject('The Mitre of Holiness', { blessed: false });
            installPagerInput(resetInputState(), { expected: /zombie|goblin/, limit: 8 });

            await performMonsterHeroAttack(monster, game, {
                random: range => range - 1, rollOne: () => 1, rollDice: () => 8,
            });

            assert.equal(game.u.uhp, role === 'priest' && species === 'human zombie' ? 96 : 92);
        });
    }
}
