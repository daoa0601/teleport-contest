import assert from 'node:assert/strict';
import test from 'node:test';

// C dothrow.c:mhurtle_step() petrifies a monster the hero sent flying into a
// cockatrice with minstapetrify(mon, TRUE): xkilled(XKILL_NOMSG) gives no kill
// message, and the square is redrawn to show the new statue.

import { NO_MINVENT } from '../js/const.js';
import { glyphAt } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKillOutcome } from '../js/hero_monster_death.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { STATUE } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a monster the hero hurls into a cockatrice silently becomes a visible statue', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const gremlin = await createMonsterAt('gremlin', ux + 1, uy, NO_MINVENT);
    await createMonsterAt('cockatrice', ux + 3, uy, NO_MINVENT);
    const messages: string[] = [];

    await hurtleMonster(gremlin, 1, 0, 3, {
        random: () => 0,
        announce: async message => { messages.push(message); },
        finishMonsterDeath: (victim, death) => finishHeroMonsterKillOutcome(
            victim, victim.mx, victim.my, { ...death, publish: async message => { messages.push(message); } },
        ),
    });

    assert.ok(messages.some(message => /The gremlin turns to stone\./.test(message)));
    assert.ok(!messages.some(message => /^You (kill|destroy)/.test(message)));
    const statue = game.level.objects[ux + 2]?.[uy]?.find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(glyphAt(ux + 2, uy)?.kind, 'object');
});
