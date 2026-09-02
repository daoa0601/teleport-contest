import test from 'node:test';
import assert from 'node:assert/strict';

import {
    beginMonsterSpitAttack, resolveMonsterSpitFlight,
} from '../js/monster_spit.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { addMonster } from './support/monsters.js';

test('a black naga can spit acid at another monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = addMonster({
        species: 'black naga',
        x: 9,
        y: 10,
        hitPoints: 30,
        level: 8,
    });
    const target = addMonster({
        species: 'jackal',
        x: 12,
        y: 10,
        hitPoints: 12,
    });

    const spit = beginMonsterSpitAttack(naga, target.mx, target.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(target.mhp, 10);
    assert.deepEqual([naga.mx, naga.my], [9, 10]);
});
