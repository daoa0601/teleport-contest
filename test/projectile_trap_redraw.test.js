import assert from 'node:assert/strict';
import test from 'node:test';
import { ARROW_TRAP, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { ARROW } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a visible missed trap arrow joins ammunition already lying at the hero', async () => {
    const level = freshObjectRoom({ hero: { uac: -100 } });
    requirePlayingGame(game);
    await floorObject(ARROW, game.u.ux, game.u.uy, {
        quan: 10, dknown: true, known: false, bknown: false,
        spe: 0, enchantment: 0, opoisoned: false,
    });
    const trap = addTrap(level, ARROW_TRAP, game.u.ux, game.u.uy);
    pushKeys(' '.repeat(8));
    initRng(11n);
    await triggerHeroTrap(trap);
    const arrows = floorObjectsAt(level, game.u.ux, game.u.uy)
        .filter(object => object.otyp === ARROW);
    assert.equal(arrows.length, 1, 'seeing the arrow allows it to join the known floor stack');
    assert.equal(arrows[0]?.quan, 11);
    assert.equal(arrows[0]?.dknown, true);
});
void test('revealing an arrow trap displays its victim before announcing the hit', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const centaur = await createMonsterAt('plains centaur', 12, 10, NO_MINVENT);
    centaur.mx = 11;
    newsym(12, 10);
    addTrap(level, ARROW_TRAP, 11, 10);
    await triggerImmediateMonsterTrap(centaur, game);
    const glyph = glyphAt(11, 10);
    assert.equal(glyph?.kind, 'monster');
    assert.ok(glyph?.kind === 'monster');
    assert.equal(glyph.mnum, centaur.mnum);
});
//# sourceMappingURL=projectile_trap_redraw.test.js.map