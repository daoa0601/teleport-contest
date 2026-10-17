import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { CORPSE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// mon.c: xkilled() tests LEVEL_SPECIFIC_NOCORPSE, and its corpse_chance()
// call tests it again, so undead killed in a graveyard pass two 1-in-3 rolls
// before the ordinary 1-in-tmp corpse roll.
void test('undead slain in a graveyard leave a corpse about one time in twenty-seven', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const level = requireGameLevel();
    level.flags.graveyard = true;
    game.u.ulevel = 30;
    initRng(11n);
    const x = game.u.ux + 2, y = game.u.uy;
    let corpses = 0;
    const kills = 540;
    for (let i = 0; i < kills; i++) {
        const zombie = await createMonsterAt('human zombie', x, y, NO_MINVENT);
        await finishHeroMonsterKill(zombie, x, y, { showKillMessage: false, publish: async () => { } });
        const pile = level.objects[x]?.[y] ?? [];
        corpses += pile.filter(object => object.otyp === CORPSE).length;
        pile.length = 0;
    }
    // Expected 20 of 540; a single graveyard roll would leave about 60.
    assert.ok(corpses > 5 && corpses < 40, `${corpses} corpses`);
});
//# sourceMappingURL=graveyard_corpses.test.js.map