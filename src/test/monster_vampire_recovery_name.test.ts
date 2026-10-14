import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('hallucination changes the description of a vampire rising from its killed form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const bat = await createMonsterAt('vampire bat', 12, 10, NO_MINVENT);
    bat.cham = MONSTER_NAME.indexOf('vampire');
    game.u.hallucinationTurns = 10;
    const messages: string[] = [];

    const death = await finishMonsterKilled(bat, game, {
        damageType: AD_PHYS, cause: null,
        publish: async message => messages.push(message),
    });

    assert.equal(death.survived, true);
    assert.equal(bat.mnum, MONSTER_NAME.indexOf('vampire'));
    const rise = messages.find(message => message.includes('rises as'));
    assert.ok(rise, 'A visible vampire recovery must announce its new form');
    assert.doesNotMatch(rise, /vampire/);
});
