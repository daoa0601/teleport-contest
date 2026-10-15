import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { A_STR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_GAIN_ABILITY } from '../js/object_data.js';
import { races } from '../js/roles.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [raceName, form, strength, maximum] of [
    ['human', 'kitten', 18, 18],
    ['gnome', 'hill giant', 118, 119],
]) {
    void test(`gain ability respects a ${form}'s Strength limit for a ${raceName} hero`, async () => {
        const race = races.find(candidate => candidate.name === raceName);
        assert.ok(race);
        freshObjectRoom({ race });
        requirePlayingGame(game);
        installPolymorphedHero(form);
        game.u.acurr.a[A_STR] = strength;
        game.u.amax.a[A_STR] = maximum;
        const potion = await addInventoryObject(POT_GAIN_ABILITY, { blessed: true, quan: 2 });
        for (let drink = 0; drink < 2; drink++) {
            resetInputState().feed(`${potion.invlet}${' '.repeat(60)}`);
            await rhack('q'.charCodeAt(0));
            assert.equal(game.u.acurr.a[A_STR], maximum);
            assert.equal(game.u.amax.a[A_STR], maximum);
        }
    });
}
//# sourceMappingURL=attribute_form_limits.test.js.map