import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { NO_MINVENT } from '../js/const.js';
import { visiblePriestName } from '../js/priest.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const species of ['aligned cleric', 'high cleric']) {
    void test(`a visible hallucinated ${species} introduces itself as a poohbah`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const priest = await createMonsterAt(species, 11, 10, NO_MINVENT);
        priest.ispriest = 1;
        priest.epri = {
            shroom: 0, shralign: 0, shrpos: { x: 12, y: 10 },
            shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
            intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
        };
        game.u.hallucinationTurns = 20;

        const name = visiblePriestName(priest);

        assert.match(name, species === 'high cleric'
            ? /^(?:The )?Grand poohbah of .+$/i : /^(?:The )?Poohbah of .+$/i);
    });
}
