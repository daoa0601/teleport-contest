import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { ROCK } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
for (const blind of [false, true]) {
    void test(`a falling rock is named from ${blind ? 'touch' : 'sight'} before striking the hero`, async () => {
        const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        if (blind)
            setHeroBlindnessTurns(20);
        const trap = addTrap(level, ROCKTRAP, game.u.ux, game.u.uy);
        await triggerHeroTrap(trap);
        assert.equal(game._pending_message, `A trap door in the ceiling opens and a ${blind ? 'stone' : 'rock'} falls on your head!`);
        const rock = floorObjectsAt(level, game.u.ux, game.u.uy).find(object => object.otyp === ROCK);
        assert.ok(rock);
        assert.equal(rock.dknown, !blind);
        assert.ok((game.u.uhp ?? 100) < 100);
        assert.equal(trap.once, true);
    });
}
//# sourceMappingURL=hero_rock_trap.test.js.map