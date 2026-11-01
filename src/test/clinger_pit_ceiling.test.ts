import assert from 'node:assert/strict';
import test from 'node:test';

import { LANDMINE, PIT, SPIKED_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/trap.js';
import { pushKeys } from '../js/input.js';
import { placeMonsterAt } from '../js/steed.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { createSpecialLevel } from './support/topology.js';

for (const onAstral of [false, true]) {
    void test(`a clinger surviving a land mine ${onAstral ? 'falls into its pit on Astral' : 'avoids its pit on Earth'}`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
            monster: { species: 'wumpus', hitPoints: 100 },
        });
        requirePlayingGame(game);
        game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
        game.earth_level = createSpecialLevel({ dnum: 1, dlevel: 5 });
        game.u.uz = { dnum: 1, dlevel: onAstral ? 1 : 5 };
        monster.mundetected = false;
        placeMonsterAt(monster, 12, 10);
        // mintrap() now publishes inside the move; acknowledge its pagers.
        pushKeys(' '.repeat(30));

        const turn = await takeMonsterTurn(monster, game, (limit: number) => limit - 1,
            (count, sides) => count * sides, (sides: number) => sides);
        assert.ok(turn.movement, 'the clinger must move onto the mine');
        assert.equal(trap.ttyp, PIT);
        assert.equal(monster.mtrapped ?? 0, onAstral ? 1 : 0);
        assert.equal(monster.mhp, onAstral ? 78 : 84,
            'the mine deals 16 damage, and falling into its pit deals another 6');
        assert.equal(game._lastPlineMessage, onAstral
            ? 'The wumpus falls into a pit!'
            : "The wumpus doesn't fall into the pit.");
    });
}

for (const type of [PIT, SPIKED_PIT]) {
    void test(`a clinger falls into ${type === PIT ? 'a pit' : 'a spiked pit'} on Astral`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(type, {
            monster: { species: 'wumpus', hitPoints: 100 },
        });
        requirePlayingGame(game);
        game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
        game.earth_level = createSpecialLevel({ dnum: 1, dlevel: 5 });
        game.u.uz = { dnum: 1, dlevel: 1 };
        const options = { rollOne: (sides: number) => sides, publish: () => {} };

        const action = await triggerImmediateMonsterTrap(monster, game, options);
        await finishImmediateMonsterTrap(action, game, options);

        assert.equal(monster.mtrapped, 1);
        assert.equal(monster.mhp, type === PIT ? 94 : 90);
        assert.equal(trap.tseen, true);
    });
}
