import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { SPE_BOOK_OF_THE_DEAD } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
void test('a lich can harass the hero while another monster blocks its desired book', async () => {
    let arrivals = 0;
    for (let seed = 1; seed <= 20; seed++) {
        freshObjectRoom({ right: 40, hero: { coldResistance: true, uac: -1000 } });
        requirePlayingGame(game);
        const lich = await createMonsterAt('master lich', 30, 10, NO_MINVENT);
        lich.mspec_used = 100;
        await floorObject(SPE_BOOK_OF_THE_DEAD, 20, 10);
        await createMonsterAt('human', 20, 10, NO_MINVENT);
        initRng(seed);
        await takeMonsterTurn(lich, game);
        if (Math.max(Math.abs(lich.mx - game.u.ux), Math.abs(lich.my - game.u.uy)) <= 1)
            arrivals++;
    }
    assert.ok(arrivals > 0, 'An occupied book square must still allow the lich to teleport beside the hero');
});
void test('a lich teleports onto an unoccupied book and takes ownership before moving', async () => {
    freshObjectRoom({ right: 40 });
    requirePlayingGame(game);
    const lich = await createMonsterAt('master lich', 30, 10, NO_MINVENT);
    lich.mspec_used = 100;
    const book = await floorObject(SPE_BOOK_OF_THE_DEAD, 20, 10);
    await takeMonsterTurn(lich, game);
    assert.equal(book.where, 'minvent');
    assert.equal(book.ocarry, lich);
    assert.ok(lich.minvent?.includes(book));
});
//# sourceMappingURL=pool_monster_turns.test.js.map