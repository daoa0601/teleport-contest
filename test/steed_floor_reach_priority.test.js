import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT, P_RIDING, P_UNSKILLED } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { DIAMOND } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const pit of [false, true]) {
    void test(`an unskilled rider gets ${pit ? 'pit-edge feedback above a seen pit' : 'riding feedback while levitating'}`, async () => {
        freshObjectRoom({ role: 'knight', hero: { ulevel: 30 }, flags: { pickup: false } });
        requirePlayingGame(game);
        const pony = await createSaddledSteed();
        setMonsterGivenName(pony, 'Pip');
        await runExtendedCommand('ride', 'l');
        assert.ok(game.u.usteed === pony, 'The hero mounted Pip');
        installHeroWeaponSkills({ [P_RIDING]: P_UNSKILLED });
        if (pit)
            addTrap(game.level, PIT, game.u.ux, game.u.uy, { tseen: true });
        else
            grantIntrinsicProperty('levitation', 'outside');
        const gem = await floorObject(DIAMOND, game.u.ux, game.u.uy);
        installPagerInput(resetInputState(), { expected: /mount|reach/, limit: 2 });
        await rhack(','.charCodeAt(0));
        assert.equal(game._last_message, pit ? 'You cannot reach the bottom of the pit.'
            : "You aren't skilled enough to reach from Pip.");
        assert.equal(game.context.move, 0);
        assert.equal(gem.where, 'floor');
    });
}
//# sourceMappingURL=steed_floor_reach_priority.test.js.map