import test from 'node:test';
import assert from 'node:assert/strict';

// C dothrow.c:will_hurtle() asks goodpos(), whose accessible() test stops a
// knocked-back monster before iron bars even when it could walk through them.

import { IRONBARS, NO_MINVENT, W_NONPASSWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const form of ['garter snake', 'ghost']) {
    void test(`a hurtling ${form} ${form === 'ghost' ? 'passes' : 'crashes into'} bars`, async () => {
        const level = freshObjectRoom();
        const hero = installPolymorphedHero(form);
        const bars = level.requireAt(11, 10);
        bars.typ = IRONBARS;
        // may_passwall() applies this restriction only to stone walls.
        bars.wall_info = W_NONPASSWALL;
        const hp = hero.mh;

        await hurtleHero(1, 0, 1);

        assert.equal(hero.ux, form === 'ghost' ? 11 : 10);
        assert.equal(bars.typ, IRONBARS);
        if (form === 'ghost') assert.equal(hero.mh, hp);
        else {
            assert.ok(hero.mh < hp);
            assert.equal(game._pending_message, 'You crash into some iron bars.  Ouch!');
        }
    });
}

void test('a newt knocked toward iron bars stays where it was', async () => {
    const level = freshObjectRoom({ heroX: 5, right: 20 });
    requirePlayingGame(game);
    const newt = await createMonsterAt('newt', 12, 10, NO_MINVENT);
    level.requireAt(13, 10).typ = IRONBARS;

    await hurtleMonster(newt, 1, 0, 1, { random: () => 0 });

    assert.equal(newt.mx, 12);
    assert.equal(newt.my, 10);
});
