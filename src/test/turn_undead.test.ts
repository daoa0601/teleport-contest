import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { turnUndeadByCallingOnDeity } from '../js/turn_undead.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_HUMAN_MUMMY = 192;
const PM_HUMAN_ZOMBIE = 244;

function freshPriest(alignment: -1 | 0 | 1 = 1) {
    freshObjectRoom({
        left: 6, right: 14, top: 6, bottom: 14,
        role: 'priest',
        hero: {
            uz: { dnum: 0, dlevel: 6 },
            ulevel: 6,
            ualign: { type: alignment, record: 0 },
        },
        moves: 50,
        objectInitializationSeed: 44n,
    });
    requirePlayingGame(game);
    game.urole.gods = {
        lawful: 'Athena', neutral: 'Hermes', chaotic: 'Loki',
    };
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
}

void test('a lawful priest destroys a zombie and frightens a tougher mummy',
    async () => {
        freshPriest(1);
        requirePlayingGame(game);
        const zombie = await createMonsterAt(PM_HUMAN_ZOMBIE, 11, 10);
        zombie.m_lev = 4;
        zombie.msleeping = 1;
        const mummy = await createMonsterAt(PM_HUMAN_MUMMY, 12, 10);
        mummy.m_lev = 4;
        mummy.msleeping = 1;
        installPagerInput(resetInputState(), { expected: /Athena|zombie|mummy|turn|destroy/i, limit: 4 });

        await turnUndeadByCallingOnDeity(game, {
            random: range => range - 1,
        });

        assert.ok(zombie.mhp <= 0);
        assert.equal(mummy.mhp, mummy.mhpmax);
        assert.equal(mummy.msleeping, 0);
        assert.equal(mummy.mflee, 1);
        assert.equal(game.context.move, 1);
    });

void test('a chaotic priest makes a weak undead monster peaceful', async () => {
    freshPriest(-1);
    requirePlayingGame(game);
    const zombie = await createMonsterAt(PM_HUMAN_ZOMBIE, 11, 10);
    zombie.m_lev = 4;
    zombie.msleeping = 1;

    await turnUndeadByCallingOnDeity(game, {
        random: range => range - 1,
    });

    assert.ok(zombie.mhp > 0);
    assert.equal(zombie.mpeaceful, 1);
    assert.ok(!zombie.mflee);
});
