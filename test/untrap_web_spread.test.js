import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT, TT_WEB, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const existingTrap of [null, WEB, PIT]) {
    void test(`a failed web rescue ${existingTrap === PIT ? 'preserves another trap under the hero' : existingTrap === WEB ? 'spreads into the web under the hero' : 'spreads a new web under the hero'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const targetWeb = addTrap(level, WEB, 11, 10, { tseen: true });
        const monster = await createMonsterAt('goblin', 11, 10);
        monster.mtrapped = 1;
        const original = existingTrap === null ? null
            : addTrap(level, existingTrap, 10, 10, { tseen: false });
        const input = resetInputState();
        input.feed('untrap\nl');
        input.beforeRead = () => input.feed(' ');
        initRng(1n);
        await rhack('#'.charCodeAt(0));
        assert.equal(monster.mtrapped, 1);
        assert.ok(level.traps.includes(targetWeb));
        const heroTrap = level.traps.find(trap => trap.tx === 10 && trap.ty === 10);
        if (existingTrap === PIT) {
            assert.equal(heroTrap, original);
            assert.equal(game.u.utrap ?? 0, 0);
        }
        else {
            assert.equal(heroTrap?.ttyp, WEB);
            assert.ok((game.u.utrap ?? 0) > 0);
            assert.equal(game.u.utraptype, TT_WEB);
            if (original)
                assert.equal(heroTrap, original);
        }
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=untrap_web_spread.test.js.map