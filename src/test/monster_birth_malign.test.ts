import test from 'node:test';
import assert from 'node:assert/strict';

import { A_LAWFUL, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const peaceful of [true, false]) {
    for (const changesAlignment of [false, true]) {
        void test(`killing a pony born ${peaceful ? 'peaceful' : 'hostile'} and co-aligned ${changesAlignment ? 'retains its birth alignment value after the hero changes alignment' : 'adjusts the hero alignment record'}`, async () => {
            freshObjectRoom({ gameplaySeed: 3n });
            requirePlayingGame(game);
            const pony = await createMonsterAt('pony', 11, 10,
                NO_MINVENT | (peaceful ? 0 : MM_ANGRY));
            assert.equal(!!pony.mpeaceful, peaceful);
            if (changesAlignment) game.u.ualign.type = A_LAWFUL;

            await finishHeroMonsterKill(pony, pony.mx, pony.my, {
                showKillMessage: false, noCorpse: true,
            });

            assert.equal(game.u.ualign.record, peaceful ? -14 : 3);
        });
    }
}

void test('killing a chameleon born in coyote form gives the lawful hero credit for that form', async () => {
    freshObjectRoom({
        gameplaySeed: 1n,
        hero: { ualign: { type: A_LAWFUL, record: 0 } },
    });
    requirePlayingGame(game);
    const chameleon = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    assert.equal(chameleon.mnum, MONSTER_NAME.indexOf('coyote'));
    assert.equal(chameleon.mpeaceful, 0);

    await finishHeroMonsterKill(chameleon, chameleon.mx, chameleon.my, {
        showKillMessage: false, noCorpse: true,
    });

    assert.equal(game.u.ualign.record, 5);
});
