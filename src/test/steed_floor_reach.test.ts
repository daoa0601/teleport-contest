import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { P_RIDING, P_UNSKILLED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { DIAMOND } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('an unskilled rider is told the named mount prevents reaching an object', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 }, flags: { pickup: false } });
    const pony = await createSaddledSteed();
    setMonsterGivenName(pony, 'Pip');
    await runExtendedCommand('ride', 'l');
    assert.ok(game.u.usteed === pony, 'The hero mounted Pip');
    installHeroWeaponSkills({ [P_RIDING]: P_UNSKILLED });
    const gem = await floorObject(DIAMOND, game.u.ux, game.u.uy);
    installPagerInput(resetInputState(), { expected: /mount|skilled enough/, limit: 2 });

    await rhack(','.charCodeAt(0));

    assert.match(game._last_message, /You aren't skilled enough to reach from Pip\./);
    assert.equal(game.context.move, 0);
    assert.equal(gem.where, 'floor');
});
