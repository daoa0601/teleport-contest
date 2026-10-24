import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { aggravateMonsters } from '../js/monster_anger.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const cannotMove of [0, false] as const) {
    void test(`aggravation can release paralysis stored as a ${typeof cannotMove} flag`, async () => {
        freshObjectRoom();
        const goblin = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
        goblin.mcanmove = cannotMove;
        goblin.mfrozen = 20;

        aggravateMonsters(game, () => 0);

        assert.ok(goblin.mcanmove, 'aggravation should restore the ability to move');
        assert.equal(goblin.mfrozen, 0);
    });
}

for (const sleeperInside of [false, true]) {
    void test(`aggravation spell selection ${sleeperInside ? 'recognizes' : 'ignores'} a sleeper ${sleeperInside ? 'inside' : 'outside'} the caster's tower area`, async () => {
        freshObjectRoom({ right: 25 });
        requirePlayingGame(game);
        game._activeSpecialLevel = {
            prototype: 'wizard1', file: 'wizard1.lua',
            downTeleportExclude: { lx: 7, ly: 6, hx: 16, hy: 14 },
        };
        const caster = await createMonsterAt('golden naga', 14, 10, MM_ANGRY | NO_MINVENT);
        caster.m_lev = 21;
        const sleeper = await createMonsterAt('giant beetle', sleeperInside ? 15 : 20, 10, NO_MINVENT);
        sleeper.msleeping = 1;

        const action = await takeMonsterTurn(caster, game, limit => {
            if (limit === 21) return 13;
            if (limit === 210) return 100;
            return 1;
        });

        assert.equal(action.movement.spellCast?.spell === 'aggravation', sleeperInside);
    });
}
