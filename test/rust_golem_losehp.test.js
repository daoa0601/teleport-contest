import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameLevel } from '../js/gstate.js';
import { RUST_TRAP } from '../js/const.js';
import { dotrap } from '../js/trap.js';
import { addTrap } from './support/level-state.js';
import { finish, startMenuGame } from './support/context-menu-game.js';
import { installPolymorphedHero } from './support/hero-state.js';
// C trap.c:trapeffect_rust_trap() rusts a polymorphed iron golem through
// hack.c:losehp() (trap.c:1651), so the optional showdamage readout
// "[HP -n, m left]" appears like for any other hero damage.
void test('a rust trap shows the golem damage through losehp', async () => {
    const engine = await startMenuGame();
    try {
        installPolymorphedHero('iron golem', {
            hitPoints: 40, maxHitPoints: 40,
        });
        game.flags.showdamage = true;
        const trap = addTrap(requireGameLevel(), RUST_TRAP, game.u.ux, game.u.uy);
        engine.inputGate.feed('     ');
        await dotrap(trap);
        const messages = [...game._messageHistory, game._pending_message].join('\n');
        assert.match(messages, /\[HP -40, 0 left\]/);
    }
    finally {
        await finish(engine);
    }
});
//# sourceMappingURL=rust_golem_losehp.test.js.map