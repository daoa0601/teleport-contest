import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { turnUndeadByCallingOnDeity } from '../js/turn_undead.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_HUMAN_MUMMY = 192;
const PM_HUMAN_ZOMBIE = 244;

function freshPriest(alignment = 1) {
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
    game.urole.gods = {
        lawful: 'Athena', neutral: 'Hermes', chaotic: 'Loki',
    };
    game.dungeons = [{ dname: 'The Dungeons of Doom' }];
}

test('a lawful priest destroys a zombie and frightens a tougher mummy',
    async () => {
        freshPriest(1);
        const zombie = addMonster({
            mnum: PM_HUMAN_ZOMBIE, x: 11, y: 10,
            level: 4, msleeping: 1,
        });
        const mummy = addMonster({
            mnum: PM_HUMAN_MUMMY, x: 12, y: 10,
            level: 4, msleeping: 1,
        });

        await turnUndeadByCallingOnDeity(game, {
            random: range => range - 1,
        });

        assert.ok(zombie.mhp <= 0);
        assert.equal(mummy.mhp, mummy.mhpmax);
        assert.equal(mummy.msleeping, 0);
        assert.equal(mummy.mflee, 1);
        assert.equal(game.context.move, 1);
    });

test('a chaotic priest makes a weak undead monster peaceful', async () => {
    freshPriest(-1);
    const zombie = addMonster({
        mnum: PM_HUMAN_ZOMBIE, x: 11, y: 10,
        level: 4, msleeping: 1,
    });

    await turnUndeadByCallingOnDeity(game, {
        random: range => range - 1,
    });

    assert.ok(zombie.mhp > 0);
    assert.equal(zombie.mpeaceful, 1);
    assert.ok(!zombie.mflee);
});
