import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { ALTAR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('retouching a silver weapon after polymorph drops it through the altar blessing check', async () => {
    const level = freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = ALTAR;
    const saber = await knownObject(OBJECT_NAMES.indexOf('silver saber'), { invlet: 'a', where: 'inventory', bknown: false });
    game.inventory = [saber];
    pushKeys('a' + ' '.repeat(30));
    await rhack('w'.charCodeAt(0));
    await polymonHero(MONSTER_NAME.indexOf('vampire'));
    assert.equal(game.uwep, null);
    assert.equal(game.inventory.includes(saber), false);
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy).includes(saber), true);
    assert.equal(saber.bknown, true);
});
//# sourceMappingURL=artifact_retouch_drop.test.js.map