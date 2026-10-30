import assert from 'node:assert/strict';
import test from 'node:test';
import { POLY_CONTROLLED } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { polymorphHero } from '../js/polyself.js';
import { roles } from '../js/roles.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { installPagerInput } from './support/pager-input.js';
// C polyself.c:newman() logs livelog_newform(TRUE, oldgend, newgend) when the
// level is unchanged.  oldgend comes from poly_gender() of the neuter form, and
// livelog_newform() treats that 2 as female, so a male Priest returning from a
// homunculus is "polymorphed into a Priest" (the role name differs from
// "Priestess"), never "a male <rank>"; a hero who also became female matches
// the Priestess side and logs her unchanged rank.
void test('a renewed male Priest from a neuter form logs the role name', async () => {
    let unchangedLevels = 0;
    for (let seed = 1n; seed <= 40n; seed++) {
        await freshRoomWithPolymorphedHero('homunculus', { gameplaySeed: seed });
        requirePlayingGame(game);
        const priest = roles.find(role => role.key === 'priest');
        if (!priest)
            throw new Error('The priest role record is required');
        game.urole = priest;
        game.flags.female = false;
        game.u.polymorphControl = true;
        game.gamelog = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /new (?:man|woman)|feel/i, limit: 10 });
        input.feed('human\n');
        const oldLevel = game.u.ulevel;
        const result = await polymorphHero(POLY_CONTROLLED);
        if (result.died || game.u.ulevel !== oldLevel)
            continue;
        unchangedLevels++;
        const log = game.gamelog.map(entry => entry.text);
        const form = game.flags.female ? 'female Adept' : 'Priest';
        assert.ok(log.includes(`polymorphed into a ${form}`), log.join(' | '));
    }
    assert.ok(unchangedLevels > 0, 'no seed kept the experience level');
});
//# sourceMappingURL=newman_gamelog.test.js.map