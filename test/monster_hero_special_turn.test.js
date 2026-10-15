import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const species of ['Scorpius', 'Pestilence', 'Famine']) {
    void test(`waiting next to ${species} resolves its special contact before the next command`, async () => {
        const input = freshTurnRoom({ hero: { uhp: 500, uhpmax: 500 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        monster.movement = 12;
        monster.msleeping = 0;
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /Scorpius|Pestilence|Famine|sick|shrivels|stun|stagger/, limit: 20 });
        initRng(1n);
        input.feed('m.');
        await moveloop_core();
        await finishAtCommandInput(input, () => moveloop_core(), /Scorpius|Pestilence|Famine|sick|shrivels|stun|stagger/);
        assert.equal(game.moves, 2, 'The monster response uses one hero turn');
        assert.ok(game.u.uhp < 500, 'Contact damage has completed before command input resumes');
        if (species === 'Famine') {
            assert.ok(game.u.uhunger < 870, 'Famine takes more nutrition than ordinary turn metabolism');
        }
        else {
            assert.ok(game.u.sick);
            assert.equal(game.u.sickCause, species);
        }
    });
}
//# sourceMappingURL=monster_hero_special_turn.test.js.map