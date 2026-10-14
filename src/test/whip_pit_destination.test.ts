import test from 'node:test';
import assert from 'node:assert/strict';
import { TT_PIT, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BULLWHIP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('escaping a pit toward a large creature chooses a free square beyond the pit', async () => {
    const destinations = new Set<string>();
    for (let seed = 1n; seed <= 12n; seed++) {
        const level = freshPlayableRoom({ role: 'archeologist', hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } } });
        const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = whip;
        const horse = await createMonsterAt('horse', game.u.ux + 1, game.u.uy);
        game.u.utrap = 3;
        game.u.utraptype = TT_PIT;
        initRng(seed);

        await applyInventoryObject(whip, 'l    ');

        if (game.u.utrap) continue;
        assert.ok(game.u.ux !== 10 || game.u.uy !== 10, 'a successful pull cannot leave the hero in the pit');
        assert.ok(Math.abs(game.u.ux - horse.mx) <= 1 && Math.abs(game.u.uy - horse.my) <= 1);
        assert.equal(level.monsters.some(monster => monster.mx === game.u.ux && monster.my === game.u.uy), false);
        destinations.add(`${game.u.ux},${game.u.uy}`);
    }
    assert.ok(destinations.size > 1, 'native enexto chooses among the available neighbors');
});
