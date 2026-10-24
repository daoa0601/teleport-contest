import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { LONG_SWORD, ROCK } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
void test('a hero turned eyeless on the downstairs still sees its weapon hit the pile', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    const input = resetInputState();
    installPagerInput(input, { expected: /./, limit: 40 });
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    await floorObject(ROCK, game.u.ux, game.u.uy);
    const sword = await addInventoryObject(LONG_SWORD);
    await setPrimaryWeapon(sword);
    vision_recalc(0);
    assert.equal(cansee(game.u.ux, game.u.uy), true);
    // C polymon() blinds an eyeless form, but vision is only recalculated
    // later, so dropping the weapon still uses the old sight.
    assert.equal((await polymonHero(MONSTER_NAME.indexOf('shrieker'))).transformed, true);
    const prose = `${messages.join('\n')}\n${game._pending_message ?? ''}`;
    assert.match(prose, /The long sword hits another object/);
});
//# sourceMappingURL=polymorph_stair_drop.test.js.map