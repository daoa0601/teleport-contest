import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription } from '../js/pager.js';
import { game } from '../js/gstate.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { vision_recalc } from '../js/vision.js';
import { carriedGold, throwGold } from './support/gold-arena.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const contact of ['miss', 'harmless hit', 'blind miss'] as const) {
    void test(`gold named during a ${contact} retains the quantity knowledge from that contact`, async () => {
        const blind = contact === 'blind miss';
        await freshObjectRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        const purse = await carriedGold(37);
        const monster = await createMonsterAt(contact === 'harmless hit' ? 'leprechaun' : 'little dog', 13, 10);
        if (contact === 'harmless hit') monster.mcanmove = false;
        assert.equal(purse.dknown, false);

        await throwGold('l', ' '.repeat(8));

        assert.equal(purse.where, 'floor');
        assert.equal(purse.dknown, !blind, 'xname observes the purse only when the hero can see');
        await relocateMonsterTo(monster, 15, 12);
        game.u.blindTurns = 0;
        await vision_recalc(0);
        assert.equal(await farlookLocationDescription(purse.ox, purse.oy),
            blind ? 'some gold pieces' : '37 gold pieces');
    });
}
